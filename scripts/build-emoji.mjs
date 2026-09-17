import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'https://unicode.org/Public/emoji/15.1/emoji-test.txt';
const OUTPUT = new URL('../src/panel/lib/emoji-data.ts', import.meta.url);
const MAX_VERSION = 12;
const GROUPS = {
  'Smileys & Emotion': 'smileys',
  'People & Body': 'smileys',
  'Animals & Nature': 'nature',
  'Food & Drink': 'food',
  'Activities': 'activities',
  'Travel & Places': 'travel',
  'Objects': 'objects',
  'Symbols': 'symbols',
};
const ORDER = ['smileys', 'nature', 'food', 'activities', 'travel', 'objects', 'symbols'];
const SKIN_TONES = /\b1F3F[B-F]\b/;

const text = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : await (await fetch(SOURCE)).text();
const groups = new Map(ORDER.map((id) => [id, []]));
let group = null;
for (const line of text.split('\n')) {
  if (line.startsWith('# group:')) {
    group = GROUPS[line.slice(8).trim()] ?? null;
    continue;
  }
  if (!group || !line.includes('; fully-qualified')) continue;
  const match = line.match(/^([0-9A-F ]+?)\s*;\s*fully-qualified\s*#\s*(\S+)\s+E(\d+\.\d+)/);
  if (!match || SKIN_TONES.test(match[1]) || parseFloat(match[3]) > MAX_VERSION) continue;
  groups.get(group).push(match[2]);
}

const lines = ORDER.map((id) => `  { id: '${id}', emojis: '${groups.get(id).join(' ')}' },`);
writeFileSync(
  OUTPUT,
  `export type EmojiGroupId = ${ORDER.map((id) => `'${id}'`).join(' | ')};\n\n` +
    `export const EMOJI_GROUPS: { id: EmojiGroupId; emojis: string }[] = [\n${lines.join('\n')}\n];\n`
);
console.log(ORDER.map((id) => `${id}: ${groups.get(id).length}`).join(', '));
