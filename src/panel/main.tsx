import { render } from 'preact';
import { App, type PanelParams } from './App';
import { STR } from './lib/strings';
import './styles.css';

// Os parâmetros chegam no FRAGMENT da URL do iframe (#id=…&eid=…&lastread=…):
// fragment não entra em request nenhum nem em Referer.
function parseParams(): PanelParams | null {
  const raw = location.hash.charAt(0) === '#' ? location.hash.slice(1) : location.hash;
  const params = new URLSearchParams(raw);
  const id = params.get('id');
  const eid = params.get('eid');
  if (!id || !eid) return null;
  return { id, eid, lastread: params.get('lastread') };
}

const root = document.getElementById('app');
if (root) {
  const params = parseParams();
  render(
    params ? <App params={params} /> : <div class="fatal">{STR.startError}</div>,
    root
  );
}
