import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { STR } from '../lib/strings';
import { useEscape } from '../state/useEscape';
import { CloseIcon } from './icons';

export function Sheet(props: { title: string; onClose(): void; children: ComponentChildren }) {
  const rowsRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(props.onClose);
  closeRef.current = props.onClose;

  useEscape(() => closeRef.current());

  useEffect(() => {
    rowsRef.current?.querySelector('button')?.focus();
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
            <CloseIcon size={16} />
          </button>
        </div>
        <div class="sheet-rows" ref={rowsRef}>
          {props.children}
        </div>
      </div>
    </div>
  );
}
