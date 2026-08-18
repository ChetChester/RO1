/* 隊友系統（#83）。

   驗的是**換身會不會漏**：隊友是靠 withAlly() 把全域 state 換成快照來打的，
   所以每一條「獎勵記在誰身上」的路徑都是潛在的洩漏點——經驗、鋅幣、掉落、
   SP／冷卻／buff。這支就是把那幾條線一條一條釘死。 */
const H = require('./harness');
const t = H.tester();

// 造一份「另一格存檔」的角色，回傳可以塞進 localStorage 的原始 state
function makeSaveSlot(g, slot, path, job, lv) {
  const gg = H.boot();
  H.mkChar(gg, { path, job, baseLevel: lv, stats: { str: 70, agi: 60, vit: 50, int: 50, dex: 70, luk: 30 } });
  gg.state.name = '隊友' + slot;
  H.wield(gg, 'mace');
  gg.recomputeDerived(true);
  g.localStorage.setItem(g.getSlotKey(slot), JSON.stringify(gg.state));
  return gg.state;
}

const g = H.boot();
H.mkChar(g, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 90 });
H.wield(g, 'spear1');
g.recomputeDerived(true);
g.state.name = '主角';
g.changeMap(g.MAPS.find(m => (m.monsters || []).length === 0).id);   // 安全區才雇得了

makeSaveSlot(g, 1, ['acolyte', 'priest'], 'priest', 60);
makeSaveSlot(g, 2, ['merchant', 'blacksmith'], 'blacksmith', 40);
makeSaveSlot(g, 3, ['thief', 'assassin'], 'assassin', 30);

/* ---------- 雇傭 ---------- */
{
  const cands = g.allyHireCandidates();
  t.eq('三格存檔都列得出來', cands.length, 3);
  t.eq('雇傭價＝等級×1000', cands.find(c => c.slot === '1').price, 60000);

  g.state.gold = 1000;
  t.ok('錢不夠雇不了', !g.hireAlly('1'));
  g.state.gold = 500000;
  t.ok('錢夠就雇得到', g.hireAlly('1'));
  t.eq('扣了正確的錢', g.state.gold, 500000 - 60000);
  t.eq('隊上有一人', g.state.allies.length, 1);
  t.ok('同一個人不能雇兩次', !g.hireAlly('1'));

  t.ok('雇第二人', g.hireAlly('2'));
  t.ok('第三人超過上限', !g.hireAlly('3'));
  t.eq('上限就是 2', g.state.allies.length, 2);

  const ally = g.state.allies[0];
  t.ok('快照有算出戰力', ally.maxHp > 0 && ally.atk > 0);
  t.ok('快照不帶背包／圖鑑（存檔會爆）', !ally.codex && !ally.achievements);
  t.eq('快照滿血', ally.hp, ally.maxHp);
}

/* ---------- 更新快照 ---------- */
{
  const before = g.state.allies[0].maxHp;
  // 讓那格角色變強再更新
  const raw = JSON.parse(g.localStorage.getItem(g.getSlotKey(1)));
  raw.baseLevel = 90; raw.stats.vit = 90;
  g.localStorage.setItem(g.getSlotKey(1), JSON.stringify(raw));
  const gold = g.state.gold;
  t.ok('更新成功', g.refreshAlly('1'));
  t.eq('更新只收三分之一', gold - g.state.gold, Math.ceil(90 * 1000 / 3));
  t.ok('戰力真的更新了', g.state.allies[0].maxHp > before,
    `${before} → ${g.state.allies[0].maxHp}`);
}

/* ---------- 換身戰鬥：獎勵不能漏到隊友身上 ---------- */
{
  g.changeMap(g.MAPS.find(m => (m.monsters || []).length > 0).id);
  const ally = g.state.allies[0];
  const mon = H.mon(g, { defId: 'poring', hp: 60 });
  const before = {
    gold: g.state.gold, exp: g.state.baseExp, sp: g.state.sp,
    cd: JSON.stringify(g.state.cooldowns), inv: g.state.inventory.length,
    allyGold: ally.gold, allyExp: ally.baseExp,
  };
  for (let i = 0; i < 10 && g.state.monsters.length; i++) g.withAlly(ally, () => g.playerAttack());

  t.ok('隊友打得到怪', mon.hp < 60 || g.state.monsters.length === 0);
  /* 屍體要從**玩家**那份 monsters 移除。killMonster 裡的
     `state.monsters = state.monsters.filter(...)` 是重新綁定屬性，換身期間
     綁到的是快照那份——玩家場上的怪不會消失，隊友接著對屍體揮空。 */
  t.eq('打死的怪從玩家場上消失', g.state.monsters.length, 0);
  t.ok('經驗記在玩家身上', g.state.baseExp > before.exp || g.state.baseLevel > 90,
    `玩家 ${before.exp} → ${g.state.baseExp}`);
  t.eq('隊友沒有偷走經驗', ally.baseExp, before.allyExp);
  t.ok('鋅幣記在玩家身上', g.state.gold > before.gold);
  t.eq('隊友沒有偷走鋅幣', ally.gold, before.allyGold);
  t.eq('玩家的 SP 沒被扣', g.state.sp, before.sp);
  t.eq('玩家的冷卻表沒被寫', JSON.stringify(g.state.cooldowns), before.cd);
  t.ok('掉落進玩家背包', g.state.inventory.length >= before.inv);
  t.ok('傭兵額外累積了 20% 經驗', (ally._pendingExp || 0) > 0,
    '累積 ' + (ally._pendingExp || 0).toFixed(1));
  /* 20% 是給全隊的，不是只給補刀的那個——攻擊力低的隊友永遠搶不到最後一擊。 */
  t.ok('沒出手的隊友也拿得到', (g.state.allies[1]._pendingExp || 0) > 0,
    '第二位累積 ' + (g.state.allies[1]._pendingExp || 0).toFixed(1));
}

