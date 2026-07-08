// Guarda do orçamento do loader: o script roda em site de terceiro e precisa
// continuar minúsculo. Falha o build se passar de 6 kB gzip ou se sobrar
// `import.meta` (SyntaxError em script clássico) ou um global de lib.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const LIMIT = 6144;
const file = new URL('../dist/v1/loader.js', import.meta.url);
const code = readFileSync(file, 'utf8');

const gzip = gzipSync(Buffer.from(code)).length;
console.log(`loader.js: ${code.length} bytes (${gzip} bytes gzip, limite ${LIMIT})`);

let failed = false;
if (gzip > LIMIT) {
  console.error(`ERRO: loader estourou o orçamento de ${LIMIT} bytes gzip`);
  failed = true;
}
if (code.includes('import.meta')) {
  console.error('ERRO: sobrou `import.meta` no loader (SyntaxError em script clássico)');
  failed = true;
}
if (/\bvar PipeeloLoader\s*=/.test(code)) {
  console.error('ERRO: o build criou o global `PipeeloLoader` (entry não pode ter export)');
  failed = true;
}
if (/\bprocess\.env\b/.test(code)) {
  console.error('ERRO: sobrou `process.env` no loader');
  failed = true;
}
process.exit(failed ? 1 : 0);
