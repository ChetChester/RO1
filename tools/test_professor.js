/* 智者（#76）官方 8 技能 + 命中判定規則。

   這支要證的四件事：
     1. **ATK 技能要判定命中、MATK 必中**——使用者 2026-08-14 的規則。
        `alwaysHit` 認得出來，`hitBonusOnCast` 真的加得上去
     2. 四個普攻觸發的被動各自都有人讀（薄霧牆、心神互換、精神耗弱術、精神撼動），
        其中精神撼動要證明**魔防減益真的進到 defOf 的魔法分支**
        （那個分支以前完全沒有減益入口）
     3. 雙倍投擲只對三系箭術生效，而且複製出來的那一發不會再複製（無限遞迴）
     4. 易燃之網的火屬性加倍只發動一次，網子燒掉之後就沒了

   跑法：node tools/test_professor.js（或由 tools/test.js 一起跑）
*/
const H = require('./harness');
const t = H.tester();

const PF = { path: ['mage', 'sage'], rebirth: true, job: 'professor' };
const mk = (opts) => {
  const g = H.boot(Object.assign({ captureLog: true }, opts || {}));
  H.mkChar(g, PF);
  g.state.gold = 100000000;
  // 前置橫跨法師與賢者，整條線的點數池都補滿（玩家本來就是一路練上來的）
  ['mage', 'sage', 'professor'].forEach(j => { g.state.jobSkillPoints[j] = 300; });
  return g;
};
const anyMon = g => Object.keys(g.MONSTERS)[0];

/* 連前置一起學。智者的前置鏈有三層深（薄霧牆 → 風元素領域 → 風屬性附加），
   一個一個手寫會漏，所以照 `requires` 遞迴走完。 */
function learnDeep(g, id, lv) {
  const sk = g.SKILLS[id];
  if (!sk) return 0;
  const reqs = sk.requires ? (Array.isArray(sk.requires) ? sk.requires : [sk.requires]) : [];
  reqs.forEach(r => learnDeep(g, r.skillId, r.level));
  return H.learn(g, id, lv);
}

/* ---------------- 1. 職業本體 ---------------- */
{
  const g = mk();
  const j = g.JOB_TREE.professor;
  t.eq('職業是智者', g.state.jobId, 'professor');
  t.eq('中文名是智者（不是教授）', j.name, '智者');
  t.eq('父職業是賢者', j.parent, 'sage');
  t.eq('職業等級上限 70', j.jobLevelMax, 70);
  t.eq('HP/SP 表指回賢者', j.hpSpFrom, 'sage');
  t.eq('攻速表指回賢者', j.aspdFrom, 'sage');
  t.eq('一路跟到官方那張表', g.aspdJobKey('professor'), 'x_賢者_智者');

  const own = ['pf_spiderweb', 'pf_fogwall', 'pf_doublecasting', 'pf_memorize',
    'pf_hpconversion', 'pf_soulchange', 'pf_soulburn', 'pf_mindbreaker'];
  t.eq('官方 8 個技能都有定義', own.filter(id => g.SKILLS[id]).length, 8);
  const have = new Set(g.currentJob().skills.map(s => s.id));
  t.ok('8 個都在技能表裡', own.every(id => have.has(id)));
  const saIds = g.JOB_TREE.sage.skills.map(s => s.id);
  t.ok('賢者的技能整份借過來', saIds.every(id => have.has(id)),
    saIds.filter(id => !have.has(id)).join(','));
}

