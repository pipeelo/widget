import { useCallback, useEffect, useReducer, useRef, useState } from 'preact/hooks';
import type { WidgetUser } from '../../shared/protocol';
import { uuidV4 } from '../../shared/uuid';
import { fetchHistory, sendFile, sendText } from '../api/client';
import type { ApiMessage, Conversation, MediaField, SendOutcome } from '../api/types';
import { postToLoader } from '../bridge';
import type { SocketHandle } from '../realtime/socket';
import { chatReducer, initialChatState, type ChatState } from './store';

const STALE_DEBOUNCE_MS = 1000;
const RECONNECT_REFETCH_MS = 2000;

export interface ChatHandlers {
  conversations: Conversation[];
  onConversationsStale(): void;
  onChatClosed(chatId: string, endedAt: string | null): void;
}

export interface ChatController {
  state: ChatState;
  activeChatId: string | null;
  socketDown: boolean;
  historyError: boolean;
  loadingOlder: boolean;
  openConversation(chatId: string | null): void;
  sendTextMessage(text: string): void;
  sendFileMessage(field: MediaField, file: File): void;
  retry(localId: string): void;
  loadOlder(): void;
  refreshHistory(): void;
  /** Chamado pela ponte quando o loader abre/fecha o painel. */
  notifyVisibility(open: boolean): void;
  /** Identidade declarada pelo host (setUser) — anexada a todo envio. */
  setIdentity(user: WidgetUser | null): void;
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

  const identityRef = useRef<WidgetUser | null>(null);

  const lastReadRef = useRef<number>(lastReadParam ? Date.parse(lastReadParam) || 0 : 0);
  const unreadIdsRef = useRef<Set<string>>(new Set());
  const newestCompanyRef = useRef<{ epoch: number; iso: string } | null>(null);
  const newestByChatRef = useRef<Map<string, number>>(new Map());
  const lastPostedUnreadRef = useRef<number | null>(null);

  const trackUnread = useCallback((items: ApiMessage[]) => {
    let changed = false;
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
      }
    }
    if (changed) setSyncTick((t) => t + 1);
  }, []);

  const markConversationsStale = useCallback(() => {
    window.clearTimeout(staleTimerRef.current);
    staleTimerRef.current = window.setTimeout(
      () => handlersRef.current.onConversationsStale(),
      STALE_DEBOUNCE_MS
    );
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
          trackUnread(page.data);
          setHistoryError(false);
        })
        .catch(() => {
          if (request !== historyRequestRef.current) return;
          // Falha no refetch de reconexão não derruba uma conversa já na tela.
          if (!stateRef.current.historyLoaded) setHistoryError(true);
        });
    },
    [identifier, externalId, trackUnread]
  );

  const openConversation = useCallback(
    (chatId: string | null) => {
      historyRequestRef.current++;
      activeChatIdRef.current = chatId;
      setActiveChatId(chatId);
      setHistoryError(false);
      dispatch({ type: 'conversation/reset', loaded: chatId === null });
      if (chatId) loadHistory(chatId, true);
    },
    [loadHistory]
  );

  const refreshHistory = useCallback(() => {
    const chatId = activeChatIdRef.current;
    if (chatId) loadHistory(chatId, false);
  }, [loadHistory]);

  const refreshHistoryRef = useRef(refreshHistory);
  refreshHistoryRef.current = refreshHistory;

  useEffect(() => {
    // pusher-js é o maior peso do bundle: fica fora do caminho crítico do 1º
    // paint (chunk próprio, carregado depois) — o composer responde antes. O
    // histórico chega por fetch de qualquer forma; o socket só cobre o vivo.
    let socket: SocketHandle | null = null;
    let cancelled = false;
    void import('../realtime/socket').then(({ createSocket }) => {
      if (cancelled) return;
      socket = createSocket({
        identifier,
        externalId,
        onMessage: (item) => {
          trackUnread([item]);
          if (item.chat_id === activeChatIdRef.current) {
            dispatch({ type: 'socket/received', item });
          } else {
            markConversationsStale();
          }
        },
        onChatClosed: (event) => {
          handlersRef.current.onChatClosed(event.chat_id, event.ended_at);
          markConversationsStale();
        },
        onState: (current, hadConnected) => {
          if (current === 'connected') {
            setSocketDown(false);
            if (hadConnected) {
              // Reconexão real: o histórico é a fonte de verdade — re-busca a
              // página recente (debounce 2s, como o dashboard) e mescla.
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
      socket?.destroy();
    };
    // Handlers entram por ref: o socket não pode cair e reconectar a cada troca
    // de atendimento.
  }, [identifier, externalId, trackUnread, markConversationsStale]);

  // O visibilityState do documento do iframe segue a ABA do host (não o CSS
  // que esconde o iframe) — cobre "painel aberto em aba background".
  useEffect(() => {
    const onVisibility = () => setSyncTick((t) => t + 1);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Núcleo do não-lido: aberto+visível marca como lido (informa o loader,
  // que persiste o marco no localStorage do host); senão, conta company
  // messages mais novas que o marco e alimenta o badge.
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

  const setIdentity = useCallback((user: WidgetUser | null) => {
    identityRef.current = user;
  }, []);

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

  const retry = useCallback(
    (localId: string) => {
      const message = stateRef.current.byId.get(localId);
      if (!message || message.status !== 'failed') return;
      dispatch({ type: 'send/retry', localId });
      if (message.kind === 'text') {
        deliver(localId, () => sendText(identifier, externalId, message.text ?? '', identityRef.current));
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
        /* rolar de novo tenta de novo */
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
    historyError,
    loadingOlder,
    openConversation,
    sendTextMessage,
    sendFileMessage,
    retry,
    loadOlder,
    refreshHistory,
    notifyVisibility,
    setIdentity,
  };
}
