/* Mayhem Games — servidor (Render Web Service)
   1) serve o launcher e os jogos (pasta /public)
   2) faz a SINALIZAÇÃO online (protocolo PeerJS sobre WebSocket) no mesmo endereço do site —
      é o que o Stickman Mayhem usa para criar/entrar em salas com código.
   A partida em si trafega por WebRTC direto entre os jogadores; este servidor só apresenta um ao outro
   (não guarda nada em disco e não vê o jogo). Só depende do pacote "ws". */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public');
const KEY = 'peerjs';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.txt': 'text/plain; charset=utf-8'
};

/* ---------------- arquivos estáticos ---------------- */
const server = http.createServer((req, res) => {
  let url;
  try { url = decodeURIComponent((req.url || '/').split('?')[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok'); }
  if (url === '/peerjs' || url === '/peerjs/') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ name: 'Mayhem Games signaling', description: 'PeerJS-compatible' })); }
  if (url.endsWith('/')) url += 'index.html';
  const file = path.normalize(path.join(ROOT, url));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403); return res.end(); }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Não encontrado'); }
    const ext = path.extname(file).toLowerCase();
    const h = {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'gamepad=(self), fullscreen=(self), autoplay=(self)',
      'Cache-Control': /\.(html|js|css|webmanifest)$/.test(ext) ? 'no-cache' : (url.startsWith('/assets/') ? 'public, max-age=604800' : 'public, max-age=3600')
    };
    const ae = String(req.headers['accept-encoding'] || '');
    const stream = fs.createReadStream(file);
    if (/\.(html|js|css|json|webmanifest|svg|txt)$/.test(ext) && /\bgzip\b/.test(ae)) {
      h['Content-Encoding'] = 'gzip'; h['Vary'] = 'Accept-Encoding';
      res.writeHead(200, h); stream.pipe(require('zlib').createGzip()).pipe(res);
    } else { h['Content-Length'] = st.size; res.writeHead(200, h); stream.pipe(res); }
    stream.on('error', () => res.destroy());
  });
});

/* ---------------- sinalização (protocolo PeerJS) ---------------- */
const peers = new Map(); // id -> { ws, token }
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

server.on('upgrade', (req, socket, head) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname !== '/peerjs') { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req, u));
});

wss.on('connection', (ws, req, u) => {
  const id = u.searchParams.get('id') || '', token = u.searchParams.get('token') || '', key = u.searchParams.get('key') || '';
  const send = (w, o) => { try { if (w.readyState === 1) w.send(JSON.stringify(o)); } catch (e) {} };
  if (key !== KEY) { send(ws, { type: 'ERROR', payload: { msg: 'Invalid key.' } }); return ws.close(); }
  if (!/^[\w.-]{1,64}$/.test(id) || !token) { send(ws, { type: 'ERROR', payload: { msg: 'Invalid id.' } }); return ws.close(); }
  const old = peers.get(id);
  if (old && old.token !== token) { send(ws, { type: 'ID-TAKEN', payload: { msg: 'ID is taken' } }); return ws.close(); }
  if (old) try { old.ws.terminate(); } catch (e) {}
  peers.set(id, { ws, token });
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, { type: 'OPEN' });

  ws.on('message', raw => {
    ws.isAlive = true;
    let m; try { m = JSON.parse(raw.toString()); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    const t = m.type;
    if (t === 'HEARTBEAT') return;
    if (!['OFFER', 'ANSWER', 'CANDIDATE', 'LEAVE', 'EXPIRE'].includes(t) || typeof m.dst !== 'string') return;
    const dst = peers.get(m.dst);
    if (dst && dst.ws.readyState === 1) send(dst.ws, { type: t, src: id, dst: m.dst, payload: m.payload });
    else if (t === 'OFFER') send(ws, { type: 'EXPIRE', src: m.dst, dst: id }); // sala/jogador não existe
  });
  ws.on('close', () => { const p = peers.get(id); if (p && p.ws === ws) peers.delete(id); });
  ws.on('error', () => {});
});

// derruba conexões mortas (o Render também usa isso para manter o socket vivo)
setInterval(() => wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) {} }), 30000);

server.listen(PORT, () => console.log('Mayhem Games no ar na porta ' + PORT));
