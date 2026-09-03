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
import { PreChatForm } from './components/PreChatForm';
import { mineBubbleColor } from './lib/bubble-color';
import { missingPreChatFields } from './lib/pre-chat';
import { STR } from './lib/strings';
import { useChat } from './state/useChat';
import { useConversations } from './state/useConversations';

export interface PanelParams {
  id: string;
  eid: string;
  lastread: string | null;
  mode: string | null;
}

type View = 'boot' | 'form' | 'list' | 'thread';

export function App({ params }: { params: PanelParams }) {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
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
        document.activeElement.blur();
      }
    }, chat.setIdentity);
    if (!isEmbedded()) chat.notifyVisibility(true);
  }, []);

  const landedRef = useRef(false);
  useEffect(() => {
    if (landedRef.current) return;
    if (!conversations.loaded && !conversations.error) return;
    const firstConversation = conversations.loaded && conversations.items.length === 0;
    if (firstConversation && configLoading) return;
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
    } else if (missingPreChatFields(config, chat.identity).length > 0) {
      setView('form');
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
    configLoading,
    config,
    chat.identity,
  ]);

  useEffect(() => {
    if (view !== 'form') return;
    if (missingPreChatFields(config, chat.identity).length > 0) return;
    chat.openConversation(null);
    setView('thread');
    setFocusToken((t) => t + 1);
  }, [view, config, chat.identity, chat.openConversation]);

  useEffect(() => {
    let cancelled = false;
    fetchConfig(params.id)
      .then((cfg) => {
        if (!cancelled) setConfig(cfg);
      })
      .catch(() => {
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const [prefersDark, setPrefersDark] = useState(prefersDarkNow());
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', onChange);
      return () => query.removeEventListener('change', onChange);
    }
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  const dark = themeIsDark(normalizeTheme(config?.theme), prefersDark);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);

  const accent = safeAccentColor(config?.widget_color);
  const onAccent = textColorOn(accent);
  const bubbleMine = mineBubbleColor(accent, dark);
  const onBubbleMine = textColorOn(bubbleMine);
  useEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--pip-primary', accent);
    style.setProperty('--pip-on-primary', onAccent);
    style.setProperty('--pip-bubble-mine', bubbleMine);
    style.setProperty('--pip-on-bubble-mine', onBubbleMine);
  }, [accent, onAccent, bubbleMine, onBubbleMine]);

  const fullscreen = config
    ? normalizeDisplayMode(config.display_mode) === 'fullscreen'
    : params.mode === 'fullscreen';

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
    query.addListener(onChange);
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

  const lastMediaRefreshRef = useRef(0);
  const onMediaError = useCallback(() => {
    const now = Date.now();
    if (now - lastMediaRefreshRef.current < 30_000) return;
    lastMediaRefreshRef.current = now;
    chat.refreshHistory();
  }, [chat.refreshHistory]);

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

      {view === 'form' ? (
        <PreChatForm fields={missingPreChatFields(config, chat.identity)} onSubmit={chat.setFormUser} />
      ) : view === 'list' ? (
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
            typing={chat.typing && !readOnly}
            welcome={readOnly ? null : config?.welcome_message ?? null}
            historyError={chat.historyError}
            loadingOlder={chat.loadingOlder}
            onRetryHistory={chat.refreshHistory}
            loadOlder={chat.loadOlder}
            onRetry={chat.retry}
            onMediaError={onMediaError}
            onSelectOption={readOnly ? undefined : chat.selectOption}
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
              open={open}
              disabled={
                view === 'boot' &&
                (configLoading || missingPreChatFields(config, chat.identity).length > 0)
              }
            />
          )}
        </>
      )}

      {!fullscreen && <Footer />}
    </div>
  );
}
