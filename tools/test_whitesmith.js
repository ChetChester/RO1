/* 神匠 5 個技能 + 進階二轉取代二轉的回歸測試（#60）。

   跑法：node tools/test_whitesmith.js
   全過就印一行；有失敗才列出來，並以 exit code 1 結束。
*/
const H = require('./harness');

const t = H.tester();
const WS = { path: ['merchant', 'blacksmith'], rebirth: true, job: 'whitesmith' };

/* ---------- 1. 職業框架 + 借來的鐵匠技能 ---------- */
{
  const g = H.boot();
  H.mkChar(g, WS);
  t.eq('職業是神匠', g.state.jobId, 'whitesmith');
  t.eq('職業等級上限 70', g.currentJob().jobLevelMax, 70);
  const have = new Set(g.currentJob().skills.map(s => s.id));
  const own = ['ws_weaponrefine', 'ws_cartboost', 'ws_cartterm', 'ws_meltdown', 'ws_overthrustmax'];
  t.ok('自己的 5 個技能到齊', own.every(id => have.has(id)));
  t.ok('三個空技能沒有被做進來',
    !g.SKILLS.ws_createcoin && !g.SKILLS.ws_createnugget && !g.SKILLS.ws_systemcreate);
  const bsIds = g.JOB_TREE.blacksmith.skills.map(s => s.id);
  t.ok('鐵匠的技能整份借過來', bsIds.every(id => have.has(id)),
    bsIds.filter(id => !have.has(id)).join(','));
  t.eq('借來的技能記在神匠的點數池', g.findSkillJob('overthrustbuff'), 'whitesmith');
}

/* ---------- 2. 進階二轉取代二轉（#60 的路線改動）---------- */
{
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'] });
  t.eq('沒轉生時二轉照舊是騎士', g.rebirthPathNext(), null);

  // 轉生 → 回到新手，鎖定路線應該是 新手 → 劍士 → **領主騎士**
  g.state.baseLevel = 99; g.state.jobLevel = 50; g.state.gold = 2000000;
  g.state.mapId = g.MAPS.filter(m => m.monsters && m.monsters.length === 0)[0].id;
  g.state.jobSkillPoints = { knight: 0 };
  t.ok('轉生成功', g.doRebirth());
  t.eq('鎖定路線是三格', (g.rebirthLine() || []).join('→'), 'novice→swordsman→lordknight');
  t.eq('新手的下一站是劍士', g.rebirthPathNext(), 'swordsman');
  t.ok('不能直接跳去領主騎士', !g.canJobChange('lordknight'));

  // 走到劍士（轉生後 baseLevel 歸 1，要先練回來才過得了門檻）
  g.state.baseLevel = 99; g.state.jobLevel = 10; g.state.jobSkillPoints.novice = 0;
  t.ok('轉職劍士', g.doJobChange('swordsman'));
  t.eq('劍士的下一站是領主騎士（不是騎士）', g.rebirthPathNext(), 'lordknight');
  t.ok('騎士被擋下來', !g.canJobChange('knight'));
  t.ok('擋下騎士時給得出理由', /領主騎士/.test(g.jobLockReason('knight') || ''));

  g.state.jobLevel = 50; g.state.baseLevel = 99; g.state.jobSkillPoints.swordsman = 0;
  t.ok('劍士可以直接轉領主騎士', g.canJobChange('lordknight'));
  t.ok('轉職領主騎士', g.doJobChange('lordknight'));
  t.eq('職業鏈沒有經過騎士', (g.state.jobLevelHistory.knight || 0), 0);
  t.ok('騎士的技能還是學得到', !!g.currentJob().skills.find(s => s.id === 'riding'));
}

/* ---------- 3. 武器精煉（成功率 +10%）---------- */
{
  const g = H.boot();
  H.mkChar(g, WS);
  t.eq('學之前沒有加成', g.state.refineBonusPct, 0);
  H.learn(g, 'ws_weaponrefine');
  t.eq('Lv10 給 +10%', g.state.refineBonusPct, 10);

  /* 真的去精煉，比對成功率。低段官方是 100%（一定成功），量不出加成，
     所以先找一個官方機率落在 10~85% 之間的起點再量。 */
  const w = H.wield(g, 'axe1') || H.wield(g, 'mace') || H.wield(g, 'sword');
  t.ok('拿得到武器', !!w);
  const slot = g.EQUIP_SLOTS_ALL.find(x => g.getEquipBaseItemId(x) === w);
  const wLv = g.getRefineWeaponLv(g.ITEMS[w]);
  let from = -1, base = 0;
  for (let lv = 0; lv < 10; lv++) {
    const r = g.getRefinementSuccessRate(lv, wLv, 'refine_stone');
    if (r >= 10 && r <= 85) { from = lv; base = r; break; }
  }
  t.ok('找得到可量測的精煉段', from >= 0, `起點 +${from} 官方 ${base}%`);

  /* `refineItem()` 成功或失敗都會呼叫 `recomputeDerived()`，那會把被動重算一遍——
     所以**不能靠直接改 state.refineBonusPct 來做對照組**（第一次精煉之後就被改回去了）。
     對照組要用一隻沒學這個技能的角色。 */
  const trial = (gg) => {
    const sl = gg.EQUIP_SLOTS_ALL.find(x => gg.getEquipBaseItemId(x) === w);
    let ok = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      gg.state.gold = 1e9;
      gg.addItem('refine_stone', 1);
      gg.state.instances[gg.getOrCreateEquipInstance(sl)].refine = from;
      if (gg.refineItem(sl, 'refine_stone')) ok++;
    }
    return ok / N * 100;
  };
  const g0 = H.boot();
  H.mkChar(g0, WS);
  H.wield(g0, 'axe1') || H.wield(g0, 'mace') || H.wield(g0, 'sword');
  t.eq('對照組沒學這個技能', g0.state.refineBonusPct, 0);
  t.near('沒學時＝官方機率', trial(g0), base, 3);
  t.near('學滿之後就是官方機率 +10', trial(g), base + 10, 3);
}

