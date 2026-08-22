/* 巴風特卡片與達納托斯卡片，以及「無視物防」在普攻上的接線（#136）。

   兩張卡都是**只寫了代價、沒寫好處**的類型，而且失效的方式都不會報錯：

     巴風特卡片   官方是「普攻範圍 9 格」＋ HIT−10，本作只做了 HIT−10，
                  等於一張純扣命中的卡（使用者回報「沒有效果」）
     達納托斯卡片 遊戲裡根本沒有這張卡

   補的時候還挖出一個更大的：`physDefIgnorePct()` 只長在 `defOf()` 裡，
   而 defOf **只有技能傷害在走**——普攻是自己算防禦值的。所以 #127 接上的
   那一整批「無視○○系防禦力」的武器對普通攻擊一點作用都沒有，
   而那批東西的定位全都是普攻流。這支把那條線一起釘死。 */
const H = require('./harness');
const t = H.tester();

/* DEX 拉滿是刻意的：驗的是「防禦減免有沒有被拿掉」，不是命中率。
   用預設素質的話對高防高閃的測試怪十打九空，單次攻擊的斷言會隨機紅。
   LUK 壓到 0 則是為了讓暴擊少一點——官方暴擊本來就無視 DEF，
   暴擊佔比越高，「有沒有無視防禦」的差距會被稀釋得越看不出來。 */
const KNIGHT = {
  path: ['swordsman', 'knight'], job: 'knight', baseLevel: 90,
  stats: { str: 90, agi: 1, vit: 1, int: 1, dex: 99, luk: 0 },
};

// 乾淨的角色 + 一把有孔武器；cards 是要插進武器欄的卡
function armed(cards, opts) {
  const g = H.boot();
  H.mkChar(g, Object.assign({}, KNIGHT, opts || {}));
  H.wield(g, 'sword1');
  (cards || []).forEach(id => { g.addItem(id, 1); g.insertCard('weapon', id); });
  g.recomputeDerived(true);
  g.state.autoSkill = false;          // 只驗普攻，技能會另外走 defOf
  return g;
}
// 場上放 n 隻血厚到打不死的假怪
function fieldOf(g, n, defId) {
  g.state.monsters = Array.from({ length: n }, (_, i) => ({ defId, hp: 1e9, maxHp: 1e9, id: i + 1 }));
  return g.state.monsters;
}
/* 打到**確實命中為止**再回傳現場。
   普攻會 miss，而 miss 的那一拍濺射本來就不該發生——直接打一下就斷言的話，
   測試會隨機紅在「沒插卡也是 0 隻」上，那不是 bug 是骰子。 */
function swingUntilHit(g, n, defId, tries) {
  for (let i = 0; i < (tries || 60); i++) {
    fieldOf(g, n, defId);
    g.playerAttack();
    const hurt = g.state.monsters.filter(m => m.hp < 1e9);
    if (hurt.length) return hurt;
  }
  return [];
}
// 對同一隻怪打 n 次的平均傷害（吸收暴擊與命中的隨機）
function avgDamage(g, defId, n) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    g.state.monsters = [{ defId, hp: 1e9, maxHp: 1e9, id: 1 }];
    g.playerAttack();
    total += 1e9 - g.state.monsters[0].hp;
  }
  return total / n;
}

const G0 = H.boot();
// 高硬防的怪：無視防禦有沒有生效，在這種怪身上差距才看得出來
const TANK = Object.values(G0.MONSTERS).find(m => m.def > 300 && m.hp > 1e6 && !m.isBoss).id;

/* ---------- 資料：兩張卡都要存在且拿得到 ---------- */
{
  const g = G0;
  ['baphomet_real_card', 'thanatos_card'].forEach(id => {
    t.ok(id + ' 在 CARDS 裡', !!g.CARDS[id]);
    t.ok(id + ' 也在 ITEMS 裡（背包要顯示得出來）', !!g.ITEMS[id]);
    t.ok(id + ' 玩家打得到', g.getItemFarmSpots(id).length > 0);
  });
  /* 巴風特卡片以前的 monsterId 指向 baphomet_（小巴風特）——那是**小**巴風特卡片
     的來源。圖鑑的「哪隻怪掉」因此指錯人。 */
  t.eq('巴風特卡片的來源是巴風特本尊', g.CARDS.baphomet_real_card.monsterId, 'baphomet');
  t.eq('小巴風特卡片的來源才是小巴風特', g.CARDS.baphomet_card.monsterId, 'baphomet_');
  t.ok('巴風特卡片列在巴風特的掉落表裡',
    (g.MONSTERS.baphomet.drops || []).some(d => d.item === 'baphomet_real_card'));
  t.ok('達納托斯卡片列在達納托斯的掉落表裡',
    (g.MONSTERS.thanatos.drops || []).some(d => d.item === 'thanatos_card'));
}

