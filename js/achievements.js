/* ============================================================
   成就 / 里程碑系統

   設計取向：不在戰鬥流程裡到處埋 hook，而是每秒在慢速 tick 裡做一次
   集中判定。成就幾乎都是「累計數量門檻」，而這些累計值圖鑑系統
   (state.codex) 已經在記了，直接讀就好——少了散落各處的觸發點，
   之後要加新成就只要在下面的表格加一行，不用再動 engine.js。

   解鎖延遲最多 1 秒，對放置遊戲來說無感。

   state.achievements = {
     done:  { 成就id: 解鎖時間戳 },
     points: 累計成就點數
   }
============================================================ */

const ACHIEVEMENT_CATEGORIES = {
  battle:  { name: '戰鬥', icon: '⚔️' },
  collect: { name: '收集', icon: '📕' },
  growth:  { name: '成長', icon: '🌱' },
  wealth:  { name: '財富', icon: '💰' },
  explore: { name: '探索', icon: '🗺️' },
  gear:    { name: '裝備', icon: '🛡️' }
};

/* ---------------- 進度取值 ---------------- */
function acvTotalKills() {
  const mon = (state.codex && state.codex.mon) || {};
  let n = 0;
  for (const k in mon) n += mon[k];
  return n;
}
function acvMvpKills() {
  const mon = (state.codex && state.codex.mon) || {};
  let n = 0;
  for (const k in mon) if (MONSTERS[k] && MONSTERS[k].isBoss) n += mon[k];
  return n;
}
function acvMaxSingleKill() {
  const mon = (state.codex && state.codex.mon) || {};
  let m = 0;
  for (const k in mon) if (mon[k] > m) m = mon[k];
  return m;
}
function acvRaceKills(race) {
  const mon = (state.codex && state.codex.mon) || {};
  let n = 0;
  for (const k in mon) if (MONSTERS[k] && MONSTERS[k].race === race) n += mon[k];
  return n;
}
function acvCodexCount(kind) {
  const p = getCodexProgress();
  return p[kind].found;
}
function acvMapsVisited() {
  return Object.keys((state.codex && state.codex.maps) || {}).length;
}
function acvMaxStat() {
  const s = state.stats || {};
  return Math.max(s.str || 0, s.agi || 0, s.vit || 0, s.int || 0, s.dex || 0, s.luk || 0);
}
function acvMaxRefine() {
  let m = 0;
  const r = state.refinement || {};
  for (const k in r) if (r[k] > m) m = r[k];
  const insts = state.instances || {};
  for (const k in insts) {
    const v = insts[k] && insts[k].refine;
    if (typeof v === 'number' && v > m) m = v;
  }
  // 未個體化的裝備精煉為 0，不影響最大值
  return m;
}
function acvCardsEquipped() {
  if (typeof allEquippedCards === 'function') {
    try { return allEquippedCards().length; } catch (e) {}
  }
  return Object.values(state.equippedCards || {}).filter(Boolean).length;
}
function acvEquipSlotsFilled() {
  return Object.values(state.equip || {}).filter(Boolean).length;
}
function acvJobChanges() {
  return Object.keys(state.jobLevelHistory || {}).length;
}

/* ---------------- 成就表 ---------------- */
// 階梯式成就用這個產生器批次產出，省得一條一條抄
function acvTiers(idBase, cat, icon, names, goals, progress, goldPerTier) {
  return goals.map((goal, i) => ({
    id: `${idBase}_${goal}`,
    cat, icon,
    name: names[i],
    desc: null,          // 由 descFor 產生
    goal, progress,
    tier: i + 1,
    reward: { gold: goldPerTier[i], point: i + 1 }
  }));
}

