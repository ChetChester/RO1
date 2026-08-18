/* 創造者（#78）。官方 6 個做 3 個。

   只驗會壞的東西：
     - 兩個「喝藥加成」取大值不相加
     - 目標軟防增傷真的接上（怪物沒有 vit，用 defSoft 代替）
     - 化學保護合體版四個 buff 都掛得上，而且數值跟著單樣走
*/
const H = require('./harness');
const t = H.tester();

const mk = () => {
  const g = H.boot({ captureLog: true });
  H.mkChar(g, { path: ['merchant', 'alchemist'], rebirth: true, job: 'creator' });
  ['merchant', 'alchemist', 'creator'].forEach(j => { g.state.jobSkillPoints[j] = 400; });
  g.state.gold = 1e8;
  return g;
};
const learnDeep = (g, id, lv) => {
  const sk = g.SKILLS[id];
  const rs = sk.requires ? (Array.isArray(sk.requires) ? sk.requires : [sk.requires]) : [];
  rs.forEach(r => learnDeep(g, r.skillId, r.level));
  return H.learn(g, id, lv);
};

/* ---- 1. 三個刪除的沒有偷偷做進來 ---- */
{
  const g = mk();
  t.eq('職業名是創造者', g.JOB_TREE.creator.name, '創造者');
  ['bc_cultivation', 'bc_alchemy', 'bc_synthesispotion'].forEach(id =>
    t.ok(`${id} 沒做`, !g.SKILLS[id]));
  t.eq('自己的技能 3 個',
    g.JOB_TREE.creator.skills.filter(s => s.id.startsWith('bc_')).length, 3);
}

/* ---- 2. 喝藥加成取大值 ---- */
{
  const g = mk();
  learnDeep(g, 'am_potionpitcher', 5);
  const only5 = g.state.hpItemEffectBonusPct;
  t.eq('藥水投擲 Lv5 → +50', only5, 50);
  H.learn(g, 'bc_slimpitcher', 10);
  t.eq('再點滿纖細藥水投擲 → 取 100，不是 150', g.state.hpItemEffectBonusPct, 100);
  // 低等的那個不該把高的拉下來
  const g2 = mk();
  learnDeep(g2, 'bc_slimpitcher', 10);
  t.eq('先點纖細再算，一樣是 100', g2.state.hpItemEffectBonusPct, 100);
}

/* ---- 3. 強酸火煙瓶投擲：軟防越高打越痛 ---- */
{
  const g = mk();
  learnDeep(g, 'bc_aciddemonstration', 10);
  H.wield(g, 'axe1');
  g.state.stats.int = 99;
  g.recomputeDerived(true);
  g.state.hit = 9999;                    // 命中拉滿，排除 miss 干擾（#76 起 ATK 技能會判定）

  // 找兩隻軟防差很多的怪，其餘條件盡量接近
  const pool = Object.values(g.MONSTERS).filter(m => !m.isBoss && (m.element || 'none') === 'none');
  const lo = pool.slice().sort((a, b) => (a.defSoft || 0) - (b.defSoft || 0))[0];
  const hi = pool.slice().sort((a, b) => (b.defSoft || 0) - (a.defSoft || 0))[0];
  const hit = (md) => {
    const m = H.mon(g, { defId: md.id });
    m.hp = 9e9; m.maxHp = 9e9;
    g.state.cooldowns = {}; g.state.sp = g.state.maxSp; g.state.gold = 1e8;
    g.castSkill('bc_aciddemonstration');
    return 9e9 - m.hp;
  };
  t.ok('軟防高的吃到的倍率比較大', hit(hi) > hit(lo),
    `softDef ${lo.defSoft}→${hit(lo)} / ${hi.defSoft}→${hit(hi)}`);
  t.ok('欄位是 defSoft 不是 vit（怪物沒有 vit）', g.MONSTERS[lo.id].vit === undefined);
}

/* ---- 4. 化學保護合體版 ---- */
{
  const g = mk();
  learnDeep(g, 'bc_fullprotection', 5);
  H.wear(g, 'shield');
  g.state.sp = g.state.maxSp; g.state.gold = 1e8;
  g.state.cooldowns = {};
  t.eq('放得出來', g.castSkill('bc_fullprotection'), true);
  const mine = g.state.buffs.filter(b => b.skillId === 'bc_fullprotection');
  t.eq('一次掛四個', mine.length, 4);
  t.eq('四種都有',
    mine.map(b => b.type).sort().join(','), 'block,defflat,maxhppct,weaponatk');

  // 數值跟著單樣的定義走（改了單樣，合體版自動跟上）
  const cp = id => { const c = g.SKILLS[id]; return Array.isArray(c.mult) ? c.mult[4] : c.mult; };
  t.eq('DEF 跟化學頭盔保護一致', mine.find(b => b.type === 'defflat').flatBonus, cp('am_cp_helm'));
  t.eq('免傷機率跟化學盾牌保護一致', mine.find(b => b.type === 'block').flatBonus, cp('am_cp_shield'));
  t.eq('最大HP 跟化學鎧甲保護一致', mine.find(b => b.type === 'maxhppct').flatBonus, cp('am_cp_armor'));
  t.ok('免傷帶內部冷卻', mine.find(b => b.type === 'block').blockCdSec > 0);

  // 價錢是單樣的兩倍（都吃鍊金折扣，所以比的是折扣前的定義值）
  t.eq('鋅幣是單樣的兩倍',
    g.SKILLS.bc_fullprotection.zenyCost[0], g.SKILLS.am_cp_helm.zenyCost[0] * 2);
}

t.report('創造者 3 技能');
