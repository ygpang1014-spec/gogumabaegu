// 서버를 띄우고 두 클라이언트로 방 만들기부터 경기 끝까지 시험합니다.
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3977;
const server = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT } });
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const check = (name, ok) => { if (!ok) failed++; console.log(ok ? '통과' : '실패', name); };

function client() {
  const ws = new WebSocket(`ws://localhost:${PORT}`);
  const c = { ws, log: [], last: {}, send: m => ws.send(JSON.stringify(m)) };
  ws.onmessage = e => { const m = JSON.parse(e.data); c.log.push(m); c.last[m.t] = m; };
  return new Promise(r => { ws.onopen = () => r(c); });
}

async function main() {
  await wait(600);
  const res = await fetch(`http://localhost:${PORT}/`);
  check('게임 페이지 응답', res.status === 200 && (await res.text()).includes('고구마배구'));
  check('규칙 파일 응답', (await fetch(`http://localhost:${PORT}/rules.js`)).status === 200);
  check('다른 파일은 막음', (await fetch(`http://localhost:${PORT}/..%2fserver.js`)).status === 404);

  const a = await client(), b = await client();
  a.send({ t: 'create', name: '철수' });
  await wait(100);
  const code = a.last.room.code;
  check('방 코드 4자리', /^\d{4}$/.test(code));
  b.send({ t: 'join', code: '0000', name: '영희' });
  await wait(100);
  check('없는 코드 안내', !!b.last.error);
  b.send({ t: 'join', code, name: '영희' });
  await wait(100);
  check('참가 후 양쪽에 두 사람', a.last.room.seats[1].name === '영희' && b.last.room.seat === 1);
  const c = await client();
  c.send({ t: 'join', code, name: '셋째' });
  await wait(100);
  check('세 번째는 입장 불가', !!c.last.error);
  c.ws.close();

  a.send({ t: 'pick', pick: 3 });
  b.send({ t: 'pick', pick: 7 });
  b.send({ t: 'settings', target: 15 });
  a.send({ t: 'settings', target: 7, deuce: false, mode: 'versus' });
  await wait(100);
  check('캐릭터 선택 전달', a.last.room.seats[0].pick === 3 && b.last.room.seats[1].pick === 7);
  check('손님은 규칙을 못 바꿈', a.last.room.target === 7);

  a.send({ t: 'ready' });
  b.send({ t: 'ready' });
  await wait(150);
  check('둘 다 준비하면 시작', !!a.last.start && !!b.last.start);
  check('랜덤이 실제 캐릭터로', a.last.start.chars[1] >= 0 && a.last.start.chars[1] < 7);
  check('양쪽 캐릭터 같음', a.last.start.chars.join() === b.last.start.chars.join());

  await wait(2800);
  const x0 = a.last.s.p[0].x;
  check('인트로 뒤 경기 진행', a.last.s.phase !== 'intro');
  a.send({ t: 'i', m: 2 });
  await wait(400);
  a.send({ t: 'i', m: 0 });
  await wait(100);
  check('입력으로 캐릭터 이동', a.last.s.p[0].x > x0 + 50);
  check('양쪽이 같은 상태', Math.abs(a.last.s.p[0].x - b.last.s.p[0].x) < 1);

  const count = a.log.filter(m => m.t === 's').length;
  await wait(1000);
  const rate = a.log.filter(m => m.t === 's').length - count;
  check(`초당 상태 전송 약 60번 (${rate})`, rate >= 50 && rate <= 66);

  // 아무도 안 치면 7점이 나서 끝나요.
  for (let i = 0; i < 80 && a.last.s.phase !== 'over'; i++) await wait(500);
  check('경기가 끝까지 진행', a.last.s.phase === 'over');
  const over = a.log.some(m => m.t === 's' && m.events.some(e => e.type === 'over'));
  check('끝 이벤트 전달', over);
  const before = a.log.filter(m => m.t === 'start').length;
  a.send({ t: 'again' });
  await wait(100);
  check('한 명만 누르면 대기', a.log.filter(m => m.t === 'start').length === before);
  b.send({ t: 'again' });
  await wait(150);
  check('둘 다 누르면 다시 시작', a.log.filter(m => m.t === 'start').length === before + 1);

  b.ws.close();
  await wait(200);
  check('상대가 나가면 알림', !!a.last.left && a.last.room.seats[1] === null);
  a.ws.close();
  await wait(100);
  const d = await client();
  d.send({ t: 'join', code, name: '넷째' });
  await wait(100);
  check('빈 방은 사라짐', !!d.last.error);
  d.ws.close();
}

main().catch(e => { failed++; console.log('오류', e); }).finally(() => {
  server.kill();
  console.log(failed ? `실패 ${failed}개` : '모두 통과');
  process.exit(failed ? 1 : 0);
});
