/* 十字軍 11 個技能 + requiresEquip 裝備限定（#66）。

   跑法：node tools/test_crusader.js
*/
const H = require('./harness');

const t = H.tester();
const CR = { path: ['swordsman', 'crusader'] };

/* ---------- 1. 職業框架 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  t.eq('職業是十字軍', g.state.jobId, 'crusader');
  t.eq('tier 2', g.currentJob().tier, 2);
  t.eq('職等上限 50', g.currentJob().jobLevelMax, 50);
  t.eq('父職是劍士', g.currentJob().parent, 'swordsman');

  const have = new Set(g.currentJob().skills.map(s => s.id));
  const own = ['autoguard', 'cr_shieldcharge', 'cr_shieldboomerang', 'cr_defender',
    'cr_reflectshield', 'cr_trust', 'cr_holycross', 'grandcross',
    'cr_providence', 'cr_spearquicken', 'cr_shrink'];
  t.ok('自己的 11 個技能到齊', own.every(id => have.has(id)),
    own.filter(id => !have.has(id)).join(','));
  const borrowed = ['heal', 'divineprotection', 'angelic', 'holywater', 'spearmastery', 'riding', 'cavaliermastery'];
  t.ok('官方借用的 7 個也在', borrowed.every(id => have.has(id)),
    borrowed.filter(id => !have.has(id)).join(','));

  // 犧牲擱置（等隊友模式）；退縮改成轉職自動獲得的被動
  t.eq('犧牲沒有實作（之後開隊友模式再說）', !!g.SKILLS.cr_devotion, false);
  t.ok('退縮掛在職業上', have.has('cr_shrink'));

  // 劍士現在有兩條分支
  t.eq('劍士的 next 有兩條', g.JOB_TREE.swordsman.next.join(','), 'knight,crusader');
  t.ok('十字軍已從待辦清單移除',
    !(g.JOBS_TIER2_PENDING || []).some(j => j.id === 'crusader'));

  /* HP/SP 走**十字軍自己的**官方表，不是借騎士的 */
  t.eq('有自己的 HP 表', (g.JOB_BASE_HP.crusader || []).length, 100);
  t.eq('有自己的 SP 表', (g.JOB_BASE_SP.crusader || []).length, 100);
  t.eq('沒有 hpSpFrom（不借別人的表）', !!g.JOB_TREE.crusader.hpSpFrom, false);
  t.eq('HP99 = 6170（HpFactor 110 / HpIncrease 700）', g.JOB_BASE_HP.crusader[98], 6170);
  t.eq('SP99 = 475（SpIncrease 470）', g.JOB_BASE_SP.crusader[98], 475);
  // 攻速查得到表（官方鍵名帶 x_ 前綴，靠 aspdFrom 轉過去）
  t.eq('攻速表指向十字軍', g.aspdJobKey('crusader'), 'x_十字軍_聖殿十字軍');
  t.ok('攻速表真的存在', !!g.ASPD_WEAPON_BASE[g.aspdJobKey('crusader')]);
}

