import type { WidgetConfig } from '../shared/widget-config';

export type ConfigResult = { ok: true; config: WidgetConfig } | { ok: false; notFound: boolean };

// Config do canal para o lado host (cor da bolha, teaser, tema). A resposta
// tem Cache-Control público de 5 min. 404 = identifier inexistente (o boot
// desmonta o widget); erro de rede mantém os defaults da marca.
export async function fetchWidgetConfig(apiUrl: string, identifier: string): Promise<ConfigResult> {
  try {
    const res = await fetch(`${apiUrl}/website-channel/config/${encodeURIComponent(identifier)}`);
    if (res.status === 404) return { ok: false, notFound: true };
    if (!res.ok) return { ok: false, notFound: false };
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object') return { ok: false, notFound: false };
    return { ok: true, config: data as WidgetConfig };
  } catch {
    return { ok: false, notFound: false };
  }
}
