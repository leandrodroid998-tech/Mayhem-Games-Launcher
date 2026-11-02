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

## Publicar online no Render (grátis)

**Opção A — Blueprint (recomendada)**
1. Suba esta pasta para um repositório no GitHub.
2. No Render: **New → Blueprint** e escolha o repositório. O `render.yaml` configura tudo.
3. Clique em **Apply**. Em ~1 min o site estará em `https://mayhem-games.onrender.com`.

**Opção B — manual**
1. Render: **New → Static Site** e conecte o repositório.
2. **Build Command:** *(vazio)* · **Publish Directory:** `public`
3. **Create Static Site**.

Cada `git push` publica uma nova versão automaticamente. O site é HTTPS, requisito para tela cheia, Gamepad API e instalação como app.

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
