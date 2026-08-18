/* 狙擊之王 4 個技能 + 職業樹擋轉職的理由（#61）。

   跑法：node tools/test_sniper.js
*/
const H = require('./harness');

const t = H.tester();
const SN = { path: ['archer', 'hunter'], rebirth: true, job: 'sniper' };

/* ---------- 1. 職業框架 ---------- */
{
  const g = H.boot();
  H.mkChar(g, SN);
  t.eq('職業是狙擊之王', g.state.jobId, 'sniper');
  const have = new Set(g.currentJob().skills.map(s => s.id));
  const own = ['sn_windwalk', 'sn_sharpshooting', 'sn_sight', 'sn_falconassault'];
  t.ok('官方 4 個技能到齊', own.every(id => have.has(id)));
  const htIds = g.JOB_TREE.hunter.skills.map(s => s.id);
  t.ok('獵人的技能整份借過來', htIds.every(id => have.has(id)),
    htIds.filter(id => !have.has(id)).join(','));
}

/* ---------- 2. 風之步（生怪加速 + 迴避）---------- */
{
  const g = H.boot();
  H.mkChar(g, SN);
  H.wield(g, 'bow');
  H.learn(g, 'sn_windwalk');
  // 迴避的 buff 是在 effectiveFleeWithBuff() 收的，不寫回 state.flee（#24）
  const flee0 = g.effectiveFleeWithBuff();
  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('sn_windwalk', { free: true, forceLv: 10 });
  const bs = g.state.buffs.filter(b => b.skillId === 'sn_windwalk');
  t.eq('推了兩個 buff', bs.length, 2);
  t.near('生怪速度 ×1.20', g.buffMult('spawnspeed').mult, 1.20, 0.001);
  t.eq('迴避 +5', g.effectiveFleeWithBuff() - flee0, 5);
  t.eq('持續 400 秒', bs[0].msRemaining, 400000);

  // 跟手推車加速／月夜貓走同一個維度 → 相乘
  g.state.buffs.push({ type: 'spawnspeed', mult: 1.2, msRemaining: 60000, skillId: 'ws_cartboost' });
  t.near('兩個生怪加速相乘', g.buffMult('spawnspeed').mult, 1.44, 0.001);
}

