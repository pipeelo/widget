import type { ApiMessage } from '../api/types';
import { MEDIA_LABELS, STR } from './strings';

const CHIME_COOLDOWN_MS = 2500;
const PREVIEW_MAX = 140;
let ctx: AudioContext | null = null;
let lastChimeAt = 0;

export function previewOf(item: ApiMessage): string {
  const label = MEDIA_LABELS[(item.type || '').toLowerCase()];
  const text = label ?? (item.text || '').replace(/\s+/g, ' ').trim();
  return (text || STR.newMessage).slice(0, PREVIEW_MAX);
}

function audioContext(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

function tone(c: AudioContext): void {
  const t = c.currentTime;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  gain.connect(c.destination);
  for (const [freq, at] of [
    [880, 0],
    [1174.66, 0.09],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    osc.start(t + at);
    osc.stop(t + 0.4);
  }
}

export function chime(): void {
  const now = Date.now();
  if (now - lastChimeAt < CHIME_COOLDOWN_MS) return;
  const c = audioContext();
  if (!c) return;
  lastChimeAt = now;
  const play = () => {
    if (Date.now() - now < 1000) tone(c);
  };
  if (c.state === 'running') play();
  else void c.resume().then(play).catch(() => {});
}
