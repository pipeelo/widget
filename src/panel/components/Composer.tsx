import { useEffect, useRef, useState } from 'preact/hooks';
import type { MediaField } from '../api/types';
import { classifyFile, FILE_ACCEPT } from '../lib/files';
import { STR } from '../lib/strings';

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

export function Composer(props: {
  onSendText(text: string): void;
  onSendFile(field: MediaField, file: File): void;
  /** Incrementado pelo App quando o painel abre — foca o campo (só desktop). */
  focusToken: number;
}) {
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorTimerRef = useRef<number | undefined>(undefined);

  // Autofocus só onde não abre teclado virtual por cima da conversa.
  useEffect(() => {
    if (
      props.focusToken > 0 &&
      window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) {
      areaRef.current?.focus();
    }
  }, [props.focusToken]);

  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    // O cap vem do CSS (--pip-input-maxh via max-height) — muda com a
    // densidade mobile; o getComputedStyle é barato perto do reflow que o
    // scrollHeight abaixo já força.
    const cap = parseFloat(getComputedStyle(el).maxHeight) || 100;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, cap) + 'px';
  }, [text]);

  useEffect(() => () => window.clearTimeout(errorTimerRef.current), []);

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    props.onSendText(value);
    setText('');
    areaRef.current?.focus();
  };

  const showError = (message: string) => {
    setFileError(message);
    window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => setFileError(null), 5000);
  };

  const onFilePicked = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const result = classifyFile(file);
    if (!result.ok) {
      showError(result.error);
      return;
    }
    props.onSendFile(result.field, file);
  };

  return (
    <div class="composer">
      {fileError && (
        <div class="composer-error" role="alert">
          <span>{fileError}</span>
          <button type="button" aria-label="Fechar aviso" onClick={() => setFileError(null)}>
            ×
          </button>
        </div>
      )}
      <div class="composer-bar">
        <button
          type="button"
          class="composer-attach"
          aria-label={STR.attach}
          onClick={() => fileRef.current?.click()}
        >
          <PaperclipIcon />
        </button>
        <textarea
          ref={areaRef}
          class="composer-input"
          rows={1}
          placeholder={STR.inputPlaceholder}
          aria-label={STR.inputPlaceholder}
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
          class="composer-send"
          aria-label={STR.send}
          disabled={!text.trim()}
          onClick={submit}
        >
          <SendIcon />
        </button>
        <input ref={fileRef} type="file" accept={FILE_ACCEPT} hidden onChange={onFilePicked} />
      </div>
    </div>
  );
}