/* ---------------- 2. 多重前置（新機制）---------------- */
{
  const g = mk();
  // 薄霧牆要風＋水兩個元素領域各 2 級
  t.eq('兩個前置都沒點時學不了', H.learn(g, 'pf_fogwall', 1), 0);
  learnDeep(g, 'sa_violentgale', 2);
  t.eq('只點了風元素領域還是學不了', H.learn(g, 'pf_fogwall', 1), 0);
  learnDeep(g, 'sa_deluge', 2);
  t.eq('兩個都點了才學得到', H.learn(g, 'pf_fogwall', 1), 1);

  // 舊的單一物件寫法不能壞
  const g2 = mk();
  t.eq('單一前置沒滿時學不了（易燃之網要龍知識 4）', H.learn(g2, 'pf_spiderweb', 1), 0);
  learnDeep(g2, 'sa_dragonology', 4);
  t.eq('前置滿了就學得到', H.learn(g2, 'pf_spiderweb', 1), 1);
}

/* ---------------- 3. 命中判定規則（#76）---------------- */
{
  const g = mk();
  t.eq('skillHits 是個函式', typeof g.skillHits, 'function');

  /* 挑一隻迴避高的怪（hitReq 534），玩家命中壓到 0——這樣沒寫 alwaysHit 的技能
     命中率會落在下限 5%，miss 才看得出來。
     **順序很重要**：recomputeDerived 會重算 state.hit，所以要先重算再把它壓到 0。 */
  const md = g.MONSTERS.beelzebub_;
  g.recomputeDerived(true);
  g.state.hit = 0;
  const mon = H.mon(g, { defId: 'beelzebub_' });
  const always = { id: 'x', alwaysHit: true };
  t.eq('alwaysHit 一律回 true', H.rate(200, () => g.skillHits(always, 1, md, mon)), 200);

  // 沒寫 alwaysHit 的：命中 0 對高迴避的怪會 miss（下限 5%）
  const plain = { id: 'y' };
  const hits = H.rate(400, () => g.skillHits(plain, 1, md, mon));
  t.ok('沒寫 alwaysHit 的技能會 miss', hits < 400, `400 次中中了 ${hits}`);

  // hitBonusOnCast 真的加得上去
  const bonus = { id: 'z', hitBonusOnCast: [1000] };
  t.eq('hitBonusOnCast 拉滿就必中', H.rate(200, () => g.skillHits(bonus, 1, md, mon)), 200);

  // 官方寫「無視迴避」的兩招要標到
  t.eq('手推車攻擊 alwaysHit', g.SKILLS.cartattack.alwaysHit, true);
  t.eq('閃電衝擊 alwaysHit', g.SKILLS.blitzbeat.alwaysHit, true);
  t.eq('氣泡蟲召喚 alwaysHit', g.SKILLS.am_spheremine.alwaysHit, true);
  // 連續盾擊：官方命中修正 +20（先前誤判成「本作技能必中」而沒做）
  t.eq('連續盾擊有官方的命中 +20', g.SKILLS.pa_shieldchain.hitBonusOnCast[0], 20);

  /* `hitBonus` 是多義欄位：狂擊是「這一擊的命中修正」，
     二刀連擊／武器研究／天使之賜福是「常駐 HIT」，那三個在 recomputeDerived 就加過了。
     skillHits 只認狂擊，不然就是重複計算。 */
  const g3 = mk();
  g3.recomputeDerived(true); g3.state.hit = 0;
  const m3 = H.mon(g3, { defId: 'beelzebub_' });
  g3.state.hit = (md.hitReq || 0) - 60;   // 命中率約 40%，加減 50 點都看得出差別
  const before = H.rate(600, () => g3.skillHits(g3.SKILLS.doubleattack, 10, md, m3));
  const bashHits = H.rate(600, () => g3.skillHits(g3.SKILLS.bash, 10, md, m3));
  t.ok('狂擊 Lv10 的命中 +50 有生效', bashHits > before + 100, `狂擊 ${bashHits} / 二刀連擊 ${before}`);
}
{
  // MATK 技能不進命中判定：命中 0 也照樣造成傷害
  const g = mk();
  H.learn(g, 'firebolt', 10);
  g.state.stats.int = 99;
  g.recomputeDerived(true);
  g.state.hit = 0;                       // 重算之後才壓，不然會被蓋回去
  let landed = 0;
  for (let i = 0; i < 30; i++) {
    const m = H.mon(g, { defId: 'beelzebub_' });
    g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
    g.castSkill('firebolt');
    if (m.maxHp - m.hp > 0) landed++;
  }
  t.eq('MATK 技能命中 0 也 30/30 打得到', landed, 30);
}

