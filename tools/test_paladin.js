/* 聖殿十字軍（#74）+ 六條分支線的轉生斷層。

   這支要證的四件事：
     1. **轉生斷層補起來了**——七個分支線的進階二轉都進了 JOB_TREE，
        六條分支線轉生之後都接得到，而且 rebirthLine() 真的把二轉換成進階二轉
     2. 捨命攻擊「付不起就不觸發、次數留著」——這是發勁那個坑的第三次，
        要證明它**不會把玩家打到死**
     3. 聖音是 10 秒一跳的場域，維持費照跳數收，兩張效果表都真的有人讀
     4. 連續盾擊吃得到盾牌重量與精煉，神之威壓走的是 MATK 不是 ATK

   跑法：node tools/test_paladin.js（或由 tools/test.js 一起跑）
*/
const H = require('./harness');
const t = H.tester();

const PA = { path: ['swordsman', 'crusader'], rebirth: true, job: 'paladin' };
/* mkChar 只給**目前職業**技能點，路線上的舊職業一律歸零。
   聖殿十字軍的前置橫跨三個職業（霸體是劍士的、信任與迴旋盾擊是十字軍的），
   所以這裡把整條線的點數池都補滿——玩家實際上是一路練上來的，本來就有。 */
const mk = (opts) => {
  const g = H.boot(Object.assign({ captureLog: true }, opts || {}));
  H.mkChar(g, PA);
  g.state.gold = 100000000;
  ['swordsman', 'crusader', 'paladin'].forEach(j => { g.state.jobSkillPoints[j] = 200; });
  return g;
};

/* ---------------- 1. 職業框架 ---------------- */
{
  const g = H.boot();
  H.mkChar(g, PA);
  const j = g.JOB_TREE.paladin;
  t.eq('職業是聖殿十字軍', g.state.jobId, 'paladin');
  t.eq('父職業是十字軍', j.parent, 'crusader');
  t.eq('職業等級上限 70', j.jobLevelMax, 70);
  t.eq('進階二轉待辦清單清空', g.JOBS_TRANS_PENDING.length, 0);

  const have = new Set(g.currentJob().skills.map(s => s.id));
  ['pa_shieldchain', 'pa_pressure', 'pa_sacrifice', 'pa_gospel'].forEach(id => {
    t.ok(`${id} 有定義`, !!g.SKILLS[id]);
    t.ok(`${id} 在技能表裡`, have.has(id));
  });
  const crIds = g.JOB_TREE.crusader.skills.map(s => s.id);
  t.ok('十字軍的技能整份借過來', crIds.every(id => have.has(id)),
    crIds.filter(id => !have.has(id)).join(','));

  /* hpSpFrom 指回十字軍：官方 HpFactor/HpIncrease/SpIncrease 三個數字完全相同，
     所以不複製 100 格陣列。hp_sp_tables.js 裡本來就沒有 paladin 這個 key。 */
  t.eq('HP/SP 表指回十字軍', j.hpSpFrom, 'crusader');
  t.ok('沒有多複製一份 HP 表', !g.JOB_BASE_HP.paladin);
  const bonusCount = Object.values(j.bonusLevels).reduce((a, b) => a + b.length, 0);
  t.eq('職業加成 45 點（官方 Paladin 表）', bonusCount, 45);
  // 官方轉生職是**另一張表**，不是十字軍那張的延長
  t.ok('加成表跟十字軍不同（官方本來就是兩張）',
    j.bonusLevels.luk.join(',') !== g.JOB_TREE.crusader.bonusLevels.luk.join(','));

  /* aspdFrom 寫本職的職業 id，靠 `aspdJobKey()` 一路跟到終點
     （聖殿十字軍 → 十字軍 → `x_十字軍_聖殿十字軍`）。#75 之前只解析一層，
     寫職業 id 會停在 'crusader'、查不到表就整個退回空手值 154。 */
  t.eq('攻速表指回十字軍', j.aspdFrom, 'crusader');
  t.eq('一路跟到官方那張表', g.aspdJobKey('paladin'), 'x_十字軍_聖殿十字軍');
  t.ok('攻速表查得到（不是退回空手預設）', !!g.ASPD_WEAPON_BASE[g.aspdJobKey('paladin')]);
}

