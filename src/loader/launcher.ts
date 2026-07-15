// Bolha flutuante na página host: botão + badge de não-lidas.
// SVGs são literais constantes do bundle (único innerHTML permitido).

const ICON_CHAT =
  '<svg class="pipeelo-ic pipeelo-ic-chat" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path fill="currentColor" d="M12 3.6c-5 0-9 3.36-9 7.5 0 2.12 1.05 4.03 2.75 5.4.1 1-.3 2.12-1.23 3.12-.26.28-.06.73.32.7 1.9-.16 3.4-.9 4.4-1.7.87.25 1.8.38 2.76.38 5 0 9-3.35 9-7.5s-4-7.9-9-7.9Zm-4.2 8.9a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.2 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Zm4.2 0a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z"/></svg>';

const ICON_CLOSE =
  '<svg class="pipeelo-ic pipeelo-ic-close" viewBox="0 0 24 24" aria-hidden="true">' +
  '<path d="m6.5 9.75 5.5 5.5 5.5-5.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export interface Launcher {
  mount(): void;
  remove(): void;
  setOpen(open: boolean): void;
  setBadge(count: number): void;
  setAppearance(background: string, foreground: string, useBrandGradient: boolean): void;
}

export function createLauncher(handlers: {
  onToggle(): void;
  /** Intenção de abrir (hover/toque na bolha) — chega antes do click. */
  onIntent?(): void;
}): Launcher {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'pipeelo-launcher';
  button.innerHTML = ICON_CHAT + ICON_CLOSE;

  const badge = document.createElement('span');
  badge.className = 'pipeelo-badge';
  badge.hidden = true;
  button.appendChild(badge);

  let unread = 0;
  let open = false;

  function refreshLabel(): void {
    if (open) {
      button.setAttribute('aria-label', 'Fechar chat');
    } else if (unread > 0) {
      button.setAttribute(
        'aria-label',
        `Abrir chat, ${unread} ${unread === 1 ? 'mensagem não lida' : 'mensagens não lidas'}`
      );
    } else {
      button.setAttribute('aria-label', 'Abrir chat');
    }
  }

  button.setAttribute('aria-expanded', 'false');
  refreshLabel();
  button.addEventListener('click', () => handlers.onToggle());
  if (handlers.onIntent) {
    const intent = () => handlers.onIntent!();
    // mouseenter aquece no hover (desktop); pointerdown chega ~100ms antes
    // do click no toque. Idempotente do outro lado.
    button.addEventListener('mouseenter', intent, { passive: true });
    button.addEventListener('pointerdown', intent, { passive: true });
  }

  return {
    mount() {
      document.body.appendChild(button);
    },
    remove() {
      button.remove();
    },
    setOpen(value) {
      open = value;
      button.classList.toggle('pipeelo-on', value);
      button.setAttribute('aria-expanded', String(value));
      refreshLabel();
    },
    setBadge(count) {
      unread = count;
      if (count > 0) {
        badge.hidden = false;
        badge.textContent = count > 9 ? '9+' : String(count);
      } else {
        badge.hidden = true;
        badge.textContent = '';
      }
      refreshLabel();
    },
    setAppearance(background, foreground, useBrandGradient) {
      button.style.background = useBrandGradient
        ? 'linear-gradient(135deg,#01d5ac,#00b792)'
        : background;
      button.style.color = foreground;
    },
  };
}
