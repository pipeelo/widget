# Widget Pipeelo — Canal do Site

## Contexto

- A Pipeelo atende por canais que convergem no mesmo pipeline (IA, distribuição, handoff, automações, análises); a borda é a única parte específica de cada canal.
- O canal do site (`WEBSITE`) está especificado em `Projects/api/docs/website-channel.md`: borda pública de mensagem, histórico e config identificada pelo id do registro `website_channels`, identidade por token de sessão opaco e tempo real por canal público do Soketi. Esse doc é o contrato deste projeto.
- Este projeto é o widget: a superfície que o cliente embute no site por snippet, no modelo do Intercom Messenger e do Website channel do Chatwoot.
- Projeto independente e leve. O dashboard da Pipeelo (Quasar, autenticado) atende o operador; o widget atende o visitante anônimo em site de terceiro — bundle mínimo, visual próprio.

## Objetivo

Widget de chat embutível estilo Intercom: bolha flutuante + painel de conversa, em que o visitante anônimo conversa com a empresa (IA e atendentes) pelo pipeline real da Pipeelo.

## Anatomia (padrão Intercom/Chatwoot)

1. **Snippet** — o que o cliente cola no site. Minúsculo, assíncrono, com fila de comandos: `Pipeelo('open')` funciona antes do script carregar e o loader drena a fila depois.

```js
(function (w, d) {
  w.Pipeelo = w.Pipeelo || function () { (w.Pipeelo.q = w.Pipeelo.q || []).push(arguments) };
  var s = d.createElement('script'); s.async = true;
  s.src = 'https://widget.pipeelo.com/v1/loader.js?id={identifier}';
  d.head.appendChild(s);
})(window, document);
```

2. **Loader** — roda na página host: renderiza a bolha (launcher) e o teaser de `message_preview` quando configurado, injeta o iframe do painel e faz a ponte `postMessage` (abrir/fechar, badge de não lidas).
3. **App do painel** — o chat de verdade, dentro do iframe, hospedado pela plataforma (`widget.pipeelo.com`).

## Decisões

- **iframe, não Shadow DOM.** O painel roda em iframe da plataforma pelo isolamento de UI e CSS nos dois sentidos em site desconhecido.
- **Token na página host, não na origem do iframe.** Storage de iframe de terceiro é particionado em todos os browsers e **efêmero no Safari** — apagado ao fechar o browser (webkit.org): todo visitante de Safari/iOS viraria visitante novo a cada sessão. O padrão da indústria (Chatwoot `cw_conversation`, Intercom, Crisp, Drift) é estado durável first-party no site do cliente: o loader cunha e guarda o token no `localStorage` da página host e o repassa ao iframe (parâmetro na URL do iframe ou postMessage). Custo aceito, como em toda a indústria: o JS do site consegue ler o token — e a alternativa não protegeria de verdade, um host comprometido pode substituir o iframe por uma UI falsa. Continuidade entre subdomínios (modelo cookie com domínio-base, como o Chatwoot) só se houver demanda.
- **Preact + Vite.** Runtime ~4,5 kB, modelo React-like; escolha validada pela Sentry pro mesmo caso — o framework vira ruído quando a UI cresce.
- **pusher-js** pro Soketi (protocolo Pusher, o mesmo do dashboard). É o maior peso do bundle: medir e, se pesar, trocar por cliente enxuto do protocolo.
- **Bolha na página host, painel no iframe.** Bolha leve e integrada; conversa isolada.

## Contrato com a API

Rotas públicas, sem autenticação, identificadas pelo id (uuid) do registro do canal:

- `GET /website-channel/config/{identifier}` — `name`, `widget_color`, `welcome_message`, `theme` (`light`/`dark`) e `message_preview` (null = sem teaser); monta a UI no boot. Resposta cacheável (`Cache-Control` de alguns minutos) — mudança de config demora esse tanto pra refletir.
- `POST /website-channel/message/{identifier}` — `external_id` (uuid — a API valida o formato), atributos opcionais de primeiro contato (nome, telefone, email) e um conteúdo por request (texto ou arquivo); retorna `customer_id`, `chat_id`, `message_id`.
- `GET /website-channel/history/{identifier}` — `external_id` + cursor; a linha do tempo da identidade, da mais recente para trás.
- Socket: canal público `website-channel.{identifier}.{external_id}`, evento `website-channel.message` — payload com id da mensagem, id do chat, `external_id`, tipo, texto ou URL temporária de mídia, autor e timestamp.

## Sessão do visitante

- Token de sessão = uuid v4 cunhado pelo loader no primeiro uso, guardado no `localStorage` da página host e repassado ao iframe; é o `external_id` de todas as chamadas e do canal do socket.
- Nada é criado no servidor até a primeira mensagem — widget aberto não é customer.
- Abas do mesmo navegador compartilham token e conversa; storage limpo = visitante novo.
- Entrega at-least-once: o evento do socket carrega o mesmo `message_id` que o envio retorna — o widget concilia o próprio eco e reenvios por id.
- Na reconexão do socket (rede, aba dormida), re-busca o histórico e segue: o histórico é a fonte de verdade, o socket é a atualização em tempo real.

## Cuidados

- Loader sempre `async`; sem `document.write`; nenhum global além de `Pipeelo`.
- Wix/Squarespace sandboxam scripts de terceiro em iframe: `document.currentScript` pode falhar — fallback localizando o próprio script pelo `src`.
- `crypto.randomUUID` só existe em contexto seguro — em site http, cunhar o uuid v4 com `crypto.getRandomValues` (disponível em qualquer contexto, mesma força).
- Versão na URL do loader e do iframe para evoluir sem quebrar embeds existentes.

## Em aberto

- Config estendida do widget (pré-chat, aparência além do contrato inicial) — evolui junto com o endpoint de config.
- Verificação de identidade quando houver visitante logado (HMAC `identifier_hash` do Chatwoot ou JWT com expiração — o modelo atual do Intercom, que tratou o `user_hash` como legado).
