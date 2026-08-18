/* 詩人與舞孃：18 個自己的技能 + 10 個共用 BD_、互斥組、合奏減半、性別鎖（#68）。

   跑法：node tools/test_bard_dancer.js
*/
const H = require('./harness');

const t = H.tester();
const BARD = { path: ['archer', 'bard'], gender: 'male' };
const DANCER = { path: ['archer', 'dancer'], gender: 'female' };

/* ---------- 1. 職業框架 ---------- */
{
  const g = H.boot();
  H.mkChar(g, BARD);
  t.eq('職業是詩人', g.state.jobId, 'bard');
  t.eq('tier 2', g.currentJob().tier, 2);
  t.eq('父職是弓箭手', g.currentJob().parent, 'archer');
  t.eq('性別鎖 male', g.JOB_TREE.bard.genderLock, 'male');
  t.eq('舞孃性別鎖 female', g.JOB_TREE.dancer.genderLock, 'female');

  const have = new Set(g.currentJob().skills.map(s => s.id));
  const own = ['ba_musicallesson', 'frostjoke', 'ba_dissonance', 'ba_whistle',
    'ba_assassincross', 'ba_poembragi', 'ba_appleidun', 'ba_musicalstrike', 'ba_pangvoice'];
  t.ok('詩人 9 個技能到齊', own.every(id => have.has(id)), own.filter(id => !have.has(id)).join(','));
  const shared = ['bd_adaptation', 'bd_encore', 'bd_lullaby', 'bd_intoabyss', 'bd_rokisweil',
    'bd_eternalchaos', 'bd_siegfried', 'bd_richmankim', 'bd_drumbattlefield', 'bd_ringnibelungen'];
  t.ok('共用 10 個也在', shared.every(id => have.has(id)), shared.filter(id => !have.has(id)).join(','));
  const arch = g.JOB_TREE.archer.skills.map(s => s.id);
  t.ok('弓箭手的技能整份借過來', arch.every(id => have.has(id)), arch.filter(id => !have.has(id)).join(','));

  const g2 = H.boot();
  H.mkChar(g2, DANCER);
  t.eq('職業是舞孃', g2.state.jobId, 'dancer');
  const dHave = new Set(g2.currentJob().skills.map(s => s.id));
  const dOwn = ['dc_dancinglesson', 'dc_scream', 'dc_uglydance', 'dc_humming',
    'dc_dontforgetme', 'dc_fortunekiss', 'dc_serviceforyou', 'dc_throwarrow', 'dc_winkcharm'];
  t.ok('舞孃 9 個技能到齊', dOwn.every(id => dHave.has(id)), dOwn.filter(id => !dHave.has(id)).join(','));
  t.ok('共用 10 個也在（舞孃）', shared.every(id => dHave.has(id)));

  // HP/SP 表與攻速表
  t.eq('詩人有自己的 HP 表', (g.JOB_BASE_HP.bard || []).length, 100);
  t.eq('舞孃有自己的 HP 表', (g.JOB_BASE_HP.dancer || []).length, 100);
  t.eq('HP99 = 4053', g.JOB_BASE_HP.bard[98], 4053);
  t.eq('SP99 = 604', g.JOB_BASE_SP.bard[98], 604);
  t.eq('詩人舞孃 HP 表相同（官方同一組參數）',
    JSON.stringify(g.JOB_BASE_HP.bard), JSON.stringify(g.JOB_BASE_HP.dancer));
  /* 攻速表由 x_詩人_舞孃 派生成兩張（上游那列只有樂器沒有鞭子，
     照抄的話舞孃拿不動自己的武器——jobCanUseWeapon() 查的就是這張表）。 */
  t.ok('詩人查得到樂器', g.ASPD_WEAPON_BASE.bard.weapons.instrument > 0);
  t.eq('詩人沒有鞭子', g.ASPD_WEAPON_BASE.bard.weapons.whip, undefined);
  t.ok('舞孃查得到鞭子', g.ASPD_WEAPON_BASE.dancer.weapons.whip > 0);
  t.eq('舞孃沒有樂器', g.ASPD_WEAPON_BASE.dancer.weapons.instrument, undefined);
  t.eq('鞭子沿用樂器的數值（官方對稱）',
    g.ASPD_WEAPON_BASE.dancer.weapons.whip, g.ASPD_WEAPON_BASE.bard.weapons.instrument);
  t.eq('詩人拿不動鞭子', g.jobCanUseWeapon('bard', Object.keys(g.ITEMS).find(k => g.ITEMS[k].weaponCat === 'whip')), false);
  t.eq('舞孃拿得動鞭子', g.jobCanUseWeapon('dancer', Object.keys(g.ITEMS).find(k => g.ITEMS[k].weaponCat === 'whip')), true);
  t.eq('弓箭手現在有三條分支', g.JOB_TREE.archer.next.join(','), 'hunter,bard,dancer');
  t.ok('詩人舞孃已從待辦清單移除',
    !(g.JOBS_TIER2_PENDING || []).some(j => j.id === 'bard' || j.id === 'dancer'));
}

