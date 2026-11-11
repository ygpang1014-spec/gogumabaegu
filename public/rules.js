
// ── 수치 ── 조정은 여기서만 하면 돼요. 새 캐릭터는 CHARACTERS에 하나 추가합니다.
const W = 960, H = 540, GROUND = 470;
const NET = { x: 480, halfW: 6, top: 370 };
const BALL = { r: 20, gravity: 0.32, wallBounce: 0.9, netBounce: 0.75, maxSpeed: 20, serveHeight: 140 };
const TIMERS = { intro: 150, ready: 70, point: 80 };

const BASE = {
  move: 5,
  jump: 12.5,
  gravity: 0.52,
  halfW: 28,
  height: 76,
  swingActive: 10, // 공을 칠 수 있는 프레임
  swingTotal: 22,  // 다음 공격까지 걸리는 프레임
  zoneScale: 1,    // 공격 범위 배율
  shots: {
    side: { vx: 8, vy: -8 },
    up: { vx: 3, vy: -14 },
    down: { vx: 6, vy: 13.5 },
  },
  zones: {
    side: { dx: 50, dy: -38, r: 46 },
    up: { dx: 8, dy: -102, r: 48 },
    down: { dx: 22, dy: -4, r: 58 },
  },
};

// 60프레임이 1초예요. gauge는 공을 칠 때 차는 양(1이면 가득)입니다.
const CHARACTERS = [
  {
    ...BASE, id: 'goguma', name: '고구마',
    colors: { skin: '#9a3a72', edge: '#6f2653', face: '#f6c64a' },
    ability: ['능력이 없는 기본 캐릭터예요.'],
  },
  {
    ...BASE, id: 'cheese', name: '치즈',
    colors: { skin: '#f4c430', edge: '#b98a12', face: '#fde88a' },
    groundUpSlow: 0.6,
    gauge: { side: 0.2 },
    special: 'slowTime', slowScale: 0.3, slowFrames: 200, // 필살기 최대 길이(프레임)
    ability: ['땅에서 위로 치면 공이 감속돼요(파란색). 뜨는 높이는 같아요.', '점프해서 위로 치면 감속되지 않아요.', '필살기: 누르는 동안 모든 공이 감속돼요. 최대 약 3.3초.', '게이지는 좌우 공격으로 차요.'],
  },
  {
    ...BASE, id: 'watermelon', name: '수박',
    colors: { skin: '#2f8f4e', edge: '#1b5c31', face: '#f0606a' },
    charge: { mid: 42, strong: 72, midPower: 1.25, strongPower: 1.5 },
    gauge: { side: 0.15, up: 0.15, down: 0.15 },
    special: 'rage', rageFrames: 300,
    ability: ['공격 키를 꾹 눌렀다 떼면 세게 쳐요.', '0.7초 이상은 중, 1.2초 이상은 강.', '필살기: 5초 동안 충전 없이 항상 강으로 쳐요.', '게이지는 공을 칠 때마다 차요.'],
  },
  {
    ...BASE, id: 'cabbage', name: '배추',
    colors: { skin: '#8fce5c', edge: '#4f8f33', face: '#eef7d2' },
    zoneScale: 1.2,
    gauge: { side: 0.34 },
    special: 'wide', wideReach: 60, wideSpeed: 13,
    ability: ['모든 공격의 범위가 조금 넓어요.', '필살기: 바로 공격해요. 범위가 내 코트 전체지만 높이는 맞아야 해요.', '필살기에 맞은 공은 무조건 상대 코트로 빠르게 넘어가요.', '게이지는 좌우 공격으로 차요.'],
  },
  {
    ...BASE, id: 'coconut', name: '코코넛',
    colors: { skin: '#6a4227', edge: '#3f2615', face: '#f7eedd' },
    contact: true, bodyR: 34, contactGap: 14,
    bounce: { vx: 8.5, vy: -13, keep: 0.3 }, // 몸에 닿아 튕길 때 (전에는 vx 7, vy -10)
    spike: { window: 10, flat: { vx: 14, vy: 3 }, up: { vx: 11, vy: -7 }, down: { vx: 8, vy: 12 } },
    dive: { frames: 22, speed: 9, recover: 14 },
    ability: ['공격 키 없이 몸에 닿으면 공이 튕겨요.', '공격 키는 스킬이에요.', '공중: 맞는 순간 강하게 스파이크. 위·아래 키로 방향을 정해요.', '땅: 보는 쪽으로 몸을 날려요.', '필살기는 없어요.'],
  },
  {
    ...BASE, id: 'blueberry', name: '블루베리',
    move: 6.2, zoneScale: 0.85,
    colors: { skin: '#3f4fa8', edge: '#28316e', face: '#c8d0f5' },
    autoGauge: 150,
    special: 'dash', dashFrames: 16, dashSpeed: 14, dashR: 44, dashBoost: 1.6, dashBoostFrames: 90,
    ability: ['이동이 조금 빠른 대신 공격 범위가 조금 작아요.', '스킬: 보는 쪽으로 대시하고, 공에 닿으면 좌우 공격이 돼요.', '대시로 친 공은 잠깐 가속돼요(빨간색).', '게이지는 2.5초면 저절로 차요.'],
  },
  {
    ...BASE, id: 'tomato', name: '토마토',
    colors: { skin: '#ef4a36', edge: '#a8281b', face: '#ffd0c4' },
    bareFace: true, // 얼굴 판 없이 몸에 바로 눈을 그려요
    gauge: { side: 0.25 }, // 배추(0.34)보다 조금 느리게 차요
    special: 'tomato',
    toss: { frames: 24, height: 150, speed: 15 }, // 스파이크: 띄우고 24프레임 뒤에 쳐요
    ability: ['필살기: 토마토공을 만들어 바로 쳐요. 위를 누르면 위로, 아래를 누르면 스파이크.', '스파이크는 공을 띄우고 잠깐 뒤에 쳐요. 그 사이 상대가 맞히면 토마토공이 터져요.', '상대가 토마토공을 쳐서 받으면 터져요. 못 받고 상대 코트에 떨어지면 내 득점.', '게이지는 좌우 공격으로 차요.'],
  },
  {
    ...BASE, id: 'corn', name: '옥수수',
    colors: { skin: '#f7d34a', edge: '#b88d14', face: '#fff3c0' },
    jump: 14.5, jumpCut: 5, // 점프 키를 일찍 떼면 낮게 떠요
    gun: {
      max: 4, reload: 54, gap: 10,   // 탄창 4칸, 0.9초마다 1칸, 연사 간격
      speed: 13, r: 7, upAngle: 35, downAngle: 30,
      slowFrames: 90, slowMove: 0.55, // 맞은 상대는 1.5초 동안 느려져요
      ultCost: 3, ultPower: 1.4, ultSpeed: 16, ultR: 12,
    },
    ability: ['공격 키로 보는 쪽에 옥수수 총알을 쏴요. 공에 맞으면 공격처럼 쳐져요.', '위를 보면 조금 위로, 점프 중 아래를 보면 조금 아래로 쏴요. 네트에 닿으면 사라져요.', '탄창 4칸은 저절로 차요. 총알에 맞은 상대는 잠깐 느려져요.', '점프가 높고, 오래 누를수록 높이 떠요.', '필살기: 총알 3개로 센 총알. 공은 세게 쳐지고, 상대가 맞으면 그 판은 내 득점.'],
  },
];