const ACHIEVEMENTS = [].concat(
  /* ---- 戰鬥 ---- */
  acvTiers('kill', 'battle', '⚔️',
    ['初次出手', '見習獵人', '百戰之身', '千軍萬馬', '萬夫莫敵', '傳說戰士'],
    [10, 100, 1000, 10000, 50000, 200000], acvTotalKills,
    [100, 500, 3000, 20000, 120000, 600000]
  ).map(a => Object.assign(a, { desc: `累計擊敗 ${a.goal.toLocaleString()} 隻魔物` })),

  acvTiers('mvp', 'battle', '👑',
    ['弒神者', 'MVP 獵人', '王之終結者', '諸神黃昏'],
    [1, 10, 50, 200], acvMvpKills,
    [2000, 15000, 80000, 400000]
  ).map(a => Object.assign(a, { desc: `擊敗 ${a.goal} 隻 MVP Boss` })),

  acvTiers('grudge', 'battle', '🎯',
    ['執著', '偏執', '此仇不共戴天'],
    [500, 5000, 30000], acvMaxSingleKill,
    [1500, 12000, 90000]
  ).map(a => Object.assign(a, { desc: `對同一種魔物累計擊殺 ${a.goal.toLocaleString()} 隻` })),

  { id: 'race_undead_1000', cat: 'battle', icon: '💀', name: '安息吧', desc: '累計擊敗 1000 隻不死種族', goal: 1000, tier: 2, progress: () => acvRaceKills('undead'), reward: { gold: 5000, point: 2 } },
  { id: 'race_demon_1000',  cat: 'battle', icon: '😈', name: '驅魔人',  desc: '累計擊敗 1000 隻惡魔種族', goal: 1000, tier: 2, progress: () => acvRaceKills('demon'),  reward: { gold: 5000, point: 2 } },
  { id: 'race_dragon_300',  cat: 'battle', icon: '🐉', name: '屠龍者',  desc: '累計擊敗 300 隻龍族',      goal: 300,  tier: 3, progress: () => acvRaceKills('dragon'), reward: { gold: 12000, point: 3 } },
  { id: 'race_angel_100',   cat: 'battle', icon: '👼', name: '弒天',    desc: '累計擊敗 100 隻天使種族', goal: 100,  tier: 3, progress: () => acvRaceKills('angel'),  reward: { gold: 12000, point: 3 } },

  { id: 'death_1',  cat: 'battle', icon: '💀', name: '初嚐敗績',   desc: '第一次被擊倒（別氣餒）', goal: 1,  tier: 1, progress: () => state.deaths || 0, reward: { gold: 200, point: 1 } },
  { id: 'death_50', cat: 'battle', icon: '🩹', name: '不屈不撓',   desc: '累計被擊倒 50 次仍在冒險', goal: 50, tier: 2, progress: () => state.deaths || 0, reward: { gold: 4000, point: 2 } },

  /* ---- 收集 ---- */
  acvTiers('mon', 'collect', '👾',
    ['觀察者', '博物學者', '魔物通', '圖鑑達人', '萬物之書'],
    [10, 50, 100, 250, 442], () => acvCodexCount('monsters'),
    [300, 2000, 8000, 40000, 200000]
  ).map(a => Object.assign(a, { desc: `圖鑑發現 ${a.goal} 種魔物` })),

  acvTiers('card', 'collect', '🃏',
    ['第一張卡', '收藏家', '卡片商人', '牌組大師', '全卡收藏'],
    [1, 10, 30, 70, 120], () => acvCodexCount('cards'),
    [1000, 6000, 25000, 100000, 500000]
  ).map(a => Object.assign(a, { desc: `圖鑑收集 ${a.goal} 張卡片` })),

  acvTiers('item', 'collect', '🎒',
    ['撿破爛', '囤積者', '雜貨鋪', '倉庫管理員', '應有盡有'],
    [20, 100, 300, 600, 1075], () => acvCodexCount('items'),
    [300, 1500, 8000, 40000, 200000]
  ).map(a => Object.assign(a, { desc: `圖鑑收集 ${a.goal} 種道具` })),

  /* ---- 成長 ---- */
  acvTiers('blv', 'growth', '⭐',
    ['嶄露頭角', '獨當一面', '小有名氣', '威震四方', '登峰造極', '人類極限'],
    [10, 30, 50, 70, 90, 99], () => state.baseLevel || 1,
    [200, 1500, 6000, 25000, 100000, 300000]
  ).map(a => Object.assign(a, { desc: `基礎等級達到 ${a.goal}` })),

  acvTiers('jlv', 'growth', '📘',
    ['略有小成', '術業專精', '爐火純青'],
    [10, 30, 50], () => state.jobLevel || 1,
    [300, 4000, 30000]
  ).map(a => Object.assign(a, { desc: `職業等級達到 ${a.goal}` })),

  { id: 'job_change_1', cat: 'growth', icon: '🌳', name: '找到天職', desc: '完成第一次轉職',   goal: 1, tier: 1, progress: acvJobChanges, reward: { gold: 1000, point: 2 } },
  { id: 'job_change_2', cat: 'growth', icon: '🌲', name: '更上層樓', desc: '完成二轉',         goal: 2, tier: 3, progress: acvJobChanges, reward: { gold: 20000, point: 4 } },
  { id: 'stat_50',      cat: 'growth', icon: '💪', name: '偏科生',   desc: '單項屬性達到 50',  goal: 50, tier: 2, progress: acvMaxStat, reward: { gold: 3000, point: 2 } },
  { id: 'stat_99',      cat: 'growth', icon: '🔥', name: '極致專精', desc: '單項屬性達到 99',  goal: 99, tier: 4, progress: acvMaxStat, reward: { gold: 60000, point: 4 } },

  /* ---- 財富 ---- */
  acvTiers('gold', 'wealth', '💰',
    ['小有積蓄', '衣食無憂', '富甲一方', '富可敵國'],
    [10000, 100000, 1000000, 10000000], () => state.gold || 0,
    [500, 5000, 50000, 500000]
  ).map(a => Object.assign(a, { desc: `持有 ${a.goal.toLocaleString()} 鋅幣` })),

  /* ---- 探索 ---- */
  acvTiers('map', 'explore', '🗺️',
    ['離家出走', '旅人', '遊歷四方', '踏遍山河', '無處不至'],
    [5, 20, 60, 150, 309], acvMapsVisited,
    [300, 2000, 12000, 60000, 300000]
  ).map(a => Object.assign(a, { desc: `造訪 ${a.goal} 張地圖` })),

  /* ---- 裝備 ---- */
  { id: 'refine_4',   cat: 'gear', icon: '🔨', name: '初階鍛冶',   desc: '將裝備精煉到 +4',   goal: 4,  tier: 1, progress: acvMaxRefine, reward: { gold: 1000, point: 1 } },
  { id: 'refine_7',   cat: 'gear', icon: '⚒️', name: '賭徒之心',   desc: '將裝備精煉到 +7',   goal: 7,  tier: 3, progress: acvMaxRefine, reward: { gold: 15000, point: 3 } },
  { id: 'refine_10',  cat: 'gear', icon: '✨', name: '神之鎚',     desc: '將裝備精煉到 +10',  goal: 10, tier: 5, progress: acvMaxRefine, reward: { gold: 200000, point: 5 } },
  { id: 'card_eq_1',  cat: 'gear', icon: '🎴', name: '初次插卡',   desc: '在裝備上插入 1 張卡片', goal: 1,  tier: 1, progress: acvCardsEquipped, reward: { gold: 500, point: 1 } },
  { id: 'card_eq_5',  cat: 'gear', icon: '🎴', name: '卡組成形',   desc: '同時裝備 5 張卡片',     goal: 5,  tier: 3, progress: acvCardsEquipped, reward: { gold: 20000, point: 3 } },
  { id: 'equip_full', cat: 'gear', icon: '🛡️', name: '全副武裝',   desc: '同時裝備滿 10 個部位',  goal: 10, tier: 3, progress: acvEquipSlotsFilled, reward: { gold: 15000, point: 3 } }
);

