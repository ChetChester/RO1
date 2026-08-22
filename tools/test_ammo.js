/* 箭矢：自動選箭種與自動補貨（#129）。

   `state.equip.ammo` 只記「選了哪一種箭」，箭本體放在背包。以前沒有任何地方
   會自動填這個欄位——弓箭手轉職拿到 1000 支鋼鐵箭矢，背包裡明明有箭，
   `getAmmoCount()` 卻回 0，攻擊只印「沒有箭矢」；而 `tryAutoBuyArrow()`
   第一行就是 `if (!id) return`，等於買不了也用不到，整條路自己鎖死。

   隊友那邊 2026-08-15 修過同一個症狀，玩家這邊漏了一年。

   驗的是**整條弓箭手線**（弓／樂器／鞭都算 needsAmmo），不是只驗弓箭手：
   舞孃是女性限定、詩人是男性限定，性別給錯的話 doJobChange 會安靜失敗、
   角色停在弓箭手——那樣測起來會全過但什麼都沒驗到。 */
const H = require('./harness');
const t = H.tester();

// [職業, 轉職鏈, 性別, 要不要轉生]
const LINE = [
  ['archer', ['archer'], 'male', false],
  ['hunter', ['archer', 'hunter'], 'male', false],
  ['bard', ['archer', 'bard'], 'male', false],
  ['dancer', ['archer', 'dancer'], 'female', false],
  ['clown', ['archer', 'bard'], 'male', true],
  ['gypsy', ['archer', 'dancer'], 'female', true],
];

function mk(job, path, gender, rebirth, gold) {
  const g = H.boot();
  H.mkChar(g, { path, job, gender, rebirth, baseLevel: 120, gold: gold == null ? 1e7 : gold });
  return g;
}
// 這個職業穿得上、屬於某一類的武器
function pick(g, cat) {
  return Object.keys(g.ITEMS).find(k => {
    const it = g.ITEMS[k];
    return it.type === 'weapon' && g.aspdCategoryOf(k) === cat
      && !(it.reqLevel > g.state.baseLevel) && !g.equipBlockReason(k);
  });
}
const clearArrows = g => {
  g.state.inventory = g.state.inventory.filter(r => !g.ITEMS[r.item] || !g.ITEMS[r.item].ammo);
};

/* ---------- 前提：六個職業都真的轉成功 ---------- */
LINE.forEach(([job, path, gender, rebirth]) => {
  const g = mk(job, path, gender, rebirth);
  t.eq(`${job} 真的轉職成功（性別對）`, g.state.jobId, job);
});

/* ---------- 背包有箭 → 自動裝上，不必手動選 ---------- */
{
  const g = mk('archer', ['archer'], 'male', false);
  const bow = pick(g, 'bow');
  t.ok('弓箭手找得到穿得上的弓', !!bow);
  t.ok('轉職禮真的給了箭', g.getItemQty('steel_arrow') > 0);
  g.addItem(bow, 1); g.equipItem(bow);
  t.ok('裝上弓之後 needsAmmo 成立', g.needsAmmo());
  t.eq('裝弓的當下就自動選好箭種', g.state.equip.ammo, 'steel_arrow');
  t.ok('箭數讀得到（不再是 0）', g.getAmmoCount() > 0, '實際 ' + g.getAmmoCount());
}

/* ---------- 背包沒箭 → 自動買 ---------- */
{
  const g = mk('hunter', ['archer', 'hunter'], 'male', false);
  clearArrows(g);
  const bow = pick(g, 'bow');
  g.addItem(bow, 1); g.equipItem(bow);
  t.eq('一支箭都沒有時，箭種仍會填上預設值', g.state.equip.ammo, 'steel_arrow');
  t.eq('這時候當然是 0 支', g.getAmmoCount(), 0);
  const gold0 = g.state.gold;
  g.tryAutoBuyArrow();
  t.ok('自動補箭買到了箭', g.getAmmoCount() > 0, '實際 ' + g.getAmmoCount());
  t.ok('而且真的付了錢', g.state.gold < gold0);
}

/* ---------- 關掉自動購買，背包現成的箭仍然用得到 ---------- */
{
  const g = mk('archer', ['archer'], 'male', false);
  g.state.autoBuyArrow = false;
  const bow = pick(g, 'bow');
  g.addItem(bow, 1); g.equipItem(bow);
  t.ok('自動購買關掉也會自動選箭種', g.getAmmoCount() > 0, '實際 ' + g.getAmmoCount());
  // 但不該偷買
  const gold0 = g.state.gold;
  clearArrows(g);
  g.tryAutoBuyArrow();
  t.eq('關掉之後不會偷偷買', g.state.gold, gold0);
}

/* ---------- 錢不夠就安靜跳過，不會變成負數 ---------- */
{
  const g = mk('archer', ['archer'], 'male', false, 10);
  clearArrows(g);
  const bow = pick(g, 'bow');
  g.addItem(bow, 1); g.equipItem(bow);
  g.tryAutoBuyArrow();
  t.eq('買不起就不買', g.getAmmoCount(), 0);
  t.ok('鋅幣不會變負數', g.state.gold >= 0, '實際 ' + g.state.gold);
}

