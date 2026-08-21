/* #92 HP/SP 改回官方公式。

   舊的算法是 `官方表[lv] × (1+屬性%) × job.hpMod`，而 JOB_BASE_HP/SP **本身就已經分職業**
   （法師 Lv100 是 2050、騎士是 8128），係數等於把職業差異算了第二遍。
   實測 Lv99 巫師 INT106：官方 SP 1856，spMod 9.0 讓它變成 16704，
   而技能的 SP 消耗是官方值（火球術 25、雷爆術 29+5/級），SP 因此形同無限。

   這支盯的是「係數不會再長回來」。逐條抄公式沒有意義，所以驗的是關係：
   同表的職業要同血、轉生只差固定 1.25、屬性以外沒有第三個乘數。

     node tools/test_hpsp.js  */
const H = require('./harness');
const t = H.tester();

/* 直接換 state.jobId 就好——這支只看 recomputeDerived 的 HP/SP 那一段，
   不需要真的把 34 個職業各轉一次（轉職路徑跟這條公式無關）。

   `vit`/`int` 給的是**生效值**，不是面板點數：職業加成每個職業都不一樣
   （computeJobBonuses 會跟著 jobId 變），照面板點數比兩個職業會比到加成差。
   所以先設一次 jobId 把加成問出來，再倒推該點幾點。 */
function asJob(g, jobId, o) {
  o = o || {};
  const s = g.state;
  s.jobId = jobId;
  s.baseLevel = o.bl || 99;
  s.rebirthCount = o.rebirth ? 1 : 0;
  s.stats = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
  const jb = g.computeJobBonuses();
  s.stats.vit = (o.vit == null ? 50 : o.vit) - jb.vit;
  s.stats.int = (o.int == null ? 50 : o.int) - jb.int;
  g.recomputeDerived(true);
  return { hp: s.maxHp, sp: s.maxSp };
}

const g = H.boot();
H.mkChar(g, { path: ['mage', 'wizard'] });

// ---- 1. 沒有第三個乘數 ----------------------------------------------------
{
  /* 三個等級各量一次：hpMod 是常數乘數，只驗一級的話「表被整條改掉」跟
     「係數還在」分不出來。 */
  [45, 70, 99].forEach(bl => {
    const r = asJob(g, 'wizard', { bl, vit: 6, int: 106 });
    t.eq(`Lv${bl} 巫師 HP = 官方表 ×(1+VIT%)`,
      r.hp, Math.floor(g.JOB_BASE_HP.wizard[bl - 1] * 1.06));
    t.eq(`Lv${bl} 巫師 SP = 官方表 ×(1+INT%)`,
      r.sp, Math.floor(g.JOB_BASE_SP.wizard[bl - 1] * 2.06));
  });
}

// 使用者回報的那一隻：Lv99 巫師、VIT6／INT106、已轉生
{
  const r = asJob(g, 'wizard', { rebirth: true, vit: 6, int: 106 });
  t.eq('回報案例 HP（舊值 1894）', r.hp, 4303);
  t.eq('回報案例 SP（舊值 16704）', r.sp, 2320);
}

// ---- 2. 轉生就是固定 1.25，跟走到哪一站無關 --------------------------------
{
  const before = asJob(g, 'wizard', { int: 80 });
  const after = asJob(g, 'wizard', { rebirth: true, int: 80 });
  t.eq('轉生 HP ×1.25（先乘屬性再乘，各自取整）', after.hp, Math.floor(before.hp * 1.25));
  t.eq('轉生 SP ×1.25', after.sp, Math.floor(before.sp * 1.25));
  t.eq('倍率常數就是 1.25', g.TRANSCENDENT_HPSP_MULT, 1.25);
}
{
  /* 25% 改掛在「轉生過」上，不再是職業資料上的係數。進階二轉本身就是轉生職，
     所以 tier>=3 也算——GM 鈕做得出 rebirthCount 0 的領主騎士，那種存檔不該掉血。 */
  const kn = asJob(g, 'knight', { int: 40 });
  const knR = asJob(g, 'knight', { int: 40, rebirth: true });
  const lk = asJob(g, 'lordknight', { int: 40 });
  t.eq('領主騎士沿用騎士的表，加成剛好是轉生那 25%', lk.hp, knR.hp);
  t.eq('領主騎士 SP 同理', lk.sp, knR.sp);
  t.ok('沒轉生的騎士拿不到那 25%', kn.hp < lk.hp);
  t.eq('轉生後的騎士（高等劍士那段）也吃得到', knR.hp, Math.floor(kn.hp * 1.25));
}

