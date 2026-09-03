# Widget Pipeelo — Canal do Site

Widget de chat embutível estilo Intercom Messenger: bolha flutuante + painel de conversa em iframe, pelo qual o visitante anônimo de um site conversa com a empresa (IA e atendentes) via pipeline real da Pipeelo. Contrato do projeto em [`widget.md`](./widget.md); contrato da API em `Projects/api/docs/website-channel.md`.

## Snippet (o que o cliente cola no site)

```html
<script>
  (function (w, d) {
    w.Pipeelo = w.Pipeelo || function () { (w.Pipeelo.q = w.Pipeelo.q || []).push(arguments) };
    var s = d.createElement('script'); s.async = true;
    s.src = 'https://widget.pipeelo.com/v1/loader.js?id={identifier}';
    d.head.appendChild(s);
  })(window, document);
</script>
```

`{identifier}` = uuid do registro `website_channels` (CRUD autenticado do dashboard). Comandos funcionam antes do script carregar (fila drenada pelo loader):

```js
Pipeelo('open');   // abre o painel
Pipeelo('close');  // fecha
Pipeelo('toggle'); // alterna
```

## Embed em app (tela cheia)

Canal com `display_mode: 'fullscreen'` na config: o chat **é** a página — o loader abre o painel no boot ocupando a viewport inteira, sem bolha, sem teaser e sem fechar (`Pipeelo('close')` vira no-op). Feito para WebView de app nativo (chat in-app). O painel aplica a **densidade mobile** (texto 16px, alvos de toque de 44–48px, safe areas de notch/home indicator) — a mesma usada em qualquer dispositivo de toque.

Página wrapper mínima que o app carrega na WebView:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" />
    <title>Chat</title>
  </head>
  <body>
    <script>
      (function (w, d) {
        w.Pipeelo = w.Pipeelo || function () { (w.Pipeelo.q = w.Pipeelo.q || []).push(arguments) };
        var s = d.createElement('script'); s.async = true;
        s.src = 'https://widget.pipeelo.com/v1/loader.js?id={identifier}';
        d.head.appendChild(s);
      })(window, document);
    </script>
  </body>
