/* 離線／切分頁的掛機結算（#135）。

   使用者回報：掛單隻時切走再回來畫面會爆衝，組隊時反而完全沒收益。
   兩個症狀是同一件事的兩面——瀏覽器把背景分頁的計時器降頻，而 gameTick 的兩半
   對降頻的反應不同（玩家的攻擊用累積器會補、慢心跳裡的隊友一次都不補）。

   修法是「分頁切走就當離線」，把那段時間交給 computeOfflineProgress()。
   於是這支要盯的東西變成兩件，兩件都是**不會報錯的無聲失效**：

     1. 離線結算的抽樣以前只跑 `playerAttack()`，隊友的傷害完全沒算進去
        → 玩家是輔助職時離線收益趨近 0（就是「組隊直接沒經驗」）
     2. 結算完時間錨點沒推回現在的話，主迴圈一恢復就把離線那段「再打一次」
        → 就是爆衝畫面本身

   不重抄數字：收益是隨機外推的，斷言一律比較「有沒有」與「多還是少」。 */
const H = require('./harness');
const t = H.tester();

// 造一份「另一格存檔」的角色，好拿來雇成隊友
function makeSaveSlot(g, slot, path, job, lv) {
  const gg = H.boot();
  H.mkChar(gg, { path, job, baseLevel: lv, stats: { str: 90, agi: 60, vit: 50, int: 40, dex: 80, luk: 30 } });
  gg.state.name = '隊友' + slot;
  H.wield(gg, 'mace');
  gg.recomputeDerived(true);
  g.localStorage.setItem(g.getSlotKey(slot), JSON.stringify(gg.state));
}

/* 一隻站在有怪地圖上的主角。`weak` 用來模擬「輔助職玩家」：
   把攻擊力壓到幾乎打不動，這樣收益幾乎全部來自隊友，
   隊友沒算到的話結算就是 0——正是使用者回報的情境。 */
function scene(opts) {
  opts = opts || {};
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 80 });
  H.wield(g, 'spear1');
  const safe = g.MAPS.find(m => (m.monsters || []).length === 0);
  g.state.mapId = safe.id;
  makeSaveSlot(g, 1, ['merchant', 'blacksmith'], 'blacksmith', 80);
  makeSaveSlot(g, 2, ['swordsman', 'knight'], 'knight', 80);
  g.state.gold = 9e8;
  (opts.hire || []).forEach(s => g.hireAlly(String(s)));
  // 低等有怪的圖：怪夠弱，抽樣一定打得死，斷言才不會靠運氣
  const field = g.MAPS.filter(m => (m.monsters || []).length
    && m.monsters.every(x => (g.MONSTERS[x.id] || {}).level <= 20))[0];
  g.state.mapId = field.id;
  g.recomputeDerived(true);
  if (opts.weak) {
    // 攻擊力壓到最低，但**不要動 attackInterval**：抽樣的輪數是照它算的
    g.state.atk = 1; g.state.matk = 1; g.state.matkMin = 1; g.state.matkMax = 1;
    g.state.autoSkill = false;
  }
  return g;
}
// 讓「上次活動時間」倒退 n 秒，等同離線 n 秒
function rewind(g, sec) { g.state.lastActiveAt = Date.now() - sec * 1000; }

/* ---------- 主迴圈的開關（切分頁靠這個） ---------- */
{
  const g = scene();
  t.eq('剛開始沒有在跑', g.loopRunning(), false);
  g.startLoop();
  t.eq('startLoop 之後在跑', g.loopRunning(), true);
  g.stopLoop();
  t.eq('stopLoop 之後停了', g.loopRunning(), false);
  g.stopLoop();
  t.eq('重複停不會炸', g.loopRunning(), false);
}

/* ---------- 門檻：太短不結算，但時間戳要往前推 ---------- */
{
  const g = scene();
  rewind(g, 3);
  t.eq('離線 3 秒（低於預設 30 秒門檻）不結算', g.computeOfflineProgress(), null);
  t.ok('沒結算時仍把 lastActiveAt 推回現在', Date.now() - g.state.lastActiveAt < 1000);

  rewind(g, 10);
  t.eq('同樣 10 秒，用預設門檻仍不結算', g.computeOfflineProgress(), null);
  rewind(g, 10);
  t.ok('切分頁的 5 秒門檻就結算得出來', !!g.computeOfflineProgress(5000));
}

