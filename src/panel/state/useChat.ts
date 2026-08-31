import { useCallback, useEffect, useReducer, useRef, useState } from 'preact/hooks';
import type { WidgetUser } from '../../shared/protocol';
import { uuidV4 } from '../../shared/uuid';
import { fetchHistory, sendFile, sendText } from '../api/client';
import type { ApiItem, ApiMessage, Conversation, MediaField, SendOutcome } from '../api/types';
import { postToLoader } from '../bridge';
import { chime, previewOf } from '../lib/attention';
import { composeIdentity } from '../lib/pre-chat';
import type { SocketHandle } from '../realtime/socket';
import { chatReducer, initialChatState, type ChatState } from './store';

const STALE_DEBOUNCE_MS = 1000;
const RECONNECT_REFETCH_MS = 2000;
const TYPING_TTL_MS = 8000;

export interface ChatHandlers {
  conversations: Conversation[];
  onConversationsStale(): void;
  onChatClosed(chatId: string, endedAt: string | null): void;
}

export interface ChatController {
  state: ChatState;
  activeChatId: string | null;
  socketDown: boolean;
  typing: boolean;
  historyError: boolean;
  loadingOlder: boolean;
  identity: WidgetUser | null;
  openConversation(chatId: string | null): void;
  sendTextMessage(text: string): void;
  sendFileMessage(field: MediaField, file: File): void;
  selectOption(messageId: string, item: ApiItem): void;
  retry(localId: string): void;
  loadOlder(): void;
  refreshHistory(): void;
  notifyVisibility(open: boolean): void;
  setIdentity(user: WidgetUser | null): void;
  setFormUser(user: WidgetUser): void;
}

