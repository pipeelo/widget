export type { WidgetConfig } from '../../shared/widget-config';

export type MessageFrom = 'company' | 'customer';

export interface ApiMessage {
  message_id: string;
  chat_id: string;
  external_id: string;
  type: string;
  text: string | null;
  media_url: string | null;
  from: MessageFrom;
  created_at: string;
}

export interface HistoryPage {
  data: ApiMessage[];
  per_page: number;
  next_cursor: string | null;
  next_page_url: string | null;
  prev_cursor: string | null;
  prev_page_url: string | null;
}

export interface ChatClosedEvent {
  chat_id: string;
  ended_at: string | null;
}

export interface Conversation {
  chat_id: string;
  protocol: string | null;
  started_at: string | null;
  ended_at: string | null;
  last_message_text: string | null;
  last_message_type: string | null;
  last_message_from: MessageFrom;
  last_message_created_at: string | null;
}

export interface ConversationsPage {
  data: Conversation[];
  per_page: number;
  next_cursor: string | null;
  next_page_url: string | null;
  prev_cursor: string | null;
  prev_page_url: string | null;
}

export type MediaField = 'image' | 'audio' | 'video' | 'document';

export interface SendOutcome {
  messageId: string | null;
  chatId: string | null;
}
