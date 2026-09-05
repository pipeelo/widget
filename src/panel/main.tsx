import { render } from 'preact';
import { App, type PanelParams } from './App';
import { STR } from './lib/strings';
import './styles.css';

function readHashParams(): URLSearchParams {
  const raw = location.hash.charAt(0) === '#' ? location.hash.slice(1) : location.hash;
  return new URLSearchParams(raw || location.search);
}

function parseParams(hash: URLSearchParams): PanelParams | null {
  const id = hash.get('id');
  const eid = hash.get('eid');
  if (!id || !eid) return null;
  return { id, eid, lastread: hash.get('lastread'), mode: hash.get('mode') };
}

const hash = readHashParams();

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
  document.getElementById('boot')?.remove();
}