/* ---------- 4. 手推車加速（自己會續的生怪加速）---------- */
{
  const g = H.boot();
  H.mkChar(g, WS);
  H.learn(g, 'ws_cartboost');
  t.ok('登記成常駐被動', g.state.hasCartBoost);
  t.eq('生怪速度 ×1.2', g.state.cartBoostMult, 1.2);
  t.eq('持續 60 秒', g.state.cartBoostDurSec, 60);
  t.eq('冷卻 10 秒', g.state.cartBoostCdSec, 10);

  g.state.buffs = []; g.state.cartBoostReadyAt = 0;
  g.tickCartBoost();
  const b = g.state.buffs.find(x => x.type === 'spawnspeed');
  t.ok('自動掛上 buff', !!b);
  t.eq('buff 持續 60 秒', b && b.msRemaining, 60000);
  const n = g.state.buffs.length;
  g.tickCartBoost();
  t.eq('buff 還在時不重複掛', g.state.buffs.length, n);

  // buff 消失但冷卻還沒好 → 不補；冷卻好了 → 補上
  g.state.buffs = [];
  g.tickCartBoost();
  t.eq('10 秒冷卻內不補', g.state.buffs.length, 0);
  g.state.cartBoostReadyAt = 0;
  g.tickCartBoost();
  t.eq('冷卻好了就自己續上', g.state.buffs.length, 1);

  // 真的縮短生怪間隔（跟騎乘術相乘）
  t.near('生怪倍率 ×1.2', g.buffMult('spawnspeed').mult, 1.2, 0.001);
}

/* ---------- 5. 手推車終結技（固定倍率 + 鋅幣 + 暈眩）---------- */
{
  const g = H.boot();
  H.mkChar(g, WS);
  H.wield(g, 'axe1') || H.wield(g, 'mace');
  H.learn(g, 'ws_cartterm');
  const sk = g.SKILLS.ws_cartterm;
  t.eq('Lv10 是 ATK 1500%', sk.mult[9], 15);
  t.eq('Lv10 消耗 1500z', sk.zenyCost[9], 1500);
  t.eq('Lv10 暈眩 50%', sk.inflict.chance[9], 50);

  // 鋅幣真的扣
  g.state.gold = 100000;
  H.mon(g, { size: 'medium', isBoss: false });
  g.state.sp = g.state.maxSp; g.state.hit = 100000;
  g.state.cooldowns = {};
  const before = g.state.gold;
  g.castSkill('ws_cartterm', { forceLv: 10 });
  t.eq('扣了 1500 鋅幣', before - g.state.gold, 1500);

  // 負重量上升會加強它（跟金錢攻擊、手推車攻擊同一條）
  const dmgOf = (bonus) => {
    let sum = 0;
    for (let i = 0; i < 600; i++) {
      const m = H.mon(g, { size: 'medium', isBoss: false });
      g.state.cartDmgBonusMult = bonus;
      g.state.sp = g.state.maxSp; g.state.gold = 1e9; g.state.hit = 100000;
      const hp0 = m.hp;
      g.castSkill('ws_cartterm', { free: true, forceLv: 10 });
      sum += hp0 - m.hp;
    }
    return sum / 600;
  };
  const plain = dmgOf(0);
  const boosted = dmgOf(0.5);
  t.near('負重量上升 +50% 真的加得上去', boosted / plain, 1.5, 0.08);
  g.state.cartDmgBonusMult = 0;

  // 暈眩
  let stunned = 0;
  for (let i = 0; i < 800; i++) {
    const m = H.mon(g, { size: 'medium', isBoss: false, minHp: 1e7 });
    g.state.sp = g.state.maxSp; g.state.gold = 1e9; g.state.hit = 100000;
    g.castSkill('ws_cartterm', { free: true, forceLv: 10 });
    if (g.ailActive(m, 'stun') || m.stunEnd > Date.now()) stunned++;
  }
  t.near('Lv10 暈眩率 50%', stunned / 800 * 100, 50, 6);
}

