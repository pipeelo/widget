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

// localStorage pode lançar (storage bloqueado, modo privado antigo, quota).
// Sonda com uma escrita real; qualquer falha cai para memória — widget
// funcional, sessão com a vida útil da página.
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
  /** Token existente ou null — NÃO cunha (widget aberto não é customer). */
  getToken(): string | null;
  /** Cunha no primeiro uso (chamado só quando o painel é criado). */
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

  // Mesmo o localStorage sondado pode lançar depois (quota cheia).
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
      /* melhor sem persistência do que sem widget */
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
