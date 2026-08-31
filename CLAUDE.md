# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

Widget de chat embutível estilo Intercom (canal `WEBSITE` da Pipeelo): bolha flutuante + painel de conversa em iframe, colado por snippet em sites de terceiros. Docs canônicos — ler antes de mudança não trivial:

- `README.md` — anatomia, comportamentos-chave, deploy Vercel
- `widget.md` — contrato do projeto e decisões (iframe vs Shadow DOM, token no host, Preact, pusher-js)
- `identidade.md` — spec do `setUser`. O subconjunto básico (`name`/`email`/`phone`/`document`) está implementado de ponta a ponta; `ref`/`attributes`/`signature` (modo verificado) seguem só como spec, pendentes de backend
- `pre-chat.md` — spec do formulário pré-chat obrigatório (campo `pre_chat_form` na config do canal); **implementado no painel** (gate em `App.tsx` + `src/panel/lib/pre-chat.ts` + `PreChatForm`), backend em rollout
- Contrato da API (fora deste repo): `Projects/api/docs/website-channel.md`

Docs em pt-BR; código sem comentários (o que precisa de explicação vira nome melhor ou entra num `.md`); commits em inglês, Conventional Commits (`feat:`/`fix:`/`perf:`/`chore:`).

## Comandos

```bash
yarn               # instalar (Node >= 20)
yarn dev           # dev server em :5173
yarn build         # tsc --noEmit + build do painel + build do loader + guarda de orçamento
yarn typecheck     # só o tsc
yarn preview       # serve dist/ em :4173 (prod-like)
```

URLs de dev/teste:

- `http://localhost:5173/v1/dev/host.html?id={identifier}` — página host "hostil" com o loader TS
- `http://localhost:5173/v1/#id={identifier}&eid={uuid-qualquer}` — painel standalone (`&mode=fullscreen` para a UI de tela cheia)
- `http://localhost:4173/v1/demo.html?id={identifier}` — demo do build real

**Não há suíte de testes.** O check estático é o `yarn build` (typecheck estrito + guarda do loader). Verificação de verdade é E2E num Chrome real — receita validada na skill `verify` (`.claude/skills/verify/SKILL.md`): server same-origin com API fake + CDP com emulação mobile/toque.

## Arquitetura

Um repo, dois artefatos com restrições opostas, e o protocolo entre eles:

| Peça | Código | Roda em | Build |
|---|---|---|---|
| Loader | `src/loader/` | página host do cliente | `vite.loader.config.ts` → IIFE `dist/v1/loader.js` (nome fixo) |
| Painel | `src/panel/` | iframe `{origin}/v1/` | `vite.config.ts` (base `/v1/`) → `dist/v1/index.html` + assets hasheados |
| Compartilhado | `src/shared/` | ambos | — |

`src/shared/protocol.ts` é a fonte única do contrato postMessage (envelope `__pipeelo: true`): loader→painel `visibility`/`identify`; painel→loader `ready`/`close`/`unread`/`read`/`notify`. Mudança de protocolo = os dois lados mudam juntos.

### Loader — restrições que quebram o build

`scripts/check-loader-size.mjs` roda no `yarn build` e FALHA se o loader:

- passar de 7168 bytes gzip (roda em site de terceiro — todo byte conta);
- contiver `import.meta` ou `process.env` (SyntaxError/ReferenceError em script clássico — a env é inlinada via `define` no `vite.loader.config.ts`);
- criar o global `PipeeloLoader` (o entry `src/loader/index.ts` não pode ter `export`).

Além disso: o loader só importa de `src/shared/` (zero dependências de runtime) e o único global que expõe é `Pipeelo`.

### Papéis

- **Loader**: cunha/guarda o token de sessão (uuid v4 = `external_id`) no `localStorage` da página HOST, chaves `pipeelo:token|lastread|teaser` (storage de iframe de terceiro é efêmero no Safari); bolha, teaser e badge; injeta o iframe com parâmetros no fragment (não vaza em Referer) e deriva a URL do painel do próprio `src` do script (domain-agnostic); trava de scroll do host e teclado iOS via `visualViewport`; drena a fila `Pipeelo.q` — comandos `open`/`close`/`toggle`/`setUser` (`setUser(null)` = logout).
- **Painel** (Preact + pusher-js): config, lista de conversas, histórico por cursor, socket Soketi (canal público `website-channel.{identifier}.{external_id}`, evento `website-channel.message`), envio otimista. A identidade vive em DOIS slots compostos por campo (`src/panel/lib/pre-chat.ts`): o do host (`setUser` chega por `identify`, reenviado a cada `ready` — reload do iframe zera o ref; `setUser(null)` zera só esse slot) e o do formulário pré-chat; a composição sai como bloco `user` em TODO envio, não só no primeiro. Pré-chat: `pre_chat_form.fields` na config + identidade que não cobre + zero conversas → view `form` antes do thread; só esse caminho espera a config no landing, e o composer segura envio (não digitação) durante o boot.
- **`src/panel/state/store.ts`** é o coração: reducer puro onde tudo é upsert por `message_id` — histórico (fonte de verdade), eco do socket (entrega at-least-once) e otimistas convergem sem duplicar. Reconexão de socket = refetch do histórico.

### Invariantes de produto (não regredir)

- Nada é criado no servidor até a primeira mensagem; o token só é cunhado no primeiro open, nunca no load.
- Visitante recorrente (token existente): o iframe nasce escondido no load para manter o socket vivo — badge funciona sem abrir o painel.
- Leitor de config TOLERANTE: `theme`, `message_preview` e `display_mode` são campos em rollout no backend — ausente/null tem default (light, sem teaser, floating). Nunca assumir presença de campo.
- `display_mode: fullscreen` (WebView de app): o chat é a página — sem bolha, sem teaser, `close` vira no-op; densidade mobile (`data-density="mobile"`).
- Falha de config por rede ≠ canal inexistente: erro de rede → floating com defaults da marca; 404 → widget desativado.
- Storage bloqueado (Safari privado antigo) degrada para memória — widget funcional, sessão com vida útil da página.

### Deploy

Vercel estático; `vercel.json` define tudo, inclusive o cache (loader.js com cache curto é o mecanismo de atualização; assets hasheados immutable; casca do painel no-cache). **Nunca** adicionar `X-Frame-Options` nem CSP `frame-ancestors` — o painel roda em iframe em site de terceiros. Mudança incompatível de contrato = caminho novo (`/v2/`) no loader e no painel; embeds existentes continuam no `/v1/`.

Env (`.env.example`): todas opcionais, defaults de produção embutidos no código — `VITE_API_URL`, `VITE_SOKETI_*`.