</html>
```

- **A `<meta viewport>` acima é obrigatória**: sem ela o iOS usa o viewport legado de 980px e tudo renderiza ~2.6× menor. O loader injeta essa meta como rede de segurança quando não existe nenhuma (nunca sobrescreve a do autor). `viewport-fit=cover` habilita as safe areas (`env(safe-area-inset-*)`); `interactive-widget=resizes-content` faz o teclado do Android redimensionar o layout (Chromium ≥ 108; o iOS ignora — lá o loader compensa via `visualViewport`).
- **iOS (WKWebView)**: `webView.scrollView.contentInsetAdjustmentBehavior = .never` (senão o sistema soma os insets duas vezes) e, para sensação nativa, `webView.scrollView.bounces = false`.
- **Android (WebView)**: activity edge-to-edge (padrão com target SDK 35+) e `android:windowSoftInputMode="adjustResize"` para o teclado.

## Anatomia

| Peça | Onde roda | Código | Artefato |
|---|---|---|---|
| **Loader** | página host do cliente | `src/loader/` (zero deps, < 7 kB gz — o build falha se estourar) | `dist/v1/loader.js` (nome fixo) |
| **Painel** | iframe `{origin}/v1/` | `src/panel/` (Preact + pusher-js) | `dist/v1/index.html` + assets hasheados |
| **Protocolo** | postMessage entre os dois | `src/shared/protocol.ts` | — |

O loader: cunha/guarda o **token de sessão** (uuid v4) no `localStorage` da página host (padrão da indústria — storage de iframe de terceiro é efêmero no Safari), renderiza a bolha, injeta o iframe (parâmetros via **fragment**, que não vaza em Referer), faz a ponte de abrir/fechar, badge de não-lidas e cartão teaser. O painel: config, histórico por cursor, socket Soketi (canal público `website-channel.{identifier}.{external_id}`, eventos `website-channel.message`, `.typing` e `.chat-closed`), envio otimista com reconciliação por `message_id` — e, enquanto o POST não respondeu, o item do servidor absorve o otimista gêmeo por conteúdo (dedupe do eco at-least-once, que chega antes da resposta sempre que o caminho de volta é lento) — e refetch do histórico na reconexão (histórico é a fonte de verdade).

Comportamentos-chave:

- **Nada é criado no servidor até a primeira mensagem** — o token só é cunhado no primeiro open.
- **Visitante recorrente** (token existente): o iframe nasce escondido no load para manter o socket vivo — badge funciona sem abrir o painel.
- **Não-lidas**: marco `lastread` persistido no host via loader; painel conta `from === 'company'` mais novas que o marco. Resposta que chega **ao vivo** (socket ou refetch de reconexão) com o painel fechado ou a aba escondida toca um som curto (WebAudio, no painel — exige que a página já tenha tido um gesto do visitante), prefixa `(N) ` no título da aba do host e mostra a prévia no teaser ao lado da bolha; o título espelha o badge e zera ao abrir o painel.
- **Digitando** (`website-channel.typing`, payload só `chat_id`): bolha com três pontos no fim do thread do chat ativo. O servidor emite com debounce de 5s (atendente via dashboard e IA no início da geração) e não existe evento de "parou" — o painel expira a exibição sozinho em 8s e a esconde na hora quando a resposta chega. Chat encerrado não mostra.
- **Botões e menu** (mensagens `type: interactive`, com `items[{title, value, description?}]`): até 3 itens viram botões empilhados sob o balão; 4 ou mais viram "Ver opções", que abre um sheet no rodapé do painel — toque na linha envia. A seleção sai como texto normal (`text` = título) com `selected_value` no `POST message`; o balão interativo vira chip ✓ na hora e o servidor carimba a interativa, que volta assim no histórico. Conversa encerrada desabilita as opções; mensagem sem `items` válidos degrada para texto.
- **PIX** (mensagens `type: order_details`): card dentro do balão com `product_name`, `value` (centavos, formatado em BRL) e o código copia-e-cola com "Copiar código" — Clipboard API (o loader injeta o iframe com `allow="clipboard-write; microphone"`) e fallback `execCommand`. QR code fica fora do escopo: quem quiser gera a partir do código.
- **Balões** (estilo WhatsApp, sem papel de parede): lista levemente tingida (`--pip-list-bg`), balão da empresa **branco** com sombra de 1px, o seu num **tom claro do accent** com texto escuro (no tema escuro, um tom escuro do accent com texto claro) — calculado em `src/panel/lib/bubble-color.ts` a partir do `widget_color`, com trava de luminância para accents pálidos e o mesmo auto-contraste do texto; a cor forte fica só no cabeçalho e nos botões. Sem avatar por mensagem (quem é já está no cabeçalho), rabinho no primeiro balão de cada sequência, horário **dentro** do balão — nos seus, com relógio enquanto envia e ✓ quando o servidor confirma — e chip de dia. Geometria toda em tokens (`--pip-bubble-*`, `--pip-tail-*`, `--pip-meta-h` em `styles.css`); o rabinho usa a mesma variável do fundo do balão, então tema escuro e `widget_color` seguem sozinhos. `--pip-bubble-company` é a superfície cinza (pílula do composer, chips de hover), não o balão.
- **Áudio** (`type: audio`): o botão principal do composer é o **microfone** enquanto não há texto e vira "enviar" ao digitar. Toque para gravar; a barra mostra o timer, a lixeira cancela e o botão envia (teto de 5 min: para e envia sozinho; menos de 0,7 s é descartado com aviso). `MediaRecorder` grava WebM/Opus (Chrome/Android) ou MP4/AAC (Safari) e o arquivo sobe direto no campo `audio` do multipart, sem passar por `classifyFile` (`src/panel/lib/voice.ts` + `src/panel/state/useVoiceRecorder.ts`). Exige contexto seguro e `allow="microphone"` no iframe (o loader injeta); sem suporte, o botão volta a ser o "enviar" clássico. Fechar o painel cancela a gravação e libera o microfone. Balões de áudio usam player próprio (`AudioMessage`): play/pause, seek e duração — WebM gravado no browser não traz duração e o player a resolve com um seek único; só um áudio toca por vez.
- **Anexos**: o clipe abre um sheet com **Câmera** (só em dispositivo de toque; foto JPEG/PNG), **Fotos e vídeos**, **Documento** e **Áudio**. Cada opção só define `accept`/`capture` do mesmo `<input type="file">`; tipos e limites continuam em `src/panel/lib/files.ts`, iguais aos do servidor (o `.mov` do iPhone não passa).
- **Config do canal** (`GET /v1/website-channel/config/{id}`): `name`, `widget_color` (accent com auto-contraste de texto por luminância), `welcome_message` (primeiro balão quando não há histórico) e — **leitor tolerante, campos em rollout no backend** — `theme` (`light` | `dark` | `auto`; ausente/null → light), `message_preview` (string; non-null → cartão teaser proativo ao lado da bolha fechada, dispensável e persistido; respostas ao vivo geram só badge), `display_mode` (`floating` | `fullscreen`; ausente → floating — ver "Embed em app"), `pre_chat_form` (`{fields:[...]}`; ausente/null → sem formulário — ver pré-chat abaixo) e `launcher_image` (URL de imagem quadrada que preenche a bolha fechada, recortada em círculo; ausente/null → ícone de balão; imagem que falha ao carregar cai no ícone).
- **Pré-chat** (spec em [`pre-chat.md`](./pre-chat.md)): com `pre_chat_form` na config, visitante de **primeira conversa** (lista de conversas vazia) cuja identidade não cobre os `fields` exigidos vê um formulário no lugar do chat; ao enviar, os valores viram identidade (mesmo caminho do `setUser`) e saem no bloco `user` de todo envio. `setUser` parcial → o form pede só o que falta; `setUser` completo (mesmo tardio, com o form aberto) dispensa o form; e-mail com formato inválido não conta como coberto (a API o descartaria). Só o caminho de primeira conversa espera a config no landing — visitante recorrente não paga nada; erro de rede em config/conversas = **fail-open**, chat abre sem form. Durante o boot o composer segura o envio (não a digitação) para o gate não ser furado por quem digita rápido.
- **Storage bloqueado** (Safari privado antigo, "block all cookies"): degrada para memória — widget funcional, sessão com vida útil da página.
- **Mobile** (≤ 640 px): painel fullscreen, teclado iOS compensado via `visualViewport`, scroll do host travado enquanto aberto. Em dispositivo de toque (e sempre na tela cheia) o painel aplica a **densidade mobile** — `data-density="mobile"` no `<html>` do iframe, tokens de tamanho no `styles.css`: texto/input 16px, alvos de 44–48px, safe areas.

## Rodando

```bash
yarn          # instalar
yarn dev      # dev server
```

- Demo dev (loader TS no ar + página host "hostil"): `http://localhost:5173/v1/dev/host.html?id={identifier}`
- Painel direto (standalone): `http://localhost:5173/v1/#id={identifier}&eid={uuid-qualquer}` — acrescente `&mode=fullscreen` para testar a UI de tela cheia/densidade mobile sem app

