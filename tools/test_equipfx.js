/* 裝備自己的特效（#127）。

   在這之前，`effectiveGearBonuses()` 只吃「卡片 + 套裝 + 遺物」，裝備本身
   只有 str/atk/def 那幾格平鋪數值進得來——官方描述裡的「對人型系傷害+5%」
   「無視龍族防禦」「攻擊時機率讓敵人出血」全部只印在說明上，沒有程式讀它。
   **不會報錯、測試也不會紅**，所以要有這一支專門盯著那條線。

   驗的是「接線有沒有通」，不是資料本身：不重抄 data.js 裡的數字，
   改用臨時掛上去的假裝備，這樣改資料不會讓測試變紅，斷線才會。 */
const H = require('./harness');
const t = H.tester();

const KNIGHT = ['swordsman', 'knight'];

// 乾淨的角色 + 一件掛了指定特效的武器。
// **不寫死道具 id**：資料在動（#127 就刪掉了幾百件孤兒裝備），現場挑一把穿得上的。
function pickWeapon(g) {
  return Object.keys(g.ITEMS).find(k => {
    const it = g.ITEMS[k];
    return it.type === 'weapon' && !it.reqLevel && !g.equipBlockReason(k)
      && !it.bonus && !it.ailment && !it.autoSpell && !it.grantSkill && !it.condBonus;
  });
}
function wearFx(fx, opts) {
  const g = H.boot();
  // 先有角色才挑得了武器：equipBlockReason() 會去讀職業血脈
  H.mkChar(g, Object.assign({ path: KNIGHT, job: 'knight', baseLevel: 99 }, opts || {}));
  const ID = pickWeapon(g);
  Object.assign(g.ITEMS[ID], fx);
  g.addItem(ID, 1);
  const worn = g.equipItem(ID);
  g.recomputeDerived(true);
  return { g, worn, ID };
}

/* ---------- 數值型加成 ---------- */
{
  const { g, worn, ID } = wearFx({ bonus: { raceDmg_humanoid: 7, critDmgPct: 13 } });
  t.ok('假裝備穿得上（後面的斷言才有意義）', worn);
  t.eq('裝備的 bonus 進得了加成表', g.getCardBonus('raceDmg_humanoid'), 7);
  t.eq('同一份 bonus 的第二個 key 也進得去', g.getCardBonus('critDmgPct'), 13);
  // 進了表還要分流到戰鬥真的會讀的那個桶子，否則等於沒接
  t.eq('分流到 cardRaceDmgBonus（已除以 100）', g.state.cardRaceDmgBonus.humanoid, 0.07);

  // 脫下來要跟著消失——effectiveGearBonuses 是簽章快取的，這裡最容易卡舊值
  g.unequipItem(g.EQUIP_SLOTS_ALL.find(s => g.getEquipBaseItemId(s) === ID));
  g.recomputeDerived(true);
  t.eq('脫下之後加成歸零（快取簽章有跟上）', g.getCardBonus('raceDmg_humanoid'), 0);
}

/* ---------- 依精煉倍增 ---------- */
{
  const { g, ID } = wearFx({ perRefine: { reflectPct: 3 } });
  const slot = g.EQUIP_SLOTS_ALL.find(s => g.getEquipBaseItemId(s) === ID);
  t.eq('精煉 0 時沒有加成', g.getCardBonus('reflectPct'), 0);
  const inst = g.state.instances[g.getOrCreateEquipInstance(slot)];
  inst.refine = 4;
  g.recomputeDerived(true);
  t.eq('精煉 +4 → 3×4', g.getCardBonus('reflectPct'), 12);
}

/* ---------- 條件式 ---------- */
{
  // jobLine：劍士線成立、魔法師線不成立
  const a = wearFx({ condBonus: [{ when: { jobLine: 'swordsman' }, bonus: { def: 5 } }] });
  t.eq('裝備的 condBonus 條件成立時生效', a.g.getCardBonus('def'), 5);
  const b = wearFx({ condBonus: [{ when: { jobLine: 'mage' }, bonus: { def: 5 } }] });
  t.eq('條件不成立時不生效', b.g.getCardBonus('def'), 0);

  // statMin 看的是加點的基礎素質
  const hi = wearFx({ condBonus: [{ when: { statMin: { str: 90 } }, bonus: { hit: 10 } }] },
    { stats: { str: 95, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 } });
  const lo = wearFx({ condBonus: [{ when: { statMin: { str: 90 } }, bonus: { hit: 10 } }] },
    { stats: { str: 10, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 } });
  t.eq('STR95 → 素質門檻成立', hi.g.getCardBonus('hit'), 10);
  t.eq('STR10 → 素質門檻不成立', lo.g.getCardBonus('hit'), 0);
}