/* ---------- 2. requiresEquip：沒盾就放不出來 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  H.learn(g, 'cr_shieldcharge');
  H.mon(g, { size: 'medium', isBoss: false });

  g.state.equip.shield = null;
  g.recomputeDerived(true);
  t.eq('沒盾時 equipReqMet 是 false', g.equipReqMet('shield'), false);
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('沒盾時放不出盾擊', g.castSkill('cr_shieldcharge'), false);
  t.eq('放不出來就不該扣 SP', g.state.sp, g.state.maxSp);

  const sh = H.wear(g, 'shield');
  t.ok('穿得上盾牌', !!sh);
  t.eq('有盾時 equipReqMet 是 true', g.equipReqMet('shield'), true);
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('有盾就放得出來', g.castSkill('cr_shieldcharge'), true);
  t.ok('這次有扣 SP', g.state.sp < g.state.maxSp);

  // 沒寫限定的技能不受影響
  t.eq('沒寫 requiresEquip 一律通過', g.equipReqMet(null), true);
  t.eq('名稱查得到中文', g.equipReqName('shield'), '盾牌');
}

/* ---------- 3. 光之盾：機率完全免傷（CD 5 秒）+ 常駐攻速懲罰，都要有盾 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  const sk = g.SKILLS.cr_defender;
  t.eq('Lv1 免傷機率 10%', sk.mult[0], 10);
  t.eq('Lv5 免傷機率 40%', sk.mult[4], 40);
  t.eq('內部冷卻 5 秒', sk.internalCooldown[0], 5);
  t.eq('Lv1 攻速 −20%', sk.aspdPenalty[0], 20);
  t.eq('Lv5 攻速 −0%（等級越高懲罰越小）', sk.aspdPenalty[4], 0);
  t.eq('是被動', sk.type, 'passive');

  // 沒盾 → 兩個效果都不生效
  g.state.equip.shield = null;
  H.learn(g, 'cr_defender', 5);
  g.recomputeDerived(true);
  t.eq('沒盾時免傷機率 0', g.state.defenderProcPct, 0);
  t.eq('沒盾時沒有攻速懲罰', g.state.defenderAspdPct, 0);
  const aspdNoShield = g.state.aspd;
  g.state.defenderReadyAt = 0;
  t.eq('沒盾時不會觸發', g.defenderNegates(), false);

  // 有盾 → 生效
  H.wear(g, 'shield');
  g.recomputeDerived(true);
  t.eq('有盾時免傷機率 40%', g.state.defenderProcPct, 40);
  t.eq('Lv5 沒有攻速懲罰', g.state.defenderAspdPct, 0);
  /* **免傷不進 playerDmgTakenMult()** —— 那支是純函式（換裝預覽也會呼叫），
     有副作用的冷卻不能塞進去；而且這是「免掉一整下」不是打折，本來就不是倍率。 */
  t.eq('playerDmgTakenMult 不含光之盾', g.playerDmgTakenMult(), 1);

  // 機率：把冷卻清掉逐次擲，實測應該貼近 40%
  const hit = H.rate(20000, () => g.defenderNegates(), () => { g.state.defenderReadyAt = 0; });
  t.near('實測免傷率 ≈40%', hit / 20000 * 100, 40, 2);

  // 冷卻：成功之後 5 秒內不再觸發
  g.state.defenderReadyAt = 0;
  let fired = 0;
  for (let i = 0; i < 200 && fired === 0; i++) if (g.defenderNegates()) fired++;
  t.eq('先讓它成功一次', fired, 1);
  t.ok('冷卻時間戳推到 5 秒後',
    g.state.defenderReadyAt - Date.now() > 4000 && g.state.defenderReadyAt - Date.now() <= 5000);
  t.eq('冷卻中不再觸發', H.rate(200, () => g.defenderNegates()), 0);

  /* 冷卻**只在成功時**才進——失敗也進的話 Lv1（10%）實際免傷率會掉到 2% 上下，
     跟技能說明對不上。用 Lv1 驗：連擲 50 次一定會有超過 1 次成功。 */
  const gLow = H.boot();
  H.mkChar(gLow, CR);
  H.wear(gLow, 'shield');
  H.learn(gLow, 'cr_defender', 1);
  gLow.recomputeDerived(true);
  const lowHit = H.rate(20000, () => gLow.defenderNegates(), () => { gLow.state.defenderReadyAt = 0; });
  t.near('Lv1 實測免傷率 ≈10%', lowHit / 20000 * 100, 10, 1.5);

  // Lv1 才看得出攻速懲罰
  const g2 = H.boot();
  H.mkChar(g2, CR);
  H.wear(g2, 'shield');
  const aspdBefore = (g2.recomputeDerived(true), g2.state.aspd);
  H.learn(g2, 'cr_defender', 1);
  g2.recomputeDerived(true);
  const aspdPenalized = g2.state.aspd;
  t.eq('Lv1 攻速懲罰 20', g2.state.defenderAspdPct, 20);
  t.ok('攻速真的變慢', aspdPenalized < aspdBefore, `${aspdBefore} → ${aspdPenalized}`);
  /* 盾牌拿掉就整包還原（跟雙劍挌擋同一種行為）。
     攻速不能直接比「有盾時的值」——盾牌自己就有 −5 的攻速懲罰，
     脫盾後那份也一起沒了，所以只驗「懲罰欄位歸零且攻速回升」。 */
  g2.state.equip.shield = null;
  g2.recomputeDerived(true);
  t.eq('脫盾後免傷機率歸零', g2.state.defenderProcPct, 0);
  t.eq('脫盾後攻速懲罰歸零', g2.state.defenderAspdPct, 0);
  g2.state.defenderReadyAt = 0;
  t.eq('脫盾後不再觸發', g2.defenderNegates(), false);
  t.ok('脫盾後攻速回升', g2.state.aspd > aspdPenalized, `${aspdPenalized} → ${g2.state.aspd}`);
  t.ok('（對照）沒盾也沒技能時的攻速', aspdNoShield > 0);
}

