# Widget Pipeelo — Identificação do cliente

> **Status: proposta de contrato (spec).** O client-side (`Pipeelo('setUser', …)`)
> e o endpoint de identidade descritos aqui **ainda não estão implementados** — o
> loader hoje só entende `open`/`close`/`toggle`. Este doc define o contrato para
> quando forem. Fecha os itens "pré-chat" e "verificação de identidade (HMAC/JWT)"
> que o [`widget.md`](./widget.md) marca como *Em aberto*.

## O problema

Por padrão o visitante do widget é **anônimo**: o loader cunha um token de sessão
(uuid v4) no `localStorage` do host, que vira o `external_id` de tudo (ver
["Sessão do visitante" no widget.md](./widget.md)). A Pipeelo não sabe **quem** é.

Quando o site **já conhece** o cliente (ex.: área logada), faz sentido o próprio
site repassar isso ao widget — nome, e-mail, telefone, id do CRM, plano, nº do
pedido, etc. — para a conversa **já chegar identificada** no pipeline, sem o
atendente/IA ter de perguntar. O site é o dono desses dados e a integração é
**opcional**: quem não chamar `setUser` continua anônimo como hoje.

Esse é o modelo de mercado — *user identification* / *boot attributes*:

| Plataforma | API no site | Anti-spoof |
|---|---|---|
| **Chatwoot** | `$chatwoot.setUser(id, {...})` + `setCustomAttributes({...})` | `identifier_hash` = HMAC-SHA256(identifier, token do inbox), gerado no backend do site |
| **Intercom** | `intercomSettings = {...}` → `Intercom('boot', {...})` | `user_hash` = HMAC-SHA256(user_id/email, secret) — hoje migrando para JWT |
| **Crisp** | `$crisp.push(["set","user:email",[email, sig]])`, `session:data` | assinatura no e-mail + `tokenId` para continuidade |
| **Zendesk** | `zE('messenger','loginUser', cb⇒cb(jwt))` | JWT assinado no servidor |

Denominador comum: **fila JS** (o site empurra quando tem os dados) + campos
padronizados + um mapa de atributos livres + **assinatura HMAC/JWT feita no
backend do site** para o que se confia.

## API do snippet

A fila global `Pipeelo` já existe no snippet (`Pipeelo('open')` funciona antes do
loader carregar). A identificação é só mais um comando na mesma fila:

```js
Pipeelo('setUser', {
  ref:   'crm-12345',                 // seu id estável do cliente (CRM/ERP). Opcional.
  name:  'Maria Silva',
  email: 'maria@exemplo.com',
  phone: '+55 62 99999-0000',
  attributes: {                       // livres — o que ajudar o atendimento
    cpf: '000.000.000-00',
    plano: 'Gold',
    pedido_id: 4821
  },
  signature: 'HMAC_GERADO_NO_SEU_BACKEND'   // opcional; exigido no modo verificado
});

Pipeelo('reset');   // logout: limpa a identidade e inicia sessão anônima nova
```

Campos (todos opcionais):

| Campo | Tipo | Observação |
|---|---|---|
| `ref` | `string` | Identificador do cliente **no seu sistema**. É o que a assinatura protege e o que a Pipeelo usa para relacionar/dedupe. **Não** confundir com o `external_id` (token de sessão anônimo do loader). |
| `name` / `email` / `phone` | `string` | Já previstos no contrato da API como "atributos de primeiro contato". |
| `attributes` | `object` (string/number/boolean) | Chaves livres. Aqui entram CPF, plano, id de pedido, etc. |
| `signature` | `string` | HMAC-SHA256 hex de `ref`, gerado no **seu backend** (ver "Modo verificado"). |

### Quando chamar

Como nome/CPF em geral só existem **após o login**, o site chama `setUser` assim
que tiver os dados — normalmente com os valores injetados pelo template
server-side, ou num callback de autenticação. Por ser fila, chamar **antes** do
loader terminar de carregar é seguro: o comando fica na `Pipeelo.q` e é drenado
depois. No logout, `Pipeelo('reset')` volta ao estado anônimo.