/* ---------- 承傷與倒地 ---------- */
{
  const ally = g.state.allies[0];
  ally._downed = false; ally.hp = ally.maxHp;
  const other = g.state.allies[1];
  other._downed = true;                       // 只有一人站著
  let hitAlly = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) if (g.pickMonsterTarget()) hitAlly++;
  t.near('只有一人站著時，他吃掉 40%', hitAlly / N * 100, 40, 3);
  t.eq('倒地的不會被選中', g.pickMonsterTarget() === other, false);

  other._downed = false; other.hp = other.maxHp;
  let a0 = 0, a1 = 0;
  for (let i = 0; i < N; i++) {
    const tg = g.pickMonsterTarget();
    if (tg === ally) a0++; else if (tg === other) a1++;
  }
  t.near('兩人站著各分 20%', a0 / N * 100, 20, 3);
  t.near('兩人站著各分 20%（第二位）', a1 / N * 100, 20, 3);

  // 全部倒地 → 全部回到玩家身上
  ally._downed = true; other._downed = true;
  t.eq('全隊倒地時怪只打玩家', g.pickMonsterTarget(), null);
}

/* ---------- 天地樹葉子復活 ---------- */
{
  const ally = g.state.allies[0];
  ally._downed = true; ally.hp = 0;
  g.state.inventory = g.state.inventory.filter(r => r.item !== 'leaf_of_yggdrasil');
  t.ok('沒有葉子扶不起來', !g.reviveAlly(ally));
  g.addItem('leaf_of_yggdrasil', 2);
  t.ok('有葉子就扶得起來', g.reviveAlly(ally));
  t.eq('消耗一片', g.getItemQty('leaf_of_yggdrasil'), 1);
  t.ok('復活到 50% HP', ally.hp === Math.max(1, Math.round(ally.maxHp * 0.5)));
  t.ok('不再是倒地狀態', !ally._downed);

  // useItem 直接用也要能扶（沒人倒地時不能消耗）
  g.state.allies.forEach(a => { a._downed = false; a.hp = a.maxHp; });   // 上一段把兩人都放倒了
  const qty = g.getItemQty('leaf_of_yggdrasil');
  t.ok('沒人倒地時不消耗', !g.useItem('leaf_of_yggdrasil'));
  t.eq('數量不變', g.getItemQty('leaf_of_yggdrasil'), qty);

  // 回安全區全隊免費復活
  g.state.allies.forEach(a => { a._downed = true; a.hp = 0; });
  g.changeMap(g.MAPS.find(m => (m.monsters || []).length === 0).id);
  t.ok('回安全區全隊站起來', g.state.allies.every(a => !a._downed && a.hp === a.maxHp));
}

/* ---------- 退隊與待領帳本 ---------- */
{
  const ally = g.state.allies[0];
  ally._pendingExp = 5000; ally._pendingJobExp = 3000;
  const slot = ally._slot;
  t.ok('退得了隊', g.dismissAlly(slot));
  t.eq('隊上少一人', g.state.allies.length, 1);
  const led = JSON.parse(g.localStorage.getItem('ro_idle_merc_ledger_v1') || '{}');
  t.eq('累積的經驗進了待領帳本', led[slot] && led[slot].baseExp, 5000);
  t.eq('職業經驗也進了帳本', led[slot] && led[slot].jobExp, 3000);
  // 帳本**不能**直接寫進那格存檔
  const raw = JSON.parse(g.localStorage.getItem(g.getSlotKey(slot)));
  t.eq('沒有直接改別人的存檔', raw.baseExp || 0, 0);
}

