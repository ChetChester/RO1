/* 領主騎士 8 個技能的回歸測試（#58）。

   跑法：node tools/test_lordknight.js
   全過就印一行；有失敗才列出來，並以 exit code 1 結束。

   每一項都是「真的跑」——走 recomputeDerived / castSkill / tryOnAttackStrikes 本尊，
   不是讀資料檔對答案。機率型的用 rate() 抽樣，允許誤差寫在 near() 的第四個參數。
*/
const H = require('./harness');

const t = H.tester();
const LK = { path: ['swordsman', 'knight'], rebirth: true, job: 'lordknight' };

/* ---------- 1. 職業框架 ---------- */
{
  const g = H.boot();
  H.mkChar(g, LK);
  t.eq('職業是領主騎士', g.state.jobId, 'lordknight');
  t.eq('職業等級上限 70', g.currentJob().jobLevelMax, 70);
  const own = ['lk_berserk', 'lk_tensionrelax', 'lk_parrying', 'lk_aurablade',
    'lk_concentration', 'lk_headcrush', 'lk_jointbeat', 'lk_spiralpierce'];
  const have = new Set(g.currentJob().skills.map(s => s.id));
  t.ok('官方 8 個技能到齊', own.every(id => have.has(id)));
  /* #60 之後進階二轉「取代」二轉（劍士直接轉領主騎士，不再經過騎士），
     所以騎士的技能靠 borrowSkillsFrom 整份借過來，不然這條路線會少一整個職業的招。 */
  const knightIds = g.JOB_TREE.knight.skills.map(s => s.id);
  t.ok('騎士的技能整份借過來', knightIds.every(id => have.has(id)),
    knightIds.filter(id => !have.has(id)).join(','));
  t.ok('借來的技能記在領主騎士的點數池', g.findSkillJob('riding') === 'lordknight');
  t.eq('轉生路線被鎖住', g.rebirthPathNext(), 'runeknight');
  t.eq('不能再轉生一次', g.rebirthBlockReason(), '每隻角色只能轉生一次。');

  // HP/SP 是本職 ×1.25、攻速與本職完全相同。
  // 基準要拿**沒轉生的騎士**——轉生後根本走不到騎士那一站了（#60）
  const gk = H.boot();
  H.mkChar(gk, { path: ['swordsman', 'knight'], jobLevel: 50 });
  const kn = { hp: gk.state.maxHp, sp: gk.state.maxSp, aspd: gk.state.aspd };
  const g2 = H.boot();
  H.mkChar(g2, LK);
  g2.state.jobLevel = 50;              // 同職業等級才比得準
  g2.recomputeDerived(true);
  /* #92：那 25% 不再是職業資料上的係數，改成掛在「轉生過」這件事上。
     驗的方式也跟著換——同一隻角色，只翻 rebirthCount，HP/SP 應該剛好差 1.25 倍。 */
  {
    const gt = H.boot();
    H.mkChar(gt, { path: ['swordsman', 'knight'], jobLevel: 50 });
    const before = { hp: gt.state.maxHp, sp: gt.state.maxSp };
    gt.state.rebirthCount = 1;
    gt.recomputeDerived(true);
    t.eq('轉生後 HP 是 1.25 倍', gt.state.maxHp, Math.floor(before.hp * 1.25));
    t.eq('轉生後 SP 是 1.25 倍', gt.state.maxSp, Math.floor(before.sp * 1.25));
  }

  /* #60 要抓的是「職業加成被算了兩遍」——那時候要先當一次騎士，騎士的 bonusLevels
     算一次、領主騎士自己的清單（當時的內容就是「騎士的清單 + 51~70」）又算一次。
     進階二轉改成取代二轉之後，騎士那一站根本不存在，直接驗這件事最準： */
  t.ok('轉生後沒有騎士的職業等級紀錄（沒有重複計算的來源）',
    !(g2.state.jobLevelHistory && g2.state.jobLevelHistory.knight));

  /* 實測 HP/SP 的比值**不再等於 1.25**（#75 起）。
     官方轉生職有自己的一張 BonusStats，1~50 那段跟原二轉就不一樣——
     騎士 Lv50 之前有 10 點 VIT，領主騎士官方只有 6 點，HP 自然低一截。
     所以要驗係數就得先把職業加成拿掉，不然量到的是「係數 × 加成差」。 */
  const flat = (gg, jid) => {
    const save = gg.JOB_TREE[jid].bonusLevels;
    gg.JOB_TREE[jid].bonusLevels = { str: [], agi: [], vit: [], int: [], dex: [], luk: [] };
    gg.recomputeDerived(true);
    const r = { hp: gg.state.maxHp, sp: gg.state.maxSp };
    gg.JOB_TREE[jid].bonusLevels = save;
    gg.recomputeDerived(true);
    return r;
  };
  const knFlat = flat(gk, 'knight');
  const lkFlat = flat(g2, 'lordknight');
  t.near('拿掉職業加成後，HP 就是乾淨的 1.25 倍', lkFlat.hp / knFlat.hp, 1.25, 0.02);
  t.near('拿掉職業加成後，SP 就是乾淨的 1.25 倍', lkFlat.sp / knFlat.sp, 1.25, 0.02);
  t.ok('帶著官方加成表時 HP 比值會低於 1.25（官方表本來就比較少 VIT）',
    g2.state.maxHp / kn.hp < 1.25, (g2.state.maxHp / kn.hp).toFixed(3));
  t.eq('ASPD 與騎士相同', g2.state.aspd, kn.aspd);
}

