export interface WidgetConfig {
  name: string;
  widget_color: string | null;
  welcome_message: string | null;
  theme?: string | null;
  message_preview?: string | null;
  display_mode?: string | null;
  pre_chat_form?: { fields?: string[] | null } | null;
  launcher_image?: string | null;
}

export type DisplayMode = 'floating' | 'fullscreen';

export function normalizeDisplayMode(value: unknown): DisplayMode {
  return value === 'fullscreen' ? 'fullscreen' : 'floating';
}
