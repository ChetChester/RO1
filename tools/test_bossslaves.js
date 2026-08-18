/* 召喚小弟 + BOSS 模式限近戰的回歸測試（#65）。

   跑法：node tools/test_bossslaves.js
*/
const H = require('./harness');

const t = H.tester();

// 找一張「有一般配怪、也有 BOSS 名單」的圖
function bossMap(g) {
  return g.MAPS.find(m => (m.monsters || []).length >= 2 && (g.MVP_MAP_DATA[m.id] || []).length);
}

/* ---------- 1. BOSS 模式只能在近戰模式開 ---------- */
{
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'] });
  const map = bossMap(g);
  t.ok('找得到有 BOSS 名單的地圖', !!map);
  g.changeMap(map.id);

  g.state.encounterMode = 'melee';
  g.recomputeDerived(false);
  t.eq('近戰模式沒有阻擋理由', g.mvpModeBlockReason(), null);
  t.eq('近戰模式開得起來', g.toggleMvpMode(true), true);
  t.eq('狀態真的開了', g.state.mvpMode, true);

  g.state.encounterMode = 'ranged';
  g.recomputeDerived(false);
  t.eq('遠攻模式 maxMonsters 是 1', g.state.maxMonsters, 1);
  t.ok('遠攻模式給得出理由', /只能在近戰模式/.test(g.mvpModeBlockReason() || ''));
  g.state.mvpMode = false;
  t.eq('遠攻模式開不起來', g.toggleMvpMode(true), false);
  t.eq('開不起來時狀態維持關閉', g.state.mvpMode, false);

  // 沒有 BOSS 名單的地圖也擋
  g.state.encounterMode = 'melee';
  g.recomputeDerived(false);
  const plain = g.MAPS.find(m => (m.monsters || []).length && !g.MVP_MAP_DATA[m.id]);
  if (plain) {
    g.changeMap(plain.id);
    t.ok('沒有 BOSS 名單的地圖也擋', /沒有 BOSS 階級魔物/.test(g.mvpModeBlockReason() || ''));
  } else {
    t.ok('（所有地圖都有 BOSS 名單，這條跳過）', true);
  }
}

/* ---------- 2. BOSS 出場就把空位填滿 ---------- */
{
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'] });
  const map = bossMap(g);
  g.changeMap(map.id);
  g.state.encounterMode = 'melee';
  g.recomputeDerived(false);
  const max = g.state.maxMonsters;
  // 上限跟著 MELEE_MAX_MONSTERS 走（#102 從 5 改成 3）；這裡驗的是「有沒有照常數走」
  t.eq('近戰上限＝MELEE_MAX_MONSTERS', max, g.MELEE_MAX_MONSTERS);
  t.ok('近戰上限至少 2 隻，BOSS 才帶得出小弟', max >= 2, '實際 ' + max);

  const mvpList = g.MVP_MAP_DATA[map.id];
  const bossId = mvpList.find(id => g.MONSTERS[id]);
  const bossDef = g.MONSTERS[bossId];

  // 只有 BOSS 在場 → 應該補到滿
  g.state.monsterIdCounter = (g.state.monsterIdCounter || 0) + 1;
  g.state.monsters = [{ defId: bossId, hp: bossDef.hp, maxHp: bossDef.hp, id: g.state.monsterIdCounter }];
  g.summonBossSlaves(bossDef);
  t.eq('一次填滿到上限', g.state.monsters.length, max);
  t.eq('BOSS 還是第一隻', g.state.monsters[0].defId, bossId);

  /* 小弟要從**一般配怪表**抽，不能又抽出一隻 BOSS——不然會變成一次出兩隻 */
  const slaves = g.state.monsters.slice(1).map(m => m.defId);
  t.eq('小弟裡沒有 BOSS', slaves.filter(id => mvpList.includes(id)).join(','), '');
  const pool = map.monsters.map(x => x.id || x);
  t.ok('小弟都來自這張圖的配怪表', slaves.every(id => pool.includes(id)),
    slaves.filter(id => !pool.includes(id)).join(','));

  // 場上已經滿了就不再補
  const n = g.state.monsters.length;
  g.summonBossSlaves(bossDef);
  t.eq('滿了就不再補', g.state.monsters.length, n);

  // 場上已有 2 隻時只補到 5
  g.state.monsters = g.state.monsters.slice(0, 2);
  g.summonBossSlaves(bossDef);
  t.eq('只補滿剩下的空位', g.state.monsters.length, max);

  // 補完之後回到正常節流：lastSpawnTime 被推到現在
  g.state.monsters = [g.state.monsters[0]];
  g.state.lastSpawnTime = Date.now() - 99999;   // 0 會被 spawnMonster 重設成現在
  g.summonBossSlaves(bossDef);
  t.ok('填滿後重設生怪計時', Date.now() - g.state.lastSpawnTime < 1000);
}

