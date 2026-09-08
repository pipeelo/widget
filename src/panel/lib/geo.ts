import { policyState } from './policy';

export type GeoError = 'blocked' | 'denied' | 'unavailable' | 'timeout' | 'failed';

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

export type GeoResult = { ok: true; position: GeoPosition } | { ok: false; error: GeoError };

const TIMEOUT_MS = 20_000;
const MAX_AGE_MS = 60_000;
const PRECISION = 6;

let geoWarned = false;

export function geoSupported(): boolean {
  return (
    window.isSecureContext === true &&
    typeof navigator.geolocation?.getCurrentPosition === 'function'
  );
}

export function geoPolicyBlocked(): boolean {
  return policyState('geolocation') === 'blocked';
}

function errorKind(err: GeolocationPositionError): GeoError {
  if (err.code === err.PERMISSION_DENIED) return geoPolicyBlocked() ? 'blocked' : 'denied';
  if (err.code === err.POSITION_UNAVAILABLE) return 'unavailable';
  if (err.code === err.TIMEOUT) return 'timeout';
  return 'failed';
}

export function warnGeo(err: GeolocationPositionError | null): void {
  if (geoWarned) return;
  geoWarned = true;
  const fault = err
    ? `code ${err.code}: ${err.message}`
    : 'geolocalização não delegada ao iframe do chat';
  try {
    console.warn(
      `[Pipeelo] localização indisponível — ${fault}\n` +
        `contexto seguro: ${window.isSecureContext} | dentro de iframe: ${window.parent !== window} | ` +
        `Permissions-Policy: ${policyState('geolocation')} | origem do painel: ${location.origin}\n` +
        'Se o site publica Permissions-Policy, ela precisa delegar a geolocalização para o painel: ' +
        `Permissions-Policy: geolocation=(self "${location.origin}")`
    );
  } catch {
  }
}

function round(value: number): number {
  return Number(value.toFixed(PRECISION));
}

export function requestPosition(): Promise<GeoResult> {
  if (geoPolicyBlocked()) {
    warnGeo(null);
    return Promise.resolve({ ok: false, error: 'blocked' });
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          ok: true,
          position: {
            latitude: round(position.coords.latitude),
            longitude: round(position.coords.longitude),
          },
        }),
      (err) => {
        warnGeo(err);
        resolve({ ok: false, error: errorKind(err) });
      },
      { enableHighAccuracy: true, timeout: TIMEOUT_MS, maximumAge: MAX_AGE_MS }
    );
  });
}
