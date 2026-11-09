// 고구마배구 서버: 게임 파일을 내려주고, 방마다 규칙(rules.js)을 돌려 두 사람에게 상태를 보냅니다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const rules = require('./public/rules.js');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const FRAME = 1000 / 60;
const MAX_ROOMS = 200;
const NAME_LENGTH = 8;
const ONLINE_MODES = ['versus', 'coop'];
const TARGETS = [7, 11, 15];

const INPUT = { left: 1, right: 2, up: 4, down: 8, jump: 16, attack: 32, special: 64 };
const PLAYER_FIELDS = ['x', 'y', 'vy', 'facing', 'look', 'onGround', 'gauge', 'rage', 'charge', 'slowing', 'dash', 'dashSpent', 'dive', 'lock', 'spike', 'cooldown', 'contactGap'];
const MAX_LAG_FRAMES = 12;
// 시험용: TEST_LAG=100 이면 오가는 메시지를 100ms씩 늦춰 느린 인터넷을 흉내 내요.
const TEST_LAG = Number(process.env.TEST_LAG) || 0;

const rooms = new Map();

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const name = url === '/' ? 'index.html' : path.basename(url);
  const type = TYPES[path.extname(name)];
  if (!type) { res.writeHead(404); res.end(); return; }
  fs.readFile(path.join(PUBLIC, name), (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
});

function send(ws, message) {
  if (!ws || ws.readyState !== 1) return;
  const text = JSON.stringify(message);
  if (TEST_LAG) setTimeout(() => ws.readyState === 1 && ws.send(text), TEST_LAG);
  else ws.send(text);
}

function broadcast(room, message) {
  room.seats.forEach(seat => seat && send(seat.ws, message));
}

function newCode() {
  for (;;) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    if (!rooms.has(code)) return code;
  }
}

function makeSeat(ws, name) {
  return { ws, name: cleanName(name), pick: 0, ready: false, mask: 0, attack: false, special: false, again: false, seq: 0, seqAge: 0, rtt: 0 };
}

function cleanName(name) {
  return String(name || '').trim().slice(0, NAME_LENGTH) || '손님';
}

function sendRoom(room) {
  const seats = room.seats.map(s => s && { name: s.name, pick: s.pick, ready: s.ready });
  room.seats.forEach((seat, i) => seat && send(seat.ws, {
    t: 'room', code: room.code, seat: i, seats,
    mode: room.mode, target: room.target, deuce: room.deuce,
  }));
}

function startMatch(room) {
  const picks = room.seats.map(s => s.pick);
  const chars = picks.map(p => rules.CHARACTERS[p] || rules.CHARACTERS[Math.floor(Math.random() * rules.CHARACTERS.length)]);
  room.match = rules.makeMatch(chars, room.target, [null, null], room.deuce, room.mode);
  room.match.phase = 'intro';
  room.match.timer = rules.TIMERS.intro;
  room.seats.forEach(s => { s.again = false; s.attack = false; s.special = false; });
  room.last = Date.now();
  room.spare = 0;
  room.frame = 0;
  room.overSent = false;
  broadcast(room, {
    t: 'start', chars: chars.map(c => rules.CHARACTERS.indexOf(c)),
    names: room.seats.map(s => s.name), mode: room.mode, target: room.target, deuce: room.deuce,
  });
}

function readSeat(seat) {
  const m = seat.mask;
  const input = {
    left: !!(m & INPUT.left), right: !!(m & INPUT.right),
    up: !!(m & INPUT.up), down: !!(m & INPUT.down), jump: !!(m & INPUT.jump),
    attack: seat.attack, attackHeld: !!(m & INPUT.attack),
    special: !!(m & INPUT.special), specialPressed: seat.special,
  };
  seat.attack = false;
  seat.special = false;
  seat.seqAge++;
  return input;
}

function snapshot(room) {
  const s = room.match;
  const events = s.events.slice();
  s.events.length = 0;
  return {
    t: 's',
    p: s.players.map(p => {
      const out = {};
      for (const key of PLAYER_FIELDS) out[key] = p[key];
      out.swing = p.swing && { dir: p.swing.dir, age: p.swing.age };
      return out;
    }),
    b: s.balls.map(b => ({ x: b.x, y: b.y, slow: b.slow })),
    score: s.score, phase: s.phase, timer: s.timer, server: s.server,
    clock: s.clock, stage: s.stage, cleared: s.cleared, notice: s.notice, env: s.env,
    events,
    ack: room.seats.map(seat => [seat.seq, seat.seqAge]),
    ping: room.seats.map(seat => Math.round(seat.rtt)),
  };
}

function leaveRoom(ws) {
  const room = ws.room;
  if (!room) return;
  ws.room = null;
  const i = room.seats.findIndex(s => s && s.ws === ws);
  if (i >= 0) room.seats[i] = null;
  room.match = null;
  room.overSent = false;
  room.seats.forEach(s => {
    if (!s) return;
    s.ready = false;
    s.mask = 0;
    s.again = false;
  });
  if (!room.seats[0] && !room.seats[1]) { rooms.delete(room.code); return; }
  broadcast(room, { t: 'left' });
  sendRoom(room);
}

