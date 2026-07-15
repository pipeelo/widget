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

Canal com `display_mode: 'fullscreen'` na config: o chat **é** a página — o loader abre o painel no boot ocupando a viewport inteira, sem bolha, sem teaser e sem fechar (`Pipeelo('close')` vira no-op). Feito para WebView de app nativo (chat in-app). O painel aplica a **densidade mobile** (texto 16px, alvos de toque de 44px, safe areas de notch/home indicator) — a mesma usada em qualquer dispositivo de toque.

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
| **Loader** | página host do cliente | `src/loader/` (zero deps, < 6 kB gz — o build falha se estourar) | `dist/v1/loader.js` (nome fixo) |
| **Painel** | iframe `{origin}/v1/` | `src/panel/` (Preact + pusher-js) | `dist/v1/index.html` + assets hasheados |
| **Protocolo** | postMessage entre os dois | `src/shared/protocol.ts` | — |

O loader: cunha/guarda o **token de sessão** (uuid v4) no `localStorage` da página host (padrão da indústria — storage de iframe de terceiro é efêmero no Safari), renderiza a bolha, injeta o iframe (parâmetros via **fragment**, que não vaza em Referer), faz a ponte de abrir/fechar, badge de não-lidas e cartão teaser. O painel: config, histórico por cursor, socket Soketi (canal público `website-channel.{identifier}.{external_id}`, evento `website-channel.message`), envio otimista com reconciliação por `message_id` (dedupe do eco at-least-once) e refetch do histórico na reconexão (histórico é a fonte de verdade).

Comportamentos-chave:

- **Nada é criado no servidor até a primeira mensagem** — o token só é cunhado no primeiro open.
- **Visitante recorrente** (token existente): o iframe nasce escondido no load para manter o socket vivo — badge funciona sem abrir o painel.
- **Não-lidas**: marco `lastread` persistido no host via loader; painel conta `from === 'company'` mais novas que o marco.
- **Config do canal** (`GET /v1/website-channel/config/{id}`): `name`, `widget_color` (accent com auto-contraste de texto por luminância), `welcome_message` (primeiro balão quando não há histórico) e — **leitor tolerante, campos em rollout no backend** — `theme` (`light` | `dark` | `auto`; ausente/null → light), `message_preview` (string; non-null → cartão teaser proativo ao lado da bolha fechada, dispensável e persistido; respostas ao vivo geram só badge) e `display_mode` (`floating` | `fullscreen`; ausente → floating — ver "Embed em app").
- **Storage bloqueado** (Safari privado antigo, "block all cookies"): degrada para memória — widget funcional, sessão com vida útil da página.
- **Mobile** (≤ 640 px): painel fullscreen, teclado iOS compensado via `visualViewport`, scroll do host travado enquanto aberto. Em dispositivo de toque (e sempre na tela cheia) o painel aplica a **densidade mobile** — `data-density="mobile"` no `<html>` do iframe, tokens de tamanho no `styles.css`: texto/input 16px, alvos de 44px, safe areas.

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

## Deploy (Vercel)

Hospedagem **estática** — só arquivos, sem servidor. O `vercel.json` já define tudo (`buildCommand: yarn build`, `outputDirectory: dist`, e as regras de cache abaixo). Passos:

1. Push do repositório e **Import Project** na Vercel (ela detecta o `vercel.json`; não precisa configurar build na UI).
2. Deploy. A Vercel roda `yarn build` e serve `dist/` como raiz — os arquivos ficam sob `/v1/`:
   - `https://<deploy>/v1/loader.js` (o script do snippet)
   - `https://<deploy>/v1/` (o painel, dentro do iframe)
   - `https://<deploy>/v1/demo.html?id={identifier}` (página de teste do build real)
3. Em **Settings → Domains**, apontar `widget.pipeelo.com` para o projeto.

Não precisa de env vars: os defaults de produção (`api.pipeelo.com`, Soketi) estão embutidos no código. Para apontar outro ambiente, defina `VITE_API_URL` / `VITE_SOKETI_*` nas variáveis do projeto na Vercel.

O widget é **domain-agnostic**: o loader deriva a URL do painel do próprio `src`, então funciona já na URL `*.vercel.app` (dá para testar antes de configurar o DNS). O snippet que o dashboard entrega ao cliente é que precisa apontar para o domínio final.

Cache (no `vercel.json`):

| Caminho | Cache-Control |
|---|---|
| `/v1/loader.js` | `public, max-age=300, must-revalidate` (nome fixo — cache curto é o mecanismo de atualização) |
| `/v1/assets/*` | `public, max-age=31536000, immutable` (hasheados) |
| `/v1/` e `/v1/index.html` | `no-cache` (a casca do painel referencia assets hasheados) |

**Não** adicionar `X-Frame-Options` nem CSP `frame-ancestors` restritivo: o painel roda em iframe em sites de terceiros — bloquear frame quebra o widget. A Vercel não adiciona isso por padrão.

Versionamento: mudança incompatível de contrato = novo caminho (`/v2/`) no loader e no painel — embeds existentes continuam no `/v1/`.

## Decisões e limitações conhecidas

- **iframe, não Shadow DOM** — isolamento de CSS/JS nos dois sentidos em site desconhecido. O launcher/teaser (fora do iframe) usam só `system-ui` e classes `pipeelo-*`; um `!important` agressivo do host ainda pode afetá-los (aceito, como em toda a indústria).
- `from` do payload não distingue atendente humano de IA (ambos `company`) — o widget também não.
- 1 conexão Soketi por pageview de visitante recorrente (custo do badge). Se pesar em escala, a alternativa é polling do histórico para o badge.
- Pré-chat (nome/email antes da primeira mensagem) e verificação de identidade (HMAC/JWT) são evoluções previstas nos docs, fora deste escopo — o site passar dados do cliente (`Pipeelo('setUser', …)`) está especificado em [`identidade.md`](./identidade.md).
- O bundle do painel (~32 kB gz) é dominado pelo pusher-js — o `widget.md` prevê trocar por cliente enxuto do protocolo se pesar.
