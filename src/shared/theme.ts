// Tema do widget vindo da config do canal (leitor tolerante: o backend pode
// ainda não enviar o campo — ausente/inválido resolve para 'light').

export type WidgetTheme = 'light' | 'dark' | 'auto';

export function normalizeTheme(value: unknown): WidgetTheme {
  return value === 'dark' || value === 'auto' ? value : 'light';
}

export function themeIsDark(theme: WidgetTheme, prefersDark: boolean): boolean {
  if (theme === 'dark') return true;
  if (theme === 'auto') return prefersDark;
  return false;
}

export function prefersDarkNow(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}
