import type { ApiItem } from '../api/types';
import { STR } from '../lib/strings';
import { formatTime } from '../lib/time';
import type { ChatMessage } from '../state/store';
import { InteractiveOptions } from './InteractiveOptions';
import { Linkify } from './Linkify';
import { MediaContent } from './MediaContent';
import { PixCard } from './PixCard';

export function MessageBubble(props: {
  message: ChatMessage;
  last: boolean;
  avatarInitial: string;
  onRetry(id: string): void;
  onMediaError(): void;
  onSelectOption?(messageId: string, item: ApiItem): void;
}) {
  const { message } = props;
  const mine = message.from === 'customer';
  const textual =
    message.kind === 'text' || message.kind === 'interactive' || message.kind === 'order_details';
  const rowClass =
    'msg-row ' + (mine ? 'msg-row--mine' : 'msg-row--theirs') + (props.last ? ' msg-row--last' : '');
  const bubbleClass =
    'msg-bubble' +
    (!textual ? ' msg-bubble--media' : '') +
    (message.status !== 'sent' ? ' is-pending' : '');

  return (
    <div class={rowClass}>
      <div class={bubbleClass}>
        {!mine && props.last && (
          <span class="msg-avatar" aria-hidden="true">
            {props.avatarInitial}
          </span>
        )}
        {textual ? (
          <>
            <Linkify text={message.text ?? ''} />
            {message.pix && <PixCard pix={message.pix} />}
          </>
        ) : (
          <MediaContent message={message} onMediaError={props.onMediaError} />
        )}
        {message.status === 'sending' && !textual && (
          <span class="msg-spinner" aria-hidden="true" />
        )}
      </div>
      {message.kind === 'interactive' && !mine && message.items && (
        <InteractiveOptions
          items={message.items}
          selectedValue={message.selectedValue}
          onSelect={
            props.onSelectOption
              ? (item: ApiItem) => props.onSelectOption?.(message.id, item)
              : undefined
          }
        />
      )}
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