/* ---------- 2. 雙劍挌擋（被動，雙手劍限定）---------- */
{
  const g = H.boot();
  H.mkChar(g, LK);
  H.learn(g, 'lk_parrying');
  H.wield(g, 'sword2');
  t.eq('拿雙手劍時機率 55%', g.state.parryingChance, 55);
  const blocked = H.rate(4000, () => g.playerBlocked());
  t.near('實際擋下率', blocked / 4000 * 100, 55, 3);
  H.wield(g, 'dagger');
  t.eq('拿短劍時歸零', g.state.parryingChance, 0);
  t.eq('拿短劍時擋不下來', H.rate(2000, () => g.playerBlocked()), 0);
}

/* ---------- 3. 狂怒之槍（被動，受擊觸發）---------- */
{
  const g = H.boot();
  H.mkChar(g, LK);
  H.learn(g, 'lk_berserk');
  H.wield(g, 'sword2');
  const fired = H.rate(2000,
    () => g.state.buffs.some(b => b.skillId === 'lk_berserk'),
    () => { g.state.buffs = []; g.state.frenzyReadyAt = 0; g.tryFrenzyProc(); });
  t.near('觸發率 10%', fired / 2000 * 100, 10, 2);

  g.state.buffs = []; g.state.frenzyReadyAt = 0; g.recomputeDerived(true);
  const before = { aspd: g.state.aspd, atkMult: g.buffMult('atk').mult };
  while (!g.state.buffs.length) g.tryFrenzyProc();
  g.recomputeDerived(true);
  t.eq('ATK 倍率 ×2', g.buffMult('atk').mult, 2);
  t.eq('ASPD +2', g.state.aspd - before.aspd, 2);

  // 冷卻中不該再觸發（buff 數維持 2：atk + aspd）
  const n0 = g.state.buffs.length;
  for (let i = 0; i < 500; i++) g.tryFrenzyProc();
  t.eq('30 秒內部冷卻擋得住', g.state.buffs.length, n0);
}

/* ---------- 4. 極速回復（被動，自然回復加倍）---------- */
{
  const g = H.boot();
  H.mkChar(g, LK);
  H.wield(g, 'spear1');
  const tick = () => { g.state.hp = 1; g.passiveRegen(); return g.state.hp - 1; };
  const base = tick();
  t.ok('未學時回復固定', H.rate(200, () => tick() !== base) === 0);
  H.learn(g, 'lk_tensionrelax');
  t.eq('機率設定 30%', g.state.regenDoubleChance, 30);
  const doubled = H.rate(2000, () => tick() > base);
  t.near('加倍觸發率 30%', doubled / 2000 * 100, 30, 3);
}