/* ---------- 單人：結算本身要有收益 ---------- */
{
  const g = scene();
  const exp0 = g.state.exp, gold0 = g.state.gold;
  rewind(g, 3600);
  const off = g.computeOfflineProgress();
  t.ok('離線一小時有結算結果', !!off);
  t.ok('經驗有進帳', off.expGained > 0, '得到 ' + off.expGained);
  t.ok('鋅幣有進帳', off.goldGained > 0);
  t.ok('擊殺數有算出來', off.kills > 0);
  t.ok('經驗真的加到角色身上', g.state.exp > exp0 || g.state.baseLevel > 80);
  t.ok('鋅幣真的加到角色身上', g.state.gold > gold0);
  t.eq('沒有隊友時 allyCount 是 0', off.allyCount, 0);
  t.ok('結果帶著地圖名（紀錄要顯示）', !!off.mapName);
}

/* ---------- 時間錨點：結算完不可以再爆衝一次 ---------- */
{
  const g = scene();
  g.state.monsters = [{ defId: g.currentMap().monsters[0].id, hp: 100, maxHp: 100, id: 1, lastAttackTime: Date.now() - 3600000 }];
  g.state.attackAccumulator = 999999;
  g.state._lastSlowTick = Date.now() - 3600000;
  rewind(g, 3600);
  g.computeOfflineProgress();
  const fresh = ms => Date.now() - ms < 1000;
  t.eq('玩家的攻擊累積器歸零', g.state.attackAccumulator, 0);
  t.ok('玩家的上次攻擊時間推回現在', fresh(g.state.lastAttackTime));
  t.ok('慢心跳的時間戳推回現在', fresh(g.state._lastSlowTick));
  t.ok('生怪計時推回現在', fresh(g.state.lastSpawnTime));
  t.ok('場上每隻怪的攻擊計時也推回現在（不然回來各賺一次免費攻擊）',
    g.state.monsters.every(m => fresh(m.lastAttackTime)));
}

/* ---------- 核心：隊友的傷害要算進離線收益 ---------- */
{
  const solo = scene({ weak: true });
  rewind(solo, 3600);
  const offSolo = solo.computeOfflineProgress();

  const party = scene({ weak: true, hire: [1, 2] });
  t.eq('兩位隊友都雇到了（後面的比較才有意義）', party.state.allies.length, 2);
  rewind(party, 3600);
  const offParty = party.computeOfflineProgress();

  t.ok('組隊也結算得出結果', !!offParty);
  t.eq('結果記得帶上參戰人數', offParty.allyCount, 2);
  /* 這一條就是使用者回報的 bug 本體：修之前隊友完全沒抽樣，
     輔助職玩家組隊的離線收益跟單人一樣少（幾乎是 0）。 */
  t.ok('輔助職玩家組隊時，離線經驗遠高於單人',
    offParty.expGained > (offSolo ? offSolo.expGained : 0) * 3,
    `單人 ${offSolo ? offSolo.expGained : 0} → 組隊 ${offParty.expGained}`);
  t.ok('組隊的擊殺數也跟著變多', offParty.kills > (offSolo ? offSolo.kills : 0));
}

/* ---------- 隊友的傭兵經驗 ---------- */
{
  const g = scene({ hire: [1, 2] });
  g.state.allies.forEach(a => { a._pendingExp = 0; a._pendingJobExp = 0; });
  rewind(g, 3600);
  const off = g.computeOfflineProgress();
  const pend = g.state.allies.map(a => a._pendingExp);
  t.ok('每位隊友都拿到待領的傭兵經驗', pend.every(p => p > 0), JSON.stringify(pend));
  t.eq('比例跟線上擊殺同一條規則',
    Math.round(pend[0]), Math.round(off.expGained * g.ALLY_MERC_EXP_PCT / 100));
  t.eq('全隊都記，不是只記給補刀的那個', Math.round(pend[0]), Math.round(pend[1]));
}

/* ---------- 抽樣不可以留下痕跡 ---------- */
{
  const g = scene({ hire: [1, 2] });
  const a = g.state.allies[0];
  a.sp = 123;
  a.cooldowns = { bash: 4000 };
  a.buffs = [{ type: 'atk', mult: 2, msRemaining: 9000 }];
  a.hp = a.maxHp;
  rewind(g, 3600);
  g.computeOfflineProgress();
  t.eq('隊友的 SP 沒被抽樣扣掉', a.sp, 123);
  t.eq('隊友的冷卻沒被抽樣推進', a.cooldowns.bash, 4000);
  t.eq('隊友的 buff 沒被抽樣倒數掉', a.buffs.length, 1);
  t.eq('隊友的 HP 沒被抽樣改掉', a.hp, a.maxHp);
  t.eq('隊友沒有莫名倒地', a._downed, false);
}

