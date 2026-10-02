import { useEffect, useRef, useState } from 'preact/hooks';
import { STR } from '../lib/strings';
import { formatDuration } from '../lib/time';
import { drawBars, waveBars } from '../lib/wave';

const DURATION_FIX_TIMEOUT_MS = 3000;

let playing: HTMLAudioElement | null = null;

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

function finiteDuration(el: HTMLAudioElement): number | null {
  const value = el.duration;
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function AudioMessage(props: { url: string; peaks: number[] | null; onMediaError(): void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const fixingRef = useRef(false);
  const fixTimerRef = useRef(0);
  const heldRef = useRef(false);
  const [src, setSrc] = useState(props.url);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  const load = (url: string) => {
    window.clearTimeout(fixTimerRef.current);
    fixingRef.current = false;
    heldRef.current = false;
    setIsPlaying(false);
    setCurrent(0);
    setDuration(null);
    setSrc(url);
  };

  useEffect(() => {
    if (props.url === src || (heldRef.current && !audioRef.current?.error)) return;
    load(props.url);
  }, [props.url]);

  useEffect(
    () => () => {
      window.clearTimeout(fixTimerRef.current);
      if (playing === audioRef.current) playing = null;
    },
    []
  );

  const abandonDurationFix = () => {
    if (!fixingRef.current) return;
    fixingRef.current = false;
    window.clearTimeout(fixTimerRef.current);
    const el = audioRef.current;
    if (el) el.currentTime = 0;
  };

  const onDurationChange = () => {
    const el = audioRef.current;
    if (!el) return;
    const known = finiteDuration(el);
    if (known === null) return;
    setDuration(known);
    abandonDurationFix();
  };

  const onLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el) return;
    const known = finiteDuration(el);
    if (known !== null) {
      setDuration(known);
      return;
    }
    if (el.duration !== Infinity || !el.paused || fixingRef.current) return;
    fixingRef.current = true;
    fixTimerRef.current = window.setTimeout(abandonDurationFix, DURATION_FIX_TIMEOUT_MS);
    el.currentTime = 1e101;
  };

  const onTimeUpdate = () => {
    const el = audioRef.current;
    if (el && !fixingRef.current) setCurrent(el.currentTime);
  };

  const onPlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing && playing !== el) playing.pause();
    playing = el;
    setIsPlaying(true);
  };

  const onEnded = () => {
    heldRef.current = false;
    setIsPlaying(false);
    setCurrent(0);
    if (props.url !== src) load(props.url);
  };

  const onError = () => {
    if (props.url !== src) load(props.url);
    else props.onMediaError();
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    abandonDurationFix();
    if (el.paused) {
      heldRef.current = true;
      void el.play().catch(() => {});
    } else el.pause();
  };

  const played = duration ? Math.min(1, current / duration) : 0;

  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas) return;
    const draw = () => drawBars(canvas, waveBars(props.peaks, canvas.clientWidth), played);
    draw();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [props.peaks, played]);

  const label =
    isPlaying || current > 0
      ? formatDuration(current * 1000)
      : duration
        ? formatDuration(duration * 1000)
        : '';

  return (
    <div class="msg-audio">
      <button
        type="button"
        class="msg-audio-play"
        aria-label={isPlaying ? STR.pauseAudio : STR.playAudio}
        onClick={toggle}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <canvas
        ref={waveRef}
        class="msg-audio-wave"
        aria-hidden="true"
        onClick={(event) => {
          const el = audioRef.current;
          if (!el || duration === null) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          heldRef.current = true;
          el.currentTime = ratio * duration;
          setCurrent(el.currentTime);
        }}
      />
      <span class="msg-audio-time">{label}</span>
      <audio
        ref={audioRef}
        class="msg-audio-el"
        src={src}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onDurationChange}
        onTimeUpdate={onTimeUpdate}
        onPlay={onPlay}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        onError={onError}
      />
    </div>
  );
}