/* ---------- 3. 銳利射擊（範圍技的暴擊）---------- */
{
  const g = H.boot();
  H.mkChar(g, SN);
  H.wield(g, 'bow');
  H.learn(g, 'sn_sharpshooting');
  const sk = g.SKILLS.sn_sharpshooting;
  t.eq('Lv5 是 ATK 1800%', sk.mult[4], 18);
  t.eq('暴擊率 +50（加法）', sk.critRateFlat, 50);
  t.eq('暴擊加成減半', sk.critDmgMult, 0.5);

  // 打全場
  const mkThree = () => {
    const ids = Object.keys(g.MONSTERS).filter(k => !g.MONSTERS[k].isBoss && g.MONSTERS[k].level < 30).slice(0, 3);
    g.state.monsters = ids.map(id => {
      g.state.monsterIdCounter = (g.state.monsterIdCounter || 0) + 1;
      return { defId: id, hp: 9e9, maxHp: 9e9, id: g.state.monsterIdCounter };
    });
    return g.state.monsters;
  };
  const ms = mkThree();
  g.state.sp = g.state.maxSp; g.state.hit = 100000; g.state.cooldowns = {};
  g.castSkill('sn_sharpshooting', { free: true, forceLv: 5 });
  t.eq('三隻都吃到', ms.filter(m => m.hp < m.maxHp).length, 3);

  /* 暴擊率 = 自己的暴擊率 + 50（加法）。用平均傷害反推：
       critRate 0   → 期望暴擊率 50%  → 平均 ×(1 + 0.5×0.25) = 1.125
       critRate 50  → 期望暴擊率 100% → 平均 ×1.25 */
  const meanDmg = (cr, n) => {
    let sum = 0, cnt = 0;
    for (let i = 0; i < n; i++) {
      const mm = mkThree();
      g.state.sp = g.state.maxSp; g.state.hit = 100000; g.state.critRate = cr;
      const hp0 = mm[0].hp;
      g.castSkill('sn_sharpshooting', { free: true, forceLv: 5 });
      const d = hp0 - mm[0].hp;
      if (d > 0) { sum += d; cnt++; }
    }
    return sum / cnt;
  };
  const saved = sk.critRateFlat;
  delete sk.critRateFlat;
  const base = meanDmg(0, 1500);            // 完全不暴擊
  sk.critRateFlat = saved;
  const half = meanDmg(0, 1500);            // 0 + 50 = 50%
  const full = meanDmg(50, 1500);           // 50 + 50 = 100%
  t.near('暴擊率 50% 時平均 ×1.125', half / base, 1.125, 0.02);
  t.near('暴擊率 100% 時平均 ×1.25', full / base, 1.25, 0.02);

  // 依基本等級遞增
  const atLv = (bl) => {
    g.state.baseLevel = bl; g.recomputeDerived(true);
    let sum = 0;
    for (let i = 0; i < 400; i++) {
      const mm = mkThree();
      g.state.sp = g.state.maxSp; g.state.hit = 100000; g.state.critRate = 0;
      const hp0 = mm[0].hp;
      g.castSkill('sn_sharpshooting', { free: true, forceLv: 5 });
      sum += hp0 - mm[0].hp;
    }
    return sum / 400;
  };
  delete sk.critRateFlat;
  const lo = atLv(1), hi = atLv(99);
  sk.critRateFlat = saved;
  t.ok('基本等級越高傷害越高', hi > lo * 1.2, `Lv1 ${Math.round(lo)} → Lv99 ${Math.round(hi)}`);
}

/* ---------- 4. 狙殺瞄準（全素質 buff）---------- */
{
  const g = H.boot();
  H.mkChar(g, SN);
  H.wield(g, 'bow');
  H.learn(g, 'sn_sight');
  const before = {};
  g.BASE_STAT_KEYS.forEach(k => { before[k] = g.state._statBreakdown[k].total; });
  // 命中同理，buff 是在 effectiveHitWithBuff() 收的
  const b0 = { atk: g.state.atk, crit: g.state.critRate, hit: g.effectiveHitWithBuff() };

  g.state.buffs = []; g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  g.castSkill('sn_sight', { free: true, forceLv: 10 });
  const bs = g.state.buffs.filter(b => b.skillId === 'sn_sight');
  t.eq('一次推四個 buff', bs.length, 4);
  t.eq('持續 30 秒', bs[0].msRemaining, 30000);

  /* 全素質 +5——**六個都要動**。VIT 以前完全沒接 buff 的固定加成，
     這條斷言就是為了鎖住那個修正。 */
  const miss = g.BASE_STAT_KEYS.filter(k => g.state._statBreakdown[k].total - before[k] !== 5);
  t.eq('六個素質都 +5', miss.join(','), '');
  // +30 是技能給的，另外 +5 是全素質的 DEX 換算過來的（HIT 每點 DEX +1）
  t.near('命中 +35（技能 30 ＋ DEX 5）', g.effectiveHitWithBuff() - b0.hit, 35, 0.5);
  t.ok('暴擊率上升', g.state.critRate > b0.crit, `${b0.crit} → ${g.state.critRate}`);

  const md = g.MONSTERS[H.mon(g, { size: 'medium', isBoss: false }).defId];
  const withB = g.weaponChainDamage(md, 1, 'mid');
  g.state.buffs = g.state.buffs.filter(b => b.type !== 'atk');
  const noB = g.weaponChainDamage(md, 1, 'mid');
  t.near('ATK buff ×1.20', withB / noB, 1.20, 0.01);
}

