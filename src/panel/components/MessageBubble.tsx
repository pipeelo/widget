import type { ApiItem } from '../api/types';
import { STR } from '../lib/strings';
import { formatTime } from '../lib/time';
import type { ChatMessage } from '../state/store';
import { InteractiveOptions } from './InteractiveOptions';
import { Linkify } from './Linkify';
import { MediaContent } from './MediaContent';
import { PixCard } from './PixCard';

function CheckIcon() {
  return (
    <svg class="msg-tick" role="img" aria-label={STR.sent} viewBox="0 0 24 24">
      <path
        d="m4.5 12.5 4.5 4.5L19.5 6.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg class="msg-tick" role="img" aria-label={STR.sending} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2" />
      <path
        d="M12 7.5V12l3 1.8"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

export function MessageBubble(props: {
  message: ChatMessage;
  first: boolean;
  last: boolean;
  onRetry(id: string): void;
  onMediaError(): void;
  onSelectOption?(messageId: string, item: ApiItem): void;
}) {
  const { message } = props;
  const mine = message.from === 'customer';
  const textual =
    message.kind === 'text' || message.kind === 'interactive' || message.kind === 'order_details';
  const hasMedia = Boolean(message.mediaUrl);
  const framed = hasMedia && (message.kind === 'image' || message.kind === 'video');
  const overlay = framed && message.kind === 'image';
  const rowClass =
    'msg-row ' +
    (mine ? 'msg-row--mine' : 'msg-row--theirs') +
    (props.first ? ' msg-row--first' : '') +
    (props.last ? ' msg-row--last' : '');
  const bubbleClass =
    'msg-bubble' +
    (textual ? '' : framed ? ' msg-bubble--frame' : ' msg-bubble--panel') +
    (message.status !== 'sent' ? ' is-pending' : '');
  const metaClass =
    'msg-meta' + (overlay ? ' msg-meta--over' : !textual || message.pix ? ' msg-meta--block' : '');

  return (
    <div class={rowClass}>
      <div class={bubbleClass}>
        {textual ? (
          <>
            <Linkify text={message.text ?? ''} />
            {message.pix && <PixCard pix={message.pix} />}
          </>
        ) : (
          <MediaContent message={message} onMediaError={props.onMediaError} />
        )}
        {message.status === 'sending' && framed && <span class="msg-spinner" aria-hidden="true" />}
        <span class={metaClass}>
          <span class="msg-time">{formatTime(message.createdAt)}</span>
          {mine && message.status === 'sending' && <ClockIcon />}
          {mine && message.status === 'sent' && <CheckIcon />}
        </span>
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