/* ---------- 6. 野蠻凶砍（新開的 debuffAtk）---------- */
{
  const g = H.boot();
  H.mkChar(g, WS);
  H.wield(g, 'axe1') || H.wield(g, 'mace');
  H.learn(g, 'ws_meltdown');
  const sk = g.SKILLS.ws_meltdown;
  t.eq('Lv10 降物攻機率 10%', sk.atkBreakChance[9], 10);
  t.eq('Lv10 降物防機率 7%', sk.defBreakChance[9], 7);
  t.eq('Lv10 持續 60 秒', sk.duration[9], 60);

  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('ws_meltdown', { free: true, forceLv: 10 });
  const b = g.state.buffs.find(x => x.type === 'meltdown');
  t.ok('推出 meltdown buff', !!b);
  t.eq('buff 帶著兩個機率', b && b.atkChance + ',' + b.defChance, '10,7');

  // 機率抽樣
  const m = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m.defId];
  let atkHit = 0, defHit = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    delete m.debuffAtk; delete m.debuffAtkEnd;
    delete m.debuffDef; delete m.debuffDefEnd;
    g.tryMeltdown(m, md);
    if (m.debuffAtk) atkHit++;
    if (m.debuffDef) defHit++;
  }
  t.near('降物攻 10%', atkHit / N * 100, 10, 2);
  t.near('降物防 7%', defHit / N * 100, 7, 2);

  // debuffAtk 真的讓怪物打得比較痛快不起來
  delete m.debuffAtk; delete m.debuffAtkEnd;
  const full = g.monsterBaseAtk(md, 'mid', m);
  m.debuffAtk = 0.8; m.debuffAtkEnd = Date.now() + 10000;
  const weak = g.monsterBaseAtk(md, 'mid', m);
  t.near('怪物物攻 −20%', weak / full, 0.8, 0.01);
  // 過期就自己失效
  m.debuffAtkEnd = Date.now() - 1;
  t.near('過期後恢復', g.monsterBaseAtk(md, 'mid', m) / full, 1, 0.01);
  t.ok('過期後欄位被清掉', !m.debuffAtk);
}

/* ---------- 7. 凶砍最大值 ---------- */
{
  const g = H.boot();
  H.mkChar(g, WS);
  H.wield(g, 'axe1') || H.wield(g, 'mace');
  H.learn(g, 'ws_overthrustmax');
  const sk = g.SKILLS.ws_overthrustmax;
  t.eq('Lv5 是 ATK +100%', sk.mult[4], 2.0);
  t.eq('Lv5 消耗 5000z', sk.zenyCost[4], 5000);
  t.eq('持續 3 分鐘', sk.duration[4], 180);

  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.state.gold = 100000;
  const before = g.state.gold;
  g.castSkill('ws_overthrustmax', { forceLv: 5 });
  t.eq('扣了 5000 鋅幣', before - g.state.gold, 5000);
  const b = g.state.buffs.find(x => x.type === 'atk' && x.skillId === 'ws_overthrustmax');
  t.ok('推出 ATK buff', !!b);
  t.eq('倍率 ×2', b && b.mult, 2.0);
  t.eq('持續 180 秒', b && b.msRemaining, 180000);

  const md = g.MONSTERS[H.mon(g, { size: 'medium', isBoss: false }).defId];
  const withBuff = g.weaponChainDamage(md, 1, 'mid');
  g.state.buffs = [];
  const without = g.weaponChainDamage(md, 1, 'mid');
  t.near('整條鏈 ×2（ATK buff 普攻與技能都吃，#58）', withBuff / without, 2.0, 0.01);
}

/* ---------- 鍛造入口不能只認 blacksmith（#103）----------
   鍛造搬到分頁列上那顆「🔨 鍛造」之後，要不要顯示是 `isBlacksmithLine()` 說了算。
   舊版寫死 `state.jobId === 'blacksmith'`，轉成神匠之後 jobId 就變了，
   同一個角色會突然找不到鍛造入口。 */
{
  const g = H.boot();
  H.mkChar(g, WS);
  t.ok('神匠仍算鐵匠系', g.isBlacksmithLine('whitesmith'));
  t.ok('鐵匠本人當然算', g.isBlacksmithLine('blacksmith'));
  t.ok('商人不算（還沒轉鐵匠）', !g.isBlacksmithLine('merchant'));
  // 鍛造出來的武器前綴也是走同一支判斷，順手驗一下沒有掉回「鐵匠」
  g.state.unlockedCraftCategories = ['sword'];
  g.state.gold = 999999;
  ['iron', 'steel', 'gemstone_fire'].forEach(id => g.addItem(id, 50));
  const before = g.getItemQty('iron');
  g.craftWeapon('sword1h', 'fire');
  t.eq('神匠鍛得動武器（材料有扣）', before - g.getItemQty('iron'), 5);
}

process.exit(t.report('神匠 5 技能 + 進階二轉取代二轉'));
