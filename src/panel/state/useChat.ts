import { useCallback, useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { uuidV4 } from '../../shared/uuid';
import { fetchHistory, sendFile, sendText } from '../api/client';
import type { MediaField } from '../api/types';
import { postToLoader } from '../bridge';
import { createSocket } from '../realtime/socket';
import {
  chatReducer,
  initialChatState,
  type ChatState,
} from './store';

export interface ChatController {
  state: ChatState;
  socketDown: boolean;
  historyError: boolean;
  loadingOlder: boolean;
  sendTextMessage(text: string): void;
  sendFileMessage(field: MediaField, file: File): void;
  retry(localId: string): void;
  loadOlder(): void;
  refreshHistory(): void;
  /** Chamado pela ponte quando o loader abre/fecha o painel. */
  notifyVisibility(open: boolean): void;
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
  const [syncTick, setSyncTick] = useState(0);

  const stateRef = useRef(state);
  stateRef.current = state;
  const openRef = useRef(false);
  const loadingOlderRef = useRef(false);
  const lastReadRef = useRef<number>(lastReadParam ? Date.parse(lastReadParam) || 0 : 0);
  const lastPostedUnreadRef = useRef<number | null>(null);
  const refetchTimerRef = useRef<number | undefined>(undefined);

  const refreshHistory = useCallback(() => {
    fetchHistory(identifier, externalId)
      .then((page) => {
        dispatch({ type: 'history/replace', items: page.data, nextCursor: page.next_cursor });
        setHistoryError(false);
      })
      .catch(() => {
        // Falha no refetch de reconexão não derruba uma conversa já na tela.
        if (!stateRef.current.historyLoaded) setHistoryError(true);
      });
  }, [identifier, externalId]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const socket = createSocket({
      identifier,
      externalId,
      onMessage: (item) => dispatch({ type: 'socket/received', item }),
      onState: (current, hadConnected) => {
        if (current === 'connected') {
          setSocketDown(false);
          if (hadConnected) {
            // Reconexão real: o histórico é a fonte de verdade — re-busca a
            // página recente (debounce 2s, como o dashboard) e mescla.
            window.clearTimeout(refetchTimerRef.current);
            refetchTimerRef.current = window.setTimeout(refreshHistory, 2000);
          }
        } else if (
          hadConnected &&
          (current === 'unavailable' || current === 'failed' || current === 'disconnected')
        ) {
          setSocketDown(true);
        }
      },
    });
    return () => {
      window.clearTimeout(refetchTimerRef.current);
      socket.destroy();
    };
  }, [identifier, externalId, refreshHistory]);

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
    let newestEpoch = 0;
    let newestIso: string | null = null;
    let unread = 0;
    for (const id of state.order) {
      const msg = state.byId.get(id);
      if (!msg || msg.from !== 'company' || msg.status !== 'sent') continue;
      const epoch = Date.parse(msg.createdAt) || 0;
      if (epoch > newestEpoch) {
        newestEpoch = epoch;
        newestIso = msg.createdAt;
      }
      if (epoch > lastReadRef.current) unread++;
    }

    if (openRef.current && document.visibilityState === 'visible') {
      if (newestEpoch > lastReadRef.current && newestIso) {
        lastReadRef.current = newestEpoch;
        postToLoader({ __pipeelo: true, type: 'read', at: newestIso });
      }
      if (lastPostedUnreadRef.current !== 0) {
        lastPostedUnreadRef.current = 0;
        postToLoader({ __pipeelo: true, type: 'unread', count: 0 });
      }
    } else if (lastPostedUnreadRef.current !== unread) {
      lastPostedUnreadRef.current = unread;
      postToLoader({ __pipeelo: true, type: 'unread', count: unread });
    }
  }, [state, syncTick]);

  const notifyVisibility = useCallback((open: boolean) => {
    openRef.current = open;
    setSyncTick((t) => t + 1);
  }, []);

  const deliver = useCallback(
    (localId: string, request: () => Promise<{ messageId: string | null }>) => {
      request()
        .then((outcome) =>
          dispatch({ type: 'send/confirmed', localId, messageId: outcome.messageId ?? localId })
        )
        .catch(() => dispatch({ type: 'send/failed', localId }));
    },
    []
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
      deliver(localId, () => sendText(identifier, externalId, text));
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
      deliver(localId, () => sendFile(identifier, externalId, field, file));
    },
    [identifier, externalId, deliver]
  );

  const retry = useCallback(
    (localId: string) => {
      const message = stateRef.current.byId.get(localId);
      if (!message || message.status !== 'failed') return;
      dispatch({ type: 'send/retry', localId });
      if (message.kind === 'text') {
        deliver(localId, () => sendText(identifier, externalId, message.text ?? ''));
      } else if (message.pendingFile) {
        deliver(localId, () =>
          sendFile(identifier, externalId, message.kind as MediaField, message.pendingFile!)
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
      .then((page) =>
        dispatch({ type: 'history/prependOlder', items: page.data, nextCursor: page.next_cursor })
      )
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
    socketDown,
    historyError,
    loadingOlder,
    sendTextMessage,
    sendFileMessage,
    retry,
    loadOlder,
    refreshHistory,
    notifyVisibility,
  };
}
