/* 圖鑑改成尋寶導航（#81）。

   只驗引擎側的資料鏈——`js/ui.js` 沒有載入這個治具（見 harness 檔頭），
   畫面長怎樣、按鈕點不點得動要開瀏覽器看。 */
const H = require('./harness');
const t = H.tester();
const g = H.boot();

/* ---------- 出沒地圖帶出現率 ---------- */
{
  const maps = g.getMonsterMaps('poring');
  t.ok('波利查得到出沒地圖', maps.length > 0);
  t.ok('每筆都有地圖 id（前往鈕要用）', maps.every(m => !!g.MAPS.find(x => x.id === m.id)));
  t.ok('照出現率由高到低排', maps.every((m, i) => i === 0 || maps[i - 1].pct >= m.pct));
  // 出現率必須跟 spawnMonster() 抽怪用的是同一組權重
  const m0 = g.MAPS.find(x => x.id === maps[0].id);
  const total = m0.monsters.reduce((a, e) => a + e.weight, 0);
  const w = m0.monsters.find(e => e.id === 'poring').weight;
  t.near('出現率＝該怪權重／全圖權重和', maps[0].pct, w / total * 100, 0.01);

  // 全庫掃描：不能有出現率破 100 或掉到 0 的（權重表壞掉時會這樣）
  let bad = 0;
  Object.keys(g.MONSTERS).forEach(id => g.getMonsterMaps(id).forEach(m => {
    if (!(m.pct > 0 && m.pct <= 100)) bad++;
  }));
  t.eq('沒有出現率超出 0~100 的條目', bad, 0);

  // 測試場（怪物 exp 0）不是去處
  t.eq('測試波利不列出去處', g.getMonsterMaps('test_poring').length, 0);
  const anyTest = g.getMonsterMaps('poring').some(m => m.id === 'test_arena');
  t.ok('一般怪的去處也不含測試場', !anyTest);
}

/* ---------- 道具 → 怪物 → 地圖 整條鏈 ---------- */
{
  const spots = g.getItemFarmSpots('jellopy');
  t.ok('杰勒比查得到去處', spots.length > 0);
  const s = spots[0];
  t.ok('一筆裡同時有地圖、出現率、怪物、掉落率',
    !!s.mapId && s.spawnPct > 0 && !!g.MONSTERS[s.mon] && s.dropChance > 0);
  t.ok('照出現率排序', spots.every((x, i) => i === 0 || spots[i - 1].spawnPct >= x.spawnPct));
  t.ok('掉落率對得上怪物資料', (() => {
    const d = (g.MONSTERS[s.mon].drops || []).find(x => x.item === 'jellopy');
    return d && Math.abs(d.chance - s.dropChance) < 1e-9;
  })());
  t.ok('那隻怪真的配在那張圖上',
    (g.MAPS.find(m => m.id === s.mapId).monsters || []).some(e => e.id === s.mon));

  // 卡片走 MONSTER_CARD_DROPS，不是 drops 陣列——這條路以前只在道具詳情用得到
  const card = g.getItemFarmSpots('poring_card');
  t.ok('卡片也查得到去處', card.length > 0 && card[0].mon === 'poring');

  // 商店限定的道具沒有怪物來源，UI 那邊會改列商店；這裡只要確定不會炸
  t.eq('沒有怪物掉的道具回空陣列', g.getItemFarmSpots('__不存在的道具__').length, 0);
}

/* ---------- 圖鑑池仍然涵蓋得到的東西 ---------- */
{
  const pool = g.getCodexPool();
  t.ok('圖鑑池含怪物與道具', pool.monsters.length > 100 && pool.items.length > 100);
  // 池子裡的每一樣道具都該查得到來源（商店或怪物），不然圖鑑會出現查不到去處的死條目
  const shop = new Set();
  Object.values(g.NPC_SHOPS).forEach(s => (s.items || []).forEach(i => shop.add(i)));
  /* 遺物與遺物券是第三種來源（#138）：頭目掉券、券換遺物，兩者都不在掉落表與商店裡，
     取得方式由圖鑑明細的 relicSourceHtml() 另外寫。所以它們不算孤兒，但**數量要對得上**
     ——多出一件沒歸類的就代表有東西混進池子了。 */
  const isRelic = id => g.ITEMS[id] && (g.ITEMS[id].type === 'relic' || id === g.RELIC_TICKET_ID);
  const orphan = pool.items.concat(pool.cards)
    .filter(id => !shop.has(id) && !isRelic(id) && g.getItemFarmSpots(id).length === 0);
  t.eq('圖鑑池裡沒有查不到來源的道具', orphan.length, 0, orphan.slice(0, 5).join(','));
  // RELIC_ITEMS 本身就含遺物券（48 件遺物 + 1 張券）
  const relics = pool.items.filter(isRelic);
  t.eq('遺物與遺物券全部進得了圖鑑池', relics.length, Object.keys(g.RELIC_ITEMS).length);
  t.ok('遺物券也在裡面（它是遺物的取得管道）', relics.includes(g.RELIC_TICKET_ID));
}

/* ---------- MVP 的出沒地圖（#108）----------
   MVP **不在** `MAPS[*].monsters` 裡，牠們住在 `MVP_MAP_DATA`，
   所以圖鑑的出沒地圖以前對每一隻 MVP 都印「無（需開啟 BOSS 模式）」——
   玩家看不出要去哪張圖找。 */
{
  const mvpIds = new Set();
  Object.values(g.MVP_MAP_DATA).forEach(list => (list || []).forEach(id => { if (g.MONSTERS[id]) mvpIds.add(id); }));
  t.ok('MVP 名單不是空的', mvpIds.size > 10, mvpIds.size + ' 隻');
  const noMap = [...mvpIds].filter(id => g.getMonsterMaps(id).length === 0);
  t.eq('每一隻 MVP 都查得到出沒地圖', noMap.length, 0, noMap.slice(0, 5).join(','));

  const sample = [...mvpIds][0];
  const rows = g.getMonsterMaps(sample);
  t.ok('MVP 那幾筆有標記', rows.every(r => r.mvp), sample);
  t.ok('出現率照 BOSS 模式的抽中率換算', rows.every(r => r.pct > 0 && r.pct <= g.MVP_SPAWN_CHANCE_PCT),
    rows.map(r => r.pct).join(','));
  // 每張圖列出來的地圖 id 要真的存在，不然「前往」會按不動
  const ids = new Set(g.MAPS.map(m => m.id));
  t.ok('地圖 id 都是真的（前往按得動）', rows.every(r => ids.has(r.id)));

  // 一般怪不能被汙染成 mvp
  const poring = g.getMonsterMaps('poring');
  t.ok('一般怪照舊沒有 BOSS 模式標記', poring.length > 0 && poring.every(r => !r.mvp));
}

process.exit(t.report('圖鑑尋寶導航'));
