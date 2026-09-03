import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { STR } from '../lib/strings';

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6L6 18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

export function Sheet(props: { title: string; onClose(): void; children: ComponentChildren }) {
  const rowsRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(props.onClose);
  closeRef.current = props.onClose;

  useEffect(() => {
    rowsRef.current?.querySelector('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <div class="sheet-backdrop" onClick={() => closeRef.current()}>
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={props.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div class="sheet-head">
          <span class="sheet-title">{props.title}</span>
          <button
            type="button"
            class="sheet-close"
            aria-label={STR.closeSheet}
            onClick={() => closeRef.current()}
          >
            <CloseIcon />
          </button>
        </div>
        <div class="sheet-rows" ref={rowsRef}>
          {props.children}
        </div>
      </div>
    </div>
  );
}
