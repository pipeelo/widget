# widget-demo — como usar

`../widget-demo` é o ambiente de teste do widget: sobe o painel e o loader deste repo com **live
reload**, fala com a **API local de verdade**, expõe tudo pelo **ngrok** para abrir no celular e
simula o cenário que interessa hoje — o cliente manda "Oi" no WhatsApp, a empresa responde com
um botão, o botão abre o webchat e o atendimento continua lá, já com nome e telefone.

Ele mora fora deste repo de propósito (tooling de teste não entra no git do widget), mas depende
dele ao lado: usa o `src/` do painel, builda o loader e reaproveita o `node_modules` daqui. Não
tem nada para instalar lá.

## Antes de subir

| Precisa de | Como conferir |
|---|---|
| Este repo com dependências | `ls node_modules/.bin/vite` (senão `yarn`) |
| API local no ar | `curl -s localhost:8010/v1/website-channel/config/8569a1df-e733-4596-9869-694e11688e58` devolve JSON |
| Docker com o container `pipeelo-api` | `docker ps` — é onde o `start.sh` liga o worker da fila |
| ngrok autenticado | `ngrok config check` |
| Dashboard (opcional, para responder como empresa) | `http://localhost:8080` |

## Subir e derrubar

```bash
cd ../widget-demo
bash start.sh      # ou npm start
bash stop.sh       # ou npm stop — o worker da fila no container continua de pé
```

O `start.sh` leva uns 15 s e termina imprimindo o bloco com as URLs. **A URL do ngrok muda a cada
start** — leia dali, nunca decore. Logs em `../widget-demo/.run/{vite,loader,ngrok}.log`.

```
Celular (WhatsApp -> webchat)  https://xxxx.ngrok-free.app/
Site + widget (desktop)        https://xxxx.ngrok-free.app/atendimento?mode=floating
Painel isolado                 https://xxxx.ngrok-free.app/v1/#id=...&eid=...
Local                          http://127.0.0.1:5199/
```

Variáveis aceitas: `PORT` (5199), `PIPEELO_API` (`http://127.0.0.1:8010`), `CANAL` (o canal
"Pipeelo") e `PIPEELO_WIDGET` (caminho deste repo, padrão `../widget`).

## O roteiro

1. Abra a URL raiz do ngrok. No **desktop** aparece um iPhone; a tela dele é um iframe com o
   WhatsApp. No **celular** a moldura sai do caminho sozinha (a raiz redireciona para `/zap`).
   Na primeira visita o ngrok free mostra um aviso — clique em **Visit Site** uma vez por
   navegador; o aviso vale também para o iframe do painel.
2. O "Oi" do cliente já está lá. A empresa aparece "digitando…" e responde com o botão
   **Continuar atendimento** (formato de botão CTA do WhatsApp Business).
3. Toque no botão. A tela do aparelho navega para `/atendimento` — o site da empresa com o
   **snippet real** deste widget — carregando `name` e `phone` na URL. A página chama
   `Pipeelo('setUser', {...})` com esses dados e `Pipeelo('open')`. O chrome do aparelho vira
   navegador (barra de URL) e o webchat ocupa o celular.
4. Mande uma mensagem. Ela vai para a API local (`POST /website-channel/message` com o bloco
   `user`), o chat nasce no inbox com o cliente **já identificado** pelo nome e telefone do link
   — é o ponto do handoff: quem vem do WhatsApp não preenche formulário.
5. Responda pelo dashboard (`localhost:8080`) ou espere o assistente do tenant. A resposta chega
   ao vivo pelo socket; com o painel fechado ou a aba escondida, vira badge/título/teaser.

Para ver o widget **flutuante numa tela grande**, abra `/atendimento?mode=floating` direto
(a pílula tem o link "ir p/ o site") — esse caminho não passa pela moldura.

## Mexer no widget e ver refletir

| Você edita | O que acontece |
|---|---|
| `src/panel/**` | HMR do vite, inclusive dentro do iframe do painel |
| `src/loader/**` | rebuild do IIFE (`vite build --watch`) e full reload das páginas |
| `../widget-demo/pages/**` | full reload |

