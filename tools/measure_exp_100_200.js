/* 量 100~200 這一段「打寶模式一般檔」的實際經驗產出（#127）。

   跟 measure_exp_curve.js 同一套做法（真的跑 gameTick，不是估算），
   差別是角色換成進階二轉的領主騎士、farmMode 開一般檔。

     node tools/measure_exp_100_200.js [每級模擬分鐘數]
*/
const H = require('./harness');
const S = require('./exp_simlib');

const MIN = Number(process.argv[2] || 3);

function buildAdv(L) {
  const g = H.boot();
  // 走完整條轉職鏈：劍士 → 騎士 → 轉生 → 領主騎士（mkChar 要 path，只給 job 會停在新手）
  H.mkChar(g, { path: ['swordsman', 'knight'], job: 'lordknight', rebirth: true,
                baseLevel: L, jobLevel: 70, skillPoints: 400, gold: 1e12 });
  const s = g.state;
  // 素質照等級全點完（平均分配到 str/agi/dex/vit）
  s.stats = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
  let pts = 0; for (let l = 2; l <= L; l++) pts += g.statPointsAtLevel(l);
  s.statPoints = pts;
  let guard = 0;
  while (guard++ < 20000) {
    const b = s.statPoints;
    ['str', 'agi', 'dex', 'vit'].forEach(k => g.allocateStat(k));
    if (s.statPoints === b) break;
  }
  // 技能全點滿
  Object.keys(g.JOB_TREE).forEach(j => {
    if (!(g.JOB_TREE[j].skills || []).length) return;
    if (!s.jobSkillPoints) s.jobSkillPoints = {};
  });
  s.jobSkillPoints[s.jobId] = 400;
  (g.JOB_TREE[s.jobId].skills || []).forEach(sk => {
    for (let i = 0; i < (sk.maxLv || 1); i++) { try { g.levelUpSkill(sk.id); } catch (e) {} }
  });
  g.recomputeDerived(true);
  // 當級買得到的最好裝（無卡片無精煉，跟舊的量法一致）
  let best = null;
  Object.keys(g.ITEMS).forEach(k => {
    const it = g.ITEMS[k];
    if (it.type !== 'weapon' || !it.buyPrice) return;
    if (it.reqLevel && it.reqLevel > L) return;
    if (g.equipBlockReason(k)) return;
    if (!best || (it.atk || 0) > (g.ITEMS[best].atk || 0)) best = k;
  });
  if (best) { g.addItem(best, 1); g.equipItem(best); }
  ['leather', 'shield', 'garment', 'footgear', 'headgear'].forEach(type => {
    let b = null;
    Object.keys(g.ITEMS).forEach(k => {
      const it = g.ITEMS[k];
      if (it.type !== 'armor' || it.armorType !== type || !it.buyPrice) return;
      if (it.reqLevel && it.reqLevel > L) return;
      if (g.equipBlockReason(k)) return;
      if (!b || (it.def || 0) > (g.ITEMS[b].def || 0)) b = k;
    });
    if (b) { g.addItem(b, 1); g.equipItem(b); }
  });
  s.farmMode = g.FARM_MODE_NORMAL;
  g.recomputeDerived(true);
  return g;
}

const LEVELS = [100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 199];
const out = [];
console.log('Lv   職業           地圖                  怪Lv    exp/秒');
LEVELS.forEach(L => {
  const g = buildAdv(L);
  const cands = S.rankMaps(g, L, 3, 15);
  if (!cands.length) { console.log(String(L).padStart(3), '  找不到相稱地圖'); return; }
  let best = null;
  cands.forEach(c => {
    const v = S.runSim(buildAdv(L), c.m.id, MIN);
    if (!best || v > best.v) best = { v, c };
  });
  out.push({ L, expPerSec: best.v, map: best.c.m.name, mlv: Math.round(best.c.ml) });
  console.log(String(L).padStart(3), ' ', (g.JOB_TREE[g.state.jobId] || {}).name.padEnd(12),
    best.c.m.name.padEnd(20), String(Math.round(best.c.ml)).padStart(4),
    best.v.toFixed(0).padStart(10));
});

const g = H.boot();
const interp = L => {
  let a = out[0], b = out[out.length - 1];
  for (let i = 0; i < out.length - 1; i++) if (out[i].L <= L && out[i + 1].L >= L) { a = out[i]; b = out[i + 1]; }
  return a.L === b.L ? a.expPerSec
    : a.expPerSec + (b.expPerSec - a.expPerSec) * (L - a.L) / (b.L - a.L);
};
let totalNeed = 0, totalSec = 0;
const marks = {};
for (let L = 100; L < 200; L++) {
  const need = g.expToNextBaseLevel(L);
  totalNeed += need;
  totalSec += need / interp(L);
  marks[L + 1] = totalSec;
}
console.log('\n100→200 需求總量：', (totalNeed / 1e8).toFixed(2), '億');
console.log('平均 exp/秒：', (interp(150)).toFixed(0), '（Lv150 附近）');
console.log('\n以「全天候掛機」計（離線結算＝實戰外推，沒有折扣）：');
[110, 130, 150, 170, 190, 200].forEach(L => {
  const d = marks[L] / 86400;
  console.log(`  100 → ${L}   ${d < 1 ? (marks[L] / 3600).toFixed(1) + ' 小時' : d.toFixed(1) + ' 天'}`);
});
console.log('\n100→200 總計：', (totalSec / 86400).toFixed(1), '天（目標 90 天）');
console.log('倍率缺口：需求要乘上', (90 / (totalSec / 86400)).toFixed(2), '倍');
