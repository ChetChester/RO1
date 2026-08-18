/* 流氓 13 個技能：卸除四連疊加、普攻觸發、抄襲自選、偷錢（#69）。

   跑法：node tools/test_rogue.js
*/
const H = require('./harness');

const t = H.tester();
const RG = { path: ['thief', 'rogue'] };

/* ---------- 1. 職業框架 ---------- */
{
  const g = H.boot();
  H.mkChar(g, RG);
  t.eq('職業是流氓', g.state.jobId, 'rogue');
  t.eq('tier 2', g.currentJob().tier, 2);
  t.eq('父職是盜賊', g.currentJob().parent, 'thief');
  t.eq('盜賊現在有兩條分支', g.JOB_TREE.thief.next.join(','), 'assassin,rogue');
  t.ok('流氓已從待辦清單移除', !(g.JOBS_TIER2_PENDING || []).some(j => j.id === 'rogue'));

  const have = new Set(g.currentJob().skills.map(s => s.id));
  const own = ['rg_snatcher', 'rg_stealcoin', 'rg_backstap', 'rg_tunneldrive', 'rg_raid',
    'rg_intimidate', 'rg_plagiarism', 'rg_striphelm', 'rg_stripshield',
    'rg_striparmor', 'rg_stripweapon', 'rg_compulsion', 'rg_closeconfine'];
  t.ok('自己的 13 個技能到齊', own.every(id => have.has(id)), own.filter(id => !have.has(id)).join(','));
  const thiefIds = g.JOB_TREE.thief.skills.map(s => s.id);
  t.ok('盜賊的技能整份借過來', thiefIds.every(id => have.has(id)), thiefIds.filter(id => !have.has(id)).join(','));

  // 擱置與刪除的
  t.eq('流氓天國擱置（等隊友模式）', !!g.SKILLS.rg_gangster, false);
  ['rg_cleaner', 'rg_flaggraffiti', 'rg_graffiti'].forEach(id =>
    t.eq(id + ' 已刪除', !!g.SKILLS[id], false));

  // HP/SP 表與攻速表
  t.eq('有自己的 HP 表', (g.JOB_BASE_HP.rogue || []).length, 100);
  t.eq('HP99 = 4734', g.JOB_BASE_HP.rogue[98], 4734);
  t.eq('SP99 = 505', g.JOB_BASE_SP.rogue[98], 505);
  /* 上游 `x_流氓_神行太保` 那列寫著 axe1: -6（盾牌欄跑錯位置），
     照抄會讓流氓拿得動斧頭而且攻速被夾到下限。派生時拿掉。 */
  t.eq('攻速表沒有斧頭', g.ASPD_WEAPON_BASE.rogue.weapons.axe1, undefined);
  t.eq('上游那格確實是負的（所以才要修）', g.ASPD_WEAPON_BASE['x_流氓_神行太保'].weapons.axe1, -6);
  ['dagger', 'sword1', 'bow'].forEach(c =>
    t.ok('攻速表有 ' + c, g.ASPD_WEAPON_BASE.rogue.weapons[c] > 0));
  const axe = Object.keys(g.ITEMS).find(k => g.ITEMS[k].weaponCat === 'axe1');
  t.eq('流氓拿不動斧頭', g.jobCanUseWeapon('rogue', axe), false);
}

