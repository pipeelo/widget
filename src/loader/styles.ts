// Todo o CSS do lado host como string (o build lib não emite .css). Regras:
// prefixo pipeelo- em tudo, só system-ui (nenhuma fonte injetada no site do
// cliente) e propriedades explícitas em cada elemento — defesa razoável
// contra CSS agressivo do host (um !important do host ainda vence; aceito,
// como em toda a indústria).

const Z = 2147483000; // topo do range de 32 bits, padrão dos messengers

// Tratamento mobile (chat cobre a tela): celular em pé OU qualquer viewport
// baixa (celular deitado — o painel flutuante de 400px ficaria com o composer
// inteiro debaixo do teclado). Compartilhada entre o CSS e os gates de JS
// (trava de scroll, espelhamento do teclado) para nunca divergirem.
export const MOBILE_MEDIA = '(max-width: 640px), (max-height: 500px)';

// Sobre a pipeelo-lock (classe posta por JS com o chat cobrindo a tela):
// overflow:hidden não segura o iOS — ao focar o composer, o Safari rola a
// página do host por baixo do chat (scroll-into-view + rubber-band) e o site
// aparece atrás. body position:fixed torna o documento não-rolável de
// verdade; o único caminho que sobra para o teclado é deslocar a visual
// viewport, que o frame.ts espelha no iframe. O index.ts guarda/restaura o
// scroll ao travar/destravar.

