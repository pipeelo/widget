import { useEffect, useRef, useState } from 'preact/hooks';
import type { MediaField } from '../api/types';
import { classifyFile, FILE_ACCEPT } from '../lib/files';
import { STR } from '../lib/strings';
import { formatDuration } from '../lib/time';
import { VOICE_MAX_MS } from '../lib/voice';
import { useVoiceRecorder } from '../state/useVoiceRecorder';
import { AttachMenu } from './AttachMenu';

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path
        d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57a4 4 0 1 1 5.66 5.66l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
      <path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-6a3.5 3.5 0 0 0-7 0v6A3.5 3.5 0 0 0 12 15Zm6-3.5a1 1 0 1 1 2 0 8 8 0 0 1-7 7.94V21.5a1 1 0 1 1-2 0v-2.06A8 8 0 0 1 4 11.5a1 1 0 1 1 2 0 6 6 0 0 0 12 0Z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">
      <path
        d="M4 7h16M9 7V4h6v3m-7 4v7m4-7v7M6 7l1 13h10l1-13"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

export function Composer(props: {
  onSendText(text: string): void;
  onSendFile(field: MediaField, file: File): void;
  focusToken: number;
  open: boolean;
  disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number | undefined>(undefined);
  const sendingVoiceRef = useRef(false);
  const voice = useVoiceRecorder();

  const recording = voice.state === 'recording';
  const trimmed = text.trim();
  const mode: 'mic' | 'text' = !recording && voice.supported && !trimmed ? 'mic' : 'text';
  const sendDisabled = props.disabled || (mode === 'text' && !recording && !trimmed);
  const sendLabel = recording ? STR.sendAudio : mode === 'mic' ? STR.recordAudio : STR.send;

  useEffect(() => {
    if (
      props.focusToken > 0 &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      areaRef.current?.focus();
    }
  }, [props.focusToken]);

  const autosize = () => {
    const el = areaRef.current;
    if (!el) return;
    const cap = parseFloat(getComputedStyle(el).maxHeight) || 100;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, cap) + 'px';
    el.style.overflowY = el.scrollHeight > cap ? 'auto' : 'hidden';
  };

  useEffect(autosize, [text, recording]);

  useEffect(() => {
    const observer = new MutationObserver(autosize);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-density'] });
    document.fonts?.ready.then(autosize).catch(() => {});
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => window.clearTimeout(errorTimerRef.current), []);

  const showError = (message: string) => {
    setFileError(message);
    window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setFileError(null), 5000);
  };

  useEffect(() => {
    if (!voice.error) return;
    showError(
      voice.error === 'denied'
        ? STR.micDenied
        : voice.error === 'unavailable'
          ? STR.micUnavailable
          : STR.audioFailed
    );
  }, [voice.error]);

  useEffect(() => {
    if (!props.open) voice.cancel();
  }, [props.open, voice.cancel]);

  const sendVoice = () => {
    if (sendingVoiceRef.current) return;
    sendingVoiceRef.current = true;
    void voice.stop().then((result) => {
      sendingVoiceRef.current = false;
      if (result) props.onSendFile('audio', result.file);
      else showError(STR.recordTooShort);
    });
  };

  useEffect(() => {
    if (!recording) sendingVoiceRef.current = false;
  }, [recording]);

  useEffect(() => {
    if (recording && voice.elapsedMs >= VOICE_MAX_MS) sendVoice();
  }, [recording, voice.elapsedMs]);

  const submit = () => {
    const value = text.trim();
    if (!value || props.disabled) return;
    props.onSendText(value);
    setText('');
    areaRef.current?.focus();
  };

  const keepFocus = (event: Event) => event.preventDefault();

  const onFilePicked = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file || props.disabled) return;
    const result = classifyFile(file);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    props.onSendFile(result.field, file);
  };

  const pickWith = (accept: string, capture: boolean) => {
    setMenuOpen(false);
    const input = fileRef.current;
    if (!input) return;
    input.accept = accept;
    if (capture) input.setAttribute('capture', 'environment');
    else input.removeAttribute('capture');
    input.click();
  };

  const onPrimary = () => {
    if (recording) sendVoice();
    else if (mode === 'mic') void voice.start();
    else submit();
  };

  return (
    <div class="composer">
      {fileError && (
        <div class="composer-error" role="alert">
          <span>{fileError}</span>
          <button type="button" aria-label={STR.dismissNotice} onClick={() => setFileError(null)}>
            ×
          </button>
        </div>
      )}
      <div class="composer-bar">
        {recording ? (
          <>
            <button
              type="button"
              class="composer-cancel"
              aria-label={STR.cancelRecording}
              onClick={voice.cancel}
            >
              <TrashIcon />
            </button>
            <div class="composer-recording">
              <span class="composer-rec-dot" aria-hidden="true" />
              <span class="composer-rec-time" aria-hidden="true">
                {formatDuration(voice.elapsedMs)}
              </span>
              <span class="composer-rec-hint">{STR.recording}</span>
            </div>
          </>
        ) : (
          <div class="composer-field">
            <textarea
              ref={areaRef}
              class="composer-input"
              rows={1}
              placeholder={STR.inputPlaceholder}
              aria-label={STR.inputLabel}
              enterkeyhint="send"
              value={text}
              onInput={(event) => setText(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
                  event.preventDefault();
                  submit();
                }
              }}
            />
            <button
              type="button"
              class="composer-attach"
              aria-label={STR.attach}
              disabled={props.disabled}
              onPointerDown={keepFocus}
              onClick={() => setMenuOpen(true)}
            >
              <PaperclipIcon />
            </button>
          </div>
        )}
        <button
          type="button"
          class={'composer-send composer-send--' + mode}
          aria-label={sendLabel}
          disabled={sendDisabled}
          onPointerDown={mode === 'text' && !recording ? keepFocus : undefined}
          onClick={onPrimary}
        >
          {mode === 'mic' ? <MicIcon /> : <SendIcon />}
        </button>
        <input ref={fileRef} type="file" accept={FILE_ACCEPT} hidden onChange={onFilePicked} />
      </div>
      {menuOpen && <AttachMenu onPick={pickWith} onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
