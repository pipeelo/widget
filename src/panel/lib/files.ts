import type { MediaField } from '../api/types';
import { STR } from './strings';

// Espelho client-side da validação do servidor
// (SendWebsiteChannelMessageRequest): um arquivo por mensagem, no campo
// multipart com o nome do tipo. `max:` do Laravel é em KB.
const KB = 1024;

interface MediaRule {
  field: MediaField;
  mimes: string[];
  maxBytes: number;
  limitLabel: string;
}

const RULES: MediaRule[] = [
  { field: 'image', mimes: ['image/jpeg', 'image/png'], maxBytes: 50_000 * KB, limitLabel: '50 MB' },
  {
    field: 'audio',
    mimes: [
      'audio/aac',
      'audio/mp4',
      'audio/mpeg',
      'audio/mp3',
      'audio/amr',
      'audio/ogg',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/vnd.wave',
    ],
    maxBytes: 30_000 * KB,
    limitLabel: '30 MB',
  },
  {
    field: 'video',
    mimes: ['video/mp4', 'video/3gp', 'video/3gpp'],
    maxBytes: 100_000 * KB,
    limitLabel: '100 MB',
  },
  {
    field: 'document',
    mimes: [
      'application/pdf',
      'text/plain',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    maxBytes: 50_000 * KB,
    limitLabel: '50 MB',
  },
];

export const FILE_ACCEPT = RULES.map((rule) => rule.mimes.join(',')).join(',');

export type FileClassification =
  | { ok: true; field: MediaField }
  | { ok: false; error: string };

export function classifyFile(file: { type: string; size: number }): FileClassification {
  const mime = (file.type || '').toLowerCase();
  const rule = RULES.find((r) => r.mimes.indexOf(mime) !== -1);
  if (!rule) return { ok: false, error: STR.fileUnsupported };
  if (file.size > rule.maxBytes) return { ok: false, error: STR.fileTooLarge(rule.limitLabel) };
  return { ok: true, field: rule.field };
}
