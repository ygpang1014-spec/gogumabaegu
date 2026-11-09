// 느린 인터넷에서 공 되돌려 판정하기가 작동하는지 규칙만으로 시험합니다.
const rules = require('../public/rules.js');
const C = Object.fromEntries(rules.CHARACTERS.map(c => [c.id, c]));
const N = {};
let failed = 0;
const check = (name, ok) => { if (!ok) failed++; console.log(ok ? '통과' : '실패', name); };

// 공이 고구마 앞을 지나간 뒤에 공격 키를 누른 상황
function swingLate(lag) {
  const s = rules.makeMatch([C.goguma, C.goguma], 7);
  while (s.phase === 'ready') rules.step(s, [N, N]);
  s.lag = lag;
  const p = s.players[0];
  p.x = 200;
  Object.assign(s.balls[0], { x: 250, y: 432, vx: 9, vy: 0 });
  for (let i = 0; i < 14; i++) { s.balls[0].vy = 0; s.balls[0].y = 432; rules.step(s, [N, N]); }
  const before = s.balls[0].vx;
  rules.step(s, [{ attack: true }, N]);
  return s.balls[0].vx !== before && s.balls[0].vy < 0;
}

check('되돌리기 없으면 지나간 공은 못 침', !swingLate([0, 0]));
check('왕복 시간만큼 되돌리면 맞음', swingLate([12, 12]));
check('너무 늦으면 여전히 못 침', !swingLate([3, 3]));
console.log(failed ? `실패 ${failed}개` : '모두 통과');
process.exit(failed ? 1 : 0);
