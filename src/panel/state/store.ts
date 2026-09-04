import type { ApiItem, ApiMessage, ChatSummary } from '../api/types';

export type SendStatus = 'sending' | 'sent' | 'failed';
export type MessageKind =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'interactive'
  | 'order_details';

export interface PixDetails {
  productName: string | null;
  code: string;
  value: number | null;
}

export interface ChatMessage {
  id: string;
  chatId: string | null;
  kind: MessageKind;
  text: string | null;
  mediaUrl: string | null;
  items: ApiItem[] | null;
  selectedValue: string | null;
  pix: PixDetails | null;
  from: 'company' | 'customer';
  createdAt: string;
  status: SendStatus;
  pendingFile?: File;
}

export interface ChatMeta {
  protocol: string | null;
  endedAt: string | null;
}

export interface ChatState {
  byId: Map<string, ChatMessage>;
  order: string[];
  chats: Map<string, ChatMeta>;
  nextCursor: string | null;
  historyLoaded: boolean;
  anchorChatId: string | null;
  revealed: boolean;
}

export const initialChatState: ChatState = {
  byId: new Map(),
  order: [],
  chats: new Map(),
  nextCursor: null,
  historyLoaded: false,
  anchorChatId: null,
  revealed: false,
};

export function kindFromApi(item: ApiMessage): MessageKind {
  const type = (item.type || '').toLowerCase();
  if (type === 'image' || type === 'sticker') return 'image';
  if (type === 'audio' || type === 'voice') return 'audio';
  if (type === 'video') return 'video';
  if (type === 'document') return 'document';
  if (type === 'interactive') return 'interactive';
  if (type === 'order_details') return 'order_details';
  if (type === 'text') return 'text';
  return item.media_url ? 'document' : 'text';
}

function itemsFromApi(raw: ApiMessage['items']): ApiItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: ApiItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { title, value, description } = entry;
    if (typeof title !== 'string' || typeof value !== 'string' || !title || !value) continue;
    items.push({ title, value, description: typeof description === 'string' ? description : null });
  }
  return items.length > 0 ? items : null;
}

function pixFromApi(item: ApiMessage): PixDetails | null {
  if ((item.type || '').toLowerCase() !== 'order_details') return null;
  if (typeof item.code !== 'string' || !item.code) return null;
  return {
    productName: typeof item.product_name === 'string' && item.product_name ? item.product_name : null,
    code: item.code,
    value: typeof item.value === 'number' && Number.isInteger(item.value) ? item.value : null,
  };
}

export function fromApi(item: ApiMessage): ChatMessage {
  return {
    id: item.message_id,
    chatId: item.chat_id,
    kind: kindFromApi(item),
    text: item.text ?? null,
    mediaUrl: item.media_url ?? null,
    items: itemsFromApi(item.items),
    selectedValue: typeof item.selected_value === 'string' ? item.selected_value : null,
    pix: pixFromApi(item),
    from: item.from === 'company' ? 'company' : 'customer',
    createdAt: item.created_at,
    status: 'sent',
  };
}

