/* ==========================================================================
   MAYHEM GAMES — GAMEPAD (leitura real via navigator.getGamepads())
   --------------------------------------------------------------------------
   - Detecta conexão/desconexão e o tipo do controle (Xbox / PlayStation / genérico)
   - Lê botões, analógicos e D-pad por polling (requestAnimationFrame)
   - Converte entradas em ações de interface (up/down/left/right/confirm/back/menu/tabPrev/tabNext)
   - Remapeamento dos botões do launcher + configurações por jogo
   - Navegação espacial entre elementos focáveis
   Não simula teclado: tudo é lido do hardware.
   ========================================================================== */
(function () {
  'use strict';

  const LS_BIND = 'mayhem.pad.bindings';
  const LS_GAME = 'mayhem.padcfg.';

  /* Mapa "standard gamepad" do W3C: índice -> nome neutro */
  const STD = {
    0: 'south', 1: 'east', 2: 'west', 3: 'north',
    4: 'lb', 5: 'rb', 6: 'lt', 7: 'rt',
    8: 'select', 9: 'start', 10: 'l3', 11: 'r3',
    12: 'dup', 13: 'ddown', 14: 'dleft', 15: 'dright', 16: 'home'
  };
  const STD_INDEX = Object.fromEntries(Object.entries(STD).map(([i, n]) => [n, +i]));

  /* Rótulos por família de controle */
  const LABELS = {
    xbox:  { south: 'A', east: 'B', west: 'X', north: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT', select: 'View', start: 'Menu', l3: 'LS', r3: 'RS', dup: '↑', ddown: '↓', dleft: '←', dright: '→', home: 'Guide' },
    ps:    { south: '✕', east: '○', west: '□', north: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', select: 'Create', start: 'Options', l3: 'L3', r3: 'R3', dup: '↑', ddown: '↓', dleft: '←', dright: '→', home: 'PS' },
    nintendo: { south: 'B', east: 'A', west: 'Y', north: 'X', lb: 'L', rb: 'R', lt: 'ZL', rt: 'ZR', select: '−', start: '+', l3: 'LS', r3: 'RS', dup: '↑', ddown: '↓', dleft: '←', dright: '→', home: 'Home' },
    generic: { south: 'Botão 1', east: 'Botão 2', west: 'Botão 3', north: 'Botão 4', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2', select: 'Select', start: 'Start', l3: 'L3', r3: 'R3', dup: '↑', ddown: '↓', dleft: '←', dright: '→', home: 'Home' }
  };

  /* Ações de interface e seus botões padrão (nomes neutros) */
  const ACTIONS = {
    confirm: { label: 'Confirmar',          def: 'south'  },
    back:    { label: 'Voltar',             def: 'east'   },
    menu:    { label: 'Abrir opções',       def: 'start'  },
    tabPrev: { label: 'Categoria anterior', def: 'lb'     },
    tabNext: { label: 'Próxima categoria',  def: 'rb'     },
    fullscreen: { label: 'Tela cheia',      def: 'north'  }
  };

  function detectType(id) {
    const s = (id || '').toLowerCase();
    if (/(xbox|x-box|xinput|microsoft|045e)/.test(s)) return 'xbox';
    if (/(playstation|dualshock|dualsense|054c|sony|wireless controller.*054c|ps4|ps5|ps3)/.test(s)) return 'ps';
    if (/(nintendo|switch|pro controller|057e|joy-con)/.test(s)) return 'nintendo';
    return 'generic';
  }
  const TYPE_NAME = { xbox: 'Xbox', ps: 'PlayStation', nintendo: 'Nintendo', generic: 'Genérico' };

  function cleanName(id) {
    if (!id) return 'Controle';
    // "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)"
    return id.replace(/\s*\((?:STANDARD GAMEPAD)?.*?(?:Vendor|Product).*?\)\s*/i, '')
             .replace(/\s*\(.*?\)\s*$/, '').replace(/\s+[0-9a-f]{4}-[0-9a-f]{4}.*$/i, '').trim() || id;
  }

  const listeners = {};
  const on = (ev, fn) => ((listeners[ev] = listeners[ev] || []).push(fn), () => off(ev, fn));
  const off = (ev, fn) => { listeners[ev] = (listeners[ev] || []).filter(f => f !== fn); };
  const emit = (ev, data) => (listeners[ev] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } });

  const state = {
    pads: {},          // index -> info
    activeIndex: null, // controle em uso
    prev: {},          // index -> { buttons: [], dirs: {} }
    held: {},          // repeat timers por direção
    settings: { deadzone: 0.45, repeatDelay: 380, repeatRate: 120, rumble: true },
    enabled: true,     // desliga a navegação do launcher (ex.: enquanto um jogo está aberto)
    capture: null,     // callback para remapear/testar botões
    bindings: {}       // ação -> nome neutro
  };

  try { state.bindings = JSON.parse(localStorage.getItem(LS_BIND) || '{}'); } catch (e) { state.bindings = {}; }
  const bindingOf = a => state.bindings[a] || ACTIONS[a].def;
  function setBinding(a, name) {
    state.bindings[a] = name;
    try { localStorage.setItem(LS_BIND, JSON.stringify(state.bindings)); } catch (e) {}
    emit('bindings', state.bindings);
  }
  function resetBindings() {
    state.bindings = {};
    try { localStorage.removeItem(LS_BIND); } catch (e) {}
    emit('bindings', state.bindings);
  }

  function info(gp) {
    return { index: gp.index, id: gp.id, name: cleanName(gp.id), type: detectType(gp.id), mapping: gp.mapping, buttons: gp.buttons.length, axes: gp.axes.length };
  }
  function labelFor(name, type) { return (LABELS[type || current().type] || LABELS.generic)[name] || name; }
  function current() {
    const p = state.pads[state.activeIndex];
    return p || { type: 'generic', name: '', id: '' };
  }
  const connected = () => state.activeIndex != null && !!state.pads[state.activeIndex];

  function readPads() {
    try { return Array.from(navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean); } catch (e) { return []; }
  }

  function register(gp, silent) {
    if (!gp || state.pads[gp.index]) return;
    state.pads[gp.index] = info(gp);
    state.prev[gp.index] = { buttons: [], dirs: {} };
    if (state.activeIndex == null) state.activeIndex = gp.index;
    emit('connect', Object.assign({ silent: !!silent }, state.pads[gp.index]));
  }
  function unregister(index) {
    const p = state.pads[index];
    if (!p) return;
    delete state.pads[index]; delete state.prev[index];
    if (state.activeIndex === index) {
      const k = Object.keys(state.pads);
      state.activeIndex = k.length ? +k[0] : null;
    }
    emit('disconnect', p);
  }

  window.addEventListener('gamepadconnected', e => register(e.gamepad));
  window.addEventListener('gamepaddisconnected', e => unregister(e.gamepad.index));

  /* ---------- Entradas de direção (stick esquerdo + D-pad) ---------- */
  function dirsOf(gp) {
    const dz = state.settings.deadzone, ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.6));
    // alguns controles genéricos expõem o D-pad como eixo "hat" (6/7 ou 9)
    const hx = gp.mapping === 'standard' ? 0 : (gp.axes[6] || 0), hy = gp.mapping === 'standard' ? 0 : (gp.axes[7] || 0);
    return {
      up:    ay < -dz || b(12) || hy < -0.5,
      down:  ay >  dz || b(13) || hy >  0.5,
      left:  ax < -dz || b(14) || hx < -0.5,
      right: ax >  dz || b(15) || hx >  0.5
    };
  }

  function press(action, extra) { if (state.enabled) emit('action', Object.assign({ action }, extra)); }

  function rumble(ms, strong) {
    if (!state.settings.rumble) return;
    const gp = readPads().find(g => g.index === state.activeIndex);
    const act = gp && (gp.vibrationActuator || (gp.hapticActuators && gp.hapticActuators[0]));
    try {
      if (act && act.playEffect) act.playEffect('dual-rumble', { duration: ms || 40, strongMagnitude: strong || 0.2, weakMagnitude: 0.3 });
      else if (act && act.pulse) act.pulse(0.3, ms || 40);
    } catch (e) {}
  }

  let lastT = 0;
  function poll(t) {
    requestAnimationFrame(poll);
    const pads = readPads();
    // controles que já estavam conectados antes da página carregar só aparecem após um botão
    pads.forEach(gp => { if (!state.pads[gp.index]) register(gp); });
    // desconexão silenciosa (alguns navegadores não disparam o evento)
    Object.keys(state.pads).forEach(i => { if (!pads.find(g => g.index === +i)) unregister(+i); });

    const now = t || performance.now();
    lastT = now;

    pads.forEach(gp => {
      const pv = state.prev[gp.index] || (state.prev[gp.index] = { buttons: [], dirs: {} });
      const bt = gp.buttons.map(b => !!(b.pressed || b.value > 0.6));
      const d = dirsOf(gp);

      // qualquer botão ativa este controle como "ativo"
      const anyNew = bt.some((v, i) => v && !pv.buttons[i]) || Object.values(d).some((v, i) => v && !Object.values(pv.dirs)[i]);
      if (anyNew && state.activeIndex !== gp.index) { state.activeIndex = gp.index; emit('active', state.pads[gp.index]); }
      if (gp.index !== state.activeIndex) { pv.buttons = bt; pv.dirs = d; return; }

      // botões
      bt.forEach((v, i) => {
        if (v === !!pv.buttons[i]) return;
        const name = STD[i] || ('b' + i);
        emit(v ? 'buttondown' : 'buttonup', { index: i, name, label: labelFor(name) });
        if (v) {
          if (state.capture) { const cb = state.capture; if (cb(name, i)) state.capture = null; return; }
          for (const a in ACTIONS) if (bindingOf(a) === name) press(a, { source: 'button' });
        }
      });

      // direções (com repetição)
      ['up', 'down', 'left', 'right'].forEach(k => {
        const h = state.held[k] || (state.held[k] = { on: false, next: 0 });
        if (d[k]) {
          if (!h.on) { h.on = true; h.next = now + state.settings.repeatDelay; if (!state.capture) press(k, { source: 'dir' }); }
          else if (now >= h.next) { h.next = now + state.settings.repeatRate; if (!state.capture) press(k, { source: 'dir', repeat: true }); }
        } else h.on = false;
      });

      emit('frame', { gp, buttons: bt, axes: Array.from(gp.axes), dirs: d });
      pv.buttons = bt; pv.dirs = d;
    });
  }
  requestAnimationFrame(poll);

  /* ---------- Combo de saída (Select + Start segurados) ---------- */
  let comboAt = 0;
  on('frame', f => {
    const both = f.buttons[8] && f.buttons[9];
    if (both) { if (!comboAt) comboAt = performance.now(); else if (performance.now() - comboAt > 1200) { comboAt = 0; emit('exitcombo'); } }
    else comboAt = 0;
  });

  /* ---------- Navegação espacial ---------- */
  function focusables(root) {
    return Array.from((root || document).querySelectorAll('a[href],button,[tabindex="0"],input,select,[data-nav]'))
      .filter(el => !el.disabled && el.offsetParent !== null && el.getAttribute('tabindex') !== '-1' && !el.closest('[inert]') && !el.closest('[hidden]'))
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; });
  }
  function moveFocus(dir, root) {
    const els = focusables(root);
    if (!els.length) return null;
    let cur = document.activeElement;
    if (!cur || !els.includes(cur)) { const f = els.find(e => e.dataset.navDefault !== undefined) || els[0]; f.focus({ preventScroll: false }); return f; }
    const a = cur.getBoundingClientRect(), ac = { x: a.left + a.width / 2, y: a.top + a.height / 2 };
    let best = null, bs = Infinity;
    for (const el of els) {
      if (el === cur) continue;
      const r = el.getBoundingClientRect(), c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const dx = c.x - ac.x, dy = c.y - ac.y;
      let ok = false, main = 0, cross = 0;
      if (dir === 'right') { ok = r.left >= a.right - 8 || dx > a.width * .3; ok = ok && dx > 4; main = Math.max(0, r.left - a.right); cross = Math.abs(dy); }
      if (dir === 'left')  { ok = dx < -4 && (r.right <= a.left + 8 || -dx > a.width * .3); main = Math.max(0, a.left - r.right); cross = Math.abs(dy); }
      if (dir === 'down')  { ok = dy > 4 && (r.top >= a.bottom - 8 || dy > a.height * .3); main = Math.max(0, r.top - a.bottom); cross = Math.abs(dx); }
      if (dir === 'up')    { ok = dy < -4 && (r.bottom <= a.top + 8 || -dy > a.height * .3); main = Math.max(0, a.top - r.bottom); cross = Math.abs(dx); }
      if (!ok) continue;
      const score = main + cross * 2.2;
      if (score < bs) { bs = score; best = el; }
    }
    if (best) { best.focus({ preventScroll: true }); best.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); }
    return best;
  }

  /* ---------- Configuração por jogo (API compartilhada) ---------- */
  function getGameConfig(id) { try { return JSON.parse(localStorage.getItem(LS_GAME + id) || 'null'); } catch (e) { return null; } }
  function setGameConfig(id, cfg) { try { localStorage.setItem(LS_GAME + id, JSON.stringify(cfg)); return true; } catch (e) { return false; } }

  window.MayhemPad = {
    ACTIONS, LABELS, STD, STD_INDEX, TYPE_NAME,
    on, off, state,
    isConnected: connected,
    current,
    detectType, cleanName,
    label: labelFor,
    labelForAction: a => labelFor(bindingOf(a)),
    bindingOf, setBinding, resetBindings,
    setEnabled(v) { state.enabled = !!v; },
    setSettings(o) { Object.assign(state.settings, o); },
    captureNext(cb) { state.capture = cb; },
    cancelCapture() { state.capture = null; },
    moveFocus, focusables,
    rumble,
    getGameConfig, setGameConfig,
    snapshot() {
      const gp = readPads().find(g => g.index === state.activeIndex);
      if (!gp) return null;
      return { id: gp.id, name: cleanName(gp.id), type: detectType(gp.id), mapping: gp.mapping,
               buttons: gp.buttons.map(b => ({ pressed: b.pressed, value: b.value })), axes: Array.from(gp.axes) };
    }
  };
})();