/* ---------- 5. 傷害增壓 / 巧打（被動，普攻追擊）---------- */
{
  const g = H.boot();
  H.mkChar(g, LK);
  H.learn(g, 'lk_headcrush'); H.learn(g, 'lk_jointbeat');
  H.wield(g, 'spear1');
  t.eq('兩個都登記成普攻追擊', g.state.onAttackStrikes.length, 2);

  const count = { lk_headcrush: 0, lk_jointbeat: 0 };
  const m0 = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m0.defId];
  for (let i = 0; i < 3000; i++) {
    g.state.onAttackStrikeReadyAt = {};          // 只量機率，不量冷卻
    const hpBefore = m0.hp;
    const seen = { ...g.state.onAttackStrikeReadyAt };
    g.tryOnAttackStrikes(m0, md);
    Object.keys(g.state.onAttackStrikeReadyAt).forEach(k => { if (!(k in seen)) count[k]++; });
    m0.hp = hpBefore;
  }
  t.near('傷害增壓觸發率 25%', count.lk_headcrush / 3000 * 100, 25, 3);
  t.near('巧打觸發率 30%', count.lk_jointbeat / 3000 * 100, 30, 3);

  // 內部冷卻：連續呼叫只該各中一次
  g.state.onAttackStrikeReadyAt = {};
  let fires = 0;
  const m1 = H.mon(g, { size: 'medium', isBoss: false });
  for (let i = 0; i < 500; i++) {
    const before = Object.keys(g.state.onAttackStrikeReadyAt).length;
    g.tryOnAttackStrikes(m1, g.MONSTERS[m1.defId]);
    fires += Object.keys(g.state.onAttackStrikeReadyAt).length - before;
    m1.hp = 9e9;
  }
  t.eq('5 秒內部冷卻：兩個技能各只中一次', fires, 2);

  // 巧打限矛：換雙手劍後只剩傷害增壓
  H.wield(g, 'sword2');
  t.eq('拿雙手劍時巧打不登記', g.state.onAttackStrikes.length, 1);
  t.eq('剩下的是傷害增壓', g.state.onAttackStrikes[0].id, 'lk_headcrush');
}

/* ---------- 6. 靈氣劍（固定附加傷害，無視防禦）---------- */
{
  const g = H.boot();
  H.mkChar(g, LK);
  H.learn(g, 'lk_aurablade');
  H.wield(g, 'spear1');
  const lowDef = Object.values(g.MONSTERS).find(m => !m.isBoss && (m.def || 0) < 5);
  const hiDef = Object.values(g.MONSTERS).find(m => !m.isBoss && (m.def || 0) > 300);
  const dmg = md => Math.round(
    g.mitigateDamage(g.weaponChainDamage(md, 1, 'mid'), ...g.defOf(md)) + g.raceFlatBonus(md));
  const b = { low: dmg(lowDef), hi: dmg(hiDef) };
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  H.mon(g, { size: 'medium', isBoss: false });
  t.ok('施放成功', g.castSkill('lk_aurablade'));
  g.recomputeDerived(true);
  t.eq('低防怪 +100', dmg(lowDef) - b.low, 100);
  t.eq('高防怪也 +100（＝無視防禦）', dmg(hiDef) - b.hi, 100);
}

/* ---------- 7. 集中攻擊（ATK＋／DEF−）---------- */
{
  const g = H.boot();
  H.mkChar(g, LK);
  H.learn(g, 'lk_concentration');
  H.wield(g, 'spear1');
  const mid = Object.values(g.MONSTERS).find(m => m.size === 'medium' && !m.isBoss);
  const a0 = g.weaponChainDamage(mid, 1, 'mid');
  const d0 = g.debuffedDef(g.state.defHard, g.state.defSoft);
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  H.mon(g, { size: 'medium', isBoss: false });
  t.ok('施放成功', g.castSkill('lk_concentration'));
  g.recomputeDerived(true);
  t.near('ATK ×1.25', g.weaponChainDamage(mid, 1, 'mid') / a0, 1.25, 0.01);
  const d1 = g.debuffedDef(g.state.defHard, g.state.defSoft);
  t.near('軟防 ×0.75（代價）', d1[1] / d0[1], 0.75, 0.02);
}

