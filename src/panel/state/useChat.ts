import { useCallback, useEffect, useReducer, useRef, useState } from 'preact/hooks';
import type { WidgetUser } from '../../shared/protocol';
import { uuidV4 } from '../../shared/uuid';
import { fetchHistory, sendFile, sendText } from '../api/client';
import type { ApiItem, ApiMessage, MediaField, SendOutcome } from '../api/types';
import { postToLoader } from '../bridge';
import { chime, previewOf } from '../lib/attention';
import { composeIdentity } from '../lib/pre-chat';
import type { SocketHandle } from '../realtime/socket';
import { chatReducer, initialChatState, openChatId, type ChatState } from './store';

const RECONNECT_REFETCH_MS = 2000;
const TYPING_TTL_MS = 8000;

export interface ChatController {
  state: ChatState;
  socketDown: boolean;
  typing: boolean;
  historyError: boolean;
  loadingOlder: boolean;
  identity: WidgetUser | null;
  sendTextMessage(text: string): void;
  sendFileMessage(field: MediaField, file: File): void;
  selectOption(messageId: string, item: ApiItem): void;
  retry(localId: string): void;
  loadOlder(): void;
  reveal(): void;
  refreshHistory(): void;
  notifyVisibility(open: boolean): void;
  setIdentity(user: WidgetUser | null): void;
  setFormUser(user: WidgetUser): void;
}

export function useChat(
  identifier: string,
  externalId: string,
  lastReadParam: string | null
): ChatController {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [socketDown, setSocketDown] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typing, setTyping] = useState(false);
  const [syncTick, setSyncTick] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;

  const openRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const historyRequestRef = useRef(0);
  const refetchTimerRef = useRef<number | undefined>(undefined);
  const typingTimerRef = useRef<number | undefined>(undefined);

  const hostUserRef = useRef<WidgetUser | null>(null);
  const formUserRef = useRef<WidgetUser | null>(null);
  const identityRef = useRef<WidgetUser | null>(null);
  const [identity, setIdentityState] = useState<WidgetUser | null>(null);

  const lastReadRef = useRef<number>(lastReadParam ? Date.parse(lastReadParam) || 0 : 0);
  const unreadIdsRef = useRef<Set<string>>(new Set());
  const newestCompanyRef = useRef<{ epoch: number; iso: string } | null>(null);
  const lastPostedUnreadRef = useRef<number | null>(null);

  const trackUnread = useCallback((items: ApiMessage[], live: boolean) => {
    let changed = false;
    let fresh: ApiMessage | null = null;
    let freshEpoch = 0;
    for (const item of items) {
      if (item.from !== 'company') continue;
      const epoch = Date.parse(item.created_at) || 0;
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

  const clearTyping = useCallback(() => {
    window.clearTimeout(typingTimerRef.current);
    setTyping(false);
  }, []);

  const loadHistory = useCallback(() => {
    const request = ++historyRequestRef.current;
    const live = stateRef.current.historyLoaded;
    fetchHistory(identifier, externalId)
      .then((page) => {
        if (request !== historyRequestRef.current) return;
        dispatch({
          type: 'history/replace',
          items: page.data,
          chats: page.chats,
          nextCursor: page.next_cursor,
        });
        trackUnread(page.data, live);
        setHistoryError(false);
      })
      .catch(() => {
        if (request !== historyRequestRef.current) return;
        if (!stateRef.current.historyLoaded) setHistoryError(true);
      });
  }, [identifier, externalId, trackUnread]);

  const loadHistoryRef = useRef(loadHistory);
  loadHistoryRef.current = loadHistory;

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
          if (item.from === 'company') clearTyping();
          dispatch({ type: 'socket/received', item });
        },
        onTyping: () => {
          setTyping(true);
          window.clearTimeout(typingTimerRef.current);
          typingTimerRef.current = window.setTimeout(() => setTyping(false), TYPING_TTL_MS);
        },
        onChatClosed: (event) => {
          clearTyping();
          dispatch({
            type: 'chat/closed',
            chatId: event.chat_id,
            endedAt: event.ended_at ?? new Date().toISOString(),
            protocol: event.protocol,
          });
        },
        onState: (current, hadConnected) => {
          if (current === 'connected') {
            setSocketDown(false);
            if (hadConnected) {
              window.clearTimeout(refetchTimerRef.current);
              refetchTimerRef.current = window.setTimeout(
                () => loadHistoryRef.current(),
                RECONNECT_REFETCH_MS
              );
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
      window.clearTimeout(typingTimerRef.current);
      socket?.destroy();
    };
  }, [identifier, externalId, trackUnread, clearTyping]);

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

    const unread = unreadIdsRef.current.size;
    if (lastPostedUnreadRef.current !== unread) {
      lastPostedUnreadRef.current = unread;
      postToLoader({ __pipeelo: true, type: 'unread', count: unread });
    }
  }, [syncTick]);

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
      const sentFrom = openChatId(stateRef.current);
      request()
        .then((outcome) => {
          dispatch({
            type: 'send/confirmed',
            localId,
            messageId: outcome.messageId ?? localId,
            chatId: outcome.chatId,
          });
          if (!sentFrom || !outcome.chatId || outcome.chatId === sentFrom) return;
          if (stateRef.current.chats.get(sentFrom)?.endedAt) return;
          dispatch({
            type: 'chat/closed',
            chatId: sentFrom,
            endedAt: new Date().toISOString(),
            protocol: null,
          });
          loadHistory();
        })
        .catch(() => dispatch({ type: 'send/failed', localId }));
    },
    [loadHistory]
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
          chatId: null,
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
          chatId: null,
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
      if (message.chatId !== openChatId(stateRef.current)) return;
      dispatch({ type: 'interactive/select', messageId, value: item.value });
      const localId = uuidV4();
      dispatch({
        type: 'send/optimistic',
        message: {
          id: localId,
          chatId: null,
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
      dispatch({ type: 'send/retry', localId, createdAt: new Date().toISOString() });
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
    const cursor = stateRef.current.nextCursor;
    if (!cursor || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    fetchHistory(identifier, externalId, cursor)
      .then((page) => {
        dispatch({
          type: 'history/prependOlder',
          items: page.data,
          chats: page.chats,
          nextCursor: page.next_cursor,
        });
      })
      .catch(() => {})
      .finally(() => {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      });
  }, [identifier, externalId]);

  const reveal = useCallback(() => dispatch({ type: 'history/reveal' }), []);

  return {
    state,
    socketDown,
    typing,
    historyError,
    loadingOlder,
    identity,
    sendTextMessage,
    sendFileMessage,
    selectOption,
    retry,
    loadOlder,
    reveal,
    refreshHistory: loadHistory,
    notifyVisibility,
    setIdentity,
    setFormUser,
  };
}
