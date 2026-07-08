import type { ComponentChildren } from 'preact';

// Linkifica só http(s) — a regex é ancorada no scheme, o que já bloqueia
// javascript: e afins. Render por vnodes (nunca innerHTML): o texto da
// conversa é dado hostil por definição.
const URL_PATTERN = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/g;

export function Linkify({ text }: { text: string }) {
  const parts: ComponentChildren[] = [];
  const regex = new RegExp(URL_PATTERN.source, 'g');
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const url = match[0];
    parts.push(
      <a href={url} target="_blank" rel="noopener noreferrer nofollow">
        {url}
      </a>
    );
    cursor = match.index + url.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <span class="msg-text">{parts}</span>;
}