/* ---------- 2. 轉職自動獲得：緊密的約束 ---------- */
{
  const g = H.boot();
  H.mkChar(g, RG);
  const sk = g.SKILLS.rg_closeconfine;
  t.eq('轉職自動獲得', sk.autoGrant, true);
  t.eq('沒花技能點就學會了', g.state.learnedSkills.rg_closeconfine, 1);
  t.eq('5% 觸發', sk.procChance[0], 5);
  t.eq('敵人迴避 −20', sk.enemyFleeCut[0], 20);
  t.eq('自身迴避 +10', sk.selfFlee[0], 10);
  t.eq('持續 10 秒 / CD 10 秒', sk.duration[0] + '/' + sk.internalCooldown[0], '10/10');
  t.ok('設定進了 state', !!g.state.closeConfineProc);

  // 觸發之後：怪物的命中門檻降低、自己的迴避上升
  const m = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m.defId];
  const hit0 = g.hitChancePctVsMonster(g.effectiveHitWithBuff(), md, m);
  const flee0 = g.effectiveFleeWithBuff();
  g.state.closeConfineProc.chance = 100;      // 逼它一定觸發
  g.state.songProcReadyAt = {};
  g.tryRogueProcs(m, md);
  t.eq('怪物迴避 −20', m.debuffFlee, 20);
  const hit1 = g.hitChancePctVsMonster(g.effectiveHitWithBuff(), md, m);
  t.ok('命中率上升（或已經封頂）', hit1 >= hit0, `${hit0} → ${hit1}`);
  t.eq('自身迴避 +10', g.effectiveFleeWithBuff() - flee0, 10);

  // 過期後自己清掉
  m.debuffFleeEnd = Date.now() - 1;
  g.hitChancePctVsMonster(g.effectiveHitWithBuff(), md, m);
  t.eq('過期後欄位清掉', m.debuffFlee, undefined);
}

/* ---------- 3. 卸除四連：疊加、各自冷卻 ---------- */
{
  const g = H.boot();
  H.mkChar(g, RG);
  ['rg_striphelm', 'rg_stripshield', 'rg_striparmor', 'rg_stripweapon'].forEach(id => H.learn(g, id, 5));
  g.recomputeDerived(true);
  t.eq('四個都進了清單', (g.state.stripProcs || []).length, 4);
  t.eq('Lv5 機率都是 30%', [...new Set(g.state.stripProcs.map(p => p.chance))].join(','), '30');
  t.eq('持續 135 秒', [...new Set(g.state.stripProcs.map(p => p.durSec))].join(','), '135');

  const m = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m.defId];
  // 逼四個全部觸發
  g.state.stripProcs.forEach(p => { p.chance = 100; });
  g.state.songProcReadyAt = {};
  g.tryRogueProcs(m, md);
  t.eq('四個都掛上去了', Object.keys(m.strip || {}).length, 4);

  /* 盾牌 −15% 與鎧甲 −10% 疊加 → 0.85 × 0.90 = 0.765 */
  t.near('DEF 兩個疊起來', g.stripMult(m, 'def'), 0.765, 0.0001);
  /* 武器 −25% 與頭盔（本作沒有怪帶 MATK → 退回 ATK −10%）疊加 → 0.75 × 0.90 = 0.675 */
  t.near('ATK 兩個疊起來', g.stripMult(m, 'atk'), 0.675, 0.0001);
  t.eq('本作真的沒有怪帶 matk',
    Object.values(g.MONSTERS).filter(x => x.matk > 0).length, 0);
  t.eq('所以頭盔走 ATK 分支', (m.strip.rg_striphelm || {}).kind, 'atk');
  t.near('頭盔的退回值是 0.9', (m.strip.rg_striphelm || {}).mult, 0.9, 0.0001);

  // 真的削到怪物的攻防
  t.near('monDebuffAtk 讀得到', g.monDebuffAtk(m), 0.675, 0.0001);
  /* 硬防要拿一隻**防禦本來就夠高**的怪來看——`defOf()` 會 Math.round，
     DEF 只有 2 的怪乘 0.765 之後還是 2，看不出差別。 */
  const tough = Object.values(g.MONSTERS).find(x => (x.def || 0) >= 50 && !x.isBoss);
  t.ok('找得到高防的怪', !!tough);
  const dirty = { defId: tough.id, hp: 9e9, maxHp: 9e9, id: 8001, strip: m.strip };
  const clean = { defId: tough.id, hp: 9e9, maxHp: 9e9, id: 8002 };
  const [hard] = g.defOf(tough, 1, false, dirty);
  const [hard0] = g.defOf(tough, 1, false, clean);
  t.ok('硬防真的降了', hard < hard0, `${hard0} → ${hard}`);
  t.near('降幅就是 0.765', hard, hard0 * 0.765, 0.001);

  // 同一個技能重複觸發只是刷新，不會無限疊
  g.state.songProcReadyAt = {};
  g.tryRogueProcs(m, md);
  t.eq('重複觸發不加格', Object.keys(m.strip).length, 4);
  t.near('倍率沒有再往下掉', g.stripMult(m, 'def'), 0.765, 0.0001);

  // 過期後自己清掉
  Object.keys(m.strip).forEach(k => { m.strip[k].end = Date.now() - 1; });
  t.eq('過期後回到 1', g.stripMult(m, 'def'), 1);
  t.eq('格子也清空了', Object.keys(m.strip).length, 0);

  // 內部冷卻：連打不會每一下都中
  const g2 = H.boot();
  H.mkChar(g2, RG);
  H.learn(g2, 'rg_stripweapon', 5);
  g2.recomputeDerived(true);
  g2.state.stripProcs.forEach(p => { p.chance = 100; });
  const m2 = H.mon(g2, { size: 'medium', isBoss: false });
  const md2 = g2.MONSTERS[m2.defId];
  g2.state.songProcReadyAt = {};
  let applied = 0;
  for (let i = 0; i < 20; i++) {
    m2.strip = {};
    g2.tryRogueProcs(m2, md2);
    if (Object.keys(m2.strip).length) applied++;
  }
  t.eq('CD 5 秒內只中一次', applied, 1);
}

