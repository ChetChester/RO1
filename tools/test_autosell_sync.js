/* 自動販賣清單跨存檔同步（#140）。

   清單本來就是**每個角色一份**，這次不改那件事，只加一條「從別的存檔抄過來」。
   會安靜出錯的地方有三種，全都不會噴例外：

     · 抄進來的 id 這一版已經不存在／賣不掉 —— 清單上看得到，永遠不會被賣
     · 抄進來的 id 這個角色**鎖定**了 —— 同上，而且鎖定的意義被繞過去了
     · 覆蓋跟合併寫反 —— 合併把原本的洗掉，玩家一鍵丟掉整份設定

   另外要驗**來源存檔不能被動到**：同步是單向讀取，寫回去的話等於兩個角色綁在一起。 */
const H = require('./harness');
const t = H.tester();

const SELLABLE = ['jellopy', 'fluff', 'apple'];
// 在別的存檔格塞一個角色，附帶一份自動販賣清單
function putSave(g, slot, name, items) {
  g.localStorage.setItem(g.SAVE_KEY_PREFIX + slot, JSON.stringify({
    name, jobId: 'knight', baseLevel: 55,
    autoSellConfig: { enabled: true, items: items },
  }));
}
function fresh(items) {
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 60 });
  putSave(g, 1, '倉庫工', items || SELLABLE.slice());
  return g;
}
const listOf = g => (g.state.autoSellConfig || {}).items || [];

/* ---------- 候選清單 ---------- */
{
  const g = fresh();
  putSave(g, 2, '空手', []);
  g.localStorage.setItem(g.SAVE_KEY_PREFIX + '3', 'not json at all');
  const cands = g.autoSellSyncCandidates();
  t.eq('列出得到的存檔數（壞檔與空格不算）', cands.length, 2, cands.map(c => c.slot + ':' + c.name).join('、'));
  t.eq('不會把自己列進去', cands.filter(c => c.slot === '0').length, 0);
  const one = cands.find(c => c.slot === '1');
  t.eq('名字讀得到', one && one.name, '倉庫工');
  t.eq('種類數量讀得到', one && one.count, 3);
  t.eq('職業名稱解析得出來（不是印 id）', one && one.jobName, g.JOB_TREE.knight.name);
  t.eq('空清單的存檔顯示 0 種', (cands.find(c => c.slot === '2') || {}).count, 0);
}

/* ---------- 覆蓋 vs 合併 ---------- */
{
  const g = fresh();
  g.toggleAutoSellItem('red_potion');
  t.eq('前提：本來只有紅水', listOf(g).join(), 'red_potion');
  t.ok('覆蓋成功', g.syncAutoSellFrom('1', 'replace'));
  t.eq('覆蓋＝整份換掉，本來的不留', listOf(g).join(), SELLABLE.join());
}
{
  const g = fresh();
  g.toggleAutoSellItem('red_potion');
  t.ok('合併成功', g.syncAutoSellFrom('1', 'merge'));
  t.eq('合併＝原本的留著、缺的補上', listOf(g).join(), ['red_potion'].concat(SELLABLE).join());
}
{
  // 合併同一份兩次不該長出重複
  const g = fresh();
  g.syncAutoSellFrom('1', 'merge');
  g.syncAutoSellFrom('1', 'merge');
  t.eq('合併兩次不會重複', listOf(g).length, new Set(listOf(g)).size);
}

/* ---------- 抄進來之前要過濾 ---------- */
{
  const g = fresh(['jellopy', 'no_such_item_id_xyz', 'relic_mage_head', 'jellopy', 'fluff']);
  g.syncAutoSellFrom('1', 'replace');
  t.eq('本作沒有的 id 不會被抄進來', listOf(g).indexOf('no_such_item_id_xyz'), -1);
  t.eq('遺物不會被抄進來（本來就賣不掉）', listOf(g).indexOf('relic_mage_head'), -1);
  t.eq('來源自己重複的也只留一份', listOf(g).join(), 'jellopy,fluff');
}
{
  // 鎖定是這個角色自己的設定，別人的清單不能繞過去
  const g = fresh();
  g.state.lockedItems = { fluff: 1 };
  t.ok('前提：真的鎖住了', g.isItemLocked('fluff'));
  g.syncAutoSellFrom('1', 'replace');
  t.eq('鎖定的道具不會被抄進來', listOf(g).indexOf('fluff'), -1);
  t.eq('其餘照抄', listOf(g).join(), 'jellopy,apple');
  const r = g.readAutoSellList('1');
  t.eq('跳過的數量回報得出來（訊息要講）', r.locked, 1);
}

/* ---------- 不該發生的副作用 ---------- */
{
  const g = fresh();
  const before = g.localStorage.getItem(g.SAVE_KEY_PREFIX + '1');
  g.syncAutoSellFrom('1', 'replace');
  t.eq('來源存檔原封不動', g.localStorage.getItem(g.SAVE_KEY_PREFIX + '1'), before);
  t.eq('不會順便幫你打開自動販賣', g.state.autoSellConfig.enabled, false);
  // 抄過來的是複本，不是同一個陣列（共用的話改一邊會動到另一邊）
  g.toggleAutoSellItem('red_potion');
  t.eq('抄過來之後再加東西，來源不受影響',
    JSON.parse(g.localStorage.getItem(g.SAVE_KEY_PREFIX + '1')).autoSellConfig.items.length, 3);
}
{
  const g = fresh();
  g.toggleAutoSellItem('red_potion');
  t.eq('讀不到的存檔格：回 false', g.syncAutoSellFrom('9', 'replace'), false);
  t.eq('而且不能把現有清單清掉', listOf(g).join(), 'red_potion');
}

/* ---------- 抄完要真的能賣 ----------
   前面驗的都是清單長相；這裡走真正的販賣函式，確認抄進來的 id 真的被吃。 */
{
  const g = fresh();
  g.syncAutoSellFrom('1', 'replace');
  g.addItem('jellopy', 20); g.addItem('fluff', 5);
  const gold0 = g.state.gold;
  t.ok('抄進來的清單真的賣得動', g.autoSellSelectedItems());
  t.eq('該賣的賣光了', g.getItemQty('jellopy'), 0);
  t.ok('錢有進來', g.state.gold > gold0, gold0 + ' → ' + g.state.gold);
}

process.exit(t.report('自動販賣清單跨存檔同步'));
