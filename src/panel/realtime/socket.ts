import Pusher from 'pusher-js';
import type { ApiMessage, ChatClosedEvent } from '../api/types';
import { ENV } from '../env';

export interface SocketHandle {
  destroy(): void;
}

export function createSocket(opts: {
  identifier: string;
  externalId: string;
  onMessage(item: ApiMessage): void;
  onChatClosed(event: ChatClosedEvent): void;
  onState(current: string, hadConnected: boolean): void;
}): SocketHandle {
  const pusher = new Pusher(ENV.soketiKey, {
    wsHost: ENV.soketiHost,
    wsPort: ENV.soketiPort,
    wssPort: ENV.soketiPort,
    forceTLS: ENV.soketiTls,
    cluster: ENV.soketiCluster,
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
  channel.bind('website-channel.chat-closed', (payload: unknown) => {
    if (payload === null || typeof payload !== 'object') return;
    const data = payload as { chat_id?: unknown; ended_at?: unknown };
    if (typeof data.chat_id !== 'string') return;
    opts.onChatClosed({
      chat_id: data.chat_id,
      ended_at: typeof data.ended_at === 'string' ? data.ended_at : null,
    });
  });

  let hadConnected = pusher.connection.state === 'connected';
  pusher.connection.bind('state_change', (states: { previous: string; current: string }) => {
    opts.onState(states.current, hadConnected);
    if (states.current === 'connected') hadConnected = true;
  });

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
