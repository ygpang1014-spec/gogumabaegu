// 온라인 대전: 규칙은 서버가 돌리고, 여기서는 입력을 보내고 받은 상태를 그립니다.
// 내 캐릭터는 서버 답을 기다리지 않고 바로 움직이고(예측), 서버 답이 오면 맞춰요.
const Online = (() => {
  const BITS = { left: 1, right: 2, up: 4, down: 8, jump: 16, attack: 32, special: 64 };
  const SECTIONS = ['home', 'lobby', 'online', 'room', 'game'];
  const ONLINE_MODES = [{ id: 'versus', name: '대결 모드' }];
  const STEP = 1000 / 60;
  let ws = null, room = null, pendingOpen = null;
  let lastMask = 0, seq = 0, tapAttack = false, tapSpecial = false;
  let history = [], spare = 0, last = 0, ping = 0;
  let wantPick = null; // 서버 답을 기다리는 내 캐릭터 선택
  let keySet = 0; // 내가 1P 키(0)와 2P 키(1) 중 어느 쪽을 쓰는지

  function show(id) {
    SECTIONS.forEach(name => { $(name).hidden = name !== id; });
  }

  function status(text) {
    $('onlineStatus').textContent = text;
  }

  function post(message) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(message));
  }

  function connect(first) {
    if (ws && ws.readyState === 1) { post(first); return; }
    status('서버에 연결하는 중이에요.');
    ws = new WebSocket(location.origin.replace(/^http/, 'ws'));
    pendingOpen = first;
    ws.onopen = () => { post(pendingOpen); status(''); };
    ws.onmessage = e => onMessage(JSON.parse(e.data));
    ws.onclose = () => {
      ws = null;
      const wasIn = !!room;
      clearGame();
      room = null;
      if (wasIn) { show('online'); status('서버와 연결이 끊어졌어요. 다시 방을 만들어주세요.'); }
      else if (!$('online').hidden) status('서버에 연결하지 못했어요. 잠시 뒤에 다시 해주세요.');
    };
  }

  function clearGame() {
    match = null;
    paused = false;
    $('pause').hidden = true;
    $('over').hidden = true;
    $('restart').hidden = false;
    document.querySelector('.names').hidden = false;
    lastMask = 0;
    wantPick = null;
    history = [];
  }

  function onMessage(m) {
    if (m.t === 'ping') { post({ t: 'pong', s: m.s }); return; }
    if (m.t === 'error') status(m.text);
    if (m.t === 'closed') { clearGame(); room = null; show('online'); status(''); }
    if (m.t === 'left') { clearGame(); status(''); room = room && { ...room, notice: '상대가 나갔어요. 코드를 알려주면 다시 들어올 수 있어요.' }; }
    if (m.t === 'room') {
      room = { ...m, notice: room && room.code === m.code && m.seats.includes(null) ? room.notice : '' };
      // 빠르게 여러 번 고르면 서버 답이 늦게 와도 마지막으로 고른 캐릭터를 보여줘요.
      const mine = room.seats[room.seat];
      if (wantPick !== null && mine) {
        if (mine.pick === wantPick || mine.ready) wantPick = null;
        else mine.pick = wantPick;
      }
      if (!match) { show('room'); renderRoom(); }
    }
    if (m.t === 'start') startGame(m);
    if (m.t === 's' && match) applySnapshot(m);
  }

  function startGame(m) {
    clearGame();
    const chars = m.chars.map(i => CHARACTERS[i]);
    match = makeMatch(chars, m.target, [null, null], m.deuce, m.mode);
    match.online = true;
    match.names = m.names;
    match.phase = 'intro';
    match.goal = { players: [], balls: [] };
    fx = { trail: [], rings: [], shake: 0, age: 0, winner: null };
    last = performance.now();
    spare = 0;
    $('restart').hidden = true;
    document.querySelector('.names').hidden = true;
    $('freeHint').hidden = true;
    $('tuner').hidden = true;
    show('game');
    fitCourt();
    court.focus();
  }

  // 예측용 작은 세계: 공을 치거나 필살기를 쓰는 판정은 하지 않고 움직임만 따라 해요.
  function sandbox() {
    return { phase: 'ready', balls: [], events: [], env: match.env, players: match.players, mode: match.mode };
  }

  function predicting() {
    return match.phase !== 'intro' && match.phase !== 'over';
  }

  function applySnapshot(m) {
    const s = match, me = room.seat;
    ping = m.ping[me];
    m.p.forEach((p, i) => {
      const player = s.players[i];
      if (i === me) {
        Object.assign(player, p);
        return;
      }
      const { x, y, ...rest } = p;
      Object.assign(player, rest);
      s.goal.players[i] = { x, y };
      if (Math.abs(player.x - x) > 120 || s.phase !== m.phase) { player.x = x; player.y = y; }
    });
    // 서버가 아직 반영하지 않은 내 입력을 다시 적용해서 내 캐릭터를 지금 위치로 데려와요.
    const [ackSeq, ackAge] = m.ack[me];
    // 서버가 이미 처리한 입력(더 오래된 번호, 또는 같은 번호의 앞부분)은 버려요.
    history = history.filter(h => h.seq > ackSeq || (h.seq === ackSeq && h.k >= ackAge));
    if (m.phase !== 'intro' && m.phase !== 'over') {
      const world = sandbox();
      for (const h of history) updatePlayer(world, s.players[me], h.input);
    }
    s.goal.balls = m.b;
    s.balls.length = m.b.length;
    m.b.forEach((b, i) => {
      if (!s.balls[i] || s.balls[i].kind !== b.kind || Math.hypot(s.balls[i].x - b.x, s.balls[i].y - b.y) > 150) s.balls[i] = { ...b };
      s.balls[i].slow = b.slow;
    });
    s.bullets = m.u || [];
    s.score = m.score;
    s.server = m.server;
    s.clock = m.clock;
    s.notice = m.notice;
    Object.assign(s.env, m.env);
    s.phase = m.phase;
    s.timer = m.timer;
    s.events.push(...m.events);
    playEvents(s, fx);
  }

  function currentMask() {
    let mask = 0;
    if (!paused) for (const k of KEYS) for (const name in BITS) if (held.has(k[name])) mask |= BITS[name];
    return mask;
  }

  // 1/60초마다 내 입력으로 내 캐릭터를 바로 움직여요.
  function predictTick() {
    const mask = currentMask();
    const input = {
      left: !!(mask & BITS.left), right: !!(mask & BITS.right), up: !!(mask & BITS.up), down: !!(mask & BITS.down),
      jump: !!(mask & BITS.jump), attack: tapAttack, attackHeld: !!(mask & BITS.attack),
      special: !!(mask & BITS.special), specialPressed: tapSpecial,
    };
    tapAttack = tapSpecial = false;
    const prev = history[history.length - 1];
    history.push({ seq, k: prev && prev.seq === seq ? prev.k + 1 : 0, input });
    if (history.length > 120) history.shift();
    if (predicting()) updatePlayer(sandbox(), match.players[room.seat], input);
  }

  function frame() {
    const s = match, now = performance.now();
    spare = Math.min(spare + now - last, STEP * 5);
    last = now;
    while (spare >= STEP) {
      spare -= STEP;
      fx.age++;
      predictTick();
      if (s.phase === 'intro' && fx.age === 26) beep(180, 0.3, 'sawtooth');
      if (s.phase === 'over' && fx.age === 70) { $('over').hidden = false; $('again').focus(); }
      if (fx.shake > 0) fx.shake = fx.shake < 0.5 ? 0 : fx.shake * 0.85;
      if (s.phase === 'play') {
        fx.trail.push({ x: s.balls[0].x, y: s.balls[0].y });
        if (fx.trail.length > 8) fx.trail.shift();
      }
    }
    // 상대와 공은 받은 위치로 부드럽게 다가가요.
    s.goal.players.forEach((g, i) => {
      if (!g || i === room.seat) return;
      s.players[i].x += (g.x - s.players[i].x) * 0.6;
      s.players[i].y += (g.y - s.players[i].y) * 0.6;
    });
    s.goal.balls.forEach((g, i) => {
      if (!s.balls[i]) return;
      s.balls[i].x += (g.x - s.balls[i].x) * 0.6;
      s.balls[i].y += (g.y - s.balls[i].y) * 0.6;
    });
  }

  function drawPing() {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.font = `14px ${DISPLAY}`;
    ctx.fillStyle = ping > 150 ? COLORS.ember : COLORS.text;
    ctx.globalAlpha = 0.7;
    ctx.fillText(`핑 ${ping}ms`, W - 10, H - 8);
    ctx.globalAlpha = 1;
  }

  const lastShown = [];
  function renderRoom() {
    $('roomCode').textContent = room.code;
    $('roomAddress').textContent = location.host;
    const full = room.seats[0] && room.seats[1];
    $('roomStatus').textContent = room.notice || (full ? '두 사람 모두 준비하면 시작해요.' : '친구에게 주소와 코드를 알려주세요. 친구를 기다리는 중이에요.');
    [0, 1].forEach(i => {
      const seat = room.seats[i], mine = i === room.seat;
      $('roomName' + i).textContent = seat ? seat.name + (mine ? ' (나)' : '') : '기다리는 중';
      const char = seat ? CHARACTERS[seat.pick] || RANDOM_PICK : null;
      $('roomWho' + i).textContent = char ? char.name : '';
      const c = $('roomPreview' + i).getContext('2d');
      c.setTransform(2, 0, 0, 2, 0, 0);
      c.clearRect(0, 0, 96, 112);
      if (char === RANDOM_PICK) {
        c.font = `76px ${DISPLAY}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillStyle = COLORS.p[i];
        c.fillText('?', 48, 60);
      } else if (char) drawFood(c, 48, 106, { char, facing: i === 0 ? 1 : -1, look: 'side', scarf: COLORS.p[i], swinging: false });
      setStage($('roomStage' + i), char, i);
      const shown = seat ? seat.pick : -1;
      if (lastShown[i] !== undefined && lastShown[i] !== shown) glitch($('roomScreen' + i));
      lastShown[i] = shown;
      if (char) renderCard({ type: $('roomType' + i), meters: $('roomMeters' + i), card: $('roomAbility' + i) }, char);
      else { $('roomType' + i).textContent = ''; $('roomMeters' + i).replaceChildren(); $('roomAbility' + i).replaceChildren(); }
      const coin = $('roomCoin' + i);
      coin.textContent = !seat ? 'WAITING...' : seat.ready ? 'READY!' : 'INSERT COIN';
      coin.classList.toggle('on', !!(seat && seat.ready));
      document.querySelectorAll(`.roomPick[data-seat="${i}"], .roomAll[data-seat="${i}"]`).forEach(b => { b.hidden = !mine; });
      if (!mine) showGrid($('roomGrid' + i), false);
      if (seat) renderGrid($('roomGrid' + i), i, seat.pick, choose);
      const ready = $('roomReady' + i);
      ready.disabled = !mine;
      ready.setAttribute('aria-pressed', !!(seat && seat.ready));
      ready.textContent = seat && seat.ready ? '준비 완료' : mine ? '준비하기 (공격 키)' : '준비 전';
    });
    const host = room.seat === 0;
    const mode = ONLINE_MODES.find(x => x.id === room.mode);
    $('roomMode').textContent = mode.name;
    $('roomMode').disabled = !host;
    $('roomTargets').hidden = room.mode !== 'versus';
    document.querySelectorAll('#roomTargets button').forEach(b => {
      b.setAttribute('aria-pressed', Number(b.dataset.score) === room.target);
      b.disabled = !host;
    });
    $('roomDeuce').checked = room.deuce;
    $('roomDeuce').disabled = !host;
  }

  function settings(change) {
    post({ t: 'settings', mode: room.mode, target: room.target, deuce: room.deuce, ...change });
  }

  function pick(step) {
    const seat = room.seats[room.seat];
    if (!seat || seat.ready) return;
    const slots = CHARACTERS.length + 1;
    setPick((seat.pick + step + slots) % slots);
  }

  function setPick(slot) {
    room.seats[room.seat].pick = wantPick = slot;
    post({ t: 'pick', pick: slot });
    renderRoom();
  }

  // 전체 보기 칸을 눌러 바로 골라요.
  function choose(slot) {
    const seat = room.seats[room.seat];
    if (!seat || seat.ready) return;
    showGrid($('roomGrid' + room.seat), false);
    setPick(slot);
  }

  function myName() {
    const name = $('onlineName').value.trim();
    setName(0, name);
    return name;
  }

  function open() {
    $('onlineName').value = lobby.names[0] === '1P' ? '' : lobby.names[0];
    status('');
    show('online');
    $('onlineName').focus();
  }

  // 대기실에서는 1P, 2P 어느 쪽 키든 내 자리를 움직여요.
  function handleKey(e) {
    if (!$('online').hidden) return true;
    if (!room || match) return false;
    if (e.repeat) return true;
    if (e.code === 'ArrowLeft' || KEYS.some(k => k.left === e.code)) pick(-1);
    else if (e.code === 'ArrowRight' || KEYS.some(k => k.right === e.code)) pick(1);
    else if (KEYS.some(k => k.attack === e.code)) post({ t: 'ready' });
    return true;
  }

  function syncInput() {
    if (!match || !match.online) return;
    const mask = currentMask();
    if (mask === lastMask) return;
    // 아주 짧게 눌렀다 떼도 공격이 빠지지 않게 눌린 순간을 기억해요.
    if (mask & ~lastMask & BITS.attack) tapAttack = true;
    if (mask & ~lastMask & BITS.special) tapSpecial = true;
    lastMask = mask;
    post({ t: 'i', m: mask, n: ++seq });
  }

  addEventListener('keydown', e => {
    const set = KEYS.findIndex(k => Object.values(k).includes(e.code));
    if (set >= 0) keySet = set;
  });
  addEventListener('keydown', syncInput);
  addEventListener('keyup', syncInput);
  addEventListener('blur', syncInput);

  $('onlineBack').addEventListener('click', showHome);
  $('createRoom').addEventListener('click', () => connect({ t: 'create', name: myName() }));
  $('joinRoom').addEventListener('click', () => {
    const code = $('joinCode').value.trim();
    if (!/^\d{4}$/.test(code)) { status('코드는 숫자 4자리예요.'); return; }
    connect({ t: 'join', code, name: myName() });
  });
  $('joinCode').addEventListener('keydown', e => { if (e.code === 'Enter') $('joinRoom').click(); });
  $('roomLeave').addEventListener('click', () => post({ t: 'leave' }));
  [0, 1].forEach(i => $('roomReady' + i).addEventListener('click', e => { post({ t: 'ready' }); e.currentTarget.blur(); }));
  document.querySelectorAll('.roomAll').forEach(b => b.addEventListener('click', e => { showGrid($('roomGrid' + b.dataset.seat)); e.currentTarget.blur(); }));
  document.querySelectorAll('.roomPick').forEach(b => b.addEventListener('click', e => { pick(Number(b.dataset.step)); e.currentTarget.blur(); }));
  $('roomMode').addEventListener('click', e => {
    const i = ONLINE_MODES.findIndex(x => x.id === room.mode);
    settings({ mode: ONLINE_MODES[(i + 1) % ONLINE_MODES.length].id });
    e.currentTarget.blur();
  });
  $('roomTargets').addEventListener('click', e => { if (e.target.dataset.score) settings({ target: Number(e.target.dataset.score) }); });
  $('roomDeuce').addEventListener('change', e => { settings({ deuce: e.target.checked }); e.target.blur(); });

  return {
    open, frame, handleKey, drawPing,
    // 온라인에서는 내가 실제로 쓰는 키를 알려주고, 상대 게이지에는 키를 적지 않아요.
    specialLabel: side => side !== (room ? room.seat : 0) ? '가득' : keyLabel(KEYS[keySet].special),
    rematch() { $('over').hidden = true; post({ t: 'again' }); },
    leave() { post({ t: 'leave' }); },
  };
})();