/* ---------- 倒地的隊友不參戰 ---------- */
{
  const g = scene({ weak: true, hire: [1, 2] });
  g.state.allies.forEach(x => { x._downed = true; });
  rewind(g, 3600);
  const off = g.computeOfflineProgress();
  t.eq('倒地的不算進參戰人數', off.allyCount, 0);
  t.eq('倒地的也拿不到傭兵經驗', g.state.allies[0]._pendingExp || 0, 0);
}

/* ---------- 安全區照舊 ---------- */
{
  const g = scene();
  g.state.mapId = g.MAPS.find(m => (m.monsters || []).length === 0).id;
  rewind(g, 3600);
  const off = g.computeOfflineProgress();
  t.eq('城鎮裡沒有戰鬥收穫', off.safeTown, true);
  t.eq('城鎮裡經驗是 0', off.expGained, 0);
}

/* ---------- 收益紀錄：最多三筆、最新在最前面 ---------- */
{
  const g = scene();
  t.eq('一開始沒有紀錄', g.offlineLogList().length, 0);
  for (let i = 1; i <= 5; i++) {
    g.pushOfflineLog({ elapsedMs: i * 60000, expGained: i, jobExpGained: i, goldGained: i, kills: i, itemsGained: [] });
  }
  const list = g.offlineLogList();
  t.eq('只留三筆', list.length, g.OFFLINE_LOG_MAX);
  t.eq('最新的在最前面', list[0].expGained, 5);
  t.eq('最舊的被擠掉', list[2].expGained, 3);
  t.ok('每筆都有時間戳（畫面要標日期時間）', list.every(r => r.at > 0));
  // 掉落物要截斷，不然掛一整晚的上百種掉落會把存檔撐大
  const cap = g.OFFLINE_LOG_ITEMS_MAX;
  const many = Array.from({ length: 40 }, () => ({ item: 'apple', qty: 1 }));
  g.pushOfflineLog({ elapsedMs: 1000, itemsGained: many });
  t.ok('掉落物有截斷', g.offlineLogList()[0].itemsGained.length <= cap);
  t.eq('截掉的數量有記下來', g.offlineLogList()[0].itemsMore, 40 - cap);
}

/* ---------- 截斷前要先把貴重的排到前面 ---------- */
{
  const g = scene();
  // 一張卡、一把武器、一件防具，埋在一堆藥草的**最後面**
  const junk = Array.from({ length: 30 }, () => ({ item: 'red_herb', qty: 9 }));
  const raw = junk.concat([
    { item: 'poring_card', qty: 1 },
    { item: 'knife', qty: 1 },
    { item: 'cotton_shirt', qty: 1 },
  ]);
  const sorted = g.sortSpoilsByValue(raw);
  t.eq('卡片排第一', sorted[0].item, 'poring_card');
  t.ok('裝備緊接在後', ['knife', 'cotton_shirt'].includes(sorted[1].item), sorted[1].item);
  t.ok('裝備緊接在後（第二件）', ['knife', 'cotton_shirt'].includes(sorted[2].item), sorted[2].item);
  t.eq('雜物排在裝備之後', sorted[3].item, 'red_herb');
  t.eq('排序不會改變總數', sorted.length, raw.length);
  t.eq('原陣列沒有被就地改動', raw[0].item, 'red_herb');

  g.pushOfflineLog({ elapsedMs: 60000, itemsGained: raw });
  const kept = g.offlineLogList()[0].itemsGained.map(x => x.item);
  t.ok('截斷之後卡片還在（修之前會被藥草擠掉）', kept.includes('poring_card'), kept.join(','));
  t.ok('截斷之後兩件裝備也都還在',
    kept.includes('knife') && kept.includes('cotton_shirt'), kept.join(','));
  // 紀錄跟著存檔走
  g.saveGame();
  t.ok('紀錄存得進存檔',
    Object.values(g.localStorage._d).some(v => /offlineLog/.test(v)));
}

process.exit(t.report('掛機結算與收益紀錄'));
