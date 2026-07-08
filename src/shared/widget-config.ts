// Resposta de GET /website-channel/config/{identifier} (flat, sem envelope).
export interface WidgetConfig {
  name: string;
  widget_color: string | null;
  welcome_message: string | null;
  // Campos em rollout no backend — leitor tolerante: podem não existir ainda.
  theme?: string | null; // 'light' | 'dark' | 'auto'
  message_preview?: string | null; // texto do teaser proativo; null = sem cartão
}