/* ---------- 4. 偷錢：DEX/LUK 加成與金額 ---------- */
{
  const g = H.boot();
  H.mkChar(g, RG);
  const sk = g.SKILLS.rg_stealcoin;
  t.eq('是被動', sk.type, 'passive');
  t.eq('Lv10 基礎 10%', sk.mult[9], 10);
  t.eq('DEX 滿加 20%', sk.dexMaxBonus[0], 20);
  t.eq('LUK 滿加 10%', sk.lukMaxBonus[0], 10);
  t.eq('偷 10%', sk.stealPct, 10);

  H.learn(g, 'rg_stealcoin', 10);
  g.state.stats.dex = 99; g.state.stats.luk = 99;
  g.recomputeDerived(true);
  t.eq('基礎機率 10', g.state.stealCoinChance, 10);

  // DEX99 + LUK99 → 10 + 20 + 10 = 40%
  const m = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m.defId];
  const got = H.rate(4000, () => {
    const before = g.state.gold;
    g.state.songProcReadyAt = {};
    g.tryRogueProcs(m, md);
    return g.state.gold > before;
  });
  t.near('DEX99+LUK99 → ≈40%', got / 4000 * 100, 40, 3);

  // 素質歸零就只剩基礎 10%
  g.state.stats.dex = 0; g.state.stats.luk = 0;
  g.recomputeDerived(true);
  const got2 = H.rate(4000, () => {
    const before = g.state.gold;
    g.state.songProcReadyAt = {};
    g.tryRogueProcs(m, md);
    return g.state.gold > before;
  });
  t.near('素質 0 → ≈10%', got2 / 4000 * 100, 10, 2);

  // 金額 = 擊殺獎勵的 10%
  g.state.stats.dex = 99; g.state.stats.luk = 99;
  g.recomputeDerived(true);
  g.state.stealCoinChance = 1000;   // 必中
  g.state.songProcReadyAt = {};
  const before = g.state.gold;
  g.tryRogueProcs(m, md);
  const full = Math.round((3 + (md.level || 1) * 1.4));
  t.eq('偷到擊殺獎勵的 10%', g.state.gold - before, Math.max(1, Math.round(full * 0.1)));
}

/* ---------- 5. 強奪與強制減價：併進既有欄位 ---------- */
{
  const g = H.boot();
  H.mkChar(g, RG);
  g.recomputeDerived(true);
  const steal0 = g.state.stealChance;
  H.learn(g, 'rg_snatcher', 10);
  g.recomputeDerived(true);
  t.eq('強奪 +20% 偷竊機率', g.state.stealChance - steal0, 20);

  const disc0 = g.state.shopDiscountMult;
  H.learn(g, 'rg_compulsion', 5);
  g.recomputeDerived(true);
  t.near('強制減價 −25%', g.state.shopDiscountMult, disc0 * 0.75, 0.0001);
  // 真的影響售價
  const item = Object.keys(g.ITEMS).find(k => g.ITEMS[k].buyPrice > 100);
  const unit = Math.max(1, Math.round(g.ITEMS[item].buyPrice * g.state.shopDiscountMult));
  t.ok('買價變便宜', unit < g.ITEMS[item].buyPrice, `${g.ITEMS[item].buyPrice} → ${unit}`);
}

