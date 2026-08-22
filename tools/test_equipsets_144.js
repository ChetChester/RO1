/* 三組寫在說明欄、卻沒有實裝的裝備套裝（#144）。

   玩家回報的兩件事：
     · 羊毛圍巾＋防水靴 說明寫 MHP+10%，穿上去血量一點沒變
     · 精靈戒指＋髮夾／幸運珠鏈 說明寫十字驅魔 +30%，傷害一樣

   共通的失效方式：效果只存在於 `desc` 那串文字裡，EQUIP_SETS 沒有對應條目。
   說明欄看得到、加成不存在，而且不會有任何錯誤訊息。

   所以這裡**不驗 EQUIP_SETS 有沒有那一筆**（那是把資料檔抄一遍），
   而是穿上去之後量 maxHp、量 MATK、量十字驅魔實際打出來的傷害。 */
const H = require('./harness');
const t = H.tester();

function priest() {
  const g = H.boot();
  H.mkChar(g, { path: ['acolyte', 'priest'], job: 'priest', baseLevel: 99,
    stats: { str: 1, agi: 1, vit: 50, int: 99, dex: 60, luk: 1 }, gold: 1e7 });
  return g;
}
const wear = (g, ids) => ids.forEach(id => { g.addItem(id, 1); g.equipItem(id); });
const setNames = g => g.activeEquipSets().map(s => s.name);

/* ---------- 羊毛圍巾＋防水靴：MHP +10% ---------- */
{
  const g = priest();
  wear(g, ['wool_scarf']);
  g.recomputeDerived(true);
  const solo = g.state.maxHp;
  wear(g, ['tidal_shoes']);
  g.recomputeDerived(true);
  const both = g.state.maxHp;
  t.ok('前提：兩件都穿上了', g.state.equip.garment === 'wool_scarf' && g.state.equip.footgear === 'tidal_shoes');
  t.ok('湊齊之後 MHP 真的變多', both > solo, solo + ' → ' + both);
  // 圍巾與靴子本身都沒有 hp 加成，所以差額就是那 10%
  t.eq('剛好是 +10%', both, Math.round(solo * 1.1), solo + ' → ' + both);
  t.ok('畫面上看得到套裝生效', setNames(g).includes('防水羊毛套裝'), setNames(g).join('、'));
  // 只穿一件不該有
  const g2 = priest();
  wear(g2, ['tidal_shoes']);
  g2.recomputeDerived(true);
  t.eq('只穿靴子不算一套', setNames(g2).filter(n => n === '防水羊毛套裝').length, 0);
}

/* ---------- 精靈戒指＋杖：MATK +6%、DEX +2 ---------- */
{
  const g = priest();
  wear(g, ['wizardy_staff']);
  g.recomputeDerived(true);
  const matk0 = g.state.matk, dex0 = g.state._totalDex;
  wear(g, ['spiritual_ring']);
  g.recomputeDerived(true);
  t.ok('戒指戴上去了', [g.state.equip.accessory1, g.state.equip.accessory2].includes('spiritual_ring'));
  t.ok('MATK 變多', g.state.matk > matk0, matk0 + ' → ' + g.state.matk);
  t.eq('DEX +2（戒指自己 +1、套裝再 +2）', g.state._totalDex - dex0, 3);
  t.ok('套裝顯示得出來', setNames(g).includes('精靈之杖套裝'), setNames(g).join('、'));
  /* 戒指本身**不該**再送固定 MATK+6：那是把套裝的「MATK+6%」誤寫成固定值。
     單戴一枚戒指只有 INT+2 DEX+1。 */
  const g2 = priest();
  wear(g2, ['spiritual_ring']);
  g2.recomputeDerived(true);
  // 對照組：不戴戒指，直接把 INT+2 DEX+1 加在素質上，兩邊 MATK 應該一模一樣
  const g3 = priest();
  g3.state.stats.int += 2; g3.state.stats.dex += 1;
  g3.recomputeDerived(true);
  t.eq('單戴戒指的 MATK 完全等同 INT+2（沒有多送固定 6 點）',
    g2.state.matk, g3.state.matk);
  t.eq('單戴戒指不算一套', setNames(g2).length, 0, setNames(g2).join('、'));
}

/* ---------- 精靈戒指＋髮夾／幸運珠鏈：十字驅魔 +30% ----------
   直接量技能打出來的傷害。十字驅魔是場域技，傷害不是當下結算的，
   所以看 activeFieldEffects 裡存下來的每跳傷害。 */
function asperioMult(g) {
  g.state.monsters = [{ defId: 'poring', hp: 1e9, maxHp: 1e9, id: 1 }];
  g.state.sp = g.state.maxSp;
  g.state.cooldowns = {};
  g.state.activeFieldEffects = [];
  g.castSkill('asperio');
  const f = (g.state.activeFieldEffects || [])[0];
  return f ? f.mult : 0;
}
{
  const g = priest();
  H.learn(g, 'asperio', 10);
  wear(g, ['clip']);
  g.recomputeDerived(true);
  const before = asperioMult(g);
  t.ok('前提：十字驅魔真的鋪得出場域', before > 0, '倍率 ' + before);

  wear(g, ['spiritual_ring']);
  g.recomputeDerived(true);
  const after = asperioMult(g);
  t.ok('套裝顯示得出來', setNames(g).includes('精靈飾品套裝'), setNames(g).join('、'));
  /* 比的是兩次實測的比值，不是絕對數字：倍率本身寫在 skills.js，
     抄過來對答案的話那邊改了這裡也跟著錯。 */
  t.eq('十字驅魔倍率剛好 +30%', +(after / before).toFixed(3), 1.3, before + ' → ' + after);
  // 只有戒指、沒有髮夾／珠鏈的話不該有
  const gSolo = priest();
  H.learn(gSolo, 'asperio', 10);
  wear(gSolo, ['spiritual_ring']);
  gSolo.recomputeDerived(true);
  t.eq('單戴戒指不會加十字驅魔', asperioMult(gSolo), before);

  // 幸運珠鏈也算數（官方寫「髮夾，或是幸運珠鏈」）
  const g2 = priest();
  wear(g2, ['spiritual_ring', 'rosary']);
  g2.recomputeDerived(true);
  t.ok('幸運珠鏈一樣湊得成套', setNames(g2).includes('精靈飾品套裝'), setNames(g2).join('、'));
  t.eq('SP 恢復速度 +9% 有進總表', g2.getCardBonus('spRegenPct'), 9);
  // 兩枚不相干的飾品湊不成
  const g3 = priest();
  wear(g3, ['clip', 'rosary']);
  g3.recomputeDerived(true);
  t.eq('沒有戒指就不成套', setNames(g3).filter(n => n === '精靈飾品套裝').length, 0);
}

process.exit(t.report('說明欄有、實裝沒有的三組套裝'));
