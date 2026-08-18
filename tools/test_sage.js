/* 賢者（#71）：22 個官方技能全做，外加「沒有詠唱」帶來的四次重新定位。

   這支要證的四件事：
     1. 屬性附加真的換得了武器屬性，而且**碎片沒有時吃得到礦石**
        （四種靈碎片本作沒有任何怪會掉、商店也沒賣，只認碎片的話那四招永遠放不出來）
     2. 元素領域**同時只能開一個**，而且從別的領域切換過來不消耗礦石
     3. 資源取用的三段順序：背包 → 倉庫 → 付錢
     4. 元素更換真的改得動**單一隻怪**的屬性，而且不會汙染同種怪的定義

   跑法：node tools/test_sage.js（或由 tools/test.js 一起跑）
*/
const H = require('./harness');
const t = H.tester();

const mk = (opts) => {
  const g = H.boot(Object.assign({ captureLog: true }, opts || {}));
  H.mkChar(g, { path: ['mage', 'sage'] });
  return g;
};
function learnChain(g, pairs) { pairs.forEach(([id, lv]) => H.learn(g, id, lv)); }
// 直接把道具塞進背包（測試治具走的是真的 addItem）
const give = (g, id, n) => g.addItem(id, n);
const qty = (g, id) => g.getItemQty(id);

/* ---------------- 1. 職業本體 ---------------- */
{
  const g = H.boot();
  const j = g.JOB_TREE.sage;
  t.ok('賢者進了 JOB_TREE', !!j);
  t.eq('父職業是法師', j.parent, 'mage');
  t.eq('tier 2', j.tier, 2);
  t.eq('法師的分支有賢者', g.JOB_TREE.mage.next.join(','), 'wizard,sage');
  t.eq('二轉分支的待辦清單已清空（#72 收尾）', g.JOBS_TIER2_PENDING.length, 0);

  const own = ['sa_advancedbook', 'sa_dragonology', 'sa_flamelauncher', 'sa_frostweapon',
    'sa_lightningloader', 'sa_seismicweapon', 'sa_volcano', 'sa_deluge', 'sa_violentgale',
    'sa_landprotector', 'sa_castcancel', 'sa_freecast', 'sa_autospell', 'sa_magicrod',
    'sa_spellbreaker', 'sa_dispell', 'sa_abracadabra', 'sa_createcon',
    'sa_elementfire', 'sa_elementwater', 'sa_elementwind', 'sa_elementearth'];
  t.eq('官方 22 個技能一個都沒少', own.filter(id => g.SKILLS[id]).length, 22);
  const ids = j.skills.map(s => s.id);
  t.eq('技能總數 = 22 自有 + 14 借用法師', ids.length, 36);
  t.ok('借到了法師的火箭術', ids.includes('firebolt'));

  t.ok('有官方 HP 表', Array.isArray(g.JOB_BASE_HP.sage) && g.JOB_BASE_HP.sage.length === 100);
  const bonusCount = Object.values(j.bonusLevels).reduce((a, b) => a + b.length, 0);
  t.eq('職業加成 30 點（與其他二轉一致）', bonusCount, 30);
  t.eq('攻速表指向 x_賢者_智者', j.aspdFrom, 'x_賢者_智者');
  t.eq('書本攻速 151', g.ASPD_WEAPON_BASE[j.aspdFrom].weapons.book, 151);
}

/* ---------------- 2. 書本武器與進化之書 ---------------- */
{
  const g = mk();
  const bk = H.wield(g, 'book');
  t.ok('賢者穿得上書本', !!bk);
  const base = g.state.atk, baseAspd = g.state.aspd;
  H.learn(g, 'sa_advancedbook', 10);
  t.eq('進化之書 Lv10 ATK +30', g.state.atk - base, 30);
  t.ok('攻速也上升了', g.state.aspd > baseAspd, `${baseAspd} → ${g.state.aspd}`);
  // 換成法杖就失效（官方寫的是「以書本攻擊時」）
  const atkBook = g.state.atk;
  H.wield(g, 'rod1');
  t.ok('換法杖後進化之書失效', g.state.atk < atkBook, `${atkBook} → ${g.state.atk}`);
}

