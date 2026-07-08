// Iframe do painel. Criado sob demanda (1º open) ou escondido no boot quando
// já existe token (socket vivo para o badge). Escondido via CSS
// (opacity/visibility), nunca display:none nem remoção — o painel continua
// rodando com o socket aberto.

export interface FrameController {
  exists(): boolean;
  element(): HTMLIFrameElement | null;
  create(params: { id: string; eid: string; lastread: string | null }): void;
  setOpen(open: boolean): void;
  /** Teclado do iOS: espelha o visualViewport no iframe enquanto aberto no mobile. */
  startViewportTracking(): void;
  stopViewportTracking(): void;
  destroy(): void;
}

export function createFrameController(panelBase: string, opts: { title: string }): FrameController {
  let iframe: HTMLIFrameElement | null = null;
  let stopTracking: (() => void) | null = null;

  return {
    exists: () => iframe !== null,
    element: () => iframe,

    create(params) {
      if (iframe) return;
      // Fragment: não entra em nenhum request nem em Referer.
      let hash =
        '#id=' + encodeURIComponent(params.id) + '&eid=' + encodeURIComponent(params.eid);
      if (params.lastread) hash += '&lastread=' + encodeURIComponent(params.lastread);

      iframe = document.createElement('iframe');
      iframe.className = 'pipeelo-frame';
      iframe.title = opts.title;
      iframe.setAttribute('aria-hidden', 'true');
      iframe.src = panelBase + hash;
      document.body.appendChild(iframe);
    },

    setOpen(open) {
      if (!iframe) return;
      iframe.classList.toggle('pipeelo-on', open);
      iframe.setAttribute('aria-hidden', String(!open));
    },

    startViewportTracking() {
      const vv = window.visualViewport;
      if (!vv || !iframe || stopTracking) return;
      if (!window.matchMedia('(max-width: 640px)').matches) return;

      let raf = 0;
      const apply = () => {
        raf = 0;
        if (!iframe) return;
        iframe.style.height = vv.height + 'px';
        iframe.style.transform = 'translateY(' + vv.offsetTop + 'px)';
      };
      const onChange = () => {
        if (!raf) raf = requestAnimationFrame(apply);
      };
      vv.addEventListener('resize', onChange);
      vv.addEventListener('scroll', onChange);
      onChange();

      stopTracking = () => {
        vv.removeEventListener('resize', onChange);
        vv.removeEventListener('scroll', onChange);
        if (raf) cancelAnimationFrame(raf);
        if (iframe) {
          iframe.style.height = '';
          iframe.style.transform = '';
        }
      };
    },

    stopViewportTracking() {
      if (stopTracking) {
        stopTracking();
        stopTracking = null;
      }
    },

    destroy() {
      this.stopViewportTracking();
      if (iframe) {
        iframe.remove();
        iframe = null;
      }
    },
  };
}
