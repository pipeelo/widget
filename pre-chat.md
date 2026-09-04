# Widget Pipeelo — Pré-chat form (identificação antes da primeira conversa)

> **Status: implementado no widget** (gate no `App.tsx`, `src/panel/lib/pre-chat.ts`,
> `PreChatForm`); backend em rollout — spec da API em
> `Projects/api/docs/website-channel-pre-chat.md`. Decisões de implementação na seção
> própria abaixo. Complementa o [`identidade.md`](./identidade.md): o `setUser` cobre o
> site que **já sabe** quem é o visitante; este doc cobre o canal que **exige** saber —
> quando o site não entrega (tudo), o próprio visitante preenche. Não substitui o modo
> verificado (HMAC/JWT), que segue feature à parte.

## O problema

O `Pipeelo('setUser', …)` (já implementado) deixa o site declarar
`name`/`email`/`phone`/`document`, que saem no bloco `user` de todo envio. Mas ele é
opcional e depende da integração: se o site não chamar (ou chamar incompleto), a
conversa chega **anônima** e o atendente/IA gasta o começo do atendimento perguntando
nome e contato.

Objetivo: o canal poder **exigir** esses campos antes da primeira mensagem. Quem os
entrega via `setUser` nem vê a diferença; quem não entrega vê um formulário no painel —
**só na primeira conversa**, porque da segunda em diante o cliente já existe no
pipeline.

## Decisão de design: política declarada, não inferida

A alternativa considerada (e descartada) foi o widget **deduzir** a obrigação da
presença de um `setUser` incompleto na página. Não sobrevive ao mundo real:

| | Deduzir do script | Declarar na config do canal |
|---|---|---|
| Quem decide | O template do site, por acidente | O dono do canal, no dashboard |
| Placeholder esquecido (`'NOME_DO_CLIENTE'`) | É string não-vazia: vira identidade lixo e o form **não** abre | Form abre; o lixo não passa |
| Site que nem chamou `setUser` | Segue anônimo (fora do alcance) | Form abre mesmo assim |
| `setUser` tardio (SPA, pós-login) | Corrida — "a página tem setUser?" não é decidível no boot | Indiferente: chegou completo, form some |
| Contrato atual | Contradiz o `identidade.md` (anônimo **não** renderiza `setUser`; payload vazio é no-op) | Nada muda no snippet |
| Custo no cliente | Loader + protocolo (orçamento a ~300 bytes gzip do teto) | **Zero** — o painel já lê a config sozinho |

**Decisão: campo novo na config do canal.** O loader não é tocado, o snippet não muda,
e a política fica explícita e auditável no dashboard.

## Contrato proposto — config do canal

`GET /website-channel/config/{identifier}` ganha um campo, no mesmo regime de **leitor
tolerante** dos demais campos em rollout (`theme`, `message_preview`, `display_mode`):

```jsonc
{
  "name": "…",
  "widget_color": "…",
  // …campos atuais…
  "pre_chat_form": { "fields": ["name", "email"] }
}
```

- `fields`: subconjunto de `name` | `email` | `phone` | `document` (as chaves do
  `WidgetUser` em `src/shared/protocol.ts`); a ordem do array é a ordem de exibição.
- **Ausente / `null` / `fields` vazio → sem formulário** (comportamento de hoje).
  Chaves desconhecidas dentro de `fields` são ignoradas — rollout de campos futuros
  sem quebrar painel antigo.
- Objeto (e não array puro) para caber evolução sem quebrar contrato: título/saudação
  próprios, campos opcionais vs. obrigatórios, pergunta livre, etc.
- Vale o cache da config (minutos): mudar a política no dashboard demora esse tanto
  para refletir no site.

## Comportamento do painel

Mostrar o formulário quando **todas** valem:

1. `pre_chat_form.fields` normalizado é não-vazio;
2. a identidade corrente do painel (última `identify` aceita) **não cobre** todos os
   `fields` exigidos;
3. é a **primeira conversa**: histórico carregado vazio (sem mensagens e sem `chats`). Não precisa
   de storage novo — como *nada é criado no servidor até a primeira mensagem*,
   "primeira conversa" ≡ "não há histórico para este `external_id`".

Fluxo: view própria entre o boot e o thread (`boot → form → thread`), com título fixo
do painel como abertura, os campos exigidos **que faltam** e um botão "Iniciar
conversa". Ao enviar, os valores viram a identidade do painel e saem no bloco `user`
do primeiro `POST /website-channel/message` e de todos os seguintes. **Nenhuma chamada
nova**: o servidor continua só conhecendo o visitante na primeira mensagem.

Casos de borda:

| Caso | Comportamento |
|---|---|
| `setUser` parcial | Form só com os campos exigidos que faltam (menos fricção; dado errado do site se corrige no site) |
| `setUser` completo chega com o form aberto | Preenche o que faltava; se nada mais falta, dispensa o form e segue |
| Visitante fecha sem enviar mensagem | Nada foi criado no servidor → próxima abertura mostra o form de novo (correto) |
| Erro de rede ao carregar o histórico | **Fail-open**: chat abre sem form — disponibilidade acima de política |
| `setUser(null)` (logout) com conversa existente | Sem form: o cliente já existe no pipeline; visitante novo de verdade = storage limpo |
| Storage limpo | `external_id` novo → primeira conversa → form de novo |
| Painel antigo + config nova (ou vice-versa) | Leitor tolerante: campo ignorado → sem form |
| Fullscreen (WebView de app) | Igual: app que passa `setUser` completo não vê form; app que não passa, vê |

Validação client-side mínima: obrigatórios não-vazios (trim), email com formato básico,
corte em 255 (o mesmo limite do `sanitizeUser` do loader). Máscara/validação forte de
CPF/CNPJ e telefone ficam para o backend — o painel não deve encarnar regra de negócio.
Strings em `src/panel/lib/strings.ts`; tema e densidade mobile como o resto do painel.

## Decisões de implementação (ago/2026)

- **Sem "pular".** Gate completo; o objeto `pre_chat_form` comporta um
  `required: false` futuro sem quebrar contrato.
- **Título próprio do painel** ("Antes de começar…") em vez do `welcome_message` como
  abertura do form: a welcome já é o primeiro balão da thread vazia — usá-la nos dois
  duplicaria a saudação. A thread pós-form fica idêntica à de qualquer visitante.
- **Identidade em dois slots** (`src/panel/lib/pre-chat.ts`): o do host (`setUser`) e
  o do formulário, compostos por campo — o host vence quando o valor dele serve para o
  campo. `setUser(null)` (logout) zera só o slot do host: o que o visitante digitou
  sobrevive até fechar a página. E-mail só conta como coberto com formato básico
  válido (a mesma régua da API, que descarta inválido em silêncio) — e-mail lixo do
  site não fura o form.
- **O landing espera a config só no caminho de primeira conversa** (histórico vazio):
  visitante recorrente não paga nada e o 1º open instantâneo (3fff70b) fica intacto.
  Config e histórico já saem em paralelo no mount — a espera é `max()`, não soma.
- **O composer segura o envio durante o boot** (texto e anexo; digitação e foco
  seguem livres): sem isso, quem digitasse rápido criaria a conversa antes de o
  landing decidir e furaria o gate.
- A transição `form → thread` tem um **ponto único** (effect no `App`): o submit só
  grava a identidade; cobertura completa — pelo submit ou por um `identify` tardio —
  dispensa o form pelo mesmo caminho.

## Contrato pendente com o backend (time da API/dashboard)

- Guardar a política no registro `website_channels` (quais campos exigir) e expor a
  edição no CRUD do dashboard.
- Devolver `pre_chat_form` no `GET /website-channel/config/{identifier}`.
- `POST /website-channel/message` **não muda**: o bloco `user` já é aceito hoje.
- Opcional (decisão do time da API): *enforcement* server-side — recusar a primeira
  mensagem de `external_id` novo sem os campos exigidos quando o canal exigir. Sem
  isso o gate é só UX (ver abaixo); com isso, cuidar da UX de erro no painel.

## Limites, segurança e LGPD ⚠️

- **"Obrigatório" aqui é UX, não segurança.** A API do canal é pública; qualquer um
  pula o formulário pelo DevTools ou chamando a API direto. Identidade **confiável** é
  o modo verificado (HMAC/JWT) do `identidade.md` — não misturar os dois.
- Dado digitado pelo visitante é tão não-verificado quanto `setUser` sem assinatura:
  serve para cortesia e contexto de atendimento, nunca para destravar dado sensível.
- **CPF/CNPJ é dado pessoal (LGPD).** Exigir `document` é fricção alta e
  responsabilidade extra — por isso os campos exigidos são configuráveis por canal, e a
  recomendação padrão é exigir o mínimo (`name` + um contato). Mesmos cuidados do
  `identidade.md`: só HTTPS e fora de logs.

## Referências de mercado

O padrão das plataformas é o mesmo proposto aqui — o formulário é **configuração da
caixa/canal**, do lado da plataforma; nunca inferido do script embutido:

- **Chatwoot** — *pre-chat form* por inbox: liga/desliga, campos e obrigatoriedade no
  painel admin.
- **Intercom** — qualificação no Messenger: exigir e-mail/atributos antes da conversa,
  por configuração.
- **Crisp** — *contact form* / pedir e-mail quando o visitante escreve, por
  configuração da caixa.
