// Cor de destaque do widget: o `widget_color` da config é dado externo
// (pode vir lixo) e a cor de texto sobre ele é decidida por luminância.

export const DEFAULT_ACCENT = '#01D5AC';
export const DARK_INK = '#1A202C';

export function parseHex(color: string): [number, number, number] | null {
  const match = /^#(?:([0-9a-f]{3})|([0-9a-f]{6}))$/i.exec(color.trim());
  if (!match) return null;
  const short = match[1];
  const hex = short ? short.split('').map((c) => c + c).join('') : match[2]!;
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

// Luminância relativa WCAG (sRGB linearizado).
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Threshold 0.6 com viés para branco: o teal #01D5AC tem luminância ~0.5 e
// um corte "puro" em 0.5 escolheria texto escuro sobre a cor da marca,
// destoando do visual Pipeelo/Intercom. Só cores realmente claras
// (amarelo, branco…) recebem tinta escura — o padrão dos messengers.
export function textColorOn(background: string): string {
  const rgb = parseHex(background);
  if (!rgb) return '#ffffff';
  return relativeLuminance(rgb) > 0.6 ? DARK_INK : '#ffffff';
}

export function safeAccentColor(input: string | null | undefined): string {
  if (typeof input !== 'string') return DEFAULT_ACCENT;
  return parseHex(input) ? input.trim() : DEFAULT_ACCENT;
}