/* ---------- 隊友喝水（喝玩家背包裡的藥水）---------- */
{
  g.state.gold = 5000000;
  g.hireAlly('3');                            // 上一段退掉一個，補一位進來
  const a = g.state.allies[0];
  a._downed = false; a.hp = Math.round(a.maxHp * 0.2);
  g.state.inventory = g.state.inventory.filter(r => r.item !== 'red_potion');
  g.addItem('red_potion', 5);
  g.setAllyPotionCfg('enabled', true);
  g.setAllyPotionCfg('hpThreshold', 50);
  g.setAllyPotionCfg('primary', 'red_potion');
  const hp = a.hp;
  t.ok('低於門檻會喝', g.tryAllyPotion(a));
  t.ok('HP 有回', a.hp > hp, `${hp} → ${Math.round(a.hp)}`);
  t.eq('從玩家背包扣一瓶', g.getItemQty('red_potion'), 4);

  a.hp = a.maxHp;
  t.ok('滿血不喝', !g.tryAllyPotion(a));
  a.hp = 1; a._downed = true;
  t.ok('倒地不喝', !g.tryAllyPotion(a));
  a._downed = false;
  g.setAllyPotionCfg('enabled', false);
  t.ok('關掉就不喝', !g.tryAllyPotion(a));
  g.setAllyPotionCfg('enabled', true);

  // 藥水沒了 + 沒開自動購買 → 不會憑空喝到
  g.state.inventory = g.state.inventory.filter(r => r.item !== 'red_potion');
  g.state.autoBuyAllyPotion = false;
  g.setAllyPotionCfg('primary', '');
  t.ok('沒藥水就不喝', !g.tryAllyPotion(a));
}

/* ---------- 菠色克藥水的職業線（#84）---------- */
{
  const gg = H.boot();
  H.mkChar(gg, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 99 });
  const can = j => { gg.state.jobId = j; return gg.aspdPotionBlockReason('berserk_potion') === null; };
  // 官方寫「劍士系列／商人系列」——進階二轉當然算在系列裡
  ['knight', 'lordknight', 'crusader', 'paladin', 'blacksmith', 'whitesmith', 'alchemist', 'creator']
    .forEach(j => t.ok(`${(gg.JOB_TREE[j] || {}).name || j} 用得了菠色克藥水`, can(j)));
  ['sage', 'priest', 'hunter', 'monk'].forEach(j => t.ok(`${(gg.JOB_TREE[j] || {}).name || j} 用不了`, !can(j)));
  t.ok('武術宗師用得了（官方列了拳聖）', can('champion'));
  t.ok('神行太保用得了（官方列了流氓）', can('stalker'));
}

/* ---------- 隊友承傷走跟玩家同一組公式（#84）---------- */
{
  const gg = H.boot();
  H.mkChar(gg, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 90,
    stats: { str: 80, agi: 60, vit: 70, int: 20, dex: 60, luk: 20 } });
  gg.recomputeDerived(true);
  const ally = JSON.parse(JSON.stringify(gg.state));
  ally._allyName = '測'; ally._downed = false;
  const monDef = gg.MONSTERS.hode;
  const mon = H.mon(gg, { defId: 'hode', hp: 9e9 });

  // 數值完全一樣的目標，平均傷害應該對得上（第一版自己另寫了一條曲線，差很多）
  let p = 0, pn = 0, a = 0, an = 0;
  for (let i = 0; i < 600; i++) {
    gg.state.hp = gg.state.maxHp; gg.monsterAttackSingle(mon);
    const d = gg.state.maxHp - gg.state.hp; if (d > 0) { p += d; pn++; }
  }
  for (let i = 0; i < 600; i++) {
    ally.hp = ally.maxHp; ally._downed = false; gg.monsterAttackAlly(mon, monDef, ally);
    const d = ally.maxHp - ally.hp; if (d > 0) { a += d; an++; }
  }
  const pa = p / Math.max(1, pn), aa = a / Math.max(1, an);
  t.near('同數值的隊友與玩家挨打，平均傷害一致', aa, pa, pa * 0.15);
  t.ok('隊友也會迴避（不是每一下都吃滿）', an < 600, `命中 ${an}/600`);
  // FLEE 拉高，被打中的次數要明顯變少
  ally.flee = 9999;
  let hit = 0;
  for (let i = 0; i < 300; i++) { ally.hp = ally.maxHp; ally._downed = false; gg.monsterAttackAlly(mon, monDef, ally); if (ally.hp < ally.maxHp) hit++; }
  t.ok('FLEE 高就閃得多', hit <= 30, `命中 ${hit}/300`);
}

/* ---------- 戰鬥訊息三分流（#86）---------- */
{
  const gg = H.boot({ captureLog: true });
  H.mkChar(gg, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 99 });
  H.wield(gg, 'spear1');
  gg.state.jobSkillPoints.swordsman = 30; gg.state.skillPoints = 30;
  H.learn(gg, 'bash', 3);
  gg.recomputeDerived(true); gg.state.sp = gg.state.maxSp;
  const clear = () => { ['main', 'skill', 'ally'].forEach(k => { gg.combatLogLanes[k].length = 0; }); };

  // 轉職與換地圖**不能**跑進技能欄（第一版用「」括號判斷就是這樣錯的）
  clear();
  gg.changeMap(gg.MAPS.find(m => (m.monsters || []).length > 0).id);
  t.eq('換地圖進一般欄', gg.combatLogLanes.skill.length, 0);
  t.ok('換地圖的訊息在一般欄', gg.combatLogLanes.main.some(x => /前往/.test(x)));

  H.mon(gg, { defId: 'hode', hp: 9e9 });
  clear();
  gg.playerAttack();
  t.ok('普攻進一般欄', gg.combatLogLanes.main.length > 0);
  t.eq('普攻不會跑進技能欄', gg.combatLogLanes.skill.length, 0);

  clear();
  gg.castSkill('bash');
  t.ok('技能進技能欄', gg.combatLogLanes.skill.some(x => /狂擊/.test(x)));

  clear();
  gg.monsterCastSkill(gg.state.monsters[0], gg.MONSTERS.hode,
    { s: 'NPC_CRITICALSLASH', lv: 1, rate: 100, cd: 0, mult: 1.5 });
  t.ok('怪物技能也進技能欄', gg.combatLogLanes.skill.length > 0);
  t.eq('怪物技能不會跑進隊友欄', gg.combatLogLanes.ally.length, 0);
}

