/* 高階祭司 4 個技能 + 「推了沒人讀」四條的回歸鎖（#64）。

   跑法：node tools/test_highpriest.js
*/
const H = require('./harness');

const t = H.tester();
const HP = { path: ['acolyte', 'priest'], rebirth: true, job: 'highpriest' };

/* ---------- 1. 職業框架 ---------- */
{
  const g = H.boot();
  H.mkChar(g, HP);
  t.eq('職業是高階祭司', g.state.jobId, 'highpriest');
  const have = new Set(g.currentJob().skills.map(s => s.id));
  const own = ['hp_manarecharge', 'hp_basilica', 'hp_assumptio', 'hp_meditatio'];
  t.ok('官方 4 個技能到齊', own.every(id => have.has(id)),
    own.filter(id => !have.has(id)).join(','));
  const prIds = g.JOB_TREE.priest.skills.map(s => s.id);
  t.ok('祭司的技能整份借過來', prIds.every(id => have.has(id)),
    prIds.filter(id => !have.has(id)).join(','));

  // 六個進階二轉全部有技能了
  const t3 = ['lordknight', 'highwizard', 'sniper', 'whitesmith', 'assassincross', 'highpriest'];
  const empty = t3.filter(j => !(g.JOB_TREE[j].skills || []).length);
  t.eq('六個進階二轉沒有一個是空的', empty.join(','), '');
}

/* ---------- 2. 魔力減免（技能 SP 消耗 −N%）---------- */
{
  const g = H.boot();
  H.mkChar(g, HP);
  const sk = g.SKILLS.heal;
  const before = g.skillSpCost(sk, 10);
  H.learn(g, 'hp_manarecharge');
  t.eq('Lv5 是 −20%', g.state.skillSpCostPct, -20);
  const after = g.skillSpCost(sk, 10);
  t.eq('治癒術 Lv10 的 SP 從 30 降到 24', before + '→' + after, '30→24');

  // 實際施放時扣的也是打折後的數字（判斷與扣款要走同一條）
  g.state.sp = 100; g.state.cooldowns = {};
  H.mon(g, { size: 'medium', isBoss: false });
  g.state.hp = 1;
  g.castSkill('heal', { forceLv: 10 });
  t.eq('真的只扣 24', 100 - g.state.sp, 24);
}

/* ---------- 3. 神聖殿堂（聖魔法 + 對暗/不死物理）---------- */
{
  const g = H.boot();
  H.mkChar(g, HP);
  H.learn(g, 'hp_basilica');
  const sk = g.SKILLS.hp_basilica;
  t.eq('Lv5 聖魔法 +15%', sk.mult[4], 1.15);
  t.eq('Lv5 物理 +25%', sk.physPct[4], 25);
  t.eq('目標屬性是暗與不死', (sk.targetElements || []).join(','), 'shadow,undead');

  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('hp_basilica', { free: true, forceLv: 5 });
  t.eq('推了兩個 buff', g.state.buffs.filter(b => b.skillId === 'hp_basilica').length, 2);
  t.near('聖屬性傷害 ×1.15', g.elementDmgMult('holy'), 1.15, 0.001);
  t.eq('其他屬性不受影響', g.elementDmgMult('fire'), 1);

  /* 對暗／不死屬性目標的物理 +25%——消費端合進 cardTargetDmgMult()，
     所以八個物理傷害路徑一次接滿。 */
  const byEle = ele => g.MONSTERS[Object.keys(g.MONSTERS).find(k => g.MONSTERS[k].element === ele && !g.MONSTERS[k].isBoss)];
  const byRace = r => g.MONSTERS[Object.keys(g.MONSTERS).find(k => g.MONSTERS[k].race === r
    && g.MONSTERS[k].element !== 'shadow' && !g.MONSTERS[k].isBoss)];
  const shadow = byEle('shadow'), fire = byEle('fire');
  /* **本作沒有任何怪是不死「屬性」**（element 只有 none/water/wind/shadow/earth/fire/
     poison/ghost/holy），所以同時認不死「種族」，不然這一半是做白工。 */
  t.eq('資料裡真的沒有不死屬性的怪',
    Object.values(g.MONSTERS).filter(m => m.element === 'undead').length, 0);
  const undeadRace = byRace('undead');
  t.ok('找得到不死種族的怪', !!undeadRace);
  t.near('對暗屬性 ×1.25', g.cardTargetDmgMult(shadow), 1.25, 0.001);
  t.near('對不死種族 ×1.25', g.cardTargetDmgMult(undeadRace), 1.25, 0.001);
  t.eq('對火屬性不變', g.cardTargetDmgMult(fire), 1);

  g.state.buffs = [];
  t.eq('buff 結束後回到 1', g.cardTargetDmgMult(shadow), 1);
}