/* ---------- 3b. 退縮：轉職自動獲得，自動防禦擋下時暈眩 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  const sk = g.SKILLS.cr_shrink;
  t.eq('是被動', sk.type, 'passive');
  t.eq('轉職自動獲得', sk.autoGrant, true);
  t.eq('50% 機率', sk.mult[0], 50);
  t.eq('暈眩 1 秒', sk.stunSec[0], 1);
  t.eq('沒花技能點就已經學會', g.state.learnedSkills.cr_shrink, 1);
  t.eq('數值有進 state', g.state.shrinkStunChance, 50);

  /* 官方寫的是「以**自動防禦**成功防禦時」——雙劍挌擋擋下的那次不算，
     所以 playerBlocked() 要分得出來源。 */
  const m = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m.defId];
  g.tryShrinkStun(m, md, 'parrying');
  t.ok('雙劍挌擋擋下不觸發退縮', !(m.stunnedUntil > Date.now()));

  const stunned = H.rate(2000, (i) => {
    const mm = { defId: m.defId, hp: 999, maxHp: 999, id: 90000 + i };
    g.tryShrinkStun(mm, md, 'autoguard');
    return mm.stunnedUntil > Date.now();
  });
  t.near('自動防禦擋下時 ≈50% 觸發', stunned / 2000 * 100, 50, 4);

  // playerBlocked() 回傳的是來源字串（呼叫端只做真假判斷，行為不變）
  g.state.buffs = [{ type: 'block', mult: 1, flatBonus: 100, msRemaining: 9e5 }];
  t.eq('自動防禦擋下回傳 autoguard', g.playerBlocked(), 'autoguard');
  g.state.buffs = [];
  g.state.parryingChance = 100;
  t.eq('雙劍挌擋擋下回傳 parrying', g.playerBlocked(), 'parrying');
  g.state.parryingChance = 0;
  t.eq('都沒中回傳 null', g.playerBlocked(), null);
}

