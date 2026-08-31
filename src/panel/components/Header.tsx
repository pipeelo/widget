import { useRef } from 'preact/hooks';
import { STR } from '../lib/strings';

function ChevronIcon() {
  return (
    <svg
      class="header-close-chevron"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <path
        d="m6 9.5 6 6 6-6"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg class="header-close-x" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M6 6l12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M14.5 6 8.5 12l6 6"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function usePointerAction(action: () => void) {
  const firedAtRef = useRef(0);
  return {
    onPointerDown: (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.preventDefault();
      firedAtRef.current = Date.now();
      action();
    },
    onClick: () => {
      if (Date.now() - firedAtRef.current > 500) action();
    },
  };
}

export function Header(props: {
  name: string;
  brandGradient: boolean;
  loading: boolean;
  showClose: boolean;
  onBack?: () => void;
  onClose(): void;
}) {
  const initial = (props.name.trim().charAt(0) || 'P').toUpperCase();
  const closeAction = usePointerAction(props.onClose);
  const backAction = usePointerAction(props.onBack ?? (() => {}));

  return (
    <header class={'header' + (props.brandGradient ? ' header--brand' : '')}>
      {props.onBack && (
        <button type="button" class="header-back" aria-label={STR.back} {...backAction}>
          <BackIcon />
        </button>
      )}
      <span class="header-avatar" aria-hidden="true">
        {initial}
      </span>
      <div class="header-meta">
        {props.loading ? (
          <span class="header-name-skeleton" aria-hidden="true" />
        ) : (
          <span class="header-name">{props.name}</span>
        )}
      </div>
      {props.showClose && (
        <button type="button" class="header-close" aria-label={STR.close} {...closeAction}>
          <ChevronIcon />
          <CloseIcon />
        </button>
      )}
    </header>
  );
}