/* ---------- 8. 螺旋擊刺（矛限定／武器重量／無視體型）---------- */
{
  const g = H.boot();
  H.mkChar(g, LK);
  H.learn(g, 'lk_spiralpierce'); H.learn(g, 'pierce');
  const sk = g.SKILLS.lk_spiralpierce;
  t.eq('官方 5 段合成後的總倍率', sk.mult[4], 17.5);

  H.wield(g, 'spear1');
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  H.mon(g, { size: 'medium', isBoss: false });
  t.ok('拿矛可以放', g.castSkill('lk_spiralpierce'));
  H.wield(g, 'sword2');
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  H.mon(g, { size: 'medium', isBoss: false });
  t.ok('拿雙手劍放不出來', g.castSkill('lk_spiralpierce') === false);

  // 無視體型：小型怪不該再吃 0.75 懲罰
  H.wield(g, 'spear1');
  const small = Object.values(g.MONSTERS).find(m => m.size === 'small' && !m.isBoss);
  t.eq('小型怪本來有體型懲罰', g.getSizeMultiplier(small) < 1, true);
  const plain = g.weaponChainDamage(small, 1, 'mid');
  const noPenalty = g.weaponChainDamage(small, 1, 'mid', { ignoreSize: true });
  t.ok('無視體型確實拿掉懲罰', noPenalty > plain, `含懲罰 ${plain.toFixed(0)} / 無視 ${noPenalty.toFixed(0)}`);

  // 武器重量：重矛的加成要比輕矛大
  const spears = Object.keys(g.ITEMS).filter(k => g.ITEMS[k].type === 'weapon'
    && ['spear1', 'spear2'].includes(g.aspdCategoryOf(k)) && !g.equipBlockReason(k))
    .sort((a, b) => (g.ITEMS[a].weight || 0) - (g.ITEMS[b].weight || 0));
  const mid2 = Object.values(g.MONSTERS).find(m => m.size === 'medium' && !m.isBoss);
  const gain = id => {
    g.addItem(id, 1); g.equipItem(id); g.recomputeDerived(true);
    return g.weaponChainDamage(mid2, 1, 'mid', sk) - g.weaponChainDamage(mid2, 1, 'mid', { ignoreSize: true });
  };
  const light = gain(spears[0]);
  const heavy = gain(spears[spears.length - 1]);
  t.ok('重矛的重量加成大於輕矛', heavy > light, `輕 ${light.toFixed(0)} / 重 ${heavy.toFixed(0)}`);
  t.near('輕矛（重量 0）幾乎沒有重量加成', light, 0, 1);
}

/* ---------- 9. 順手修掉的既有 bug 不能再壞回去 ---------- */
{
  const g = H.boot();
  H.mkChar(g, LK);
  H.wield(g, 'spear1');
  const mid = Object.values(g.MONSTERS).find(m => m.size === 'medium' && !m.isBoss);

  // (a) ATK buff 要同時作用在普攻與技能鏈上（#58）
  const p0 = g.weaponChainDamage(mid, 1, 'mid');
  const s0 = g.skillBaseDamage(false, mid, 1, g.SKILLS.lk_jointbeat);
  g.state.buffs.push({ type: 'atk', mult: 2, msRemaining: 60000 });
  g.recomputeDerived(true);
  t.near('ATK buff 對普攻鏈生效', g.weaponChainDamage(mid, 1, 'mid') / p0, 2, 0.01);
  t.near('ATK buff 對技能鏈也生效', g.skillBaseDamage(false, mid, 1, g.SKILLS.lk_jointbeat) / s0, 2, 0.02);

  // (b) DEF buff 以前推了沒人讀（#58，同 #24 的 buff_flee）
  g.state.buffs = []; g.recomputeDerived(true);
  const d0 = g.debuffedDef(g.state.defHard, g.state.defSoft);
  g.state.buffs.push({ type: 'def', mult: 1.55, msRemaining: 60000 });
  g.recomputeDerived(true);
  const d1 = g.debuffedDef(g.state.defHard, g.state.defSoft);
  t.near('DEF buff 真的提升防禦', d1[1] / d0[1], 1.55, 0.03);

  // (c) 武器重量是 ×10 的原始值，別再乘錯尺度
  t.eq('短劍重量是官方原始值 40', g.ITEMS.knife.weight, 40);
}

process.exit(t.report('領主騎士 8 技能'));
