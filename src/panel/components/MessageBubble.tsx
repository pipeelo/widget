import { STR } from '../lib/strings';
import { formatTime } from '../lib/time';
import type { ChatMessage } from '../state/store';
import { Linkify } from './Linkify';
import { MediaContent } from './MediaContent';

export function MessageBubble(props: {
  message: ChatMessage;
  /** Último do grupo (mesmo autor ≤ 5 min): ganha canto "rabinho", hora e avatar. */
  last: boolean;
  avatarInitial: string;
  onRetry(id: string): void;
  onMediaError(): void;
}) {
  const { message } = props;
  const mine = message.from === 'customer';
  const rowClass =
    'msg-row ' + (mine ? 'msg-row--mine' : 'msg-row--theirs') + (props.last ? ' msg-row--last' : '');
  const bubbleClass =
    'msg-bubble' +
    (message.kind !== 'text' ? ' msg-bubble--media' : '') +
    (message.status !== 'sent' ? ' is-pending' : '');

  return (
    <div class={rowClass}>
      <div class={bubbleClass}>
        {!mine && props.last && (
          <span class="msg-avatar" aria-hidden="true">
            {props.avatarInitial}
          </span>
        )}
        {message.kind === 'text' ? (
          <Linkify text={message.text ?? ''} />
        ) : (
          <MediaContent message={message} onMediaError={props.onMediaError} />
        )}
        {message.status === 'sending' && message.kind !== 'text' && (
          <span class="msg-spinner" aria-hidden="true" />
        )}
      </div>
      {props.last && message.status === 'sent' && (
        <span class="msg-time">{formatTime(message.createdAt)}</span>
      )}
      {message.status === 'sending' && <span class="msg-status">{STR.sending}</span>}
      {message.status === 'failed' && (
        <button
          type="button"
          class="msg-status msg-status--failed"
          onClick={() => props.onRetry(message.id)}
        >
          {STR.notDelivered} · {STR.retry}
        </button>
      )}
    </div>
  );
}
