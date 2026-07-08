// Cartão teaser proativo (config.message_preview): aparece ao lado da bolha
// fechada, estilo greeting da Intercom. Clique abre o chat; o X dispensa —
// os dois persistem a dispensa via loader.

export interface Teaser {
  show(name: string, text: string, dark: boolean): void;
  /** Remove o cartão; `dismiss` persiste a dispensa via handler. */
  hide(dismiss: boolean): void;
}

export function createTeaser(handlers: { onOpen(): void; onDismiss(): void }): Teaser {
  let root: HTMLDivElement | null = null;

  function hide(dismiss: boolean): void {
    if (dismiss) handlers.onDismiss();
    if (!root) return;
    root.remove();
    root = null;
  }

  return {
    show(name, text, dark) {
      if (root) return;
      root = document.createElement('div');
      root.className = 'pipeelo-teaser' + (dark ? ' pipeelo-teaser--dark' : '');

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'pipeelo-teaser-card';
      card.setAttribute('aria-label', 'Abrir chat: ' + text);

      const title = document.createElement('strong');
      title.className = 'pipeelo-teaser-name';
      title.textContent = name;

      const body = document.createElement('span');
      body.className = 'pipeelo-teaser-text';
      body.textContent = text;

      card.appendChild(title);
      card.appendChild(body);
      card.addEventListener('click', () => handlers.onOpen());

      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'pipeelo-teaser-x';
      close.setAttribute('aria-label', 'Dispensar mensagem');
      close.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">' +
        '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
      close.addEventListener('click', () => hide(true));

      root.appendChild(card);
      root.appendChild(close);
      document.body.appendChild(root);
      requestAnimationFrame(() => root && root.classList.add('pipeelo-in'));
    },
    hide,
  };
}
