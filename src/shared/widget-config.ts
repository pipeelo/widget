// Resposta de GET /website-channel/config/{identifier} (flat, sem envelope).
export interface WidgetConfig {
  name: string;
  widget_color: string | null;
  welcome_message: string | null;
  // Campos em rollout no backend — leitor tolerante: podem não existir ainda.
  theme?: string | null; // 'light' | 'dark' | 'auto'
  message_preview?: string | null; // texto do teaser proativo; null = sem cartão
  display_mode?: string | null; // 'floating' | 'fullscreen'
}

// floating = bolha flutuante (padrão); fullscreen = o chat ocupa a página toda
// (canal do site usado como app nativo). Leitor tolerante: ausente/desconhecido
// resolve para 'floating'.
export type DisplayMode = 'floating' | 'fullscreen';

export function normalizeDisplayMode(value: unknown): DisplayMode {
  return value === 'fullscreen' ? 'fullscreen' : 'floating';
}
