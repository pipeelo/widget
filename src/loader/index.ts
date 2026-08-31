import { safeAccentColor, textColorOn } from '../shared/color';
import type { WidgetUser } from '../shared/protocol';
import { normalizeTheme, prefersDarkNow, themeIsDark } from '../shared/theme';
import { normalizeDisplayMode } from '../shared/widget-config';
import { createBridge } from './bridge';
import { fetchWidgetConfig } from './config';
import { API_URL } from './env';
import { createFrameController } from './frame';
import { createLauncher } from './launcher';
import { createSession } from './session';
import { injectStyles, MOBILE_MEDIA } from './styles';
import { createTeaser } from './teaser';
import { setTitleCount } from './title';

type PipeeloFn = ((...args: unknown[]) => void) & { q?: IArguments[]; loaded?: boolean };

function warn(message: string): void {
  try {
    console.warn('[Pipeelo] ' + message);
  } catch {
  }
}

function findOwnScript(): HTMLScriptElement | null {
  const current = document.currentScript;
  if (current instanceof HTMLScriptElement && current.src) return current;
  const scripts = document.querySelectorAll<HTMLScriptElement>('script[src]');
  for (let i = scripts.length - 1; i >= 0; i--) {
    const candidate = scripts[i]!;
    if (/\/loader\.js(\?|$)|\/src\/loader\/index\.ts(\?|$)/.test(candidate.src)) return candidate;
  }
  return null;
}

function ensureViewportMeta(): void {
  if (document.querySelector('meta[name="viewport"]')) return;
  const meta = document.createElement('meta');
  meta.name = 'viewport';
  meta.content = 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content';
  document.head.appendChild(meta);
}

function sanitizeUser(raw: unknown): WidgetUser | null {
  let user: WidgetUser | null = null;
  if (raw && typeof raw === 'object') {
    for (const key of ['name', 'email', 'phone', 'document'] as const) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value === 'string' && value.trim()) {
        (user = user || {})[key] = value.trim().slice(0, 255);
      }
    }
  }
  return user;
}

function whenBody(fn: () => void): void {
  if (document.body) {
    fn();
    return;
  }
  document.addEventListener('DOMContentLoaded', fn, { once: true });
}