/* ---------- 4. 信任：最大HP 固定值 + 聖屬性耐性 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  g.recomputeDerived(true);
  const hp0 = g.state.maxHp;
  const holy0 = (g.state.cardEleDmgReduce || {}).holy || 0;
  H.learn(g, 'cr_trust', 10);
  g.recomputeDerived(true);
  t.ok('最大HP 至少 +2000', g.state.maxHp - hp0 >= 2000, `+${g.state.maxHp - hp0}`);
  t.near('聖屬性減傷 +50%', ((g.state.cardEleDmgReduce || {}).holy || 0) - holy0, 0.5, 0.001);
  t.eq('其他屬性沒被波及', (g.state.cardEleDmgReduce || {}).fire || 0, 0);

  // Lv5 是一半
  const g2 = H.boot(); H.mkChar(g2, CR);
  const hpA = (g2.recomputeDerived(true), g2.state.maxHp);
  H.learn(g2, 'cr_trust', 5);
  g2.recomputeDerived(true);
  t.ok('Lv5 最大HP 至少 +1000', g2.state.maxHp - hpA >= 1000, `+${g2.state.maxHp - hpA}`);
  t.near('Lv5 聖屬性減傷 25%', (g2.state.cardEleDmgReduce || {}).holy || 0, 0.25, 0.001);
}

/* ---------- 5. 神祐之光：聖屬性 + 惡魔種族減傷（buff） ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  g.state.buffs = []; g.recomputeDerived(true);
  t.eq('施放前沒有惡魔減傷', (g.state.cardRaceDmgReduce || {}).demon || 0, 0);

  H.learn(g, 'cr_providence', 5);
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('放得出來', g.castSkill('cr_providence', { free: true, forceLv: 5 }), true);
  t.near('聖屬性減傷 25%', (g.state.cardEleDmgReduce || {}).holy || 0, 0.25, 0.001);
  t.near('惡魔種族減傷 25%', (g.state.cardRaceDmgReduce || {}).demon || 0, 0.25, 0.001);
  t.eq('其他種族沒被波及', (g.state.cardRaceDmgReduce || {}).undead || 0, 0);

  g.state.buffs = []; g.recomputeDerived(true);
  t.eq('buff 結束後聖屬性歸零', (g.state.cardEleDmgReduce || {}).holy || 0, 0);
  t.eq('buff 結束後惡魔歸零', (g.state.cardRaceDmgReduce || {}).demon || 0, 0);

  // 跟信任疊起來：兩份聖屬性減傷相加
  H.learn(g, 'cr_trust', 10);
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('cr_providence', { free: true, forceLv: 5 });
  t.near('信任 50% + 神祐 25% = 75%', (g.state.cardEleDmgReduce || {}).holy || 0, 0.75, 0.001);
}

/* ---------- 6. 反射盾：跟卡片的反射相加 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  H.wear(g, 'shield');
  H.learn(g, 'cr_reflectshield', 10);
  const sk = g.SKILLS.cr_reflectshield;
  t.eq('Lv10 反射 40%', sk.reflectPct[9], 40);

  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('cr_reflectshield', { free: true, forceLv: 10 });
  const rb = g.state.buffs.find(b => b.type === 'reflect');
  t.ok('推出了 reflect buff', !!rb);
  t.eq('比率記在 flatBonus', rb && rb.flatBonus, 40);

  // 真的會彈傷害回去
  const m = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m.defId];
  const hp0 = m.hp;
  g.applyPlayerReflect(m, md, 1000);
  t.eq('1000 傷害彈回 400', hp0 - m.hp, 400);

  g.state.buffs = [];
  const m2 = H.mon(g, { size: 'medium', isBoss: false });
  const before2 = m2.hp;
  g.applyPlayerReflect(m2, g.MONSTERS[m2.defId], 1000);
  t.eq('buff 結束後不再反射', m2.hp, before2);
}

/* ---------- 7. 長矛加速術：攻速 + 暴擊 + 迴避，要拿矛 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  H.learn(g, 'cr_spearquicken', 10);
  H.mon(g, { size: 'medium', isBoss: false });

  // 拿劍 → 放不出來
  H.wield(g, 'sword1');
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('拿劍放不出長矛加速術', g.castSkill('cr_spearquicken'), false);

  // 拿矛 → 放得出來
  const spear = H.wield(g, 'spear1');
  t.ok('拿得到單手矛', !!spear);
  g.state.buffs = []; g.recomputeDerived(true);
  const aspd0 = g.state.aspd, crit0 = g.state.critRate, flee0 = g.effectiveFleeWithBuff();
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('拿矛放得出來', g.castSkill('cr_spearquicken'), true);
  g.recomputeDerived(false);
  t.ok('攻速上升', g.state.aspd > aspd0, `${aspd0} → ${g.state.aspd}`);
  const cb = g.buffMult('crit');
  t.eq('暴擊 +30（buff 的 flatBonus）', cb.flatBonus, 30);
  t.eq('迴避 +20', g.effectiveFleeWithBuff() - flee0, 20);
  t.eq('推了三個 buff', g.state.buffs.filter(b => b.skillId === 'cr_spearquicken').length, 3);
}

/* ---------- 8. 聖十字攻擊：聖屬性 + 雙手矛加倍 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  const sk = g.SKILLS.cr_holycross;
  t.eq('是聖屬性', sk.element, 'holy');
  t.eq('雙手矛倍率 2', sk.twoHandSpearMult, 2);
  t.eq('Lv10 ATK 450%', sk.mult[9], 4.5);
  t.eq('Lv10 黑暗 30%', sk.inflict.chance[9], 30);

  /* 雙手矛加倍：倍率乘在 castSkill 的 `mult` 上，所以只能走完整施放來驗。
     怪物血量拉高避免被打死，命中拉滿避免 miss，同一隻怪連打 N 次比總傷害。 */
  H.learn(g, 'cr_holycross', 10);
  const hitOnce = (cat) => {
    const gg = H.boot();
    H.mkChar(gg, CR);
    H.learn(gg, 'cr_holycross', 10);
    gg.state.hit = 100000;
    H.wield(gg, cat);
    gg.recomputeDerived(true);
    const m = H.mon(gg, { size: 'medium', isBoss: false });
    t.ok('武器分類正確：' + cat, gg.aspdCategoryOf(gg.getEquipBaseItemId('weapon')) === cat);
    m.maxHp = m.hp = 5e9;
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const before = m.hp;
      gg.state.sp = gg.state.maxSp; gg.state.cooldowns = {};
      gg.castSkill('cr_holycross', { free: true, forceLv: 10 });
      total += before - m.hp;
    }
    return total;
  };
  const one = hitOnce('spear1');
  const two = hitOnce('spear2');
  t.ok('兩種矛都打得出傷害', one > 0 && two > 0);
  /* 不是剛好 2.00：雙手矛與單手矛的武器 ATK、等級、體型修正都不同，
     只驗「明顯超過單純換武器該有的差距」——1.5 倍已經遠高於同級矛之間的落差。 */
  t.ok('雙手矛傷害明顯更高（含 ×2 加成）', two / one > 1.5, `倍數 ${(two / one).toFixed(2)}`);
}