function compareMessages(a: ChatMessage, b: ChatMessage): number {
  const ta = Date.parse(a.createdAt) || 0;
  const tb = Date.parse(b.createdAt) || 0;
  if (ta !== tb) return ta - tb;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function rebuild(state: ChatState, byId: Map<string, ChatMessage>, patch?: Partial<ChatState>): ChatState {
  const order = Array.from(byId.values()).sort(compareMessages).map((m) => m.id);
  return { ...state, ...patch, byId, order };
}

function inFlightTwinOf(byId: Map<string, ChatMessage>, item: ApiMessage): string | null {
  if (item.from !== 'customer' || byId.has(item.message_id)) return null;
  const kind = kindFromApi(item);
  for (const message of byId.values()) {
    if (message.from !== 'customer' || message.status !== 'sending') continue;
    if (message.kind !== kind) continue;
    if (kind === 'text' && message.text !== (item.text ?? null)) continue;
    return message.id;
  }
  return null;
}

function absorb(byId: Map<string, ChatMessage>, item: ApiMessage): void {
  const twin = inFlightTwinOf(byId, item);
  if (twin) byId.delete(twin);
  byId.set(item.message_id, fromApi(item));
}

function mergeChats(chats: Map<string, ChatMeta>, summaries: ChatSummary[]): Map<string, ChatMeta> {
  const merged = new Map(chats);
  for (const summary of summaries) {
    const current = merged.get(summary.chat_id);
    merged.set(summary.chat_id, {
      protocol: summary.protocol ?? current?.protocol ?? null,
      endedAt: summary.ended_at ?? current?.endedAt ?? null,
    });
  }
  return merged;
}

function isOpen(chats: Map<string, ChatMeta>, chatId: string): boolean {
  return chats.get(chatId)?.endedAt == null;
}

function newestChatId(byId: Map<string, ChatMessage>, order: string[]): string | null {
  for (let index = order.length - 1; index >= 0; index--) {
    const chatId = byId.get(order[index]!)?.chatId;
    if (chatId) return chatId;
  }
  return null;
}

function withAnchor(state: ChatState): ChatState {
  if (state.anchorChatId !== null) return state;
  const newest = newestChatId(state.byId, state.order);
  if (!newest || !isOpen(state.chats, newest)) return state;
  return { ...state, anchorChatId: newest };
}

function clampCreatedAt(byId: Map<string, ChatMessage>, order: string[], iso: string): string {
  const last = order.length > 0 ? byId.get(order[order.length - 1]!) : undefined;
  if (!last) return iso;
  const floor = (Date.parse(last.createdAt) || 0) + 1;
  return (Date.parse(iso) || 0) >= floor ? iso : new Date(floor).toISOString();
}

export function visibleOrder(state: ChatState): string[] {
  if (state.revealed) return state.order;
  if (state.anchorChatId !== null) {
    const start = state.order.findIndex((id) => state.byId.get(id)?.chatId === state.anchorChatId);
    if (start >= 0) return state.order.slice(start);
  }
  return state.order.filter((id) => state.byId.get(id)?.chatId === null);
}

export function openChatId(state: ChatState): string | null {
  const newest = newestChatId(state.byId, state.order);
  return newest !== null && isOpen(state.chats, newest) ? newest : null;
}

export type ChatAction =
  | { type: 'history/replace'; items: ApiMessage[]; chats: ChatSummary[]; nextCursor: string | null }
  | { type: 'history/prependOlder'; items: ApiMessage[]; chats: ChatSummary[]; nextCursor: string | null }
  | { type: 'history/reveal' }
  | { type: 'send/optimistic'; message: ChatMessage }
  | { type: 'send/confirmed'; localId: string; messageId: string; chatId: string | null }
  | { type: 'send/failed'; localId: string }
  | { type: 'send/retry'; localId: string; createdAt: string }
  | { type: 'interactive/select'; messageId: string; value: string }
  | { type: 'socket/received'; item: ApiMessage }
  | { type: 'chat/closed'; chatId: string; endedAt: string | null; protocol: string | null };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'history/replace': {
      const byId = new Map(state.byId);
      for (const item of action.items) absorb(byId, item);
      return withAnchor(
        rebuild(state, byId, {
          chats: mergeChats(state.chats, action.chats),
          nextCursor: state.historyLoaded ? state.nextCursor : action.nextCursor,
          historyLoaded: true,
        })
      );
    }

    case 'history/prependOlder': {
      const byId = new Map(state.byId);
      for (const item of action.items) byId.set(item.message_id, fromApi(item));
      return rebuild(state, byId, {
        chats: mergeChats(state.chats, action.chats),
        nextCursor: action.nextCursor,
      });
    }

    case 'history/reveal':
      return state.revealed ? state : { ...state, revealed: true };

    case 'socket/received': {
      const byId = new Map(state.byId);
      absorb(byId, action.item);
      return withAnchor(rebuild(state, byId));
    }

    case 'send/optimistic': {
      const byId = new Map(state.byId);
      const createdAt = clampCreatedAt(state.byId, state.order, action.message.createdAt);
      byId.set(action.message.id, { ...action.message, createdAt });
      return rebuild(state, byId);
    }

    case 'send/confirmed': {
      const local = state.byId.get(action.localId);
      if (!local) return state;
      const byId = new Map(state.byId);
      byId.delete(action.localId);
      const server = byId.get(action.messageId);
      byId.set(
        action.messageId,
        server ?? { ...local, id: action.messageId, chatId: action.chatId ?? local.chatId, status: 'sent' }
      );
      return withAnchor(rebuild(state, byId));
    }

    case 'send/failed': {
      const local = state.byId.get(action.localId);
      if (!local || local.status !== 'sending') return state;
      const byId = new Map(state.byId);
      byId.set(action.localId, { ...local, status: 'failed' });
      return rebuild(state, byId);
    }

    case 'send/retry': {
      const local = state.byId.get(action.localId);
      if (!local || local.status !== 'failed') return state;
      const byId = new Map(state.byId);
      const createdAt = clampCreatedAt(state.byId, state.order, action.createdAt);
      byId.set(action.localId, { ...local, status: 'sending', createdAt });
      return rebuild(state, byId);
    }

    case 'interactive/select': {
      const message = state.byId.get(action.messageId);
      if (!message || message.kind !== 'interactive' || message.selectedValue !== null) return state;
      const byId = new Map(state.byId);
      byId.set(action.messageId, { ...message, selectedValue: action.value });
      return rebuild(state, byId);
    }

    case 'chat/closed': {
      const current = state.chats.get(action.chatId);
      const chats = new Map(state.chats);
      chats.set(action.chatId, {
        protocol: action.protocol ?? current?.protocol ?? null,
        endedAt: action.endedAt ?? current?.endedAt ?? null,
      });
      return { ...state, chats };
    }
  }
}