// ── 모드 ──
const MODES = [
  { id: 'versus', name: '대결 모드', note: '듀스를 켜면 목표 점수 1점 전에 동점이 된 뒤로 2점을 앞서야 이겨요.' },
  { id: 'coop', name: '공지키기', note: '둘이 힘을 합쳐 공을 떨어뜨리지 않고 버텨요. 정해진 시간마다 방해가 더해져요.' },
  { id: 'free', name: '자유 모드', note: '점수도 끝도 없어요. 경기 중 Tab을 누르면 시간이 멈추고 공과 네트, 바람을 마음대로 바꿀 수 있어요. 득점하면 멈추고, 공격 키를 눌러야 다시 시작해요.' },
];

const BASE_ENV = { speed: 1, gravity: BALL.gravity, wind: 0, gust: 0, netGoal: NET.top, ballR: BALL.r, count: 1 };

// 공지키기 방해 단계: 순서와 시간이 항상 같아요. at은 버틴 초입니다.
const COOP_STAGES = [
  { at: 15, text: '공이 빨라져요', set: { speed: 1.2 } },
  { at: 30, text: '바람이 불어요 →', set: { wind: 0.03 } },
  { at: 45, text: '네트가 올라가요', set: { netGoal: 320 } },
  { at: 60, text: '공이 하나 늘어요', set: { count: 2 } },
  { at: 80, text: '바람 방향이 바뀌어요 ←', set: { wind: -0.05 } },
  { at: 100, text: '공이 더 빨라져요', set: { speed: 1.4 } },
  { at: 120, text: '네트가 더 올라가요', set: { netGoal: 270 } },
  { at: 140, text: '공이 작아져요', set: { ballR: 14 } },
  { at: 160, text: '돌풍이 불어요', set: { wind: 0, gust: 0.07 } },
  { at: 180, text: '공이 하나 더 늘어요', set: { count: 3 } },
  { at: 210, text: '공이 아주 빨라져요', set: { speed: 1.6 } },
  { at: 240, text: '네트가 끝까지 올라가요', set: { netGoal: 230 } },
  { at: 270, text: '돌풍이 거세져요', set: { gust: 0.1 } },
];
const COOP_GOAL = 300;

// 자유 모드 설정 항목
const TUNERS = [
  { key: 'speed', label: '공 속도', min: 0.4, max: 2, step: 0.1 },
  { key: 'gravity', label: '중력', min: 0.12, max: 0.6, step: 0.02 },
  { key: 'count', label: '공 개수', min: 1, max: 5, step: 1 },
  { key: 'ballR', label: '공 크기', min: 10, max: 40, step: 2 },
  { key: 'wind', label: '바람', min: -0.1, max: 0.1, step: 0.01 },
  { key: 'gust', label: '돌풍', min: 0, max: 0.12, step: 0.01 },
  { key: 'netGoal', label: '네트 높이', min: 230, max: 440, step: 10, flip: true },
];

// 캐릭터 고르기 맨 끝 칸. 경기가 시작될 때 진짜 캐릭터로 정해져요.
const RANDOM_PICK = { id: 'random', name: '랜덤', ability: ['경기가 시작될 때 캐릭터 하나가 무작위로 골라져요.'] };

// ── 규칙과 물리 ──
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function makePlayer(side, char, prev) {
  return {
    side, char,
    x: side === 0 ? 200 : 760, y: GROUND, vy: 0,
    facing: side === 0 ? 1 : -1,
    look: 'side',
    onGround: true,
    swing: null,
    cooldown: 0,
    gauge: prev ? prev.gauge : 0,
    rage: prev ? prev.rage : 0,
    charge: 0,
    slowing: false,
    dash: 0,      // 블루베리 대시 남은 프레임
    dashSpent: false,
    dive: 0,      // 코코넛 다이브 남은 프레임
    lock: 0,      // 다이브 뒤 경직
    spike: 0,     // 코코넛 스파이크 입력이 살아 있는 프레임
    contactGap: 0,
    toss: 0,      // 토마토 스파이크 준비 남은 프레임
    ammo: char.gun ? char.gun.max : 0,
    reload: 0,
    fireCd: 0,
    slowed: 0,    // 옥수수 총알에 맞아 느려진 남은 프레임
  };
}

