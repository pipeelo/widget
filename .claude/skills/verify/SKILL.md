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
   fake em `/v1/website-channel/{config,history,message}/:id` (`/conversations`
   NÃO é chamada pelo painel — responder 410 pega regressão). Config decidida
   pelo id: contém "float" → floating, senão fullscreen; contém "dark" → theme
   dark; contém "prechat" → `pre_chat_form: {fields:['name','email']}`.
   `/history` é a fonte do landing e do gate do pré-chat: linha do tempo
   inteira (sem `chat_id`), DESC, com `per_page`/`cursor` de verdade (várias
   páginas) e o bloco `chats` (`chat_id`, `protocol`, `started_at`, `ended_at`)
   dos atendimentos presentes na página. Fixture útil: 2 atendimentos
   encerrados + 1 aberto com ~40 mensagens (página 1 cabe inteira no aberto);
   variantes por id — "short" (aberto curto: página 1 já cruza os antigos),
   "closed" (nada aberto), "empty" (visitante novo), "silentclose" (o POST
   responde `chat_id` novo sem evento). POST message → `201 {message_id,
   chat_id}` — `chat_id` novo quando o último atendimento está encerrado — e
   guardar as mensagens por `id|external_id` para o refetch mostrá-las. Expor
   `GET /__log` com TODAS as requests da API (kind, query, body: prova o mínimo
   de requests e o bloco `user`) e `POST /__reset`. Página host aceita
   `?setuser=full|partial|bademail` para injetar `Pipeelo('setUser', …)` no
   snippet. Registrar as rotas da API ANTES do estático (ambos sob `/v1/`).
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
  após enviar (keepFocus) e a bolha `.msg-row--mine` aparecer. Com a textarea
  vazia o botão principal é o **mic** (`aria-label="Gravar áudio"`) — só vira
  "Enviar mensagem" com texto; re-consultar o botão depois de enviar acha o mic.
- **Áudio**: Chrome com `--use-fake-device-for-media-stream
  --use-fake-ui-for-media-stream` (o device fake emite um tom real). Mic →
  `.composer-recording` com timer andando e altura do composer igual à de
  antes; enviar → `POST …/message` 201 (multipart `audio`) e balão
  `.msg-row--mine .msg-audio`; lixeira cancela; fechar o painel gravando
  cancela e para as trilhas; `Browser.setPermission microphone=denied` (sem o
  flag de fake UI) → toast "Permita o acesso ao microfone…"; `MediaRecorder`
  indefinido → botão enviar clássico. Embed same-origin NÃO prova o
  `allow="microphone"` do loader (filho same-origin já herda) — para provar,
  host em `localhost` e loader em `127.0.0.1` (`?loader=`).
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
- **Pré-chat** (id com "prechat", visitante novo): form no lugar do composer
  com só os campos exigidos que faltam; submit vazio/email inválido → erros
  inline; submit válido → thread + welcome e o POST seguinte leva o bloco
  `user` (conferir no `/__log`). `setuser=full` → sem form; `setuser=partial`
  → form só com o que falta; `setuser=bademail` → form pede o e-mail (inválido
  não cobre); `Pipeelo('setUser', …)` completo COM o form aberto → dispensa
  sozinho; aba nova (token persistido, conversa existente) → sem form.
- **Segurança do gate vs. regressão de prod** (atrasar só `/history` no
  server fake dá o teste determinístico): canal COM política → composer
  segurado (envio+anexo `disabled`) durante o boot, até o form assumir; canal
  SEM política → composer liberado assim que a config chega, ANTES do
  histórico — canal sem pré-chat não pode pagar nada pelo gate.
- **Histórico contínuo**: boot com chat aberto longo → 30 `.msg-row`, sem
  `.older-chip`, `/__log` = config + history (nunca conversations);
  `messages.scrollTop = 0` → 1 history com `cursor`, chat aberto completo
  visível, `.older-chip` aparece e o passado fica escondido (sem
  `.closed-notice`); novo scroll ao topo NÃO busca; clique no chip → revela
  sem request, `.closed-notice` por atendimento encerrado (data + protocolo)
  fechando o bloco ANTES do `.day-label` seguinte, `.msg-option` `disabled`
  fora do aberto; posição de scroll preservada na prepend (medir o `top` de um
  balão no MESMO eval que zera o `scrollTop`, antes da página chegar) e peek
  de meia tela no reveal. Id "closed" → welcome + chip; enviar abre chat novo
  sem refetch e o balão fica visível. "silentclose" → etiqueta imediata +
  exatamente 1 refetch, com o protocolo do servidor na etiqueta.
- **Boot frio com rede lenta** (latência percebida): perfil novo +
  `localStorage.clear()` + `Network.setCacheDisabled` +
  `Network.emulateNetworkConditions` (150ms/750kbps). Tap na bolha →
  `.pipeelo-on` + fundo opaco em <800ms, casca `#boot` visível no
  `contentDocument` antes do bundle, composer interativo ~1s, `#boot`
  removido após o render, chunk `socket-*` chegando DEPOIS do composer.

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
