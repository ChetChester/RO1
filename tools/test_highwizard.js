/* 高等巫師 6 個技能的回歸測試（#63）。

   跑法：node tools/test_highwizard.js
*/
const H = require('./harness');

const t = H.tester();
const HW = { path: ['mage', 'wizard'], rebirth: true, job: 'highwizard' };

/* ---------- 1. 職業框架 ---------- */
{
  const g = H.boot();
  H.mkChar(g, HW);
  t.eq('職業是高等巫師', g.state.jobId, 'highwizard');
  const have = new Set(g.currentJob().skills.map(s => s.id));
  const own = ['hw_ganbantein', 'hw_napalmvulcan', 'hw_souldrain',
    'hw_magiccrasher', 'hw_magicpower', 'hw_gravitation'];
  t.ok('官方 6 個技能到齊', own.every(id => have.has(id)),
    own.filter(id => !have.has(id)).join(','));
  const wzIds = g.JOB_TREE.wizard.skills.map(s => s.id);
  t.ok('巫師的技能整份借過來', wzIds.every(id => have.has(id)),
    wzIds.filter(id => !have.has(id)).join(','));
}

/* ---------- 2. 咖般塔音（帶著兩種礦石時全場暈眩）---------- */
{
  const g = H.boot();
  H.mkChar(g, HW);
  H.learn(g, 'hw_ganbantein');
  t.ok('登記成被動', g.state.hasGanbantein);
  t.eq('每隻 50%', g.state.ganbanteinChance, 50);
  t.eq('冷卻 10 秒', g.state.ganbanteinCdSec, 10);

  const mkThree = () => {
    const ids = Object.keys(g.MONSTERS).filter(k => !g.MONSTERS[k].isBoss && g.MONSTERS[k].level < 30).slice(0, 3);
    g.state.monsters = ids.map(id => {
      g.state.monsterIdCounter = (g.state.monsterIdCounter || 0) + 1;
      return { defId: id, hp: 9e9, maxHp: 9e9, id: g.state.monsterIdCounter };
    });
    return g.state.monsters;
  };
  const stunned = ms => ms.filter(m => g.ailActive(m, 'stun') || (m.stunEnd || 0) > Date.now()).length;

  // 沒礦石 → 完全不觸發
  let ms = mkThree();
  g.state.ganbanteinReadyAt = 0;
  g.tryGanbantein();
  t.eq('沒有礦石就不觸發', stunned(ms), 0);

  // 只有一種也不行
  g.addItem('blue_gemstone', 5);
  ms = mkThree(); g.state.ganbanteinReadyAt = 0;
  g.tryGanbantein();
  t.eq('只有藍色礦石也不觸發', stunned(ms), 0);

  // 兩種都有 → 每隻各擲 50%，而且每次觸發各扣 1 個礦石
  g.addItem('yellow_gemstone', 5);
  const blue0 = g.getItemQty('blue_gemstone'), yellow0 = g.getItemQty('yellow_gemstone');
  ms = mkThree(); g.state.ganbanteinReadyAt = 0;
  g.tryGanbantein();
  t.eq('觸發一次各扣 1 個',
    (blue0 - g.getItemQty('blue_gemstone')) + ',' + (yellow0 - g.getItemQty('yellow_gemstone')), '1,1');

  let hit = 0, total = 0;
  for (let i = 0; i < 500; i++) {
    g.addItem('blue_gemstone', 1); g.addItem('yellow_gemstone', 1);   // 每輪補回來
    ms = mkThree();
    g.state.ganbanteinReadyAt = 0;
    g.tryGanbantein();
    hit += stunned(ms); total += ms.length;
  }
  t.near('每隻敵人 50% 暈眩', hit / total * 100, 50, 4);

  /* 礦石用完就發動不了——這一招的續航綁在庫存上，是使用者刻意加的成本 */
  while (g.getItemQty('blue_gemstone') > 0) g.removeItem('blue_gemstone', 1);
  ms = mkThree(); g.state.ganbanteinReadyAt = 0;
  g.tryGanbantein();
  t.eq('礦石用完就不發動', stunned(ms), 0);
  t.eq('不發動時另一種礦石也不會被扣', g.getItemQty('yellow_gemstone') > 0, true);

  // 冷卻中不重複（而且冷卻擋下時不該扣礦石）
  g.addItem('blue_gemstone', 5);
  ms = mkThree();
  g.state.ganbanteinReadyAt = 0;
  g.tryGanbantein();
  const afterFire = g.getItemQty('blue_gemstone');
  ms.forEach(m => { delete m.ail; delete m.stunEnd; });
  g.tryGanbantein();
  t.eq('10 秒冷卻內不重複', stunned(ms), 0);
  t.eq('冷卻擋下時不扣礦石', g.getItemQty('blue_gemstone'), afterFire);
}

