/* 依實測產出反推 100~200 的經驗曲線（#127）。

   實測值來自 measure_exp_100_200.js（領主騎士、打寶一般檔、真的跑 gameTick）。
   這支只做數學：給一組分段比率，解出 Lv100 的起始需求，讓
   「24 小時掛機 × 90 天」剛好走完 100→200，然後把里程碑印出來看節奏。

     node tools/tune_exp_100_200.js
*/
const H = require('./harness');
const g = H.boot();

// 實測 exp/秒（打寶一般檔，領主騎士，商店裝無卡無精煉）
const MEASURED = [[100,707],[110,1821],[120,1358],[130,996],[140,957],
                  [150,944],[160,1023],[170,900],[180,1014],[190,1003],[199,1021]];
const rate = L => {
  let a = MEASURED[0], b = MEASURED[MEASURED.length-1];
  for (let i=0;i<MEASURED.length-1;i++) if (MEASURED[i][0]<=L && MEASURED[i+1][0]>=L) { a=MEASURED[i]; b=MEASURED[i+1]; }
  return a[0]===b[0] ? a[1] : a[1] + (b[1]-a[1])*(L-a[0])/(b[0]-a[0]);
};

const TARGET_DAYS = 90;

function curve(anchor, segs) {
  const need = [];
  let n = anchor, cur = 100;
  for (let L = 100; L < 200; L++) {
    need[L] = Math.floor(n);
    const seg = segs.find(([to]) => cur < to);
    n *= seg ? seg[1] : segs[segs.length-1][1];
    cur++;
  }
  return need;
}
function daysOf(need) {
  let sec = 0; const marks = {};
  for (let L = 100; L < 200; L++) { sec += need[L]/rate(L); marks[L+1] = sec/86400; }
  return { total: sec/86400, marks };
}
// 解 anchor：時間跟 anchor 成正比，一次除法就到位
function solve(segs) {
  const probe = curve(1e6, segs);
  const d = daysOf(probe).total;
  return 1e6 * TARGET_DAYS / d;
}

const CANDIDATES = {
  '現行（#110）':      [[130,1.045],[150,1.06],[180,1.085],[200,1.1313]],
  'A 很平緩':          [[130,1.015],[150,1.02],[180,1.025],[200,1.035]],
  'B 中等':            [[130,1.02],[150,1.025],[180,1.03],[200,1.045]],
  'C 偏後段':          [[130,1.025],[150,1.03],[180,1.04],[200,1.06]],
  'D 接軌段+中等':     [[110,1.30],[130,1.02],[150,1.025],[180,1.03],[200,1.045]],
  'E 接軌段+平緩':     [[110,1.35],[130,1.015],[150,1.02],[180,1.025],[200,1.035]],
  'F 長接軌段':        [[115,1.22],[135,1.03],[160,1.035],[185,1.04],[200,1.05]],
};

const L99 = g.expToNextBaseLevel(99);
console.log('Lv99→100 的需求（現行，不動）：', L99.toLocaleString());
console.log('目標：打寶一般檔 24 小時掛機，100→200 共', TARGET_DAYS, '天\n');

Object.entries(CANDIDATES).forEach(([name, segs]) => {
  const anchor = solve(segs);
  const need = curve(anchor, segs);
  const { total, marks } = daysOf(need);
  const last10 = (() => { let a=0,b=0; for(let L=100;L<200;L++){const t=need[L]/rate(L); b+=t; if(L>=190)a+=t;} return a/b*100; })();
  console.log(`── ${name}`);
  console.log(`   Lv100 需求 ${Math.round(anchor).toLocaleString()}（Lv99 的 ${(anchor/L99).toFixed(1)} 倍）  Lv199 需求 ${need[199].toLocaleString()}  末段/起點 ${(need[199]/anchor).toFixed(0)}x`);
  console.log(`   總量 ${(need.reduce((a,b)=>a+(b||0),0)/1e8).toFixed(1)} 億　總時 ${total.toFixed(0)} 天　最後 10 級佔 ${last10.toFixed(0)}%`);
  console.log('   到達 ' + [110,125,150,170,185,200].map(L =>
    `${L}：${marks[L] < 1 ? (marks[L]*24).toFixed(1)+'h' : marks[L].toFixed(0)+'d'}`).join('  '));
  console.log();
});
