/* 職業套卡（五張一組）（#134）。

   玩家回報「烏龜套卡沒有實裝」。查下去不是烏龜一組的問題：官方把整組套裝的說明
   寫在其中一張主卡的說明欄裡，早年的匯入器分不出「這張卡自己的效果」與「湊齊
   五張才有的效果」，於是套裝那幾行的數字被**無條件**塞進主卡的 bonus，
   而湊齊才有的觸發型效果（自動念咒、擊殺掉落）從來沒進過資料。
   症狀是雙向的：一張卡就白拿全套獎勵，湊滿了卻什麼都不會發生。

   所以這支盯的是**兩個方向**，只驗其中一邊會漏掉一半的 bug：
     單張時「不該有」的加成確實沒有
     湊齊時「該有」的加成、觸發、以及畫面上的套裝標籤確實出現

   不重抄 data.js 的數字：拿主卡的 condBonus 當基準自己比對，
   這樣改數值不會讓測試變紅，接線斷掉才會。 */
const H = require('./harness');
const t = H.tester();

// 主卡 → 它所屬的職業血脈（拿來驗 jobLine 那一段開得起來）
const HUBS = {
  assulter_card: ['swordsman', 'knight'],
  c_tower_manager_card: null,
  novus_card: null,
  loli_ruri_card: null,
  geographer_card: ['acolyte', 'priest'],
  waste_stove_card: ['acolyte', 'monk'],
  hylozoist_card: ['merchant', 'blacksmith'],
  mole_card: null,
  the_paper_card: null,
  merman_card: ['archer', 'hunter'],
};

/* 建角 + 把指定的卡片全部插上（一張卡一個部位）。
   武器欄不在 harness.wear 的部位表裡，所以自己處理。
   武器分類**不能寫死**：套卡的驗證會換成服事、弓箭手、商人去跑，
   那幾個職業拿不動單手劍，寫死的話武器欄會是空的，插在武器上的那張卡
   就靜靜地插不進去——測試看起來是「套裝沒生效」，其實是治具沒穿武器。 */
const WEAPON_CATS = ['sword1', 'mace', 'bow', 'dagger', 'axe1', 'rod1', 'knuckle', 'spear1', 'katar', 'book'];
function build(cards, opts) {
  const g = H.boot();
  H.mkChar(g, Object.assign({ path: ['swordsman', 'knight'], job: 'knight' }, opts || {}));
  WEAPON_CATS.some(c => H.wield(g, c));
  /* 同一個部位要放兩張卡時（盜賊套卡有兩張飾品卡）不能重用 harness.insertCard：
     它每次都挑「第一件有孔的同部位裝備」，第二次挑到的是已經戴著的那一件，
     裝不上去就整張卡默默漏掉。所以自己記帳，第二件換一件沒戴過的。 */
  const ARMOR_TYPE = { armor: 'leather', shield: 'shield', garment: 'garment', footgear: 'footgear', headgear: 'headgear', accessory: 'accessory' };
  const used = new Set();
  const failed = [];
  cards.forEach(id => {
    const c = g.CARDS[id];
    if (c.slot === 'weapon') {
      g.addItem(id, 1);
      if (!g.insertCard('weapon', id)) failed.push(id);
      return;
    }
    const at = ARMOR_TYPE[c.slot] || 'leather';
    const gear = Object.keys(g.ITEMS).find(k => {
      const it = g.ITEMS[k];
      return it.type === 'armor' && it.armorType === at && it.slots && !used.has(k)
        && !(it.reqLevel && it.reqLevel > g.state.baseLevel) && !g.equipBlockReason(k);
    });
    if (!gear) { failed.push(id); return; }
    used.add(gear);
    g.addItem(gear, 1);
    g.equipItem(gear);
    g.recomputeDerived(true);
    const slot = g.EQUIP_SLOTS_ALL.find(s => g.getEquipBaseItemId(s) === gear);
    g.addItem(id, 1);
    if (!slot || !g.insertCard(slot, id)) failed.push(id);
  });
  g.recomputeDerived(true);
  return { g, failed };
}

const G0 = H.boot();

