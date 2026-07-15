import { STR } from '../lib/strings';

// Dois ícones no mesmo botão, alternados por CSS conforme a densidade: no
// desktop flutuante o chevron "minimiza" o painel de volta para a bolinha no
// canto; na densidade mobile o painel cobre a tela e não há bolinha à vista —
// um X comunica melhor "fechar e voltar ao site". (Fullscreen não renderiza o
// botão: showClose=false.)
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

export function Header(props: {
  name: string;
  /** Sem widget_color configurada: usa o gradiente da marca Pipeelo. */
  brandGradient: boolean;
  loading: boolean;
  /** Fullscreen: sem o chevron de fechar (o chat é a página). */
  showClose: boolean;
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
      </div>
      {props.showClose && (
        <button type="button" class="header-close" aria-label={STR.close} onClick={props.onClose}>
          <ChevronIcon />
          <CloseIcon />
        </button>
      )}
    </header>
  );
}