/* ---------- 換身中要有辦法讀到「玩家那份 state」（#87）----------
   ui.js 沒有載入這個治具，音量函式本身測不到；這裡驗它依賴的機制。
   隊友音效的設定寫在玩家身上，換身期間直接讀 `state` 會拿到隊友快照——
   實測就是這樣讓音量卡在 0.25、面板怎麼調都沒反應。 */
{
  const gg = H.boot();
  H.mkChar(gg, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 99 });
  gg.state.sfxVolume = 0.8;
  gg.state.allySfxRatio = 0.5;
  const ally = JSON.parse(JSON.stringify(gg.state));
  ally._allyName = '測'; ally._downed = false;
  ally.sfxVolume = 0.5; delete ally.allySfxRatio;      // 快照帶的是雇傭當下的舊值

  t.ok('平時 allyOwnerState 就是自己', gg.allyOwnerState() === gg.state);
  gg.withAlly(ally, () => {
    t.ok('換身中 state 是隊友快照', gg.state === ally);
    t.eq('換身中隊友快照讀到的是舊音量', gg.state.sfxVolume, 0.5);
    t.eq('allyOwnerState 仍指向玩家', gg.allyOwnerState().sfxVolume, 0.8);
    t.eq('玩家的隊友音量比例也讀得到', gg.allyOwnerState().allySfxRatio, 0.5);
  });
  t.ok('換回來之後恢復', gg.allyOwnerState() === gg.state);
}

/* ---------- 換身期間的背包必須是玩家那份（#91）----------
   隊友快照的 inventory 第一版被設成 `{}`（物件），弓箭手隊友一攻擊就
   `state.inventory.find is not a function`，例外從 withAlly 竄出 alliesTick，
   **排在後面的隊友整個不會動**。這是使用者回報「兩隻都沒有攻擊」的真因。 */
{
  const gg = H.boot();
  H.mkChar(gg, { path: ['archer', 'hunter'], job: 'hunter', baseLevel: 99 });
  H.wield(gg, 'bow');
  gg.addItem('arrow', 500);
  gg.state.equip.ammo = 'arrow';
  gg.recomputeDerived(true);
  const ally = JSON.parse(JSON.stringify(gg.state));
  ally._allyName = '獵人'; ally._downed = false;

  const g2 = H.boot();
  H.mkChar(g2, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 99 });
  g2.addItem('arrow', 50);
  const mon = H.mon(g2, { defId: 'hode', hp: 9e9 });

  t.ok('快照的 inventory 是陣列', Array.isArray(g2.buildAllySnapshot(gg.state, 1).inventory));

  const hp0 = mon.hp;
  let hit = null, threw = null;
  try { hit = g2.withAlly(ally, () => g2.playerAttack()); } catch (e) { threw = e.message; }
  t.eq('弓箭手隊友攻擊不會丟例外', threw, null);
  t.eq('打得出去', hit, true);
  t.ok('怪有掉血', mon.hp < hp0);
  t.eq('箭是從玩家背包扣的', g2.getItemQty('arrow'), 49);
  // 這個 ally 是直接深拷貝來的（帶著自己的背包），扣的應該是玩家那份
  const allyArrow = ally.inventory.find(r => r.item === 'arrow');
  t.eq('沒動到隊友快照的箭', allyArrow && allyArrow.qty, 500);

  // 沒箭時要回 false，UI 才不會播空揮的攻擊動畫
  g2.removeItem('arrow', g2.getItemQty('arrow'));
  t.eq('沒箭時 playerAttack 回 false', g2.withAlly(ally, () => g2.playerAttack()), false);

  // 一位隊友出錯不能拖垮其他人
  const g3 = H.boot();
  H.mkChar(g3, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 99 });
  H.mon(g3, { defId: 'hode', hp: 9e9 });
  const bad = JSON.parse(JSON.stringify(g3.state));
  bad._allyName = '壞掉的'; bad._downed = false; bad._lastAttackAt = 0;
  Object.defineProperty(bad, 'atk', { get() { throw new Error('故意炸'); } });
  const good = g3.buildAllySnapshot(g3.state, 2);
  good._allyName = '正常的'; good._lastAttackAt = 0;
  g3.state.allies = [bad, good];
  const before = g3.state.monsters[0].hp;
  g3.alliesTick();
  t.ok('前面那位炸掉，後面那位照樣打得到', g3.state.monsters[0].hp < before);
}

