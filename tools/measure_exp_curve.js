/* 量「玩家每秒實際拿多少經驗」，經驗曲線就是照這條反推的（#80）。

     node tools/measure_exp_curve.js

   **是真的跑，不是估算**：把 gameTick() 接上假時鐘，一路 100ms 推過去，
   走的是真正的 spawnMonster / playerAttack / tryAutoCastSkill。
   engine.js 裡本來就有一支 estimateMapYield()（地圖分頁顯示的那個數字），
   但那支只算普通攻擊；實測下來 Lv99 開技能是純普攻的 4.75 倍，
   拿估算值去配曲線的話高等會整個算錯。

   參考角色：劍士→騎士、技能點滿、穿當級商店買得到的最好裝、無卡片無精煉，
   地圖自動挑「怪物平均等級落在玩家 ±10」裡估算最高的前三名，各實跑 4 分鐘，
   贏的那張再跑 8 分鐘定案。死了就原地滿血復活（不計損失），所以量到的是上限。

   目前這條曲線的目標節奏（使用者 2026-08-15 指定）：
     基礎 1→50 一小時、50→80 兩小時、80→99 三小時
   改了怪物經驗、技能倍率或裝備數值之後，跑這支重新對一次。 */
const S = require('./exp_simlib');

const LEVELS = [1];
for (let L = 5; L <= 95; L += 5) LEVELS.push(L);
LEVELS.push(99);

const out = [];
console.log('Lv  地圖                怪Lv   exp/秒   估算前3名');
LEVELS.forEach(L => {
  const cands = S.rankMaps(S.build(L, true), L, 3);
  if (!cands.length) { console.log(String(L).padStart(3), ' 找不到等級相稱的地圖'); return; }
  let best = null;
  cands.forEach(c => {
    const v = S.runSim(S.build(L, true), c.m.id, 4);
    if (!best || v > best.v) best = { v, c };
  });
  const fin = S.runSim(S.build(L, true), best.c.m.id, 8);
  out.push({ L, map: best.c.m.name, mapId: best.c.m.id, mlv: Math.round(best.c.ml), expPerSec: fin });
  console.log(String(L).padStart(3), best.c.m.name.padEnd(18), String(Math.round(best.c.ml)).padStart(4),
    fin.toFixed(1).padStart(9), '  ', cands.map(c => c.m.name).join(' / '));
});

/* 拿實測產出去驗現行曲線的三段時數。差太多就代表曲線該重配了。 */
const g = S.build(50, true);
const interp = L => {
  let a = out[0], b = out[out.length - 1];
  for (let i = 0; i < out.length - 1; i++) if (out[i].L <= L && out[i + 1].L >= L) { a = out[i]; b = out[i + 1]; }
  return a.L === b.L ? a.expPerSec
    : a.expPerSec + (b.expPerSec - a.expPerSec) * (L - a.L) / (b.L - a.L);
};
const seg = (a, b) => { let s = 0; for (let L = a; L < b; L++) s += g.expToNextBaseLevel(L) / interp(L); return s / 3600; };
console.log('\n現行曲線的實際時數： 1→50 %s h（目標 1）　50→80 %s h（目標 2）　80→99 %s h（目標 3）',
  seg(1, 50).toFixed(2), seg(50, 80).toFixed(2), seg(80, 99).toFixed(2));