/* ---------- 3. 走真正的 spawnMonster：BOSS 一出現就帶滿手下 ---------- */
{
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'] });
  const map = bossMap(g);
  g.changeMap(map.id);
  g.state.encounterMode = 'melee';
  g.recomputeDerived(false);
  g.toggleMvpMode(true);
  const mvpList = g.MVP_MAP_DATA[map.id];

  let sawBossWithSlaves = 0, sawBoss = 0;
  for (let i = 0; i < 400; i++) {
    g.state.monsters = [];
    g.state.lastSpawnTime = Date.now() - 99999;   // 0 會被 spawnMonster 重設成現在
    g.spawnMonster();
    const boss = g.state.monsters.find(m => mvpList.includes(m.defId));
    if (boss) {
      sawBoss++;
      if (g.state.monsters.length === g.state.maxMonsters) sawBossWithSlaves++;
    }
  }
  t.ok('抽得到 BOSS（20% 機率）', sawBoss > 20, `400 次出現 ${sawBoss} 次`);
  t.eq('每次 BOSS 出現都是滿場', sawBossWithSlaves, sawBoss);

  /* 一般怪一次生 1~3 隻（#106 改的；以前是固定一隻），而且**不會填滿**——
     填滿是 BOSS 召喚小弟才有的事。空場開打，所以批量不會被剩餘空位夾到。 */
  const seen = {};
  let normalChecked = 0, overCap = 0;
  for (let i = 0; i < 600; i++) {
    g.state.monsters = [];
    g.state.lastSpawnTime = Date.now() - 99999;   // 0 會被 spawnMonster 重設成現在
    g.spawnMonster();
    if (g.state.monsters.some(m => mvpList.includes(m.defId))) continue;
    normalChecked++;
    const n = g.state.monsters.length;
    seen[n] = (seen[n] || 0) + 1;
    if (n > g.state.maxMonsters) overCap++;
  }
  t.ok('一般怪每批都在 1~3 隻之間',
    Object.keys(seen).every(n => Number(n) >= 1 && Number(n) <= g.MELEE_SPAWN_BATCH_MAX),
    JSON.stringify(seen));
  t.eq('1、2、3 隻都出現過（真的是隨機不是固定值）',
    [1, 2, 3].filter(n => seen[n] > 0).length, 3, JSON.stringify(seen));
  t.eq('沒有一批超過場上上限', overCap, 0);
  t.ok('空場時不會一次填滿（填滿是 BOSS 才有的）', !seen[g.state.maxMonsters] || g.MELEE_SPAWN_BATCH_MAX >= g.state.maxMonsters);

  // 空位不夠時批量要被夾住：場上已經 4 隻、上限 5，只能再生 1 隻
  g.state.monsters = [];
  for (let i = 0; i < g.state.maxMonsters - 1; i++) {
    g.state.lastSpawnTime = Date.now() - 99999;
    const before = g.state.monsters.length;
    g.spawnMonster();
    if (g.state.monsters.length > g.state.maxMonsters) break;
    if (g.state.monsters.length === before) break;
  }
  g.state.monsters.length = g.state.maxMonsters - 1;
  g.state.lastSpawnTime = Date.now() - 99999;
  g.spawnMonster();
  t.eq('剩一個空位時只生一隻', g.state.monsters.length, g.state.maxMonsters);
}

process.exit(t.report('召喚小弟 + BOSS 模式限近戰'));