## Snippet completo (site que já conhece o cliente)

```html
<!-- 1) Snippet padrão do widget (inalterado) -->
<script>
  (function (w, d) {
    w.Pipeelo = w.Pipeelo || function () { (w.Pipeelo.q = w.Pipeelo.q || []).push(arguments) };
    var s = d.createElement('script'); s.async = true;
    s.src = 'https://widget.pipeelo.com/v1/loader.js?id=8569a1df-e733-4596-9869-694e11688e58';
    d.head.appendChild(s);
  })(window, document);
</script>

<!-- 2) Identificação do cliente (opcional) — valores vindos do SEU backend/template -->
<script>
  Pipeelo('setUser', {
    ref:   'crm-12345',
    name:  'Maria Silva',
    email: 'maria@exemplo.com',
    phone: '+55 62 99999-0000',
    attributes: {
      cpf: '000.000.000-00',
      plano: 'Gold',
      pedido_id: 4821
    },
    signature: 'HMAC_GERADO_NO_SEU_BACKEND'   // remova no modo não verificado (cortesia)
  });
</script>
```

> **Um bloco ou dois?** Como `Pipeelo` é fila, os dois `<script>` acima podem ser
> **um só** — basta colar o `Pipeelo('setUser', {…})` logo depois da IIFE do loader,
> no mesmo bloco (é bufferizado até o loader carregar; ordem não importa). O split
> em dois blocos é só didático — e reflete um padrão real: o **loader base** vive no
> layout global (ou no GTM), enquanto o **`setUser`** costuma vir do template da área
> logada, onde os valores do cliente existem. É o mesmo modelo de fila do Intercom
> (`Intercom(...)`); o Chatwoot separa por necessidade (o `$chatwoot` só existe após
> o evento `chatwoot:ready`), o que aqui não é preciso.
>
> Em SPA (React/Vue/…), deixe o loader base no layout e chame
> `window.Pipeelo('setUser', {…})` no código, logo após saber quem é o usuário (ex.:
> no sucesso do login). E `window.Pipeelo('reset')` no logout.

### Valores são interpolados, não literais

Os valores acima (`'Maria Silva'`, `'crm-12345'`, o `signature`…) são **placeholders**.
O site do cliente **não** cola isso fixo — ele injeta os dados **reais do usuário
logado**, renderizados a cada request. É responsabilidade do site (o mesmo modelo
de Intercom/Chatwoot/Crisp). Na prática, o template server-side gera algo como:

```html
<script>
  Pipeelo('setUser', {
    ref:   "{{ user.id }}",                 // valor real do usuário logado
    name:  "{{ user.nome }}",
    email: "{{ user.email }}",
    attributes: { plano: "{{ user.plano }}" },
    signature: "{{ hmac_sha256(user.id, SEGREDO_DO_CANAL) }}"  // gerado NO BACKEND, por usuário
  });
</script>
```

- **`signature` é por usuário**, nunca uma string fixa: é o HMAC do `ref` **daquele**
  usuário. O segredo do canal fica só no backend; no HTML sai apenas o hash pronto.
- **Visitante anônimo** (sem login): o site **não renderiza** o `setUser` — só o
  loader base. Nada de mandar dado vazio ou fake.

## Modo verificado (HMAC) — obrigatório para dados sensíveis

**Dado vindo do browser é falsificável.** Qualquer visitante pode abrir o DevTools
e digitar `Pipeelo('setUser', { ref: 'crm-999', cpf: '...' })` fingindo ser outro.
Por isso há dois modos, decididos por canal no dashboard:

- **Não verificado** (sem `signature`): serve para **cortesia** — saudar pelo nome,
  dar contexto ao atendente. **Nunca** deve destravar dado sensível nem ser tratado
  como identidade confiável.
- **Verificado** (com `signature`): o **seu backend** assina o `ref` com um segredo
  do canal; a Pipeelo recomputa e compara. Só então a identidade é confiável. É o
  mesmo `identifier_hash` do Chatwoot / `user_hash` do Intercom.