/* ---------- 自動補隊友的箭（#93）----------
   玩家那支 `tryAutoBuyArrow()` 第一行就問 `needsAmmo()`——問的是**玩家**有沒有拿弓。
   玩家是騎士、隊友是獵人的時候永遠 false，箭用完就再也不會補。 */
{
  const ga = H.boot();
  H.mkChar(ga, { path: ['archer', 'hunter'], job: 'hunter', baseLevel: 99 });
  H.wield(ga, 'bow');
  ga.state.equip.ammo = 'arrow';
  ga.recomputeDerived(true);

  const mk = () => {
    const gp = H.boot();
    H.mkChar(gp, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 99 });
    const a = gp.buildAllySnapshot(ga.state, 1);
    a._allyName = '獵人'; a._downed = false; a._lastAttackAt = 0;
    gp.state.allies = [a];
    gp.state.gold = 5000000;
    return { gp, a };
  };

  {
    const { gp } = mk();
    t.ok('玩家沒拿弓，玩家那支自動補箭不會動',
      (gp.tryAutoBuyArrow(), gp.getItemQty('arrow') === 0));
    gp.tryAutoBuyAllyArrow();
    t.eq('隊友那支補得到', gp.getItemQty('arrow'), g.AUTO_BUY_ALLY_ARROW_QTY);
  }
  {
    // 已經夠多就不要一直買
    const { gp } = mk();
    gp.addItem('arrow', g.AUTO_BUY_ALLY_ARROW_THRESHOLD + 1);
    gp.tryAutoBuyAllyArrow();
    t.eq('超過門檻不補貨', gp.getItemQty('arrow'), g.AUTO_BUY_ALLY_ARROW_THRESHOLD + 1);
  }
  {
    const { gp } = mk();
    gp.setAutoBuyAllyArrow(false);
    gp.tryAutoBuyAllyArrow();
    t.eq('關掉就不買', gp.getItemQty('arrow'), 0);
  }
  {
    const { gp } = mk();
    gp.state.gold = 10;
    gp.tryAutoBuyAllyArrow();
    t.eq('錢不夠就安靜跳過', gp.getItemQty('arrow'), 0);
    t.ok('鋅幣不會變成負的', gp.state.gold === 10);
  }
  {
    // 沒有隊友要用箭的時候不該亂買
    const { gp } = mk();
    gp.state.allies = [];
    gp.tryAutoBuyAllyArrow();
    t.eq('沒有弓箭手隊友就不買', gp.getItemQty('arrow'), 0);
  }
  {
    /* 商店沒賣的箭種要退回鋼鐵箭矢——不然買不到，等於沒有自動補箭。
       `holy_arrow` 有 buyPrice 但沒進商店，這裡挑一個連 buyPrice 都沒有的情況：
       直接把箭種指成不存在的 id。 */
    const { gp, a } = mk();
    a.equip.ammo = 'no_such_arrow';
    gp.tryAutoBuyAllyArrow();
    t.eq('買不到的箭種退回鋼鐵箭矢', gp.getItemQty(g.ALLY_ARROW_FALLBACK), g.AUTO_BUY_ALLY_ARROW_QTY);
  }
  {
    /* `ensureAllyAmmo()` 以前在玩家背包一支箭都沒有時把 `equip.ammo` 設成 null，
       自動補箭就不知道該買哪一種了。 */
    const { gp, a } = mk();
    gp.ensureAllyAmmo(a);
    t.ok('玩家沒箭時保留原本的箭種', !!a.equip.ammo);
    gp.addItem('steel_arrow', 10);
    gp.ensureAllyAmmo(a);
    t.eq('玩家有別種箭就換上去', a.equip.ammo, 'steel_arrow');
  }
  {
    // 新角色三個自動購買就該是開的（以前只寫在 loadGame 的補欄位那段）
    const gn = H.boot();
    H.mkChar(gn, { path: ['swordsman'] });
    t.ok('新角色預設會自動買箭', gn.state.autoBuyAllyArrow === true);
    t.ok('新角色預設會自動買隊友藥水', gn.state.autoBuyAllyPotion === true);
    t.ok('新角色預設會自動買天地樹葉子', gn.state.autoBuyReviveLeaf === true);
  }
}

