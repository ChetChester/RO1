/* 緋紅系列上架、兩件弓補掉落、自動念咒吃學習等級、圖鑑分類（#138）。

   共通的失效方式都是**不會報錯**：
     · 武器在 ITEMS 裡好好地躺著，但沒有任何怪會掉 —— 玩家只能靠箱子撞
     · autoSpell 的等級寫死，說明卻寫「依自身學習的等級」—— 點滿只放 5 級
     · 圖鑑分類的 test 寫錯只會讓某一類永遠是空的，不會噴例外 */
const H = require('./harness');
const t = H.tester();
const g = H.boot();

// 玩家真的打得到的怪（配了地圖，或在 MVP 名單裡）
const reach = new Set();
g.MAPS.forEach(m => (m.monsters || []).forEach(x => reach.add(x.id)));
Object.values(g.MVP_MAP_DATA || {}).forEach(a => (a || []).forEach(x => reach.add(x)));

/* ---------- 緋紅系列：每一把都要有怪會掉 ---------- */
{
  const scarlet = Object.values(g.ITEMS)
    .filter(i => /^緋紅色/.test(i.name) && (i.type === 'weapon' || i.type === 'material'));
  t.ok('緋紅系列武器抓得到（後面的斷言才有意義）', scarlet.length >= 17, '共 ' + scarlet.length + ' 件');

  /* 官方頁面上沒有列出掉落來源的那幾件（緋紅蝴蝶結鞭 Lv170），
     以及來源怪本作沒有的，不強求 —— 但**大多數要有**。 */
  const gettable = scarlet.filter(i => g.getItemFarmSpots(i.id).length > 0);
  t.ok('緋紅系列大部分打得到了', gettable.length >= scarlet.length - 2,
    `${gettable.length}/${scarlet.length}：拿不到的是 ` +
    scarlet.filter(i => !g.getItemFarmSpots(i.id).length).map(i => i.name).join('、'));

  // 抽查三把，來源要落在**可達**的怪身上（掉在打不到的怪身上等於沒上架）
  ['scarlet_dagger', 'scarlet_bow', 'scarlet_bible'].forEach(id => {
    const spots = g.getItemSources(id).filter(s => reach.has(s.mon));
    t.ok(g.ITEMS[id].name + ' 有可達的來源', spots.length > 0,
      spots.map(s => g.MONSTERS[s.mon].name).join('、'));
  });
  // 掉落率照官方 0.5%，不要手滑寫成 50%
  const bad = [];
  scarlet.forEach(i => g.getItemSources(i.id).forEach(s => { if (s.chance > 0.05) bad.push(i.name + ' ' + s.chance); }));
  t.eq('緋紅系列的掉落率沒有寫成整數倍', bad.length, 0, bad.slice(0, 3).join('、'));
}

/* ---------- 使用者指定的兩筆 ---------- */
{
  const shecil = (g.MONSTERS.b_shecil.drops || []).find(d => d.item === 'luna_bow');
  t.ok('闇●神射手 迪文 掉露娜弓', !!shecil);
  t.eq('露娜弓 0.5%', shecil && shecil.chance, 0.005);
  const garg = (g.MONSTERS.gargoyle.drops || []).find(d => d.item === 'elven_bow');
  t.ok('蝙蝠弓箭手掉精靈之弓', !!garg);
  t.eq('精靈之弓 0.1%', garg && garg.chance, 0.001);
  t.ok('兩隻都打得到', reach.has('b_shecil') && reach.has('gargoyle'));
}

/* ---------- 名字掉字：鴞嫋首領／男爵 ---------- */
{
  t.eq('鴞嫋首領的名字補回來了', g.MONSTERS.owl_duke.name, '鴞嫋首領');
  t.eq('鴞嫋男爵的名字補回來了', g.MONSTERS.owl_baron.name, '鴞嫋男爵');
  /* 全庫再掃一次。這種掉字不只是難看——`人?精` 就是因為這樣，
     照官方來源對怪名時完全對不到，緋紅色鋼鐵鞭子差點漏掉一個掉落來源。 */
  const broken = Object.values(g.MONSTERS).filter(m => /\?/.test(m.name || ''));
  t.eq('沒有怪的名字帶著問號（掉字會讓對照官方資料時對不到）', broken.length, 0,
    broken.slice(0, 5).map(m => m.id + '=' + m.name).join('、'));
  t.ok('人參精的緋紅色鋼鐵鞭子有補上',
    (g.MONSTERS.wild_ginseng.drops || []).some(d => d.item === 'scarlet_wire'));
}

/* ---------- 自動念咒吃「玩家學到的等級」 ----------
   使用者回報：二連矢點滿 10 級，雙發神弓卻只會自動放 5 級。 */
