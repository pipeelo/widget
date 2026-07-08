import { isWidgetMessage, type LoaderToPanel, type PanelToLoader } from '../shared/protocol';

// Ponte do lado do painel. O origin do host é desconhecido a priori
// (qualquer site pode embutir — é o produto): o painel PINA o origin da
// primeira mensagem válida vinda de window.parent e passa a usá-lo como
// targetOrigin e filtro. O loader garante essa primeira mensagem
// respondendo ao 'ready' com o estado de visibilidade atual.

let parentOrigin: string | null = null;
let visibilityHandler: ((open: boolean) => void) | null = null;
const outbox: PanelToLoader[] = [];

export function isEmbedded(): boolean {
  try {
    return window.parent !== window;
  } catch {
    return true;
  }
}

function flush(): void {
  if (!parentOrigin) return;
  let msg: PanelToLoader | undefined;
  while ((msg = outbox.shift())) window.parent.postMessage(msg, parentOrigin);
}

export function initPanelBridge(onVisibility: (open: boolean) => void): void {
  visibilityHandler = onVisibility;
  if (!isEmbedded()) return; // painel aberto direto no browser (dev): ponte inerte

  window.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== window.parent) return;
    if (!isWidgetMessage(event.data)) return;
    if (parentOrigin === null) {
      parentOrigin = event.origin;
      flush();
    } else if (event.origin !== parentOrigin) {
      return;
    }
    const msg = event.data as LoaderToPanel;
    if (msg.type === 'visibility' && visibilityHandler) visibilityHandler(Boolean(msg.open));
  });

  // Única mensagem enviada com targetOrigin '*': não carrega nenhum dado
  // além do tipo — anuncia ao pai (origin ainda desconhecido) que montou.
  const ready: PanelToLoader = { __pipeelo: true, type: 'ready' };
  window.parent.postMessage(ready, '*');
}

export function postToLoader(msg: PanelToLoader): void {
  if (!isEmbedded()) return;
  if (!parentOrigin) {
    outbox.push(msg); // sai no flush, quando o origin do pai estiver pinado
    return;
  }
  window.parent.postMessage(msg, parentOrigin);
}