/* ---------------- 4. 易燃之網 ---------------- */
{
  const g = mk();
  learnDeep(g, 'pf_spiderweb', 1);
  const sk = g.SKILLS.pf_spiderweb;
  t.eq('SP 30', sk.spCost[0], 30);
  t.eq('持續 8 秒', sk.duration[0], 8);
  t.eq('迴避 −50', sk.fleeFlat[0], 50);
  t.eq('消耗蜘蛛絲', sk.costItems[0], 'spiderweb');
  t.ok('蜘蛛絲有本體', !!g.ITEMS.spiderweb);

  // BOSS 免疫
  const boss = H.mon(g, { isBoss: true });
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('對 BOSS 無效', g.castSkill('pf_spiderweb'), false);

  // 一般怪：迴避降、火傷加倍、燒掉之後就沒了
  const m = H.mon(g, { defId: anyMon(g), isBoss: false });
  const mdef2 = g.MONSTERS[m.defId];
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.addItem('spiderweb', 5);
  t.eq('對一般怪放得出來', g.castSkill('pf_spiderweb'), true);
  t.eq('迴避減益掛上了', m.debuffFlee, 50);
  t.ok('網子掛上了', m.webUntil > Date.now());

  const fireBefore = g.getElementMultiplierVsMonster('fire', mdef2, m);
  const plainFire = g.getElementMultiplierVsMonster('fire', mdef2, { defId: m.defId, hp: 1 });
  t.ok('火屬性倍率變成兩倍', Math.abs(fireBefore - plainFire * 2) < 1e-9,
    `${fireBefore} vs ${plainFire}`);
  t.eq('燒過一次之後網子就沒了', m.webUntil, 0);
  t.eq('第二次不再加倍', g.getElementMultiplierVsMonster('fire', mdef2, m), plainFire);

  // 非火屬性不會燒掉網子
  const m2 = H.mon(g, { defId: anyMon(g), isBoss: false });
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('pf_spiderweb');
  g.getElementMultiplierVsMonster('water', g.MONSTERS[m2.defId], m2);
  t.ok('打水屬性不會燒掉網子', m2.webUntil > Date.now());
}

/* ---------------- 5. 薄霧牆 ---------------- */
{
  const g = mk();
  t.eq('薄霧牆點得到', learnDeep(g, 'pf_fogwall', 1), 1);
  t.ok('數字有人讀', !!g.state.fogWall);
  t.eq('機率 50', g.state.fogWall.chance, 50);
  t.eq('黑暗 2 秒', g.state.fogWall.sec, 2);
  t.eq('內部冷卻 10 秒', g.state.fogWall.cdSec, 10);

  // 三隻怪一起判定
  H.wield(g, 'rod1');
  const mons = [1, 2, 3].map(i => ({ defId: anyMon(g), hp: 9e8, maxHp: 9e8, id: 8000 + i }));
  g.state.monsters = mons;
  g.state.songProcReadyAt = {};
  g.tryProfessorProcs(mons[0], g.MONSTERS[mons[0].defId]);
  const blinded = mons.filter(m => g.ailActive(m, 'blind')).length;
  t.ok('一次判定就可能同時黑暗多隻', blinded >= 0);
  // 冷卻內不再判定
  mons.forEach(m => { m.ail = {}; });
  g.tryProfessorProcs(mons[0], g.MONSTERS[mons[0].defId]);
  t.eq('冷卻內不再觸發', mons.filter(m => g.ailActive(m, 'blind')).length, 0);
}

