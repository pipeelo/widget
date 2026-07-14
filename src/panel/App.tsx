import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { safeAccentColor, textColorOn } from '../shared/color';
import { normalizeTheme, prefersDarkNow, themeIsDark } from '../shared/theme';
import { normalizeDisplayMode } from '../shared/widget-config';
import { fetchConfig } from './api/client';
import type { WidgetConfig } from './api/types';
import { initPanelBridge, isEmbedded, postToLoader } from './bridge';
import { Composer } from './components/Composer';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { STR } from './lib/strings';
import { useChat } from './state/useChat';

export interface PanelParams {
  id: string;
  eid: string;
  lastread: string | null;
}

export function App({ params }: { params: PanelParams }) {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  // Painel aberto direto no browser (dev/standalone): trata como visível.
  const [open, setOpen] = useState(!isEmbedded());
  const [focusToken, setFocusToken] = useState(0);
  const chat = useChat(params.id, params.eid, params.lastread);

  useEffect(() => {
    initPanelBridge((isOpen) => {
      setOpen(isOpen);
      chat.notifyVisibility(isOpen);
      if (isOpen) setFocusToken((t) => t + 1);
    });
    if (!isEmbedded()) chat.notifyVisibility(true);
    // chat.notifyVisibility é estável (useCallback sem deps)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    fetchConfig(params.id)
      .then((cfg) => {
        if (!cancelled) setConfig(cfg);
      })
      .catch(() => {
        /* sem config: defaults da marca — o chat continua funcional */
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  // Tema: light | dark | auto (auto segue o prefers-color-scheme, ao vivo).
  const [prefersDark, setPrefersDark] = useState(prefersDarkNow());
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener(onChange); // Safari < 14
    return () => query.removeListener(onChange);
  }, []);

  const dark = themeIsDark(normalizeTheme(config?.theme), prefersDark);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  // widget_color da config vira o accent (validado; fallback teal Pipeelo),
  // com cor de texto por luminância.
  const accent = safeAccentColor(config?.widget_color);
  const onAccent = textColorOn(accent);
  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--pip-primary', accent);
    style.setProperty('--pip-on-primary', onAccent);
  }, [accent, onAccent]);

  // Modo tela cheia (config do canal): sem chevron, sem Escape-fecha, sem rodapé.
  const fullscreen = normalizeDisplayMode(config?.display_mode) === 'fullscreen';

  useEffect(() => {
    if (fullscreen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') postToLoader({ __pipeelo: true, type: 'close' });
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);

  // Imagem com presigned expirada: renova via histórico, no máximo 1x/30s
  // (evita loop de onError → refetch → onError).
  const lastMediaRefreshRef = useRef(0);
  const onMediaError = useCallback(() => {
    const now = Date.now();
    if (now - lastMediaRefreshRef.current < 30_000) return;
    lastMediaRefreshRef.current = now;
    chat.refreshHistory();
    // chat.refreshHistory é estável (useCallback com [identifier, externalId])
  }, [chat.refreshHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => postToLoader({ __pipeelo: true, type: 'close' });
  const name = (config?.name ?? '').trim() || STR.brandFallback;

  return (
    <div class="panel">
      <Header
        name={name}
        brandGradient={!config?.widget_color}
        loading={configLoading && !config}
        showClose={!fullscreen}
        onClose={close}
      />
      {chat.socketDown && (
        <div class="conn-banner" role="status">
          {STR.reconnecting}
        </div>
      )}
      <MessageList
        state={chat.state}
        open={open}
        avatarInitial={(name.charAt(0) || 'P').toUpperCase()}
        welcome={config?.welcome_message ?? null}
        historyError={chat.historyError}
        loadingOlder={chat.loadingOlder}
        onRetryHistory={chat.refreshHistory}
        loadOlder={chat.loadOlder}
        onRetry={chat.retry}
        onMediaError={onMediaError}
      />
      <Composer
        onSendText={chat.sendTextMessage}
        onSendFile={chat.sendFileMessage}
        focusToken={focusToken}
      />
      {!fullscreen && <Footer />}
    </div>
  );
}