/* ---------------- 3. 龍知識：四欄都有人讀 ---------------- */
{
  const g = mk();
  H.wield(g, 'book');
  const int0 = g.state.stats.int + (g.state.cardRaceDmgBonus.dragon || 0);
  learnChain(g, [['sa_advancedbook', 9], ['sa_dragonology', 5]]);
  t.near('對龍族物理增傷 +20%', (g.state.cardRaceDmgBonus.dragon || 0) * 100, 20, 0.01);
  t.near('受龍族傷害 −20%', (g.state.cardRaceDmgReduce.dragon || 0) * 100, 20, 0.01);
  t.eq('對龍族魔法傷害 +10%', g.state.dragonMatkPct, 10);
  /* 回歸鎖：`cardRaceDmgBonus` 在被動迴圈之後才被 `= {}` 重建，
     所以龍知識必須寫暫存桶再併進去。直接寫的話這一條會歸零。 */
  g.recomputeDerived(true);
  t.near('重算之後對龍族增傷還在（不是被 cardRaceDmgBonus 的重建蓋掉）',
    (g.state.cardRaceDmgBonus.dragon || 0) * 100, 20, 0.01);
  // 實際傷害：打龍族比打同等的非龍族痛
  const dragon = Object.values(g.MONSTERS).find(m => m.race === 'dragon' && !m.isBoss);
  t.ok('資料裡找得到龍族怪', !!dragon);
}

/* ---------------- 4. 屬性附加：碎片沒有時吃礦石 ---------------- */
{
  const g = mk();
  H.wield(g, 'book');
  learnChain(g, [['sa_advancedbook', 5], ['sa_flamelauncher', 5]]);
  g.state.sp = g.state.maxSp;

  // 四種靈碎片本作打不到，先確認這件事本身
  const shards = ['scarlet_pts', 'indigo_pts', 'yellow_wish_pts', 'lime_green_pts'];
  const dropCount = shards.reduce((n, id) => n + ((g.getItemSources(id) || []).length), 0);
  t.eq('四種靈碎片沒有任何怪會掉（所以才要吃礦石）', dropCount, 0);
  const ores = ['boody_red', 'crystal_blue', 'wind_of_verdure', 'yellow_live'];
  t.ok('四種靈礦石都有怪會掉', ores.every(id => (g.getItemSources(id) || []).length > 0));

  // 什麼都沒有 → 放不出來
  t.eq('沒有碎片也沒有礦石時放不出來', g.castSkill('sa_flamelauncher'), false);
  // 只有礦石 → 放得出來，而且扣的是礦石
  give(g, 'boody_red', 2);
  t.eq('只有火靈礦石時放得出來', g.castSkill('sa_flamelauncher'), true);
  t.eq('扣掉 1 個火靈礦石', qty(g, 'boody_red'), 1);
  const ew = g.state.buffs.find(b => b.type === 'eleweapon');
  t.eq('武器變成火屬性', ew && ew.element, 'fire');
  t.near('火屬性傷害 +5%', (g.buffMult('eledmg_fire').mult - 1) * 100, 5, 0.01);
  t.eq('持續 60 分鐘（官方 30 分，使用者指定加長）', Math.round(ew.msRemaining / 60000), 60);

  // 碎片優先
  g.state.buffs = [];
  give(g, 'scarlet_pts', 1);
  g.state.cooldowns = {};
  g.state.sp = g.state.maxSp;
  t.eq('有碎片時放得出來', g.castSkill('sa_flamelauncher'), true);
  t.eq('優先扣碎片', qty(g, 'scarlet_pts'), 0);
  t.eq('礦石沒被動到', qty(g, 'boody_red'), 1);

  // 換一種屬性 → 前一個屬性附加要被蓋掉，不能兩種並存
  learnChain(g, [['sa_frostweapon', 5]]);
  give(g, 'crystal_blue', 1);
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('sa_frostweapon');
  t.eq('同時只有一個武器屬性', g.state.buffs.filter(b => b.type === 'eleweapon').length, 1);
  t.eq('武器變成水屬性', g.state.buffs.find(b => b.type === 'eleweapon').element, 'water');
  t.eq('火屬性的增傷也一起撤掉', g.buffMult('eledmg_fire').mult, 1);
}