/* ---------- 達納托斯的記憶：官方掉落表 ---------- */
{
  const g = G0;
  const drops = g.MONSTERS.thanatos.drops || [];
  t.eq('掉落表沒有指向不存在的道具', drops.filter(d => !g.ITEMS[d.item]).length, 0);
  // 修之前混了財寶箱／神秘紫箱／神秘藍箱三個箱子，官方一個都沒有
  const BOXES = ['treasure_box', 'old_violet_box', 'old_blue_box'];
  t.eq('不再混入官方沒有的箱子', drops.filter(d => BOXES.includes(d.item)).length, 0);
  // 修之前整張表的機率大一倍（0.5 = 50%，官方是 25%）
  t.ok('最高掉落率不超過 25%', Math.max(...drops.map(d => d.chance)) <= 0.25);
  t.ok('卡片是全表最稀有的', drops.find(d => d.item === 'thanatos_card').chance
    === Math.min(...drops.map(d => d.chance)));
  t.ok('掉落種類數合理（官方 7 樣 + 卡片）', drops.length === 8, '目前 ' + drops.length);
}

/* ---------- 巴風特卡片：普攻濺射 ---------- */
{
  const g = armed([]);
  t.eq('沒插卡時普攻只打到一隻', swingUntilHit(g, 4, TANK).length, 1);
  t.eq('沒插卡時濺射旗標是關的', !!g.state.cardSplashAttack, false);
}
{
  const g = armed(['baphomet_real_card']);
  t.eq('插卡後濺射旗標打開', g.state.cardSplashAttack, true);
  t.eq('代價照官方：HIT−10', g.getCardBonus('hit'), -10);
  const hurt = swingUntilHit(g, 4, TANK);
  t.eq('普攻打到場上每一隻', hurt.length, 4);
  const dealt = hurt.map(m => 1e9 - m.hp);
  t.ok('濺射的傷害跟主目標一樣（不重擲暴擊）', new Set(dealt).size === 1, dealt.join('/'));

  // 場上只有一隻時不該有任何額外行為
  g.state.monsters = [{ defId: TANK, hp: 1e9, maxHp: 1e9, id: 1 }];
  g.playerAttack();
  t.eq('場上只有一隻時照常打', g.state.monsters.length, 1);
}
{
  /* 濺射要能收人頭：血少的雜魚會被掃掉，而且經驗要進玩家帳上。
     killMonster 是用 filter 重綁陣列的，邊殺邊讀活陣列會漏怪。 */
  const g = armed(['baphomet_real_card']);
  const exp0 = g.state.baseExp;
  const kills0 = g.ensureCodex().mon[TANK] || 0;
  // 一樣要打到命中為止：miss 的那一拍誰都不會死
  for (let i = 0; i < 60; i++) {
    g.state.monsters = Array.from({ length: 4 }, (_, k) => ({ defId: TANK, hp: 1, maxHp: 1e9, id: k + 1 }));
    g.playerAttack();
    if (!g.state.monsters.length) break;
  }
  t.eq('濺射把四隻一起清掉', g.state.monsters.length, 0);
  t.ok('四隻的經驗都進了玩家帳上', g.state.baseExp > exp0, exp0 + ' → ' + g.state.baseExp);
  t.eq('四隻都記進了圖鑑擊殺數', (g.ensureCodex().mon[TANK] || 0) - kills0, 4);
}

/* ---------- 達納托斯卡片：四條效果 ---------- */
{
  const bare = armed([]);
  const g = armed(['thanatos_card']);
  t.eq('無視物防 100%', g.state.cardDefIgnorePct, 100);
  t.eq('代價：DEF−30', g.state.defHard - bare.state.defHard, -30);
  t.eq('代價：FLEE−30', g.state.flee - bare.state.flee, -30);
  t.eq('代價：每次攻擊 −1 SP', g.state.cardSpOnAttack, -1);
}

/* ---------- 無視物防要對「普通攻擊」生效（本輪挖到的舊 bug） ---------- */
{
  const bare = armed([]);
  const g = armed(['thanatos_card']);
  const a = avgDamage(bare, TANK, 400);
  const b = avgDamage(g, TANK, 400);
  const def = G0.MONSTERS[TANK].def;
  /* 官方減傷式 (4000+DEF)/(4000+10×DEF)，DEF 314 約 0.60，拿掉之後理論上是 1.65 倍。
     實測會比 1.65 低一些，因為暴擊本來就無視 DEF，那部分沒有差別可拿。
     門檻放在 1.3：修之前是 1.07（等於完全沒作用）。 */
  t.ok('無視物防讓普攻對高防怪的傷害明顯變高', b > a * 1.3,
    `DEF ${def}：${Math.round(a)} → ${Math.round(b)}（${(b / a).toFixed(2)} 倍）`);
}
{
  // 種族限定的那批（#127 的天龍短劍一族）走同一條路，一起驗
  const g = armed([]);
  const tank = G0.MONSTERS[TANK];
  g.state.cardDefIgnoreRace = { [tank.race]: 100 };
  const hitRace = avgDamage(g, TANK, 400);
  g.state.cardDefIgnoreRace = { [tank.race === 'demon' ? 'plant' : 'demon']: 100 };
  const missRace = avgDamage(g, TANK, 400);
  t.ok('種族限定的無視物防只對該種族生效', hitRace > missRace * 1.3,
    `對種族 ${Math.round(hitRace)} / 對其他 ${Math.round(missRace)}`);
}

