import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { STR } from '../lib/strings';
import { dayKey, formatDayLabel } from '../lib/time';
import type { ChatMessage, ChatState } from '../state/store';
import { MessageBubble } from './MessageBubble';

interface Row {
  message: ChatMessage;
  last: boolean;
}

interface DaySection {
  key: string;
  label: string;
  rows: Row[];
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

function buildSections(state: ChatState): DaySection[] {
  const sections: DaySection[] = [];
  let previous: ChatMessage | null = null;
  for (const id of state.order) {
    const message = state.byId.get(id);
    if (!message) continue;
    const key = dayKey(message.createdAt);
    let section = sections[sections.length - 1];
    if (!section || section.key !== key) {
      section = { key, label: formatDayLabel(message.createdAt), rows: [] };
      sections.push(section);
    }
    const grouped =
      previous !== null &&
      previous.from === message.from &&
      dayKey(previous.createdAt) === key &&
      (Date.parse(message.createdAt) || 0) - (Date.parse(previous.createdAt) || 0) <
        GROUP_WINDOW_MS;
    if (grouped && section.rows.length > 0) {
      section.rows[section.rows.length - 1]!.last = false;
    }
    section.rows.push({ message, last: true });
    previous = message;
  }
  return sections;
}

export function MessageList(props: {
  state: ChatState;
  open: boolean;
  avatarInitial: string;
  welcome: string | null;
  historyError: boolean;
  loadingOlder: boolean;
  onRetryHistory(): void;
  loadOlder(): void;
  onRetry(id: string): void;
  onMediaError(): void;
}) {
  const { state } = props;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const prependAnchorRef = useRef<{ height: number; top: number } | null>(null);
  const hasMore = Boolean(state.nextCursor);

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (el.scrollTop < 60 && hasMore && !props.loadingOlder && state.historyLoaded) {
      // âncora capturada ANTES do prepend — restaura a posição sem "pulo"
      prependAnchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
      props.loadOlder();
    }
  };

  // Âncora manual (scroll anchoring nativo desligado via overflow-anchor):
  // prepend restaura a posição; senão, se estava no fundo, segue no fundo.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const anchor = prependAnchorRef.current;
    if (anchor) {
      el.scrollTop = el.scrollHeight - anchor.height + anchor.top;
      prependAnchorRef.current = null;
    } else if (atBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.order]);

  // loadOlder falhou (sem mudança em order): descarta a âncora pendente.
  useEffect(() => {
    if (!props.loadingOlder) prependAnchorRef.current = null;
  }, [props.loadingOlder]);

  useEffect(() => {
    if (!props.open) return;
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    atBottomRef.current = true;
  }, [props.open]);

  const sections = buildSections(state);
  const showWelcome = state.historyLoaded && state.order.length === 0 && Boolean(props.welcome);

  return (
    <div
      class="messages"
      ref={scrollerRef}
      onScroll={onScroll}
      role="log"
      aria-live="polite"
      aria-label="Mensagens da conversa"
    >
      {!state.historyLoaded && !props.historyError && (
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

      {props.loadingOlder && <div class="older-loading">{STR.loadingOlder}</div>}

      {showWelcome && (
        <div class="day-section">
          <div class="msg-row msg-row--theirs msg-row--last">
            <div class="msg-bubble">
              <span class="msg-avatar" aria-hidden="true">
                {props.avatarInitial}
              </span>
              <span class="msg-text">{props.welcome}</span>
            </div>
          </div>
        </div>
      )}

      {sections.map((section) => (
        <div class="day-section" key={section.key}>
          <div class="day-label">{section.label}</div>
          {section.rows.map((row) => (
            <MessageBubble
              key={row.message.id}
              message={row.message}
              last={row.last}
              avatarInitial={props.avatarInitial}
              onRetry={props.onRetry}
              onMediaError={props.onMediaError}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
