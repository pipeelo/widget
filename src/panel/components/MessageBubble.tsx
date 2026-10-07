import type { ApiItem } from '../api/types';
import { isEmojiOnly, parseMessage, type Block } from '../lib/format';
import { STR } from '../lib/strings';
import { formatTime } from '../lib/time';
import type { ChatMessage } from '../state/store';
import { ReplyIcon } from './icons';
import { InteractiveOptions } from './InteractiveOptions';
import { MediaContent } from './MediaContent';
import { PixCard } from './PixCard';
import { ReplyQuote } from './ReplyQuote';
import { RichText } from './RichText';

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

function TextualContent({ message, blocks }: { message: ChatMessage; blocks: Block[] }) {
  if (message.kind === 'reaction') return <>{STR.reactedWith(message.emoji ?? '')}</>;
  if (message.kind === 'unsupported') return <span class="msg-unsupported">{STR.unsupported}</span>;
  return <RichText blocks={blocks} />;
}

export function MessageBubble(props: {
  message: ChatMessage;
  first: boolean;
  last: boolean;
  brandName: string;
  onRetry(id: string): void;
  onMediaError(): void;
  onJump(id: string): void;
  onReply?(id: string): void;
  onSelectOption?(messageId: string, item: ApiItem): void;
}) {
  const { message } = props;
  const replyTo = message.replyTo;
  const mine = message.from === 'customer';
  const textual =
    message.kind === 'text' ||
    message.kind === 'interactive' ||
    message.kind === 'order_details' ||
    message.kind === 'reaction' ||
    message.kind === 'unsupported';
  const emojiOnly = message.kind === 'text' && !replyTo && isEmojiOnly(message.text ?? '');
  const hasMedia = Boolean(message.mediaUrl);
  const framed = hasMedia && (message.kind === 'image' || message.kind === 'video');
  const captioned = framed && Boolean(message.text?.trim());
  const blocks = textual || captioned ? parseMessage(message.text ?? '') : [];
  const hasList = blocks.some((block) => block.kind === 'list');
  const overlay = framed && message.kind === 'image' && !captioned;
  const rowClass =
    'msg-row ' +
    (mine ? 'msg-row--mine' : 'msg-row--theirs') +
    (props.first ? ' msg-row--first' : '') +
    (props.last ? ' msg-row--last' : '');
  const bubbleClass =
    'msg-bubble' +
    (textual ? '' : framed ? ' msg-bubble--frame' : ' msg-bubble--panel') +
    (emojiOnly ? ' msg-bubble--emoji' : '') +
    (message.status !== 'sent' ? ' is-pending' : '');
  const metaClass =
    'msg-meta' +
    (overlay
      ? ' msg-meta--over'
      : (!textual && !captioned) || message.pix || hasList
        ? ' msg-meta--block'
        : '');
  const meta = (
    <span class={metaClass}>
      <span class="msg-time">{formatTime(message.createdAt)}</span>
      {mine && message.status === 'sending' && <ClockIcon />}
      {mine && message.status === 'sent' && <CheckIcon />}
    </span>
  );

  return (
    <div class={rowClass} data-id={message.id} data-reply={props.onReply ? '' : undefined}>
      <div class={bubbleClass}>
        {replyTo && (
          <ReplyQuote
            replyTo={replyTo}
            brandName={props.brandName}
            onClick={() => props.onJump(replyTo.id)}
          />
        )}
        {textual ? (
          <>
            <TextualContent message={message} blocks={blocks} />
            {message.pix && <PixCard pix={message.pix} />}
          </>
        ) : (
          <MediaContent message={message} onMediaError={props.onMediaError} />
        )}
        {message.status === 'sending' && framed && <span class="msg-spinner" aria-hidden="true" />}
        {captioned ? (
          <div class="msg-caption">
            <RichText blocks={blocks} />
            {meta}
          </div>
        ) : (
          meta
        )}
        {props.onReply && (
          <button
            type="button"
            class="msg-reply"
            aria-label={STR.reply}
            onClick={() => props.onReply?.(message.id)}
          >
            <ReplyIcon />
          </button>
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
      {message.link && !mine && (
        <div class="msg-options">
          <a
            class="msg-option"
            href={message.link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
          >
            {message.link.label}
          </a>
        </div>
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