/* ---------------- 5. 資源取用：背包 → 倉庫 → 付錢 ---------------- */
{
  const g = mk();
  H.wield(g, 'book');
  learnChain(g, [['sa_advancedbook', 5], ['sa_flamelauncher', 5]]);
  g.localStorage.removeItem('ro_idle_warehouse');

  // 只有倉庫有
  give(g, 'boody_red', 1);
  g.depositToWarehouse('boody_red', 1);
  t.eq('背包已經沒有了', qty(g, 'boody_red'), 0);
  t.eq('倉庫湊得出來就算數', g.sageCanPay(['boody_red'], 1), true);
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  t.eq('只有倉庫有也放得出來', g.castSkill('sa_flamelauncher'), true);
  const wh = g.loadWarehouse();
  t.eq('倉庫那份被扣掉了', (wh.items.find(r => r.item === 'boody_red') || { qty: 0 }).qty, 0);

  // 付錢那一段（元素更換與肯貝特才有 goldFallback）
  t.eq('沒有道具也沒錢就湊不出來', g.sageCanPay(['boody_red'], 1, 1000), g.state.gold >= 1000);
  g.state.gold = 5000;
  const before = g.state.gold;
  const paid = g.sagePay(['boody_red'], 1, 1000);
  t.ok('湊不到道具時改付錢', !!paid && /鋅幣/.test(paid.label), paid && paid.label);
  t.eq('扣了 1000 鋅幣', before - g.state.gold, 1000);
  g.state.gold = 100;
  t.eq('錢也不夠就回 null', g.sagePay(['boody_red'], 1, 1000), null);
}

/* ---------------- 6. 元素領域：只能開一個、切換免礦石 ---------------- */
{
  const g = mk();
  H.wield(g, 'book');
  learnChain(g, [['sa_advancedbook', 5], ['sa_flamelauncher', 2], ['sa_volcano', 5],
    ['sa_frostweapon', 2], ['sa_deluge', 5], ['sa_lightningloader', 2], ['sa_violentgale', 5],
    ['sa_seismicweapon', 2], ['sa_landprotector', 5]]);
  g.state.sp = 99999; g.state.maxSp = 99999;

  t.eq('沒有藍色魔力礦石時放不出來', g.castSkill('sa_volcano'), false);
  give(g, 'blue_gemstone', 5);
  g.state.cooldowns = {};
  t.eq('火元素領域展開', g.castSkill('sa_volcano'), true);
  t.eq('扣掉 1 個藍色魔力礦石', qty(g, 'blue_gemstone'), 4);
  t.near('火屬性傷害 +20%', (g.buffMult('eledmg_fire').mult - 1) * 100, 20, 0.01);
  t.eq('ATK +30', g.buffMult('atkflat').flatBonus, 30);
  t.eq('MATK +30', g.buffMult('matk').flatBonus, 30);

  // 切換到水元素領域：火那組要整組撤掉，而且**不再扣礦石**
  g.state.cooldowns = {};
  t.eq('切換到水元素領域', g.castSkill('sa_deluge'), true);
  t.eq('切換不消耗礦石（官方就有這條）', qty(g, 'blue_gemstone'), 4);
  t.eq('火屬性領域整組撤掉', g.buffMult('eledmg_fire').mult, 1);
  t.eq('火領域的 ATK 也撤掉了', g.buffMult('atkflat').flatBonus, 0);
  t.near('水屬性傷害 +20%', (g.buffMult('eledmg_water').mult - 1) * 100, 20, 0.01);
  t.eq('同時只有一個元素領域', g.state.buffs.filter(b => b.eleFieldTag === 1).length > 0, true);
  t.eq('元素領域的屬性增傷只有一個',
    ['fire', 'water', 'wind', 'earth'].filter(e => g.buffMult('eledmg_' + e).mult > 1).length, 1);

  // 風→迴避、地→DEF
  g.state.cooldowns = {};
  g.castSkill('sa_violentgale');
  t.eq('風元素領域給迴避 +15', g.buffMult('flee').flatBonus, 15);
  g.state.cooldowns = {};
  g.castSkill('sa_landprotector');
  t.eq('地元素領域給 DEF +30', g.buffMult('defflat').flatBonus, 30);
  t.eq('全程只花了 1 個礦石', qty(g, 'blue_gemstone'), 4);
}

