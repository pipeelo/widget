import type { Conversation } from '../api/types';
import { STR } from '../lib/strings';
import { formatListTime } from '../lib/time';

const MEDIA_LABELS: Record<string, string> = {
  image: STR.imageLabel,
  sticker: STR.imageLabel,
  audio: STR.audioLabel,
  voice: STR.audioLabel,
  video: STR.videoLabel,
  document: STR.documentLabel,
};

function snippet(conversation: Conversation): string {
  const type = (conversation.last_message_type || '').toLowerCase();
  const body = MEDIA_LABELS[type] ?? (conversation.last_message_text || '').trim();
  if (!body) return '';
  return conversation.last_message_from === 'customer' ? `${STR.you}: ${body}` : body;
}

function ConversationRow(props: { conversation: Conversation; onOpen(chatId: string): void }) {
  const { conversation } = props;
  const ended = Boolean(conversation.ended_at);
  const stamp = conversation.last_message_created_at ?? conversation.started_at;
  const text = snippet(conversation);

  return (
    <button type="button" class="conv-row" onClick={() => props.onOpen(conversation.chat_id)}>
      <span class="conv-row-head">
        <span class={'conv-status' + (ended ? '' : ' conv-status--open')}>
          {ended ? STR.closed : STR.inProgress}
        </span>
        {stamp && <span class="conv-stamp">{formatListTime(stamp)}</span>}
      </span>
      {text && <span class="conv-snippet">{text}</span>}
    </button>
  );
}

export function ConversationList(props: {
  items: Conversation[];
  loaded: boolean;
  error: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  canStartNew: boolean;
  onOpen(chatId: string): void;
  onStartNew(): void;
  onRetry(): void;
  onLoadMore(): void;
}) {
  return (
    <>
      <div class="conv-list">
        {!props.loaded && !props.error && (
          <div class="skeleton" aria-hidden="true">
            <span class="skeleton-row" />
            <span class="skeleton-row" />
          </div>
        )}

        {props.error && (
          <div class="list-error">
            <p>{STR.conversationsError}</p>
            <button type="button" onClick={props.onRetry}>
              {STR.tryAgain}
            </button>
          </div>
        )}

        {props.loaded && !props.error && props.items.length === 0 && (
          <p class="conv-empty">{STR.noConversations}</p>
        )}

        {props.items.map((conversation) => (
          <ConversationRow
            key={conversation.chat_id}
            conversation={conversation}
            onOpen={props.onOpen}
          />
        ))}

        {props.hasMore && (
          <button
            type="button"
            class="conv-more"
            disabled={props.loadingMore}
            onClick={props.onLoadMore}
          >
            {props.loadingMore ? STR.loadingOlder : STR.loadMore}
          </button>
        )}
      </div>

      {props.canStartNew && (
        <div class="conv-actions">
          <button type="button" class="conv-new" onClick={props.onStartNew}>
            {STR.newConversation}
          </button>
        </div>
      )}
    </>
  );
}
