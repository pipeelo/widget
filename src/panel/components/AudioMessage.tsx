import { useEffect, useRef, useState } from 'preact/hooks';
import { STR } from '../lib/strings';
import { formatDuration } from '../lib/time';

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

export function AudioMessage(props: { url: string; onMediaError(): void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fixingRef = useRef(false);
  const fixTimerRef = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrent(0);
    setDuration(null);
    return () => {
      window.clearTimeout(fixTimerRef.current);
      fixingRef.current = false;
    };
  }, [props.url]);

  useEffect(
    () => () => {
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
    setIsPlaying(false);
    setCurrent(0);
  };

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    abandonDurationFix();
    if (el.paused) void el.play().catch(() => {});
    else el.pause();
  };

  const percent = duration ? Math.min(100, (current / duration) * 100) : 0;
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
      <div
        class="msg-audio-track"
        aria-hidden="true"
        onClick={(event) => {
          const el = audioRef.current;
          if (!el || duration === null) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
          el.currentTime = ratio * duration;
          setCurrent(el.currentTime);
        }}
      >
        <span class="msg-audio-fill" style={{ width: `${percent}%` }} />
      </div>
      <span class="msg-audio-time">{label}</span>
      <audio
        ref={audioRef}
        class="msg-audio-el"
        src={props.url}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onDurationChange={onDurationChange}
        onTimeUpdate={onTimeUpdate}
        onPlay={onPlay}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        onError={props.onMediaError}
      />
    </div>
  );
}