/* ---------- 6. 潛遁與潛擊（前置） ---------- */
{
  const g = H.boot();
  H.mkChar(g, RG);
  g.recomputeDerived(true);
  const crit0 = g.state.critRate;
  H.learn(g, 'rg_tunneldrive', 1);
  g.recomputeDerived(true);
  t.eq('潛遁暴擊 +5', g.state.critRate - crit0, 5);
  t.eq('潛擊的前置是潛遁', g.SKILLS.rg_raid.requires.skillId, 'rg_tunneldrive');

  H.learn(g, 'rg_raid', 5);
  g.recomputeDerived(true);
  t.ok('潛擊設定進了 state', !!g.state.raidProc);
  t.eq('Lv5 ATK 800%', g.SKILLS.rg_raid.mult[4], 8);
  t.eq('20% 觸發 / CD10', g.state.raidProc.chance + '/' + g.state.raidProc.cdSec, '20/10');
  t.eq('受傷加重 +30%，持續 10 秒', g.state.raidProc.dmgTakenPct + '/' + g.state.raidProc.boostSec, '30/10');

  // 打全體 + 掛上受傷加重
  const mons = [];
  for (let i = 0; i < 3; i++) mons.push(H.mon(g, { size: 'medium', isBoss: false }));
  mons.forEach(m => { m.maxHp = m.hp = 5e8; });
  const md = g.MONSTERS[mons[0].defId];
  g.state.hit = 100000;
  g.state.raidProc.chance = 100;
  g.state.songProcReadyAt = {};
  const hp0 = mons.map(m => m.hp);
  g.tryRogueProcs(mons[0], md);
  t.ok('全場都吃到傷害', g.state.monsters.every((m, i) => m.hp < hp0[i]));
  t.ok('都掛上了受傷加重', g.state.monsters.every(m => m.dmgTakenBoost === 1.3),
    g.state.monsters.map(m => m.dmgTakenBoost).join(','));
  t.near('monDmgTakenBoost 讀得到', g.monDmgTakenBoost(g.state.monsters[0]), 1.3, 0.0001);
  /* 加傷併進 ailDmgTakenMult()——那條被八個傷害路徑呼叫，
     所以普攻、技能、範圍技全部自動吃到。 */
  t.near('併進 ailDmgTakenMult', g.ailDmgTakenMult(g.state.monsters[0]), 1.3, 0.0001);

  g.state.monsters[0].dmgTakenBoostEnd = Date.now() - 1;
  t.eq('過期回到 1', g.monDmgTakenBoost(g.state.monsters[0]), 1);
}

/* ---------- 7. 脅持：只留傷害 ---------- */
{
  const g = H.boot();
  H.mkChar(g, RG);
  H.learn(g, 'rg_intimidate', 5);
  g.recomputeDerived(true);
  t.eq('Lv5 ATK 250%', g.SKILLS.rg_intimidate.mult[4], 2.5);
  t.eq('20% / CD5', g.state.intimidateProc.chance + '/' + g.state.intimidateProc.cdSec, '20/5');

  const m = H.mon(g, { size: 'medium', isBoss: false });
  m.maxHp = m.hp = 5e8;
  const md = g.MONSTERS[m.defId];
  g.state.intimidateProc.chance = 100;
  g.state.songProcReadyAt = {};
  const hp0 = m.hp;
  g.tryRogueProcs(m, md);
  t.ok('真的打出傷害', m.hp < hp0, `-${hp0 - m.hp}`);
}

