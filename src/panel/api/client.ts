import { ENV } from '../env';
import type { HistoryPage, MediaField, SendOutcome, WidgetConfig } from './types';

function endpoint(path: string, identifier: string): string {
  return `${ENV.apiUrl}/website-channel/${path}/${encodeURIComponent(identifier)}`;
}

function withTimeout(ms: number): { signal: AbortSignal; clear(): void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

export async function fetchConfig(identifier: string): Promise<WidgetConfig> {
  const t = withTimeout(15000);
  try {
    const res = await fetch(endpoint('config', identifier), { signal: t.signal });
    if (!res.ok) throw new Error(`config HTTP ${res.status}`);
    return (await res.json()) as WidgetConfig;
  } finally {
    t.clear();
  }
}

export async function fetchHistory(
  identifier: string,
  externalId: string,
  cursor?: string | null,
  perPage = 30
): Promise<HistoryPage> {
  const params = new URLSearchParams({ external_id: externalId, per_page: String(perPage) });
  if (cursor) params.set('cursor', cursor);
  const t = withTimeout(20000);
  try {
    const res = await fetch(`${endpoint('history', identifier)}?${params.toString()}`, {
      signal: t.signal,
    });
    if (!res.ok) throw new Error(`history HTTP ${res.status}`);
    const page = (await res.json()) as HistoryPage;
    return {
      ...page,
      data: Array.isArray(page.data) ? page.data : [],
      next_cursor: page.next_cursor ?? null,
    };
  } finally {
    t.clear();
  }
}

async function parseSendResponse(res: Response): Promise<SendOutcome> {
  if (res.status === 201) {
    const body = (await res.json()) as { message_id?: unknown };
    if (typeof body.message_id !== 'string') throw new Error('resposta 201 sem message_id');
    return { messageId: body.message_id };
  }
  if (res.ok) return { messageId: null }; // 200 [] = descartado (cliente bloqueado)
  throw new Error(`send HTTP ${res.status}`);
}

export async function sendText(
  identifier: string,
  externalId: string,
  text: string
): Promise<SendOutcome> {
  const t = withTimeout(20000);
  try {
    const res = await fetch(endpoint('message', identifier), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ external_id: externalId, text }),
      signal: t.signal,
    });
    return await parseSendResponse(res);
  } finally {
    t.clear();
  }
}

export async function sendFile(
  identifier: string,
  externalId: string,
  field: MediaField,
  file: File
): Promise<SendOutcome> {
  const form = new FormData();
  form.append('external_id', externalId);
  form.append(field, file, file.name);
  // Sem header Content-Type: o browser gera o boundary do multipart.
  // Sem timeout: upload grande legítimo pode demorar.
  const res = await fetch(endpoint('message', identifier), {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });
  return parseSendResponse(res);
}