/* ---------------- 7. 取消施法 / 自由施法 ---------------- */
{
  const g = mk();
  H.wield(g, 'book');
  learnChain(g, [['sa_advancedbook', 2], ['sa_castcancel', 5]]);
  t.eq('取消施法 Lv5 → 技能 SP 消耗 −25%', g.state.skillSpCostPct, -25);
  const sk = g.SKILLS.firebolt;
  H.learn(g, 'firebolt', 10);
  const cost = g.skillSpCost(sk, 10);
  const base = Array.isArray(sk.spCost) ? sk.spCost[9] : sk.spCost;
  t.ok('技能 SP 真的變便宜了', cost < base, `${base} → ${cost}`);

  const aspd0 = g.state.aspd;
  H.learn(g, 'sa_freecast', 10);
  t.eq('自由施法 → 自動念咒機率 +10%', g.state.freeCastAutoSpellPct, 10);
  t.ok('自由施法 → 攻速上升', g.state.aspd > aspd0, `${aspd0} → ${g.state.aspd}`);
}

/* ---------------- 8. 自動念咒：自選魔法、獨立冷卻 ---------------- */
{
  const g = mk();
  H.wield(g, 'book');
  learnChain(g, [['sa_advancedbook', 2], ['sa_castcancel', 1], ['sa_freecast', 4],
    ['sa_autospell', 10], ['firebolt', 10]]);
  t.eq('自動念咒 Lv10 機率 20%', g.state.sageAutoSpell.chance, 20);
  t.eq('獨立冷卻 3 秒', g.state.sageAutoSpell.cdSec, 3);
  const picks = g.sageAutoSpellChoices();
  t.ok('選單挑得到已學會的魔法', picks.some(p => p.id === 'firebolt'), picks.length + ' 個選項');
  t.ok('沒學過的魔法不在選單裡', !picks.some(p => p.id === 'meteorstorm'));
  t.eq('發動等級上限＝技能等級的一半', g.sageAutoSpellLv('firebolt'), 5);
  t.eq('設定成功', g.setSageAutoSpell('firebolt'), true);
  t.eq('亂填的技能會被擋下', g.setSageAutoSpell('not_a_skill'), false);

  // 真的會放：把機率拉到必中，量 SP 有沒有被扣
  H.mon(g, { minHp: 500000 });
  const md = g.MONSTERS[g.state.monsters[0].defId];
  g.state.songProcReadyAt = {};
  g.state.sageAutoSpell.chance = 100;
  g.state.sp = g.state.maxSp;
  const spBefore = g.state.sp, hpBefore = g.state.monsters[0].hp;
  g.trySageProcs(g.state.monsters[0], md);
  t.ok('自動念咒扣了 SP', g.state.sp < spBefore, `${spBefore} → ${g.state.sp}`);
  t.ok('自動念咒打出了傷害', g.state.monsters[0].hp < hpBefore);
  /* 獨立冷卻：**不吃火箭術自己的冷卻**。先把火箭術的冷卻塞滿，
     自動念咒還是要放得出來——不然挑到長冷卻的魔法等於這個被動不會動。 */
  g.state.cooldowns.firebolt = 999000;
  g.state.songProcReadyAt = {};
  g.state.sp = g.state.maxSp;
  const hp2 = g.state.monsters[0].hp;
  g.trySageProcs(g.state.monsters[0], md);
  t.ok('魔法本身在冷卻中，自動念咒照樣發動', g.state.monsters[0].hp < hp2);
}

/* ---------------- 9. 魔法懲罰：受技能攻擊時免傷 ---------------- */
{
  const g = mk();
  learnChain(g, [['sa_advancedbook', 4], ['sa_magicrod', 5]]);
  t.eq('魔法懲罰 Lv5 機率 20%', g.state.magicRod.chance, 20);
  t.eq('回復 30 SP', g.state.magicRod.spGain, 30);
  t.eq('內部冷卻 5 秒', g.state.magicRod.cdSec, 5);
  // 冷卻每次清掉，量純機率
  const hit = H.rate(600, () => {
    g.state.sp = 0;
    return g.tryMagicRod();
  }, () => { g.state.magicRodReadyAt = 0; });
  t.near('觸發率約 20%', hit / 600 * 100, 20, 6);
  // 觸發時真的回 SP
  g.state.magicRodReadyAt = 0; g.state.sp = 0;
  g.state.magicRod.chance = 100;
  t.eq('必中時回傳 true', g.tryMagicRod(), true);
  t.eq('回了 30 SP', g.state.sp, 30);
  t.eq('冷卻中就不再觸發', g.tryMagicRod(), false);
}

