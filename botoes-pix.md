# Widget Pipeelo — Botões/menu e PIX copia e cola

> **Status: spec, nada implementado.** Backend: botões **prontos** (nada a fazer na
> API); PIX **depende da API** — spec em `Projects/api/docs/website-channel-buttons-pix.md`.
> Este doc lista o que muda **aqui**.

## O problema

- **Botões.** A API já emite mensagens `type: "interactive"` com `items` (socket e
  histórico) e aceita `selected_value` no envio. O painel não lê `items`:
  `ApiMessage` não declara, `kindFromApi` cai em `'text'`, e o visitante vê a pergunta
  sem as opções. A IA já emite botões em chats do site (resposta estruturada) — o bug
  é vivo.
- **PIX.** Não existe. A API vai passar a emitir `type: "order_details"` com
  `product_name`, `code` (o copia e cola) e `value` (centavos). O painel precisa do
  card com "copiar código".

## Contrato da API (o que chega)

Item do histórico e payload do socket, mesmos campos. Leitor tolerante — tudo
opcional/nullable:

```jsonc
{
  "type": "interactive",            // ou "order_details"
  "text": "Como podemos ajudar?",
  "items": [{ "title": "Suporte", "value": "opt_1", "description": null }], // só interactive
  "selected_value": null,           // na interativa: value escolhido; no text do visitante: o que ele escolheu
  "product_name": "Plano Pro",      // só order_details
  "code": "00020126...6304ABCD",    // só order_details — o "copia e cola"
  "value": 9990,                    // só order_details — inteiro em centavos
  // ...message_id, chat_id, external_id, media_url, from, created_at
}
```

Resposta do visitante: `POST /website-channel/message/{identifier}` com `text`
(= `title` do item) + `selected_value` (= `value`, máx. 64). A API carimba
`selected_value` na **última** interativa do chat.

Regras da API que definem a UI:

- Botão vs menu é decisão do WhatsApp (≤3 / 4–10). Aqui chega sempre a lista — 1 a
  10 itens (13 pelo endpoint humano).
- `description` só existe no endpoint humano; a IA não manda.
- `button_label` não vem para o widget.

## Comportamento do painel — botões

- Balão de texto normal (sem `msg-bubble--media`) + pilha de opções abaixo, uma por
  linha, `title` e `description` secundária quando houver. Sem popup "Ver opções": a
  lista cobre 1–10; colapsar >3 é polimento opcional.
- Clicável só quando **todas** valem: `from === 'company'`, sem `selectedValue`, é a
  **última** interativa da conversa ativa (a API só carimba essa), conversa não
  encerrada (`readOnly` do `App`).
- Clique = enviar texto: mensagem otimista `text = item.title` (balão do visitante
  normal), `POST` com `selected_value = item.value`. Retry reenvia com o mesmo
  `selected_value`.
- Ao clicar, marca a interativa localmente como respondida — o eco do socket é da
  resposta, não da pergunta; o `selected_value` da pergunta só vem num refetch.
  Respondida: opção escolhida destacada (check), demais apagadas, nada clicável —
  igual ao dashboard (`MessageInteractive.vue`).
- Merge no upsert: `selectedValue = servidor ?? local` — refetch antes do carimbo não
  "desmarca".

## Comportamento do painel — PIX

- Balão de texto + card: `product_name`, valor `R$ 99,90` (`Intl.NumberFormat`
  pt-BR/BRL sobre `value / 100`), o código visível e selecionável (uma linha truncada,
  valor inteiro no DOM) e botão "Copiar código PIX".
- Copiar: `navigator.clipboard.writeText(code)`; fallback selecionar o campo +
  `execCommand('copy')`; feedback "Copiado!" ~2s; se tudo falhar, "Selecione e copie o
  código" — o código já está na tela, nunca é beco sem saída.
- **Loader**: `iframe.allow = 'autoplay; clipboard-write'` (`src/loader/frame.ts:54`)
  — Chromium exige a permission policy em iframe cross-origin. Fullscreen (sem iframe)
  não precisa. Custo ~20 bytes; folga atual 6472/7168 gzip.
- `order_details` sem `code` → renderiza como texto.

## Mudanças

| Arquivo | O quê |
|---|---|
| `src/panel/api/types.ts` | `InteractiveItem`; `ApiMessage` + `items`, `selected_value`, `product_name`, `code`, `value` (opcionais) |
| `src/panel/state/store.ts` | `MessageKind` + `'interactive'` \| `'order_details'`; `ChatMessage` + `items`, `selectedValue`, `pix {productName, code, value}`; `kindFromApi` (interactive com ≥1 item; order_details com `code`; senão texto); `fromApi`; ação `interactive/selected`; merge de `selectedValue` no upsert |
| `src/panel/state/useChat.ts` | `sendTextMessage(text, selectedValue?)` — otimista guarda `selectedValue`, retry reenvia; `selectOption(messageId, item)` |
| `src/panel/api/client.ts` | `sendText(..., selectedValue)` → `selected_value` no body só quando existe |
| `src/panel/components/InteractiveOptions.tsx` (novo) | pilha de opções, estados clicável/respondida |
| `src/panel/components/PixCard.tsx` (novo) | card + copiar |
| `src/panel/components/MessageBubble.tsx` | ramos `interactive` e `order_details`; props `onSelect`, `selectable` |
| `src/panel/components/MessageList.tsx` | calcula a última interativa (`state.order`), repassa `readOnly`/`onSelect` |
| `src/panel/App.tsx` | liga `chat.selectOption` e `readOnly` na lista |
| `src/panel/lib/strings.ts` | `copyPix`, `copied`, `copyFailed`, `selectOption` (a11y) |
| `src/panel/styles.css` | `.msg-options*`, `.msg-pix*` — tokens light/dark, alvo ≥44px em `data-density="mobile"` |
| `src/loader/frame.ts` | `allow` com `clipboard-write` |

Não muda: protocolo loader↔painel (`src/shared/protocol.ts`), teaser/badge/título
(`previewOf` e a lista de conversas usam `text` e seguem funcionando), socket,
pré-chat.

## Casos de borda

| Caso | Comportamento |
|---|---|
| `interactive` sem `items` / lista vazia | texto normal |
| Histórico traz `selected_value` | opções estáticas com check (recorrente, reload, reconexão) |
| Interativa antiga (não é a última) | estática, nunca clicável |
| Conversa encerrada | estática (mesmo estado que troca o composer pelo `ClosedNotice`) |
| Socket caído no clique | envio segue normal (HTTP); refetch na reconexão converge |
| Clique duplo | primeiro clique já marca respondida → segundo é no-op |
| Refetch entre clique e 201 | merge `servidor ?? local` mantém a marca |
| `order_details` sem `code` | só texto |
| Clipboard bloqueado (iframe sem `allow`, WebView antiga) | fallback `execCommand`; senão código selecionável + aviso |
| Painel novo + API antiga | `product_name`/`code` ausentes → texto; nada quebra |

## Verificação

- `yarn build` (typecheck + orçamento do loader).
- E2E pela skill `verify`: fixtures da API fake com uma `interactive` (histórico e
  socket) e uma `order_details`; conferir clique → `POST` com `selected_value` e balão
  otimista; marca respondida; opção antiga não clicável; copiar via CDP
  (`Browser.grantPermissions clipboardReadWrite` + `navigator.clipboard.readText`);
  mobile (toque, alvo ≥44px) e dark.

## Fora de escopo

- QR code (dá para gerar a partir do `code` depois; não vem da API).
- Status de pagamento — a API não tem fonte para o site.
- Markdown no balão (roadmap à parte).