/* ---------- 2. 性別鎖 ---------- */
{
  const g = H.boot();
  H.mkChar(g, { path: ['archer'], gender: 'male' });
  g.state.jobLevel = 50; g.state.jobSkillPoints.archer = 0;
  g.recomputeDerived(true);
  t.eq('男角轉得了詩人', g.canJobChange('bard'), true);
  t.eq('男角轉不了舞孃', g.canJobChange('dancer'), false);
  t.ok('擋下時說得出理由', /只有女性/.test(g.jobChangeBlockReason('dancer') || ''),
    g.jobChangeBlockReason('dancer'));

  const g2 = H.boot();
  H.mkChar(g2, { path: ['archer'], gender: 'female' });
  g2.state.jobLevel = 50; g2.state.jobSkillPoints.archer = 0;
  g2.recomputeDerived(true);
  t.eq('女角轉得了舞孃', g2.canJobChange('dancer'), true);
  t.eq('女角轉不了詩人', g2.canJobChange('bard'), false);
  t.ok('擋下時說得出理由', /只有男性/.test(g2.jobChangeBlockReason('bard') || ''));
  // 沒有性別鎖的職業不受影響
  t.eq('獵人不看性別', g2.canJobChange('hunter'), true);
}

/* ---------- 3. 轉職自動獲得的兩個被動 ---------- */
{
  const g = H.boot();
  H.mkChar(g, BARD);
  t.eq('陣痛之聲自動獲得', g.state.learnedSkills.ba_pangvoice, 1);
  t.eq('沒有花到技能點', g.SKILLS.ba_pangvoice.autoGrant, true);
  t.eq('有進 proc 清單', (g.state.dualAilmentProcs || []).length, 1);

  const g2 = H.boot();
  H.mkChar(g2, DANCER);
  t.eq('眨眼之誘自動獲得', g2.state.learnedSkills.dc_winkcharm, 1);

  // 觸發：普攻 20%，各 50% 機率混亂／出血
  const p = g.state.dualAilmentProcs[0];
  t.eq('觸發率 20%', p.chance, 20);
  t.eq('兩種異常', p.ailments.map(a => a.type).join(','), 'confusion,bleed');
  t.eq('各 50%', p.ailments.map(a => a.chance).join(','), '50,50');
}

/* ---------- 4. 操控樂器／練習舞蹈（武器限定的被動） ---------- */
{
  const g = H.boot();
  H.mkChar(g, BARD);
  g.recomputeDerived(true);
  const sp0 = g.state.maxSp;
  // 沒拿樂器 → 只有最大SP 生效（官方那條沒有武器條件）
  H.learn(g, 'ba_musicallesson', 10);
  g.recomputeDerived(true);
  t.near('最大SP +10%', g.state.maxSp / sp0, 1.10, 0.012);
  t.eq('沒拿樂器就沒有 ATK 加成', g.state.songAspdPct, 0);
  const atkNoInst = g.state.atk;

  const inst = H.wield(g, 'instrument');
  t.ok('拿得到樂器', !!inst);
  g.recomputeDerived(true);
  t.eq('拿樂器後攻速 +10%', g.state.songAspdPct, 10);
  t.eq('生怪加速 +25%', g.state.songSpawnSpeedPct, 25);
  t.ok('ATK 也上去了', g.state.atk > atkNoInst, `${atkNoInst} → ${g.state.atk}`);

  // 舞孃版第三欄是暴擊不是攻速
  const g2 = H.boot();
  H.mkChar(g2, DANCER);
  H.wield(g2, 'whip');
  const crit0 = (g2.recomputeDerived(true), g2.state.critRate);
  H.learn(g2, 'dc_dancinglesson', 10);
  g2.recomputeDerived(true);
  t.eq('練習舞蹈給暴擊不給攻速', g2.state.songAspdPct, 0);
  t.eq('暴擊 +10', g2.state.critRate - crit0, 10);
}

