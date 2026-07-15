import { render } from 'preact';
import { App, type PanelParams } from './App';
import { STR } from './lib/strings';
import './styles.css';

// Os parâmetros chegam no FRAGMENT da URL do iframe (#id=…&eid=…&lastread=…):
// fragment não entra em request nenhum nem em Referer.
function readHashParams(): URLSearchParams {
  const raw = location.hash.charAt(0) === '#' ? location.hash.slice(1) : location.hash;
  return new URLSearchParams(raw);
}

function parseParams(hash: URLSearchParams): PanelParams | null {
  const id = hash.get('id');
  const eid = hash.get('eid');
  if (!id || !eid) return null;
  return { id, eid, lastread: hash.get('lastread'), mode: hash.get('mode') };
}

const hash = readHashParams();

// Densidade mobile ANTES do 1º paint (sem flash dos tamanhos desktop): tela
// cheia declarada no fragment OU dispositivo de toque. Independe de id/eid —
// a tela .fatal também renderiza na densidade certa. O App reconcilia depois
// com a config do canal.
if (
  hash.get('mode') === 'fullscreen' ||
  (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
) {
  document.documentElement.setAttribute('data-density', 'mobile');
}

const root = document.getElementById('app');
if (root) {
  const params = parseParams(hash);
  render(
    params ? <App params={params} /> : <div class="fatal">{STR.startError}</div>,
    root
  );
}
