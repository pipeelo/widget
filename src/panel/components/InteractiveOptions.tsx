import { useEffect, useRef, useState } from 'preact/hooks';
import type { ApiItem } from '../api/types';
import { STR } from '../lib/strings';

const MAX_BUTTONS = 3;

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path
        d="M4 6h16M4 12h16M4 18h16"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  );
}

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

export function InteractiveOptions(props: {
  items: ApiItem[];
  selectedValue: string | null;
  onSelect?(item: ApiItem): void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const firstRowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sheetOpen) return;
    firstRowRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setSheetOpen(false);
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [sheetOpen]);

  if (props.selectedValue !== null) return null;

  const disabled = !props.onSelect;
  const pick = (item: ApiItem) => {
    setSheetOpen(false);
    props.onSelect?.(item);
  };

  if (props.items.length <= MAX_BUTTONS) {
    return (
      <div class="msg-options">
        {props.items.map((item) => (
          <button
            key={item.value}
            type="button"
            class="msg-option"
            disabled={disabled}
            onClick={() => pick(item)}
          >
            {item.title}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div class="msg-options">
      <button
        type="button"
        class="msg-option msg-option--menu"
        disabled={disabled}
        onClick={() => setSheetOpen(true)}
      >
        <MenuIcon />
        {STR.viewOptions}
      </button>
      {sheetOpen && (
        <div class="sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div
            class="sheet"
            role="dialog"
            aria-modal="true"
            aria-label={STR.viewOptions}
            onClick={(event) => event.stopPropagation()}
          >
            <div class="sheet-head">
              <span class="sheet-title">{STR.viewOptions}</span>
              <button
                type="button"
                class="sheet-close"
                aria-label={STR.closeOptions}
                onClick={() => setSheetOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div class="sheet-rows">
              {props.items.map((item, index) => (
                <button
                  key={item.value}
                  ref={index === 0 ? firstRowRef : undefined}
                  type="button"
                  class="sheet-row"
                  onClick={() => pick(item)}
                >
                  <span class="sheet-row-title">{item.title}</span>
                  {item.description && <span class="sheet-row-desc">{item.description}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