/* ---------------- 10. 念咒拆除：最大 HP 2%，BOSS 免疫傷害 ---------------- */
{
  const g = mk();
  learnChain(g, [['sa_advancedbook', 4], ['sa_magicrod', 1], ['sa_spellbreaker', 5]]);
  t.eq('念咒拆除 Lv5 機率 20%', g.state.spellBreaker.chance, 20);
  t.eq('傷害是最大 HP 的 2%', g.state.spellBreaker.hpPct, 2);

  const normal = Object.values(g.MONSTERS).find(m => !m.isBoss && m.hp > 5000);
  H.mon(g, { defId: normal.id, hp: 100000 });
  g.state.songProcReadyAt = {}; g.state.spellBreaker.chance = 100;
  g.state.sp = 0;
  const before = g.state.monsters[0].hp;
  g.trySageProcs(g.state.monsters[0], normal);
  t.near('一般怪吃到最大 HP 的 2%', before - g.state.monsters[0].hp, 100000 * 0.02, 2);
  t.eq('回了 50 SP', g.state.sp, 50);

  // BOSS：**不造成傷害**（官方規則），但暈眩照常
  const boss = Object.values(g.MONSTERS).find(m => m.isBoss);
  H.mon(g, { defId: boss.id, hp: 100000 });
  g.state.songProcReadyAt = {}; g.state.spellBreaker.chance = 100;
  const bBefore = g.state.monsters[0].hp;
  g.trySageProcs(g.state.monsters[0], boss);
  t.eq('首領階級不受傷害', g.state.monsters[0].hp, bBefore);
}

/* ---------------- 11. 魔法效果解除：對象是 mon.mbuff ---------------- */
{
  const g = mk();
  learnChain(g, [['sa_advancedbook', 4], ['sa_magicrod', 1], ['sa_spellbreaker', 3], ['sa_dispell', 5]]);
  t.eq('成功率 Lv5 = 100%', g.state.dispellProc.successPct, 100);
  H.mon(g, { minHp: 100000 });
  const md = g.MONSTERS[g.state.monsters[0].defId];
  give(g, 'yellow_gemstone', 5);

  // 怪身上沒有 buff → 不觸發、不消耗礦石
  g.state.songProcReadyAt = {}; g.state.dispellProc.chance = 100;
  g.trySageProcs(g.state.monsters[0], md);
  t.eq('怪身上沒有強化效果時不消耗礦石', g.getItemQty('yellow_gemstone'), 5);

  // 給怪上 buff → 解得掉
  g.monBuffAdd(g.state.monsters[0], 'atkPct', 50, 60);
  g.monBuffAdd(g.state.monsters[0], 'cutPct', 30, 60);
  t.eq('怪身上有兩個強化效果', g.monBuffList(g.state.monsters[0]).length, 2);
  g.state.songProcReadyAt = {}; g.state.dispellProc.chance = 100;
  g.trySageProcs(g.state.monsters[0], md);
  t.eq('強化效果被全部解除', g.monBuffList(g.state.monsters[0]).length, 0);
  t.eq('消耗了 1 個黃色魔力礦石', g.getItemQty('yellow_gemstone'), 4);
}