/* ---------- 圖鑑：兩張卡都查得到去處 ---------- */
{
  const g = G0;
  const pool = g.getCodexPool();
  t.ok('達納托斯卡片進得了圖鑑', pool.cards.includes('thanatos_card'));
  t.ok('巴風特卡片也在圖鑑裡', pool.cards.includes('baphomet_real_card'));
  // 使用者要求：普通怪與 MVP／迷你王在圖鑑裡都要有「前往」的地方
  const noWhere = pool.monsters.filter(id => g.getMonsterMaps(id).length === 0);
  t.eq('圖鑑裡沒有「查得到卻無處可去」的怪', noWhere.length, 0,
    noWhere.slice(0, 5).map(i => g.MONSTERS[i].name).join('、'));
  /* 遺物與遺物券不走掉落表也不走商店（#138）：
     頭目掉券、券換遺物，取得方式由圖鑑明細另外寫。 */
  const isRelic = id => g.ITEMS[id] && (g.ITEMS[id].type === 'relic' || id === g.RELIC_TICKET_ID);
  const noSrc = [...pool.items, ...pool.cards].filter(id =>
    !isRelic(id) &&
    !g.getItemFarmSpots(id).length &&
    !Object.values(g.NPC_SHOPS).some(s => (s.items || []).includes(id)));
  t.eq('圖鑑裡沒有「查得到卻無處可拿」的道具', noSrc.length, 0,
    noSrc.slice(0, 5).join('、'));
  // MVP 名單本身也不能爛掉，爛了上面那條會靜靜地變成 0
  const mapIds = new Set(g.MAPS.map(m => m.id));
  let bad = 0;
  Object.entries(g.MVP_MAP_DATA).forEach(([mid, list]) => {
    if (!mapIds.has(mid)) bad++;
    (list || []).forEach(id => { if (!g.MONSTERS[id]) bad++; });
  });
  t.eq('MVP 名單沒有指向不存在的地圖或怪', bad, 0);
  t.ok('達納托斯全家都查得到去處',
    ['thanatos', 'tha_odium', 'tha_despero', 'tha_maero', 'tha_dolor']
      .every(id => g.getMonsterMaps(id).length > 0));
}

/* ---------- 圖鑑「前往」鈕消失的版面 bug ----------

   使用者截圖回報：MVP／迷你王的圖鑑明細裡，出沒地圖只剩「5%」與「BOSS 模式」
   兩個標籤，地圖名與「前往」鈕整個不見。

   成因是 CSS 而不是資料：說明小字 `.codex-sec-hint` 是 `float: right`，
   MVP 專屬的那行提示（「標『BOSS 模式』的要先開啟…」）也套著同一個 class，
   在窄畫面會佔掉整行寬度。而緊接在後面的 `.codex-spots` 是 `display: flex`
   ——一個 BFC——**BFC 會避開浮動元素**，於是整塊被擠成 20px：
   地圖名（flex:1）縮成 0，「前往」鈕被推出可視範圍。
   只有 MVP 會中，因為只有牠們才會渲染那行提示，跟使用者說的「傭兵團 BOSS 也一樣」吻合。

   版面驗不了（測試治具不載入 ui.js 與 CSS），所以這裡守的是**病因**：
   那個 class 不可以再用 float。實際版面已在瀏覽器量過：容器 20px → 318px，
   538 隻怪 × 每一列的「前往」鈕都落在面板內（375px 與 900px 兩種寬度都掃過）。 */
{
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
  const ruleOf = sel => {
    const i = css.indexOf(sel + ' {');
    return i < 0 ? null : css.slice(i, css.indexOf('}', i));
  };
  const hint = ruleOf('.codex-sec-hint');
  t.ok('.codex-sec-hint 這條規則還在', !!hint);
  t.ok('說明小字不再用 float（會把後面的 flex 區塊擠扁）', hint && !/float\s*:/.test(hint), hint);
  const sec = ruleOf('.codex-detail-sec');
  t.ok('區塊標題改用 flex 排版', sec && /display\s*:\s*flex/.test(sec), sec);
  t.ok('標題與說明左右分開', sec && /space-between/.test(sec));
  const note = ruleOf('.codex-mvp-note');
  t.ok('BOSS 模式那行提示是整行區塊', note && /display\s*:\s*block/.test(note), note);
}

process.exit(t.report('巴風特／達納托斯卡片與無視物防'));
