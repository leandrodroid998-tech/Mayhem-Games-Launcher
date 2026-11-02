# Mayhem Games — Launcher

Hub oficial de jogos HTML da Mayhem Games (HTML5 + CSS3 + JavaScript, sem build).

```
public/
  index.html      estrutura e ícones
  style.css       identidade visual (preto + vermelho neon) e responsividade
  script.js       rotas, telas, player, configurações, tela cheia
  games.js        CATÁLOGO de jogos (edite aqui para adicionar jogos)
  gamepad.js      Gamepad API (navigator.getGamepads) + remapeamento
  manifest.webmanifest   instalação como app (abre em tela cheia)
  assets/         logo, capas, ícones
  games/          arquivos HTML dos jogos
render.yaml       configuração do Render
```

## Publicar online no Render (Web Service — necessário para o modo online)
O projeto roda como **Web Service Node** (`server.js`): serve o launcher e faz a *sinalização* das salas
online (protocolo PeerJS em `/peerjs`). Um "Static Site" NÃO serve, porque não tem servidor.

**Opção A — Blueprint (recomendada)**
1. Suba esta pasta para o GitHub (com `server.js`, `package.json`, `render.yaml` e `public/` na raiz).
2. Render: **New → Blueprint**, escolha o repositório e clique **Apply**.

**Opção B — manual**
1. Render: **New → Web Service**, conecte o repositório.
2. Runtime **Node** · Build Command `npm install` · Start Command `npm start`
3. Health Check Path `/healthz` · Instance Type **Free** · **Create Web Service**.

Plano grátis: o serviço "dorme" após ~15 min sem acesso e a primeira visita leva ~30-60 s para acordar.
Quem já está numa partida não é afetado (o jogo trafega direto entre os jogadores por WebRTC).

## Online nos jogos
- **Stickman Mayhem**: já tem modo ONLINE (salas por código, até 4 jogadores). Funciona neste servidor.
- **Phenom Soccer 26** e **Gravity Rush**: os arquivos atuais não têm código online.

## Adicionar um jogo novo
1. Copie o `.html` do jogo para `public/games/`.
2. Coloque a capa em `public/assets/` (16:9, `.webp` recomendado).
3. Acrescente um objeto em `MAYHEM_GAMES` no `games.js`. Cards, filtros, detalhes e player são gerados sozinhos.
4. Em `gamepad.support` use `full`, `partial` ou `none` — só marque `full` se o jogo realmente lê o controle.

## Tela cheia
- Botão no topo do launcher (atalho **F**) e botão **Tela cheia** na barra do player.
- iPhone/iPad (Safari não permite tela cheia em páginas): **Compartilhar → Adicionar à Tela de Início** abre o launcher sem barras.

## Controle (Gamepad API)
Navegação: analógico esquerdo / D-pad · **A/✕** confirma · **B/○** volta · **Menu/Options** abre configurações · **LB/RB** trocam categorias/abas.
Com um jogo aberto o launcher não interfere; para voltar, segure **View/Create + Menu/Options** por 1 s.
Os botões exibidos se adaptam a Xbox, PlayStation, Nintendo ou genérico, e podem ser remapeados em Configurações → Comandos.

## API para os jogos (mesma origem)
```js
const hub = parent.MayhemHub;               // quando aberto dentro do launcher
hub.pad.snapshot();                         // estado atual do controle
hub.pad.label('south');                     // 'A' | '✕' ...
hub.gameConfig.get('meu-jogo');             // lê config de controle salva
hub.gameConfig.set('meu-jogo', { ... });    // salva
hub.fullscreen.toggle();
// ou por postMessage:
parent.postMessage({ mayhem: 'pad:getConfig' }, '*');
parent.postMessage({ mayhem: 'pad:setConfig', config: {...} }, '*');
parent.postMessage({ mayhem: 'hub:exit' }, '*');
```
Os jogos atuais usam a Gamepad API por conta própria; ainda não usam esta API.

## Redes sociais
Em `games.js`, preencha `url` em `MAYHEM_SOCIAL` (YouTube, Discord, X) para ativar os ícones.
