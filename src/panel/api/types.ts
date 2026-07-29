export type { WidgetConfig } from '../../shared/widget-config';

export type MessageFrom = 'company' | 'customer';

// Item da timeline do histórico E payload do evento do socket — idênticos.
export interface ApiMessage {
  message_id: string;
  chat_id: string;
  external_id: string;
  type: string; // 'text' | 'image' | 'audio' | 'video' | 'document' | outros (defensivo)
  text: string | null;
  media_url: string | null; // URL S3 presigned, expira em 1h
  from: MessageFrom; // 'customer' = visitante; 'company' = atendente E IA
  created_at: string; // ISO 8601
}

export interface HistoryPage {
  data: ApiMessage[]; // DESC: mais recente primeiro
  per_page: number;
  next_cursor: string | null; // cursor para a página MAIS ANTIGA
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

// messageId null = 200 com [] (cliente bloqueado): a API descarta em
// silêncio e o widget marca como enviado sem esperar eco.
export interface SendOutcome {
  messageId: string | null;
  chatId: string | null;
}
