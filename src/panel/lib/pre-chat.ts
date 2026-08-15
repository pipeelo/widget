import type { WidgetUser } from '../../shared/protocol';
import type { WidgetConfig } from '../api/types';

export type PreChatFieldKey = keyof WidgetUser;

const KNOWN_FIELDS: readonly PreChatFieldKey[] = ['name', 'email', 'phone', 'document'];

export function normalizePreChatFields(raw: unknown): PreChatFieldKey[] {
  if (!raw || typeof raw !== 'object') return [];
  const fields = (raw as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  const result: PreChatFieldKey[] = [];
  for (const item of fields) {
    const key = item as PreChatFieldKey;
    if (KNOWN_FIELDS.includes(key) && !result.includes(key)) result.push(key);
  }
  return result;
}

export function isBasicEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function covers(identity: WidgetUser | null, field: PreChatFieldKey): boolean {
  const value = identity?.[field];
  if (typeof value !== 'string' || !value.trim()) return false;
  return field !== 'email' || isBasicEmail(value.trim());
}

export function missingPreChatFields(
  config: WidgetConfig | null,
  identity: WidgetUser | null
): PreChatFieldKey[] {
  return normalizePreChatFields(config?.pre_chat_form).filter((field) => !covers(identity, field));
}

export function composeIdentity(
  host: WidgetUser | null,
  form: WidgetUser | null
): WidgetUser | null {
  let user: WidgetUser | null = null;
  for (const key of KNOWN_FIELDS) {
    const value = covers(host, key) ? host![key] : covers(form, key) ? form![key] : undefined;
    if (value) (user = user || {})[key] = value;
  }
  return user;
}
