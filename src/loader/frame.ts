// Iframe do painel. Criado sob demanda (1º open) ou escondido no boot quando
// já existe token (socket vivo para o badge). Escondido via CSS
// (opacity/visibility), nunca display:none nem remoção — o painel continua
// rodando com o socket aberto.

export interface FrameController {
  exists(): boolean;
  element(): HTMLIFrameElement | null;
  create(params: {
    id: string;
    eid: string;
    lastread: string | null;
    /** display_mode já conhecido — o painel aplica a densidade antes do 1º paint. */
    mode?: string | null;
  }): void;
  setOpen(open: boolean): void;
  /**
   * Teclado do iOS: espelha o visualViewport no iframe enquanto aberto no
   * mobile. `force` (tela cheia) ignora o gate de largura — tablet também.
   */
  startViewportTracking(force?: boolean): void;
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
      if (params.mode === 'fullscreen') hash += '&mode=fullscreen';

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

    startViewportTracking(force?: boolean) {
      const vv = window.visualViewport;
      if (!vv || !iframe || stopTracking) return;
      if (!force && !window.matchMedia('(max-width: 640px)').matches) return;

      // A transição de transform do CSS (entrada/saída do painel) faria o
      // espelhamento do teclado "correr atrás" de cada evento com 250ms de
      // easing — sensação de travado, com o site aparecendo atrás durante a
      // perseguição. Enquanto o tracking está ativo, só a opacidade
      // transiciona; stopTracking devolve a folha de estilo.
      iframe.style.transition = 'opacity .2s ease';

      let raf = 0;
      const apply = () => {
        raf = 0;
        if (!iframe) return;
        // Teclado aberto = viewport visual bem menor que a layout (iOS e
        // Android resizes-visual) ou deslocada. Sem teclado, LIMPA os inline
        // e o CSS (height:100%) manda — assim um height antigo nunca fica
        // preso (evento/rAF engolido em animação nativa do iOS se auto-cura
        // no próximo evento) e, no Android com resizes-content, o layout já
        // encolhido não é compensado duas vezes.
        const keyboard = window.innerHeight - vv.height > 80 || vv.offsetTop > 1;
        if (keyboard) {
          iframe.style.height = vv.height + 'px';
          iframe.style.transform = 'translateY(' + vv.offsetTop + 'px)';
        } else {
          iframe.style.height = '';
          iframe.style.transform = '';
        }
      };
      const onChange = () => {
        // cancel+reschedule: um rAF perdido não pode travar o gate p/ sempre.
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(apply);
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
          iframe.style.transition = '';
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