export function useChat(
  identifier: string,
  externalId: string,
  lastReadParam: string | null,
  handlers: ChatHandlers
): ChatController {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [socketDown, setSocketDown] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typing, setTyping] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const openRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const historyRequestRef = useRef(0);
  const staleTimerRef = useRef<number | undefined>(undefined);
  const refetchTimerRef = useRef<number | undefined>(undefined);
  const typingTimerRef = useRef<number | undefined>(undefined);

  const hostUserRef = useRef<WidgetUser | null>(null);
  const formUserRef = useRef<WidgetUser | null>(null);
  const identityRef = useRef<WidgetUser | null>(null);
  const [identity, setIdentityState] = useState<WidgetUser | null>(null);

  const lastReadRef = useRef<number>(lastReadParam ? Date.parse(lastReadParam) || 0 : 0);
  const unreadIdsRef = useRef<Set<string>>(new Set());
  const newestCompanyRef = useRef<{ epoch: number; iso: string } | null>(null);
  const newestByChatRef = useRef<Map<string, number>>(new Map());
  const lastPostedUnreadRef = useRef<number | null>(null);

  const trackUnread = useCallback((items: ApiMessage[], live: boolean) => {
    let changed = false;
    let fresh: ApiMessage | null = null;
    let freshEpoch = 0;
    for (const item of items) {
      if (item.from !== 'company') continue;
      const epoch = Date.parse(item.created_at) || 0;
      if (epoch > (newestByChatRef.current.get(item.chat_id) ?? 0)) {
        newestByChatRef.current.set(item.chat_id, epoch);
      }
      if (epoch > (newestCompanyRef.current?.epoch ?? 0)) {
        newestCompanyRef.current = { epoch, iso: item.created_at };
        changed = true;
      }
      if (epoch > lastReadRef.current && !unreadIdsRef.current.has(item.message_id)) {
        unreadIdsRef.current.add(item.message_id);
        changed = true;
        if (epoch >= freshEpoch) {
          fresh = item;
          freshEpoch = epoch;
        }
      }
    }
    if (changed) setSyncTick((t) => t + 1);
    if (live && fresh && !(openRef.current && document.visibilityState === 'visible')) {
      chime();
      postToLoader({ __pipeelo: true, type: 'notify', text: previewOf(fresh) });
    }
  }, []);

  const markConversationsStale = useCallback(() => {
    window.clearTimeout(staleTimerRef.current);
    staleTimerRef.current = window.setTimeout(
      () => handlersRef.current.onConversationsStale(),
      STALE_DEBOUNCE_MS
    );
  }, []);

  const clearTyping = useCallback(() => {
    window.clearTimeout(typingTimerRef.current);
    setTyping(false);
  }, []);

  const loadHistory = useCallback(
    (chatId: string, adoptCursor: boolean) => {
      const request = ++historyRequestRef.current;
      fetchHistory(identifier, externalId, chatId)
        .then((page) => {
          if (request !== historyRequestRef.current) return;
          dispatch({
            type: 'history/replace',
            items: page.data,
            nextCursor: page.next_cursor,
            adoptCursor,
          });
          trackUnread(page.data, !adoptCursor);
          setHistoryError(false);
        })
        .catch(() => {
          if (request !== historyRequestRef.current) return;
          if (!stateRef.current.historyLoaded) setHistoryError(true);
        });
    },
    [identifier, externalId, trackUnread]
  );

  const openConversation = useCallback(
    (chatId: string | null) => {
      historyRequestRef.current++;
      activeChatIdRef.current = chatId;
      clearTyping();
      setActiveChatId(chatId);
      setHistoryError(false);
      dispatch({ type: 'conversation/reset', loaded: chatId === null });
      if (chatId) loadHistory(chatId, true);
    },
    [loadHistory, clearTyping]
  );

  const refreshHistory = useCallback(() => {
    const chatId = activeChatIdRef.current;
    if (chatId) loadHistory(chatId, false);
  }, [loadHistory]);

  const refreshHistoryRef = useRef(refreshHistory);
  refreshHistoryRef.current = refreshHistory;

  useEffect(() => {
    let socket: SocketHandle | null = null;
    let cancelled = false;
    void import('../realtime/socket').then(({ createSocket }) => {
      if (cancelled) return;
      socket = createSocket({
        identifier,
        externalId,
        onMessage: (item) => {
          trackUnread([item], true);
          if (item.chat_id === activeChatIdRef.current) {
            if (item.from === 'company') clearTyping();
            dispatch({ type: 'socket/received', item });
          } else {
            markConversationsStale();
          }
        },
        onTyping: (chatId) => {
          if (chatId !== activeChatIdRef.current) return;
          setTyping(true);
          window.clearTimeout(typingTimerRef.current);
          typingTimerRef.current = window.setTimeout(() => setTyping(false), TYPING_TTL_MS);
        },
        onChatClosed: (event) => {
          if (event.chat_id === activeChatIdRef.current) clearTyping();
          handlersRef.current.onChatClosed(event.chat_id, event.ended_at);
          markConversationsStale();
        },
        onState: (current, hadConnected) => {
          if (current === 'connected') {
            setSocketDown(false);
            if (hadConnected) {
              window.clearTimeout(refetchTimerRef.current);
              refetchTimerRef.current = window.setTimeout(() => {
                refreshHistoryRef.current();
                handlersRef.current.onConversationsStale();
              }, RECONNECT_REFETCH_MS);
            }
          } else if (
            hadConnected &&
            (current === 'unavailable' || current === 'failed' || current === 'disconnected')
          ) {
            setSocketDown(true);
          }
        },
      });
    });
    return () => {
      cancelled = true;
      window.clearTimeout(refetchTimerRef.current);
      window.clearTimeout(staleTimerRef.current);
      window.clearTimeout(typingTimerRef.current);
      socket?.destroy();
    };
  }, [identifier, externalId, trackUnread, markConversationsStale, clearTyping]);

  useEffect(() => {
    const onVisibility = () => setSyncTick((t) => t + 1);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (openRef.current && document.visibilityState === 'visible') {
      const newest = newestCompanyRef.current;
      if (newest && newest.epoch > lastReadRef.current) {
        lastReadRef.current = newest.epoch;
        postToLoader({ __pipeelo: true, type: 'read', at: newest.iso });
      }
      unreadIdsRef.current.clear();
      if (lastPostedUnreadRef.current !== 0) {
        lastPostedUnreadRef.current = 0;
        postToLoader({ __pipeelo: true, type: 'unread', count: 0 });
      }
      return;
    }

    let unread = unreadIdsRef.current.size;
    for (const conversation of handlers.conversations) {
      if (conversation.chat_id === activeChatId) continue;
      if (conversation.last_message_from !== 'company') continue;
      const epoch = conversation.last_message_created_at
        ? Date.parse(conversation.last_message_created_at) || 0
        : 0;
      if (epoch <= lastReadRef.current) continue;
      if (epoch <= (newestByChatRef.current.get(conversation.chat_id) ?? 0)) continue;
      unread++;
    }

    if (lastPostedUnreadRef.current !== unread) {
      lastPostedUnreadRef.current = unread;
      postToLoader({ __pipeelo: true, type: 'unread', count: unread });
    }
  }, [syncTick, handlers.conversations, activeChatId]);

  const notifyVisibility = useCallback((open: boolean) => {
    openRef.current = open;
    setSyncTick((t) => t + 1);
  }, []);

  const recomposeIdentity = useCallback(() => {
    const composed = composeIdentity(hostUserRef.current, formUserRef.current);
    identityRef.current = composed;
    setIdentityState(composed);
  }, []);

  const setIdentity = useCallback(
    (user: WidgetUser | null) => {
      hostUserRef.current = user;
      recomposeIdentity();
    },
    [recomposeIdentity]
  );

  const setFormUser = useCallback(
    (user: WidgetUser) => {
      formUserRef.current = { ...formUserRef.current, ...user };
      recomposeIdentity();
    },
    [recomposeIdentity]
  );

  const deliver = useCallback(
    (localId: string, request: () => Promise<SendOutcome>) => {
      const sentFrom = activeChatIdRef.current;
      request()
        .then((outcome) => {
          dispatch({ type: 'send/confirmed', localId, messageId: outcome.messageId ?? localId });
          if (!outcome.chatId || outcome.chatId === sentFrom) return;
          if (sentFrom === null) {
            activeChatIdRef.current = outcome.chatId;
            setActiveChatId(outcome.chatId);
            loadHistory(outcome.chatId, true);
          } else {
            openConversation(outcome.chatId);
          }
          handlersRef.current.onConversationsStale();
        })
        .catch(() => dispatch({ type: 'send/failed', localId }));
    },
    [openConversation, loadHistory]
  );

  const sendTextMessage = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      const localId = uuidV4();
      dispatch({
        type: 'send/optimistic',
        message: {
          id: localId,
          kind: 'text',
          text,
          mediaUrl: null,
          items: null,
          selectedValue: null,
          pix: null,
          from: 'customer',
          createdAt: new Date().toISOString(),
          status: 'sending',
        },
      });
      deliver(localId, () => sendText(identifier, externalId, text, identityRef.current));
    },
    [identifier, externalId, deliver]
  );

  const sendFileMessage = useCallback(
    (field: MediaField, file: File) => {
      const localId = uuidV4();
      let previewUrl: string | null = null;
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = null;
      }
      dispatch({
        type: 'send/optimistic',
        message: {
          id: localId,
          kind: field,
          text: null,
          mediaUrl: previewUrl,
          items: null,
          selectedValue: null,
          pix: null,
          from: 'customer',
          createdAt: new Date().toISOString(),
          status: 'sending',
          pendingFile: file,
        },
      });
      deliver(localId, () => sendFile(identifier, externalId, field, file, identityRef.current));
    },
    [identifier, externalId, deliver]
  );

  const selectOption = useCallback(
    (messageId: string, item: ApiItem) => {
      const message = stateRef.current.byId.get(messageId);
      if (!message || message.kind !== 'interactive' || message.selectedValue !== null) return;
      dispatch({ type: 'interactive/select', messageId, value: item.value });
      const localId = uuidV4();
      dispatch({
        type: 'send/optimistic',
        message: {
          id: localId,
          kind: 'text',
          text: item.title,
          mediaUrl: null,
          items: null,
          selectedValue: item.value,
          pix: null,
          from: 'customer',
          createdAt: new Date().toISOString(),
          status: 'sending',
        },
      });
      deliver(localId, () => sendText(identifier, externalId, item.title, identityRef.current, item.value));
    },
    [identifier, externalId, deliver]
  );

  const retry = useCallback(
    (localId: string) => {
      const message = stateRef.current.byId.get(localId);
      if (!message || message.status !== 'failed') return;
      dispatch({ type: 'send/retry', localId });
      if (message.kind === 'text') {
        deliver(localId, () =>
          sendText(identifier, externalId, message.text ?? '', identityRef.current, message.selectedValue ?? undefined)
        );
      } else if (message.pendingFile) {
        deliver(localId, () =>
          sendFile(identifier, externalId, message.kind as MediaField, message.pendingFile!, identityRef.current)
        );
      } else {
        dispatch({ type: 'send/failed', localId });
      }
    },
    [identifier, externalId, deliver]
  );

  const loadOlder = useCallback(() => {
    const chatId = activeChatIdRef.current;
    const cursor = stateRef.current.nextCursor;
    if (!chatId || !cursor || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    const request = historyRequestRef.current;
    fetchHistory(identifier, externalId, chatId, cursor)
      .then((page) => {
        if (request !== historyRequestRef.current) return;
        dispatch({ type: 'history/prependOlder', items: page.data, nextCursor: page.next_cursor });
      })
      .catch(() => {
      })
      .finally(() => {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      });
  }, [identifier, externalId]);

  return {
    state,
    activeChatId,
    socketDown,
    typing,
    historyError,
    loadingOlder,
    identity,
    openConversation,
    sendTextMessage,
    sendFileMessage,
    selectOption,
    retry,
    loadOlder,
    refreshHistory,
    notifyVisibility,
    setIdentity,
    setFormUser,
  };
}