/* ---------- 3. 念力連擊（念屬性範圍 + 詛咒）---------- */
{
  const g = H.boot();
  H.mkChar(g, HW);
  H.learn(g, 'hw_napalmvulcan');
  const sk = g.SKILLS.hw_napalmvulcan;
  t.eq('念屬性', sk.element, 'ghost');
  t.eq('Lv5 是 MATK 1750%', sk.mult[4], 17.5);
  t.eq('Lv5 詛咒 25%', sk.inflict.chance[4], 25);

  const mkThree = () => {
    const ids = Object.keys(g.MONSTERS).filter(k => !g.MONSTERS[k].isBoss && g.MONSTERS[k].level < 30
      && g.MONSTERS[k].element !== 'undead').slice(0, 3);
    g.state.monsters = ids.map(id => {
      g.state.monsterIdCounter = (g.state.monsterIdCounter || 0) + 1;
      return { defId: id, hp: 9e9, maxHp: 9e9, id: g.state.monsterIdCounter };
    });
    return g.state.monsters;
  };
  const ms = mkThree();
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  g.castSkill('hw_napalmvulcan', { free: true, forceLv: 5 });
  t.eq('三隻都吃到（魔法範圍不判命中）', ms.filter(m => m.hp < m.maxHp).length, 3);

  // 詛咒（#61 才把 inflict 接進範圍分支，這條斷言把它鎖住）
  let cursed = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    const mm = mkThree();
    g.state.sp = g.state.maxSp;
    g.castSkill('hw_napalmvulcan', { free: true, forceLv: 5 });
    mm.forEach(m => { n++; if (g.ailActive(m, 'curse')) cursed++; });
  }
  t.near('詛咒率 25%', cursed / n * 100, 25, 6);

  // 依基本等級遞增
  const mean = (bl) => {
    g.state.baseLevel = bl; g.recomputeDerived(true);
    let s = 0;
    for (let i = 0; i < 200; i++) {
      const mm = mkThree();
      g.state.sp = g.state.maxSp;
      const hp0 = mm[0].hp;
      g.castSkill('hw_napalmvulcan', { free: true, forceLv: 5 });
      s += hp0 - mm[0].hp;
    }
    return s / 200;
  };
  const lo = mean(1), hi = mean(99);
  t.ok('基本等級越高傷害越高', hi > lo * 1.2, `Lv1 ${Math.round(lo)} → Lv99 ${Math.round(hi)}`);
}

/* ---------- 4. 吸魂術（最大SP% + 擊殺回 SP）---------- */
{
  const g = H.boot();
  H.mkChar(g, HW);
  const sp0 = g.state.maxSp;
  H.learn(g, 'hw_souldrain');
  t.near('最大SP ×1.20', g.state.maxSp / sp0, 1.20, 0.015);
  t.eq('擊殺回 50 SP', g.state.spOnKillFlat, 50);

  const m = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m.defId];
  g.state.sp = 0;
  g.killMonster(md, m);
  t.eq('擊殺後真的回了 50', g.state.sp, 50);

  // 不會超過上限
  g.state.sp = g.state.maxSp - 5;
  const m2 = H.mon(g, { size: 'medium', isBoss: false });
  g.killMonster(g.MONSTERS[m2.defId], m2);
  t.eq('回復夾在上限', g.state.sp, g.state.maxSp);

  // 沒學就不回
  const g2 = H.boot();
  H.mkChar(g2, HW);
  const m3 = H.mon(g2, { size: 'medium', isBoss: false });
  g2.state.sp = 0;
  g2.killMonster(g2.MONSTERS[m3.defId], m3);
  t.eq('沒學就不回 SP', g2.state.sp, 0);
}