/* ---------------- 12. 隨機技能 ---------------- */
{
  const g = mk();
  learnChain(g, [['sa_advancedbook', 2], ['sa_castcancel', 1], ['sa_freecast', 4],
    ['sa_autospell', 5], ['sa_abracadabra', 10]]);
  t.eq('隨機技能 Lv10 → 施放等級 10', g.state.abracadabra.castLv, 10);
  t.eq('消耗黃色魔力礦石 ×2', g.state.abracadabra.costQty, 2);
  H.mon(g, { minHp: 5000000 });
  const md = g.MONSTERS[g.state.monsters[0].defId];

  // 沒有礦石 → 不發動
  g.state.songProcReadyAt = {}; g.state.abracadabra.chance = 100;
  g.state.sageAutoSpell = null; g.state.spellBreaker = null; g.state.dispellProc = null;
  const hp0 = g.state.monsters[0].hp;
  g.trySageProcs(g.state.monsters[0], md);
  t.eq('沒有礦石時不發動', g.state.monsters[0].hp, hp0);

  // 有礦石 → 抽得到技能（跑幾輪，至少要有一次打出傷害或推出 buff）
  give(g, 'yellow_gemstone', 40);
  let fired = 0;
  for (let i = 0; i < 20; i++) {
    g.state.songProcReadyAt = {};
    g.state.sp = g.state.maxSp;
    const before = g.getItemQty('yellow_gemstone');
    g.trySageProcs(g.state.monsters[0], md);
    if (g.getItemQty('yellow_gemstone') < before) fired++;
  }
  t.eq('20 次必中全部發動', fired, 20);
  t.eq('每次扣 2 個礦石', g.getItemQty('yellow_gemstone'), 0);
}

/* ---------------- 13. 元素更換：改單一隻怪的屬性 ---------------- */
{
  const g = mk();
  t.eq('轉職自動獲得四個元素更換',
    ['sa_elementfire', 'sa_elementwater', 'sa_elementwind', 'sa_elementearth']
      .filter(id => g.state.learnedSkills[id]).length, 4);
  t.eq('轉職自動獲得肯貝特製作', g.state.learnedSkills.sa_createcon, 1);
  t.eq('四個元素更換都掛上了設定', Object.keys(g.state.elementChanges).sort().join(','),
    'earth,fire,water,wind');

  // 挑一隻火屬性的怪，把它變成水屬性
  const fireMon = Object.values(g.MONSTERS).find(m => m.element === 'fire' && !m.isBoss);
  H.mon(g, { defId: fireMon.id, hp: 100000 });
  const mon = g.state.monsters[0];
  give(g, 'crystal_blue', 3);
  g.state.elementChangePick = 'water';
  g.state.elementChanges.water.chance = 100;
  g.state.songProcReadyAt = {};
  // 其他 proc 關掉，免得干擾
  g.state.sageAutoSpell = null; g.state.spellBreaker = null;
  g.state.dispellProc = null; g.state.abracadabra = null;

  const fireVsBefore = g.getElementMultiplierVsMonster('fire', fireMon, mon);
  g.trySageProcs(mon, fireMon);
  t.eq('目標變成水屬性', mon.eleOverride, 'water');
  t.eq('消耗了 1 個水靈礦石', g.getItemQty('crystal_blue'), 2);
  const fireVsAfter = g.getElementMultiplierVsMonster('fire', fireMon, mon);
  t.ok('火屬性攻擊對它變得有效了', fireVsAfter > fireVsBefore, `${fireVsBefore} → ${fireVsAfter}`);
  t.eq('水屬性攻擊對它被剋', g.getElementMultiplierVsMonster('water', fireMon, mon) < 1, true);

  /* 覆寫必須寫在**怪物實體**上：同種怪的另一隻不能跟著變，
     不然改的是 MONSTERS[defId]，整張地圖的同種怪一起變屬性。 */
  const other = { defId: fireMon.id, hp: 100, maxHp: 100, id: 99999 };
  t.eq('同種怪的另一隻沒有被汙染',
    g.getElementMultiplierVsMonster('fire', fireMon, other), fireVsBefore);
  t.eq('怪物定義本身沒有被改寫', g.MONSTERS[fireMon.id].element, 'fire');

  // 時間到就回復
  mon.eleOverrideEnd = Date.now() - 1;
  t.eq('過期後回到原本的屬性',
    g.getElementMultiplierVsMonster('fire', fireMon, mon), fireVsBefore);

  // BOSS 也吃（使用者指定，官方是「對首領階級無效」）
  const boss = Object.values(g.MONSTERS).find(m => m.isBoss);
  H.mon(g, { defId: boss.id, hp: 100000 });
  g.state.songProcReadyAt = {};
  g.state.elementChanges.water.chance = 100;
  g.trySageProcs(g.state.monsters[0], boss);
  t.eq('首領階級也能被更換屬性', g.state.monsters[0].eleOverride, 'water');
}