function makeMatch(chars, target, levels = [null, null], deuce = false, mode = 'versus', settings = null) {
  const s = { chars, target, deuce, score: [0, 0], server: 0, events: [], players: [null, null], bullets: [], touch: 0, rally: 0, ai: levels.map(makeAi), mode, clock: 0, stage: 0, cleared: false, notice: null };
  s.env = { ...BASE_ENV, ...settings, windNow: 0, netTop: NET.top };
  s.env.netTop = s.env.netGoal;
  resetRound(s);
  return s;
}

function resetRound(s) {
  s.players = s.players.map((prev, i) => makePlayer(i, s.chars[i], prev));
  s.balls = [makeBall(s.server === 0 ? 240 : 720)];
  syncBalls(s);
  s.bullets = [];
  s.touch++;
  s.rally = 0;
  s.phase = 'ready';
  s.timer = TIMERS.ready;
}

function makeBall(x) {
  return { x, y: BALL.serveHeight, vx: 0, vy: 0, slow: 1 };
}

function makeTomato(p, x, y) {
  return { ...makeBall(x), y, kind: 'tomato', owner: p.side };
}

// 상대가 토마토공을 치면 바로 터져요.
function popIfFoe(s, p, b) {
  if (b.kind !== 'tomato' || b.owner === p.side) return false;
  removeBall(s, b);
  s.touch++;
  return true;
}

function removeBall(s, b) {
  const i = s.balls.indexOf(b);
  if (i >= 0) s.balls.splice(i, 1);
  s.events.push({ type: 'pop', x: b.x, y: b.y });
}

// 공 개수를 설정에 맞춰요. 새 공은 양쪽 코트에 번갈아 떨어져요. 토마토공은 세지 않아요.
function syncBalls(s) {
  const normal = s.balls.filter(b => !b.kind), extra = s.balls.filter(b => b.kind);
  while (normal.length < s.env.count) normal.push(makeBall(normal.length % 2 ? 720 : 240));
  normal.length = s.env.count;
  s.balls = normal.concat(extra);
}

function hitZone(p) {
  return zoneFor(p, p.swing.dir);
}

function zoneFor(p, dir) {
  const z = p.char.zones[dir];
  const k = p.char.zoneScale;
  return { x: p.x + z.dx * k * p.facing, y: p.y + z.dy * k, r: z.r * k };
}

// 배추 필살기 범위: 내 코트 전체 너비, 높이는 몸 높이 근처만
function wideZone(p) {
  const c = p.char;
  return {
    left: p.side === 0 ? 0 : NET.x, right: p.side === 0 ? NET.x : W,
    top: p.y - c.height - c.wideReach, bottom: p.y + c.wideReach,
  };
}

function inSwingRange(s, p, b) {
  if (p.swing.dir === 'wide') {
    const z = wideZone(p);
    return b.x >= z.left && b.x <= z.right && b.y >= z.top && b.y <= z.bottom;
  }
  const z = hitZone(p);
  return Math.hypot(b.x - z.x, b.y - z.y) < z.r + s.env.ballR;
}

function addGauge(p, shot) {
  const fill = p.char.gauge && p.char.gauge[shot];
  if (fill && p.rage === 0 && !p.slowing) p.gauge = Math.min(1, p.gauge + fill);
}

// 배추 필살기: 보는 방향과 상관없이 상대 코트로 가장 빨리 넘어가는 궤적을 찾아요.
function wideShot(s, p, b, top = p.char.wideSpeed) {
  const toward = p.side === 0 ? 1 : -1;
  // 넘길 궤적이 없을 만큼 네트에 붙었거나 설정이 극단적이면 네트를 뚫고 넘어가요.
  for (const ghost of [0, toward]) {
    let best = null, soonest = Infinity;
    for (let speed = top; speed >= 3; speed -= 2) {
      for (let vy = -3; vy >= -19; vy--) {
        const end = predict({ x: b.x, y: b.y, vx: speed * toward, vy, ghost }, s.env.speed, s.env);
        if ((end.x - NET.x) * toward <= 0) continue;
        const cross = end.path.findIndex(spot => !onMySide(p, spot.x));
        if (cross < soonest) { best = { vx: speed * toward, vy, ghost }; soonest = cross; }
      }
    }
    if (best) return best;
  }
  return { vx: 6 * toward, vy: -19, ghost: toward };
}

// 토마토 스파이크: 상대 코트로 넘어가는 가장 가파른 내리꽂기
function spikeShot(s, p, b) {
  const toward = p.side === 0 ? 1 : -1, speed = p.char.toss.speed;
  for (let vy = 12; vy >= -10; vy--) {
    const end = predict({ x: b.x, y: b.y, vx: speed * toward, vy }, s.env.speed, s.env);
    if ((end.x - NET.x) * toward > 0) return { vx: speed * toward, vy };
  }
  return wideShot(s, p, b, speed);
}

// 온라인: 내 화면에 보이던 조금 전 위치의 공에 닿았어도 맞은 걸로 쳐요.
function touches(s, p, b, test) {
  if (test(b)) return true;
  const lag = s.lag && b.hist ? Math.min(s.lag[p.side], b.hist.length) : 0;
  for (let k = 0; k < lag; k++) if (test(b.hist[k])) return true;
  return false;
}

function sendBall(s, p, b, dir, power, slow, facing = p.facing) {
  if (popIfFoe(s, p, b)) { s.events.push({ type: 'hit', dir, x: b.x, y: b.y }); return; }
  const aimed = dir === 'wide' || dir === 'spike';
  const shot = dir === 'wide' ? wideShot(s, p, b) : dir === 'spike' ? spikeShot(s, p, b) : p.char.shots[dir];
  b.vx = aimed ? shot.vx : shot.vx * power * facing;
  b.vy = aimed ? shot.vy : shot.vy * power;
  b.held = false;
  b.ghost = shot.ghost || 0;
  b.slow = slow;
  b.boost = 0;
  b.hist = [];
  s.touch++;
  s.rally++;
  addGauge(p, dir);
  s.events.push({ type: 'hit', dir, x: b.x, y: b.y });
}