/* ---------- 資料完整性：成員卡片都存在、玩家都拿得到 ---------- */
{
  const g = G0;
  const reachMon = new Set();
  g.MAPS.forEach(m => (m.monsters || []).forEach(x => reachMon.add(typeof x === 'string' ? x : x.id)));
  Object.values(g.MVP_MAP_DATA || {}).forEach(a => (a || []).forEach(x => reachMon.add(x)));
  const gettable = new Set();
  reachMon.forEach(id => {
    const m = g.MONSTERS[id];
    if (m) (m.drops || []).forEach(d => gettable.add(d.item));
  });
  Object.entries(g.MONSTER_CARD_DROPS || {}).forEach(([mid, v]) => { if (reachMon.has(mid)) gettable.add(v.card); });

  let missing = 0, unreachable = [], hubs = 0;
  Object.keys(HUBS).forEach(hub => {
    const c = g.CARDS[hub];
    if (!c) { missing++; return; }
    hubs++;
    (c.condBonus || []).forEach(cb => {
      ((cb.when && cb.when.withCards) || []).forEach(m => {
        if (!g.CARDS[m]) missing++;
        else if (!gettable.has(m)) unreachable.push(g.CARDS[m].name);
      });
    });
  });
  t.eq('十張主卡都還在 CARDS 裡', hubs, Object.keys(HUBS).length);
  t.eq('套卡成員沒有指向不存在的卡片', missing, 0);
  t.ok('套卡成員玩家都打得到', unreachable.length === 0, unreachable.join('、'));
}

/* ---------- 全庫掃描：套裝那一段的接線有沒有寫錯 ---------- */
{
  const g = G0;
  let badSkill = 0, badItem = 0, named = 0, orphanName = 0;
  Object.values(g.CARDS).forEach(c => {
    (c.condBonus || []).forEach(cb => {
      if (cb.setName) named++;
      // 標了 setName 卻不是「湊齊才有」的條件，那個標籤會在單張時就亮起來
      if (cb.setName && !(cb.when && cb.when.withCards)) orphanName++;
    });
    (c.autoSpell || []).forEach(a => { if (!g.findSkillAnywhere(a.skill)) badSkill++; });
    (c.killDrop || []).forEach(d => (d.items || []).forEach(i => { if (!g.ITEMS[i]) badItem++; }));
    Object.keys(c.bonus || {}).forEach(k => {
      if (k.startsWith('skillDmg_') && !g.findSkillAnywhere(k.slice(9))) badSkill++;
      if (k.startsWith('itemHeal_') && !g.ITEMS[k.slice(9)]) badItem++;
    });
    (c.condBonus || []).forEach(cb => Object.keys(cb.bonus || {}).forEach(k => {
      if (k.startsWith('skillDmg_') && !g.findSkillAnywhere(k.slice(9))) badSkill++;
      if (k.startsWith('itemHeal_') && !g.ITEMS[k.slice(9)]) badItem++;
    }));
  });
  t.eq('卡片的自動念咒與 skillDmg_ 都指向存在的技能', badSkill, 0);
  t.eq('卡片的擊殺掉落與 itemHeal_ 都指向存在的道具', badItem, 0);
  t.ok('已經標好名稱的套裝段數 ≥ 10', named >= 10, '目前 ' + named + ' 段');
  t.eq('套裝標籤都掛在「湊齊才有」的條件上', orphanName, 0);
}

/* ---------- 烏龜套卡：單張 vs 湊齊 ---------- */
const TURTLE = ['assulter_card', 'permeter_card', 'solider_card', 'freezer_card', 'heater_card'];
{
  const solo = build(['assulter_card']);
  t.eq('五張卡都插得上（後面的斷言才有意義）', solo.failed.length, 0);
  const g = solo.g;
  // 主卡自己的官方效果：暴擊傷害與對人型系的 CRI
  t.ok('單張主卡有自己的暴擊傷害加成', g.state.cardCritDmgPct > 0);
  t.ok('單張主卡有對人型系的 CRI 加成', (g.state.cardRaceCrit || {}).humanoid > 0);
  // 這四項是**全套**的獎勵，一張卡不該白拿（修好之前就是這樣）
  t.eq('單張主卡不給套裝的 MaxHP%', g.getCardBonus('hpPct'), 0);
  t.eq('單張主卡不給套裝的 STR', g.getCardBonus('str'), 0);
  t.eq('單張主卡不給套裝的 HP 恢復力', g.state.cardHpRegenPct, 0);
  t.eq('單張主卡沒有套裝的自動念咒', g.state.cardAutoSpells.attack.length, 0);
  t.eq('單張主卡沒有套裝的擊殺掉落', g.state.cardKillDrops.length, 0);
  t.eq('單張時畫面上不會出現套裝標籤', g.activeEquipSets().length, 0);
}
{
  const { g, failed } = build(TURTLE);
  t.eq('湊齊五張都插得上', failed.length, 0);
  const cb = g.CARDS.assulter_card.condBonus[0].bonus;
  t.eq('湊齊 → MaxHP% 生效', g.getCardBonus('hpPct'), cb.hpPct);
  t.eq('湊齊 → STR 生效', g.getCardBonus('str'), cb.str);
  t.eq('湊齊 → HP 恢復力進了戰鬥讀的那一格', g.state.cardHpRegenPct, cb.hpRegenPct);
  t.eq('湊齊 → 攻擊時的自動念咒進了籃子', g.state.cardAutoSpells.attack.length, 1);
  t.eq('自動念咒指向無視體型攻擊', g.state.cardAutoSpells.attack[0].skill, 'overthrust');
  t.eq('湊齊 → 擊殺掉落進了籃子', g.state.cardKillDrops.length, 1);
  // MaxHP% 是乘在最後的，湊齊前後的比值就是那個百分比
  const solo = build(['permeter_card', 'solider_card', 'heater_card']).g;
  t.ok('MaxHP 真的變多（不是只有加成表有數字）', g.state.maxHp > solo.state.maxHp);
  t.eq('湊齊時畫面上有兩段套裝標籤（通用段＋劍士段）', g.activeEquipSets().length, 2);
  t.ok('套裝標籤叫得出名字', /烏龜套卡/.test(g.activeEquipSets()[0].name), g.activeEquipSets()[0].name);
}