function hunterWith(lv) {
  const gg = H.boot();
  H.mkChar(gg, { path: ['archer', 'hunter'], job: 'hunter', baseLevel: 99,
    stats: { str: 1, agi: 50, vit: 1, int: 1, dex: 99, luk: 1 } });
  // 二連矢是**弓箭手**的技能，轉獵人之後點數全在 hunter 那格，不補的話學不起來
  gg.state.jobSkillPoints.archer = 60;
  if (lv) H.learn(gg, 'doublestrafe', lv);
  gg.addItem('double_bound', 1); gg.equipItem('double_bound');
  gg.addItem('steel_arrow', 99999); gg.state.equip.ammo = 'steel_arrow';
  gg.recomputeDerived(true);
  gg.state.autoSkill = false;          // 只要自動念咒那條路，不要自動施放技能插隊
  return gg;
}
// 打到自動念咒觸發為止，回傳它放的等級
function autoSpellLv(gg, tries) {
  const mob = Object.values(gg.MONSTERS).find(m => !m.isBoss && m.exp > 0 && m.hp > 1e6);
  let got = 0;
  const orig = gg.logMsg;
  gg.logMsg = txt => { const m = /自動念咒！.*?Lv(\d+)/.exec(txt || ''); if (m) got = +m[1]; };
  for (let i = 0; i < (tries || 2000) && !got; i++) {
    gg.state.monsters = [{ defId: mob.id, hp: 1e9, maxHp: 1e9, id: 1 }];
    gg.state.sp = gg.state.maxSp;
    gg.playerAttack();
  }
  gg.logMsg = orig;
  return got;
}
{
  const spec = g.ITEMS.double_bound.autoSpell[0];
  t.ok('雙發神弓標了 useLearnedLv', !!spec.useLearnedLv);
  t.eq('保底等級留著（沒學過的人也要有效果）', spec.lv, 5);

  const g10 = hunterWith(10);
  t.eq('確實學到 10 級（後面的斷言才有意義）', g10.skillLv('doublestrafe'), 10);
  t.eq('點滿 10 級 → 自動念咒放 10 級', autoSpellLv(g10), 10);

  const g3 = hunterWith(3);
  t.eq('只點 3 級 → 放 3 級（不是保底的 5）', autoSpellLv(g3), 3);

  const g0 = hunterWith(0);
  t.eq('完全沒學 → 退回保底的 5 級', autoSpellLv(g0), 5);
}
{
  /* 沒標旗標的照舊吃固定等級。全庫掃一次：說明寫「依自身學習的等級」的
     必須標旗標，反過來標了旗標的技能也必須真的存在。 */
  let missFlag = 0, badSkill = 0;
  const re = /依自身學習|自身學習的等級/;
  const check = (holder) => {
    const spells = holder.autoSpell || [];
    if (re.test(holder.desc || '') && spells.length && !spells.some(a => a.useLearnedLv)) missFlag++;
    spells.forEach(a => { if (a.useLearnedLv && !g.findSkillAnywhere(a.skill)) badSkill++; });
  };
  Object.values(g.ITEMS).forEach(check);
  Object.values(g.CARDS).forEach(check);
  t.eq('說明寫「依學習等級」的都標了旗標', missFlag, 0);
  t.eq('標了旗標的技能都存在', badSkill, 0);
}

/* ---------- 圖鑑分類 ----------
   分類的 test 寫錯只會讓某一類永遠空著，不會噴例外，所以要驗**加起來等於全部**。 */
{
  const pool = g.getCodexPool();
  const RT = g.RELIC_TICKET_ID;
  // 這三組要跟 ui.js 的 CODEX_CATS 對齊；那邊改了這裡沒改，下面的總和就會對不上
  const CATS = {
    mon: { list: pool.monsters, tests: [
      id => !g.MONSTERS[id].isBoss, id => !!g.MONSTERS[id].isBoss] },
    card: { list: pool.cards, tests: ['weapon', 'armor', 'shield', 'headgear', 'garment', 'footgear', 'accessory']
      .map(s => id => (g.CARDS[id] || {}).slot === s) },
    item: { list: pool.items, tests: [
      id => g.ITEMS[id].type === 'weapon',
      id => g.ITEMS[id].type === 'armor' && g.ITEMS[id].armorType !== 'accessory',
      id => g.ITEMS[id].type === 'armor' && g.ITEMS[id].armorType === 'accessory',
      id => g.ITEMS[id].type === 'consumable' || g.ITEMS[id].type === 'ammo',
      id => g.ITEMS[id].type === 'relic' || id === RT,
      id => !['weapon', 'armor', 'consumable', 'ammo', 'relic'].includes(g.ITEMS[id].type) && id !== RT,
    ] },
  };
  Object.entries(CATS).forEach(([view, { list, tests }]) => {
    const counts = tests.map(fn => list.filter(fn).length);
    t.eq(view + ' 的分類加起來剛好等於全部（沒有漏網也沒有重複）',
      counts.reduce((a, b) => a + b, 0), list.length, counts.join('+'));
    t.eq(view + ' 沒有空的分類', counts.filter(n => n === 0).length, 0, counts.join(','));
  });
  // 遺物那一類要真的有東西（把遺物放進圖鑑池就是為了它）
  t.ok('遺物分類不是空的', pool.items.filter(id => g.ITEMS[id].type === 'relic').length > 0);
  t.ok('BOSS 分類抓得到頭目', pool.monsters.filter(id => g.MONSTERS[id].isBoss).length > 50);
}

process.exit(t.report('緋紅上架、學習等級自動念咒、圖鑑分類'));