function startSwing(s, p, power) {
  // 땅에서 아래를 보고 치면 내려찍기 대신 좌우 치기가 나가요.
  const dir = p.look === 'down' && p.onGround ? 'side' : p.look;
  p.swing = { dir, age: 0, struck: [], power, grounded: p.onGround };
  p.cooldown = p.char.swingTotal;
  s.events.push({ type: 'swing', side: p.side });
}

function updateAttack(s, p, input) {
  const c = p.char;
  if (c.charge && p.rage === 0) {
    // 수박: 누르는 동안 충전, 떼는 순간 때려요.
    if (input.attackHeld) p.charge++;
    else if (p.charge > 0) {
      const power = p.charge >= c.charge.strong ? c.charge.strongPower : p.charge >= c.charge.mid ? c.charge.midPower : 1;
      if (p.cooldown === 0) startSwing(s, p, power);
      p.charge = 0;
    }
  } else if (input.attack && p.cooldown === 0) {
    p.charge = 0;
    startSwing(s, p, c.charge ? c.charge.strongPower : 1);
  }
  if (!p.swing) return;
  if (s.phase === 'play' && p.swing.age < c.swingActive) {
    const slow = c.groundUpSlow && p.swing.dir === 'up' && p.swing.grounded ? c.groundUpSlow : 1;
    for (const b of s.balls) {
      if (p.swing.struck.includes(b) || !touches(s, p, b, x => inSwingRange(s, p, x))) continue;
      sendBall(s, p, b, p.swing.dir, p.swing.power, slow);
      p.swing.struck.push(b);
    }
  }
  if (++p.swing.age >= c.swingTotal) p.swing = null;
}

function updateContact(s, p, input) {
  const c = p.char;
  if (input.attack && s.phase === 'play' && p.lock === 0 && p.dive === 0) {
    if (p.onGround) p.dive = c.dive.frames;
    else p.spike = c.spike.window;
    s.events.push({ type: 'swing', side: p.side });
  }
  if (p.spike > 0) p.spike--;
  if (p.contactGap > 0) p.contactGap--;
  if (s.phase !== 'play' || p.contactGap > 0) return;
  const reach = c.bodyR + (p.dive > 0 ? 14 : 0);
  const r = s.env.ballR;
  const b = s.balls.find(x => touches(s, p, x, y => Math.hypot(y.x - p.x, y.y - (p.y - 38)) < reach + r));
  if (!b) return;
  p.contactGap = c.contactGap;
  if (popIfFoe(s, p, b)) { s.events.push({ type: 'hit', dir: 'side', x: b.x, y: b.y }); return; }
  const toward = p.side === 0 ? 1 : -1;
  b.held = false;
  b.slow = 1;
  b.boost = 0;
  b.hist = [];
  s.touch++;
  s.rally++;
  if (p.spike > 0 && !p.onGround) {
    const aim = input.up ? c.spike.up : input.down ? c.spike.down : c.spike.flat;
    b.vx = aim.vx * toward;
    b.vy = aim.vy;
    p.spike = 0;
    s.events.push({ type: 'hit', dir: 'down', x: b.x, y: b.y });
  } else {
    const offset = clamp((b.x - p.x) / (c.bodyR + r), -1, 1);
    b.vx = clamp(b.vx * c.bounce.keep + offset * c.bounce.vx, -c.bounce.vx * 1.4, c.bounce.vx * 1.4);
    b.vy = c.bounce.vy;
    s.events.push({ type: 'hit', dir: 'side', x: b.x, y: b.y });
  }
}

function updateSpecial(s, p, input) {
  const c = p.char;
  if (c.autoGauge && s.phase === 'play' && p.dash === 0) p.gauge = Math.min(1, p.gauge + 1 / c.autoGauge);
  if (p.rage > 0 && s.phase === 'play') {
    p.rage--;
    p.gauge = p.rage / c.rageFrames;
  }
  if (c.special === 'slowTime') {
    if (p.slowing && (!input.special || p.gauge <= 0 || s.phase !== 'play')) p.slowing = false;
    else if (!p.slowing && input.specialPressed && p.gauge >= 1 && s.phase === 'play') {
      p.slowing = true;
      s.events.push({ type: 'special', side: p.side });
    }
    if (p.slowing) p.gauge = Math.max(0, p.gauge - 1 / c.slowFrames);
    return;
  }
  if (!c.special || !input.specialPressed || p.gauge < 1 || p.rage > 0 || s.phase !== 'play') return;
  if (c.special === 'tomato' && s.mode === 'coop') return; // 공지키기에서는 토마토공을 못 만들어요
  s.events.push({ type: 'special', side: p.side });
  if (c.special === 'rage') {
    p.rage = c.rageFrames;
  } else if (c.special === 'wide') {
    p.gauge = 0;
    p.swing = { dir: 'wide', age: 0, struck: [], power: 1, grounded: p.onGround };
    p.cooldown = c.swingTotal;
  } else if (c.special === 'dash') {
    p.gauge = 0;
    p.dash = c.dashFrames;
    p.dashSpent = false;
    p.swing = null;
  } else if (c.special === 'tomato') {
    p.gauge = 0;
    p.swing = null;
    if (p.look === 'down') {
      // 스파이크: 머리 위로 띄우고 잠깐 뒤에 쳐요.
      const b = makeTomato(p, p.x + p.facing * 12, p.y - c.toss.height);
      b.held = true;
      s.balls.push(b);
      p.toss = c.toss.frames;
      p.tossBall = b;
    } else {
      const dir = p.look === 'up' ? 'up' : 'side';
      const z = zoneFor(p, dir);
      const b = makeTomato(p, clamp(z.x, 30, W - 30), z.y);
      s.balls.push(b);
      sendBall(s, p, b, dir, 1, 1);
      p.gauge = 0; // 필살기로 친 공은 게이지를 채우지 않아요
    }
  }
}

