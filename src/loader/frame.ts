// Iframe do painel. Criado sob demanda (1º open) ou escondido no boot quando
// já existe token (socket vivo para o badge). Escondido via CSS
// (opacity/visibility), nunca display:none nem remoção — o painel continua
// rodando com o socket aberto.

import { MOBILE_MEDIA } from './styles';

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
   * Fundo opaco do iframe (o painel demora a pintar no boot frio — sem isso
   * o open não muda nada na tela e parece que o toque falhou). Tema da
   * config decide claro/escuro.
   */
  setBackground(color: string): void;
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
  let background: string | null = null; // config pode chegar antes do create

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
      if (background) iframe.style.background = background;
      iframe.src = panelBase + hash;
      document.body.appendChild(iframe);
    },

    setOpen(open) {
      if (!iframe) return;
      iframe.classList.toggle('pipeelo-on', open);
      iframe.setAttribute('aria-hidden', String(!open));
    },

    setBackground(color) {
      background = color;
      if (iframe) iframe.style.background = color;
    },

    startViewportTracking(force?: boolean) {
      const vv = window.visualViewport;
      if (!vv || !iframe || stopTracking) return;
      if (!force && !window.matchMedia(MOBILE_MEDIA).matches) return;

      // Enquanto o tracking está ativo, só a opacidade transiciona: a
      // transição de transform do CSS (entrada/saída) faria o espelhamento
      // "correr atrás" de cada evento com 250ms de easing, com o site
      // aparecendo atrás durante a perseguição. stopTracking devolve a folha
      // de estilo.
      iframe.style.transition = 'opacity .2s ease';

      // O deslocamento compensa com top/height, NUNCA transform: iframe
      // transformado tem hit-testing de toque quebrado no iOS (tap cai
      // deslocado do que o dedo apontou — X que "não fecha", textarea que
      // não foca de primeira).
      let lastTop = '';
      let lastHeight = '';
      const apply = () => {
        if (!iframe) return;
        // Teclado aberto = viewport visual bem menor que a layout (iOS e
        // Android resizes-visual) ou deslocada. Sem teclado, LIMPA os inline
        // e o CSS (height:100%) manda — assim um height antigo nunca fica
        // preso e, no Android com resizes-content, o layout já encolhido não
        // é compensado duas vezes.
        const keyboard = window.innerHeight - vv.height > 80 || vv.offsetTop > 1;
        const top = keyboard ? vv.offsetTop + 'px' : '';
        const height = keyboard ? vv.height + 'px' : '';
        if (top === lastTop && height === lastHeight) return;
        lastTop = top;
        lastHeight = height;
        iframe.style.top = top;
        iframe.style.height = height;
        // top+height mandam; bottom:auto evita o layout sobre-restringido
        iframe.style.bottom = keyboard ? 'auto' : '';
      };

      // O iOS anima o teclado nativamente e avisa pouco (às vezes um único
      // resize já no fim, com rAF estrangulado durante a animação): cada
      // evento aplica na hora E abre uma janela de settle em que o apply
      // roda por frame — acompanha a animação sem depender de evento e
      // garante que o estado final nunca fica stale.
      let raf = 0;
      let settleUntil = 0;
      const tick = () => {
        apply();
        raf = performance.now() < settleUntil ? requestAnimationFrame(tick) : 0;
      };
      const kick = () => {
        settleUntil = performance.now() + 600;
        apply();
        if (!raf) raf = requestAnimationFrame(tick);
      };
      vv.addEventListener('resize', kick);
      vv.addEventListener('scroll', kick);
      window.addEventListener('resize', kick); // rotação; resizes-content
      kick();

      stopTracking = () => {
        vv.removeEventListener('resize', kick);
        vv.removeEventListener('scroll', kick);
        window.removeEventListener('resize', kick);
        if (raf) cancelAnimationFrame(raf);
        if (iframe) {
          iframe.style.top = '';
          iframe.style.height = '';
          iframe.style.bottom = '';
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