/* ---------- 4. 聖母之祈福（DEF 固定值 + 治癒受量）---------- */
{
  const g = H.boot();
  H.mkChar(g, HP);
  ['armor', 'shield', 'garment', 'footgear', 'headgear'].forEach(s => H.wear(g, s));
  g.recomputeDerived(true);
  H.learn(g, 'hp_assumptio');
  const sk = g.SKILLS.hp_assumptio;
  t.eq('Lv5 DEF +250', sk.defFlat[4], 250);
  t.eq('Lv5 治癒受量 +10%', sk.mult[4], 1.10);

  const hard0 = g.debuffedDef(g.state.defHard, g.state.defSoft)[0];
  const soft0 = g.debuffedDef(g.state.defHard, g.state.defSoft)[1];
  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('hp_assumptio', { free: true, forceLv: 5 });
  const [hard1, soft1] = g.debuffedDef(g.state.defHard, g.state.defSoft);
  t.eq('硬防 +250', hard1 - hard0, 250);
  t.eq('軟防不動（官方寫的是「裝備」防禦力）', soft1, soft0);

  // 跟百分比的 DEF buff 疊起來：先乘再加
  g.state.buffs.push({ type: 'def', mult: 2, msRemaining: 9e5 });
  const [hard2] = g.debuffedDef(g.state.defHard, g.state.defSoft);
  t.eq('先乘百分比再加固定值', hard2, Math.round(g.state.defHard * 2) + 250);

  // 治癒受量
  g.state.buffs = g.state.buffs.filter(b => b.type !== 'def' || b.skillId === 'hp_assumptio');
  t.near('治癒量 ×1.10', g.healOutputMult(), 1.10, 0.001);
  g.state.buffs = [];
  t.eq('buff 結束後回到 1', g.healOutputMult(), 1);
}

/* ---------- 5. 冥想（最大SP / SP回復 / 治癒量）---------- */
{
  const g = H.boot();
  H.mkChar(g, HP);
  const sp0 = g.state.maxSp;
  H.learn(g, 'hp_meditatio');
  t.near('最大SP +10%', g.state.maxSp / sp0, 1.10, 0.012);
  t.eq('SP 自然恢復 +30%', g.state.skillSpRegenPct, 30);
  t.eq('治癒量 +20%', g.state.healBonusPct, 20);
  t.near('healOutputMult 反映出來', g.healOutputMult(), 1.20, 0.001);

  // 治癒術真的多回 20%
  const g2 = H.boot();
  H.mkChar(g2, HP);
  const healOnce = (gg) => {
    gg.state.hp = 1; gg.state.sp = gg.state.maxSp; gg.state.cooldowns = {};
    H.mon(gg, { size: 'medium', isBoss: false });
    gg.castSkill('heal', { free: true, forceLv: 10 });
    return gg.state.hp - 1;
  };
  const plain = healOnce(g2);
  const boosted = healOnce(g);
  t.near('治癒術恢復量 ×1.20', boosted / plain, 1.20, 0.02);

  // 冥想 + 聖母之祈福 相乘
  H.learn(g, 'hp_assumptio');
  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('hp_assumptio', { free: true, forceLv: 5 });
  t.near('被動 ×1.20 與 buff ×1.10 相乘', g.healOutputMult(), 1.32, 0.002);
}

/* ---------- 6. 回歸鎖：四條「推了卻沒人讀」都還讀得到 ---------- */
{
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'] });
  ['armor', 'shield', 'garment', 'footgear', 'headgear'].forEach(s => H.wear(g, s));
  g.recomputeDerived(true);

  // #24 buff_flee
  const f0 = g.effectiveFleeWithBuff();
  g.state.buffs = [{ type: 'flee', mult: 1, flatBonus: 30, msRemaining: 9e5 }];
  t.eq('#24 buff_flee 有人讀', g.effectiveFleeWithBuff() - f0, 30);

  // #58 buff_def（百分比）
  g.state.buffs = [];
  const d0 = g.debuffedDef(g.state.defHard, g.state.defSoft)[0];
  g.state.buffs = [{ type: 'def', mult: 1.5, msRemaining: 9e5 }];
  t.eq('#58 buff_def 有人讀', g.debuffedDef(g.state.defHard, g.state.defSoft)[0], Math.round(d0 * 1.5));

  // #58 技能吃得到 ATK buff
  g.state.buffs = []; g.recomputeDerived(true);
  const md = g.MONSTERS[H.mon(g, { size: 'medium', isBoss: false }).defId];
  const a0 = g.weaponChainDamage(md, 1, 'mid');
  g.state.buffs = [{ type: 'atk', mult: 2, msRemaining: 9e5 }];
  t.near('#58 技能吃得到 ATK buff', g.weaponChainDamage(md, 1, 'mid') / a0, 2, 0.01);

  // #61 VIT 的 flat buff
  g.state.buffs = []; g.recomputeDerived(true);
  const v0 = g.state._statBreakdown.vit.total;
  g.state.buffs = [{ type: 'allstat', mult: 1, flatBonus: 5, msRemaining: 9e5 }];
  g.recomputeDerived(true);
  t.eq('#61 VIT flat buff 有人讀', g.state._statBreakdown.vit.total - v0, 5);

  // #63 MATK buff
  g.state.buffs = []; g.recomputeDerived(true);
  const m0 = g.state.matk;
  g.state.buffs = [{ type: 'matk', mult: 1.5, msRemaining: 9e5 }];
  g.recomputeDerived(true);
  t.near('#63 MATK buff 有人讀', g.state.matk / m0, 1.5, 0.02);
}

process.exit(t.report('高階祭司 4 技能 + 進階二轉收尾'));