/* ---------- 5. 獵鷹突擊（從閃電衝擊推導）---------- */
{
  const g = H.boot();
  H.mkChar(g, SN);
  H.wield(g, 'bow');
  H.learn(g, 'huntingmastery');
  H.learn(g, 'sn_falconassault');
  const sk = g.SKILLS.sn_falconassault;
  t.eq('Lv5 係數 4.0', sk.mult[4], 4.0);
  t.ok('前置是閃電衝擊', sk.requires && sk.requires.skillId === 'blitzbeat');

  const hit1 = (lv) => {
    const m = H.mon(g, { size: 'medium', isBoss: false });
    g.state.sp = g.state.maxSp; g.state.hit = 100000; g.state.cooldowns = {};
    const hp0 = m.hp;
    g.castSkill('sn_falconassault', { free: true, forceLv: lv });
    return hp0 - m.hp;
  };
  const mean = (lv, n) => { let s = 0; for (let i = 0; i < n; i++) s += hit1(lv); return s / n; };

  // 沒學閃電衝擊 → 倍率是 0（mitigateDamage 有 1 點下限，所以是 1 不是 0）
  t.ok('沒學閃電衝擊就只剩下限傷害', mean(5, 30) <= 1);

  H.learn(g, 'blitzbeat', 1);
  const b1 = mean(5, 400);
  t.ok('學了閃電衝擊 Lv1 就有傷害', b1 > 0);
  H.learn(g, 'blitzbeat', 4);          // 補到 Lv5
  const b5 = mean(5, 400);
  t.near('閃電衝擊 Lv1→Lv5 讓傷害變 5 倍（倍率 1→5）', b5 / b1, 5, 0.6);

  // 鋼製喙的固定傷害照係數放大
  const noCrow = mean(5, 400);
  H.learn(g, 'falconnastery');
  const withCrow = mean(5, 400);
  t.ok('鋼製喙讓傷害再上去', withCrow > noCrow);
  t.near('多出來的正好是 360×4', withCrow - noCrow, 360 * 4, 360 * 4 * 0.06);

  // INT 遞增（使用者指定加的）
  t.eq('intScaleMax 100', sk.intScaleMax, 100);
  g.state.stats.int = 1; g.recomputeDerived(true);
  const lowInt = mean(5, 400);
  g.state.stats.int = 99; g.recomputeDerived(true);
  const hiInt = mean(5, 400);
  t.ok('INT 越高傷害越高', hiInt > lowInt, `INT1 ${Math.round(lowInt)} → INT99 ${Math.round(hiInt)}`);
}

/* ---------- 6. 職業樹擋轉職時給得出理由（#61）---------- */
{
  const g = H.boot();
  H.mkChar(g, { path: ['merchant', 'blacksmith'] });
  g.state.baseLevel = 99; g.state.jobLevel = 50; g.state.gold = 2000000;
  g.state.mapId = g.MAPS.filter(m => m.monsters && m.monsters.length === 0)[0].id;
  g.state.jobSkillPoints = { blacksmith: 0 };
  g.doRebirth();

  // 剛轉生：等級 1、技能點 11 → 兩個理由都成立，先報等級
  const r1 = g.jobChangeBlockReason('merchant');
  t.ok('等級不夠時說得出來', /職業等級|基礎等級/.test(r1 || ''), r1);

  g.state.jobLevel = 10; g.state.baseLevel = 10;
  const r2 = g.jobChangeBlockReason('merchant');
  t.ok('剩技能點沒花完時說得出來', /技能點/.test(r2 || ''), r2);
  t.ok('數字是對的', /11 點/.test(r2 || ''), r2);

  g.state.jobSkillPoints.novice = 0;
  t.eq('條件到齊就沒有理由（可以轉了）', g.jobChangeBlockReason('merchant'), null);
  t.ok('而且真的轉得動', g.canJobChange('merchant'));

  // 路線外的職業給的是路線鎖定的理由
  const r3 = g.jobChangeBlockReason('swordsman');
  t.ok('路線外的擋下並說明', /只能重走原本的路線/.test(r3 || ''), r3);
}

process.exit(t.report('狙擊之王 4 技能 + 轉職理由'));