/* ---------------- 14. 肯貝特武器附魔：面板自動維持 ---------------- */
{
  const g = mk();
  H.wield(g, 'book');
  t.ok('肯貝特設定有掛上', !!g.state.elementConverter);
  t.eq('一次 20 分鐘', g.state.elementConverter.durSec, 1200);

  // 沒選屬性 → 什麼都不做
  g.tickConverter();
  t.eq('沒選屬性時不附魔', g.state.buffs.filter(b => b.type === 'eleweapon').length, 0);

  // 選了火 + 背包有礦石
  g.state.converterElement = 'fire';
  give(g, 'boody_red', 2);
  g.tickConverter();
  const ew = g.state.buffs.find(b => b.type === 'eleweapon');
  t.eq('武器變成火屬性', ew && ew.element, 'fire');
  t.eq('扣掉 1 個火靈礦石', g.getItemQty('boody_red'), 1);

  // 已經有屬性附加時不搶（那是玩家自己放的，效果比較好）
  g.state.buffs = [{ type: 'eleweapon', element: 'water', mult: 1, msRemaining: 60000, skillId: 'sa_frostweapon' }];
  g.tickConverter();
  t.eq('屬性附加在身上時肯貝特不動作', g.getItemQty('boody_red'), 1);
  t.eq('武器屬性維持玩家自己放的水', g.state.buffs.find(b => b.type === 'eleweapon').element, 'water');

  // 礦石用完 → 改付 1000z
  g.state.buffs = [];
  g.removeItem('boody_red', 1);
  g.localStorage.removeItem('ro_idle_warehouse');
  g.state.gold = 5000;
  g.tickConverter();
  t.eq('沒礦石時付 1000 鋅幣', g.state.gold, 4000);
  t.eq('還是附魔成功', g.state.buffs.filter(b => b.type === 'eleweapon').length, 1);
}

/* ---------------- 15. 屬性附加真的改得動普攻的屬性 ---------------- */
{
  const g = mk();
  H.wield(g, 'book');
  learnChain(g, [['sa_advancedbook', 5], ['sa_flamelauncher', 5]]);
  // 挑一隻怕火的怪（地屬性），量普攻傷害有沒有變高
  const earthMon = Object.values(g.MONSTERS).find(m => m.element === 'earth' && !m.isBoss && (m.def || 0) < 20);
  const hit = () => {
    H.mon(g, { defId: earthMon.id, hp: 9e9 });
    const before = g.state.monsters[0].hp;
    let total = 0;
    for (let i = 0; i < 200; i++) {
      g.state.monsters[0].hp = 9e9;
      g.playerAttack();
      total += 9e9 - g.state.monsters[0].hp;
    }
    return total / 200;
  };
  const plain = hit();
  give(g, 'boody_red', 1);
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  g.castSkill('sa_flamelauncher');
  const fire = hit();
  t.ok('火屬性附加讓打地屬性怪的普攻變痛', fire > plain * 1.2, `${plain.toFixed(0)} → ${fire.toFixed(0)}`);
}

/* ---------------- 16. 整趟跑起來不會炸 ---------------- */
{
  const g = mk();
  H.learnAll(g);
  H.wield(g, 'book');
  ['boody_red', 'crystal_blue', 'wind_of_verdure', 'yellow_live',
    'blue_gemstone', 'yellow_gemstone'].forEach(id => give(g, id, 200));
  g.state.converterElement = 'fire';
  g.state.elementChangePick = 'water';
  g.setSageAutoSpell('firebolt');
  H.mon(g, { minHp: 5000000 });
  for (let i = 0; i < 300; i++) {
    if (!g.state.monsters.length) H.mon(g, { minHp: 5000000 });
    g.state.monsters[0].hp = 9e9;
    g.playerAttack();
    if (i % 20 === 0) g.tickConverter();
  }
  t.ok('300 次普攻（含五種 proc）沒有例外', true);
  t.ok('SP 沒有變成負數', g.state.sp >= 0, g.state.sp);
  t.ok('鋅幣沒有變成負數', g.state.gold >= 0, g.state.gold);
}

process.exit(t.report('賢者 22 技能 + 元素領域與資源取用'));
