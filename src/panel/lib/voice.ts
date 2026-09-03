export const VOICE_MIN_MS = 700;
export const VOICE_MAX_MS = 300_000;

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

const EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

function recorderAvailable(): boolean {
  return typeof MediaRecorder === 'function' && typeof MediaRecorder.isTypeSupported === 'function';
}

export function pickMime(): string {
  if (!recorderAvailable()) return '';
  return MIME_CANDIDATES.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? '';
}

export function voiceSupported(): boolean {
  return (
    window.isSecureContext === true &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    pickMime() !== ''
  );
}

export function createRecorder(stream: MediaStream): MediaRecorder {
  const mime = pickMime();
  if (mime) {
    try {
      return new MediaRecorder(stream, { mimeType: mime });
    } catch {
    }
  }
  return new MediaRecorder(stream);
}

export function voiceFile(chunks: Blob[], reported: string): File {
  const raw = reported || chunks[0]?.type || 'audio/mp4';
  const base = (raw.split(';')[0] ?? raw).trim().toLowerCase();
  const ext = EXTENSIONS[base] ?? base.split('/')[1] ?? 'webm';
  return new File(chunks, `audio-${Date.now()}.${ext}`, { type: base });
}
