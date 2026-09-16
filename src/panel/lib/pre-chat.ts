import type { WidgetUser } from '../../shared/protocol';
import type { WidgetConfig } from '../api/types';
import { normalizeUserField } from './user-fields';

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

function rawField(user: WidgetUser | null, field: PreChatFieldKey): string {
  const value = user?.[field];
  return typeof value === 'string' ? value : '';
}

export function missingPreChatFields(
  config: WidgetConfig | null,
  identity: WidgetUser | null
): PreChatFieldKey[] {
  return normalizePreChatFields(config?.pre_chat_form).filter(
    (field) => !normalizeUserField(field, rawField(identity, field))
  );
}

export function composeIdentity(
  host: WidgetUser | null,
  form: WidgetUser | null
): WidgetUser | null {
  let user: WidgetUser | null = null;
  for (const key of KNOWN_FIELDS) {
    const value =
      normalizeUserField(key, rawField(host, key)) ??
      normalizeUserField(key, rawField(form, key)) ??
      rawField(host, key).trim();
    if (value) (user = user || {})[key] = value;
  }
  return user;
}