/* ---------- 5. 普攻觸發的範圍被動 ---------- */
{
  const g = H.boot();
  H.mkChar(g, BARD);
  t.eq('冷笑話是被動', g.SKILLS.frostjoke.type, 'passive');
  t.eq('冷笑話 Lv5 機率 40%', g.SKILLS.frostjoke.procChance[4], 40);
  t.eq('冷笑話冰凍', g.SKILLS.frostjoke.ailment, 'freeze');
  t.eq('不諧和音 Lv5 MATK 150%', g.SKILLS.ba_dissonance.mult[4], 1.5);
  t.eq('不諧和音 20% / CD5', g.SKILLS.ba_dissonance.procChance[0] + '/' + g.SKILLS.ba_dissonance.internalCooldown[0], '20/5');

  H.learn(g, 'frostjoke', 5);
  H.learn(g, 'ba_dissonance', 5);
  g.recomputeDerived(true);
  t.eq('冷笑話進了 AoE 異常清單', (g.state.aoeAilmentProcs || []).length, 1);
  t.eq('不諧和音進了 AoE 魔法清單', (g.state.aoeMagicProcs || []).length, 1);

  /* 實際觸發：場上放幾隻怪，連續呼叫 trySongProcs，
     冷卻清掉之後應該有 40% 左右的機率讓全場中招。 */
  const mons = [];
  for (let i = 0; i < 3; i++) mons.push(H.mon(g, { size: 'medium', isBoss: false, element: 'fire' }));
  const md = g.MONSTERS[mons[0].defId];
  let froze = 0;
  for (let i = 0; i < 3000; i++) {
    g.state.songProcReadyAt = {};
    g.state.monsters.forEach(m => { m.ail = {}; m.stunnedUntil = 0; });
    g.trySongProcs(g.state.monsters[0], md);
    if (g.state.monsters.some(m => m.ail && m.ail.freeze > Date.now())) froze++;
  }
  t.near('冷笑話 Lv5 ≈40% 觸發', froze / 3000 * 100, 40, 4);

  // 冷卻：連呼叫 20 次只會中一次
  g.state.songProcReadyAt = {};
  g.state.monsters.forEach(m => { m.ail = {}; m.stunnedUntil = 0; });
  let fires = 0;
  for (let i = 0; i < 300; i++) {
    g.state.monsters.forEach(m => { m.ail = {}; m.stunnedUntil = 0; });
    g.trySongProcs(g.state.monsters[0], md);
    if (g.state.monsters.some(m => m.ail && m.ail.freeze > Date.now())) fires++;
  }
  t.eq('冷卻中只會中一次', fires, 1);

  // 舞孃的兩個：驚聲尖叫 0.5 秒、醜陋之舞 1 秒且冷卻遞減
  const g2 = H.boot();
  H.mkChar(g2, DANCER);
  t.eq('驚聲尖叫暈眩 0.5 秒', g2.SKILLS.dc_scream.ailSec[0], 0.5);
  t.eq('醜陋之舞暈眩 1 秒', g2.SKILLS.dc_uglydance.ailSec[0], 1);
  t.eq('醜陋之舞冷卻 10→5', g2.SKILLS.dc_uglydance.internalCooldown.join(','), '10,9,8,7,5');
  H.learn(g2, 'dc_scream', 5);
  H.learn(g2, 'dc_uglydance', 5);
  g2.recomputeDerived(true);
  t.eq('兩個都進清單、各自獨立', (g2.state.aoeAilmentProcs || []).length, 2);
  t.eq('冷卻各記各的', g2.state.aoeAilmentProcs.map(p => p.cdSec).join(','), '5,5');
}