/* ---------- 祭司隊友的復活術／治療術也算數（#105）----------
   兩支本來只認**玩家身上**那一份（跑在玩家的 state 上、讀 state.hasAutoRevive1），
   所以「雇一個祭司當隊友」等於白雇。改成誰有這支被動誰出手，
   冷卻與 SP 各記各的。 */
{
  const gg = H.boot({ captureLog: true });
  H.mkChar(gg, { path: ['swordsman'], job: 'swordsman', baseLevel: 90 });   // 玩家沒有任何祭司技能
  gg.state.name = '主角';
  gg.changeMap(gg.MAPS.find(m => (m.monsters || []).length > 0).id);

  // 祭司隊友：復活術 Lv4 + 治療術
  const gp = H.boot();
  H.mkChar(gp, { path: ['acolyte', 'priest'], job: 'priest', baseLevel: 90 });
  gp.state.name = '牧師甲';
  gp.state.jobSkillPoints = { novice: 400, acolyte: 400, priest: 400 };
  ['resurrection', 'cure'].forEach(id => { for (let i = 0; i < 4; i++) gp.levelUpSkill(id); });
  gp.recomputeDerived(true);
  const priest = gg.buildAllySnapshot(JSON.parse(JSON.stringify(gp.state)), 1);
  gg.state.allies = [priest];

  t.ok('玩家自己沒有這兩支', !gg.state.hasAutoRevive1 && !gg.state.hasPartyAutoCure);
  t.ok('隊友快照帶著這兩支', priest.hasAutoRevive1 && priest.hasPartyAutoCure);

  // 治療術：玩家與隊友身上的異常都要解掉
  gg.state.playerAil = { blind: Date.now() + 99999 };
  priest.playerAil = { silence: Date.now() + 99999 };
  gg.tickPartyAutoCure();
  t.ok('解掉玩家的黑暗', !gg.state.playerAil.blind);
  t.ok('解掉隊友自己的沉默', !priest.playerAil.silence);
  t.ok('冷卻記在隊友身上', priest.partyAutoCureReadyAt > Date.now());

  // 復活術：玩家倒下時由隊友扶
  gg.state.hp = 0;
  t.ok('祭司隊友扶得起玩家', gg.tryAutoRevive());
  t.ok('玩家真的活著', gg.state.hp > 0);
  const spAfter = priest.sp;
  t.ok('SP 扣在隊友身上', spAfter < priest.maxSp);

  // 冷卻中就不能再扶一次（不能因為換成隊友出手就多一次復活）
  gg.state.hp = 0;
  t.ok('冷卻中扶不動', !gg.tryAutoRevive());

  // 倒地的隊友不能當施術者：只剩一個倒地的祭司時，沒有人扶得起別人
  const gd = H.boot();
  H.mkChar(gd, { path: ['swordsman'] });
  const downedPriest = gd.buildAllySnapshot(JSON.parse(JSON.stringify(gp.state)), 1);
  const victim = gd.buildAllySnapshot(JSON.parse(JSON.stringify(gp.state)), 2);
  downedPriest._downed = true; victim._downed = true;
  gd.state.allies = [downedPriest, victim];
  t.ok('倒地的祭司扶不了別人', !gd.tryPriestReviveAlly(victim));
}

/* ---------- 換身期間不可以存檔（#105）----------
   隊友跑的是同一支 playerAttack()，裡面的 tryAutoSpells() 打到卡片的自動念咒
   就會 castSkill()，而 castSkill 尾端有 saveGame()——那一刻 `state` 是隊友快照，
   存下去等於把玩家的存檔格整個換成隊友。實測普攻五下就蓋掉了。 */
{
  const gg = H.boot();
  H.mkChar(gg, { path: ['swordsman'], job: 'swordsman' });
  gg.state.name = '主角';
  gg.saveGame();
  const KEY = gg.getSlotKey(0);
  t.eq('先存一份玩家的', JSON.parse(gg.localStorage.getItem(KEY)).name, '主角');

  const gp = H.boot();
  H.mkChar(gp, { path: ['thief'], job: 'thief' });
  gp.state.name = '隊友甲';
  H.wield(gp, 'dagger');
  gp.recomputeDerived(true);
  const ally = gg.buildAllySnapshot(JSON.parse(JSON.stringify(gp.state)), 1);
  ally.cardAutoSpells = { attack: [{ skill: 'envenom', lv: 1, chance: 100 }] };   // 必定觸發
  ally.sp = ally.maxSp;
  gg.state.allies = [ally];
  gg.changeMap(gg.MAPS.find(m => (m.monsters || []).length > 0).id);
  H.mon(gg, { minHp: 9e8 });
  for (let i = 0; i < 10; i++) gg.withAlly(ally, () => gg.playerAttack());
  const after = JSON.parse(gg.localStorage.getItem(KEY));
  t.eq('隊友的自動念咒沒有蓋掉玩家的存檔', after.name, '主角');
  t.eq('職業也沒被換掉', after.jobId, 'swordsman');

  // 換回玩家之後照樣存得進去，而且隊友一起帶著走
  gg.state.gold = 12345;
  gg.saveGame();
  const ok = JSON.parse(gg.localStorage.getItem(KEY));
  t.eq('玩家自己的存檔沒被擋住', ok.gold, 12345);
  t.eq('隊友快照跟著存進去', (ok.allies || []).length, 1);
}