O segredo é **por canal**, exibido no dashboard (CRUD do `website_channels`), e
**nunca** vai para o front — a assinatura é sempre gerada no servidor:

```js
// Node — no SEU backend, ao renderizar a página logada
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', process.env.PIPEELO_CHANNEL_SECRET)
  .update(ref)            // o mesmo `ref` enviado no setUser
  .digest('hex');
```

```php
// PHP
$signature = hash_hmac('sha256', $ref, getenv('PIPEELO_CHANNEL_SECRET'));
```

No modo verificado, sem assinatura válida a Pipeelo **descarta** os campos de
identidade (comportamento do Intercom) — a conversa segue, porém anônima.

## Como o dado trafega (client-side)

Host → loader → painel → API, reusando os canais que já existem:

1. **Host → loader**: `Pipeelo('setUser', {...})` cai na fila; o loader ganha um
   handler `setUser`/`reset` ao lado de `open`/`close`/`toggle`
   (`src/loader/index.ts`, função `dispatch`).
2. **Loader → painel**: via **`postMessage`** — um tipo novo no protocolo
   (`src/shared/protocol.ts`), ex.: `{ __pipeelo: true, type: 'identify', user }`.
   **Não** usar o hash da URL do iframe: (a) a identidade pode chegar **depois** do
   boot e mudar; (b) evita PII (CPF!) na URL do iframe.
3. **Painel → API**: a identidade é anexada ao **primeiro contato**. Como *nada é
   criado no servidor até a primeira mensagem*, o painel guarda o `user` e o envia
   junto do `POST /website-channel/message` (que já aceita nome/telefone/email).
   Para visitante recorrente, atualiza o cliente vinculado ao `external_id`.

## Contrato pendente com o backend

Do lado da API (time da Pipeelo — os campos/persistência são de vocês):

- **Receber a identidade.** Estender o `POST /website-channel/message/{identifier}`
  (ou um `POST /website-channel/identify/{identifier}` dedicado) para aceitar um
  bloco opcional `{ ref, name, email, phone, attributes, signature }` associado ao
  `external_id`.
- **Verificar a assinatura.** Se o canal estiver em modo verificado, recomputar
  `HMAC-SHA256(ref, segredo_do_canal)` e comparar (comparação time-safe). Divergiu
  → ignora o bloco de identidade e segue anônimo.
- **Segredo por canal.** Guardar no registro `website_channels` e expor no dashboard
  (com opção de rotacionar), além do flag "exigir identidade verificada".
- **Vincular ao cliente.** Usar `ref` para localizar/dedupe/criar o customer e
  gravar `attributes` no perfil. Se `ref` também deve ancorar a conversa entre
  dispositivos (modelo Chatwoot, hoje ancorada no `external_id` de sessão) é uma
  decisão de backend à parte.

## Segurança e LGPD ⚠️

- **CPF é dado pessoal (LGPD).** Minimize: prefira mandar um `ref` **opaco** (id do
  CRM) e resolver o CPF **no seu backend**, em vez de trafegar CPF cru pela página
  e pelo iframe. Se for mesmo necessário, só no modo verificado, só por HTTPS, e
  com cuidado para não cair em logs (front e back).
- **Sempre HMAC no servidor**: o segredo do canal jamais no front.
- **Não confie no modo não verificado** para nada além de exibição/cortesia.

## Referências de mercado

- Chatwoot — [identity validation](https://www.chatwoot.com/hc/user-guide/articles/1677587479-how-to-enable-identity-validation-in-chatwoot) · [setUser / additional info](https://www.chatwoot.com/hc/user-guide/articles/1677587234-how-to-send-additional-user-information-to-chatwoot-using-sdk)
- Intercom — [identity verification (JWT/HMAC)](https://www.intercom.com/help/en/articles/10589769-authenticating-users-in-the-messenger-with-json-web-tokens-jwts) · [code samples](https://github.com/intercom/identity-verification-code-samples)
- Crisp — [$crisp methods](https://docs.crisp.chat/guides/chatbox-sdks/web-sdk/dollar-crisp/)
