import type { PushSubscriptionPayload } from './api/types';
import { subscribePush } from './api/client';
import { isEmbedded } from './bridge';

export function isPushEligible(): boolean {
  return (
    !isEmbedded() &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    typeof Notification.requestPermission === 'function'
  );
}

function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker
    .register(`${import.meta.env.BASE_URL}sw.js`)
    .then(() => navigator.serviceWorker.ready);
}

function toPayload(subscription: PushSubscription): PushSubscriptionPayload | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh, auth } };
}

export async function ensureSubscribed(publicKey: string): Promise<PushSubscriptionPayload | null> {
  const reg = await registration();
  const subscription =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey }));
  return toPayload(subscription);
}

export async function enablePush(publicKey: string): Promise<PushSubscriptionPayload | null> {
  const permission = await Notification.requestPermission();
  return permission === 'granted' ? ensureSubscribed(publicKey) : null;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
  }
}

export async function syncPush(
  identifier: string,
  externalId: string,
  subscription: PushSubscriptionPayload
): Promise<void> {
  const key = `pipeelo:push:${identifier}:${externalId}`;
  if (read(key) === subscription.endpoint) return;
  if (await subscribePush(identifier, externalId, subscription)) write(key, subscription.endpoint);
}

export function isPushDismissed(identifier: string): boolean {
  return read(`pipeelo:push-dismissed:${identifier}`) === '1';
}

export function dismissPush(identifier: string): void {
  write(`pipeelo:push-dismissed:${identifier}`, '1');
}