/* ---------- 6. 演奏／舞蹈技能：互斥組 ---------- */
{
  const g = H.boot();
  H.mkChar(g, BARD);
  H.wield(g, 'instrument');
  ['ba_whistle', 'ba_assassincross', 'ba_poembragi', 'ba_appleidun'].forEach(id => H.learn(g, id, 10));
  g.recomputeDerived(true);

  const cast = (id) => { g.state.cooldowns = {}; g.state.sp = g.state.maxSp; return g.castSkill(id, { forceLv: 10 }); };
  t.eq('吹口哨放得出來', cast('ba_whistle'), true);
  t.eq('推了 2 個 buff（迴避＋完全迴避）',
    g.state.buffs.filter(b => b.skillId === 'ba_whistle').length, 2);
  t.eq('迴避 +40', g.buffMult('flee').flatBonus, 40);
  t.eq('完全迴避 +5', g.buffMult('perfectdodge').flatBonus, 5);

  // 換一首 → 上一首整組撤掉
  t.eq('刺客的黃昏放得出來', cast('ba_assassincross'), true);
  t.eq('吹口哨的 buff 全撤了', g.state.buffs.filter(b => b.skillId === 'ba_whistle').length, 0);
  t.eq('迴避回到 0', g.buffMult('flee').flatBonus, 0);
  t.ok('攻速 buff 在', g.state.buffs.some(b => b.skillId === 'ba_assassincross' && b.type === 'aspd'));
  t.eq('同時只有一首歌', g.state.buffs.filter(b => b.exclusiveGroup === 'song').length, 1);

  // 布萊奇之詩：技能冷卻 −30%
  cast('ba_poembragi');
  t.eq('冷卻 buff 記 30', g.buffMult('skillcd').flatBonus, 30);
  const base = g.effectiveCooldownMs('heal', 10);
  t.near('冷卻縮短 30%', base, 10000 * 0.7, 1);

  // 伊登的蘋果：最大HP% 與治癒受量
  g.state.buffs = []; g.recomputeDerived(true);
  const hp0 = g.state.maxHp;
  cast('ba_appleidun');
  g.recomputeDerived(false);
  t.near('最大HP +20%', g.state.maxHp / hp0, 1.20, 0.01);
  t.near('治癒受量 ×1.20', g.healOutputMult(), 1.20, 0.001);
  g.state.buffs = []; g.recomputeDerived(false);
  t.eq('buff 結束後最大HP 回復', g.state.maxHp, hp0);
}