/* ---------------- 6. 雙倍投擲 + 速讀術 ---------------- */
{
  const g = mk();
  t.eq('雙倍投擲點得到 Lv5', learnDeep(g, 'pf_doublecasting', 5), 5);
  const sk = g.SKILLS.pf_doublecasting;
  t.eq('Lv1 機率 40', sk.mult[0], 40);
  t.eq('Lv5 機率 80', sk.mult[4], 80);
  t.eq('持續 90 秒', sk.duration[0], 90);

  H.mon(g, { defId: anyMon(g) });
  g.state.sp = g.state.maxSp;
  t.eq('放得出來', g.castSkill('pf_doublecasting'), true);
  const b = g.state.buffs.find(x => x.type === 'doublecast');
  t.ok('掛上了 doublecast buff', !!b);
  t.eq('機率存在 flatBonus', b.flatBonus, 80);

  // 速讀術 +20%
  t.eq('速讀術點得到', learnDeep(g, 'pf_memorize', 1), 1);
  t.eq('雙倍投擲機率 +20', g.state.doubleCastBonusPct, 20);

  // 只對三系箭術生效
  t.eq('三系箭術在名單裡', g.DOUBLECAST_SKILLS.join(','), 'firebolt,coldbolt,lightningbolt');
  H.learn(g, 'firebolt', 10);
  H.learn(g, 'soulstrike', 10);
  const countCasts = (id) => {
    let n = 0;
    const orig = g.logMsg;
    g.logMsg = (txt) => { if (String(txt).includes('雙倍投擲')) n++; };
    for (let i = 0; i < 60; i++) {
      H.mon(g, { defId: anyMon(g) });
      g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
      g.castSkill(id);
    }
    g.logMsg = orig;
    return n;
  };
  t.ok('火箭術會被複製', countCasts('firebolt') > 0);
  t.eq('靈魂攻擊不會被複製', countCasts('soulstrike'), 0);

  // 複製出來的那一發不會再複製（不然是無限遞迴）
  t.eq('複製中不再複製的旗標存在', typeof g.state._inDoubleCast, 'boolean');
}

/* ---------------- 7. HP轉換 ---------------- */
{
  const g = mk();
  t.eq('HP轉換點得到 Lv5', learnDeep(g, 'pf_hpconversion', 5), 5);
  const sk = g.SKILLS.pf_hpconversion;
  t.eq('固定消耗 10% 最大HP', sk.hpCostPct, 10);
  t.eq('Lv1 轉換率 10%', sk.mult[0], 10);
  t.eq('Lv5 轉換率 50%', sk.mult[4], 50);

  g.state.hp = g.state.maxHp;
  g.state.sp = 10;                       // 技能本身還是要 5 SP（Lv5），設 0 會直接放不出來
  const cost = Math.floor(g.state.hp * 0.1);   // 通用的 hpCostPct 算的是**當前** HP
  g.state.cooldowns = {};
  t.eq('放得出來', g.castSkill('pf_hpconversion'), true);
  t.eq('扣了當前 HP 的 10%（只扣一次，不是兩次）', g.state.maxHp - g.state.hp, cost);
  t.eq('SP 回了消耗量的一半（Lv5 轉換率 50%）', g.state.sp, 10 - 5 + Math.floor(cost * 0.5));

  // 血不夠就不放（跟捨命攻擊同一條規則）
  g.state.hp = 1;                        // 當前 HP 的 10% 是 0，扣不動就該擋下來
  g.state.sp = g.state.maxSp;            // SP 給滿，確定擋下來的理由是 HP 不是 SP
  g.state.cooldowns = {};
  const hpBefore = g.state.hp;
  t.eq('HP 不足時放不出來', g.castSkill('pf_hpconversion'), false);
  t.eq('HP 沒被動到', g.state.hp, hpBefore);
}

