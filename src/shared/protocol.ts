// Contrato postMessage entre o loader (página host) e o painel (iframe).
// Fonte única: os dois lados importam daqui.

export type LoaderToPanel = { __pipeelo: true; type: 'visibility'; open: boolean };

export type PanelToLoader =
  | { __pipeelo: true; type: 'ready' }
  | { __pipeelo: true; type: 'close' }
  | { __pipeelo: true; type: 'unread'; count: number }
  | { __pipeelo: true; type: 'read'; at: string }; // ISO 8601 da company message mais nova vista

export type WidgetMessage = LoaderToPanel | PanelToLoader;

// A página host e o iframe recebem postMessage de qualquer um (devtools,
// outros widgets, a própria página): o envelope __pipeelo + checagens de
// origin/source em cada lado filtram o resto.
export function isWidgetMessage(data: unknown): data is WidgetMessage {
  if (typeof data !== 'object' || data === null) return false;
  const record = data as Record<string, unknown>;
  return record.__pipeelo === true && typeof record.type === 'string';
}
