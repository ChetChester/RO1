/* 箱子「全部開啟」（#143）。

   一個一個開的問題不是慢，是**紀錄會被洗掉**：50 個箱子就是 50 行，
   戰鬥紀錄整頁被推走。所以這支除了驗數量對得上，也驗紀錄有沒有合併。

   會安靜出錯的地方：
     · 扣掉的箱子數跟拿到的道具數對不上（少扣＝無限開，多扣＝吃掉玩家的箱子）
     · 開出來的東西沒進背包（抽了但沒 addItem）
     · 沒有箱子／不是箱子時還照跑 */
const H = require('./harness');
const t = H.tester();

function mk() {
  const g = H.boot({ captureLog: true });
  H.mkChar(g, { path: ['swordsman'], job: 'swordsman', baseLevel: 50 });
  return g;
}
const bagCount = g => g.state.inventory.reduce((n, r) => n + (r.instanceId ? 1 : r.qty), 0);

/* ---------- 數量守恆 ---------- */
{
  const g = mk();
  g.addItem('old_blue_box', 30);
  const before = bagCount(g);
  const n = g.openAllBoxes('old_blue_box');
  t.eq('回傳開了幾個', n, 30);
  t.eq('箱子全部扣光', g.getItemQty('old_blue_box'), 0);
  // 30 個箱子出去、30 件道具進來，總數不變
  t.eq('拿到的件數跟開掉的箱子數一樣', bagCount(g), before);
}
{
  // 抽出來的東西真的存在、而且進得了背包
  const g = mk();
  g.addItem('old_violet_box', 40);
  g.openAllBoxes('old_violet_box');
  const bad = g.state.inventory.filter(r => !g.ITEMS[r.item]);
  t.eq('開出來的道具都是真的存在的 id', bad.length, 0, bad.map(r => r.item).join('、'));
  t.ok('確實開出了不只一種東西', g.state.inventory.length > 3, g.state.inventory.length + ' 種');
}

/* ---------- 紀錄要合併 ---------- */
{
  const g = mk();
  g.addItem('gift_box', 50);
  g.__log.length = 0;
  g.openAllBoxes('gift_box');
  const lines = g.__log.filter(l => /打開|開啟/.test(l));
  t.ok('紀錄不是一箱一行', lines.length < 15, '實際 ' + lines.length + ' 行');
  t.ok('有一行總結', g.__log.some(l => /一次開啟 50 個/.test(l)), g.__log.slice(0, 2).join(' / '));
}

/* ---------- 不該動作的情況 ---------- */
{
  const g = mk();
  g.addItem('red_potion', 5);
  const pots = g.getItemQty('red_potion');      // 新手本來就帶著一疊，不能假設是 5
  t.eq('不是箱子就不開', g.openAllBoxes('red_potion'), 0);
  t.eq('紅水沒有被吃掉', g.getItemQty('red_potion'), pots);
  t.eq('背包裡沒有的箱子回 0', g.openAllBoxes('old_blue_box'), 0);
  t.eq('不存在的 id 回 0', g.openAllBoxes('no_such_thing'), 0);
}
{
  // 一次上限：超過的要留在背包，不能默默吞掉
  const g = mk();
  const over = g.BOX_OPEN_ALL_MAX + 7;
  g.addItem('old_blue_box', over);
  const n = g.openAllBoxes('old_blue_box');
  t.eq('一次最多開到上限', n, g.BOX_OPEN_ALL_MAX);
  t.eq('剩下的還在背包裡', g.getItemQty('old_blue_box'), 7);
}

/* ---------- 卡冊那條鏈 ---------- */
{
  const g = mk();
  g.addItem('sealed_card_album', 20);
  g.openAllBoxes('sealed_card_album');
  const albums = Object.keys(g.ALBUM_ITEMS).filter(id => g.getItemQty(id) > 0);
  t.ok('未解封的卡冊開得出卡冊', albums.length > 0, albums.join('、'));
  const total = Object.keys(g.ALBUM_ITEMS).reduce((n, id) => n + g.getItemQty(id), 0);
  t.eq('20 本開出 20 本', total, 20);
  // 再把開出來的卡冊一次開完，應該變成卡片
  albums.forEach(id => g.openAllBoxes(id));
  const cards = g.state.inventory.filter(r => g.CARDS[r.item]);
  t.ok('卡冊開得出卡片', cards.length > 0, cards.length + ' 種');
}

process.exit(t.report('箱子一次開啟'));
