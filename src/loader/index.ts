// Entry do loader — roda na página host do cliente. NÃO pode ter `export`
// (o build IIFE criaria um global além de `Pipeelo`) e não pode depender de
// nada fora de src/shared (orçamento < 6 kB gzip).
import { safeAccentColor, textColorOn } from '../shared/color';
import { normalizeTheme, prefersDarkNow, themeIsDark } from '../shared/theme';
import { normalizeDisplayMode } from '../shared/widget-config';
import { createBridge } from './bridge';
import { fetchWidgetConfig } from './config';
import { API_URL } from './env';
import { createFrameController } from './frame';
import { createLauncher } from './launcher';
import { createSession } from './session';
import { injectStyles } from './styles';
import { createTeaser } from './teaser';

type PipeeloFn = ((...args: unknown[]) => void) & { q?: IArguments[]; loaded?: boolean };

function warn(message: string): void {
  try {
    console.warn('[Pipeelo] ' + message);
  } catch {
    /* console indisponível */
  }
}

// `document.currentScript` é null quando o script é module (dev) ou em hosts
// que sandboxam embeds (Wix/Squarespace) — fallback: localizar pelo src.
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

// O snippet é async e costuma rodar com o body pronto, mas pode ser colado
// no <head> de forma síncrona — não dá para assumir document.body.
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

  injectStyles();

  const launcher = createLauncher({
    onToggle: () => (open ? doClose() : doOpen()),
  });
  const frame = createFrameController(panelBase, { title: 'Chat — Pipeelo' });
  const teaser = createTeaser({
    onOpen: () => doOpen(),
    onDismiss: () => session.dismissTeaser(),
  });
  const bridge = createBridge(() => frame.element(), panelOrigin, {
    // O painel pina o origin do pai a partir desta primeira mensagem — vai
    // incondicionalmente, mesmo com o painel fechado (caso do boot escondido).
    onReady: () => bridge.send({ __pipeelo: true, type: 'visibility', open }),
    onClose: () => doClose(),
    onUnread: (count) => launcher.setBadge(count),
    onRead: (at) => session.setLastReadAt(at),
  });

  function ensureFrame(): void {
    if (frame.exists()) return;
    const token = session.ensureToken(); // cunhado aqui, nunca no load
    // Sem marco de leitura (token pré-feature ou recém-cunhado): agora — evita
    // badge retroativo assustador na primeira vez.
    if (!session.getLastReadAt()) session.setLastReadAt(new Date().toISOString());
    frame.create({ id: identifier, eid: token, lastread: session.getLastReadAt() });
  }

  function doOpen(): void {
    if (disabled || open) return;
    ensureFrame();
    open = true;
    teaser.hide(true);
    document.documentElement.classList.add('pipeelo-open');
    frame.setOpen(true);
    launcher.setOpen(true);
    bridge.send({ __pipeelo: true, type: 'visibility', open: true });
    frame.startViewportTracking();
  }

  function doClose(): void {
    if (fullscreen || !open) return; // tela cheia não fecha
    open = false;
    frame.stopViewportTracking();
    frame.setOpen(false);
    launcher.setOpen(false);
    document.documentElement.classList.remove('pipeelo-open');
    bridge.send({ __pipeelo: true, type: 'visibility', open: false });
  }

  // A bolha NÃO é montada no boot: o modo (vindo da config) decide se ela
  // aparece. O visitante recorrente ainda cria o iframe escondido aqui para
  // manter o socket vivo — seguro porque o launcher, mesmo sem mount, recebe
  // setBadge no seu DOM destacado e reaparece com o count certo ao montar.
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
      // Erro de rede: floating com os defaults da marca (teal do CSS).
      launcher.mount();
      return;
    }

    const cfg = result.config;

    if (normalizeDisplayMode(cfg.display_mode) === 'fullscreen') {
      // Tela cheia: o iframe ocupa a viewport, aberto desde o boot. Sem bolha,
      // sem teaser, sem fechar — o chat é a página.
      fullscreen = true;
      document.documentElement.classList.add('pipeelo-fullscreen');
      doOpen();
      return;
    }

    const accent = safeAccentColor(cfg.widget_color);
    launcher.setAppearance(accent, textColorOn(accent), !cfg.widget_color);
    launcher.mount();

    const previewText = typeof cfg.message_preview === 'string' ? cfg.message_preview.trim() : '';
    if (previewText && !session.isTeaserDismissed()) {
      const dark = themeIsDark(normalizeTheme(cfg.theme), prefersDarkNow());
      window.setTimeout(() => {
        if (!open && !disabled) teaser.show(cfg.name || 'Pipeelo', previewText, dark);
      }, 1500);
    }
  });

  function dispatch(command: unknown): void {
    if (disabled) return;
    if (command === 'open') doOpen();
    else if (command === 'close') doClose();
    else if (command === 'toggle') {
      if (open) doClose();
      else doOpen();
    } else warn('comando desconhecido: ' + String(command));
  }

  // Substitui o stub do snippet pelo dispatcher e drena a fila acumulada.
  const pending = w.Pipeelo?.q ?? [];
  const api = ((...args: unknown[]) => dispatch(args[0])) as PipeeloFn;
  api.loaded = true;
  w.Pipeelo = api;
  for (const args of pending) dispatch(args[0]);
}

(function boot() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const w = window as Window & { Pipeelo?: PipeeloFn };
  if (w.Pipeelo?.loaded) return; // snippet/loader duplicado

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

  // A URL do painel é derivada do próprio src: {origin}/v1/ vale em dev
  // (vite dev server) e em produção (widget.pipeelo.com). Versão nova de
  // contrato = caminho novo (/v2/) nos dois lados.
  const panelOrigin = scriptUrl.origin;
  whenBody(() => start(w, identifier, panelOrigin, panelOrigin + '/v1/'));
})();