/* ---------- 整條線 × 弓／樂器／鞭 ---------- */
{
  const fails = [];
  let combos = 0;
  LINE.forEach(([job, path, gender, rebirth]) => {
    ['bow', 'instrument', 'whip'].forEach(cat => {
      const g = mk(job, path, gender, rebirth);
      const w = pick(g, cat);
      if (!w) return;                       // 這個職業拿不動這一類，跳過
      combos++;
      clearArrows(g);
      g.addItem(w, 1); g.equipItem(w);
      g.tryAutoBuyArrow();
      if (!g.needsAmmo() || g.getAmmoCount() <= 0) fails.push(`${job}/${cat}`);
    });
  });
  t.ok('測到的組合夠多（至少涵蓋弓＋樂器＋鞭）', combos >= 8, combos + ' 組');
  t.eq('整條弓箭手線都補得到箭', fails.join(', '), '');
  // 舞孃拿鞭、詩人拿樂器是這條線的招牌，缺一個就代表職業限制或攻速表壞了
  const dancer = mk('dancer', ['archer', 'dancer'], 'female', false);
  t.ok('舞孃拿得動鞭子', !!pick(dancer, 'whip'));
  const bard = mk('bard', ['archer', 'bard'], 'male', false);
  t.ok('詩人拿得動樂器', !!pick(bard, 'instrument'));
}

/* ---------- 不用箭的職業不該被牽連 ---------- */
{
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 120, gold: 1e7 });
  const sword = Object.keys(g.ITEMS).find(k => g.ITEMS[k].type === 'weapon'
    && g.aspdCategoryOf(k) === 'sword1' && !(g.ITEMS[k].reqLevel > 120) && !g.equipBlockReason(k));
  g.addItem(sword, 1); g.equipItem(sword);
  const gold0 = g.state.gold;
  g.ensurePlayerAmmo();
  g.tryAutoBuyArrow();
  t.ok('騎士不會被塞箭種', !g.state.equip.ammo);
  t.eq('也不會替他買箭', g.state.gold, gold0);
}

/* ---------- 武器商人要賣**全部**的箭矢（#139）----------
   以前那份清單是手抄的 8 種，而遊戲裡有 26 種——屬性箭（影子、無形、鐵鏽）、
   異常狀態箭（昏迷、冰凍、睡眠、寧靜、詛咒、毒）、高階箭（神之金屬、破魔、精靈）
   全都買不到。改成用 type 掃，所以這裡驗的是「一種都沒漏」，
   而不是重抄一份清單對答案——重抄的話漏的那幾種兩邊會一起漏。 */
{
  const g = H.boot();
  H.mkChar(g, { path: ['archer', 'hunter'], job: 'hunter', baseLevel: 99, gold: 1e7 });
  const allAmmo = Object.keys(g.ITEMS).filter(k => g.ITEMS[k].type === 'ammo');
  const listed = g.NPC_SHOPS.weapon.items;
  const missing = allAmmo.filter(id => !listed.includes(id));
  t.ok('全庫箭矢種類抓得到（後面的斷言才有意義）', allAmmo.length >= 20, allAmmo.length + ' 種');
  t.eq('武器商人一種箭矢都沒漏', missing.length, 0,
    missing.map(i => g.ITEMS[i].name).join('、'));
  t.eq('清單裡沒有重複的 id', listed.length, new Set(listed).size);
  // 上架不等於買得到：沒有買價的話商店會顯示 0 鋅幣，等於白送
  const free = allAmmo.filter(id => !(g.ITEMS[id].buyPrice > 0));
  t.eq('每一種箭矢都有買價', free.length, 0, free.join('、'));
  // getItems() 是實際渲染用的那一支，要真的吐得出來
  const shown = g.NPC_SHOPS.weapon.getItems().filter(id => g.ITEMS[id].type === 'ammo');
  t.eq('商店實際列出的箭矢數等於全部', shown.length, allAmmo.length);
  /* 上架之後，圖鑑對這些箭矢的「取得來源」也要查得到商店那一行——
     `getItemFarmSpots` 之外的那條線讀的是 `shop.items`。 */
  const nowInCodex = g.getCodexPool().items.filter(id => g.ITEMS[id].type === 'ammo');
  t.eq('全部箭矢都進得了圖鑑', nowInCodex.length, allAmmo.length);
}
{
  // 買得起就真的買得到（走玩家實際用的那支購買函式）
  const g = H.boot();
  H.mkChar(g, { path: ['archer', 'hunter'], job: 'hunter', baseLevel: 99, gold: 1e7 });
  const before = g.getItemQty('curse_arrow');
  const ok = g.buyItem('curse_arrow', 100);
  t.ok('以前買不到的詛咒箭矢現在買得到', ok !== false && g.getItemQty('curse_arrow') > before,
    before + ' → ' + g.getItemQty('curse_arrow'));
}

process.exit(t.report('箭矢自動選種與補貨'));
