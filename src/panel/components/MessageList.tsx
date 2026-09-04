import { useEffect, useLayoutEffect, useMemo, useRef } from 'preact/hooks';
import type { ApiItem } from '../api/types';
import { STR } from '../lib/strings';
import { dayKey, formatDayLabel } from '../lib/time';
import { openChatId, visibleOrder, type ChatMessage, type ChatMeta, type ChatState } from '../state/store';
import { ClosedNotice } from './ClosedNotice';
import { MessageBubble } from './MessageBubble';

type Row =
  | { kind: 'message'; message: ChatMessage; first: boolean; last: boolean }
  | { kind: 'closed'; chatId: string; meta: ChatMeta };

interface DaySection {
  key: string;
  label: string;
  rows: Row[];
}

interface ScrollAnchor {
  height: number;
  top: number;
  cursor: string | null;
  revealed: boolean;
  peek: number;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function closedMeta(state: ChatState, chatId: string | null): ChatMeta | null {
  if (chatId === null) return null;
  const meta = state.chats.get(chatId);
  return meta?.endedAt ? meta : null;
}

function buildSections(state: ChatState, visible: string[]): DaySection[] {
  const sections: DaySection[] = [];
  let previous: ChatMessage | null = null;
  for (const id of visible) {
    const message = state.byId.get(id);
    if (!message) continue;
    const closedBefore =
      previous !== null && previous.chatId !== message.chatId ? closedMeta(state, previous.chatId) : null;
    if (closedBefore && previous?.chatId) {
      sections[sections.length - 1]!.rows.push({ kind: 'closed', chatId: previous.chatId, meta: closedBefore });
    }
    const key = dayKey(message.createdAt);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      section = { key, label: formatDayLabel(message.createdAt), rows: [] };
      sections.push(section);
    }
    const grouped =
      previous !== null &&
      !closedBefore &&
      previous.from === message.from &&
      dayKey(previous.createdAt) === key &&
      (message.chatId === null || previous.chatId === null || previous.chatId === message.chatId) &&
      (Date.parse(message.createdAt) || 0) - (Date.parse(previous.createdAt) || 0) < GROUP_WINDOW_MS;
    if (grouped) {
      const lastRow = section.rows[section.rows.length - 1];
      if (lastRow?.kind === 'message') lastRow.last = false;
    }
    section.rows.push({ kind: 'message', message, first: !grouped, last: true });
    previous = message;
  }
  const closedAfter = previous ? closedMeta(state, previous.chatId) : null;
  if (closedAfter && previous?.chatId) {
    sections[sections.length - 1]!.rows.push({ kind: 'closed', chatId: previous.chatId, meta: closedAfter });
  }
  return sections;
}

export function MessageList(props: {
  state: ChatState;
  open: boolean;
  typing: boolean;
  welcome: string | null;
  historyError: boolean;
  loadingOlder: boolean;
  onRetryHistory(): void;
  loadOlder(): void;
  onReveal(): void;
  onRetry(id: string): void;
  onMediaError(): void;
  onSelectOption(messageId: string, item: ApiItem): void;
}) {
  const { state } = props;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const anchorRef = useRef<ScrollAnchor | null>(null);

  const visible = useMemo(() => visibleOrder(state), [state]);
  const hidden = state.order.length - visible.length;
  const openId = openChatId(state);
  const canLoadOlder =
    Boolean(state.nextCursor) &&
    state.historyLoaded &&
    !props.loadingOlder &&
    (state.revealed || hidden === 0);
  const showOlderChip = !state.revealed && hidden > 0;

  const holdScroll = (el: HTMLDivElement, peek: number) => {
    anchorRef.current = {
      height: el.scrollHeight,
      top: el.scrollTop,
      cursor: state.nextCursor,
      revealed: state.revealed,
      peek,
    };
  };

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop < 60 && canLoadOlder) {
      holdScroll(el, 0);
      props.loadOlder();
    }
  };

  const onReveal = () => {
    const el = scrollerRef.current;
    if (el) holdScroll(el, el.clientHeight / 2);
    props.onReveal();
  };

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const anchor = anchorRef.current;
    if (anchor) {
      const settled =
        state.revealed !== anchor.revealed ||
        (state.nextCursor !== anchor.cursor && !props.loadingOlder);
      if (!settled) return;
      el.scrollTop = Math.max(0, el.scrollHeight - anchor.height + anchor.top - anchor.peek);
      anchorRef.current = null;
    } else if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible, props.typing, props.loadingOlder]);

  useEffect(() => {
    if (!props.loadingOlder) anchorRef.current = null;
  }, [props.loadingOlder]);

  useEffect(() => {
    if (!props.open) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
  }, [props.open]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let raf = 0;
    const repin = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (atBottomRef.current) el.scrollTop = el.scrollHeight;
      });
    };
    window.addEventListener('resize', repin);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(repin);
      observer.observe(el);
    }
    return () => {
      window.removeEventListener('resize', repin);
      observer?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const sections = buildSections(state, visible);
  const showSkeleton = !state.historyLoaded && !props.historyError && visible.length === 0;
  const showWelcome = state.historyLoaded && visible.length === 0 && Boolean(props.welcome);

  return (
    <div
      class="messages"
      ref={scrollerRef}
      onScroll={onScroll}
      role="log"
      aria-live="polite"
      aria-label="Mensagens da conversa"
    >
      {showSkeleton && (
        <div class="skeleton" aria-hidden="true">
          <span class="skeleton-bubble skeleton-bubble--theirs" style="width:62%" />
          <span class="skeleton-bubble skeleton-bubble--mine" style="width:44%" />
          <span class="skeleton-bubble skeleton-bubble--theirs" style="width:54%" />
        </div>
      )}

      {props.historyError && (
        <div class="list-error">
          <p>{STR.historyError}</p>
          <button type="button" onClick={props.onRetryHistory}>
            {STR.tryAgain}
          </button>
        </div>
      )}

      {showOlderChip && (
        <button type="button" class="older-chip" onClick={onReveal}>
          {STR.olderChats}
        </button>
      )}

      {props.loadingOlder && <div class="older-loading">{STR.loadingOlder}</div>}

      {showWelcome && (
        <div class="day-section">
          <div class="msg-row msg-row--theirs msg-row--first msg-row--last">
            <div class="msg-bubble">
              <span class="msg-text">{props.welcome}</span>
            </div>
          </div>
        </div>
      )}

      {sections.map((section) => (
        <div class="day-section" key={section.key}>
          <div class="day-label">{section.label}</div>
          {section.rows.map((row) =>
            row.kind === 'closed' ? (
              <ClosedNotice key={'closed:' + row.chatId} endedAt={row.meta.endedAt} protocol={row.meta.protocol} />
            ) : (
              <MessageBubble
                key={row.message.id}
                message={row.message}
                first={row.first}
                last={row.last}
                onRetry={props.onRetry}
                onMediaError={props.onMediaError}
                onSelectOption={
                  openId !== null && row.message.chatId === openId ? props.onSelectOption : undefined
                }
              />
            )
          )}
        </div>
      ))}

      {props.typing && (
        <div class="day-section">
          <div class="msg-row msg-row--theirs msg-row--first msg-row--last">
            <div class="msg-bubble msg-bubble--typing" role="status" aria-label={STR.typing}>
              <span class="typing-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
