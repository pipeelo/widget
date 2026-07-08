import { STR } from '../lib/strings';

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
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

export function Header(props: {
  name: string;
  /** Sem widget_color configurada: usa o gradiente da marca Pipeelo. */
  brandGradient: boolean;
  loading: boolean;
  onClose(): void;
}) {
  const initial = (props.name.trim().charAt(0) || 'P').toUpperCase();
  return (
    <header class={'header' + (props.brandGradient ? ' header--brand' : '')}>
      <span class="header-avatar" aria-hidden="true">
        {initial}
      </span>
      <div class="header-meta">
        {props.loading ? (
          <span class="header-name-skeleton" aria-hidden="true" />
        ) : (
          <span class="header-name">{props.name}</span>
        )}
        <span class="header-sub">{STR.headerSubtitle}</span>
      </div>
      <button type="button" class="header-close" aria-label={STR.close} onClick={props.onClose}>
        <ChevronIcon />
      </button>
    </header>
  );
}