// ---- 3. 官方參數相同的職業，數值必須相同 ------------------------------------
{
  const st = {};
  // 鐵匠與鍊金術士的 HpFactor/HpIncrease/SpIncrease 完全一樣（90/500/400）
  t.eq('鐵匠與鍊金術士同 HP', asJob(g, 'alchemist', st).hp, asJob(g, 'blacksmith', st).hp);
  t.eq('鐵匠與鍊金術士同 SP', asJob(g, 'alchemist', st).sp, asJob(g, 'blacksmith', st).sp);
  // 神匠 hpSpFrom 指回鐵匠，差的只有轉生那 25%
  t.eq('神匠沿用鐵匠的表', asJob(g, 'whitesmith', st).hp,
    Math.floor(asJob(g, 'blacksmith', st).hp * 1.25));
  // 盜賊與弓箭手（50/500/200）
  t.eq('盜賊與弓箭手同 HP', asJob(g, 'thief', st).hp, asJob(g, 'archer', st).hp);
}

// ---- 4. 職業間的高低要跟官方參數同向 ---------------------------------------
{
  const st = {};
  const hp = j => asJob(g, j, st).hp;
  const sp = j => asJob(g, j, st).sp;
  // 以前 hpMod 把法系壓到 0.3、坦系拉到 1.5，順序整個被翻過
  t.ok('騎士 HP > 劍士 > 法師', hp('knight') > hp('swordsman') && hp('swordsman') > hp('mage'));
  t.ok('巫師 HP 高於法師（HpFactor 55 > 30）', hp('wizard') > hp('mage'));
  t.ok('賢者 HP 高於巫師（HpFactor 75 > 55）', hp('sage') > hp('wizard'));
  t.ok('巫師 SP 高於賢者（SpIncrease 900 > 700）', sp('wizard') > sp('sage'));
  t.ok('祭司 SP 高於騎士', sp('priest') > sp('knight'));
}

// ---- 5. 超級新手不再退回新手的表 -------------------------------------------
{
  const st = {};
  const sn = asJob(g, 'supernovice', st);
  t.ok('超級新手有自己的 HP 表（不等於新手）', sn.hp !== asJob(g, 'novice', st).hp);
  t.ok('超級新手有自己的 SP 表（不等於新手）', sn.sp !== asJob(g, 'novice', st).sp);
  /* HpFactor 70 與劍士相同、SpIncrease 600 與法師相同。劍士那張是既有資料，
     Lv45 起每級差 1（見 hp_sp_tables.js 檔頭），所以只驗到 1% 內。 */
  const sw = asJob(g, 'swordsman', st);
  t.ok('超級新手 HP 與劍士同級（差 < 1%）', Math.abs(sn.hp - sw.hp) / sw.hp < 0.01);
  t.eq('超級新手 SP 與法師相同', sn.sp, asJob(g, 'mage', st).sp);
}

// ---- 6. 係數欄位不能再出現 -------------------------------------------------
{
  const bad = Object.values(g.JOB_TREE).filter(j => j.hpMod != null || j.spMod != null);
  t.eq('JOB_TREE 沒有任何 hpMod/spMod', bad.map(j => j.id).join(','), '');
  t.ok('atkMod/matkMod 保留著（那兩個本來就是本作自訂的）',
    g.JOB_TREE.wizard.matkMod > 0 && g.JOB_TREE.knight.atkMod > 0);
}

// ---- 7. SP 池與官方技能消耗對得上 ------------------------------------------
{
  /* 這條是這次改動的動機。以前 Lv99 巫師 16704 SP，暴風雪 42 SP 一發可以放 398 次，
     SP 完全不是資源。抓一個寬鬆但抓得住 9 倍係數的上限。 */
  const sp = asJob(g, 'wizard', { int: 106 }).sp;
  const cost = g.SKILLS.stormgust.spCost[9];
  t.ok(`Lv99 巫師連續暴風雪不到 100 發（實測 ${Math.floor(sp / cost)}）`, sp / cost < 100);
}