/* ---------- 8. 背刺：短劍加倍、弓減半 ---------- */
{
  const sk0 = H.boot().SKILLS.rg_backstap;
  t.eq('Lv10 ATK 700%', sk0.mult[9], 7);
  t.eq('短劍 ×2', sk0.daggerMult, 2);
  t.eq('弓 ×0.5', sk0.bowMult, 0.5);
  t.eq('命中加成 +40', sk0.hitBonusOnCast[9], 40);

  const hitOnce = (cat) => {
    const g = H.boot();
    H.mkChar(g, RG);
    H.learn(g, 'rg_backstap', 10);
    g.state.hit = 100000;
    H.wield(g, cat);
    g.recomputeDerived(true);
    const m = H.mon(g, { size: 'medium', isBoss: false });
    m.maxHp = m.hp = 5e9;
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const before = m.hp;
      g.state.sp = g.state.maxSp; g.state.cooldowns = {};
      g.castSkill('rg_backstap', { free: true, forceLv: 10 });
      total += before - m.hp;
    }
    return total;
  };
  const dag = hitOnce('dagger');
  const sw = hitOnce('sword1');
  const bow = hitOnce('bow');
  t.ok('三種武器都打得出傷害', dag > 0 && sw > 0 && bow > 0);
  t.ok('短劍明顯高於單手劍（×2）', dag / sw > 1.4, `倍數 ${(dag / sw).toFixed(2)}`);
  t.ok('弓明顯低於單手劍（×0.5）', bow / sw < 0.8, `倍數 ${(bow / sw).toFixed(2)}`);
}

/* ---------- 9. 抄襲：自選一個攻擊技能，等級被夾住 ---------- */
{
  const g = H.boot();
  H.mkChar(g, RG);
  t.eq('沒學抄襲時挑不了', g.setPlagiarismSkill('meteorstorm'), false);

  H.learn(g, 'rg_plagiarism', 5);
  g.recomputeDerived(true);
  t.eq('抄襲等級 5', g.state.plagiarismLv, 5);
  t.eq('攻速也 +5%', g.state.songAspdPct, 5);

  const choices = g.plagiarismChoices();
  t.ok('挑得到東西', choices.length > 20, '' + choices.length);
  t.ok('清單裡都是攻擊技', choices.every(s => s.type !== 'passive' && !/^buff_/.test(s.type)));
  t.ok('本職已有的技能不在清單裡',
    !choices.some(s => g.currentJob().skills.some(x => x.id === s.id)));

  t.eq('挑一個 maxLv 10 的技能', g.setPlagiarismSkill('meteorstorm'), true);
  t.eq('記住了', g.state.plagiarismSkillId, 'meteorstorm');
  t.eq('等級被抄襲夾成 5', g.skillLv('meteorstorm'), 5);
  t.ok('技能列看得到', g.usableSkillEntries().some(e => e.sk.id === 'meteorstorm'));
  t.ok('找得到定義', !!g.findSkillForUse('meteorstorm'));

  /* 技能本身的上限比抄襲低時，取較低的那個 */
  const lowMax = Object.keys(g.SKILLS).find(id => g.SKILLS[id].maxLv === 1
    && ['damage', 'magic', 'damage_aoe', 'magic_aoe'].includes(g.SKILLS[id].type)
    && !g.findSkillById(id));
  if (lowMax) {
    g.setPlagiarismSkill(lowMax);
    t.eq('maxLv 1 的技能只到 1', g.skillLv(lowMax), 1);
  } else {
    t.ok('（沒有 maxLv 1 的攻擊技可驗，跳過）', true);
  }

  // 非攻擊技能挑不了
  t.eq('挑不了 buff 技能', g.setPlagiarismSkill('increaseagi'), false);
  t.eq('挑不了被動', g.setPlagiarismSkill('rg_snatcher'), false);

  // 抄襲等級提高，能用的等級跟著提高
  g.setPlagiarismSkill('meteorstorm');
  H.learn(g, 'rg_plagiarism', 10);
  g.recomputeDerived(true);
  t.eq('抄襲 Lv10 → 技能也到 10', g.skillLv('meteorstorm'), 10);

  // 清空
  g.setPlagiarismSkill(null);
  t.eq('清空後回到 0', g.skillLv('meteorstorm'), 0);
  t.eq('技能列也不見了', g.usableSkillEntries().some(e => e.sk.id === 'meteorstorm'), false);
}

process.exit(t.report('流氓 13 技能 + 卸除疊加與抄襲'));