const ACHIEVEMENTS_BY_ID = {};
ACHIEVEMENTS.forEach(a => { ACHIEVEMENTS_BY_ID[a.id] = a; });

/* ---------------- 判定 ---------------- */
function ensureAchievements() {
  if (!state.achievements) state.achievements = { done: {}, points: 0 };
  if (!state.achievements.done) state.achievements.done = {};
  if (typeof state.achievements.points !== 'number') state.achievements.points = 0;
  return state.achievements;
}

function achievementProgress(a) {
  try { return a.progress() || 0; } catch (e) { return 0; }
}

// 每秒由 gameTick 的慢速區段呼叫一次
function checkAchievements() {
  if (!state) return;
  const av = ensureAchievements();
  const unlocked = [];
  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    const a = ACHIEVEMENTS[i];
    if (av.done[a.id]) continue;
    if (achievementProgress(a) < a.goal) continue;
    av.done[a.id] = Date.now();
    av.points += a.reward.point || 0;
    if (a.reward.gold) state.gold += a.reward.gold;
    unlocked.push(a);
  }
  if (!unlocked.length) return;
  unlocked.forEach(a => {
    logMsg(`🏆 達成成就「${a.name}」！${a.reward.gold ? `獲得 ${a.reward.gold.toLocaleString()} 鋅幣、` : ''}成就點數 +${a.reward.point}`);
  });
  if (typeof onAchievementUnlocked === 'function') onAchievementUnlocked(unlocked);
  saveGame();
}

function getAchievementSummary() {
  const av = ensureAchievements();
  const total = ACHIEVEMENTS.length;
  const done = Object.keys(av.done).length;
  const byCat = {};
  Object.keys(ACHIEVEMENT_CATEGORIES).forEach(c => { byCat[c] = { done: 0, total: 0 }; });
  ACHIEVEMENTS.forEach(a => {
    byCat[a.cat].total++;
    if (av.done[a.id]) byCat[a.cat].done++;
  });
  return { done, total, points: av.points, byCat };
}
