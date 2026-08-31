import type { WidgetConfig } from '../shared/widget-config';

export type ConfigResult = { ok: true; config: WidgetConfig } | { ok: false; notFound: boolean };

export async function fetchWidgetConfig(apiUrl: string, identifier: string): Promise<ConfigResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${apiUrl}/website-channel/config/${encodeURIComponent(identifier)}`, {
      signal: controller.signal,
    });
    if (res.status === 404) return { ok: false, notFound: true };
    if (!res.ok) return { ok: false, notFound: false };
    const data: unknown = await res.json();
    if (!data || typeof data !== 'object') return { ok: false, notFound: false };
    return { ok: true, config: data as WidgetConfig };
  } catch {
    return { ok: false, notFound: false };
  } finally {
    clearTimeout(timer);
  }
}