/* ---------- 隊友的自動戰鬥（#105）----------
   使用者選的是「隊友也有完整自動戰鬥設定」＋「自然回復＋玩家背包供應藍水」。
   隊友跑的是**跟玩家同兩支**函式，所以這裡驗的是接線有沒有接上、
   以及換身巢狀會不會把旗標弄丟——不是重驗 tryAutoCastSkill 自己的規則。 */
{
  const mkAlly = (gg, opts) => {
    const gp = H.boot();
    H.mkChar(gp, { path: opts.path, job: opts.job, baseLevel: 90 });
    gp.state.name = opts.name;
    gp.state.jobSkillPoints = { novice: 400, acolyte: 400, priest: 400, mage: 400, wizard: 400, swordsman: 400 };
    (opts.learn || []).forEach(([id, n]) => { for (let i = 0; i < n; i++) gp.levelUpSkill(id); });
    Object.assign(gp.state, opts.set || {});
    gp.recomputeDerived(true);
    return gg.buildAllySnapshot(JSON.parse(JSON.stringify(gp.state)), opts.slot);
  };

  const gg = H.boot();
  H.mkChar(gg, { path: ['swordsman'], job: 'swordsman', baseLevel: 90 });
  gg.state.name = '主角';
  gg.saveGame();
  const KEY = gg.getSlotKey(0);
  gg.changeMap(gg.MAPS.find(m => (m.monsters || []).length > 0).id);

  // 巫師隊友：第一招雷爆術
  const wiz = mkAlly(gg, {
    slot: 1, name: '巫師乙', path: ['mage', 'wizard'], job: 'wizard', learn: [['thunderstorm', 10]],
    set: { autoSkill: true, autoSkillConfig: { skillId: 'thunderstorm', skillId2: null, spThreshold: 10, spThreshold2: 50, monsterCount2: 2 } },
  });
  gg.state.allies = [wiz];
  const mon = H.mon(gg, { minHp: 9e8 });
  const hp0 = mon.hp, sp0 = wiz.sp;
  gg.alliesTick();
  t.ok('隊友真的放得出攻擊技能', hp0 - mon.hp > 1000, `掉血 ${hp0 - mon.hp}`);
  t.ok('SP 扣在隊友身上', wiz.sp < sp0);
  t.eq('存檔沒有被換身寫壞', JSON.parse(gg.localStorage.getItem(KEY)).name, '主角');

  // 沒勾自動施放就不放
  wiz.autoSkill = false;
  gg.state.monsters[0].hp = 9e8;
  const hp1 = gg.state.monsters[0].hp, sp1 = wiz.sp;
  gg.state.cooldowns = {}; wiz.cooldowns = {};
  gg.alliesTick();
  t.eq('沒勾就不放技能（SP 一點都沒扣）', wiz.sp, sp1);
  t.ok('沒勾時傷害只剩普攻', hp1 - gg.state.monsters[0].hp < 1000);

  // 自然回復：HP/SP 都要自己回
  wiz.hp = 1; wiz.sp = 0;
  gg.tickAllyRegen();
  t.ok('隊友 HP 會自然回復', wiz.hp > 1);
  t.ok('隊友 SP 會自然回復', wiz.sp > 0);

  // 藍水：玩家背包供應
  const gs = H.boot();
  H.mkChar(gs, { path: ['swordsman'] });
  gs.changeMap(gs.MAPS.find(m => (m.monsters || []).length > 0).id);
  const a2 = mkAlly(gs, { slot: 1, name: '喝水的', path: ['mage'], job: 'mage' });
  gs.state.allies = [a2];
  gs.state.allySpPotion = { enabled: true, primary: '', fallback: 'blue_potion', spThreshold: 50 };
  gs.state.autoBuyAllySpPotion = false;
  a2.sp = 0;
  t.ok('背包沒藍水就喝不到', !gs.tryAllySpPotion(a2));
  gs.addItem('blue_potion', 3);
  t.ok('有藍水就會喝', gs.tryAllySpPotion(a2));
  t.ok('SP 真的補上去', a2.sp > 0);
  t.eq('背包扣一瓶', gs.getItemQty('blue_potion'), 2);
  a2.sp = a2.maxSp;
  t.ok('SP 滿的時候不會亂喝', !gs.tryAllySpPotion(a2));

  /* 祭司隊友放的全體 buff 要發給玩家與另一位隊友。
     這條同時釘住 withAlly 的**巢狀**：分 buff 時會為了替另一位隊友重算
     再換身一次，內層把旗標清成 null 的話，外層後半段（含 castSkill 尾端的
     saveGame）會失去保護。 */
  const gb = H.boot();
  H.mkChar(gb, { path: ['swordsman'], job: 'swordsman', baseLevel: 90 });
  gb.state.name = '主角';
  gb.saveGame();
  gb.changeMap(gb.MAPS.find(m => (m.monsters || []).length > 0).id);
  const pr = mkAlly(gb, {
    slot: 1, name: '牧師甲', path: ['acolyte', 'priest'], job: 'priest',
    learn: [['magnificat', 10], ['kyrie', 10]],
    set: { autoSupportSkills: { magnificat: true, kyrie: true } },
  });
  const kn = mkAlly(gb, { slot: 2, name: '劍士丙', path: ['swordsman'], job: 'swordsman' });
  gb.state.allies = [pr, kn];
  H.mon(gb, { minHp: 9e8 });
  gb.alliesTick();
  const hasBuff = (o, id) => (o.buffs || []).some(b => b.skillId === id);
  const shieldOf = (o) => (o.shields || []).find(s => s.id === 'kyrie');
  t.ok('玩家收到隊友放的聖母之頌歌', hasBuff(gb.state, 'magnificat'));
  t.ok('另一位隊友也收到', hasBuff(kn, 'magnificat'));
  t.ok('玩家收到霸邪之陣的盾', !!shieldOf(gb.state));
  t.ok('另一位隊友也收到盾', !!shieldOf(kn));
  // 盾的耐久照「收禮那個人自己的」最大HP 算，不是照施術者的
  t.ok('盾的耐久照各自最大HP', shieldOf(pr).remainingHp !== shieldOf(kn).remainingHp
    || pr.maxHp === kn.maxHp, `牧師 ${shieldOf(pr).remainingHp} / 劍士 ${shieldOf(kn).remainingHp}`);
  t.eq('巢狀換身之後存檔還是玩家的', JSON.parse(gb.localStorage.getItem(gb.getSlotKey(0))).name, '主角');
}

