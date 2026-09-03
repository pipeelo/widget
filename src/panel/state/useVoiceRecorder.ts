import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { createRecorder, VOICE_MIN_MS, voiceFile, voiceSupported } from '../lib/voice';

export type VoiceError = 'denied' | 'unavailable' | 'failed';
export type VoiceState = 'idle' | 'recording';

export interface VoiceResult {
  file: File;
  durationMs: number;
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

export function useVoiceRecorder() {
  const [supported] = useState(voiceSupported);
  const [state, setState] = useState<VoiceState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<VoiceError | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef(0);
  const busyRef = useRef(false);
  const abortedRef = useRef(false);

  const release = useCallback(() => {
    window.clearInterval(timerRef.current);
    stopTracks(streamRef.current);
    streamRef.current = null;
    recorderRef.current = null;
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
    recorderRef.current = rec;
    streamRef.current = stream;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setState('recording');
    timerRef.current = window.setInterval(
      () => setElapsedMs(Date.now() - startedAtRef.current),
      250
    );
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
          release();
          resolve(
            durationMs >= VOICE_MIN_MS && chunks.length > 0
              ? { file: voiceFile(chunks, mime), durationMs }
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

  return { supported, state, elapsedMs, error, start, stop, cancel };
}