function start(
  w: Window & { Pipeelo?: PipeeloFn },
  identifier: string,
  panelOrigin: string,
  panelBase: string
): void {
  const session = createSession(identifier);
  let fullscreen = false;
  let open = false;
  let disabled = false;
  let identity: WidgetUser | null = null;
  let displayMode: string | null = null;
  let brandName = 'Pipeelo';
  let dark = false;

  injectStyles();

  let lockedScrollY = 0;
  let lockedBodyTop: string | null = null;
  function lockScroll(): void {
    if (lockedBodyTop !== null) return;
    lockedScrollY = window.scrollY || 0;
    lockedBodyTop = document.body.style.top;
    document.body.style.top = -lockedScrollY + 'px';
    document.documentElement.classList.add('pipeelo-lock');
  }
  function unlockScroll(): void {
    if (lockedBodyTop === null) return;
    document.documentElement.classList.remove('pipeelo-lock');
    document.body.style.top = lockedBodyTop;
    lockedBodyTop = null;
    window.scrollTo(0, lockedScrollY);
  }

  const launcher = createLauncher({
    onToggle: () => (open ? doClose() : doOpen()),
    onIntent: () => {
      if (!disabled) ensureFrame();
    },
  });
  const frame = createFrameController(panelBase, { title: 'Chat — Pipeelo' });
  const teaser = createTeaser({
    onOpen: () => doOpen(),
    onDismiss: () => session.dismissTeaser(),
  });
  const bridge = createBridge(() => frame.element(), panelOrigin, {
    onReady: () => {
      bridge.send({ __pipeelo: true, type: 'visibility', open });
      if (identity) bridge.send({ __pipeelo: true, type: 'identify', user: identity });
    },
    onClose: () => doClose(),
    onUnread: (count) => {
      launcher.setBadge(count);
      setTitleCount(count);
    },
    onRead: (at) => session.setLastReadAt(at),
    onNotify: (text) => {
      if (disabled || fullscreen || open) return;
      teaser.hide(false);
      teaser.show(brandName, text, dark);
    },
  });

  function ensureFrame(): void {
    if (frame.exists()) return;
    const token = session.ensureToken();
    if (!session.getLastReadAt()) session.setLastReadAt(new Date().toISOString());
    frame.create({
      id: identifier,
      eid: token,
      lastread: session.getLastReadAt(),
      mode: displayMode,
    });
  }

  function doOpen(): void {
    if (disabled || open) return;
    ensureFrame();
    open = true;
    teaser.hide(true);
    document.documentElement.classList.add('pipeelo-open');
    if (fullscreen || window.matchMedia(MOBILE_MEDIA).matches) lockScroll();
    frame.setOpen(true);
    launcher.setOpen(true);
    bridge.send({ __pipeelo: true, type: 'visibility', open: true });
    frame.startViewportTracking(fullscreen);
  }

  function doClose(): void {
    if (fullscreen || !open) return;
    open = false;
    frame.stopViewportTracking();
    frame.setOpen(false);
    launcher.setOpen(false);
    document.documentElement.classList.remove('pipeelo-open');
    unlockScroll();
    bridge.send({ __pipeelo: true, type: 'visibility', open: false });
  }

  if (session.getToken()) ensureFrame();

  void fetchWidgetConfig(API_URL, identifier).then((result) => {
    if (!result.ok) {
      if (result.notFound) {
        disabled = true;
        doClose();
        teaser.hide(false);
        frame.destroy();
        launcher.remove();
        warn(`canal "${identifier}" não encontrado — widget desativado`);
        return;
      }
      launcher.mount();
      return;
    }

    const cfg = result.config;
    displayMode = normalizeDisplayMode(cfg.display_mode);
    brandName = cfg.name || brandName;
    dark = themeIsDark(normalizeTheme(cfg.theme), prefersDarkNow());
    frame.setBackground(dark ? '#242424' : '#fff');

    if (displayMode === 'fullscreen') {
      fullscreen = true;
      ensureViewportMeta();
      document.documentElement.classList.add('pipeelo-fullscreen');
      doOpen();
      return;
    }

    const accent = safeAccentColor(cfg.widget_color);
    launcher.setAppearance(accent, textColorOn(accent), !cfg.widget_color);
    const image = typeof cfg.launcher_image === 'string' ? cfg.launcher_image.trim() : '';
    if (image) launcher.setImage(image);
    launcher.mount();

    const previewText = typeof cfg.message_preview === 'string' ? cfg.message_preview.trim() : '';
    if (previewText && !session.isTeaserDismissed()) {
      window.setTimeout(() => {
        if (!open && !disabled) teaser.show(brandName, previewText, dark);
      }, 1500);
    }
  });

  function dispatch(command: unknown, payload?: unknown): void {
    if (disabled) return;
    if (command === 'open') doOpen();
    else if (command === 'close') doClose();
    else if (command === 'toggle') {
      if (open) doClose();
      else doOpen();
    } else if (command === 'setUser') {
      const user = sanitizeUser(payload);
      if (user || payload == null) {
        identity = user;
        bridge.send({ __pipeelo: true, type: 'identify', user });
      }
    } else warn('comando desconhecido: ' + String(command));
  }

  const pending = w.Pipeelo?.q ?? [];
  const api = ((...args: unknown[]) => dispatch(args[0], args[1])) as PipeeloFn;
  api.loaded = true;
  w.Pipeelo = api;
  for (const args of pending) dispatch(args[0], args[1]);
}

(function boot() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const w = window as Window & { Pipeelo?: PipeeloFn };
  if (w.Pipeelo?.loaded) return;

  const script = findOwnScript();
  const srcAttr = script ? script.getAttribute('src') || script.src : '';
  if (!script || !srcAttr) {
    warn('script do loader não localizado');
    return;
  }

  let scriptUrl: URL;
  try {
    scriptUrl = new URL(srcAttr, document.baseURI);
  } catch {
    warn('src do loader inválido');
    return;
  }

  const identifier =
    scriptUrl.searchParams.get('id') || script.getAttribute('data-pipeelo-id') || '';
  if (!identifier) {
    warn('parâmetro ?id= ausente no snippet');
    return;
  }

  const panelOrigin = scriptUrl.origin;
  whenBody(() => start(w, identifier, panelOrigin, panelOrigin + '/v1/'));
})();
