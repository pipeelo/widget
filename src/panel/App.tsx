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
import { PreChatForm } from './components/PreChatForm';
import { PushInvite } from './components/PushInvite';
import { mineBubbleColor } from './lib/bubble-color';
import { missingPreChatFields } from './lib/pre-chat';
import { STR } from './lib/strings';
import { dismissPush, enablePush, ensureSubscribed, isPushDismissed, isPushEligible, syncPush } from './push';
import { useChat } from './state/useChat';

export interface PanelParams {
  id: string;
  eid: string;
  lastread: string | null;
  mode: string | null;
}

type View = 'boot' | 'form' | 'thread';

export function App({ params }: { params: PanelParams }) {
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [open, setOpen] = useState(!isEmbedded());
  const [focusToken, setFocusToken] = useState(0);
  const [view, setView] = useState<View>('boot');

  const chat = useChat(params.id, params.eid, params.lastread);

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
  const firstConversation =
    chat.state.historyLoaded && chat.state.order.length === 0 && chat.state.chats.size === 0;
  useEffect(() => {
    if (landedRef.current) return;
    if (!chat.state.historyLoaded && !chat.historyError) return;
    if (firstConversation && configLoading) return;
    landedRef.current = true;
    if (firstConversation && missingPreChatFields(config, chat.identity).length > 0) {
      setView('form');
    } else {
      setView('thread');
    }
  }, [chat.state.historyLoaded, chat.historyError, firstConversation, configLoading, config, chat.identity]);

  useEffect(() => {
    if (view !== 'form') return;
    if (missingPreChatFields(config, chat.identity).length > 0) return;
    setView('thread');
    setFocusToken((t) => t + 1);
  }, [view, config, chat.identity]);

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

  const pushKey = config?.push_public_key || null;
  const [pushInvite, setPushInvite] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    if (!pushKey || !isPushEligible()) return;
    if (Notification.permission === 'granted') {
      void ensureSubscribed(pushKey)
        .then((subscription) => subscription && syncPush(params.id, params.eid, subscription))
        .catch(() => {});
      return;
    }
    setPushInvite(Notification.permission === 'default' && !isPushDismissed(params.id));
  }, [pushKey, params.id, params.eid]);

  const onEnablePush = () => {
    if (!pushKey || pushBusy) return;
    setPushBusy(true);
    enablePush(pushKey)
      .then((subscription) => (subscription ? syncPush(params.id, params.eid, subscription) : undefined))
      .catch(() => {})
      .finally(() => {
        setPushBusy(false);
        setPushInvite(false);
      });
  };

  const onDismissPush = () => {
    dismissPush(params.id);
    setPushInvite(false);
  };

  const lastMediaRefreshRef = useRef(0);
  const onMediaError = useCallback(() => {
    const now = Date.now();
    if (now - lastMediaRefreshRef.current < 30_000) return;
    lastMediaRefreshRef.current = now;
    chat.refreshHistory();
  }, [chat.refreshHistory]);

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

      {view === 'form' ? (
        <PreChatForm fields={missingPreChatFields(config, chat.identity)} onSubmit={chat.setFormUser} />
      ) : (
        <>
          <MessageList
            state={chat.state}
            open={open}
            typing={chat.typing}
            welcome={config?.welcome_message ?? null}
            historyError={chat.historyError}
            loadingOlder={chat.loadingOlder}
            onRetryHistory={chat.refreshHistory}
            loadOlder={chat.loadOlder}
            onReveal={chat.reveal}
            onRetry={chat.retry}
            onMediaError={onMediaError}
            onSelectOption={chat.selectOption}
          />
          {pushInvite && chat.companyReplied && (
            <PushInvite busy={pushBusy} onEnable={onEnablePush} onDismiss={onDismissPush} />
          )}
          <Composer
            onSendText={chat.sendTextMessage}
            onSendFile={chat.sendFileMessage}
            onSendLocation={chat.sendLocationMessage}
            focusToken={focusToken}
            open={open}
            disabled={
              view === 'boot' &&
              (configLoading || missingPreChatFields(config, chat.identity).length > 0)
            }
          />
        </>
      )}

      {!fullscreen && <Footer />}
    </div>
  );
}
