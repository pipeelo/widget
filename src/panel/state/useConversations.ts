import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { fetchConversations } from '../api/client';
import type { Conversation } from '../api/types';

export interface ConversationsController {
  items: Conversation[];
  open: Conversation | null;
  loaded: boolean;
  error: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  refresh(): void;
  loadMore(): void;
  markClosed(chatId: string, endedAt: string | null): void;
}

export function useConversations(
  identifier: string,
  externalId: string
): ConversationsController {
  const [items, setItems] = useState<Conversation[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const requestRef = useRef(0);
  const loadedRef = useRef(false);
  const loadingMoreRef = useRef(false);

  const refresh = useCallback(() => {
    const request = ++requestRef.current;
    fetchConversations(identifier, externalId)
      .then((page) => {
        if (request !== requestRef.current) return;
        setItems(page.data);
        setNextCursor(page.next_cursor);
        loadedRef.current = true;
        setLoaded(true);
        setError(false);
      })
      .catch(() => {
        if (request !== requestRef.current) return;
        if (!loadedRef.current) setError(true);
      });
  }, [identifier, externalId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(() => {
    if (!nextCursor || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const request = requestRef.current;
    fetchConversations(identifier, externalId, nextCursor)
      .then((page) => {
        if (request !== requestRef.current) return;
        setItems((current) => current.concat(page.data));
        setNextCursor(page.next_cursor);
      })
      .catch(() => {
      })
      .finally(() => {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [identifier, externalId, nextCursor]);

  const markClosed = useCallback((chatId: string, endedAt: string | null) => {
    setItems((current) =>
      current.map((item) =>
        item.chat_id === chatId && !item.ended_at
          ? { ...item, ended_at: endedAt ?? new Date().toISOString() }
          : item
      )
    );
  }, []);

  return {
    items,
    open: items.find((item) => !item.ended_at) ?? null,
    loaded,
    error,
    loadingMore,
    hasMore: Boolean(nextCursor),
    refresh,
    loadMore,
    markClosed,
  };
}