function updateToss(s, p) {
  if (--p.toss > 0 || !p.tossBall) return;
  const b = p.tossBall;
  p.tossBall = null;
  if (s.phase === 'play' && b.held && s.balls.includes(b)) {
    sendBall(s, p, b, 'spike', 1, 1);
    p.swing = { dir: 'down', age: 0, struck: [b], power: 1, grounded: p.onGround };
  }
}

// ── 옥수수 총 ──
function bulletAim(p, dir, strong) {
  const g = p.char.gun, speed = strong ? g.ultSpeed : g.speed;
  const deg = dir === 'up' ? -g.upAngle : dir === 'down' ? g.downAngle : 0;
  const a = deg * Math.PI / 180;
  return {
    x: p.x + p.facing * 30, y: p.y - 44,
    vx: Math.cos(a) * speed * p.facing, vy: Math.sin(a) * speed,
    r: strong ? g.ultR : g.r, dir, facing: p.facing, side: p.side, strong,
  };
}

function gunDir(p) {
  return p.look === 'up' ? 'up' : p.look === 'down' && !p.onGround ? 'down' : 'side';
}

function updateGun(s, p, input) {
  const g = p.char.gun;
  if (p.ammo < g.max) { if (++p.reload >= g.reload) { p.ammo++; p.reload = 0; } } else p.reload = 0;
  if (p.fireCd > 0) p.fireCd--;
  if (s.phase !== 'play' || p.fireCd > 0) return;
  const strong = input.specialPressed && p.ammo >= g.ultCost;
  if (!strong && !(input.attack && p.ammo >= 1)) return;
  s.bullets.push(bulletAim(p, gunDir(p), strong));
  p.ammo -= strong ? g.ultCost : 1;
  p.fireCd = g.gap;
  s.events.push({ type: strong ? 'special' : 'shot', side: p.side });
}

// 총알이 네트에 닿았는지
function bulletBlocked(u, env) {
  return Math.abs(u.x - NET.x) < NET.halfW + u.r && u.y + u.r > env.netTop;
}

function updateBullets(s) {
  for (const u of s.bullets.slice()) {
    const owner = s.players[u.side], foe = s.players[1 - u.side], g = owner.char.gun;
    u.x += u.vx;
    u.y += u.vy;
    let gone = u.x < -20 || u.x > W + 20 || u.y < -20 || u.y > GROUND || bulletBlocked(u, s.env);
    const b = !gone && s.balls.find(x => Math.hypot(x.x - u.x, x.y - u.y) < s.env.ballR + u.r);
    if (b) {
      sendBall(s, owner, b, u.dir, u.strong ? g.ultPower : 1, 1, u.facing);
      gone = true;
    } else if (!gone && s.mode !== 'coop' && Math.hypot(foe.x - u.x, foe.y - 38 - u.y) < 30 + u.r) {
      gone = true;
      s.events.push({ type: 'zap', x: u.x, y: u.y, strong: u.strong });
      if (u.strong) { scorePoint(s, u.side, foe.x); return; }
      foe.slowed = g.slowFrames;
    }
    if (gone) s.bullets.splice(s.bullets.indexOf(u), 1);
  }
}

function updateDash(s, p) {
  const c = p.char;
  p.x += p.facing * c.dashSpeed;
  p.vy = 0;
  if (s.phase === 'play' && !p.dashSpent) {
    const b = s.balls.find(x => touches(s, p, x, y => Math.hypot(y.x - p.x, y.y - (p.y - 38)) < c.dashR + s.env.ballR));
    if (b) {
      sendBall(s, p, b, 'side', 1, c.dashBoost);
      b.boost = c.dashBoostFrames;
      p.dashSpent = true;
    }
  }
  p.dash--;
}

function updatePlayer(s, p, input) {
  const c = p.char;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const frozen = p.dash > 0 || p.dive > 0 || p.lock > 0 || p.toss > 0;
  if (p.slowed > 0) p.slowed--;
  if (!frozen && dir !== 0) p.facing = dir;
  if (p.dash > 0) updateDash(s, p);
  else if (p.dive > 0) {
    p.x += p.facing * c.dive.speed;
    if (--p.dive === 0) p.lock = c.dive.recover;
  } else if (p.lock > 0) p.lock--;
  else if (p.toss > 0) updateToss(s, p);
  else p.x += dir * c.move * (p.slowed > 0 ? slowMove(s, p) : 1);
  const lo = p.side === 0 ? c.halfW : NET.x + NET.halfW + c.halfW;
  const hi = p.side === 0 ? NET.x - NET.halfW - c.halfW : W - c.halfW;
  p.x = clamp(p.x, lo, hi);

  p.look = input.up ? 'up' : input.down ? 'down' : 'side';

  if (input.jump && p.onGround && !frozen) { p.vy = -c.jump; p.onGround = false; }
  if (c.jumpCut && !input.jump && p.vy < -c.jumpCut) p.vy = -c.jumpCut; // 일찍 떼면 낮게
  if (!p.onGround && p.dash === 0) {
    p.vy += c.gravity;
    p.y += p.vy;
    if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; p.onGround = true; }
  }

  if (p.cooldown > 0) p.cooldown--;
  updateSpecial(s, p, input);
  if (c.gun) updateGun(s, p, input);
  else if (c.contact) updateContact(s, p, input);
  else if (p.toss === 0) updateAttack(s, p, input);
}

