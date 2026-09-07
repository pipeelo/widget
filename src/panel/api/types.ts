export type { WidgetConfig } from '../../shared/widget-config';

export type MessageFrom = 'company' | 'customer';

export interface ApiItem {
  title: string;
  value: string;
  description?: string | null;
}

export interface ApiLink {
  label: string;
  url: string;
}

export interface ApiContact {
  name: string | null;
  phone: string | null;
}

export interface ApiMessage {
  message_id: string;
  chat_id: string;
  external_id: string;
  type: string;
  text: string | null;
  items?: ApiItem[] | null;
  link?: ApiLink | null;
  selected_value?: string | null;
  product_name?: string | null;
  code?: string | null;
  value?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  contacts?: ApiContact[] | null;
  emoji?: string | null;
  filename?: string | null;
  media_url: string | null;
  from: MessageFrom;
  created_at: string;
}

export interface ChatSummary {
  chat_id: string;
  protocol: string | null;
  started_at: string | null;
  ended_at: string | null;
}

export interface HistoryPage {
  data: ApiMessage[];
  chats: ChatSummary[];
  per_page: number;
  next_cursor: string | null;
  next_page_url: string | null;
  prev_cursor: string | null;
  prev_page_url: string | null;
}

export interface ChatClosedEvent {
  chat_id: string;
  ended_at: string | null;
  protocol: string | null;
}

export type MediaField = 'image' | 'audio' | 'video' | 'document';

export interface SendOutcome {
  messageId: string | null;
  chatId: string | null;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