/* ---------- 7. 舞蹈技能：暴擊傷害／SP 消耗／勿忘我 ---------- */
{
  const g = H.boot();
  H.mkChar(g, DANCER);
  H.wield(g, 'whip');
  ['dc_humming', 'dc_fortunekiss', 'dc_serviceforyou', 'dc_dontforgetme'].forEach(id => H.learn(g, id, 10));
  g.recomputeDerived(true);
  const cast = (id) => { g.state.cooldowns = {}; g.state.sp = g.state.maxSp; return g.castSkill(id, { forceLv: 10 }); };

  const hit0 = g.effectiveHitWithBuff();
  cast('dc_humming');
  t.eq('命中 +40', g.effectiveHitWithBuff() - hit0, 40);

  cast('dc_fortunekiss');
  g.recomputeDerived(false);
  t.eq('暴擊 buff +10', g.buffMult('crit').flatBonus, 10);
  t.eq('暴擊傷害併進 cardCritDmgPct', g.state.cardCritDmgPct, 20);

  cast('dc_serviceforyou');
  g.recomputeDerived(false);
  t.eq('SP消耗 buff 是負的 15', g.buffMult('spcost').flatBonus, -15);
  const heal = g.SKILLS.heal;
  t.eq('治癒術 Lv10 的 SP 從 30 降到 26', g.skillSpCost(heal, 10), 26);

  // 勿忘我：對怪減攻速，而且新生的怪也吃得到
  const mons = [];
  for (let i = 0; i < 3; i++) mons.push(H.mon(g, { size: 'medium', isBoss: false }));
  cast('dc_dontforgetme');
  t.ok('場上的怪都被拖慢', g.state.monsters.every(m => m.debuffAspd < 1),
    g.state.monsters.map(m => m.debuffAspd).join(','));
  t.near('Lv10 是 −30%', g.state.monsters[0].debuffAspd, 0.7, 0.001);
  t.near('monDebuffAspd 讀得到', g.monDebuffAspd(g.state.monsters[0]), 0.7, 0.001);

  const fresh = { defId: g.state.monsters[0].defId, hp: 100, maxHp: 100, id: 99999 };
  g.applyDontForgetMe(fresh);
  t.near('期間新生的怪也被拖慢', fresh.debuffAspd, 0.7, 0.001);

  // 過期後自己清掉
  g.state.monsters[0].debuffAspdEnd = Date.now() - 1;
  t.eq('過期回到 1', g.monDebuffAspd(g.state.monsters[0]), 1);
  t.eq('欄位也清掉了', g.state.monsters[0].debuffAspd, undefined);

  // 勿忘我也算演奏技能，跟其他舞蹈技互斥
  t.eq('同時只有一首舞', g.state.buffs.filter(b => b.exclusiveGroup === 'song').length, 1);
}

/* ---------- 8. 合奏：單人減半 + 只能開一個 + 跟演奏技能不互斥 ---------- */
{
  const g = H.boot();
  H.mkChar(g, BARD);
  H.wield(g, 'instrument');
  ['bd_siegfried', 'bd_richmankim', 'bd_drumbattlefield', 'ba_whistle', 'bd_adaptation'].forEach(id => H.learn(g, id, 10));
  g.recomputeDerived(true);
  const cast = (id, lv) => { g.state.cooldowns = {}; g.state.sp = g.state.maxSp; return g.castSkill(id, { forceLv: lv || 5 }); };

  // 經驗值倍增：官方 Lv5 +60%，單人只有一半 → +30%
  t.eq('資料寫的是官方值 60', g.SKILLS.bd_richmankim.expPct[4], 60);
  t.eq('soloMult 0.5', g.SKILLS.bd_richmankim.soloMult, 0.5);
  cast('bd_richmankim', 5);
  t.eq('單人只有一半 → +30%', g.buffMult('exp').flatBonus, 30);

  // 只能開一個合奏
  cast('bd_drumbattlefield', 5);
  t.eq('經驗值倍增被換掉了', g.buffMult('exp').flatBonus, 0);
  t.eq('同時只有一個合奏', new Set(g.state.buffs.filter(b => b.exclusiveGroup === 'ensemble').map(b => b.skillId)).size, 1);
  g.recomputeDerived(false);
  t.eq('戰鼓震天 ATK 單人一半（官方 40 → 20）', g.buffMult('atkflat').flatBonus, 20);
  t.eq('DEF 單人一半（官方 75 → 37.5）', g.buffMult('defflat').flatBonus, 37.5);

  /* **合奏與演奏技能不互斥**——使用者 2026-08-09 指定：
     可以同時開一個合奏 + 一個專用技能。 */
  cast('ba_whistle', 10);
  t.eq('合奏還在', new Set(g.state.buffs.filter(b => b.exclusiveGroup === 'ensemble').map(b => b.skillId)).size, 1);
  t.eq('演奏技能也在', new Set(g.state.buffs.filter(b => b.exclusiveGroup === 'song').map(b => b.skillId)).size, 1);
  t.eq('迴避 +40 有生效', g.buffMult('flee').flatBonus, 40);

  // 臨機應變是第三組，兩邊都不擠掉
  cast('bd_adaptation', 1);
  t.eq('合奏仍在', new Set(g.state.buffs.filter(b => b.exclusiveGroup === 'ensemble').map(b => b.skillId)).size, 1);
  t.eq('演奏仍在', new Set(g.state.buffs.filter(b => b.exclusiveGroup === 'song').map(b => b.skillId)).size, 1);
  t.eq('SP消耗 −20%', g.buffMult('spcost').flatBonus, -20);

  // 不死神齊格弗里德：四屬性耐性 + 異常抗性，都併進既有的桶
  g.state.buffs = []; g.recomputeDerived(true);
  cast('bd_siegfried', 5);
  g.recomputeDerived(false);
  t.near('地屬性減傷 7.5%（官方 15 的一半）', g.state.cardEleDmgReduce.earth || 0, 0.075, 0.001);
  ['water', 'fire', 'wind'].forEach(e =>
    t.near(e + ' 也有', g.state.cardEleDmgReduce[e] || 0, 0.075, 0.001));
  t.eq('聖屬性沒被波及', g.state.cardEleDmgReduce.holy || 0, 0);
  t.eq('異常抗性 12.5%（官方 25 的一半）', g.state.ailResist.stun, 12.5);
  g.state.buffs = []; g.recomputeDerived(true);
  t.eq('buff 結束後屬性耐性歸零', g.state.cardEleDmgReduce.earth || 0, 0);
  t.eq('buff 結束後異常抗性歸零', g.state.ailResist.stun || 0, 0);
}

