import { MOBILE_MEDIA } from './styles';

export interface FrameController {
  exists(): boolean;
  element(): HTMLIFrameElement | null;
  create(params: {
    id: string;
    eid: string;
    lastread: string | null;
    mode?: string | null;
  }): void;
  setOpen(open: boolean): void;
  setBackground(color: string): void;
  startViewportTracking(force?: boolean): void;
  stopViewportTracking(): void;
  destroy(): void;
}

export function createFrameController(panelBase: string, opts: { title: string }): FrameController {
  let iframe: HTMLIFrameElement | null = null;
  let stopTracking: (() => void) | null = null;
  let background: string | null = null;

  return {
    exists: () => iframe !== null,
    element: () => iframe,

    create(params) {
      if (iframe) return;
      let hash =
        '#id=' + encodeURIComponent(params.id) + '&eid=' + encodeURIComponent(params.eid);
      if (params.lastread) hash += '&lastread=' + encodeURIComponent(params.lastread);
      if (params.mode === 'fullscreen') hash += '&mode=fullscreen';

      iframe = document.createElement('iframe');
      iframe.className = 'pipeelo-frame';
      iframe.title = opts.title;
      iframe.allow = 'autoplay; clipboard-write';
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

      iframe.style.transition = 'opacity .2s ease';

      let lastTop = '';
      let lastHeight = '';
      const apply = () => {
        if (!iframe) return;
        const keyboard = window.innerHeight - vv.height > 80 || vv.offsetTop > 1;
        const top = keyboard ? vv.offsetTop + 'px' : '';
        const height = keyboard ? vv.height + 'px' : '';
        if (top === lastTop && height === lastHeight) return;
        lastTop = top;
        lastHeight = height;
        iframe.style.top = top;
        iframe.style.height = height;
        iframe.style.bottom = keyboard ? 'auto' : '';
      };

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
      window.addEventListener('resize', kick);
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