/* ---------------- 2. 轉生斷層（#67-續）---------------- */
{
  const g = H.boot();
  // 七條分支線：二轉 → 它的進階二轉
  const lines = [
    [['swordsman', 'crusader'], 'paladin'],
    [['mage', 'sage'], 'professor'],
    [['archer', 'bard'], 'clown'],
    [['archer', 'dancer'], 'gypsy'],
    [['merchant', 'alchemist'], 'creator'],
    [['thief', 'rogue'], 'stalker'],
    [['acolyte', 'monk'], 'champion'],
  ];
  lines.forEach(([path, adv]) => {
    t.ok(`${adv} 進了 JOB_TREE`, !!g.JOB_TREE[adv]);
    t.eq(`${path[1]} 的 nextLocked 指向 ${adv}`, g.JOB_TREE[path[1]].nextLocked[0], adv);
  });

  // 真的走一次：轉生之後路線上的二轉要被換成進階二轉
  lines.forEach(([path, adv]) => {
    const gg = H.boot();
    const gender = adv === 'gypsy' ? 'female' : 'male';
    H.mkChar(gg, { path, rebirth: true, job: adv, gender });
    t.eq(`${path.join('→')} 轉生後接得到 ${adv}`, gg.state.jobId, adv);
    const line = gg.rebirthLine();
    t.ok(`${adv} 的轉生路線用進階二轉取代二轉`,
      line.includes(adv) && !line.includes(path[1]), line.join('→'));
  });

  // 十三個進階二轉全部到齊（六個代表分支 + 七個分支線）
  const advAll = ['lordknight', 'highwizard', 'sniper', 'whitesmith', 'assassincross', 'highpriest',
    'paladin', 'professor', 'clown', 'gypsy', 'creator', 'stalker', 'champion'];
  t.eq('十三個進階二轉全部在 JOB_TREE', advAll.filter(id => g.JOB_TREE[id]).length, 13);
  t.ok('全部都是 tier 2.5', advAll.every(id => g.JOB_TREE[id].tier === 2.5));
  t.ok('全部都借了本職的技能', advAll.every(id => (g.JOB_TREE[id].borrowSkillsFrom || []).length === 1));
  // 性別鎖要跟著本職走，不然轉生後會卡在轉不了職
  t.eq('演奏者鎖男', g.JOB_TREE.clown.genderLock, 'male');
  t.eq('吉普賽鎖女', g.JOB_TREE.gypsy.genderLock, 'female');
}

