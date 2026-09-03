import { useState } from 'preact/hooks';
import type { ApiItem } from '../api/types';
import { STR } from '../lib/strings';
import { Sheet } from './Sheet';

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

export function InteractiveOptions(props: {
  items: ApiItem[];
  selectedValue: string | null;
  onSelect?(item: ApiItem): void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

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
        <Sheet title={STR.viewOptions} onClose={() => setSheetOpen(false)}>
          {props.items.map((item) => (
            <button key={item.value} type="button" class="sheet-row" onClick={() => pick(item)}>
              <span class="sheet-row-title">{item.title}</span>
              {item.description && <span class="sheet-row-desc">{item.description}</span>}
            </button>
          ))}
        </Sheet>
      )}
    </div>
  );
}
