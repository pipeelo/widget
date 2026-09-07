import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { createRecorder, VOICE_MIN_MS, voiceFile, voiceSupported } from '../lib/voice';
import { toPeaks } from '../lib/wave';

const TICK_MS = 50;
const LIVE_LEVELS = 240;

export type VoiceError = 'denied' | 'unavailable' | 'failed';
export type VoiceState = 'idle' | 'recording';

export interface VoiceResult {
  file: File;
  durationMs: number;
  peaks: number[] | null;
}

interface VoiceAnalyser {
  context: AudioContext;
  analyser: AnalyserNode;
}

function errorKind(err: unknown): VoiceError {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unavailable';
  return 'failed';
}

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function detach(rec: MediaRecorder): void {
  rec.ondataavailable = null;
  rec.onstop = null;
  rec.onerror = null;
}

function createAnalyser(stream: MediaStream): VoiceAnalyser | null {
  try {
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    void context.resume().catch(() => {});
    return { context, analyser };
  } catch {
    return null;
  }
}

function readLevel(analyser: AnalyserNode): number {
  const samples = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(samples);
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
  return peak / 128;
}

export function useVoiceRecorder() {
  const [supported] = useState(voiceSupported);
  const [state, setState] = useState<VoiceState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const [error, setError] = useState<VoiceError | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<VoiceAnalyser | null>(null);
  const levelsRef = useRef<number[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(0);
  const busyRef = useRef(false);
  const abortedRef = useRef(false);

  const release = useCallback(() => {
    window.clearInterval(timerRef.current);
    stopTracks(streamRef.current);
    void audioRef.current?.context.close().catch(() => {});
    streamRef.current = null;
    recorderRef.current = null;
    audioRef.current = null;
    chunksRef.current = [];
    busyRef.current = false;
    setState('idle');
  }, []);

  const cancel = useCallback(() => {
    abortedRef.current = true;
    const rec = recorderRef.current;
    if (rec) {
      detach(rec);
      if (rec.state !== 'inactive') rec.stop();
    }
    release();
  }, [release]);

  useEffect(() => cancel, [cancel]);

  const start = useCallback(async () => {
    if (busyRef.current || !supported) return;
    busyRef.current = true;
    abortedRef.current = false;
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      busyRef.current = false;
      setError(errorKind(err));
      return;
    }
    if (abortedRef.current) {
      stopTracks(stream);
      busyRef.current = false;
      return;
    }
    let rec: MediaRecorder;
    try {
      rec = createRecorder(stream);
      rec.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      rec.onerror = () => {
        setError('failed');
        release();
      };
      rec.start();
    } catch {
      stopTracks(stream);
      busyRef.current = false;
      setError('failed');
      return;
    }
    chunksRef.current = [];
    levelsRef.current = [];
    recorderRef.current = rec;
    streamRef.current = stream;
    audioRef.current = createAnalyser(stream);
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setLevels([]);
    setState('recording');
    timerRef.current = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
      const audio = audioRef.current;
      if (!audio) return;
      const level = readLevel(audio.analyser);
      levelsRef.current.push(level);
      setLevels((recent) => [...recent.slice(1 - LIVE_LEVELS), level]);
    }, TICK_MS);
  }, [supported, release]);

  const stop = useCallback(
    () =>
      new Promise<VoiceResult | null>((resolve) => {
        const rec = recorderRef.current;
        if (!rec || rec.state === 'inactive') {
          release();
          resolve(null);
          return;
        }
        const durationMs = Date.now() - startedAtRef.current;
        rec.onstop = () => {
          const chunks = chunksRef.current;
          const mime = rec.mimeType;
          const measured = audioRef.current?.context.state === 'running';
          const peaks = measured ? toPeaks(levelsRef.current) : null;
          release();
          resolve(
            durationMs >= VOICE_MIN_MS && chunks.length > 0
              ? { file: voiceFile(chunks, mime), durationMs, peaks }
              : null
          );
        };
        rec.onerror = () => {
          release();
          resolve(null);
        };
        rec.stop();
      }),
    [release]
  );

  return { supported, state, elapsedMs, levels, error, start, stop, cancel };
}
