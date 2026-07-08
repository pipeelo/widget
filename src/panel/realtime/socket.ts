import Pusher from 'pusher-js';
import type { ApiMessage } from '../api/types';
import { ENV } from '../env';

// Canal PÚBLICO do Soketi por identidade: a segurança é o nome inadivinhável
// (uuid cunhado pelo widget) — sem authEndpoint, sem credenciais.

export interface SocketHandle {
  destroy(): void;
}

export function createSocket(opts: {
  identifier: string;
  externalId: string;
  onMessage(item: ApiMessage): void;
  /** current: estado novo; hadConnected: já esteve conectado antes (reconexão). */
  onState(current: string, hadConnected: boolean): void;
}): SocketHandle {
  const pusher = new Pusher(ENV.soketiKey, {
    wsHost: ENV.soketiHost,
    wsPort: ENV.soketiPort,
    wssPort: ENV.soketiPort,
    forceTLS: ENV.soketiTls,
    cluster: ENV.soketiCluster, // exigido pela lib; o Soketi ignora
    enabledTransports: ['ws', 'wss'],
    disableStats: true,
  });

  const channelName = `website-channel.${opts.identifier}.${opts.externalId}`;
  const channel = pusher.subscribe(channelName);
  channel.bind('website-channel.message', (payload: unknown) => {
    if (
      payload !== null &&
      typeof payload === 'object' &&
      typeof (payload as { message_id?: unknown }).message_id === 'string'
    ) {
      opts.onMessage(payload as ApiMessage);
    }
  });

  let hadConnected = pusher.connection.state === 'connected';
  pusher.connection.bind('state_change', (states: { previous: string; current: string }) => {
    opts.onState(states.current, hadConnected);
    if (states.current === 'connected') hadConnected = true;
  });

  // Aba dormida: o throttling do browser derruba o socket em silêncio e o
  // backoff da lib pode estar longo — ao voltar a ficar visível, reconecta
  // na hora (o refetch de histórico cobre o que se perdeu no meio).
  const onVisibility = () => {
    if (document.visibilityState === 'visible' && pusher.connection.state !== 'connected') {
      pusher.connect();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return {
    destroy() {
      document.removeEventListener('visibilitychange', onVisibility);
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    },
  };
}
