export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong' | 'em' | 'del'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; url: string; children: Inline[] };

export type Block =
  | { kind: 'lines'; lines: Inline[][] }
  | { kind: 'list'; ordered: boolean; start: number; items: Inline[][] };

const URL_PATTERN = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/y;
const LINK_PATTERN = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/y;
const CODE_PATTERN = /`([^`\n]+)`/y;
const LIST_ITEM = /^\s{0,3}(?:([-*•])|(\d{1,3})[.)])\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;
const DOUBLE_MARKERS: Record<string, 'strong' | 'del'> = { '*': 'strong', '~': 'del' };
const SINGLE_MARKERS: Record<string, 'strong' | 'em' | 'del'> = { '*': 'strong', '_': 'em', '~': 'del' };

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return (ch >= '0' && ch <= '9') || ch.toLowerCase() !== ch.toUpperCase();
}

function isSpace(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

function runLength(text: string, index: number): number {
  const ch = text[index];
  let end = index;
  while (text[end] === ch) end++;
  return end - index;
}

type Span = { kind: 'strong' | 'em' | 'del'; inner: string; end: number };

function matchDouble(text: string, index: number): Span | null {
  const ch = text[index]!;
  const kind = DOUBLE_MARKERS[ch];
  if (!kind) return null;
  const marker = ch + ch;
  const close = text.indexOf(marker, index + 2);
  if (close === -1 || close === index + 2) return null;
  return { kind, inner: text.slice(index + 2, close), end: close + 2 };
}

function matchSingle(text: string, index: number): Span | null {
  const ch = text[index]!;
  const kind = SINGLE_MARKERS[ch];
  if (!kind || isWordChar(text[index - 1]) || isSpace(text[index + 1])) return null;
  const close = text.indexOf(ch, index + 1);
  if (close === -1 || isSpace(text[close - 1]) || isWordChar(text[close + 1])) return null;
  return { kind, inner: text.slice(index + 1, close), end: close + 1 };
}

function stickyMatch(pattern: RegExp, text: string, index: number): RegExpExecArray | null {
  pattern.lastIndex = index;
  return pattern.exec(text);
}

function parseInline(text: string): Inline[] {
  const nodes: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) nodes.push({ kind: 'text', text: buffer });
    buffer = '';
  };
  let index = 0;
  while (index < text.length) {
    const ch = text[index]!;
    if (ch === '[') {
      const match = stickyMatch(LINK_PATTERN, text, index);
      if (match) {
        flush();
        nodes.push({ kind: 'link', url: match[2]!, children: parseInline(match[1]!) });
        index += match[0].length;
        continue;
      }
    }
    if (ch === 'h') {
      const match = stickyMatch(URL_PATTERN, text, index);
      if (match) {
        flush();
        nodes.push({ kind: 'link', url: match[0], children: [{ kind: 'text', text: match[0] }] });
        index += match[0].length;
        continue;
      }
    }
    if (ch === '`') {
      const match = stickyMatch(CODE_PATTERN, text, index);
      if (match) {
        flush();
        nodes.push({ kind: 'code', text: match[1]! });
        index += match[0].length;
        continue;
      }
    }
    if (ch === '*' || ch === '_' || ch === '~') {
      const run = runLength(text, index);
      const span = run === 1 ? matchSingle(text, index) : run === 2 ? matchDouble(text, index) : null;
      if (span) {
        flush();
        nodes.push({ kind: span.kind, children: parseInline(span.inner) });
        index = span.end;
        continue;
      }
      buffer += text.slice(index, index + run);
      index += run;
      continue;
    }
    buffer += ch;
    index++;
  }
  flush();
  return nodes;
}

export function parseMessage(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const last = blocks[blocks.length - 1];
    const item = LIST_ITEM.exec(raw);
    if (item) {
      const ordered = item[2] !== undefined;
      const content = parseInline(item[3]!);
      if (last && last.kind === 'list' && last.ordered === ordered) last.items.push(content);
      else blocks.push({ kind: 'list', ordered, start: ordered ? parseInt(item[2]!, 10) : 1, items: [content] });
      continue;
    }
    const heading = HEADING.exec(raw);
    const line: Inline[] = heading ? [{ kind: 'strong', children: parseInline(heading[1]!) }] : parseInline(raw);
    if (last && last.kind === 'lines') last.lines.push(line);
    else blocks.push({ kind: 'lines', lines: [line] });
  }
  return blocks;
}

function inlineText(nodes: Inline[]): string {
  return nodes.map((node) => (node.kind === 'text' || node.kind === 'code' ? node.text : inlineText(node.children))).join('');
}

export function plainText(text: string): string {
  return parseMessage(text)
    .flatMap((block) => (block.kind === 'list' ? block.items : block.lines))
    .map(inlineText)
    .join('\n');
}

const EMOJI_UNIT =
  '(?:\\p{Regional_Indicator}{2}|[0-9#*]\\uFE0F?\\u20E3|(?:\\p{Emoji_Presentation}|\\p{Extended_Pictographic}\\uFE0F)\\p{Emoji_Modifier}?(?:\\u200D\\p{Extended_Pictographic}\\uFE0F?\\p{Emoji_Modifier}?)*)';

let emojiOnlyPattern: RegExp | null = null;
try {
  emojiOnlyPattern = new RegExp('^(?:\\s*' + EMOJI_UNIT + '\\s*){1,3}$', 'u');
} catch {
  emojiOnlyPattern = null;
}

export function isEmojiOnly(text: string): boolean {
  return emojiOnlyPattern !== null && text.trim() !== '' && emojiOnlyPattern.test(text);
}