function handle(ws, msg) {
  const room = ws.room;
  const seat = room && room.seats.find(s => s && s.ws === ws);

  if (msg.t === 'create') {
    if (room) return;
    if (rooms.size >= MAX_ROOMS) { send(ws, { t: 'error', text: '지금은 방이 꽉 찼어요. 조금 뒤에 다시 해주세요.' }); return; }
    const made = { code: newCode(), seats: [makeSeat(ws, msg.name), null], mode: 'versus', target: 7, deuce: false, match: null };
    rooms.set(made.code, made);
    ws.room = made;
    sendRoom(made);
  } else if (msg.t === 'join') {
    if (room) return;
    const found = rooms.get(String(msg.code));
    if (!found) { send(ws, { t: 'error', text: '그 코드의 방을 찾지 못했어요. 코드를 다시 확인해주세요.' }); return; }
    const free = found.seats.indexOf(null);
    if (free < 0) { send(ws, { t: 'error', text: '이미 두 사람이 있는 방이에요.' }); return; }
    found.seats[free] = makeSeat(ws, msg.name);
    ws.room = found;
    sendRoom(found);
  } else if (!seat) {
    return;
  } else if (msg.t === 'leave') {
    leaveRoom(ws);
    send(ws, { t: 'closed' });
  } else if (msg.t === 'pong') {
    const sample = Math.min(400, Math.max(0, Date.now() - Number(msg.s)));
    if (sample >= 0) seat.rtt = seat.rtt ? seat.rtt * 0.7 + sample * 0.3 : sample;
  } else if (msg.t === 'i') {
    const mask = Number(msg.m) & 127;
    seat.seq = Number(msg.n) || 0;
    seat.seqAge = 0;
    if (mask & ~seat.mask & INPUT.attack) seat.attack = true;
    if (mask & ~seat.mask & INPUT.special) seat.special = true;
    seat.mask = mask;
  } else if (room.match) {
    if (msg.t === 'again' && room.match.phase === 'over') {
      seat.again = true;
      if (room.seats[0].again && room.seats[1].again) startMatch(room);
    }
  } else if (msg.t === 'pick' && !seat.ready) {
    const pick = Number(msg.pick);
    if (Number.isInteger(pick) && pick >= 0 && pick <= rules.CHARACTERS.length) { seat.pick = pick; sendRoom(room); }
  } else if (msg.t === 'ready') {
    seat.ready = !seat.ready;
    if (room.seats[0] && room.seats[1] && room.seats[0].ready && room.seats[1].ready) {
      room.seats.forEach(s => { s.ready = false; });
      startMatch(room);
    } else sendRoom(room);
  } else if (msg.t === 'settings' && room.seats[0] === seat) {
    if (ONLINE_MODES.includes(msg.mode)) room.mode = msg.mode;
    if (TARGETS.includes(msg.target)) room.target = msg.target;
    room.deuce = !!msg.deuce;
    sendRoom(room);
  }
}

function tick() {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (!room.match || room.overSent) continue; // 끝난 경기는 더 보낼 게 없어요
    room.spare = Math.min(room.spare + now - room.last, FRAME * 6);
    room.last = now;
    // 왕복 시간만큼 공을 되돌려 보고 맞았는지 판정해요.
    room.match.lag = room.seats.map(seat => Math.min(MAX_LAG_FRAMES, Math.round(seat.rtt / FRAME) + 2));
    while (room.spare >= FRAME) {
      rules.step(room.match, room.seats.map(readSeat));
      room.spare -= FRAME;
      room.frame++;
      broadcast(room, snapshot(room));
      room.overSent = room.match.phase === 'over';
    }
  }
}

const wss = new WebSocketServer({ server, maxPayload: 1024 });
wss.on('connection', ws => {
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('close', () => leaveRoom(ws));
  ws.on('error', () => leaveRoom(ws));
  ws.on('message', data => {
    let msg;
    try { msg = JSON.parse(data); } catch (e) { return; }
    if (!msg || typeof msg !== 'object') return;
    if (TEST_LAG) setTimeout(() => handle(ws, msg), TEST_LAG);
    else handle(ws, msg);
  });
});

// 끊어진 연결을 정리해요.
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.alive) { ws.terminate(); return; }
    ws.alive = false;
    ws.ping();
  });
}, 20000);
setInterval(tick, 8);
// 1초마다 왕복 시간을 재요.
setInterval(() => {
  for (const room of rooms.values()) room.seats.forEach(seat => seat && send(seat.ws, { t: 'ping', s: Date.now() }));
}, 1000);

server.listen(PORT, () => console.log(`고구마배구 서버: http://localhost:${PORT}`));