// 느려진 정도는 쏜 옥수수의 수치를 따라요.
function slowMove(s, p) {
  const g = s.players[1 - p.side].char.gun;
  return g ? g.slowMove : 1;
}

function collideNet(b, env) {
  const r = env.ballR;
  const cx = clamp(b.x, NET.x - NET.halfW, NET.x + NET.halfW);
  const cy = clamp(b.y, env.netTop, GROUND);
  let nx = b.x - cx, ny = b.y - cy;
  const d = Math.hypot(nx, ny);
  if (d >= r) return;
  if (d === 0) { nx = b.vx > 0 ? -1 : 1; ny = 0; } else { nx /= d; ny /= d; }
  b.x = cx + nx * r;
  b.y = cy + ny * r;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= (1 + BALL.netBounce) * vn * nx;
    b.vy -= (1 + BALL.netBounce) * vn * ny;
  }
}

// 궤적은 그대로 두고 시간만 조절해서 뜨는 높이가 변하지 않아요.
function ballTime(s, b) {
  const field = Math.min(...s.players.map(p => p.slowing && p.char.slowScale ? p.char.slowScale : 1));
  const time = field < 1 ? Math.min(b.slow, field) : b.slow;
  return time * s.env.speed;
}

function advanceBall(b, time, env) {
  const r = env.ballR;
  b.vy += env.gravity * time;
  b.vx += env.windNow * time;
  const speed = Math.hypot(b.vx, b.vy);
  if (speed > BALL.maxSpeed) { b.vx *= BALL.maxSpeed / speed; b.vy *= BALL.maxSpeed / speed; }
  b.x += b.vx * time;
  b.y += b.vy * time;
  if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx) * BALL.wallBounce; }
  if (b.x > W - r) { b.x = W - r; b.vx = -Math.abs(b.vx) * BALL.wallBounce; }
  if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy) * BALL.wallBounce; }
  if (b.ghost && (b.x - NET.x) * b.ghost > r) b.ghost = 0;
  if (!b.ghost) collideNet(b, env);
}

function ballLanded(s, b) {
  scorePoint(s, b.x < NET.x ? 1 : 0, b.x);
}

function scorePoint(s, scorer, x) {
  s.events.push({ type: 'point', scorer, x });
  if (s.mode === 'coop') {
    s.phase = 'over';
    s.events.push({ type: 'coopEnd' });
  } else if (s.mode === 'free') {
    // 득점하면 멈추고, 공격 키를 눌러야 다시 시작해요.
    s.server = scorer;
    s.notice = { text: `${scorer + 1}P 득점`, side: scorer, timer: 60 };
    s.phase = 'waiting';
    s.timer = 60;
  } else {
    s.score[scorer]++;
    s.server = scorer;
    s.phase = 'point';
    s.timer = TIMERS.point;
  }
}

function updateBalls(s) {
  for (const b of s.balls.slice()) {
    if (s.lag) {
      b.hist = b.hist || [];
      b.hist.unshift({ x: b.x, y: b.y });
      if (b.hist.length > 16) b.hist.pop();
    }
    if (b.boost > 0 && --b.boost === 0) b.slow = 1; // 블루베리가 빠르게 한 공이 원래대로 돌아와요
    if (b.held) continue; // 토마토 스파이크 준비 중에는 공이 멈춰 있어요
    advanceBall(b, ballTime(s, b), s.env);
    if (b.y + s.env.ballR >= GROUND) {
      b.y = GROUND - s.env.ballR;
      // 토마토공이 토마토 코트에 떨어지면 그냥 사라져요.
      if (b.kind === 'tomato' && onMySide(s.players[b.owner], b.x)) { removeBall(s, b); continue; }
      ballLanded(s, b);
      if (s.phase !== 'play') return;
    }
  }
}

function updateEnv(s) {
  const env = s.env;
  env.netTop += clamp(env.netGoal - env.netTop, -1, 1);
  env.windNow = env.wind + Math.sin(s.clock * 0.03) * env.gust;
  if (s.notice && --s.notice.timer <= 0) s.notice = null;
  if (s.mode !== 'coop' || s.phase !== 'play') return;
  s.clock++;
  const next = COOP_STAGES[s.stage];
  if (next && s.clock >= next.at * 60) {
    Object.assign(env, next.set);
    syncBalls(s);
    s.stage++;
    s.notice = { text: next.text, side: -1, timer: 150 };
    s.events.push({ type: 'stage' });
  }
  if (s.clock >= COOP_GOAL * 60) {
    s.cleared = true;
    s.phase = 'over';
    s.events.push({ type: 'coopEnd' });
  }
}

// 듀스를 켜면 목표 점수를 넘어도 2점을 앞서야 이겨요.
function hasWon(s) {
  const top = Math.max(...s.score), low = Math.min(...s.score);
  return top >= s.target && (!s.deuce || top - low >= 2);
}

function resumeFree(s) {
  s.notice = null;
  resetRound(s);
}

function step(s, inputs) {
  if (s.phase === 'over') return;
  if (s.phase === 'waiting') {
    if (s.ai.every(Boolean) && --s.timer <= 0) resumeFree(s); // AI끼리는 저절로 이어가요
    return;
  }
  if (s.phase === 'intro') {
    if (--s.timer <= 0) { s.phase = 'ready'; s.timer = TIMERS.ready; }
    return;
  }
  if (s.mode === 'free' && s.phase === 'play') s.clock++;
  updateEnv(s);
  s.players.forEach((p, i) => updatePlayer(s, p, inputs[i]));
  if (s.phase === 'ready') {
    if (--s.timer <= 0) s.phase = 'play';
  } else if (s.phase === 'play') {
    updateBullets(s);
    if (s.phase === 'play') updateBalls(s);
  } else if (s.phase === 'point') {
    if (--s.timer <= 0) {
      if (hasWon(s)) { s.phase = 'over'; s.events.push({ type: 'over', winner: s.server }); }
      else resetRound(s);
    }
  }
}