// ---- 8. 自然回復：禪心確實有用，而且畫面讀得到（#102）----------------------
{
  /* 使用者 2026-08-16：「法師 禪心點了 沒有加sp」。禪心加的是**回復速度**不是 SP 上限，
     官方就是這樣——但角色分頁以前一格都沒印回復速度，點下去等於什麼都沒發生。
     這裡驗兩件事：加成真的進得了每秒回復量，而且顯示與實際讀同一支。 */
  const mk = lv => {
    const gg = H.boot();
    H.mkChar(gg, { path: ['mage'], job: 'mage', baseLevel: 99 });
    gg.state.jobLevel = 50; gg.state.jobSkillPoints.mage = 100;
    for (let i = 0; i < lv; i++) gg.levelUpSkill('spregen');
    gg.recomputeDerived(true);
    gg.changeMap(gg.MAPS.find(m => (m.monsters || []).length > 0).id);
    return gg;
  };
  const a = mk(0), b = mk(10);
  t.eq('禪心不動 SP 上限（官方就是這樣）', a.state.maxSp, b.state.maxSp);
  t.ok('禪心 Lv10 的每秒 SP 回復至少多 3 倍',
    b.regenPerSecond().sp >= a.regenPerSecond().sp * 3,
    `${a.regenPerSecond().sp} → ${b.regenPerSecond().sp}`);
  // 顯示用的數字必須等於實際回的量，不能各算各的
  b.state.sp = 0;
  const rate = b.regenPerSecond().sp;
  b.passiveRegen();
  t.eq('顯示的每秒回復量＝實際回的量', b.state.sp, rate);

  /* 官方那張表的「+15 +1.0%」是**每次恢復的量**，不是 SP 上限（#103）。
     使用者實測「830 SP 點到 5 級沒有增加 SP」——確認百分比那半真的有進到回復量裡，
     不然「加了但看不到」跟「根本沒加」在畫面上長得一模一樣。 */
  const c = mk(5);
  c.state.maxSp = 830;
  t.eq('Lv5 的平坦加成 +15', c.state.zenSpFlatBonus, 15);
  t.eq('Lv5 的百分比加成 1%', c.state.zenSpPctBonus, 1);
  const withPct = c.regenPerSecond().sp;
  c.state.zenSpPctBonus = 0;
  t.ok('把百分比那半拿掉，每秒回復量會變少（代表它真的有算進去）',
    c.regenPerSecond().sp < withPct, `${c.regenPerSecond().sp} → ${withPct}`);
}

// ---- 9. 自然回復的乘法加成不能累積（#107）--------------------------------
{
  /* `hpRegenMult` / `spRegenMult` 兩個都是 `= (舊值 || 1) * val` 寫法，
     但 recomputeDerived() 開頭從來沒有把它們歸零——每跑一次就再乘一次。
     升級、換裝、插卡、buff 到期全都會跑 recomputeDerived，所以是指數成長：
     使用者截圖上是「9.30830300964712e+220 HP／秒」。跟更早那次 DEX 膨脹同一種病。 */
  const gg = H.boot();
  H.mkChar(gg, { path: ['swordsman'], job: 'swordsman', baseLevel: 99 });
  gg.state.jobSkillPoints.swordsman = 100;
  for (let i = 0; i < 10; i++) gg.levelUpSkill('increasehp');   // 快速恢復 Lv10 = ×2
  const mult0 = gg.state.hpRegenMult, hp0 = gg.regenPerSecond().hp;
  t.eq('快速恢復 Lv10 就是 ×2，不多不少', mult0, 2);
  for (let i = 0; i < 200; i++) gg.recomputeDerived(false);
  t.eq('重算 200 次之後倍率不變', gg.state.hpRegenMult, mult0);
  t.eq('每秒回復量也不變', gg.regenPerSecond().hp, hp0);
  t.ok('數字還是個正常的整數', Number.isFinite(hp0) && hp0 < 1000, '實際 ' + hp0);
  t.eq('SP 那邊同一條規則', gg.state.spRegenMult, 1);
}

// ---- 10. 迴避上限隨場上怪數遞減（#107）-----------------------------------
{
  const gg = H.boot();
  H.mkChar(gg, { path: ['thief', 'assassin'], job: 'assassin', baseLevel: 99 });
  gg.changeMap(gg.MAPS.find(m => (m.monsters || []).length > 0).id);
  const md = gg.MONSTERS[Object.keys(gg.MONSTERS)[0]];
  const setField = n => { gg.state.monsters = Array.from({ length: n }, (_, i) => ({ id: i, defId: md.id, hp: 1, maxHp: 1 })); };
  const expect = { 1: 95, 2: 90, 3: 85, 4: 80, 5: 75 };
  Object.keys(expect).forEach(n => {
    setField(Number(n));
    t.eq(`${n} 隻怪的迴避上限`, gg.fleeCapPct(), expect[n]);
    t.eq(`${n} 隻怪時 FLEE 爆表也只到上限`, gg.dodgeChancePctFromMonster(99999, md, 0), expect[n]);
  });
  /* 夾的是**上限**不是公式基準：FLEE 沒堆到頂的角色完全不受影響。
     這條是這次改動的重點，寫錯的話（把基準也改掉）全體迴避率會一起被砍。 */
  const mid = (md.fleeReq || gg.monsterHitOf(md)) - 35;
  setField(1);
  const one = gg.dodgeChancePctFromMonster(mid, md, 0);
  setField(5);
  t.eq('FLEE 不夠的角色不受怪數影響', gg.dodgeChancePctFromMonster(mid, md, 0), one);
  t.ok('而且那個數字本來就在上限以下', one < 75, '實際 ' + one);
  // 下限還是 5%：再多怪也不會變成必中
  setField(30);
  t.ok('迴避上限不會掉到 5% 以下', gg.fleeCapPct() >= 5, '實際 ' + gg.fleeCapPct());
}

process.exit(t.report('HP/SP 官方公式'));
