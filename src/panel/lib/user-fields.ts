import type { WidgetUser } from '../../shared/protocol';

type UserField = keyof WidgetUser;

const EMAIL =
  /^(?=[^@]{1,64}@)(?=.{1,254}$)[\w!#$%&'*+/=?^`{|}~-]+(?:\.[\w!#$%&'*+/=?^`{|}~-]+)*@(?!.*[^.]{64})(?:[a-z\d]+(?:-+[a-z\d]+)*\.)+[a-z][a-z\d]*(?:-+[a-z\d]+)*$/i;
const BR_PHONE =
  /^(?:1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])(?:9\d{8}|[2-5]\d{7})$/;
const INTERNATIONAL_PHONE = /^[1-9]\d{7,14}$/;
const WHATSAPP_LEGACY_MOBILE = /^55\d\d[6-9]\d{7}$/;
const ASCII_ZERO = 48;
const CPF = { shape: /^\d{11}$/, maxWeight: 11 };
const CNPJ = { shape: /^[\dA-Z]{12}\d\d$/, maxWeight: 9 };

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  const international = value.startsWith('+');
  if (international && !digits.startsWith('55')) {
    return INTERNATIONAL_PHONE.test(digits) ? `+${digits}` : null;
  }
  const full = WHATSAPP_LEGACY_MOBILE.test(digits)
    ? `${digits.slice(0, 4)}9${digits.slice(4)}`
    : digits;
  const national = international ? full.slice(2) : full.replace(/^(?:55|0)(?=\d{10,11}$)/, '');
  return BR_PHONE.test(national) ? `+55${national}` : null;
}

function checkDigit(body: string, maxWeight: number): number {
  let sum = 0;
  let weight = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += (body.charCodeAt(i) - ASCII_ZERO) * weight;
    weight = weight === maxWeight ? 2 : weight + 1;
  }
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

function hasValidCheckDigits(value: string, maxWeight: number): boolean {
  const body = value.slice(0, -2);
  const first = checkDigit(body, maxWeight);
  return value.endsWith(`${first}${checkDigit(body + first, maxWeight)}`);
}

function normalizeDocument(value: string): string | null {
  const compact = value.toUpperCase().replace(/[^\dA-Z]/g, '');
  if (/^(.)\1*$/.test(compact)) return null;
  const kind = [CPF, CNPJ].find((candidate) => candidate.shape.test(compact));
  return kind && hasValidCheckDigits(compact, kind.maxWeight) ? compact : null;
}

const NORMALIZERS: Record<UserField, (value: string) => string | null> = {
  name: (value) => value,
  email: (value) => (EMAIL.test(value) ? value : null),
  phone: normalizePhone,
  document: normalizeDocument,
};

export function normalizeUserField(field: UserField, raw: string): string | null {
  const value = raw.trim();
  return value ? NORMALIZERS[field](value) : null;
}

export function formatUserField(field: UserField, raw: string): string {
  const value = normalizeUserField(field, raw);
  if (field === 'document' && value) {
    return value.length === 11
      ? value.replace(/^(.{3})(.{3})(.{3})/, '$1.$2.$3-')
      : value.replace(/^(.{2})(.{3})(.{3})(.{4})/, '$1.$2.$3/$4-');
  }
  if (field === 'phone' && value?.startsWith('+55')) {
    return value.slice(3).replace(/^(\d\d)(\d+)(\d{4})$/, '($1) $2-$3');
  }
  return raw;
}
