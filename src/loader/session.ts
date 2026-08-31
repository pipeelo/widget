import { uuidV4 } from '../shared/uuid';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

export function detectStorage(): StorageLike {
  try {
    const ls = window.localStorage;
    const probe = '__pipeelo_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return memoryStorage();
  }
}

export interface Session {
  getToken(): string | null;
  ensureToken(): string;
  getLastReadAt(): string | null;
  setLastReadAt(at: string): void;
  isTeaserDismissed(): boolean;
  dismissTeaser(): void;
}

export function createSession(identifier: string, storage?: StorageLike): Session {
  const store = storage ?? detectStorage();
  const tokenKey = `pipeelo:token:${identifier}`;
  const lastReadKey = `pipeelo:lastread:${identifier}`;
  const teaserKey = `pipeelo:teaser:${identifier}`;

  const get = (key: string): string | null => {
    try {
      return store.getItem(key);
    } catch {
      return null;
    }
  };
  const set = (key: string, value: string): void => {
    try {
      store.setItem(key, value);
    } catch {
    }
  };

  return {
    getToken: () => get(tokenKey),
    ensureToken() {
      let token = get(tokenKey);
      if (!token) {
        token = uuidV4();
        set(tokenKey, token);
      }
      return token;
    },
    getLastReadAt: () => get(lastReadKey),
    setLastReadAt(at) {
      set(lastReadKey, at);
    },
    isTeaserDismissed: () => get(teaserKey) === '1',
    dismissTeaser() {
      set(teaserKey, '1');
    },
  };
}