/* ---------- 5. 魔擊術（MATK 傷害走物理防禦）---------- */
{
  const g = H.boot();
  H.mkChar(g, HW);
  H.learn(g, 'hw_magiccrasher');
  t.ok('登記成被動', g.state.hasMagicCrasher);
  t.eq('觸發率 20%', g.state.magicCrasherChance, 20);
  t.eq('冷卻 5 秒', g.state.magicCrasherCdSec, 5);

  const fired = H.rate(3000,
    () => {
      const m = H.mon(g, { size: 'medium', isBoss: false });
      const md = g.MONSTERS[m.defId];
      const hp0 = m.hp;
      g.tryMagicCrasher(m, md);
      return m.hp < hp0;
    },
    () => { g.state.magicCrasherReadyAt = 0; });
  t.near('觸發率 20%', fired / 3000 * 100, 20, 3);

  // 冷卻中不重複
  const m = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m.defId];
  g.state.magicCrasherReadyAt = 0;
  let got = 0;
  for (let i = 0; i < 300; i++) { const hp0 = m.hp; g.tryMagicCrasher(m, md); if (m.hp < hp0) got++; }
  t.eq('5 秒冷卻內只打得出一發', got, 1);

  /* 傷害源是 MATK 不是 ATK：把 MATK 翻倍，傷害要跟著翻倍；
     把 ATK 翻倍則完全不動。 */
  const meanDmg = (n) => {
    let sum = 0, c = 0;
    for (let i = 0; i < n; i++) {
      const mm = H.mon(g, { size: 'medium', isBoss: false, minHp: 1e7 });
      g.state.magicCrasherReadyAt = 0;
      const hp0 = mm.hp;
      g.tryMagicCrasher(mm, g.MONSTERS[mm.defId]);
      if (mm.hp < hp0) { sum += hp0 - mm.hp; c++; }
    }
    return c ? sum / c : 0;
  };
  const base = meanDmg(600);
  const savedMatk = g.state.matk, savedAtk = g.state.atk;
  g.state.matk = savedMatk * 2;
  const dblMatk = meanDmg(600);
  g.state.matk = savedMatk;
  g.state.atk = savedAtk * 2; g.state._atkWeapon *= 2;
  const dblAtk = meanDmg(600);
  g.state.atk = savedAtk;
  /* 軟防是**固定扣血**（#11），所以原始傷害翻倍後的結果不會剛好是兩倍，
     而是 `2×base + 軟防`——比 2 倍再多一點。這裡照這條算式對，不是放寬容差。 */
  const probe = H.mon(g, { size: 'medium', isBoss: false, minHp: 1e7 });
  const soft = g.MONSTERS[probe.defId].defSoft || 0;
  t.near('MATK 翻倍 → 傷害＝2×原本＋軟防', dblMatk, 2 * base + soft, Math.max(2, base * 0.05));
  t.near('ATK 翻倍 → 傷害不變（傷害源是 MATK）', dblAtk / base, 1, 0.05);
}

/* ---------- 6. 魔力增幅（MATK buff）---------- */
{
  const g = H.boot();
  H.mkChar(g, HW);
  H.learn(g, 'hw_magicpower');
  const sk = g.SKILLS.hw_magicpower;
  t.eq('Lv10 是 +50%', sk.mult[9], 1.5);
  t.eq('持續 60 秒', sk.duration[9], 60);

  const m0 = g.state.matk, min0 = g.state.matkMin, max0 = g.state.matkMax;
  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('hw_magicpower', { free: true, forceLv: 10 });
  t.eq('推了一個 matk buff', g.state.buffs.filter(b => b.type === 'matk').length, 1);
  t.near('MATK ×1.5', g.state.matk / m0, 1.5, 0.02);
  t.near('matkMin 也跟著動', g.state.matkMin / min0, 1.5, 0.02);
  t.near('matkMax 也跟著動', g.state.matkMax / max0, 1.5, 0.02);

  // 魔法技能真的變強
  const mm = H.mon(g, { size: 'medium', isBoss: false, minHp: 1e7 });
  const md = g.MONSTERS[mm.defId];
  const withBuff = g.skillBaseDamage(true, md, 1);
  g.state.buffs = []; g.recomputeDerived(true);
  const noBuff = g.skillBaseDamage(true, md, 1);
  t.near('魔法傷害鏈 ×1.5', withBuff / noBuff, 1.5, 0.02);
  t.eq('buff 清掉後 MATK 還原', g.state.matk, m0);
}

/* ---------- 7. 重力原野（次數乘進倍率）---------- */
{
  const g = H.boot();
  H.mkChar(g, HW);
  H.learn(g, 'hw_gravitation');
  const sk = g.SKILLS.hw_gravitation;
  // 官方 100~500% × 2~10 次 → 1.0×2 / 2.0×4 / 3.0×6 / 4.0×8 / 5.0×10
  t.eq('逐級倍率＝官方倍率×次數', sk.mult.join(','), '2,8,18,32,50');
  t.eq('無屬性', sk.element, 'neutral');

  const ids = Object.keys(g.MONSTERS).filter(k => !g.MONSTERS[k].isBoss && g.MONSTERS[k].level < 30).slice(0, 3);
  g.state.monsters = ids.map(id => {
    g.state.monsterIdCounter = (g.state.monsterIdCounter || 0) + 1;
    return { defId: id, hp: 9e9, maxHp: 9e9, id: g.state.monsterIdCounter };
  });
  const ms = g.state.monsters;
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  g.castSkill('hw_gravitation', { free: true, forceLv: 5 });
  t.eq('三隻都吃到', ms.filter(m => m.hp < m.maxHp).length, 3);
}

process.exit(t.report('高等巫師 6 技能'));