/* ---------- 9. 迴旋盾擊：吃盾牌重量與精煉 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  const sk = g.SKILLS.cr_shieldboomerang;
  t.eq('重量係數 1.0', sk.shieldWeightMult, 1.0);
  t.eq('精煉係數 4', sk.shieldRefineMult, 4);

  const md = g.MONSTERS[H.mon(g, { size: 'medium', isBoss: false }).defId];
  H.wield(g, 'sword1');
  const sh = H.wear(g, 'shield');
  g.recomputeDerived(true);

  // 沒有這兩個欄位的技能當基準
  const plain = g.weaponChainDamage(md, 1, 'mid', null);
  const withShield = g.weaponChainDamage(md, 1, 'mid', sk);
  t.ok('盾牌加成讓傷害變高', withShield > plain, `${Math.round(plain)} → ${Math.round(withShield)}`);

  // 精煉上去之後還要再更高
  const before = g.weaponChainDamage(md, 1, 'mid', sk);
  H.refine(g, sh.slot, 10);
  const after = g.weaponChainDamage(md, 1, 'mid', sk);
  t.ok('精煉 +10 再加傷', after > before, `${Math.round(before)} → ${Math.round(after)}`);

  // 沒穿盾時不加（技能本身放不出來，但公式也不該憑空加東西）
  g.state.equip.shield = null;
  g.recomputeDerived(true);
  t.near('脫盾後回到基準', g.weaponChainDamage(md, 1, 'mid', sk),
    g.weaponChainDamage(md, 1, 'mid', null), 0.001);
}

/* ---------- 10. 自動防禦：官方 5~30%，要盾 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  const sk = g.SKILLS.autoguard;
  t.eq('Lv1 機率 5%', sk.blockChance[0], 5);
  t.eq('Lv10 機率 30%（官方值，不是舊的 50）', sk.blockChance[9], 30);
  t.eq('要裝盾', sk.requiresEquip, 'shield');

  H.wear(g, 'shield');
  H.learn(g, 'autoguard', 10);
  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('autoguard', { free: true, forceLv: 10 });
  t.eq('block buff 的比率是 30', g.buffMult('block').flatBonus, 30);
  const blocked = H.rate(4000, () => g.playerBlocked()) / 4000 * 100;
  t.near('實測擋下率 ≈30%', blocked, 30, 3);
}

/* ---------- 11. 聖十字審判：%HP 消耗、自傷、低血量保險 ---------- */
{
  const g = H.boot();
  H.mkChar(g, CR);
  const sk = g.SKILLS.grandcross;
  t.eq('消耗當前HP 20%', sk.hpCostPct, 20);
  t.eq('自傷一半', sk.selfDamagePct, 50);
  t.eq('低於 25% HP 不放', sk.minHpPctToCast, 25);
  t.eq('是聖屬性', sk.element, 'holy');
  t.eq('Lv10 合計 1500%（官方 500% × 3 次）', sk.mult[9], 15);

  H.learn(g, 'grandcross', 10);
  H.mon(g, { size: 'medium', isBoss: false });

  // HP 滿 → 扣 20%
  g.state.hp = g.state.maxHp;
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  const hpBefore = g.state.hp;
  t.eq('滿血放得出來', g.castSkill('grandcross'), true);
  const paid = hpBefore - g.state.hp;
  t.ok('至少扣掉 20% HP（另外還有自傷）', paid >= Math.floor(hpBefore * 0.2),
    `扣了 ${paid} / 20% 是 ${Math.floor(hpBefore * 0.2)}`);

  // HP 低於 25% → 放不出來
  g.state.hp = Math.floor(g.state.maxHp * 0.2);
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  const lowHp = g.state.hp;
  t.eq('HP 20% 時放不出來', g.castSkill('grandcross'), false);
  t.eq('放不出來就不該扣血', g.state.hp, lowHp);
  t.eq('也不該扣 SP', g.state.sp, g.state.maxSp);

  /* 自傷永遠留 1 HP：把 HP 壓到剛好過門檻，連放到不能再放，
     不管打多痛都不該死。 */
  const g2 = H.boot();
  H.mkChar(g2, CR);
  H.learn(g2, 'grandcross', 10);
  for (let i = 0; i < 60; i++) {
    H.mon(g2, { size: 'medium', isBoss: false });
    g2.state.sp = g2.state.maxSp; g2.state.cooldowns = {};
    g2.castSkill('grandcross', { free: true, forceLv: 10 });
    if (g2.state.hp <= 0) break;
  }
  t.ok('連放之後 HP 仍大於 0', g2.state.hp > 0, 'HP=' + g2.state.hp);
}

process.exit(t.report('十字軍 11 技能 + requiresEquip'));
