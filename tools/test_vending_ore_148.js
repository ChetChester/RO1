/* 露天商店的上架清單，以及原石的「全部合成」（#148）。

   露天商店的 UI 從「佔滿背包分頁」改成浮動視窗（左背包／右上架，最多 3 樣），
   但真正會安靜壞掉的是**引擎那半邊**：

     · 上架超過 3 樣（設定寫進去了，賣的時候只認前 3 個，玩家看不出來）
     · 鎖定的道具被擺上去（鎖定的意義被繞過）
     · 精煉／插卡過的個體裝備被賣掉（連卡帶精煉一起消失，不可逆）

   原石合成則是數量守恆的問題：一次合成一份要點六十下，
   「全部合成」少扣或多扣都不會噴錯，只會少東西。 */
const H = require('./harness');
const t = H.tester();

function merchant() {
  const g = H.boot();
  H.mkChar(g, { path: ['merchant'], job: 'merchant', baseLevel: 60, gold: 1e6 });
  g.state.jobSkillPoints.merchant = 60;
  H.learn(g, 'vending', 1);
  return g;
}
const vend = g => (g.state.vendingConfig || {}).items || [];

/* ---------- 上架清單 ---------- */
{
  const g = merchant();
  t.ok('前提：露天商店學起來了', !!g.state.learnedSkills.vending);
  g.setVendingItems(['jellopy', 'fluff', 'apple']);
  t.eq('三樣擺得上', vend(g).join(), 'jellopy,fluff,apple');
  g.setVendingItems(['jellopy', 'fluff', 'apple', 'meat', 'red_potion']);
  t.eq('超過上限的被切掉', vend(g).length, 3);
  t.eq('留下的是前三樣', vend(g).join(), 'jellopy,fluff,apple');
}

/* ---------- 真的賣得動，而且照倍率 ---------- */
{
  const g = merchant();
  const sk = g.findSkillById('vending');
  const mult = sk.sellMultiplier || 10;
  g.setVendingItems(['jellopy']);
  g.addItem('jellopy', 10);
  const gold0 = g.state.gold, qty0 = g.getItemQty('jellopy');
  g.state.vendingReadyAt = 0;
  g.tryAutoVending();
  t.eq('一次只賣 1 個', qty0 - g.getItemQty('jellopy'), 1);
  t.eq('賣價＝原價 × 倍率', g.state.gold - gold0, Math.round(g.ITEMS.jellopy.sell * mult));
  // 冷卻沒到就不再賣
  const gold1 = g.state.gold;
  g.tryAutoVending();
  t.eq('冷卻內不會再賣', g.state.gold, gold1);
}
{
  // 鎖定的道具不賣（清單上有也一樣）
  const g = merchant();
  g.setVendingItems(['jellopy']);
  g.addItem('jellopy', 10);
  g.state.lockedItems = { jellopy: 1 };
  t.ok('前提：真的鎖住了', g.isItemLocked('jellopy'));
  const gold0 = g.state.gold;
  g.state.vendingReadyAt = 0;
  g.tryAutoVending();
  t.eq('鎖定的道具一個都沒被賣掉', g.getItemQty('jellopy'), 10);
  t.eq('也沒有進帳', g.state.gold, gold0);
}
{
  /* 個體裝備（精煉過／插過卡）不能被露天商店賣掉——那一件被賣等於連卡帶精煉消失。
     `tryAutoVending` 找的是 `!r.instanceId` 的那一列，所以背包裡只有個體版時賣不出去。 */
  const g = merchant();
  const w = Object.keys(g.ITEMS).find(k => g.ITEMS[k].type === 'weapon'
    && g.ITEMS[k].sell > 0 && !g.equipBlockReason(k));
  g.addItem(w, 1);
  g.equipItem(w);
  /* 直接建個體紀錄。走 refineItem() 的話成功率是機率性的，
     測試會偶爾因為「精煉失敗」而紅，那不是這條要驗的東西。 */
  g.getOrCreateEquipInstance('weapon');
  g.unequipItem('weapon');
  const inst = g.state.inventory.find(r => r.item === w && r.instanceId);
  t.ok('前提：背包裡是個體裝備', !!inst, JSON.stringify(g.state.inventory.filter(r => r.item === w)));
  g.setVendingItems([w]);
  const gold0 = g.state.gold;
  g.state.vendingReadyAt = 0;
  g.tryAutoVending();
  t.ok('個體裝備不會被露天商店賣掉', !!g.state.inventory.find(r => r.item === w && r.instanceId));
  t.eq('也沒有進帳', g.state.gold, gold0);
}
{
  // 不是商人就不跑（露天商店是商人的招牌技能）
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman'], job: 'swordsman', baseLevel: 60 });
  g.setVendingItems(['jellopy']);
  g.addItem('jellopy', 10);
  const gold0 = g.state.gold;
  g.state.vendingReadyAt = 0;
  g.tryAutoVending();
  t.eq('劍士擺了也不會賣', g.state.gold, gold0);
}

/* ---------- 原石全部合成 ---------- */
{
  const g = merchant();
  const keys = Object.keys(g.ORE_SYNTHESIS);
  t.ok('原石配方抓得到（後面的斷言才有意義）', keys.length >= 2, keys.join('、'));
  keys.forEach(k => {
    const r = g.ORE_SYNTHESIS[k];
    const g2 = merchant();
    // 剛好 3 份多一點，驗餘數會不會被吞掉
    const have = r.need * 3 + (r.need - 1);
    g2.addItem(r.from, have);
    const to0 = g2.getItemQty(r.to);
    const n = g2.synthesizeOreAll(k);
    t.eq(g.ITEMS[r.from].name + '：合成份數算得對', n, 3);
    t.eq(g.ITEMS[r.to].name + '：產出份數對得上', g2.getItemQty(r.to) - to0, 3);
    t.eq(g.ITEMS[r.from].name + '：除不盡的餘數留著', g2.getItemQty(r.from), r.need - 1);
  });
}
{
  const g = merchant();
  const k = Object.keys(g.ORE_SYNTHESIS)[0];
  const r = g.ORE_SYNTHESIS[k];
  // 不足一份就不動任何東西
  g.addItem(r.from, r.need - 1);
  const before = g.getItemQty(r.from), to0 = g.getItemQty(r.to);
  t.eq('不足一份時回 0', g.synthesizeOreAll(k), 0);
  t.eq('原石沒被吃掉', g.getItemQty(r.from), before);
  t.eq('也沒有憑空產出', g.getItemQty(r.to), to0);
  t.eq('不存在的配方回 0', g.synthesizeOreAll('no_such_recipe'), 0);
}
{
  // 一次合成完 vs 一份一份合成，結果要一模一樣
  const k = 'oridecon';
  const a = merchant(), b = merchant();
  const r = a.ORE_SYNTHESIS[k];
  const have = r.need * 7 + 2;
  a.addItem(r.from, have); b.addItem(r.from, have);
  a.synthesizeOreAll(k);
  for (let i = 0; i < 7; i++) b.synthesizeOre(k);
  t.eq('全部合成＝逐份合成（產出）', a.getItemQty(r.to), b.getItemQty(r.to));
  t.eq('全部合成＝逐份合成（剩料）', a.getItemQty(r.from), b.getItemQty(r.from));
}

process.exit(t.report('露天商店上架與原石全部合成'));
