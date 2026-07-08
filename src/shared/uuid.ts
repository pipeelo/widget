// uuid v4 do token de sessão. `crypto.randomUUID` só existe em contexto
// seguro — em site http o fallback cunha com `crypto.getRandomValues`
// (disponível em qualquer contexto, mesma força).
export function uuidV4(): string {
  const c: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // versão 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variante RFC 4122

  let out = '';
  for (let i = 0; i < 16; i++) {
    if (i === 4 || i === 6 || i === 8 || i === 10) out += '-';
    out += bytes[i]!.toString(16).padStart(2, '0');
  }
  return out;
}
