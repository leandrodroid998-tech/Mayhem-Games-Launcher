/* ==========================================================================
   MAYHEM GAMES — CATÁLOGO CENTRAL DE JOGOS
   --------------------------------------------------------------------------
   Para adicionar um jogo novo: copie o arquivo HTML para /games/ e acrescente
   um objeto em MAYHEM_GAMES. A interface (cards, destaques, filtros, página
   de detalhes e player) é gerada automaticamente a partir desta lista.

   Campos:
     id           identificador único (slug, usado na URL #/jogo/<id>)
     name         nome exibido
     tagline      frase curta (card)
     description  descrição completa (página de detalhes)
     cover        imagem de capa (assets/...)
     url          link do jogo (arquivo local em /games ou URL externa)
     category     categoria (usada nos filtros)
     status       'available' | 'beta' | 'soon'
     featured     true = aparece em "Jogos em destaque"
     accent       cor de destaque do jogo
     version      { number, label }   -> informações da versão (null = não informado)
     gamepad      { support, note }   -> support: 'full' | 'partial' | 'none'
     features     lista de recursos CONFIRMADOS no jogo (não invente recursos)
     orientation  'landscape' (opcional: o launcher tenta travar em paisagem na tela cheia)
     platforms    texto livre
   ========================================================================== */

window.MAYHEM_STATUS = {
  available: { label: 'Disponível', cls: 'ok' },
  beta:      { label: 'Beta',       cls: 'beta' },
  soon:      { label: 'Em breve',   cls: 'soon' }
};

window.MAYHEM_GAMEPAD_LEVELS = {
  full:    { label: 'Compatível com controle',      short: 'Controle',          cls: 'ok'   },
  partial: { label: 'Compatível parcialmente',      short: 'Controle parcial',  cls: 'part' },
  none:    { label: 'Sem suporte a controle',       short: 'Sem controle',      cls: 'none' }
};

window.MAYHEM_GAMES = [
  {
    id: 'stickman-mayhem',
    name: 'Stickman Mayhem',
    tagline: 'Lute, explore e divirta-se com diversos modos e armas!',
    description:
      'Jogo de luta com personagens ragdoll, armas, poderes especiais e batalhas caóticas. ' +
      'Entre na arena, use tudo o que tiver à mão e faça o caos.',
    cover: 'assets/cover-stickman-mayhem.webp',
    url: 'games/stickman-mayhem.html',
    category: 'Luta',
    status: 'available',
    featured: true,
    accent: '#ff1e1e',
    version: { number: '1.5.0', label: 'v1.5.0' },
    gamepad: {
      support: 'full',
      note: 'O jogo lê o controle diretamente pela Gamepad API do navegador.'
    },
    features: ['Personagens ragdoll', 'Armas', 'Poderes especiais', 'Batalhas caóticas'],
    platforms: 'Navegador — computador, celular e tablet'
  },
  {
    id: 'gravity-rush',
    name: 'Gravity Rush',
    tagline: 'Inverta a gravidade e sobreviva ao núcleo.',
    description:
      'Jogo focado em gravidade, movimento e desafios. Inverta a gravidade para desviar de espinhos, ' +
      'serras e lasers em fases cheias de armadilhas.',
    cover: 'assets/cover-gravity-rush.webp',
    url: 'games/gravity-rush.html',
    category: 'Plataforma',
    status: 'available',
    featured: true,
    accent: '#a100ff',
    version: null,
    gamepad: {
      support: 'full',
      note: 'Controle funciona no jogo (movimento, pulo, inverter gravidade, pausa) e nos menus.'
    },
    features: [
      'Inversão de gravidade',
      '100 fases em 5 mundos + fases Troll Land',
      'Modo infinito',
      'Desafio diário',
      'Time Attack',
      'Skins e conquistas'
    ],
    orientation: 'landscape',
    platforms: 'Navegador — computador, celular (modo paisagem) e tablet'
  },
  {
    id: 'phenom-soccer-26',
    name: 'Phenom Soccer 26',
    tagline: 'Partidas dinâmicas e muita diversão!',
    description:
      'Jogo de futebol com partidas dinâmicas e muita diversão. ' +
      'Entre em campo, jogue e construa sua carreira.',
    cover: 'assets/cover-phenom-soccer-26.webp',
    url: 'games/phenom-soccer-26.html',
    category: 'Esporte',
    status: 'available',
    featured: true,
    accent: '#2a82ff',
    version: null,
    gamepad: {
      support: 'full',
      note: 'O jogo lê o controle diretamente pela Gamepad API do navegador.'
    },
    features: ['Partidas de futebol', 'Modo carreira'],
    platforms: 'Navegador — computador, celular e tablet'
  }
];

/* Novidades exibidas na Home (só informações reais) */
window.MAYHEM_NEWS = [
  { date: '2026-11-02', tag: 'Launcher',  title: 'Launcher oficial da Mayhem Games no ar',
    text: 'Todos os nossos jogos HTML reunidos em um só lugar, direto no navegador.' },
  { date: '2026-11-02', tag: 'Controle',  title: 'Suporte a controles físicos',
    text: 'Navegue pelo launcher e abra os jogos com controle Xbox, PlayStation ou genérico.' },
  { date: '2026-11-02', tag: 'Jogo',      title: 'Stickman Mayhem v1.5.0 disponível',
    text: 'A versão mais recente do jogo de luta ragdoll já está no catálogo.' }
];

/* Redes sociais: preencha a url para ativar o ícone (vazio = "em breve") */
window.MAYHEM_SOCIAL = [
  { id: 'youtube', name: 'YouTube', url: '' },
  { id: 'discord', name: 'Discord', url: '' },
  { id: 'x',       name: 'X',       url: '' }
];