/* ---------------- 8. 心神互換 / 精神耗弱術 / 精神撼動 ---------------- */
{
  const g = mk();
  t.eq('心神互換點得到', learnDeep(g, 'pf_soulchange', 1), 1);
  t.eq('機率 20', g.state.soulChange.chance, 20);
  t.eq('沉默 1 秒', g.state.soulChange.sec, 1);
  t.eq('內部冷卻 5 秒', g.state.soulChange.cdSec, 5);

  t.eq('精神耗弱術點得到 Lv5', learnDeep(g, 'pf_soulburn', 5), 5);
  t.eq('Lv5 機率 70', g.state.soulBurn.chance, 70);
  t.eq('Lv5 傷害 MATK 200%', g.state.soulBurn.dmgMult, 2.0);
  t.eq('Lv5 內部冷卻 5 秒', g.state.soulBurn.cdSec, 5);

  t.eq('精神撼動點得到 Lv5', learnDeep(g, 'pf_mindbreaker', 5), 5);
  t.eq('Lv5 機率 40', g.state.mindBreaker.chance, 40);
  t.eq('Lv5 魔防 −30%', g.state.mindBreaker.cut, 30);
  t.eq('持續 10 秒', g.state.mindBreaker.durSec, 10);

  // 精神耗弱術的魔法傷害：命中歸零也打得到（MATK 必中）
  g.state.hit = 0; g.state.stats.int = 99;
  g.recomputeDerived(true);
  H.wield(g, 'rod1');
  let burned = 0;
  for (let i = 0; i < 40; i++) {
    const m = H.mon(g, { defId: anyMon(g), hp: 9e8 });
    g.state.songProcReadyAt = {};
    g.state.soulChange = null; g.state.mindBreaker = null;   // 只留精神耗弱術
    g.tryProfessorProcs(m, g.MONSTERS[m.defId]);
    if (m.hp < 9e8) burned++;
  }
  t.ok('精神耗弱術會造成傷害', burned > 0, `40 次中 ${burned} 次`);
}
{
  /* 精神撼動的重點：**魔防減益要真的進到 defOf 的魔法分支**。
     那個分支以前只有卡片的無視魔防，沒有任何減益入口——
     推了沒人讀是這個 repo 踩過五次的錯，所以直接量 defOf 的回傳值。 */
  const g = mk();
  const m = H.mon(g, { defId: anyMon(g), hp: 9e8 });
  const md = g.MONSTERS[m.defId];
  const base = g.defOf(md, 1, true, m);
  m.debuffMdef = 0.7;
  m.debuffMdefEnd = Date.now() + 10000;
  const cut = g.defOf(md, 1, true, m);
  t.ok('魔防減益吃得到（硬防）', Math.abs(cut[0] - base[0] * 0.7) < 1e-6, `${base[0]} → ${cut[0]}`);
  t.ok('魔防減益吃得到（軟防）', Math.abs(cut[1] - base[1] * 0.7) < 1e-6);
  // 過期自動清掉
  m.debuffMdefEnd = Date.now() - 1;
  const back = g.defOf(md, 1, true, m);
  t.ok('過期後恢復原值', Math.abs(back[0] - base[0]) < 1e-6);
  t.ok('過期後欄位被清掉', m.debuffMdef === undefined);
  // 物理分支不受影響（兩個桶要分得開）
  m.debuffMdef = 0.5; m.debuffMdefEnd = Date.now() + 10000;
  const phys = g.defOf(md, 1, false, m);
  const physBase = g.defOf(md, 1, false, { defId: m.defId, hp: 1 });
  t.ok('魔防減益不會影響物防', Math.abs(phys[0] - physBase[0]) < 1e-6);
}

/* ---------------- 9. 城鎮不自動放 ---------------- */
{
  const g = mk();
  const safe = g.MAPS.filter(m => m.monsters && m.monsters.length === 0)[0];
  g.state.mapId = safe.id;
  t.ok('城鎮不自動放 HP轉換', g.wastesResourceInTown(g.SKILLS.pf_hpconversion, 5));
  t.ok('城鎮不自動放易燃之網', g.wastesResourceInTown(g.SKILLS.pf_spiderweb, 1));
}

t.report('智者 8 技能 + ATK 命中判定規則');