// ── AI ── 난이도 수치는 AI_LEVELS에서 조정해요.
const AI_LEVELS = {
  easy: { name: '쉬움', react: 24, error: 70, miss: 0.25, jump: false, special: 0.01 },
  normal: { name: '보통', react: 12, error: 28, miss: 0.08, jump: true, special: 0.05 },
  hard: { name: '어려움', react: 6, error: 16, miss: 0.05, jump: true, special: 1 },
};

function makeAi(level) {
  return level ? { id: level, level: AI_LEVELS[level], touch: -1, wait: 0, skip: false, error: 0, plan: null } : null;
}

// 공이 어디로 떨어질지 미리 계산해요.
function predict(ball, time, env) {
  const b = { ...ball }, path = [];
  for (let t = 1; t <= 400; t++) {
    advanceBall(b, time, env);
    path.push({ x: b.x, y: b.y });
    if (b.y + env.ballR >= GROUND) break;
  }
  return { x: b.x, t: path.length, path };
}

function onMySide(p, x) {
  return p.side === 0 ? x < NET.x : x > NET.x;
}

function currentPower(p) {
  const k = p.char.charge;
  if (!k) return 1;
  if (p.rage > 0 || p.charge >= k.strong) return k.strongPower;
  return p.charge >= k.mid ? k.midPower : 1;
}

function scoreShot(s, p, b, dir) {
  const shot = p.char.shots[dir], power = currentPower(p);
  const end = predict({ x: b.x, y: b.y, vx: shot.vx * power * p.facing, vy: shot.vy * power }, s.env.speed, s.env);
  if (s.mode === 'coop') return dir === 'down' ? -100 : 50 + end.t;
  if (onMySide(p, end.x)) return dir === 'up' ? 20 : -100;
  return 100 + Math.abs(end.x - s.players[1 - p.side].x) * 0.1 + (dir === 'down' ? 30 : 0) - end.t * 0.1;
}

function bestShot(s, p, b) {
  if (s.mode === 'coop' && b.y < GROUND - 170) return null; // 협동은 낮게 내려왔을 때 받아요
  const r = s.env.ballR;
  const dirs = p.onGround ? ['side', 'up'] : ['side', 'up', 'down'];
  let best = null, bestScore = -Infinity;
  for (const dir of dirs) {
    const z = zoneFor(p, dir);
    if (Math.hypot(b.x - z.x, b.y - z.y) >= z.r + r) continue;
    const score = scoreShot(s, p, b, dir);
    if (score > bestScore) { best = dir; bestScore = score; }
  }
  // 내 코트로 떨어지는 공은 바닥에 가까워질 때만 급하게 받아요.
  if (bestScore < 50 && b.y < GROUND - 90) return null;
  return bestScore > -100 ? best : null;
}

// 여러 공 중 내 코트에 가장 먼저 떨어지는 공을 맡아요.
function aiFocus(s, p) {
  let best = s.balls[0], soonest = Infinity;
  for (const b of s.balls) {
    const end = predict(b, ballTime(s, b), s.env);
    // 내 토마토공은 급한 공이 없을 때만 쳐서 넘겨요.
    const t = b.kind === 'tomato' && b.owner === p.side ? end.t + 1000 : end.t;
    if (onMySide(p, end.x) && t < soonest) { best = b; soonest = t; }
  }
  return best;
}

function aiAttack(s, p, input, ai) {
  const c = p.char, b = ai.ball || s.balls[0], dir = ai.skip || p.cooldown > 0 ? null : bestShot(s, p, b);
  if (c.charge && p.rage === 0) {
    // 수박은 키를 뗄 때 치니까, 칠 수 있을 때까지 누르고 있다가 떼요.
    if (dir) input.attackHeld = p.charge === 0;
    else input.attackHeld = ai.level.jump && p.cooldown === 0;
  } else input.attack = !!dir;
  if (dir === 'up') input.up = true;
  if (dir === 'down') input.down = true;
}

function aiContact(s, p, input, ai, toward, urgent) {
  const b = ai.ball || s.balls[0], c = p.char, r = s.env.ballR;
  if (ai.skip || s.phase !== 'play') return;
  if (p.onGround) {
    if (urgent && ai.plan.t < 26) input.attack = Math.random() < Math.max(ai.level.special, 0.2);
    return;
  }
  if (p.spike === 0 && Math.hypot(b.x - p.x, b.y - (p.y - 38)) < c.bodyR + r + 34) {
    input.attack = true;
    input.down = b.y < s.env.netTop - 30 && Math.abs(p.x - NET.x) < 170;
  }
}

// 총알을 쏘면 공이 어디로 갈지 미리 계산해서 점수를 매겨요.
function gunScore(s, p, b, dir, strong) {
  const u = bulletAim(p, dir, strong), ball = { x: b.x, y: b.y, vx: b.vx, vy: b.vy };
  const time = ballTime(s, b), g = p.char.gun, r = s.env.ballR;
  for (let t = 0; t < 45; t++) {
    // 게임과 같은 순서: 총알이 먼저 움직여 공에 닿는지 보고, 그다음 공이 움직여요.
    u.x += u.vx; u.y += u.vy;
    if (u.x < -20 || u.x > W + 20 || u.y < -20 || u.y > GROUND || bulletBlocked(u, s.env)) return -Infinity;
    if (Math.hypot(ball.x - u.x, ball.y - u.y) < r + u.r) {
      const shot = p.char.shots[dir], power = strong ? g.ultPower : 1;
      const end = predict({ x: ball.x, y: ball.y, vx: shot.vx * power * u.facing, vy: shot.vy * power }, s.env.speed, s.env);
      if (s.mode === 'coop') return dir === 'down' ? -100 : 50 + end.t;
      return onMySide(p, end.x) ? (dir === 'up' ? 20 : -100) : 100 - end.t * 0.1;
    }
    if (!b.held) advanceBall(ball, time, s.env);
    if (ball.y + r >= GROUND) return -Infinity;
  }
  return -Infinity;
}

