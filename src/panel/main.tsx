import { render } from 'preact';
import { App, type PanelParams } from './App';
import { STR } from './lib/strings';
import './styles.css';

function readHashParams(): URLSearchParams {
  const raw = location.hash.charAt(0) === '#' ? location.hash.slice(1) : location.hash;
  return new URLSearchParams(raw || location.search);
}

function dashed(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function parseParams(hash: URLSearchParams): PanelParams | null {
  const code = hash.get('c');
  if (code && /^[0-9a-f]{64}$/i.test(code)) {
    const hex = code.toLowerCase();
    return { id: dashed(hex.slice(0, 32)), eid: dashed(hex.slice(32)), lastread: hash.get('lastread'), mode: hash.get('mode') ?? 'fullscreen' };
  }
  const id = hash.get('id');
  const eid = hash.get('eid');
  if (!id || !eid) return null;
  return { id, eid, lastread: hash.get('lastread'), mode: hash.get('mode') };
}

const params = parseParams(readHashParams());

if (
  params?.mode === 'fullscreen' ||
  (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)
) {
  document.documentElement.setAttribute('data-density', 'mobile');
}

const root = document.getElementById('app');
if (root) {
  render(
    params ? <App params={params} /> : <div class="fatal">{STR.startError}</div>,
    root
  );
  document.getElementById('boot')?.remove();
}