Tudo roda no **mesmo origin** com `VITE_API_URL=/v1`, então o mesmo artefato serve `localhost`
e o túnel sem rebuild e sem CORS. Efeito colateral: `dist/v1/loader.js` fica com a API relativa
enquanto o demo está de pé — um `yarn build` normal restaura o artefato de produção.

## A pílula e os parâmetros

O ponto no canto inferior esquerdo abre a pílula de controle. Ela só reescreve a URL; os
parâmetros viram um cookie (`pipeelo_dev_cfg`) que o proxy do demo aplica **por cima** da
resposta real de `GET /website-channel/config/{id}` — o banco não é tocado, e sem parâmetro vale
a config real do canal (hoje `display_mode: fullscreen` nos dois canais locais).

| Controle / param | Valores | Efeito |
|---|---|---|
| `mode` | `floating` · `fullscreen` | sobrescreve `display_mode` |
| `theme` | `light` · `dark` | sobrescreve `theme` |
| `welcome` | texto | `welcome_message` (a pílula usa um texto pronto) |
| `preview` | texto | teaser (`message_preview`) |
| `color` | hex | `widget_color` |
| `prechat` | `name,email` … | vira `pre_chat_form.fields` |
| `id` | uuid | outro canal |
| `name`, `phone` | texto | identidade que o site manda no `setUser` |
| `open=1` | — | enfileira `Pipeelo('open')` na chegada |
| `dev=0` | — | esconde a pílula (a moldura manda isso para dentro da tela) |

**Limpar sessão** apaga as chaves `pipeelo:*` do `localStorage` do origin e recarrega — é o jeito
de voltar a ser visitante de primeira conversa.

## Cenários úteis

- **Primeira conversa de novo**: pílula → limpar sessão → toque no botão do WhatsApp outra vez.
- **Chegada sem contexto vs. com boas-vindas**: alterne `welcome` na pílula; o canal local não
  tem `welcome_message`, então sem override o chat abre vazio.
- **Pré-chat coberto pela identidade do link**: limpe a sessão (o gate só vale na primeira
  conversa) e ligue `prechat` = nome+email. Vindo do WhatsApp com `name`+`phone`, o form pede só
  o e-mail; abrindo `/atendimento?prechat=name,email` sem `name`, pede tudo.
- **Escuro / flutuante / outro canal**: `theme=dark`, `mode=floating`, `id=<uuid>`.
- **Celular de verdade com teclado**: abra a URL do ngrok no aparelho — é o único jeito de
  exercitar `visualViewport`, safe areas e toque de verdade.

## Personalizar a simulação

Está tudo em `../widget-demo/pages/`:

- `zap.html` — a tela do WhatsApp. `CLIENTE` (nome/telefone do "cliente"), o texto da mensagem
  da empresa, o rótulo do botão e o tempo do "digitando…" ficam no `<script>` do fim.
- `atendimento.html` — o site da empresa que hospeda o snippet (o snippet é o do README, com o
  `id` e o `setUser` vindos da URL).
- `shell.html` — a moldura do celular e o chrome do aparelho (status bar, barra de URL).
- `dev.js` — a pílula e a lógica do cookie de override.
- `../widget-demo/vite.config.mts` — rotas, proxy da API e o watcher do live reload.

## Quando algo não funciona

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Mensagem sai mas resposta nunca chega | worker da fila morreu (`docker compose restart` mata) | `bash start.sh` de novo, ou `make queue` na api |
| Widget cai nos defaults da marca / "canal não encontrado" | API local fora ou proxy não alcança `:8010` | `curl localhost:8010/...` e `.run/vite.log` |
| Iframe do painel mostra a página de aviso do ngrok | cookie do "Visit Site" ainda não existe | abrir a raiz e clicar em Visit Site uma vez |
| Som de resposta não toca ao chegar do WhatsApp | a página nasce sem gesto do visitante (o clique foi na página anterior) | tocar em algo antes; comportamento real, não bug |
| Pílula mostra "config sobrescrita" sem você pedir | cookie de override antigo | pílula → "canal" em cada linha (limpa o param) |
| `start.sh` reclama que não achou o widget | demo fora de `../widget` | `PIPEELO_WIDGET=/caminho bash start.sh` |
| Porta 5199 ocupada | outro start pendurado | `bash stop.sh`; se insistir, `PORT=5200 bash start.sh` |
