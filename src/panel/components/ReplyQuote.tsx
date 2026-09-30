import { previewOf } from '../lib/attention';
import { STR } from '../lib/strings';
import type { ReplyTo } from '../state/store';

export function ReplyQuote(props: { replyTo: ReplyTo; brandName: string; onClick?(): void }) {
  const content = (
    <>
      <span class="reply-quote-author">{props.replyTo.from === 'customer' ? STR.you : props.brandName}</span>
      <span class="reply-quote-text">{previewOf(props.replyTo)}</span>
    </>
  );

  return props.onClick ? (
    <button type="button" class="reply-quote" onClick={props.onClick}>
      {content}
    </button>
  ) : (
    <div class="reply-quote">{content}</div>
  );
}