/* ---------------- 3. 連續盾擊 ---------------- */
{
  const g = mk();
  H.learn(g, 'cr_shieldboomerang', 5);
  const lv = H.learn(g, 'pa_shieldchain', 5);
  t.eq('連續盾擊點得到 Lv5', lv, 5);
  const sk = g.SKILLS.pa_shieldchain;
  t.eq('Lv1 倍率 500%', sk.mult[0], 5);
  t.eq('Lv5 倍率 1300%', sk.mult[4], 13);
  t.eq('需要盾牌', sk.requiresEquip, 'shield');

  H.wield(g, 'sword1');
  g.state.monsters = [];
  H.mon(g, { defId: Object.keys(g.MONSTERS)[0] });
  // 沒盾牌時放不出來
  g.state.cooldowns = {};
  t.eq('沒裝盾牌時放不出來', g.castSkill('pa_shieldchain'), false);

  H.wear(g, 'shield');
  g.state.cooldowns = {};
  t.eq('裝了盾牌就放得出來', g.castSkill('pa_shieldchain'), true);

  // 盾牌精煉會增傷（走迴旋盾擊那兩個既有欄位）
  const hit = () => {
    const m = H.mon(g, { defId: Object.keys(g.MONSTERS)[0] });
    g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
    g.castSkill('pa_shieldchain');
    return m.maxHp - m.hp;
  };
  const plain = hit();
  H.refine(g, 'shield', 10);
  const refined = hit();
  t.ok('盾牌精煉 +10 之後傷害變高', refined > plain, `${plain} → ${refined}`);

  // 基本等級加成：99 級吃滿 +50%
  t.eq('有基本等級加成欄位', g.SKILLS.pa_shieldchain.levelScaleMax, 50);
  const g2 = mk();
  H.learn(g2, 'cr_shieldboomerang', 5); H.learn(g2, 'pa_shieldchain', 5);
  H.wield(g2, 'sword1'); H.wear(g2, 'shield');
  const at = (baseLevel) => {
    g2.state.baseLevel = baseLevel;
    g2.recomputeDerived(true);
    const m = H.mon(g2, { defId: Object.keys(g2.MONSTERS)[0] });
    g2.state.cooldowns = {}; g2.state.sp = g2.state.maxSp;
    g2.castSkill('pa_shieldchain');
    return m.maxHp - m.hp;
  };
  const lowLv = at(1);
  const highLv = at(99);
  t.ok('基本等級高的傷害比較高', highLv > lowLv, `Lv1 ${lowLv} → Lv99 ${highLv}`);
}

/* ---------------- 4. 神之威壓 ---------------- */
{
  const g = mk();
  H.learn(g, 'cr_trust', 5);
  t.eq('神之威壓點得到 Lv5', H.learn(g, 'pa_pressure', 5), 5);
  const sk = g.SKILLS.pa_pressure;
  t.eq('是魔法', sk.type, 'magic');
  t.eq('聖屬性', sk.element, 'holy');
  t.eq('Lv1 倍率 650%', sk.mult[0], 6.5);
  t.eq('Lv5 倍率 1250%', sk.mult[4], 12.5);

  /* 官方是 MATK，而十字軍線的 matkMod 是 1.0、加點表 INT 只有 6 級——
     使用者指定「照官方做，不一定要強勢」，所以聖殿十字軍**沒有**額外的 matkMod。 */
  t.eq('聖殿十字軍沒有另外加 matkMod', g.JOB_TREE.paladin.matkMod, g.JOB_TREE.crusader.matkMod);

  H.wield(g, 'sword1');
  const dmgAt = (int) => {
    g.state.stats.int = int;
    g.recomputeDerived(true);
    const m = H.mon(g, { defId: Object.keys(g.MONSTERS)[0] });
    g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
    g.castSkill('pa_pressure');
    return m.maxHp - m.hp;
  };
  const lowInt = dmgAt(1);
  const highInt = dmgAt(99);
  t.ok('傷害跟著 INT 走（確定是 MATK 不是 ATK）', highInt > lowInt * 1.5, `INT1 ${lowInt} → INT99 ${highInt}`);
}

