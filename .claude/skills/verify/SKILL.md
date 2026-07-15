---
name: verify
description: Smoke E2E do widget num browser real — server same-origin com API fake + Chrome headless via CDP, emulação mobile/desktop, toque de verdade.
---

# Verificar o widget de ponta a ponta

Build/typecheck não exercita nada: o widget vive embutido numa página host,
com iframe, postMessage, media queries e toque. Verificar = abrir num Chrome
de verdade e dirigir por CDP.

## Receita (validada)

1. **Server same-origin** (Node ≥22, sem deps): serve `dist/` + página host
   fake com o snippet real (`<script async src="/v1/loader.js?id=…">`) + API
   fake em `/v1/website-channel/{config,history,message}/:id`. Config:
   `display_mode` decidido pelo id (contém "float" → float, senão fullscreen);
   `data: []` no history; POST message → `201 {message_id}`. Registrar as
   rotas da API ANTES do estático (ambos sob `/v1/`).
2. **Build apontando para o server**: `VITE_API_URL=http://127.0.0.1:<porta>/v1 npm run build`
   (a env vence o `.env.local`; `npm run build` puro restaura o build normal).
3. **Chrome headless**: `google-chrome --headless=new --no-sandbox --disable-gpu
   --no-first-run --user-data-dir=<tmp> --remote-debugging-port=9377
   --remote-allow-origins='*'` (sem `--remote-allow-origins` o WebSocket do
   Node leva 403).
4. **CDP cru** (Node tem `WebSocket` global): `PUT /json/new?url=about:blank`
   → conectar no `webSocketDebuggerUrl` → `Page.enable`, `Runtime.enable`,
   `Emulation.setDeviceMetricsOverride` (390×844 `mobile:true` p/ celular) +
   `Emulation.setTouchEmulationEnabled` (juntos ligam `pointer: coarse`) +
   `Emulation.setFocusEmulationEnabled` (senão focus não funciona em headless)
   → `Page.navigate`.
5. **Dirigir por toque**: `Input.dispatchTouchEvent` touchStart/touchEnd nas
   coordenadas do elemento (sintetiza pointerdown+click). O painel é
   same-origin no smoke → `iframe.contentDocument` acessível p/ rects e
   asserts. Texto: focar por toque + `Input.insertText`.
6. **Screenshots**: `Page.captureScreenshot` (dá pra Read como imagem).

Script de referência da última rodada: server + cenários (mobile portrait com
teclado simulado, landscape, desktop) ficaram no scratchpad da sessão — se
não existirem mais, reescrever seguindo os passos acima (~150 linhas).

## O que dirigir

- Abrir por toque na bolha (warm-up: iframe já deve existir no pointerdown).
- Trava de scroll: `html.pipeelo-lock`, body `position:fixed`,
  `body.style.top === '-<scrollY>px'`; no fechar, tudo restaurado e
  `scrollY` de volta.
- Focar textarea por toque, digitar, enviar — foco DEVE continuar no textarea
  após enviar (keepFocus) e a bolha `.msg-row--mine` aparecer.
- Fechar no X **com o campo focado** (caminho pointerdown) — e de novo com o
  "teclado" simulado aberto.
- **Teclado iOS simulado**: `Object.defineProperty(window,'visualViewport',
  {value: fake, configurable: true})` com `fake = new EventTarget()` +
  `height/offsetTop/…` ANTES de (re)abrir (o tracking captura o vv no open);
  disparar `new Event('resize')` → iframe deve espelhar `top/height` inline
  (`bottom:auto`, transform NUNCA) e limpar tudo quando o vv volta ao normal
  e no fechar.
- Landscape 844×390 → tela cheia + trava (`max-height:500px` na MOBILE_MEDIA).
- Desktop 1280×800 (mouse, `mobile:false`) → flutuante 400px, SEM trava,
  chevron fecha.

## Pegadinhas

- Medir tamanho do painel com `offsetWidth`, não `getBoundingClientRect()`
  (a entrada anima `scale(.96)` → rect dá 384 no meio da transição).
- Screenshot logo após abrir pode sair com o iframe "translúcido" — artefato
  do compositor headless no meio do fade; conferir `getComputedStyle(...).opacity`
  antes de acusar bug.
- `pkill -f`/`pgrep -f` com o padrão literal mata o PRÓPRIO shell (a linha de
  comando contém o padrão) — usar `pgrep -f 'serve[r]\.mjs'` (colchete).
- Cada cenário em aba nova (`/json/new`); localStorage persiste entre abas →
  cenários seguintes exercitam o boot de visitante recorrente (iframe já no
  load), o que é desejável.
- URLs de cenário do painel precisam de query param distinto — mudar só o
  fragment é navegação same-document e o painel não re-boota.
