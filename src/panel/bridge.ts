import {
  isWidgetMessage,
  type LoaderToPanel,
  type PanelToLoader,
  type WidgetUser,
} from '../shared/protocol';

let parentOrigin: string | null = null;
let visibilityHandler: ((open: boolean) => void) | null = null;
let identifyHandler: ((user: WidgetUser | null) => void) | null = null;
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

export function initPanelBridge(
  onVisibility: (open: boolean) => void,
  onIdentify: (user: WidgetUser | null) => void
): void {
  visibilityHandler = onVisibility;
  identifyHandler = onIdentify;
  if (!isEmbedded()) return;

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
    else if (msg.type === 'identify' && identifyHandler) identifyHandler(msg.user ?? null);
  });

  const ready: PanelToLoader = { __pipeelo: true, type: 'ready' };
  window.parent.postMessage(ready, '*');
}

export function postToLoader(msg: PanelToLoader): void {
  if (!isEmbedded()) return;
  if (!parentOrigin) {
    outbox.push(msg);
    return;
  }
  window.parent.postMessage(msg, parentOrigin);
}
