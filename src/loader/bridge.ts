import { isWidgetMessage, type LoaderToPanel, type PanelToLoader } from '../shared/protocol';

// Ponte postMessage do lado host. Só aceita mensagens vindas exatamente do
// contentWindow do nosso iframe E do origin do painel; envia sempre com
// targetOrigin estrito. Mensagens saem numa fila até o painel avisar 'ready'.

export interface Bridge {
  send(msg: LoaderToPanel): void;
}

export function createBridge(
  getFrame: () => HTMLIFrameElement | null,
  panelOrigin: string,
  handlers: {
    onReady(): void;
    onClose(): void;
    onUnread(count: number): void;
    onRead(at: string): void;
  }
): Bridge {
  let ready = false;
  const queue: LoaderToPanel[] = [];

  function flush(): void {
    const frame = getFrame();
    if (!ready || !frame || !frame.contentWindow) return;
    let msg: LoaderToPanel | undefined;
    while ((msg = queue.shift())) frame.contentWindow.postMessage(msg, panelOrigin);
  }

  window.addEventListener('message', (event: MessageEvent) => {
    const frame = getFrame();
    if (!frame || event.source !== frame.contentWindow) return;
    if (event.origin !== panelOrigin) return;
    if (!isWidgetMessage(event.data)) return;

    const msg = event.data as PanelToLoader;
    switch (msg.type) {
      case 'ready':
        ready = true;
        handlers.onReady();
        flush();
        break;
      case 'close':
        handlers.onClose();
        break;
      case 'unread':
        if (typeof msg.count === 'number' && isFinite(msg.count)) {
          handlers.onUnread(Math.max(0, Math.floor(msg.count)));
        }
        break;
      case 'read':
        if (typeof msg.at === 'string') handlers.onRead(msg.at);
        break;
    }
  });

  return {
    send(msg) {
      const frame = getFrame();
      if (!ready || !frame || !frame.contentWindow) {
        queue.push(msg);
        return;
      }
      frame.contentWindow.postMessage(msg, panelOrigin);
    },
  };
}