```bash
yarn build    # tsc + painel + loader IIFE + verificação de orçamento/artefato
yarn preview  # serve dist/ — demo prod-like: http://localhost:4173/v1/demo.html?id={identifier}
```

Env (todas opcionais — defaults de produção embutidos; ver `.env.example`): `VITE_API_URL`, `VITE_SOKETI_KEY/HOST/PORT/CLUSTER/TLS`.

## Deploy (Easypanel)

Hospedagem **estática** — só arquivos, sem servidor de aplicação. O Easypanel builda pelo `Dockerfile`: o primeiro estágio roda `yarn build` no Node 20, o segundo serve o `dist/` com nginx. O `nginx.conf` do repositório repete as regras de cache da tabela abaixo. O `vercel.json` continua no repositório e segue válido para quem quiser subir na Vercel; o Easypanel não o lê.

Serviço no painel: projeto `pipeelo`, serviço `widget`, source GitHub `pipeelo/widget` (ref `main`, path `/`), build `dockerfile`, porta 80.

O nginx serve `dist/` como raiz — os arquivos ficam sob `/v1/`:

- `https://<dominio>/v1/loader.js` (o script do snippet)
- `https://<dominio>/v1/` (o painel, dentro do iframe)
- `https://<dominio>/v1/demo.html?id={identifier}` (página de teste do build real)
- `https://<dominio>/healthz` (200 `ok`, para o proxy)

Não precisa de env vars: os defaults de produção (`api.pipeelo.com`, Soketi) estão embutidos no código. Para apontar outro ambiente, defina `VITE_API_URL` / `VITE_SOKETI_*` no env do serviço. O Easypanel injeta o env como `--build-arg`, e o `Dockerfile` grava um `.env.local` **só com as variáveis preenchidas**. Variável vazia não vira `.env.local`, porque o código usa `?? default` e `??` não cobre string vazia.

O widget é **domain-agnostic**: o loader deriva a URL do painel do próprio `src`, então funciona já no domínio `*.easypanel.host` (dá para testar antes de mexer no DNS). O snippet que o dashboard entrega ao cliente é que precisa apontar para o domínio final.

Cache (no `nginx.conf`, igual ao `vercel.json`):

| Caminho | Cache-Control |
|---|---|
| `/v1/loader.js` | `public, max-age=300, must-revalidate` (nome fixo — cache curto é o mecanismo de atualização) |
| `/v1/assets/*` | `public, max-age=31536000, immutable` (hasheados) |
| `/v1/` e `/v1/index.html` | `no-cache, must-revalidate` (a casca do painel referencia assets hasheados) |

**Não** adicionar `X-Frame-Options` nem CSP `frame-ancestors` restritivo: o painel roda em iframe em sites de terceiros — bloquear frame quebra o widget. O nginx não adiciona nenhum dos dois por padrão.

Versionamento: mudança incompatível de contrato = novo caminho (`/v2/`) no loader e no painel — embeds existentes continuam no `/v1/`.

## Decisões e limitações conhecidas

- **iframe, não Shadow DOM** — isolamento de CSS/JS nos dois sentidos em site desconhecido. O launcher/teaser (fora do iframe) usam só `system-ui` e classes `pipeelo-*`; um `!important` agressivo do host ainda pode afetá-los (aceito, como em toda a indústria).
- `from` do payload não distingue atendente humano de IA (ambos `company`) — o widget também não.
- 1 conexão Soketi por pageview de visitante recorrente (custo do badge). Se pesar em escala, a alternativa é polling do histórico para o badge.
- O pré-chat é gate de **UX, não segurança** — a API do canal é pública e quem quiser pula o formulário pelo DevTools. Identidade confiável é a verificação HMAC/JWT (spec em [`identidade.md`](./identidade.md)), evolução prevista fora deste escopo.
- O bundle do painel (~32 kB gz) é dominado pelo pusher-js — o `widget.md` prevê trocar por cliente enxuto do protocolo se pesar.
