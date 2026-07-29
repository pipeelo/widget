import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { safeAccentColor, textColorOn } from '../shared/color';
import { normalizeTheme, prefersDarkNow, themeIsDark } from '../shared/theme';
import { normalizeDisplayMode } from '../shared/widget-config';
import { fetchConfig } from './api/client';
import type { WidgetConfig } from './api/types';
import { initPanelBridge, isEmbedded, postToLoader } from './bridge';
import { ClosedNotice } from './components/ClosedNotice';
import { Composer } from './components/Composer';
import { ConversationList } from './components/ConversationList';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { MessageList } from './components/MessageList';
import { STR } from './lib/strings';
import { useChat } from './state/useChat';
import { useConversations } from './state/useConversations';

export interface PanelParams {
  id: string;
  eid: string;
  lastread: string | null;
  /** display_mode conhecido pelo loader na criação do iframe (hint pré-config). */
  mode: string | null;
}

type View = 'boot' | 'list' | 'thread';

export function App({ params }: { params: PanelParams }) {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  // Painel aberto direto no browser (dev/standalone): trata como visível.
  const [open, setOpen] = useState(!isEmbedded());
  const [focusToken, setFocusToken] = useState(0);
  const [view, setView] = useState<View>('boot');

  const conversations = useConversations(params.id, params.eid);
  const chat = useChat(params.id, params.eid, params.lastread, {
    conversations: conversations.items,
    onConversationsStale: conversations.refresh,
    onChatClosed: conversations.markClosed,
  });

  useEffect(() => {
    initPanelBridge((isOpen) => {
      setOpen(isOpen);
      chat.notifyVisibility(isOpen);
      if (isOpen) {
        setFocusToken((t) => t + 1);
      } else if (document.activeElement instanceof HTMLElement) {
        // Escondido com o composer focado: sem blur, o teclado do iOS fica
        // de pé sobre o site com o chat já fechado.
        document.activeElement.blur();
      }
    }, chat.setIdentity);
    if (!isEmbedded()) chat.notifyVisibility(true);
    // chat.notifyVisibility e chat.setIdentity são estáveis (useCallback sem deps)
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const landedRef = useRef(false);
  useEffect(() => {
    if (landedRef.current) return;
    if (!conversations.loaded && !conversations.error) return;
    landedRef.current = true;
    if (chat.state.order.length > 0) {
      setView('thread');
      return;
    }
    if (conversations.open) {
      chat.openConversation(conversations.open.chat_id);
      setView('thread');
    } else if (conversations.items.length > 0 || conversations.error) {
      setView('list');
    } else {
      chat.openConversation(null);
      setView('thread');
    }
  }, [
    conversations.loaded,
    conversations.error,
    conversations.open,
    conversations.items,
    chat.openConversation,
    chat.state.order.length,
  ]);

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

  // Modo tela cheia: sem chevron, sem Escape-fecha, sem rodapé. A config do
  // canal decide; antes dela chegar vale o hint do fragment (evita chevron e
  // rodapé piscando no boot em tela cheia).
  const fullscreen = config
    ? normalizeDisplayMode(config.display_mode) === 'fullscreen'
    : params.mode === 'fullscreen';

  // Densidade mobile (escala de toque do styles.css): tela cheia OU ponteiro
  // grosso. O main.tsx já seta antes do 1º paint; aqui reconcilia quando a
  // config chega e acompanha mudança de ponteiro (tablet conversível).
  useEffect(() => {
    const apply = (coarse: boolean) => {
      if (fullscreen || coarse) {
        document.documentElement.setAttribute('data-density', 'mobile');
      } else {
        document.documentElement.removeAttribute('data-density');
      }
    };
    if (typeof window.matchMedia !== 'function') {
      apply(false);
      return;
    }
    const query = window.matchMedia('(pointer: coarse)');
    const onChange = (event: MediaQueryListEvent) => apply(event.matches);
    apply(query.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener(onChange); // Safari < 14
    return () => query.removeListener(onChange);
  }, [fullscreen]);

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

  const openThread = (chatId: string | null) => {
    chat.openConversation(chatId);
    setView('thread');
    setFocusToken((t) => t + 1);
  };

  const active = chat.activeChatId
    ? conversations.items.find((item) => item.chat_id === chat.activeChatId) ?? null
    : null;
  const readOnly = Boolean(active?.ended_at);
  const canStartNew = (conversations.loaded || conversations.error) && !conversations.open;

  return (
    <div class="panel">
      <Header
        name={name}
        brandGradient={!config?.widget_color}
        loading={configLoading && !config}
        showClose={!fullscreen}
        onBack={
          view === 'thread' && conversations.items.length > 0
            ? () => setView('list')
            : undefined
        }
        onClose={close}
      />
      {chat.socketDown && (
        <div class="conn-banner" role="status">
          {STR.reconnecting}
        </div>
      )}

      {view === 'list' ? (
        <ConversationList
          items={conversations.items}
          loaded={conversations.loaded}
          error={conversations.error}
          loadingMore={conversations.loadingMore}
          hasMore={conversations.hasMore}
          canStartNew={canStartNew}
          onOpen={openThread}
          onStartNew={() => openThread(null)}
          onRetry={conversations.refresh}
          onLoadMore={conversations.loadMore}
        />
      ) : (
        <>
          <MessageList
            key={chat.activeChatId ?? 'new'}
            state={chat.state}
            open={open}
            avatarInitial={(name.charAt(0) || 'P').toUpperCase()}
            welcome={readOnly ? null : config?.welcome_message ?? null}
            historyError={chat.historyError}
            loadingOlder={chat.loadingOlder}
            onRetryHistory={chat.refreshHistory}
            loadOlder={chat.loadOlder}
            onRetry={chat.retry}
            onMediaError={onMediaError}
          />
          {readOnly ? (
            <ClosedNotice
              endedAt={active?.ended_at ?? null}
              protocol={active?.protocol ?? null}
              canStartNew={canStartNew}
              onStartNew={() => openThread(null)}
            />
          ) : (
            <Composer
              onSendText={chat.sendTextMessage}
              onSendFile={chat.sendFileMessage}
              focusToken={focusToken}
            />
          )}
        </>
      )}

      {!fullscreen && <Footer />}
    </div>
  );
}
