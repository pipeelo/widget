import type { ApiMessage } from '../api/types';

export type SendStatus = 'sending' | 'sent' | 'failed';
export type MessageKind = 'text' | 'image' | 'audio' | 'video' | 'document';

export interface ChatMessage {
  id: string;
  kind: MessageKind;
  text: string | null;
  mediaUrl: string | null;
  from: 'company' | 'customer';
  createdAt: string;
  status: SendStatus;
  pendingFile?: File;
}

export interface ChatState {
  byId: Map<string, ChatMessage>;
  order: string[];
  nextCursor: string | null;
  historyLoaded: boolean;
}

export const initialChatState: ChatState = {
  byId: new Map(),
  order: [],
  nextCursor: null,
  historyLoaded: false,
};

export function kindFromApi(item: ApiMessage): MessageKind {
  const type = (item.type || '').toLowerCase();
  if (type === 'image' || type === 'sticker') return 'image';
  if (type === 'audio' || type === 'voice') return 'audio';
  if (type === 'video') return 'video';
  if (type === 'document') return 'document';
  if (type === 'text') return 'text';
  return item.media_url ? 'document' : 'text';
}

export function fromApi(item: ApiMessage): ChatMessage {
  return {
    id: item.message_id,
    kind: kindFromApi(item),
    text: item.text ?? null,
    mediaUrl: item.media_url ?? null,
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

export type ChatAction =
  | { type: 'conversation/reset'; loaded: boolean }
  | {
      type: 'history/replace';
      items: ApiMessage[];
      nextCursor: string | null;
      adoptCursor: boolean;
    }
  | { type: 'history/prependOlder'; items: ApiMessage[]; nextCursor: string | null }
  | { type: 'send/optimistic'; message: ChatMessage }
  | { type: 'send/confirmed'; localId: string; messageId: string }
  | { type: 'send/failed'; localId: string }
  | { type: 'send/retry'; localId: string }
  | { type: 'socket/received'; item: ApiMessage };

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'conversation/reset':
      return { byId: new Map(), order: [], nextCursor: null, historyLoaded: action.loaded };

    case 'history/replace': {
      const byId = new Map(state.byId);
      for (const item of action.items) byId.set(item.message_id, fromApi(item));
      const nextCursor = action.adoptCursor ? action.nextCursor : state.nextCursor;
      return rebuild(state, byId, { nextCursor, historyLoaded: true });
    }

    case 'history/prependOlder': {
      const byId = new Map(state.byId);
      for (const item of action.items) byId.set(item.message_id, fromApi(item));
      return rebuild(state, byId, { nextCursor: action.nextCursor });
    }

    case 'socket/received': {
      const byId = new Map(state.byId);
      byId.set(action.item.message_id, fromApi(action.item));
      return rebuild(state, byId);
    }

    case 'send/optimistic': {
      const byId = new Map(state.byId);
      byId.set(action.message.id, action.message);
      return rebuild(state, byId);
    }

    case 'send/confirmed': {
      const local = state.byId.get(action.localId);
      if (!local) return state;
      const byId = new Map(state.byId);
      byId.delete(action.localId);
      const server = byId.get(action.messageId);
      byId.set(action.messageId, server ?? { ...local, id: action.messageId, status: 'sent' });
      return rebuild(state, byId);
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
      byId.set(action.localId, { ...local, status: 'sending' });
      return rebuild(state, byId);
    }
  }
}