/* ---------- 9. 安可：重放上一首，半價 ---------- */
{
  const g = H.boot();
  H.mkChar(g, BARD);
  H.wield(g, 'instrument');
  H.learn(g, 'ba_whistle', 10);
  H.learn(g, 'bd_encore', 1);
  g.recomputeDerived(true);

  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('還沒演奏過的話安可沒東西放', g.castSkill('bd_encore'), true);
  t.eq('沒有推出任何 buff', g.state.buffs.length, 0);

  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('ba_whistle', { forceLv: 10 });
  t.eq('記住了上一首', g.state.lastSongSkillId, 'ba_whistle');
  g.state.buffs = [];
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  const spBefore = g.state.sp;
  g.castSkill('bd_encore');
  const whistleCost = g.skillSpCost(g.SKILLS.ba_whistle, 10);
  const encoreCost = g.skillSpCost(g.SKILLS.bd_encore, 1);
  t.eq('只花安可本身 + 一半的目標 SP', spBefore - g.state.sp, encoreCost + Math.floor(whistleCost / 2));
  t.eq('曲子真的重放了', g.state.buffs.filter(b => b.skillId === 'ba_whistle').length, 2);
}

/* ---------- 10. 樂器攻擊／纏箭投擲：消耗箭矢 ---------- */
{
  const g = H.boot();
  H.mkChar(g, BARD);
  H.wield(g, 'instrument');
  H.learn(g, 'ba_musicalstrike', 5);
  H.mon(g, { size: 'medium', isBoss: false });
  g.state.hit = 100000;
  g.recomputeDerived(true);

  t.eq('是多段技', g.SKILLS.ba_musicalstrike.type, 'damage_multi');
  t.eq('2 段', g.SKILLS.ba_musicalstrike.hits[0], 2);
  t.eq('消耗 1 枝箭', g.SKILLS.ba_musicalstrike.consumeAmmo, 1);

  // 沒箭 → 放不出來
  g.state.equip.ammo = null;
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('沒箭放不出來', g.castSkill('ba_musicalstrike'), false);
  t.eq('放不出來就不扣 SP', g.state.sp, g.state.maxSp);

  // 有箭 → 放得出來並且真的扣掉一枝
  const arrow = Object.keys(g.ITEMS).find(k => g.isAmmoItem(k));
  t.ok('找得到箭矢', !!arrow);
  g.addItem(arrow, 50);
  g.equipAmmo(arrow);
  const before = g.getAmmoCount();
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('有箭就放得出來', g.castSkill('ba_musicalstrike'), true);
  t.eq('扣掉一枝箭', before - g.getAmmoCount(), 1);
}

process.exit(t.report('詩人與舞孃 18+10 技能 + 互斥組與合奏'));
