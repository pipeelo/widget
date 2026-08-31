export type WidgetUser = {
  name?: string;
  email?: string;
  phone?: string;
  document?: string;
};

export type LoaderToPanel =
  | { __pipeelo: true; type: 'visibility'; open: boolean }
  | { __pipeelo: true; type: 'identify'; user: WidgetUser | null };

export type PanelToLoader =
  | { __pipeelo: true; type: 'ready' }
  | { __pipeelo: true; type: 'close' }
  | { __pipeelo: true; type: 'unread'; count: number }
  | { __pipeelo: true; type: 'read'; at: string }
  | { __pipeelo: true; type: 'notify'; text: string };

export type WidgetMessage = LoaderToPanel | PanelToLoader;

export function isWidgetMessage(data: unknown): data is WidgetMessage {
  if (typeof data !== 'object' || data === null) return false;
  const record = data as Record<string, unknown>;
  return record.__pipeelo === true && typeof record.type === 'string';
}