/* ---------- 換身期間的地圖要跟著玩家（#109）----------
   快照的 `mapId` 停在**那個角色被存檔時所在的地圖**（通常是城鎮），
   而 `isInTown()` 讀的就是這個欄位——`wastesResourceInTown()` 會把隊友的
   加速術（吃 15 HP）、治癒術、場域類技能整批擋掉。
   實測：祭司隊友放得出天使之賜福，加速術卻一次都放不出來。 */
{
  const gg = H.boot();
  H.mkChar(gg, { path: ['swordsman'], job: 'swordsman', baseLevel: 90 });
  const field = gg.MAPS.find(m => (m.monsters || []).length > 0);
  gg.changeMap(field.id);

  const gp = H.boot();
  H.mkChar(gp, { path: ['acolyte', 'priest'], job: 'priest', baseLevel: 90 });
  gp.state.name = '牧師甲';
  gp.state.jobSkillPoints = { novice: 400, acolyte: 400, priest: 400 };
  ['blessing', 'increaseagi'].forEach(id => { for (let i = 0; i < 10; i++) gp.levelUpSkill(id); });
  gp.state.autoSupportSkills = { blessing: true, increaseagi: true };
  gp.recomputeDerived(true);
  t.ok('快照來源本人待在城鎮（這正是會踩雷的情境）',
    (gp.MAPS.find(m => m.id === gp.state.mapId) || { monsters: [] }).monsters.length === 0);

  const pr = gg.buildAllySnapshot(JSON.parse(JSON.stringify(gp.state)), 1);
  gg.state.allies = [pr];
  H.mon(gg, { minHp: 9e8 });
  gg.withAlly(pr, () => { t.eq('換身時地圖跟著玩家走', gg.state.mapId, field.id); });
  t.ok('換身結束後玩家的地圖沒被動到', gg.state.mapId === field.id);

  gg.alliesTick();
  const has = id => gg.state.buffs.some(b => b.skillId === id);
  t.ok('天使之賜福傳到玩家身上', has('blessing'));
  t.ok('加速術也傳到玩家身上（吃 HP 的技能不再被誤判成在城鎮）', has('increaseagi'));
}

/* ---------- 偷竊／貪婪要照掉落率加權（#109）---------- */
{
  const gg = H.boot();
  const mon = Object.values(gg.MONSTERS).filter(m => (m.drops || []).length >= 4)
    .sort((a, b) => {
      const r = x => Math.max(...x.drops.map(d => d.chance)) / Math.min(...x.drops.map(d => d.chance));
      return r(b) - r(a);
    })[0];
  const rarest = mon.drops.slice().sort((a, b) => a.chance - b.chance)[0];
  const N = 40000;
  let hit = 0;
  for (let i = 0; i < N; i++) { if (gg.pickWeightedDrop(mon.drops) === rarest) hit++; }
  const pct = hit / N * 100;
  const uniform = 100 / mon.drops.length;
  t.ok('最稀有的那項不再是均分的機率', pct < uniform / 10,
    `${mon.name} 最稀有 ${(rarest.chance * 100).toFixed(3)}%：加權 ${pct.toFixed(3)}% / 均分 ${uniform.toFixed(1)}%`);
  const expectPct = rarest.chance / mon.drops.reduce((a, d) => a + d.chance, 0) * 100;
  t.ok('加權後的機率貼近理論值', Math.abs(pct - expectPct) < 0.1,
    `實測 ${pct.toFixed(3)}% / 理論 ${expectPct.toFixed(3)}%`);
  t.ok('掉落率 0 的項目不會被挑到', gg.pickWeightedDrop([{ item: 'x', chance: 0 }]) === null);
  t.ok('空表回 null', gg.pickWeightedDrop([]) === null);
}

process.exit(t.report('隊友系統'));