/* ---------------- 5. 捨命攻擊 ---------------- */
{
  const g = mk();
  H.learn(g, 'endure', 1);
  t.eq('捨命攻擊點得到 Lv5', H.learn(g, 'pa_sacrifice', 5), 5);
  const sk = g.SKILLS.pa_sacrifice;
  t.eq('SP 100', sk.spCost[0], 100);
  t.eq('5 次', sk.charges, 5);
  t.eq('每次 9% HP', sk.hpCostPct, 9);
  t.eq('Lv1 倍率 100%', sk.mult[0], 1.0);
  t.eq('Lv5 倍率 140%', sk.mult[4], 1.4);
  t.eq('持續 60 秒起', sk.duration[0], 60);
  t.eq('Lv5 持續 90 秒', sk.duration[4], 90);
  // 官方前置是「犧牲 Lv3」，但犧牲在本作沒實作（等隊伍系統），所以改掛霸體
  t.eq('前置改成霸體', sk.requires.skillId, 'endure');
  t.ok('沒有掛在沒實作的犧牲上', !g.SKILLS.cr_devotion);

  H.wield(g, 'sword1');
  g.state.hp = g.state.maxHp;
  g.state.sp = g.state.maxSp;
  H.mon(g, { defId: Object.keys(g.MONSTERS)[0] });
  t.eq('放得出來', g.castSkill('pa_sacrifice'), true);
  const b = g.state.buffs.find(x => x.type === 'sacrifice');
  t.ok('掛上了 sacrifice buff', !!b);
  t.eq('次數 5', b.charges, 5);

  const cost = Math.floor(g.state.maxHp * 0.09);
  const m = g.state.monsters[0];
  const hpBefore = g.state.hp;
  const monHpBefore = m.hp;
  g.playerAttack();
  t.eq('普攻消耗一次', b.charges, 4);
  t.eq('扣了 9% 最大HP', hpBefore - g.state.hp >= cost, true);
  t.ok('敵人吃到追加傷害', monHpBefore - m.hp > cost, `${monHpBefore - m.hp} vs 自傷 ${cost}`);

  // 用完 5 次 buff 自己消失
  for (let i = 0; i < 4; i++) { g.state.hp = g.state.maxHp; g.playerAttack(); }
  t.ok('5 次用完後 buff 消失', !g.state.buffs.some(x => x.type === 'sacrifice'));
}
{
  /* 這一段是重點：**血不夠時整個不觸發，次數留著**。
     發勁那次是靠 HP 下限 + 10 秒冷卻才壓住的；這招官方只有 5 次沒有冷卻，
     所以規則簡化成「付不起就跳過」——玩家補完血還有那一次可以用。 */
  const g = mk();
  H.learn(g, 'endure', 1); H.learn(g, 'pa_sacrifice', 5);
  H.wield(g, 'sword1');
  g.state.hp = g.state.maxHp; g.state.sp = g.state.maxSp;
  H.mon(g, { defId: Object.keys(g.MONSTERS)[0] });
  g.castSkill('pa_sacrifice');
  const b = g.state.buffs.find(x => x.type === 'sacrifice');
  const cost = Math.floor(g.state.maxHp * 0.09);

  g.state.hp = cost;               // 剛好等於代價 → 扣下去會歸零
  const charges = b.charges;
  g.playerAttack();
  t.eq('血剛好等於代價時不觸發', b.charges, charges);
  t.eq('HP 沒有被扣到 0', g.state.hp > 0, true);

  g.state.hp = cost + 1;           // 多 1 點就付得起
  g.playerAttack();
  t.eq('多 1 點血就觸發得了', b.charges, charges - 1);
  t.eq('留下 1 點 HP，沒死', g.state.hp, 1);

  // 連打 200 下都不會死
  g.state.hp = g.state.maxHp;
  g.state.buffs = g.state.buffs.filter(x => x.type !== 'sacrifice');
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('pa_sacrifice');
  let died = false;
  for (let i = 0; i < 200; i++) {
    H.mon(g, { defId: Object.keys(g.MONSTERS)[0] });
    g.playerAttack();
    if (g.state.hp <= 0) { died = true; break; }
  }
  t.ok('連打 200 下也不會把自己打死', !died);
}