export const LOADER_CSS = `
.pipeelo-launcher{position:fixed;z-index:${Z};right:20px;bottom:20px;width:52px;height:52px;margin:0;padding:0;border:0;border-radius:50%;background:linear-gradient(135deg,#01d5ac,#00b792);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.16),0 4px 20px rgba(1,213,172,.3);cursor:pointer;display:flex;align-items:center;justify-content:center;box-sizing:border-box;line-height:1;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;-webkit-tap-highlight-color:transparent;touch-action:manipulation;transition:transform .16s ease,box-shadow .16s ease;letter-spacing:normal;text-transform:none}
.pipeelo-launcher:hover{transform:scale(1.06);box-shadow:0 4px 12px rgba(0,0,0,.2),0 6px 24px rgba(1,213,172,.35)}
.pipeelo-launcher:active{transform:scale(.96)}
.pipeelo-launcher:focus-visible{outline:2px solid currentColor;outline-offset:3px}
.pipeelo-ic{position:absolute;top:50%;left:50%;margin:-13px 0 0 -13px;width:26px;height:26px;transition:opacity .2s ease,transform .2s ease;pointer-events:none}
.pipeelo-ic-close{opacity:0;transform:rotate(-30deg)}
.pipeelo-launcher.pipeelo-on .pipeelo-ic-chat{opacity:0;transform:rotate(30deg)}
.pipeelo-launcher.pipeelo-on .pipeelo-ic-close{opacity:1;transform:rotate(0deg)}
.pipeelo-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#dc3545;color:#fff;font:600 11px/18px system-ui,-apple-system,sans-serif;text-align:center;box-sizing:border-box;box-shadow:0 1px 4px rgba(0,0,0,.25);letter-spacing:normal}
.pipeelo-badge[hidden]{display:none}

.pipeelo-frame{position:fixed;z-index:${Z - 1};right:20px;bottom:84px;width:400px;max-width:calc(100vw - 40px);height:calc(100vh - 104px);max-height:704px;margin:0;padding:0;border:0;border-radius:16px;box-shadow:0 5px 40px rgba(0,0,0,.16);background:#fff;opacity:0;transform:translateY(12px) scale(.96);transform-origin:bottom right;visibility:hidden;pointer-events:none;transition:opacity .2s ease,transform .25s cubic-bezier(.21,1.02,.55,1.01),visibility 0s linear .25s}
@supports (height:100dvh){.pipeelo-frame{height:calc(100dvh - 104px)}}
.pipeelo-frame.pipeelo-on{opacity:1;transform:none;visibility:visible;pointer-events:auto;transition:opacity .2s ease,transform .25s cubic-bezier(.21,1.02,.55,1.01)}

/* Canal em tela cheia (display_mode): o frame é a viewport inteira — mesmo
   layout da media query mobile, agora incondicional por classe no <html>. */
html.pipeelo-fullscreen .pipeelo-frame{inset:0;width:100%;height:100%;max-width:none;max-height:none;border-radius:0;transform:none}
html.pipeelo-fullscreen,html.pipeelo-fullscreen body{overflow:hidden!important}

.pipeelo-teaser{position:fixed;z-index:${Z - 2};right:20px;bottom:84px;width:min(320px,calc(100vw - 40px));margin:0;padding:0;box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;opacity:0;transform:translateY(8px);transition:opacity .25s ease,transform .25s ease}
.pipeelo-teaser.pipeelo-in{opacity:1;transform:none}
.pipeelo-teaser-card{display:block;width:100%;margin:0;padding:14px 40px 14px 16px;border:1px solid #eef1f4;border-radius:14px;background:#fff;color:#2d3748;box-shadow:0 8px 28px rgba(0,0,0,.12);cursor:pointer;text-align:left;box-sizing:border-box;font-family:inherit;letter-spacing:normal;text-transform:none;touch-action:manipulation;transition:transform .16s ease,box-shadow .16s ease}
.pipeelo-teaser-card:hover{transform:translateY(-1px);box-shadow:0 10px 32px rgba(0,0,0,.16)}
.pipeelo-teaser-name{display:block;margin:0 0 4px;font-size:13px;font-weight:600;color:#00b792;line-height:1.3}
.pipeelo-teaser-text{display:block;margin:0;font-size:13.5px;font-weight:400;line-height:1.45;color:#2d3748;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.pipeelo-teaser-x{position:absolute;top:6px;right:6px;width:26px;height:26px;margin:0;padding:0;border:0;border-radius:50%;background:transparent;color:#97a4b5;cursor:pointer;display:flex;align-items:center;justify-content:center;font-family:inherit;line-height:1;touch-action:manipulation}
.pipeelo-teaser-x:hover{background:#f2f4f7;color:#67748e}
.pipeelo-teaser--dark .pipeelo-teaser-card{background:#2b2b2b;border-color:#4a4a4a;color:#d4d4d4}
.pipeelo-teaser--dark .pipeelo-teaser-text{color:#d4d4d4}
.pipeelo-teaser--dark .pipeelo-teaser-name{color:#01d5ac}
.pipeelo-teaser--dark .pipeelo-teaser-x{color:#9e9e9e}
.pipeelo-teaser--dark .pipeelo-teaser-x:hover{background:#3a3a3a;color:#d4d4d4}

@media ${MOBILE_MEDIA}{
  .pipeelo-frame{top:0;left:0;right:0;bottom:0;width:100%;height:100%;max-width:none;max-height:none;border-radius:0}
  html.pipeelo-open .pipeelo-launcher{display:none}
  html.pipeelo-open,html.pipeelo-open body{overflow:hidden!important}
}

html.pipeelo-lock,html.pipeelo-lock body{overflow:hidden!important;overscroll-behavior:none}
html.pipeelo-lock body{position:fixed!important;left:0!important;right:0!important;width:100%!important}
@media (prefers-reduced-motion:reduce){
  .pipeelo-launcher,.pipeelo-launcher:hover,.pipeelo-ic,.pipeelo-teaser,.pipeelo-teaser-card{transition:none}
  .pipeelo-launcher:hover,.pipeelo-launcher:active{transform:none}
  .pipeelo-frame{transition:opacity .15s linear,visibility 0s linear .15s;transform:none}
  .pipeelo-frame.pipeelo-on{transition:opacity .15s linear;transform:none}
}
`;

export function injectStyles(): void {
  const style = document.createElement('style');
  style.setAttribute('data-pipeelo', 'widget');
  style.textContent = LOADER_CSS;
  document.head.appendChild(style);
}
