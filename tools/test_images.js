/* 圖檔接線（#141）。

   缺圖不會噴任何錯：`onerror` 一接手就換成佔位圖，畫面看起來只是「這件沒圖」，
   跟「這件本來就沒圖」分不出來。所以這一支專門把三種安靜的壞法釘住：

     · IMG_ALIAS 指到一個不存在的檔案 —— 別名寫了等於沒寫
     · IMG_ALIAS 指到另一個別名鍵 —— resolveImgPath 只解一層，第二層不會再跳
     · 補完圖之後又有人動了資料，缺圖數量默默長回去

   跑的是真的 fs.existsSync，不是讀清單對答案：讀清單的話，
   清單本身漏掉的那幾筆會跟著一起漏。 */
const fs = require('fs');
const path = require('path');
const H = require('./harness');
const t = H.tester();
const g = H.boot();

const ROOT = path.join(__dirname, '..');
const ex = p => fs.existsSync(path.join(ROOT, p));
const pool = g.getCodexPool();

/* ---------- 別名表本身 ---------- */
{
  const alias = JSON.parse(fs.readFileSync(path.join(ROOT, 'js', 'img_alias.js'), 'utf8')
    .match(/const IMG_ALIAS = (\{[\s\S]*?\});/)[1]);
  const dead = [], chained = [], selfref = [];
  Object.entries(alias).forEach(([dir, group]) => {
    Object.entries(group).forEach(([from, to]) => {
      if (!ex('images/' + to)) dead.push(dir + '/' + from + ' → ' + to);
      if (dir + '/' + from === to) selfref.push(to);
      // 目標自己也是別名鍵的話，resolveImgPath 不會再跳一次，等於指到不存在的檔
      const i = to.lastIndexOf('/');
      const tDir = to.slice(0, i), tBase = to.slice(i + 1);
      if (alias[tDir] && alias[tDir][tBase]) chained.push(from + ' → ' + to);
    });
  });
  t.ok('別名表讀得出來（後面的斷言才有意義）', Object.keys(alias).length >= 3);
  t.eq('別名沒有指到不存在的檔案', dead.length, 0, dead.slice(0, 4).join('、'));
  t.eq('別名沒有指到自己', selfref.length, 0, selfref.slice(0, 3).join('、'));
  t.eq('別名沒有兩層跳轉（只解一層）', chained.length, 0, chained.slice(0, 4).join('、'));
}

/* ---------- 怪物：一隻都不能缺 ---------- */
{
  const bad = pool.monsters.filter(id => !g.MONSTERS[id].imgId || !ex(g.monsterImgSrc(id)));
  t.eq('圖鑑裡的怪物全都有圖', bad.length, 0,
    bad.slice(0, 5).map(id => g.MONSTERS[id].name).join('、'));
  t.ok('真的掃到怪（不是空集合掃過去）', pool.monsters.length > 500, pool.monsters.length + ' 隻');
}

/* ---------- 卡片：大圖與小圖是兩套路徑，要分開驗 ---------- */
{
  const noArt = [], noIcon = [];
  pool.cards.forEach(id => {
    const it = g.ITEMS[id];
    if (!ex(`images/cards/${it ? it.imgId : id}.jpg`)) noArt.push(id);
    const p = it ? g.itemImgSrc(id) : '';
    if (!it || /_placeholder_/.test(p) || !ex(p)) noIcon.push(id);
  });
  t.ok('真的掃到卡（不是空集合掃過去）', pool.cards.length > 400, pool.cards.length + ' 張');
  t.eq('圖鑑裡的卡片都有立繪（詳情頁那張）', noArt.length, 0,
    noArt.slice(0, 5).map(id => g.CARDS[id].name).join('、'));
  t.eq('圖鑑裡的卡片都有小圖示（背包那排）', noIcon.length, 0,
    noIcon.slice(0, 5).map(id => g.CARDS[id].name).join('、'));
  // 立繪要是真的 JPEG：手動複製常常只是把 .png 改名，檔案大三倍
  const notJpeg = pool.cards.filter(id => {
    const f = path.join(ROOT, 'images', 'cards', ((g.ITEMS[id] || {}).imgId || id) + '.jpg');
    return fs.existsSync(f) && fs.readFileSync(f, { flag: 'r' }).subarray(0, 2).toString('hex') !== 'ffd8';
  });
  t.eq('立繪都是真的 JPEG（不是改副檔名的 PNG）', notJpeg.length, 0,
    notJpeg.slice(0, 5).map(id => g.CARDS[id].name).join('、'));
}

/* ---------- 道具：缺圖數量只能往下，不能往上 ----------
   29 是 2026-08-22 手動補圖之後的殘量（見 docs/缺圖清單_圖鑑內.md）。
   補了圖這個數字會變小，測試照樣過；變大就代表有人加了新道具卻沒帶圖、
   或是別名被覆蓋掉了。 */
{
  const RT = g.RELIC_TICKET_ID;
  const miss = pool.items.filter(id => {
    const d = g.ITEMS[id];
    if (!d || d.type === 'relic' || id === RT) return false;
    const p = g.itemImgSrc(id);
    return /_placeholder_/.test(p) || !ex(p);
  });
  t.ok('真的掃到道具（不是空集合掃過去）', pool.items.length > 1000, pool.items.length + ' 件');
  t.ok('圖鑑內缺圖的道具沒有變多', miss.length <= 29, '目前 ' + miss.length + ' 件（基準 29）');
  // 箭矢整批上架過（#139），全部都要有圖，不然商店是一整排 NO IMAGE
  const ammo = pool.items.filter(id => g.ITEMS[id].type === 'ammo');
  t.ok('真的掃到箭矢', ammo.length >= 20, ammo.length + ' 種');
  t.eq('箭矢全部都有圖', ammo.filter(id => miss.includes(id)).length, 0);
  // 插槽版本（木錘 [4]）不該再缺圖：那批全部靠別名解掉了
  const slotted = miss.filter(id => /\[\s*\d+\s*\]\s*$/.test(g.ITEMS[id].name)
    && Object.values(g.ITEMS).some(x => x.id !== id && x.type === g.ITEMS[id].type
      && x.name.replace(/\s*\[\s*\d+\s*\]\s*$/, '') === g.ITEMS[id].name.replace(/\s*\[\s*\d+\s*\]\s*$/, '')
      && x.imgId && ex(g.itemImgSrc(x.id))));
  t.eq('有同名版本可指的插槽裝備都補上別名了', slotted.length, 0,
    slotted.slice(0, 5).map(id => g.ITEMS[id].name).join('、'));
  // 遺物走 emoji，不該被算進缺圖，也不該去要 items/undefined.png
  const relicBad = pool.items.filter(id => (g.ITEMS[id] || {}).type === 'relic'
    && /undefined/.test(g.itemImgSrc(id)));
  t.eq('遺物不會組出 undefined 的圖片路徑', relicBad.length, 0);
}

process.exit(t.report('圖檔接線與別名'));
