/* ==========================================================================
   MAYHEM GAMES — LAUNCHER (interface, rotas, player, configurações)
   Depende de: games.js (catálogo) e gamepad.js (Gamepad API)
   ========================================================================== */
(function () {
  'use strict';

  const VERSION = '1.0.0';
  const GAMES = window.MAYHEM_GAMES || [];
  const Pad = window.MayhemPad;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n, c) => `<svg class="ic ${c || ''}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const getGame = id => GAMES.find(g => g.id === id);

  /* ======================= CONFIGURAÇÕES ======================= */
  const LS = 'mayhem.settings';
  const DEFAULTS = { theme: 'red', volume: 60, anim: true, deadzone: 45, repeat: 5, rumble: true, startPage: 'home', autoFs: false, last: null };
  let S = Object.assign({}, DEFAULTS);
  try { Object.assign(S, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };

  function applySettings() {
    document.documentElement.dataset.theme = S.theme;
    document.body.classList.toggle('noanim', !S.anim);
    const rate = Math.round(260 - S.repeat * 24); // 1..10 -> ~236..20ms
    Pad.setSettings({ deadzone: S.deadzone / 100, repeatRate: Math.max(40, rate), repeatDelay: 380, rumble: !!S.rumble });
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = '#09090b';
  }

  /* ======================= SOM DA INTERFACE ======================= */
  let actx = null;
  function blip(kind) {
    if (!S.volume) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
      const f = { nav: 520, ok: 760, back: 360, on: 900 }[kind] || 500;
      o.type = kind === 'back' ? 'triangle' : 'square';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * (kind === 'back' ? .7 : 1.35), t + .08);
      g.gain.setValueAtTime(S.volume / 100 * .08, t);
      g.gain.exponentialRampToValueAtTime(.0008, t + .12);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + .13);
    } catch (e) {}
  }

  /* ======================= TOASTS ======================= */
  function toast(title, text, icon) {
    const box = $('#toasts'), el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `${ico(icon || 'pad')}<div><b>${esc(title)}</b>${text ? `<small>${esc(text)}</small>` : ''}</div>`;
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3600);
  }

  /* ======================= TELA CHEIA ======================= */
  const rootEl = document.documentElement;
  const fsElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;
  const fsSupported = !!(rootEl.requestFullscreen || rootEl.webkitRequestFullscreen);
  const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;

  async function enterFs(el) {
    el = el || rootEl;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return false;
    try {
      await fn.call(el, { navigationUI: 'hide' });
      return true;
    } catch (e) { return false; }
  }
  async function exitFs() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn && fsElement()) { try { await fn.call(document); } catch (e) {} }
  }
  async function toggleFs(el) {
    if (!fsSupported) {
      if (!standalone) toast('Tela cheia indisponível', 'Neste navegador use: Compartilhar → Adicionar à Tela de Início.', 'fs');
      return;
    }
    if (fsElement()) { await exitFs(); return; }
    const ok = await enterFs(el);
    if (!ok) toast('Não foi possível entrar em tela cheia', 'Toque no botão de tela cheia novamente.', 'fs');
  }
  function syncFsUI() {
    const on = !!fsElement();
    const b = $('#fsBtn');
    b.innerHTML = ico(on ? 'fsx' : 'fs');
    b.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Tela cheia');
    b.title = on ? 'Sair da tela cheia (F)' : 'Tela cheia (F)';
    $('#pFs').innerHTML = `${ico(on ? 'fsx' : 'fs')}<span>${on ? 'Sair da tela cheia' : 'Tela cheia'}</span>`;
    if (!playerOpen()) return;
    // entrou em tela cheia dentro do jogo: recolhe a barra para liberar espaço
    setBarHidden(on);
  }
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev => document.addEventListener(ev, syncFsUI));
  if (standalone) $('#fsBtn').style.display = 'none';

  /* ======================= PAINEL DO CONTROLE / DICAS ======================= */
  function renderPadPanels() {
    const on = Pad.isConnected(), c = Pad.current();
    $$('.padpanel').forEach(p => {
      p.classList.toggle('on', on);
      p.innerHTML = on
        ? `<span class="dot"></span>${ico('pad', 'sm')}<span><b>CONTROLE CONECTADO</b><small title="${esc(c.id)}">Nome: ${esc(c.name)}</small></span>`
        : `<span class="dot"></span>${ico('pad', 'sm')}<span><b>NENHUM CONTROLE CONECTADO</b><small>Pressione um botão do controle</small></span>`;
    });
    renderHints();
  }
  function renderHints() {
    const el = $('#hints');
    if (!Pad.isConnected() || playerOpen()) { el.hidden = true; return; }
    const k = a => `<span class="kb">${esc(Pad.labelForAction(a))}</span>`;
    const hasTabs = !!$('[data-tabs]');
    el.innerHTML = `<span>${k('confirm')} Confirmar</span><span>${k('back')} Voltar</span>` +
      (hasTabs ? `<span>${k('tabPrev')}${k('tabNext')} Alternar</span>` : '') +
      `<span>${k('menu')} Opções</span>`;
    el.hidden = false;
  }

  Pad.on('connect', p => {
    renderPadPanels();
    if (!p.silent) { toast('CONTROLE CONECTADO', p.name + ' · ' + Pad.TYPE_NAME[p.type], 'pad'); blip('on'); }
    if (route().page === 'config') render();
  });
  Pad.on('disconnect', p => {
    renderPadPanels();
    toast('CONTROLE DESCONECTADO', p.name, 'pad');
    if (route().page === 'config') render();
  });
  Pad.on('active', () => { renderPadPanels(); });
  Pad.on('bindings', () => { renderHints(); });

  /* ======================= COMPONENTES ======================= */
  const statusBadge = g => { const s = window.MAYHEM_STATUS[g.status] || window.MAYHEM_STATUS.available; return `<span class="bd ${s.cls}">${esc(s.label)}</span>`; };
  const padBadge = g => { const l = window.MAYHEM_GAMEPAD_LEVELS[g.gamepad.support] || window.MAYHEM_GAMEPAD_LEVELS.none; return `<span class="bd ${l.cls}" title="${esc(l.label)}">${ico('pad', 'sm')}${esc(l.short)}</span>`; };

  function card(g) {
    const playable = g.status !== 'soon' && g.url;
    return `<article class="card" style="--gc:${esc(g.accent || '')}">
      <a class="card-cv" href="#/jogo/${esc(g.id)}" tabindex="-1" aria-hidden="true">
        <img src="${esc(g.cover)}" alt="" loading="lazy" decoding="async" width="800" height="450">
        <div class="badges">${statusBadge(g)}${padBadge(g)}</div>
      </a>
      <div class="card-b">
        <h3>${esc(g.name)}</h3>
        <p>${esc(g.tagline)}</p>
        <div class="card-a">
          ${playable ? `<a class="btn" href="#/jogar/${esc(g.id)}" data-play="${esc(g.id)}">${ico('play', 'sm')} Jogar agora</a>` : `<span class="btn" disabled aria-disabled="true">Em breve</span>`}
          <a class="btn sec" href="#/jogo/${esc(g.id)}">Ver detalhes</a>
        </div>
      </div>
    </article>`;
  }

  function footer() {
    const soc = (window.MAYHEM_SOCIAL || []).map(s => {
      const i = { youtube: 'yt', discord: 'dc', x: 'tw' }[s.id] || 'globe';
      return s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener" aria-label="${esc(s.name)}" title="${esc(s.name)}">${ico(i)}</a>`
                   : `<span title="${esc(s.name)} — em breve" aria-label="${esc(s.name)} — em breve">${ico(i)}</span>`;
    }).join('');
    return `<footer class="foot"><div>© ${new Date().getFullYear()} Mayhem Games · Launcher v${VERSION}<br>Feito com <span style="color:var(--ac)">♥</span> para a nossa comunidade.</div><div class="soc">${soc}</div></footer>`;
  }

  /* ======================= VIEWS ======================= */
  const views = {};

  views.home = () => {
    const feat = GAMES.filter(g => g.featured);
    const news = (window.MAYHEM_NEWS || []).map(n => `<article class="nw"><div class="meta"><span class="tg">${esc(n.tag)}</span>${new Date(n.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></article>`).join('');
    const last = S.last && getGame(S.last);
    return `
    <section class="hero">
      <div class="hero-art"></div>
      <div class="hero-in">
        <img class="hero-logo" src="assets/logo-mayhem.png" alt="Mayhem Games" width="620" height="180">
        <div class="tag"><span>JOGUE</span><i>•</i><span>DIVIRTA-SE</span><i>•</i><span>FAÇA O CAOS</span></div>
        <p>Bem-vindo ao launcher da <em>Mayhem Games</em>!<br>Aqui você encontra todos os nossos jogos HTML, de forma rápida, simples e <em>gratuita</em>!</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <a class="btn pulse" href="#/jogos" data-nav-default>${ico('play', 'sm')} Explorar jogos</a>
          ${last && last.status !== 'soon' ? `<a class="btn sec" href="#/jogar/${esc(last.id)}">Continuar: ${esc(last.name)}</a>` : ''}
        </div>
      </div>
    </section>

    <div class="sec-h"><h2>${ico('star')} Jogos em destaque</h2><span class="ln"></span><a class="more" href="#/jogos">Ver todos os jogos ${ico('arr', 'sm')}</a></div>
    <div class="car">
      <button class="car-nav l" type="button" data-car="-1" aria-label="Anterior">${ico('cl')}</button>
      <div class="car-track" id="car">${feat.map(card).join('')}</div>
      <button class="car-nav r" type="button" data-car="1" aria-label="Próximo">${ico('cr')}</button>
    </div>

    <div class="feats">
      <div class="feat">${ico('globe')}<div><b>Jogue direto no seu navegador</b><span>Sem downloads, sem complicação!</span></div></div>
      <div class="feat">${ico('pad')}<div><b>Suporte a controle</b><span>Xbox, PlayStation e genéricos.</span></div></div>
      <div class="feat">${ico('heart')}<div><b>Feito pela Mayhem Games</b><span>Com amor para a nossa comunidade.</span></div></div>
    </div>

    <div class="sec-h"><h2>${ico('bolt')} Últimas novidades</h2><span class="ln"></span></div>
    <div class="news">${news}</div>
    ${footer()}`;
  };

  let gamesFilter = 'Todos';
  views.jogos = () => {
    const cats = ['Todos'].concat(Array.from(new Set(GAMES.map(g => g.category))));
    if (!cats.includes(gamesFilter)) gamesFilter = 'Todos';
    const list = GAMES.filter(g => gamesFilter === 'Todos' || g.category === gamesFilter);
    return `
    <div class="pg-h"><h1>JOGOS</h1><p>Todos os jogos da Mayhem Games. Escolha um e jogue direto no navegador.</p></div>
    <div class="chips" data-tabs role="tablist" aria-label="Categorias">${cats.map(c => `<button class="chip ${c === gamesFilter ? 'on' : ''}" type="button" role="tab" aria-selected="${c === gamesFilter}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
    <div class="grid">${list.map(card).join('') || '<p>Nenhum jogo nesta categoria ainda.</p>'}</div>
    ${footer()}`;
  };

  views.jogo = id => {
    const g = getGame(id);
    if (!g) return `<div class="pg-h"><h1>JOGO NÃO ENCONTRADO</h1></div><a class="btn" href="#/jogos">Ver todos os jogos</a>`;
    const lvl = window.MAYHEM_GAMEPAD_LEVELS[g.gamepad.support];
    const playable = g.status !== 'soon' && g.url;
    const st = window.MAYHEM_STATUS[g.status];
    return `
    <a class="crumb" href="#/jogos">${ico('back', 'sm')} Voltar aos jogos</a>
    <div class="det" style="--gc:${esc(g.accent || '')}">
      <div><div class="det-cv"><img src="${esc(g.cover)}" alt="Capa de ${esc(g.name)}" width="800" height="450"></div>
        <div class="box"><h3>Controle</h3>
          <p><span class="bd ${lvl.cls}" style="margin-bottom:8px">${ico('pad', 'sm')}${esc(lvl.label)}</span><br>${esc(g.gamepad.note || '')}</p>
        </div>
      </div>
      <div>
        <div class="badges" style="position:static;margin-bottom:6px"><span class="bd cat">${esc(g.category)}</span>${statusBadge(g)}</div>
        <h1>${esc(g.name.toUpperCase())}</h1>
        <p class="lead">${esc(g.description)}</p>
        <div class="info">
          <div><small>Categoria</small><b>${esc(g.category)}</b></div>
          <div><small>Status</small><b>${esc(st.label)}</b></div>
          <div><small>Versão</small><b>${g.version ? esc(g.version.label || g.version.number) : 'Não informada'}</b></div>
          <div><small>Plataformas</small><b>${esc(g.platforms || '—')}</b></div>
        </div>
        ${g.features && g.features.length ? `<div class="box"><h3>Recursos</h3><ul>${g.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
        <div class="det-act">
          ${playable ? `<a class="btn pulse" href="#/jogar/${esc(g.id)}" data-nav-default>${ico('play', 'sm')} Jogar agora</a>` : `<span class="btn" disabled>Em breve</span>`}
          <a class="btn sec" href="#/jogos">Todos os jogos</a>
        </div>
      </div>
    </div>
    ${footer()}`;
  };

  /* --- Configurações --- */
  const CFG_TABS = [['geral', 'Geral'], ['controle', 'Controle'], ['comandos', 'Comandos']];
  const sw = (key, on) => `<button class="sw" type="button" role="switch" data-sw="${key}" aria-checked="${!!on}"></button>`;
  const rg = (key, min, max, val) => `<input type="range" data-rg="${key}" min="${min}" max="${max}" value="${val}"><span class="val" data-val="${key}">${val}</span>`;

  views.config = sub => {
    sub = CFG_TABS.some(t => t[0] === sub) ? sub : 'geral';
    const tabs = `<div class="cfg-tabs" data-tabs role="tablist">${CFG_TABS.map(t => `<a class="chip ${t[0] === sub ? 'on' : ''}" role="tab" aria-selected="${t[0] === sub}" href="#/config${t[0] === 'geral' ? '' : '/' + t[0]}">${t[1]}</a>`).join('')}</div>`;
    const head = `<div class="pg-h"><h1>CONFIGURAÇÕES</h1><p>Personalize o launcher e configure o seu controle.</p></div>${tabs}`;
    if (sub === 'geral') {
      const themes = [['red', '#ff1e1e', 'Mayhem (vermelho)'], ['ocean', '#2a82ff', 'Oceano'], ['midnight', '#8b5cf6', 'Meia-noite'], ['toxic', '#22c55e', 'Tóxico'], ['mono', '#e4e4e7', 'Monocromático']];
      return head + `
      <div class="set"><h3>Aparência</h3>
        <div class="row"><div class="l"><b>Tema visual</b><small>Cor de destaque da interface.</small></div>
          <div class="r themes">${themes.map(t => `<button class="th" type="button" style="--c:${t[1]}" data-theme="${t[0]}" aria-label="${t[2]}" title="${t[2]}" aria-pressed="${S.theme === t[0]}"></button>`).join('')}</div></div>
        <div class="row"><div class="l"><b>Animações</b><small>Desative para um visual mais leve.</small></div><div class="r">${sw('anim', S.anim)}</div></div>
      </div>
      <div class="set"><h3>Som</h3>
        <div class="row"><div class="l"><b>Volume da interface</b><small>Sons de navegação e confirmação (0 = mudo).</small></div><div class="r">${ico('vol', 'sm')}${rg('volume', 0, 100, S.volume)}</div></div>
      </div>
      <div class="set"><h3>Inicialização</h3>
        <div class="row"><div class="l"><b>Página inicial</b><small>O que abrir ao entrar no launcher.</small></div>
          <div class="r"><select data-sel="startPage"><option value="home" ${S.startPage === 'home' ? 'selected' : ''}>Início</option><option value="jogos" ${S.startPage === 'jogos' ? 'selected' : ''}>Jogos</option><option value="last" ${S.startPage === 'last' ? 'selected' : ''}>Último jogo</option></select></div></div>
        <div class="row"><div class="l"><b>Tela cheia ao iniciar um jogo</b><small>Tenta abrir o jogo em tela cheia automaticamente.</small></div><div class="r">${sw('autoFs', S.autoFs)}</div></div>
        <div class="row"><div class="l"><b>Restaurar padrões</b><small>Volta todas as configurações do launcher ao original.</small></div><div class="r"><button class="btn sec sm" type="button" data-reset="settings">Restaurar</button></div></div>
      </div>`;
    }
    if (sub === 'controle') {
      const on = Pad.isConnected(), c = Pad.current();
      return head + `
      <div class="set"><h3>Controle conectado</h3>
        <div class="row"><div class="l"><b>${on ? 'CONTROLE CONECTADO' : 'NENHUM CONTROLE CONECTADO'}</b>
          <small>${on ? `Nome: ${esc(c.name)}<br>Tipo: ${esc(Pad.TYPE_NAME[c.type])} · ${c.buttons} botões · ${c.axes} eixos · mapeamento ${esc(c.mapping || 'não padrão')}` : 'Conecte um controle (USB ou Bluetooth) e pressione qualquer botão para ele ser detectado.'}</small></div></div>
      </div>
      <div class="set"><h3>Teste dos botões</h3>
        <div class="tester">
          <div>${padSvg()}</div>
          <div class="axes">
            <div><b>Analógico esquerdo</b><div class="bar"><i id="ax0"></i></div><div class="bar" style="margin-top:6px"><i id="ax1"></i></div></div>
            <div><b>Analógico direito</b><div class="bar"><i id="ax2"></i></div><div class="bar" style="margin-top:6px"><i id="ax3"></i></div></div>
            <div><b>Gatilhos</b><div class="bar trig"><i id="trL"></i></div><div class="bar trig" style="margin-top:6px"><i id="trR"></i></div></div>
            <div><b>Botões pressionados</b><div class="pressed-list" id="pressed"></div></div>
            ${on ? '' : '<div class="note">Conecte um controle e aperte um botão para testar.</div>'}
            <div><button class="btn sec sm" type="button" data-rumble ${on ? '' : 'disabled'}>Testar vibração</button></div>
          </div>
        </div>
      </div>
      <div class="set"><h3>Navegação</h3>
        <div class="row"><div class="l"><b>Zona morta do analógico</b><small>Aumente se o analógico mexer sozinho.</small></div><div class="r">${rg('deadzone', 15, 80, S.deadzone)}</div></div>
        <div class="row"><div class="l"><b>Velocidade de repetição</b><small>Quão rápido a seleção anda ao segurar a direção.</small></div><div class="r">${rg('repeat', 1, 10, S.repeat)}</div></div>
        <div class="row"><div class="l"><b>Vibração ao navegar</b><small>Pequeno toque ao confirmar (se o controle suportar).</small></div><div class="r">${sw('rumble', S.rumble)}</div></div>
      </div>`;
    }
    // comandos
    const on = Pad.isConnected(), c = Pad.current();
    const rows = Object.keys(Pad.ACTIONS).map(a => `<tr><td>${esc(Pad.ACTIONS[a].label)}</td><td style="text-align:right"><span class="kb" data-cmdkb="${a}">${esc(Pad.labelForAction(a))}</span></td><td style="text-align:right;width:1%"><button class="btn sec sm" type="button" data-remap="${a}">Alterar</button></td></tr>`).join('');
    return head + `
    <div class="set"><h3>Comandos do launcher</h3>
      <div class="note">Os botões mostrados se adaptam ao controle detectado${on ? ` (<b>${esc(Pad.TYPE_NAME[c.type])}</b>)` : ''}. Para alterar, toque em <b>Alterar</b> e aperte o botão desejado no controle.${on ? '' : ' <b>Conecte um controle para remapear.</b>'}</div>
      <table class="cmd"><tbody>
        <tr><td>Navegar</td><td style="text-align:right" colspan="2"><span class="kb">Analógico esquerdo</span> <span class="kb">D-pad</span></td></tr>
        ${rows}
      </tbody></table>
      <div class="row"><div class="l"><b>Sair de um jogo</b><small>Com um jogo aberto, o launcher não interfere nos comandos dele.</small></div><div class="r"><span class="kb">${esc(Pad.label('select'))}</span>+<span class="kb">${esc(Pad.label('start'))}</span> <small style="color:var(--mut)">segure 1 s</small></div></div>
      <div class="row"><div class="l"><b>Restaurar comandos</b></div><div class="r"><button class="btn sec sm" type="button" data-reset="bindings">Restaurar</button></div></div>
    </div>
    <div class="set"><h3>Controles dos jogos</h3>
      ${GAMES.map(g => { const l = window.MAYHEM_GAMEPAD_LEVELS[g.gamepad.support]; return `<div class="row"><div class="l"><b>${esc(g.name)}</b><small>${esc(g.gamepad.note || '')}</small></div><div class="r"><span class="bd ${l.cls}">${esc(l.short)}</span></div></div>`; }).join('')}
      <div class="note" style="margin-top:6px">Cada jogo cuida dos próprios comandos. O launcher também oferece uma API para os jogos compartilharem configurações de controle (veja o README).</div>
    </div>`;
  };

  function padSvg() {
    const b = (n, shape) => shape;
    const circ = (n, x, y, r) => `<g><circle class="b" data-b="${n}" cx="${x}" cy="${y}" r="${r}"/><text data-t="${n}" x="${x}" y="${y}"></text></g>`;
    const rect = (n, x, y, w, h, rx) => `<g><rect class="b" data-b="${n}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx || 8}"/><text data-t="${n}" x="${x + w / 2}" y="${y + h / 2}"></text></g>`;
    return `<svg class="pad-svg" id="padSvg" viewBox="0 0 520 340" role="img" aria-label="Diagrama do controle">
      <path class="body" d="M120 62H400C452 62 490 130 496 244C500 304 468 322 438 302C410 284 402 262 380 258H140C118 262 110 284 82 302C52 322 20 304 24 244C30 130 68 62 120 62Z"/>
      ${rect('lt', 112, 14, 78, 22, 8)}${rect('rt', 330, 14, 78, 22, 8)}
      ${rect('lb', 108, 40, 92, 22, 8)}${rect('rb', 320, 40, 92, 22, 8)}
      <circle class="stk" cx="140" cy="130" r="36"/><circle class="knob" id="knobL" cx="140" cy="130" r="18"/>
      <circle class="stk" cx="320" cy="214" r="36"/><circle class="knob" id="knobR" cx="320" cy="214" r="18"/>
      ${circ('l3', 140, 130, 0.1).replace('<circle class="b"', '<circle class="b" style="opacity:0"')}
      ${rect('dup', 190, 176, 28, 28, 6)}${rect('ddown', 190, 232, 28, 28, 6)}${rect('dleft', 160, 204, 28, 28, 6)}${rect('dright', 220, 204, 28, 28, 6)}
      ${circ('north', 380, 94, 17)}${circ('south', 380, 158, 17)}${circ('west', 348, 126, 17)}${circ('east', 412, 126, 17)}
      ${rect('select', 224, 112, 28, 18, 9)}${rect('start', 268, 112, 28, 18, 9)}${circ('home', 260, 82, 14)}
    </svg>`;
  }

  views.sobre = () => {
    const nPad = GAMES.filter(g => g.gamepad.support !== 'none').length;
    const nCat = new Set(GAMES.map(g => g.category)).size;
    return `
    <div class="pg-h"><h1>SOBRE NÓS</h1></div>
    <div class="about">
      <div><img src="assets/logo-mayhem.png" alt="Mayhem Games" style="width:min(380px,100%);margin-bottom:18px;filter:drop-shadow(0 0 24px var(--acg))">
        <p class="q">“A Mayhem Games nasceu com uma missão: criar experiências divertidas, criativas e inesquecíveis. Desenvolvemos jogos para todos que gostam de diversão, criatividade e, claro, um pouco de caos.”</p>
        <p style="color:var(--mut);margin-top:16px">Somos uma desenvolvedora independente de jogos.</p>
      </div>
      <div class="stats">
        <div class="stat"><b>${GAMES.length}</b><span>jogos no catálogo</span></div>
        <div class="stat"><b>${nPad}</b><span>com suporte a controle</span></div>
        <div class="stat"><b>${nCat}</b><span>categorias</span></div>
      </div>
    </div>
    <div class="sec-h"><h2>Nossos jogos</h2><span class="ln"></span></div>
    <div class="grid">${GAMES.map(card).join('')}</div>
    ${footer()}`;
  };

  views.creditos = () => `
    <div class="pg-h"><h1>CRÉDITOS</h1><p>Mayhem Games — jogos independentes feitos para a diversão.</p></div>
    <div class="set" style="margin-top:20px"><h3>Jogos</h3>${GAMES.map(g => `<div class="row"><div class="l"><b>${esc(g.name)}</b><small>${esc(g.category)}</small></div><div class="r"><small style="color:var(--mut)">© Mayhem Games</small></div></div>`).join('')}</div>
    <div class="set"><h3>Launcher</h3>
      <div class="row"><div class="l"><b>Mayhem Games Launcher</b><small>Versão ${VERSION} — HTML5, CSS3 e JavaScript, com Gamepad API.</small></div></div>
      <div class="row"><div class="l"><b>Fontes</b><small>Bebas Neue e Barlow (SIL Open Font License), via Google Fonts.</small></div></div>
      <div class="row"><div class="l"><b>Hospedagem</b><small>Render (site estático).</small></div></div>
    </div>
    ${footer()}`;

  /* ======================= ROTAS ======================= */
  function route() {
    const h = (location.hash || '#/').replace(/^#\/?/, '');
    const [page, arg] = h.split('/');
    return { page: page || 'home', arg: arg || '' };
  }
  let lastRoute = '';
  function render() {
    const r = route();
    if (r.page === 'jogar') { openPlayer(r.arg); return; }
    if (playerOpen()) closePlayerUI();
    const fn = views[r.page] || views.home;
    const page = views[r.page] ? r.page : 'home';
    const view = $('#view');
    const key = r.page + '/' + r.arg;
    view.innerHTML = fn(r.arg);
    if (key !== lastRoute) { view.scrollTop = 0; lastRoute = key; }
    $$('[data-route]').forEach(a => a.classList.toggle('on', a.dataset.route === (page === 'jogo' ? 'jogos' : page)));
    document.title = (page === 'jogo' && getGame(r.arg) ? getGame(r.arg).name + ' — ' : '') + 'Mayhem Games';
    afterRender(page, r);
    renderHints();
  }

  let cfgLoop = null;
  function afterRender(page, r) {
    cfgLoop = null;
    if (page === 'config' && r.arg === 'controle') { cfgLoop = true; updateTester(); }
  }

  /* ======================= PLAYER ======================= */
  let curGame = null, viaNav = false;
  const playerOpen = () => !$('#player').hidden;
  const frame = () => $('#pFrame');

  function setBarHidden(h) {
    $('#pBar').classList.toggle('hide', h);
    $('#pTab').hidden = !h;
  }

  function openPlayer(id) {
    const g = getGame(id);
    if (!g || g.status === 'soon' || !g.url) { location.replace('#/jogos'); return; }
    if (playerOpen() && curGame && curGame.id === id) return;
    curGame = g;
    S.last = g.id; save();
    $('#pTitle').textContent = g.name;
    $('#pLoad').classList.remove('done');
    $('#pLoad span').textContent = 'Carregando ' + g.name + '…';
    const f = frame();
    f.onload = () => { $('#pLoad').classList.add('done'); try { f.focus(); f.contentWindow && f.contentWindow.focus(); } catch (e) {} };
    f.src = g.url;
    $('#player').hidden = false;
    setBarHidden(false);
    document.body.style.overflow = 'hidden';
    Pad.setEnabled(false);               // o jogo cuida do controle
    $('#hints').hidden = true;
    const ex = $('#pExit');
    ex.innerHTML = `Segure <b>${esc(Pad.label('select'))}</b> + <b>${esc(Pad.label('start'))}</b> para voltar ao launcher`;
    ex.hidden = !Pad.isConnected(); setTimeout(() => ex.hidden = true, 5000);
    if (S.autoFs && fsSupported && !fsElement()) enterFs($('#player')).then(() => { if (g.orientation === 'landscape') lockLandscape(); });
    else if (fsElement() && g.orientation === 'landscape') lockLandscape();
  }
  function lockLandscape() { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} }

  function closePlayerUI() {
    if (!playerOpen()) return;
    $('#player').hidden = true;
    const f = frame(); f.onload = null; f.src = 'about:blank';
    curGame = null;
    document.body.style.overflow = '';
    Pad.setEnabled(true);
    if (fsElement() && fsElement().id === 'player') exitFs();
    try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) {}
    setBarHidden(false);
  }
  function leavePlayer() {
    const id = curGame && curGame.id;
    if (viaNav && history.length > 1) { viaNav = false; history.back(); }
    else location.hash = id ? '#/jogo/' + id : '#/jogos';
  }
  $('#pBack').onclick = leavePlayer;
  $('#pReload').onclick = () => { if (curGame) { $('#pLoad').classList.remove('done'); frame().src = curGame.url; } };
  $('#pFs').onclick = () => toggleFs($('#player'));
  $('#pHide').onclick = () => setBarHidden(true);
  $('#pTab').onclick = () => setBarHidden(false);
  Pad.on('exitcombo', () => { if (playerOpen()) { blip('back'); leavePlayer(); } });

  /* ======================= EVENTOS DA INTERFACE ======================= */
  document.addEventListener('click', e => {
    const t = e.target.closest('button,a');
    if (!t) return;
    if (t.matches('a[data-play]') || (t.matches('a[href^="#/jogar/"]'))) viaNav = true;
    if (t.dataset.cat) { gamesFilter = t.dataset.cat; render(); focusSame('[data-cat="' + gamesFilter + '"]'); }
    if (t.dataset.car) { const c = $('#car'); c.scrollBy({ left: +t.dataset.car * c.clientWidth * .8, behavior: 'smooth' }); }
    if (t.dataset.theme) { S.theme = t.dataset.theme; save(); applySettings(); $$('.th').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === S.theme)); blip('ok'); }
    if (t.dataset.sw) { S[t.dataset.sw] = !S[t.dataset.sw]; save(); applySettings(); t.setAttribute('aria-checked', !!S[t.dataset.sw]); blip('ok'); }
    if (t.dataset.reset === 'settings') { S = Object.assign({}, DEFAULTS, { last: S.last }); save(); applySettings(); render(); toast('Configurações restauradas', '', 'cfg'); }
    if (t.dataset.reset === 'bindings') { Pad.resetBindings(); render(); toast('Comandos restaurados', '', 'pad'); }
    if (t.dataset.rumble !== undefined) { Pad.rumble(400, 1); }
    if (t.dataset.remap) startRemap(t);
    if (t.matches('.chip,.btn,.card-a a,.side-nav a,.bottom a')) blip('ok');
  });
  document.addEventListener('input', e => {
    const r = e.target.dataset && e.target.dataset.rg;
    if (!r) return;
    S[r] = +e.target.value; save(); applySettings();
    const v = $('[data-val="' + r + '"]'); if (v) v.textContent = S[r];
    if (r === 'volume') blip('nav');
  });
  document.addEventListener('change', e => { const k = e.target.dataset && e.target.dataset.sel; if (k) { S[k] = e.target.value; save(); } });
  $('#fsBtn').onclick = () => toggleFs();
  addEventListener('hashchange', render);
  addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    document.body.classList.remove('gp-mode');
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleFs(playerOpen() ? $('#player') : undefined); }
  });
  ['mousedown', 'touchstart'].forEach(ev => addEventListener(ev, () => document.body.classList.remove('gp-mode'), { passive: true }));

  function focusSame(sel) { const el = $(sel); if (el) el.focus({ preventScroll: true }); }

  /* --- remapear --- */
  let remapping = null;
  function startRemap(btn) {
    if (!Pad.isConnected()) { toast('Nenhum controle conectado', 'Conecte um controle e aperte um botão.', 'pad'); return; }
    const a = btn.dataset.remap, kb = $('[data-cmdkb="' + a + '"]');
    if (remapping) Pad.cancelCapture();
    remapping = a; kb.classList.add('wait'); kb.textContent = 'Aperte um botão…';
    Pad.captureNext(name => {
      if (/^d(up|down|left|right)$/.test(name) || name === 'home' || /^b\d/.test(name)) { toast('Botão não permitido', 'Escolha outro botão.', 'pad'); return false; }
      Pad.setBinding(a, name); remapping = null; blip('ok');
      if (route().page === 'config') render();
      return true;
    });
  }

  /* --- testador --- */
  function updateTester() {
    const svg = $('#padSvg'); if (!svg) return;
    $$('[data-t]', svg).forEach(t => { const n = t.dataset.t; t.textContent = n === 'l3' ? '' : Pad.label(n); });
  }
  Pad.on('frame', f => {
    if (!cfgLoop || route().arg !== 'controle') return;
    const svg = $('#padSvg'); if (!svg) return;
    const names = Pad.STD, pressed = [];
    f.buttons.forEach((v, i) => { const n = names[i]; if (!n) return; const el = $('[data-b="' + n + '"]', svg); if (el) el.classList.toggle('on', !!v); if (v) pressed.push(Pad.label(n)); });
    const set = (id, v) => { const el = $('#' + id); if (!el) return; el.style.left = v < 0 ? (50 + v * 50) + '%' : '50%'; el.style.width = Math.abs(v) * 50 + '%'; };
    const ax = f.axes; set('ax0', ax[0] || 0); set('ax1', ax[1] || 0); set('ax2', ax[2] || 0); set('ax3', ax[3] || 0);
    const kl = $('#knobL'), kr = $('#knobR');
    if (kl) { kl.setAttribute('cx', 140 + (ax[0] || 0) * 16); kl.setAttribute('cy', 130 + (ax[1] || 0) * 16); }
    if (kr) { kr.setAttribute('cx', 320 + (ax[2] || 0) * 16); kr.setAttribute('cy', 214 + (ax[3] || 0) * 16); }
    const tr = (id, i) => { const el = $('#' + id); if (el) el.style.width = ((f.gp.buttons[i] && f.gp.buttons[i].value) || 0) * 100 + '%'; };
    tr('trL', 6); tr('trR', 7);
    const pl = $('#pressed'); if (pl) { const html = pressed.map(p => `<span class="kb">${esc(p)}</span>`).join(''); if (pl.dataset.h !== html) { pl.dataset.h = html; pl.innerHTML = html; } }
  });

  /* ======================= NAVEGAÇÃO POR CONTROLE ======================= */
  function scope() { return playerOpen() ? null : document; }
  Pad.on('action', ev => {
    if (playerOpen()) return;
    document.body.classList.add('gp-mode');
    const a = ev.action, ae = document.activeElement;
    if (remapping && a !== 'back') return;
    if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
      if (ae && ae.type === 'range' && (a === 'left' || a === 'right')) {
        const step = +(ae.step || 1) * Math.max(1, Math.round((ae.max - ae.min) / 20));
        ae.value = +ae.value + (a === 'right' ? step : -step); ae.dispatchEvent(new Event('input', { bubbles: true })); return;
      }
      const el = Pad.moveFocus(a, $('#app'));
      if (el) { blip('nav'); Pad.rumble(12, .1); }
      return;
    }
    if (a === 'confirm') {
      if (!ae || ae === document.body || ae === $('#view')) { const f = Pad.moveFocus('down', $('#app')); if (f) blip('nav'); return; }
      if (ae.click) { blip('ok'); Pad.rumble(40, .3); ae.click(); }
      return;
    }
    if (a === 'back') {
      if (remapping) { Pad.cancelCapture(); remapping = null; render(); return; }
      blip('back');
      if (route().page === 'home') return;
      if (history.length > 1 && lastRoute) history.back(); else location.hash = '#/';
      return;
    }
    if (a === 'menu') { blip('ok'); location.hash = route().page === 'config' ? '#/' : '#/config'; return; }
    if (a === 'fullscreen') { toggleFs(); return; }
    if (a === 'tabPrev' || a === 'tabNext') {
      const tabs = $$('[data-tabs] .chip'); if (!tabs.length) return;
      let i = tabs.findIndex(t => t.classList.contains('on'));
      i = (i + (a === 'tabNext' ? 1 : -1) + tabs.length) % tabs.length;
      blip('nav'); tabs[i].click();
      if (tabs[i].tagName === 'A') { /* navegação por hash cuida da renderização */ }
      setTimeout(() => { const t = $$('[data-tabs] .chip')[i]; if (t) t.focus({ preventScroll: true }); }, 30);
    }
  });

  /* ======================= API PÚBLICA / MENSAGENS DOS JOGOS ======================= */
  window.MayhemHub = {
    version: VERSION,
    games: GAMES,
    getGame,
    openGame: id => { location.hash = '#/jogar/' + id; },
    closeGame: leavePlayer,
    pad: Pad,
    gameConfig: { get: Pad.getGameConfig, set: Pad.setGameConfig },
    settings: { get: k => (k ? S[k] : Object.assign({}, S)) },
    fullscreen: { toggle: toggleFs, enter: enterFs, exit: exitFs, active: () => !!fsElement() }
  };
  /* Jogos em iframe falam com o launcher por postMessage:
       parent.postMessage({ mayhem: 'pad:getConfig', game: '<id>' }, '*')
       parent.postMessage({ mayhem: 'pad:setConfig', game: '<id>', config: {...} }, '*')
       parent.postMessage({ mayhem: 'hub:exit' }, '*')
     Resposta: { mayhem: 'pad:config', game, config, controller: { connected, name, type } } */
  addEventListener('message', e => {
    const d = e.data; if (!d || typeof d !== 'object' || !d.mayhem) return;
    if (e.source !== frame().contentWindow) return;
    const id = curGame && curGame.id;
    const reply = () => e.source.postMessage({ mayhem: 'pad:config', game: id, config: Pad.getGameConfig(id), controller: { connected: Pad.isConnected(), name: Pad.current().name, type: Pad.current().type } }, '*');
    if (d.mayhem === 'pad:getConfig') reply();
    else if (d.mayhem === 'pad:setConfig' && id) { Pad.setGameConfig(id, d.config); reply(); }
    else if (d.mayhem === 'hub:exit') leavePlayer();
  });

  /* ======================= INÍCIO ======================= */
  applySettings();
  syncFsUI();
  renderPadPanels();
  // controles já conectados antes de abrir a página só aparecem após apertar um botão
  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    if (S.startPage === 'jogos') history.replaceState(null, '', '#/jogos');
    else if (S.startPage === 'last' && S.last && getGame(S.last)) history.replaceState(null, '', '#/jogo/' + S.last);
  }
  if (route().page === 'jogar') { const id = route().arg; history.replaceState(null, '', '#/jogo/' + id); viaNav = false; }
  render();
  if ('serviceWorker' in navigator && false) navigator.serviceWorker.register('sw.js');
})();