/* ---------------- 6. 聖音 ---------------- */
{
  const g = mk();
  H.learn(g, 'cr_trust', 8);
  t.eq('聖音點得到 Lv10', H.learn(g, 'pa_gospel', 10), 10);
  const sk = g.SKILLS.pa_gospel;
  t.eq('Lv1 SP 80', sk.spCost[0], 80);
  t.eq('Lv10 SP 100', sk.spCost[9], 100);
  t.eq('Lv1 機率 55%', sk.chance[0], 55);
  t.eq('Lv10 機率 100%', sk.chance[9], 100);
  t.eq('Lv1 每跳扣 30 HP', sk.hpDrain[0], 30);
  t.eq('Lv10 每跳扣 45 HP', sk.hpDrain[9], 45);
  t.eq('Lv1 每跳扣 20 SP', sk.spDrain[0], 20);
  t.eq('Lv10 每跳扣 35 SP', sk.spDrain[9], 35);
  t.eq('10 秒一跳', sk.tickSec, 10);
  t.eq('持續 60 秒', sk.duration[0], 60);

  g.state.mapId = g.MAPS.find(m => m.monsters && m.monsters.length).id;
  H.mon(g, { defId: Object.keys(g.MONSTERS)[0] });
  g.state.sp = g.state.maxSp;
  g.state.hp = g.state.maxHp;
  t.eq('放得出來', g.castSkill('pa_gospel'), true);
  const f = (g.state.activeFieldEffects || []).find(x => x.kind === 'gospel');
  t.ok('掛上了 gospel 場域', !!f);
  t.eq('機率 100（Lv10）', f.chance, 100);
  t.eq('每跳扣 45 HP', f.hpDrain, 45);

  // 場域真的接進慢心跳，而且補跳算得出來
  f.nextTickAt = Date.now() - 10000;      // 上一跳排在 10 秒前 → 這次補 2 跳
  g.state._lastSlowTick = Date.now() - 2000;
  g.gameTick();
  t.eq('一次補了 2 跳', f.ticksThisRound, 2);

  /* 維持費另外量。不能靠上面那一跳去比對 HP/SP 差值——
     gameTick 同一輪還會跑自然回復，19,088 最大HP 的回復量剛好跟 2×45 同一個量級，
     兩邊會互相抵銷，看起來就像「一毛都沒扣」（第一版就是這樣假過去的）。 */
  const hp0 = g.state.hp, sp0 = g.state.sp;
  g.gospelTick({ name: '聖音', chance: 0, hpDrain: 45, spDrain: 35, ticksThisRound: 2 });
  t.eq('HP 照跳數收（2×45）', hp0 - g.state.hp, 90);
  t.eq('SP 照跳數收（2×35）', sp0 - g.state.sp, 70);

  // 維持費不會把人扣死：血只剩 1 也只是留在 1
  g.state.hp = 10;
  g.gospelTick({ name: '聖音', chance: 0, hpDrain: 45, spDrain: 35, ticksThisRound: 5 });
  t.eq('維持費不會把人扣死', g.state.hp, 1);
}
{
  // 兩張效果表逐條驗：直接呼叫 run()，不靠隨機抽中
  const g = mk();
  g.state.mapId = g.MAPS.find(m => m.monsters && m.monsters.length).id;
  H.mon(g, { defId: Object.keys(g.MONSTERS)[0], hp: 999999 });

  t.eq('祝福表 4 種', g.GOSPEL_BLESSINGS.length, 4);
  t.eq('詛咒表 5 種（含無事發生）', g.GOSPEL_CURSES.length, 5);

  const names = g.GOSPEL_BLESSINGS.map(e => e.name);
  ['全素質提升', '恩寵', '淨化', '洞察'].forEach(n => t.ok(`祝福「${n}」在表裡`, names.includes(n)));
  const cnames = g.GOSPEL_CURSES.map(e => e.name);
  ['神罰', '蒙蔽', '劇毒', '激怒', '無事發生'].forEach(n => t.ok(`詛咒「${n}」在表裡`, cnames.includes(n)));

  const byName = (arr, n) => arr.find(e => e.name === n);

  // 全素質 +10
  const strBefore = g.state.stats.str;
  byName(g.GOSPEL_BLESSINGS, '全素質提升').run();
  const ab = g.state.buffs.find(b => b.type === 'allstat' && b.skillId === 'pa_gospel');
  t.ok('全素質提升掛上 allstat buff', !!ab);
  t.eq('加 10 點', ab.flatBonus, 10);
  t.eq('持續 10 秒', ab.msRemaining, 10000);
  t.eq('原始素質沒有被改寫（buff 是外掛的）', g.state.stats.str, strBefore);

  // 隨機補血
  g.state.hp = 1;
  byName(g.GOSPEL_BLESSINGS, '恩寵').run();
  t.ok('恩寵補了血', g.state.hp > 1);

  // 異常狀態免疫
  g.state.playerAil = { stun: Date.now() + 99999 };
  byName(g.GOSPEL_BLESSINGS, '淨化').run();
  const rb = g.state.buffs.find(b => b.type === 'songailresist' && b.skillId === 'pa_gospel');
  t.ok('淨化掛上異常狀態抗性', !!rb);
  t.eq('抗性 100 = 免疫', rb.flatBonus, 100);
  t.eq('身上的異常狀態被清掉', Object.keys(g.state.playerAil).length, 0);
  g.recomputeDerived(true);
  t.ok('抗性真的算進 state.ailResist', (g.state.ailResist.stun || 0) >= 100);
  t.eq('免疫時掛不上暈眩', g.applyPlayerAilment('stun'), false);

  // 命中／迴避
  byName(g.GOSPEL_BLESSINGS, '洞察').run();
  const hb = g.state.buffs.find(b => b.type === 'hit' && b.skillId === 'pa_gospel');
  const fb = g.state.buffs.find(b => b.type === 'flee' && b.skillId === 'pa_gospel');
  t.eq('命中 +20', hb && hb.flatBonus, 20);
  t.eq('迴避 +20', fb && fb.flatBonus, 20);

  // 神罰：無視防禦與迴避的亂數傷害
  const m = g.state.monsters[0];
  const hpB = m.hp;
  byName(g.GOSPEL_CURSES, '神罰').run([m]);
  t.ok('神罰造成了傷害', m.hp < hpB);
  t.ok('傷害在 1~9999 之間', hpB - m.hp >= 1 && hpB - m.hp <= 9999, String(hpB - m.hp));

  // 黑暗／中毒（挑不會免疫的怪）
  const g2 = mk();
  g2.state.mapId = g2.MAPS.find(mm => mm.monsters && mm.monsters.length).id;
  // 黑暗與中毒各有免疫名單（中毒免毒屬、出血免不死與無形），挑一隻都不在名單上的
  const m2 = H.mon(g2, { race: 'brute', element: 'earth', hp: 999999 });
  byName(g2.GOSPEL_CURSES, '蒙蔽').run([m2]);
  t.ok('蒙蔽掛上黑暗', g2.ailActive(m2, 'blind'));
  byName(g2.GOSPEL_CURSES, '劇毒').run([m2]);
  t.ok('劇毒掛上中毒', g2.ailActive(m2, 'poison'));

  // 10 級挑釁
  byName(g2.GOSPEL_CURSES, '激怒').run([m2]);
  t.eq('挑釁的 DEF 倍率照 SKILLS.provoke 最後一格', m2.debuffDef, g2.SKILLS.provoke.mult[9]);
  t.ok('挑釁有結束時間', m2.debuffDefEnd > Date.now());

  // 無事發生：回傳 null，而且什麼都不能動
  const hpB2 = m2.hp;
  t.eq('無事發生回傳 null', byName(g2.GOSPEL_CURSES, '無事發生').run([m2]), null);
  t.eq('無事發生真的什麼都沒做', m2.hp, hpB2);
}
{
  // 城鎮裡不該自動放這兩招（一個燒血、一個每 10 秒扣 HP/SP）
  const g = mk();
  H.learn(g, 'endure', 1); H.learn(g, 'pa_sacrifice', 5);
  H.learn(g, 'cr_trust', 8); H.learn(g, 'pa_gospel', 10);
  const safe = g.MAPS.filter(m => m.monsters && m.monsters.length === 0)[0];
  g.state.mapId = safe.id;
  t.ok('城鎮裡不自動放捨命攻擊', g.wastesResourceInTown(g.SKILLS.pa_sacrifice, 5));
  t.ok('城鎮裡不自動放聖音', g.wastesResourceInTown(g.SKILLS.pa_gospel, 10));
}

t.report('聖殿十字軍 4 技能 + 分支線轉生斷層');