/* ---------- 「當套裝裝備者是○○系列時」那一段 ---------- */
{
  const sw = build(TURTLE, { path: ['swordsman', 'knight'], job: 'knight' }).g;
  const th = build(TURTLE, { path: ['thief', 'assassin'], job: 'assassin' }).g;
  t.eq('劍士湊齊 → 紅水恢復量加成生效', sw.state.itemHealBonus.red_potion > 0, true);
  t.eq('非劍士湊齊 → 紅水恢復量沒有加成', (th.state.itemHealBonus || {}).red_potion || 0, 0);
  t.eq('非劍士湊齊 → 通用那一段照樣生效', th.getCardBonus('hpPct'), sw.getCardBonus('hpPct'));
  t.eq('非劍士只亮通用那一段的標籤', th.activeEquipSets().length, 1);
}

/* ---------- 烏龜成員各自的單卡效果 ---------- */
{
  const g = build(['solider_card']).g;
  t.ok('巖石龜卡片補上了 MDEF（官方是 DEF+2、MDEF+2）', g.getCardBonus('mdef') > 0);
}
{
  const sw = build(['heater_card'], { path: ['swordsman', 'knight'], job: 'knight' }).g;
  const th = build(['heater_card'], { path: ['thief', 'assassin'], job: 'assassin' }).g;
  t.ok('火焰龜的 CRI 不分職業', sw.getCardBonus('critRate') > 0 && th.getCardBonus('critRate') > 0);
  t.ok('火焰龜的完全迴避只有劍士系列拿得到',
    sw.getCardBonus('perfectDodge') > 0 && th.getCardBonus('perfectDodge') === 0);
}
{
  const { g } = build(['freezer_card']);
  const slot = g.EQUIP_SLOTS_ALL.find(s => {
    const inst = g.getEquipInstance(s);
    return inst && (inst.cards || []).includes('freezer_card');
  });
  t.eq('水靈龜精煉 +0 時沒有狂擊加成', g.getCardBonus('skillDmg_bash'), 0);
  H.refine(g, slot, 9);
  t.ok('水靈龜精煉 +9 → 狂擊傷害加成生效', g.getCardBonus('skillDmg_bash') > 0);
  t.ok('水靈龜不再掛著「未實作」標記', !g.CARDS.freezer_card.unimplemented);
}

/* ---------- 其餘各組主卡：單張不給、湊齊才給 ---------- */
Object.entries(HUBS).forEach(([hub, path]) => {
  if (hub === 'assulter_card') return;         // 上面已經整組驗過
  const g0 = G0;
  const cb0 = (g0.CARDS[hub].condBonus || [])[0];
  if (!cb0 || !cb0.when || !cb0.when.withCards) { t.ok(hub + ' 有湊齊才生效的那一段', false); return; }
  const key = Object.keys(cb0.bonus)[0];
  const opts = path ? { path, job: path[path.length - 1] } : undefined;
  const solo = build([hub], opts).g;
  const full = build([hub].concat(cb0.when.withCards), opts).g;
  const name = g0.CARDS[hub].name;
  t.ok(name + '：湊齊 → ' + key + ' 生效',
    full.getCardBonus(key) > solo.getCardBonus(key),
    '單張 ' + solo.getCardBonus(key) + ' → 湊齊 ' + full.getCardBonus(key));
  t.ok(name + '：湊齊 → 畫面亮出套裝標籤', full.activeEquipSets().length > 0);
});

process.exit(t.report('職業套卡'));