function aiGun(s, p, input, ai) {
  const b = ai.ball || s.balls[0];
  if (ai.skip || s.phase !== 'play' || p.fireCd > 0 || p.ammo < 1 || !b) return;
  let best = null, bestScore = -Infinity;
  for (const dir of p.onGround ? ['side', 'up'] : ['side', 'up', 'down']) {
    const score = gunScore(s, p, b, dir, false);
    if (score > bestScore) { best = dir; bestScore = score; }
  }
  if (bestScore >= 50 || (bestScore > -100 && b.y > GROUND - 90)) {
    input.attack = true;
    input.left = input.right = false; // 멈춰서 지금 보는 쪽으로 쏴요
    input.up = best === 'up';
    input.down = best === 'down';
  }
}

function aiSpecial(s, p, input, ai, toward, pressed) {
  const c = p.char, b = ai.ball || s.balls[0];
  if (c.gun) {
    // 센 총알이 상대에게 맞을 것 같으면 쏴요.
    if (s.phase !== 'play' || p.ammo < c.gun.ultCost || p.fireCd > 0 || s.mode === 'coop' || Math.random() >= ai.level.special * 0.3) return;
    const foe = s.players[1 - p.side];
    for (const dir of p.onGround ? ['side', 'up'] : ['side', 'up', 'down']) {
      const u = bulletAim(p, dir, true);
      for (let t = 0; t < 60; t++) {
        u.x += u.vx; u.y += u.vy;
        if (bulletBlocked(u, s.env) || u.y > GROUND) break;
        if (Math.hypot(foe.x - u.x, foe.y - 38 - u.y) < 30 + u.r) {
          input.specialPressed = true;
          input.attack = false;
          input.up = dir === 'up';
          input.down = dir === 'down';
          return;
        }
      }
    }
    return;
  }
  if (!c.special || p.gauge < 1 || s.phase !== 'play') {
    input.special = p.slowing && pressed;
    return;
  }
  if (Math.random() >= ai.level.special) return;
  const mine = ai.plan && onMySide(p, ai.plan.x);
  let use = false;
  if (c.special === 'rage') use = mine;
  else if (c.special === 'slowTime') use = pressed;
  else if (c.special === 'tomato') {
    use = s.mode !== 'coop';
    input.up = false;
    input.down = use && Math.random() < 0.5;
  }
  else if (c.special === 'wide') {
    const z = wideZone(p);
    use = mine && b.y >= z.top && b.y <= z.bottom && onMySide(p, b.x);
  } else if (c.special === 'dash') {
    const gap = b.x - p.x;
    const ahead = gap * toward > 0 && Math.abs(gap) < 130 && onMySide(p, b.x);
    use = (pressed || ahead) && Math.abs(gap) < c.dashFrames * c.dashSpeed && b.y > GROUND - 130;
    if (use) { input.left = gap < 0; input.right = gap > 0; }
  }
  if (use) { input.specialPressed = true; input.special = true; }
}

function aiInput(s, i) {
  const p = s.players[i], c = p.char, ai = s.ai[i], L = ai.level;
  const input = { left: false, right: false, up: false, down: false, jump: false, attack: false, attackHeld: false, special: false, specialPressed: false };
  if (s.phase === 'point' || s.phase === 'over') return input;
  const toward = p.side === 0 ? 1 : -1;
  if (ai.touch !== s.touch) {
    ai.touch = s.touch;
    ai.wait = L.react;
    ai.skip = Math.random() < (s.mode === 'versus' ? L.miss + s.rally * 0.012 : L.miss * 0.25); // 랠리가 길어질수록 실수가 늘어요
    ai.error = (Math.random() * 2 - 1) * L.error;
  }
  if (ai.wait > 0) ai.wait--;
  else {
    ai.ball = aiFocus(s, p);
    ai.plan = predict(ai.ball, ballTime(s, ai.ball), s.env);
  }

  const mine = ai.plan && onMySide(p, ai.plan.x);
  const stand = c.gun ? 45 : c.contact ? 14 : 34;
  const home = p.side === 0 ? 230 : 730;
  const target = mine ? ai.plan.x - toward * stand + ai.error : home;
  const gap = target - p.x;
  if (Math.abs(gap) > c.move) { input.left = gap < 0; input.right = gap > 0; }
  else if (p.facing !== toward) { input.left = toward < 0; input.right = toward > 0; }
  const urgent = !!mine && Math.abs(gap) / c.move > ai.plan.t;
  const pressed = !!mine && Math.abs(gap) / c.move > ai.plan.t * 0.6;

  if (L.jump && s.mode !== 'coop' && mine && p.onGround && Math.abs(p.x - NET.x) < 190) {
    for (let t = 16; t < 28 && t < ai.plan.path.length; t++) {
      const spot = ai.plan.path[t];
      if (spot.y < 330 && spot.y > 230 && Math.abs(spot.x - p.x) < 50) { input.jump = true; break; }
    }
  }
  if (c.jumpCut && !p.onGround && p.vy < 0) input.jump = true; // 점프 키를 계속 눌러 높이 떠요
  if (c.gun) aiGun(s, p, input, ai);
  else if (c.contact) aiContact(s, p, input, ai, toward, urgent);
  else aiAttack(s, p, input, ai);
  aiSpecial(s, p, input, ai, toward, pressed);
  return input;
}

if (typeof module !== 'undefined') module.exports = { CHARACTERS, TIMERS, makeMatch, step, updatePlayer };