/* ---------- 無視物理防禦（這次新加的維度）---------- */
{
  const g0 = H.boot();
  const dragon = Object.values(g0.MONSTERS).find(m => m.race === 'dragon' && m.def > 40);
  const insect = Object.values(g0.MONSTERS).find(m => m.race === 'insect' && m.def > 40);

  const base = wearFx({}).g;
  const rawD = base.defOf(dragon)[0];
  t.ok('沒有無視效果時，怪的防禦照原樣算', rawD > 0);

  const byRace = wearFx({ bonus: { defIgnoreRace_dragon: 100 } }).g;
  t.eq('對指定種族無視 100% → 防禦歸零', byRace.defOf(dragon)[0], 0);
  t.eq('軟防也一起歸零（硬防軟防同比例）', byRace.defOf(dragon)[1], 0);
  t.eq('其他種族完全不受影響', byRace.defOf(insect)[0], base.defOf(insect)[0]);

  const half = wearFx({ bonus: { defIgnorePct: 50 } }).g;
  t.near('不分種族無視 50%', half.defOf(dragon)[0], rawD * 0.5, 0.01);
  t.near('不分種族的版本對昆蟲一樣有效', half.defOf(insect)[0], base.defOf(insect)[0] * 0.5, 0.01);

  const both = wearFx({ bonus: { defIgnorePct: 60, defIgnoreRace_dragon: 60 } }).g;
  t.eq('兩種相加後夾在 100%，不會變成負防禦', both.defOf(dragon)[0], 0);
}

/* ---------- 觸發型：跟卡片共用同一組籃子 ---------- */
{
  const { g } = wearFx({
    ailment: [{ on: 'attack', type: 'bleed', chance: 5 }],
    autoSpell: [{ on: 'hit', skill: 'heal', lv: 3, chance: 5 }],
    killDrop: [{ race: 'brute', items: ['meat'], chance: 5 }],
  });
  t.eq('裝備的 ailment 進得了 attack 籃', g.state.cardAilments.attack.length, 1);
  t.eq('進的是對的那個籃（不是 hit）', g.state.cardAilments.hit.length, 0);
  t.eq('裝備的 autoSpell 進得了 hit 籃', g.state.cardAutoSpells.hit.length, 1);
  t.eq('裝備的 killDrop 收得到', g.state.cardKillDrops.length, 1);

  // 觸發型也吃 when
  const off = wearFx({ ailment: [{ on: 'attack', type: 'bleed', chance: 5, when: { jobLine: 'mage' } }] });
  t.eq('觸發型的 when 條件不成立時不會進籃', off.g.state.cardAilments.attack.length, 0);
}

/* ---------- 裝備賦予技能 ---------- */
{
  const { g } = wearFx({ grantSkill: [{ id: 'pierce', lv: 3 }] });
  t.eq('裝備給的技能查得到等級', g.skillLv('pierce'), 3);
  t.ok('但不會混進玩家自己學的那份', !(g.state.learnedSkills || {}).pierce);
  const g2 = wearFx({ grantSkill: [{ id: '這個技能不存在', lv: 3 }] }).g;
  t.eq('指向不存在的技能時安靜跳過，不炸', g2.skillLv('這個技能不存在'), 0);
}

/* ---------- 資料面：不該再有「說得到、做不到」的可達裝備 ---------- */
{
  const g = H.boot();
  const onMap = new Set();
  g.MAPS.forEach(m => (m.monsters || []).forEach(x => onMap.add(x.id || x)));
  const reach = new Set();
  Object.values(g.MONSTERS).forEach(m => {
    if (onMap.has(m.id)) (m.drops || []).forEach(d => reach.add(d.item || d.id || d));
  });
  Object.values(g.NPC_SHOPS || {}).forEach(s => (s.items || []).forEach(x => reach.add(x)));

  // 掉落表與商店不可以指向已經被刪掉的道具
  let dangling = 0;
  reach.forEach(id => { if (!g.ITEMS[id]) dangling++; });
  t.eq('掉落表／商店沒有指向不存在的道具', dangling, 0);

  /* 「玩家拿得到、描述寫著無視防禦或種族增傷、卻一個欄位都沒有」的裝備數量。
     這是 #127 的驗收條件本身——留幾件是可以的（有些官方效果本作沒有對應機制），
     但不該再回到幾百件的規模。 */
  const PAT = /無視.{0,6}防禦|對.{1,8}系(魔物|敵人).{0,10}(增加|減少)/;
  const naked = [...reach].filter(id => {
    const it = g.ITEMS[id];
    if (!it || (it.type !== 'weapon' && it.type !== 'armor')) return false;
    if (it.bonus || it.condBonus || it.perRefine) return false;
    return PAT.test(it.desc || '');
  });
  t.ok('可達裝備裡「說得到卻做不到」的剩不到 10 件', naked.length < 10,
    naked.length + ' 件：' + naked.slice(0, 5).map(i => g.ITEMS[i].name).join('、'));
}

process.exit(t.report('裝備自身特效'));
