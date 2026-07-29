/* ============================================================
   RO 放置世界 — 遊戲引擎
   ============================================================ */

const SAVE_KEY_PREFIX = 'ro_idle_save_slot_';
let currentSlot = 0; // 目前使用的存檔欄位 (0-8)
const MAX_SLOTS = 9;

function getSlotKey(slot) { return SAVE_KEY_PREFIX + slot; }
const TICK_MS = 100;

/* ---------------- 跨角色倉庫（獨立於任何存檔欄位，全帳號共用）---------------- */
const WAREHOUSE_KEY = 'ro_idle_warehouse';
function loadWarehouse() {
  try {
    const raw = localStorage.getItem(WAREHOUSE_KEY);
    const wh = raw ? JSON.parse(raw) : { items: [] };
    if (!wh.items) wh.items = [];
    if (typeof wh.gold !== 'number') wh.gold = 0;
    return wh;
  } catch (e) { return { items: [], gold: 0 }; }
}
function saveWarehouse(wh) {
  try { localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(wh)); } catch (e) { /* 忽略儲存失敗 */ }
}
function depositToWarehouse(itemId, qty) {
  const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
  if (!row || row.qty < qty) return false;
  removeItem(itemId, qty);
  const wh = loadWarehouse();
  const whRow = wh.items.find(r => r.item === itemId && !r.instanceId);
  if (whRow) whRow.qty += qty; else wh.items.push({ item: itemId, qty });
  saveWarehouse(wh);
  saveGame();
  logMsg(`📦 將 ${getItemDisplayName(itemId)} x${qty} 存入倉庫。`);
  return true;
}
function depositToWarehouseAll(itemId) {
  const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
  if (!row || row.qty < 1) return false;
  return depositToWarehouse(itemId, row.qty);
}
function withdrawFromWarehouse(itemId, qty) {
  const wh = loadWarehouse();
  const whRow = wh.items.find(r => r.item === itemId && !r.instanceId);
  if (!whRow || whRow.qty < qty) return false;
  whRow.qty -= qty;
  if (whRow.qty <= 0) wh.items = wh.items.filter(r => !(r.item === itemId && !r.instanceId));
  saveWarehouse(wh);
  addItem(itemId, qty);
  saveGame();
  logMsg(`📦 從倉庫領出 ${getItemDisplayName(itemId)} x${qty}。`);
  return true;
}
function withdrawFromWarehouseAll(itemId) {
  const wh = loadWarehouse();
  const whRow = wh.items.find(r => r.item === itemId && !r.instanceId);
  if (!whRow || whRow.qty < 1) return false;
  return withdrawFromWarehouse(itemId, whRow.qty);
}
/* 個體裝備進出倉庫：精煉度與卡片直接寫在倉庫那一行資料裡。
   倉庫是全帳號共用的，不能引用任何角色自己的 state.instances，
   所以存入時把個體內容攤平寫進倉庫，領出時再於當前角色重建一個新個體。 */
function depositInstanceToWarehouse(instanceId) {
  const idx = state.inventory.findIndex(r => r.instanceId === instanceId);
  const inst = state.instances && state.instances[instanceId];
  if (idx === -1 || !inst) return false;
  const label = describeInstance(inst);
  state.inventory.splice(idx, 1);
  delete state.instances[instanceId];
  const wh = loadWarehouse();
  wh.items.push({
    item: inst.item, qty: 1,
    instanceId: 'wh_' + inst.item + '_' + Date.now() + '_' + Math.floor(Math.random() * 10000),
    refine: inst.refine || 0,
    cards: (inst.cards || []).slice()
  });
  saveWarehouse(wh);
  saveGame();
  logMsg(`📦 將 ${label} 存入倉庫。`);
  return true;
}
function withdrawInstanceFromWarehouse(whInstanceId) {
  const wh = loadWarehouse();
  const idx = wh.items.findIndex(r => r.instanceId === whInstanceId);
  if (idx === -1) return false;
  const row = wh.items[idx];
  wh.items.splice(idx, 1);
  saveWarehouse(wh);
  if (!state.instances) state.instances = {};
  const id = row.item + '#' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  state.instances[id] = { item: row.item, refine: row.refine || 0, cards: (row.cards || []).slice() };
  state.inventory.push({ item: row.item, qty: 1, instanceId: id });
  codexRecordItem(row.item, 1);
  saveGame();
  logMsg(`📦 從倉庫領出 ${describeInstance(state.instances[id])}。`);
  return true;
}
function depositGoldToWarehouse(amount) {
  amount = Math.floor(Number(amount));
  if (!amount || amount < 1 || state.gold < amount) return false;
  state.gold -= amount;
  const wh = loadWarehouse();
  wh.gold += amount;
  saveWarehouse(wh);
  saveGame();
  logMsg(`📦 將 ${amount} 鋅幣存入倉庫。`);
  return true;
}
function withdrawGoldFromWarehouse(amount) {
  amount = Math.floor(Number(amount));
  const wh = loadWarehouse();
  if (!amount || amount < 1 || wh.gold < amount) return false;
  wh.gold -= amount;
  saveWarehouse(wh);
  state.gold += amount;
  saveGame();
  logMsg(`📦 從倉庫領出 ${amount} 鋅幣。`);
  return true;
}
const OFFLINE_CAP_MS = 24 * 60 * 60 * 1000; // 離線掛機最多累積 24 小時
const OFFLINE_MIN_MS = 30 * 1000;            // 離線超過 30 秒才顯示結算

/* ---------------- ASPD 攻擊間隔計算 ----------------
   對照 RO Wiki 官方公式：
     Hits/sec = 50 / (200 - ASPD)
     Attack Interval (ms) = 1000 / Hits/sec = 20 * (200 - ASPD)
   
   ASPD 範圍：100 ~ 193
   - ASPD 100 → 0.5 hits/s (2000ms) 每 2 秒攻擊一次（極慢）
   - ASPD 150 → 1.0 hits/s (1000ms) 每秒攻擊一次
   - ASPD 175 → 2.0 hits/s (500ms) 每秒攻擊兩次
   - ASPD 190 → 5.0 hits/s (200ms) 每秒攻擊五次
   - ASPD 193 → 7.14 hits/s (140ms) 最速
------------------------------------------------- */
function getAttackInterval(finalASPD) {
  // RO 官方公式：Attack Interval (ms) = 20 * (200 - ASPD)
  const interval = 20 * (200 - finalASPD);
  return Math.max(140, Math.round(interval)); // 最短 140ms（ASPD 193）
}

let state = null;      // 目前角色狀態
let tickTimer = null;
let combatLogBuf = [];

/* ---------------- 建立新角色 ---------------- */
function createCharacter(name, statAlloc, gender) {
  const stats = { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 };
  STAT_KEYS.forEach(k => { stats[k] += (statAlloc[k] || 0); });

  state = {
    name: name || '無名冒險者',
    gender: gender || 'male',
    jobId: 'novice',
    baseLevel: 1, baseExp: 0,
    jobLevel: 1, jobExp: 0,
    stats,
    statPoints: 0,
    skillPoints: 0, // 保留相容性，實際使用 jobSkillPoints
    jobSkillPoints: {}, // { jobId: remainingPoints } 按職業分離的技能點
    jobLevelHistory: {}, // { jobId: jobLevel } 轉職歷史（職業加成跨職業繼承）
    learnedSkills: {},   // {skillId: level}
    equip: { head_top: null, head_mid: null, head_bottom: null, weapon: null, armor: null, shield: null, garment: null, footgear: null, accessory1: null, accessory2: null, ammo: null },
    equipSkin: 'grid',  // 裝備視窗外觀：grid / ro / ro_dark
    refinement: {},   // 舊版精煉資料（按itemId），僅供遷移讀取，新邏輯一律用 instances
    equippedCards: {}, // 舊版插卡資料（按欄位），僅供遷移讀取，新邏輯一律用 instances
    instances: {},     // { instanceId: {item, refine, cards:[cardId,...]} } 精煉或插卡過的裝備會變成獨立個體，跟著那一件走
    inventory: [],        // [{item:'jellopy', qty:3}]
    gold: 50,
    mapId: 'novice_safe',
    monster: null,        // {defId, hp, maxHp} - 保留相容性
    monsters: [],         // [{defId, hp, maxHp, id}] 多怪物系統
    monsterIdCounter: 0,  // 怪物唯一ID計數器
    maxMonsters: 5,       // 近戰模式最大怪物數量
    encounterMode: 'melee', // 'melee'=近戰, 'ranged'=遠攻
    mvpMode: false,         // MVP 模式開關
    lastSpawnTime: 0,     // 上次生怪時間
    hp: 1, sp: 1, maxHp: 1, maxSp: 1,
    cooldowns: {},         // {skillId: msRemaining}
    buffs: [],             // [{type,mult,msRemaining}]
    autoSkill: true,
    autoSkillConfig: { skillId: null, mode: 'once', spThreshold: 30, skillId2: null, spThreshold2: 50, monsterCount2: 2 }, // skillId2=第二招, spThreshold2=SP%門檻, monsterCount2=怪物數門檻
    autoPotion: { enabled: true, primary: '', fallback: 'red_potion', hpThreshold: 50 },
    autoSpPotion: { enabled: false, primary: '', fallback: 'blue_potion', spThreshold: 30 },
    autoAspdPotion: { enabled: false, items: [] },
    autoBuyAspdPotion: false,
    autoBuyPotion: true,
    autoBuySpPotion: false,
    autoBuyArrow: true,
    autoSellConfig: { enabled: false, items: [] }, // 自動販賣：每30秒自動賣出背包內已選擇的道具
    autoSellReadyAt: 0,
    cardEleDmgBonus: {}, // 屬性傷害加成（由卡片提供）
    codex: { mon: {}, seen: {}, item: {}, maps: {} }, // 圖鑑：擊殺數 / 已發現怪物 / 累計取得道具 / 造訪過的地圖
    lockedItems: {}, // { itemId: 1 } 鎖定的道具，不會被賣出／自動販賣／露天商店處理
    achievements: { done: {}, points: 0 },
    deaths: 0,
    muted: false,
    lastAttackTime: Date.now(),
    attackAccumulator: 0,
    createdAt: Date.now(),
    lastActiveAt: Date.now()
  };
  recomputeDerived(true);
  addItem('red_potion', 100);
  // Starting items: dagger and clothes
  addItem('knife', 1);
  addItem('cotton_shirt', 1);
  logMsg(`歡迎，${state.name}！你的冒險即將展開。`);
  logMsg('新手包：獲得紅色藥水 x100、短劍 x1、棉襯衫 x1！');
  spawnMonster();
  saveGame();
}

/* ---------------- 衍生數值計算 ----------------
   六圍的公式參考 RO 正式版(Renewal)的計算邏輯調整而來(非逐位元還原，依放置遊戲步調調整常數)：
     ATK    = STR + floor((STR/10)^2) + floor(DEX/5) + floor(LUK/5)      ← StatusATK 公式
     MATK   = INT + floor((INT/7)^2)~floor((INT/5)^2) 區間，取中點戰鬥用 ← MATK 區間公式
     HIT    = 175 + 基礎等級 + DEX                                       ← 經典命中公式
     FLEE   = 100 + 基礎等級 + AGI                                       ← 經典迴避公式
     完全迴避 = floor(LUK/10) %                                          ← LUK 完全迴避
     暴擊率  = 4 + floor(LUK/3) %（新增：暴擊無視命中判定）
     DEF    = VIT為主的軟防禦 + 裝備硬防禦，戰鬥時以「比例減傷」而非直接相減
------------------------------------------------- */
function currentJob() { return JOB_TREE[state.jobId]; }

// 可雙持單手武器的職業（左手欄位可放武器而非盾牌）
function canDualWield(jobId) { return jobId === 'assassin'; }

// 長矛類武器判定（矛限定技能共用）：道具資料的weaponType欄位對矛類武器標示很乾淨，直接用它判斷
/* ---------------- 箭矢／彈藥系統 ----------------
   弓類武器需要裝備箭矢才能攻擊。箭矢提供額外 ATK，且屬性箭會覆寫武器屬性
   （官方 RO 規則：弓本身無屬性，實際打出去的屬性由箭矢決定）。
   每次普攻消耗 1 支，用完會自動從背包補同一種，沒有就停手。
------------------------------------------------- */
function isBowWeapon(itemId) {
  const w = itemId ? ITEMS[itemId] : null;
  return !!(w && w.weaponType === 'bow');
}
function needsAmmo() { return isBowWeapon(getEquipBaseItemId('weapon')); }
function isAmmoItem(itemId) {
  const d = itemId ? ITEMS[itemId] : null;
  return !!(d && d.ammo);
}
function getEquippedAmmoId() { return (state && state.equip) ? (state.equip.ammo || null) : null; }
function getEquippedAmmo() {
  const id = getEquippedAmmoId();
  return id ? ITEMS[id] : null;
}
// 目前裝備的箭矢剩餘數（箭矢就存在背包裡，裝備欄只記「選了哪一種」）
function getAmmoCount() {
  const id = getEquippedAmmoId();
  return id ? getItemQty(id) : 0;
}
function equipAmmo(itemId) {
  if (!isAmmoItem(itemId)) return false;
  if (getItemQty(itemId) < 1) { logMsg('⚠️ 你沒有這種箭矢。'); return false; }
  state.equip.ammo = itemId;
  recomputeDerived(false);
  logMsg(`🏹 裝備了 ${ITEMS[itemId].name}（剩餘 ${getItemQty(itemId)}）。`);
  saveGame();
  return true;
}
function unequipAmmo() {
  if (!state.equip.ammo) return false;
  const nm = ITEMS[state.equip.ammo] ? ITEMS[state.equip.ammo].name : '箭矢';
  state.equip.ammo = null;
  recomputeDerived(false);
  logMsg(`卸下了 ${nm}。`);
  saveGame();
  return true;
}
// 消耗一支箭；回傳 false 代表沒箭了（呼叫端要中止這次攻擊）
function consumeAmmo() {
  const id = getEquippedAmmoId();
  if (!id) return false;
  if (getItemQty(id) < 1) return false;
  removeItem(id, 1);
  if (getItemQty(id) <= 0) {
    logMsg(`🏹 ${ITEMS[id].name} 用完了！`);
    // 背包還有別種箭就自動換上，免得掛機時默默停擺
    const next = state.inventory.find(r => !r.instanceId && isAmmoItem(r.item) && r.qty > 0);
    if (next) {
      state.equip.ammo = next.item;
      logMsg(`🏹 自動換上 ${ITEMS[next.item].name}（剩餘 ${next.qty}）。`);
    } else {
      state.equip.ammo = null;
    }
    recomputeDerived(false);
  }
  return true;
}

function hasSpearEquipped() {
  const wId = getEquipBaseItemId('weapon');
  const w = wId ? ITEMS[wId] : null;
  return !!(w && w.weaponType === 'spear');
}

function equippedWeaponType() {
  const wId = getEquipBaseItemId('weapon');
  const w = wId ? ITEMS[wId] : null;
  return w ? w.weaponType : null;
}
// 體型傷害修正：只影響物理傷害，怪物沒有size資料（尚未套用新資料）時視為無修正
function getSizeMultiplier(monDef) {
  if (!monDef || !monDef.size) return 1;
  const table = SIZE_MODIFIER[equippedWeaponType()] || SIZE_MODIFIER.default;
  const pct = table[monDef.size];
  return pct !== undefined ? pct / 100 : 1;
}
// 種族固定傷害加成，不受DEF削減：動物殺手（動物/昆蟲）、天使之擊（惡魔/不死）
function raceFlatBonus(monDef) {
  if (!monDef || !monDef.race) return 0;
  let bonus = 0;
  if ((monDef.race === 'brute' || monDef.race === 'insect') && state.animalDamageFlat) {
    bonus += state.animalDamageFlat;
  }
  if ((monDef.race === 'demon' || monDef.race === 'undead') && state.angelicAtkBonus) {
    bonus += state.angelicAtkBonus;
  }
  return bonus;
}

/* ---------------- 裝備個體化 ----------------
   精煉或插卡之後，那一件裝備就變成獨立個體，狀態跟著它本身走，不再跟背包裡同名的其他份共用。
   state.equip[slot] 存的可能是「道具id」（普通裝備）或「個體id」（個體裝備），
   一律透過 getEquipBaseItemId() 取得真正的道具id，別直接拿 state.equip[slot] 去查 ITEMS。
------------------------------------------------- */
function getEquipBaseItemId(slot) {
  const ref = state.equip[slot];
  if (ref && state.instances && state.instances[ref]) return state.instances[ref].item;
  return ref;
}
function getEquipInstance(slot) {
  const ref = state.equip[slot];
  if (ref && state.instances && state.instances[ref]) return state.instances[ref];
  return null;
}
// 取得（或視需要建立）該欄位裝備的個體紀錄，回傳 instanceId；精煉/插卡第一次發生時把普通道具轉成個體
function getOrCreateEquipInstance(slot) {
  const ref = state.equip[slot];
  if (!ref) return null;
  if (state.instances[ref]) return ref;
  const id = ref + '#' + Date.now() + '_' + Math.floor(Math.random() * 10000);
  state.instances[id] = { item: ref, refine: 0, cards: [] };
  state.equip[slot] = id;
  return id;
}
// 個體如果精煉歸零又沒卡片，還原成普通道具，免得背包留下一堆沒意義的獨立行
function maybeDeinstanceSlot(slot) {
  const ref = state.equip[slot];
  if (!ref || !state.instances[ref]) return;
  const inst = state.instances[ref];
  if ((inst.refine || 0) === 0 && (!inst.cards || inst.cards.length === 0)) {
    state.equip[slot] = inst.item;
    delete state.instances[ref];
  }
}
// 把某欄位目前的裝備放回背包（普通道具照樣堆疊，個體裝備獨立一行），並清空欄位
function returnEquipToInventory(slot) {
  const ref = state.equip[slot];
  if (!ref) return;
  if (state.instances && state.instances[ref]) {
    state.inventory.push({ item: state.instances[ref].item, qty: 1, instanceId: ref });
  } else {
    addItem(ref, 1);
  }
  state.equip[slot] = null;
}

function equippedAtk() {
  const wId = getEquipBaseItemId('weapon');
  const w = wId ? ITEMS[wId] : null;
  const baseAtk = w && w.atk ? w.atk : 0;
  const refLevel = getRefinementLevel('weapon');
  const weaponLv = w ? (w.weaponLv || 1) : 1;
  let mainAtk = baseAtk + getRefinementAtkBonus(refLevel, weaponLv);
  // 弓：箭矢的 ATK 直接加進武器攻擊力（官方 RO 就是這樣算）
  if (isBowWeapon(wId)) {
    const ammo = getEquippedAmmo();
    if (ammo && ammo.atk) mainAtk += ammo.atk;
  }

  // 雙持：左手欄位裝備的是單手武器而非盾牌時，套用右手/左手修練的傷害修正
  const offId = getEquipBaseItemId('shield');
  const offItem = offId ? ITEMS[offId] : null;
  if (offItem && offItem.type === 'weapon' && canDualWield(state.jobId)) {
    const offRefLevel = getRefinementLevel('shield');
    const offWeaponLv = offItem.weaponLv || 1;
    const offAtk = (offItem.atk || 0) + getRefinementAtkBonus(offRefLevel, offWeaponLv);
    const rightPct = (state.rightHandPct != null ? state.rightHandPct : 50) / 100;
    const leftPct = (state.leftHandPct != null ? state.leftHandPct : 30) / 100;
    mainAtk = mainAtk * rightPct + offAtk * leftPct;
  }
  return mainAtk;
}
function equippedMatk() {
  const wId = getEquipBaseItemId('weapon');
  const w = wId ? ITEMS[wId] : null;
  return w && w.matk ? w.matk : 0;
}
function equippedDef() {
  let def = 0;
  // Check all equipped armor slots
  ['head_top', 'head_mid', 'head_bottom', 'armor', 'shield', 'garment', 'footgear', 'accessory1', 'accessory2'].forEach(slot => {
    const id = getEquipBaseItemId(slot);
    const a = id ? ITEMS[id] : null;
    const baseDef = a && a.def ? a.def : 0;
    def += baseDef + getRefinementDefBonus(getRefinementLevel(slot));
  });
  return def;
}
// 裝備本體（武器/防具/飾品）自帶的加成數值加總：許多防具本身就有寫str/agi/vit/int/dex/luk/atk/flee/hit/critRate/perfectDodge/hp/sp等欄位，
// 但過去只有equippedDef()把def讀出來，其餘欄位全部沒有實際套用，等於裝了也沒效果（純UI顯示用），這裡統一補上
const EQUIP_SLOTS_ALL = ['weapon', 'head_top', 'head_mid', 'head_bottom', 'armor', 'shield', 'garment', 'footgear', 'accessory1', 'accessory2'];
// atk/matk已由equippedAtk()/equippedMatk()從武器欄位讀取（含精煉加成），這裡加總其餘欄位時排除武器欄，避免武器ATK被重複計算兩次
const EQUIP_SLOTS_NO_WEAPON = EQUIP_SLOTS_ALL.filter(s => s !== 'weapon');
function equippedStatBonus(stat) {
  const slots = (stat === 'atk' || stat === 'matk') ? EQUIP_SLOTS_NO_WEAPON : EQUIP_SLOTS_ALL;
  let total = 0;
  slots.forEach(slot => {
    const id = getEquipBaseItemId(slot);
    const it = id ? ITEMS[id] : null;
    if (it && typeof it[stat] === 'number') total += it[stat];
  });
  return total;
}

function recomputeDerived(fullHeal) {
  const job = currentJob();
  const s = state.stats;
  const bl = state.baseLevel;

  // 職業加成（跨職業累計繼承）
  const jobBonus = computeJobBonuses();

  // RO 官方 HP/SP 查找表
  // MAX_HP = floor(JOB_BASE_HP[jobId][level-1] × (1 + VIT*0.01))
  // MAX_SP = floor(JOB_BASE_SP[jobId][level-1] × (1 + INT*0.01))
  const jobId = job.id;
  const hpTable = JOB_BASE_HP[jobId] || JOB_BASE_HP.novice;
  const spTable = JOB_BASE_SP[jobId] || JOB_BASE_SP.novice;
  const baseHP = hpTable[Math.min(bl, 100) - 1] || 35;
  const baseSP = spTable[Math.min(bl, 100) - 1] || 10;
  const effVit = s.vit + jobBonus.vit;
  const effInt = s.int + jobBonus.int;
  const newMaxHp = Math.floor(baseHP * (1 + effVit * 0.01) * job.hpMod);
  const newMaxSp = Math.floor(baseSP * (1 + effInt * 0.01) * job.spMod);

  state.maxHp = newMaxHp;
  state.maxSp = newMaxSp;
  // 注意：這裡先不夾住hp/sp！體能強化(maxHpMult)、卡片HP%/SP%加成等都會在後面才疊加到
  // state.maxHp/maxSp 上，若在此處就用未套用加成的newMaxHp夾住hp，會在每次呼叫(tickBuffs每100ms
  // 都會呼叫一次)把hp錯誤地砍回未加成的較低數值——夾住的動作統一移到函式最後，用最終數值執行。

  // 被動技能 STR/INT/DEX 固定加成（必須在衍生數值計算之前，避免直接修改 state.stats 導致膨脹）
  let passiveStrBonus = 0, passiveIntBonus = 0, passiveDexBonus = 0;
  const passiveJobsEarly = getAllLearnedJobs();
  for (const jid of passiveJobsEarly) {
    const jd = JOB_TREE[jid];
    if (!jd) continue;
    jd.skills.forEach(sk => {
      const lv = state.learnedSkills[sk.id];
      if (!lv || sk.type !== 'passive') return;
      if (sk.passiveStat === 'dexFlat') {
        const val = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
        passiveDexBonus += Math.round(val);
      } else if (sk.passiveStat === 'triStatBonus') {
        // 物品鑑定：STR/INT/DEX 同時加成
        const val = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
        passiveStrBonus += Math.round(val);
        passiveIntBonus += Math.round(val);
        passiveDexBonus += Math.round(val);
      }
      // 武器保有：附加固定STR加成
      if (sk.strBonus) {
        const sb = Array.isArray(sk.strBonus) ? sk.strBonus[lv - 1] : sk.strBonus;
        passiveStrBonus += Math.round(sb);
      }
      // 怪物情報：附加固定INT加成
      if (sk.intBonus) {
        const ib = Array.isArray(sk.intBonus) ? sk.intBonus[lv - 1] : sk.intBonus;
        passiveIntBonus += Math.round(ib);
      }
    });
  }
  // 大聲吶喊buff：STR 固定加成
  let buffStrBonus = 0;
  state.buffs.forEach(b => { if (b.type === 'flatstat' && b.strBonus) buffStrBonus += b.strBonus; });
  passiveStrBonus += buffStrBonus;
  // 天使之賜福buff：STR/INT/DEX 同時固定加成
  state.buffs.forEach(b => {
    if (b.type === 'blessing') {
      passiveStrBonus += b.strBonus || 0;
      passiveIntBonus += b.intBonus || 0;
      passiveDexBonus += b.dexBonus || 0;
    }
  });
  state._passiveDexBonus = passiveDexBonus;
  // 加速術buff：AGI 固定加成
  let buffAgiBonus = 0;
  state.buffs.forEach(b => { if (b.type === 'agiflat') buffAgiBonus += b.flatBonus || 0; });

  // 心神凝聚buff：DEX/AGI 百分比加成（影響下面所有衍生自DEX/AGI的數值，含攻速）
  let buffStatPct = 0;
  state.buffs.forEach(b => { if (b.type === 'statpct') buffStatPct += b.mult; });
  state._buffStatPct = buffStatPct;

  // 幸運之頌歌buff：LUK 固定加成
  let buffLukBonus = 0;
  state.buffs.forEach(b => { if (b.type === 'lukflat') buffLukBonus += b.flatBonus || 0; });

  // ATK：StatusATK = STR + (STR/10)² + DEX/5 + LUK/5（含職業加成與卡片加成）
  const cStr = s.str + jobBonus.str + getCardBonus('str') + equippedStatBonus('str') + passiveStrBonus;
  const cDex = Math.round((s.dex + jobBonus.dex + getCardBonus('dex') + equippedStatBonus('dex') + passiveDexBonus) * (1 + buffStatPct));
  const cLuk = s.luk + jobBonus.luk + getCardBonus('luk') + equippedStatBonus('luk') + buffLukBonus;
  const cAgi = Math.round((s.agi + jobBonus.agi + getCardBonus('agi') + equippedStatBonus('agi') + buffAgiBonus) * (1 + buffStatPct));
  const cVit = s.vit + jobBonus.vit + getCardBonus('vit') + equippedStatBonus('vit');
  const cInt = s.int + jobBonus.int + getCardBonus('int') + equippedStatBonus('int') + passiveIntBonus;
  const statusAtk = cStr + Math.floor((cStr / 10) ** 2) + Math.floor(cDex / 5) + Math.floor(cLuk / 5);
  state.atk = Math.round(statusAtk * job.atkMod) + equippedAtk();
  // 大聲吶喊buff：ATK 固定加成（於狀態ATK算完後直接加）
  let buffAtkFlat = 0;
  state.buffs.forEach(b => { if (b.type === 'flatstat' && b.flatBonus) buffAtkFlat += b.flatBonus; });
  state.atk += buffAtkFlat;

  // MATK：區間公式，min = INT+(INT/7)²，max = INT+(INT/5)²，取平均當戰鬥數值
  const matkMinRaw = cInt + Math.floor((cInt / 7) ** 2) + Math.floor(cDex / 5);
  const matkMaxRaw = cInt + Math.floor((cInt / 5) ** 2) + Math.floor(cDex / 5) + Math.floor(cLuk / 3);
  state.matkMin = Math.round(matkMinRaw * job.matkMod) + equippedMatk();
  state.matkMax = Math.round(matkMaxRaw * job.matkMod) + equippedMatk();
  state.matk = Math.round((state.matkMin + state.matkMax) / 2);

  // DEF：VIT 軟防禦 + 裝備硬防禦（戰鬥時走比例減傷，見 mitigateDamage）
  state.def = Math.round(cVit * 1.0 + bl * 0.3) + equippedDef();

  // HIT / FLEE：經典 RO 常數公式
  state.hit = 175 + bl + cDex;
  state.flee = 100 + bl + cAgi;

  // 完全迴避（無視命中判定）與暴擊率（無視閃避判定）
  state.perfectDodge = Math.floor(cLuk / 10);
  state.critRate = Math.min(50, 4 + Math.floor(cLuk / 3));

  // ASPD 初始計算（不含 buff，buff 在 tick 時動態套用）
  // 官方計算機用的是「總 AGI/DEX」（含職業、裝備、卡片、buff），先寄存給 computeAspd() 用
  state._totalAgi = cAgi;
  state._totalDex = cDex;
  computeAspd();

  // Passive skill bonuses（跨職業）
  state.stealChance = 0;
  state.hasAutoDetox = false;
  state.hasSandmanProc = false;
  state.hasBackslideDodge = false;
  state.hasPoisonReact = false;
  state.hasVenomdustProc = false;
  state.hasVenominfusionProc = false;
  state.hasSonicblowBoost = false;
  state.passiveAspdFlat = 0;
  state.falconFlatBonus = 0;
  state.animalDamageFlat = 0;
  state.angelicAtkBonus = 0;
  state.divineDefBonus = 0;
  state.trapCdReductionSec = 0;
  state.trapChanceBonusPct = 0;
  state.shopDiscountMult = 1;
  state.shopOverchargeMult = 1;
  state.hasAutoCartItem = false;
  state.cartItemIntervalSec = 15;
  state.cartItemPool = ['carrot'];
  state.cartDmgBonusMult = 0;
  state.hasElementalStoneProc = false;
  state.elementalStoneChance = 0;
  state.craftBonusPct = 0;
  state.unlockedCraftCategories = [];
  state.unlockedMaterialCrafts = [];
  state.fireResistPct = 0;
  state.neutralResistPct = 0;
  state.hasFindingOreProc = false;
  state.findingOreChance = 0;
  state.hasGreedProc = false;
  state.greedChance = 0;
  state.hasHammerfallProc = false;
  state.hammerfallSingleChance = 0;
  state.hammerfallAoeChance = 0;
  state.hammerfallStunSec = 1;
  state.zenyCostReductionPct = {};
  state.hiltBindingDurationBonus = 0;
  state.hasOnHitStunProc = false;
  state.onHitStunChance = 0;
  state.onHitStunSec = 0.5;
  state.onHitStunCooldownSec = 10;
  state.zenSpFlatBonus = 0;
  state.zenSpPctBonus = 0;
  state.spItemEffectBonusPct = 0;
  state.hasAspdFlatPassive = false;
  state.hasAngelusProc = false;
  state.angelusCooldownSec = 10;
  state.hasAutoRevive1 = false;
  state.autoRevive1HpPct = 0;
  state.autoRevive1CooldownSec = 0;
  state.autoRevive1SpCost = 0;
  state.hasAutoRevive2 = false;
  state.autoRevive2HpPct = 0;
  state.autoRevive2CooldownSec = 0;
  if (!state.activeFieldEffects) state.activeFieldEffects = [];
  if (!state.shields) state.shields = [];
  state.hasEnergyCoatUnlock = false;
  state.energyCoatDmgReductionPct = 0;
  state.energyCoatSpCostPct = 0;
  if (typeof state.energyCoatEnabled !== 'boolean') state.energyCoatEnabled = false;
  if (typeof state.energyCoatSpFloorPct !== 'number') state.energyCoatSpFloorPct = 20;
  state.hasOnHitAoeProc = false;
  state.onHitAoeProcChance = 0;
  state.onHitAoeProcMult = 0;
  state.onHitAoeProcElement = 'none';
  state.onHitAoeProcCooldownSec = 5;
  state.hasOnAttackAoeProc = false;
  state.onAttackAoeProcChance = 0;
  state.onAttackAoeFlatDmg = 0;
  state.onAttackAoeMult = 0;
  state.onAttackAoeElement = 'none';
  state.onAttackAoeCooldownSec = 5;
  state.hasAutoShield = false;
  state.autoShieldCapacity = 0;
  state.autoShieldCharges = 0;
  state.autoShieldCooldownSec = 20;
  state.hasOnHitAoeStunProc = false;
  state.onHitAoeStunChance = 0;
  state.onHitAoeStunMult = 0;
  state.onHitAoeStunElement = 'none';
  state.onHitAoeStunStunChance = 0;
  state.onHitAoeStunStunSec = 0;
  state.onHitAoeStunCooldownSec = 10;
  state.hasOnHitStunProc2 = false;
  state.onHitStunChance2 = 0;
  state.onHitStunSec2 = 0.5;
  state.onHitStunCooldownSec2 = 10;
  state.hpItemEffectBonusPct = 0;
  state.hasBashStunProc = false;
  state.bashStunProcChance = 0;
  state.bashStunProcSec = 1;
  state.hasSpearCounterProc = false;
  state.spearCounterChance = 0;
  state.spearCounterMult = 0;
  state.spearCounterStunSec = 2;
  state.spearCounterCooldownSec = 10;
  state.hasSpearBoomerangProc = false;
  state.spearBoomerangMult = 0;
  state.spearBoomerangCooldownSec = 5;
  state.hasChargeRandomProc = false;
  state.chargeRandomMult = 0;
  state.chargeRandomCooldownSec = 5;
  // 雙持右手/左手傷害修正：未修練時的預設值（低於Lv1）
  state.rightHandPct = 50;
  state.leftHandPct = 30;
  const passiveJobs = getAllLearnedJobs();
  for (const jid of passiveJobs) {
    const jd = JOB_TREE[jid];
    if (!jd) continue;
    jd.skills.forEach(sk => {
      const lv = state.learnedSkills[sk.id];
      if (!lv || sk.type !== 'passive') return;
      const val = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
      switch (sk.passiveStat) {
        case 'atkFlat': {
          // 長矛熟練：必須裝備矛類武器才生效
          if (sk.id === 'spearmastery' && !hasSpearEquipped()) break;
          // 天使之擊：官方效果限定對惡魔/不死種族生效，改成攻擊時依目標種族判定，不再全體適用
          if (sk.id === 'angelic') { state.angelicAtkBonus = Math.round(val); break; }
          state.atk += Math.round(val);
          // 武器修理：附加固定暴擊率加成
          if (sk.critBonus) {
            const cb = Array.isArray(sk.critBonus) ? sk.critBonus[lv - 1] : sk.critBonus;
            state.critRate = Math.min(100, state.critRate + cb);
          }
          // 武器研究：附加固定HIT與鍛造成功率加成
          if (sk.hitBonus) {
            const hb = Array.isArray(sk.hitBonus) ? sk.hitBonus[lv - 1] : sk.hitBonus;
            state.hit += Math.round(hb);
          }
          if (sk.craftBonusExtra) {
            const cbe = Array.isArray(sk.craftBonusExtra) ? sk.craftBonusExtra[lv - 1] : sk.craftBonusExtra;
            state.craftBonusPct += cbe;
          }
          // 武器保有：使速度激發/凶砍持續時間延長
          if (sk.buffDurationBonusPct) {
            const bd = Array.isArray(sk.buffDurationBonusPct) ? sk.buffDurationBonusPct[lv - 1] : sk.buffDurationBonusPct;
            state.hiltBindingDurationBonus = bd / 100;
          }
          break;
        }
        case 'matkFlat': state.matk += Math.round(val); break;
        case 'maxHpMult': state.maxHp = Math.round(state.maxHp * val); break;
        case 'maxSpMult': state.maxSp = Math.round(state.maxSp * val); break;
        case 'critRate': state.critRate = Math.min(100, state.critRate + val); break;
        case 'hitFlat': {
          state.hit += Math.round(val);
          // 蒼鷹之眼：額外附帶固定ASPD加成
          if (sk.id === 'vultureeye' && sk.aspdFlat) {
            const aspdBonus = Array.isArray(sk.aspdFlat) ? sk.aspdFlat[lv - 1] : sk.aspdFlat;
            state.passiveAspdFlat += aspdBonus;
          }
          break;
        }
        case 'fleeFlat': {
          // 殘影：轉職刺客系後改用較高的加成曲線
          let fleeVal = val;
          if (sk.id === 'improvedodge' && sk.assassinMult && state.jobId === 'assassin') {
            fleeVal = Array.isArray(sk.assassinMult) ? sk.assassinMult[lv - 1] : sk.assassinMult;
          }
          state.flee += Math.round(fleeVal);
          break;
        }
        // dexFlat 已在 recomputeDerived 開頭計算並加入 cDex，不再修改 state.stats.dex
        case 'defFlat': {
          // 天使之護：官方效果限定對惡魔/不死種族生效，改成被攻擊時依攻擊者種族判定，不再全體適用
          if (sk.id === 'divineprotection') { state.divineDefBonus = Math.round(val); break; }
          state.def += Math.round(val);
          break;
        }
        case 'spRegen': state.spRegenMult = (state.spRegenMult || 1) * val; break;
        case 'hpRegenMult': {
          state.hpRegenMult = (state.hpRegenMult || 1) * val;
          // 快速恢復：附加HP恢復道具效果加成
          if (sk.itemEffectBonus) state.hpItemEffectBonusPct = Array.isArray(sk.itemEffectBonus) ? sk.itemEffectBonus[lv - 1] : sk.itemEffectBonus;
          break;
        }
        case 'hpMoveRegen': state.hpMoveRegen = true; break;
        case 'berserk': state.hasBerserk = true; break;
        case 'bashStunProc': {
          state.hasBashStunProc = true;
          state.bashStunProcChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          state.bashStunProcSec = Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : (sk.stunSec || 1);
          break;
        }
        case 'riding': state.maxMonsters = Math.max(state.maxMonsters || 1, 1); state.hasRiding = true; break;
        case 'cavalierBonus': {
          state.flee += Math.round(val);
          if (sk.atkBonus) { const ab = Array.isArray(sk.atkBonus) ? sk.atkBonus[lv - 1] : sk.atkBonus; state.atk += Math.round(ab); }
          if (sk.critBonus) { const cb = Array.isArray(sk.critBonus) ? sk.critBonus[lv - 1] : sk.critBonus; state.critRate = Math.min(100, state.critRate + cb); }
          break;
        }
        case 'counterAttack': state.hasCounterAttack = true; state.counterAttackChance = val; break;
        case 'spearCounterProc': {
          state.hasSpearCounterProc = true;
          state.spearCounterChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          state.spearCounterMult = val;
          state.spearCounterStunSec = Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : (sk.stunSec || 2);
          state.spearCounterCooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 10);
          break;
        }
        case 'spearBoomerangProc': {
          state.hasSpearBoomerangProc = true;
          state.spearBoomerangMult = val;
          state.spearBoomerangCooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 5);
          break;
        }
        case 'chargeRandomProc': {
          state.hasChargeRandomProc = true;
          state.chargeRandomMult = val;
          state.chargeRandomCooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 5);
          break;
        }
        case 'steal': state.stealChance = val; break;
        case 'doubleAttack': {
          // 二刀連擊：額外附帶永久命中加成
          if (sk.hitBonus) {
            const hb = Array.isArray(sk.hitBonus) ? sk.hitBonus[lv - 1] : sk.hitBonus;
            state.hit += Math.round(hb);
          }
          break;
        }
        case 'autoDetox': {
          state.hasAutoDetox = true;
          state.autoDetoxCooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 30);
          break;
        }
        case 'sandmanProc': {
          state.hasSandmanProc = true;
          state.sandmanProcChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          state.sandmanHitDebuff = Array.isArray(sk.hitDebuff) ? sk.hitDebuff[lv - 1] : sk.hitDebuff;
          state.sandmanDebuffDuration = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
          break;
        }
        case 'backslideDodge': {
          state.hasBackslideDodge = true;
          state.backslideDodgeChance = Array.isArray(sk.dodgeChance) ? sk.dodgeChance[lv - 1] : sk.dodgeChance;
          break;
        }
        case 'rightHandPct': state.rightHandPct = val; break;
        case 'leftHandPct': state.leftHandPct = val; break;
        case 'poisonReact': {
          state.hasPoisonReact = true;
          state.poisonReactMult = val;
          state.poisonReactCooldownSec = sk.internalCooldown || 10;
          break;
        }
        case 'venomdustProc': {
          state.hasVenomdustProc = true;
          state.venomdustDmgPct = val;
          state.venomdustCooldownSec = sk.internalCooldown || 10;
          break;
        }
        case 'venominfusionProc': {
          state.hasVenominfusionProc = true;
          state.venominfusionDmgMult = val;
          state.venominfusionProcChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          state.venominfusionCooldownSec = sk.internalCooldown || 10;
          break;
        }
        case 'sonicblowBoost': state.hasSonicblowBoost = true; break;
        case 'falconFlatBonus': state.falconFlatBonus = val; break;
        case 'animalDamageFlat': state.animalDamageFlat = val; break;
        case 'trapCdReduction': state.trapCdReductionSec = val; break;
        case 'trapChanceBonus': state.trapChanceBonusPct = val; break;
        case 'huntingMastery': break; // 馴鷹術本身無效果，僅作為前置解鎖
        case 'discount': state.shopDiscountMult = val; break;
        case 'overcharge': state.shopOverchargeMult = val; break;
        case 'autoCartItem': {
          state.hasAutoCartItem = true;
          state.cartItemIntervalSec = Array.isArray(sk.intervalSec) ? sk.intervalSec[lv - 1] : sk.intervalSec;
          state.cartItemPool = Array.isArray(sk.itemPools) ? sk.itemPools[lv - 1] : ['carrot'];
          break;
        }
        case 'cartDmgBonus': state.cartDmgBonusMult = val; break;
        case 'vending': break; // 露天商店本身不影響數值，實際邏輯在 tryAutoVending()
        case 'craftBonus': state.craftBonusPct += val; break;
        case 'weaponCraft': {
          if (sk.craftCategory) state.unlockedCraftCategories.push(sk.craftCategory);
          break;
        }
        case 'materialCraft': {
          if (sk.craftCategory) state.unlockedMaterialCrafts.push(sk.craftCategory);
          break;
        }
        case 'fireResist': {
          state.fireResistPct = val;
          if (sk.neutralResistMult) {
            const nv = Array.isArray(sk.neutralResistMult) ? sk.neutralResistMult[lv - 1] : sk.neutralResistMult;
            state.neutralResistPct = nv;
          }
          break;
        }
        case 'findingoreProc': {
          state.hasFindingOreProc = true;
          state.findingOreChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          break;
        }
        case 'greedProc': {
          state.hasGreedProc = true;
          state.greedChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          break;
        }
        case 'hammerfallProc': {
          state.hasHammerfallProc = true;
          state.hammerfallSingleChance = Array.isArray(sk.singleStunChance) ? sk.singleStunChance[lv - 1] : sk.singleStunChance;
          state.hammerfallAoeChance = Array.isArray(sk.aoeStunChance) ? sk.aoeStunChance[lv - 1] : sk.aoeStunChance;
          state.hammerfallStunSec = Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : (sk.stunSec || 1);
          break;
        }
        case 'zenyCostReduction': {
          // 詭計的商術：目前僅套用於金錢攻擊(mammonite)，手推車終結技留待未來新職業加入後再接上
          state.zenyCostReductionPct['mammonite'] = val;
          break;
        }
        case 'onHitStunProc': {
          state.hasOnHitStunProc = true;
          state.onHitStunChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          state.onHitStunSec = sk.stunSec || 0.5;
          state.onHitStunCooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 10);
          break;
        }
        case 'zenRecovery': {
          state.zenSpFlatBonus = val;
          if (sk.spPctBonus) state.zenSpPctBonus = Array.isArray(sk.spPctBonus) ? sk.spPctBonus[lv - 1] : sk.spPctBonus;
          if (sk.itemEffectBonus) state.spItemEffectBonusPct = Array.isArray(sk.itemEffectBonus) ? sk.itemEffectBonus[lv - 1] : sk.itemEffectBonus;
          break;
        }
        case 'energyCoatUnlock': {
          state.hasEnergyCoatUnlock = true;
          state.energyCoatDmgReductionPct = Array.isArray(sk.dmgReductionPct) ? sk.dmgReductionPct[lv - 1] : sk.dmgReductionPct;
          state.energyCoatSpCostPct = Array.isArray(sk.spCostPct) ? sk.spCostPct[lv - 1] : sk.spCostPct;
          break;
        }
        case 'aspdFlat': {
          state.hasAspdFlatPassive = true;
          state.passiveAspdFlat += val;
          break;
        }
        case 'angelusProc': {
          state.hasAngelusProc = true;
          state.angelusCooldownSec = sk.angelusCooldownSec || 10;
          break;
        }
        case 'onDeathRevive1': {
          state.hasAutoRevive1 = true;
          state.autoRevive1HpPct = Array.isArray(sk.revivePct) ? sk.revivePct[lv - 1] : sk.revivePct;
          state.autoRevive1CooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : sk.internalCooldown;
          state.autoRevive1SpCost = Array.isArray(sk.reviveSpCost) ? sk.reviveSpCost[lv - 1] : (sk.reviveSpCost || 0);
          break;
        }
        case 'onDeathRevive2': {
          state.hasAutoRevive2 = true;
          state.autoRevive2HpPct = Array.isArray(sk.revivePct) ? sk.revivePct[lv - 1] : sk.revivePct;
          state.autoRevive2CooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : sk.internalCooldown;
          break;
        }
        case 'onHitAoeProc': {
          state.hasOnHitAoeProc = true;
          state.onHitAoeProcChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          state.onHitAoeProcMult = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
          state.onHitAoeProcElement = sk.element || 'none';
          state.onHitAoeProcCooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 5);
          break;
        }
        case 'onAttackAoeProc': {
          state.hasOnAttackAoeProc = true;
          state.onAttackAoeProcChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          state.onAttackAoeFlatDmg = Array.isArray(sk.flatDmg) ? sk.flatDmg[lv - 1] : (sk.flatDmg || 0);
          state.onAttackAoeMult = Array.isArray(sk.mult) ? sk.mult[lv - 1] : (sk.mult || 0);
          state.onAttackAoeElement = sk.element || 'none';
          state.onAttackAoeCooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 5);
          break;
        }
        case 'autoShield': {
          state.hasAutoShield = true;
          state.autoShieldCapacity = Array.isArray(sk.shieldCapacityFlat) ? sk.shieldCapacityFlat[lv - 1] : sk.shieldCapacityFlat;
          state.autoShieldCharges = Array.isArray(sk.shieldCharges) ? sk.shieldCharges[lv - 1] : sk.shieldCharges;
          state.autoShieldCooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 20);
          break;
        }
        case 'onHitAoeStunProc': {
          state.hasOnHitAoeStunProc = true;
          state.onHitAoeStunChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          state.onHitAoeStunMult = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
          state.onHitAoeStunElement = sk.element || 'none';
          state.onHitAoeStunStunChance = Array.isArray(sk.stunChance) ? sk.stunChance[lv - 1] : (sk.stunChance || 0);
          state.onHitAoeStunStunSec = Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : (sk.stunSec || 1);
          state.onHitAoeStunCooldownSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 10);
          break;
        }
        case 'onHitStunProc2': {
          state.hasOnHitStunProc2 = true;
          state.onHitStunChance2 = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
          state.onHitStunSec2 = sk.stunSec ? (Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : sk.stunSec) : 0.5;
          state.onHitStunCooldownSec2 = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 10);
          break;
        }
      }
    });
  }

  // 卡片加成 — 固定值（僅影響衍生數值，不修改 base stats 避免累加）
  state.atk += getCardBonus('atk') + equippedStatBonus('atk');
  state.matk += getCardBonus('matk') + equippedStatBonus('matk');
  state.matkMin += getCardBonus('matk') + equippedStatBonus('matk');
  state.matkMax += getCardBonus('matk') + equippedStatBonus('matk');
  state.def += getCardBonus('def');
  state.hit += getCardBonus('hit') + equippedStatBonus('hit');
  state.flee += getCardBonus('flee') + equippedStatBonus('flee');
  state.critRate = Math.min(100, state.critRate + getCardBonus('critRate') + equippedStatBonus('critRate'));
  state.perfectDodge += getCardBonus('perfectDodge') + equippedStatBonus('perfectDodge');
  state.maxHp += getCardBonus('hp') + equippedStatBonus('hp');
  state.maxSp += getCardBonus('sp') + equippedStatBonus('sp');

  // 卡片加成 — 百分比
  const hpPctBonus = getCardBonus('hpPct') / 100;
  if (hpPctBonus > 0) {
    state.maxHp = Math.round(state.maxHp * (1 + hpPctBonus));
  }
  const spPctBonus = getCardBonus('spPct') / 100;
  if (spPctBonus > 0) {
    state.maxSp = Math.round(state.maxSp * (1 + spPctBonus));
  }

  // 卡片加成 — 對特定目標的加傷/減傷（存入 state 供戰鬥使用）
  //   eleDmg_X / raceDmg_X / sizeDmg_X       ：打「屬性X / 種族X / 體型X」的怪時增傷
  //   eleReduce_X / raceDmgReduce_X          ：被「屬性X / 種族X」的怪打時減傷
  state.cardEleDmgBonus = {};
  state.cardRaceDmgBonus = {};
  state.cardSizeDmgBonus = {};
  state.cardEleDmgReduce = {};
  state.cardRaceDmgReduce = {};
  state.cardHpRegenPct = 0;
  state.cardSpRegenPct = 0;
  const CARD_BONUS_MAPS = {
    'eleDmg_': 'cardEleDmgBonus',
    'raceDmg_': 'cardRaceDmgBonus',
    'sizeDmg_': 'cardSizeDmgBonus',
    'eleReduce_': 'cardEleDmgReduce',
    'raceDmgReduce_': 'cardRaceDmgReduce'
  };
  allEquippedCards().forEach(cardId => {
    const card = CARDS[cardId];
    if (!card || !card.bonus) return;
    for (const [k, v] of Object.entries(card.bonus)) {
      if (k === 'hpRegenPct') { state.cardHpRegenPct += v; continue; }
      if (k === 'spRegenPct') { state.cardSpRegenPct += v; continue; }
      // raceDmgReduce_ 必須排在 raceDmg_ 前面比對，否則會被前者的前綴先吃掉
      const prefix = Object.keys(CARD_BONUS_MAPS)
        .sort((a, b) => b.length - a.length)
        .find(p => k.startsWith(p));
      if (!prefix) continue;
      const bucket = state[CARD_BONUS_MAPS[prefix]];
      const key = k.slice(prefix.length);
      bucket[key] = (bucket[key] || 0) + v / 100;
    }
  });

  // HP/SP 夾住動作統一放在這裡執行，此時state.maxHp/maxSp已經是套用完所有被動技能與卡片加成後的最終值
  // 防止HP/SP因過去任何一次NaN污染而永久卡死（NaN < 任何數都是false，一旦中毒就無法自然回滿/回復）
  if (Number.isNaN(state.hp)) state.hp = state.maxHp;
  if (Number.isNaN(state.sp)) state.sp = state.maxSp;
  if (fullHeal) { state.hp = state.maxHp; state.sp = state.maxSp; }
  else { state.hp = Math.min(state.hp, state.maxHp); state.sp = Math.min(state.sp, state.maxSp); }
}

/* ---------------- 戰鬥公式輔助 ----------------
   命中率% = 100 + 攻擊方HIT - 防守方FLEE，夾在 5%~100% 之間（RO 經典公式）
   減傷比例 = DEF/(DEF+60)，讓 DEF 呈現遞減曲線而非直接相減（避免高防怪變成零傷害）
------------------------------------------------- */
function hitChancePct(attackerHit, defenderFlee) {
  return Math.min(100, Math.max(5, 100 + attackerHit - defenderFlee));
}

/* 卡片對「這隻怪」的總增傷倍率：屬性 + 種族 + 體型三種加成相加後一次套用。
   回傳的是倍率（例如 +20% 種族傷害會回傳 1.2），沒有任何加成時回傳 1。 */
function cardTargetDmgMult(monDef) {
  if (!monDef) return 1;
  let bonus = 0;
  const ele = monDef.element || 'none';
  if (state.cardEleDmgBonus && state.cardEleDmgBonus[ele]) bonus += state.cardEleDmgBonus[ele];
  if (monDef.race && state.cardRaceDmgBonus && state.cardRaceDmgBonus[monDef.race]) bonus += state.cardRaceDmgBonus[monDef.race];
  if (monDef.size && state.cardSizeDmgBonus && state.cardSizeDmgBonus[monDef.size]) bonus += state.cardSizeDmgBonus[monDef.size];
  return 1 + bonus;
}
function mitigateDamage(rawDmg, def) {
  const reduction = def / (def + 60);
  return Math.max(1, Math.round(rawDmg * (1 - reduction)));
}
function monsterHitOf(def) { return def.hit || (90 + def.level * 2.5); }
function monsterFleeOf(def) { return def.flee || (80 + def.level * 4); }

/* ---------------- 命中/迴避（依怪物資料 hitReq/fleeReq 換算）----------------
   hitReq：玩家HIT要達到這個值，攻擊這隻怪就是100%命中；比例=玩家HIT/hitReq*100%（不到100%時等比例下降），下限5%
   fleeReq：玩家FLEE要達到這個值，迴避這隻怪的攻擊就是95%（RO迴避上限95%）；比例=玩家FLEE/fleeReq*100%，上限95%、下限5%
   沒有hitReq/fleeReq資料的怪物（尚未套用新資料）退回舊制monDef.hit/monDef.flee當作門檻值，維持相容
------------------------------------------------- */
function hitChancePctVsMonster(playerHit, monDef) {
  const threshold = monDef.hitReq || monsterFleeOf(monDef);
  return Math.min(100, Math.max(5, Math.round(100 * playerHit / threshold)));
}
function dodgeChancePctFromMonster(playerFlee, monDef, hitDebuff) {
  let threshold = monDef.fleeReq || monsterHitOf(monDef);
  if (hitDebuff) threshold = Math.max(1, threshold - hitDebuff);
  return Math.min(95, Math.max(5, Math.round(100 * playerFlee / threshold)));
}

/* ---------------- 中毒（施毒/塗毒共用）----------------
   固定持續3秒、不疊加（同一隻怪再次中毒直接覆蓋刷新）、毒屬性怪物免疫 */
function applyPoisonDot(mon, monDef, rawDmgPerTick) {
  const elemMult = getElementMultiplierVsMonster('poison', monDef);
  if (elemMult === 0) {
    logMsg(`🚫 ${monDef.name} 對毒免疫！`);
    return;
  }
  mon.poisonDotPerTick = Math.round(rawDmgPerTick * elemMult);
  mon.poisonDotEnd = Date.now() + 3000;
}
function tickPoisonDot() {
  if (!state.monsters || state.monsters.length === 0) return;
  const now = Date.now();
  for (let i = state.monsters.length - 1; i >= 0; i--) {
    const mon = state.monsters[i];
    if (!mon.poisonDotEnd) continue;
    if (now >= mon.poisonDotEnd) {
      delete mon.poisonDotEnd;
      delete mon.poisonDotPerTick;
      continue;
    }
    const monDef = MONSTERS[mon.defId];
    const dmg = mitigateDamage(mon.poisonDotPerTick, monDef.def * 0.6);
    mon.hp -= dmg;
    logMsg(`☠️ 中毒對 ${monDef.name} 造成 ${dmg} 點傷害！`);
    if (mon.hp <= 0) killMonster(monDef, mon);
  }
}

/* ---------------- 暈眩 ----------------
   additive=true 時會疊加時長（滑動/睡魔/定位陷阱共用），否則直接覆蓋（衝鋒箭） */
function applyStun(mon, sec, additive) {
  const now = Date.now();
  if (additive) {
    mon.stunnedUntil = Math.max(now, mon.stunnedUntil || 0) + sec * 1000;
  } else {
    mon.stunnedUntil = now + sec * 1000;
  }
}

// 冰凍術/石化術：被反制暈眩的目標，之後只要受到我方魔法傷害就會提前甦醒
function wakeIfFrozen(mon) {
  if (mon && mon.frozenByProc) {
    mon.stunnedUntil = Date.now();
    mon.frozenByProc = false;
  }
}

/* ---------------- 獵人陷阱：被動觸發（攻擊時機率/固定觸發，各自獨立冷卻）---------------- */
const TRAP_SKILL_IDS = ['trap', 'skidtrap', 'flasher', 'sleeptrap', 'freezingtrap', 'blastmine', 'claymoretrap', 'magnumbreak_h'];
function tryTrapProcs(target, monDef) {
  if (!state.learnedSkills) return;
  if (!state.trapReadyAt) state.trapReadyAt = {};
  TRAP_SKILL_IDS.forEach(skillId => {
    const lv = state.learnedSkills[skillId];
    if (!lv) return;
    const readyAt = state.trapReadyAt[skillId] || 0;
    if (Date.now() < readyAt) return;

    const sk = findSkillById(skillId);
    let proc = false;
    if (sk.procChance == null) {
      proc = true; // 定時爆炸陷阱：無機率判定，冷卻好就必定觸發
    } else {
      const baseChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
      const chance = Math.min(100, baseChance + (state.trapChanceBonusPct || 0));
      proc = Math.random() * 100 < chance;
    }
    if (!proc) return;

    const cdSec = Math.max(1, (sk.internalCooldown || 10) - (state.trapCdReductionSec || 0));
    state.trapReadyAt[skillId] = Date.now() + cdSec * 1000;

    if (sk.trapEffect === 'stun') {
      applyStun(target, sk.stunSec || 1, true);
      logMsg(`💥 「${sk.name}」觸發！${monDef.name} 暈眩了！`);
    } else if (sk.trapEffect === 'hitDebuff') {
      const hitDebuff = Array.isArray(sk.hitDebuff) ? sk.hitDebuff[lv - 1] : sk.hitDebuff;
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      target.debuffHit = hitDebuff;
      target.debuffHitEnd = Date.now() + dur * 1000;
      logMsg(`💥 「${sk.name}」觸發！${monDef.name} 的命中下降了！`);
    } else if (sk.trapEffect === 'damage') {
      const mult = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
      const elemMult = getElementMultiplierVsMonster(sk.element || 'none', monDef);
      const dmg = mitigateDamage(state.atk * mult * elemMult, monDef.def);
      target.hp -= dmg;
      logMsg(`💥 「${sk.name}」觸發！對 ${monDef.name} 造成 ${dmg} 點傷害！`);
      if (target.hp <= 0) killMonster(monDef, target);
    } else if (sk.trapEffect === 'damageAoe') {
      const mult = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
      logMsg(`💥 「${sk.name}」觸發！範圍爆炸！`);
      for (let i = state.monsters.length - 1; i >= 0; i--) {
        const mon = state.monsters[i];
        const mDef = MONSTERS[mon.defId];
        const elemMult = getElementMultiplierVsMonster(sk.element || 'none', mDef);
        const dmg = mitigateDamage(state.atk * mult * elemMult, mDef.def);
        mon.hp -= dmg;
        logMsg(`  → 對 ${mDef.name} 造成 ${dmg} 點傷害！`);
        if (mon.hp <= 0) killMonster(mDef, mon);
      }
    }
  });
}

/* ---------------- 冰凍術/石化術：被攻擊時機率反制暈眩並造成魔法傷害（各自獨立冷卻）---------------- */
const MAGIC_STUN_SKILL_IDS = ['frostdiver', 'stonecurse'];
function tryMagicStunProcs(mon, monDef) {
  if (!state.learnedSkills) return;
  if (!state.magicStunReadyAt) state.magicStunReadyAt = {};
  MAGIC_STUN_SKILL_IDS.forEach(skillId => {
    const lv = state.learnedSkills[skillId];
    if (!lv) return;
    const readyAt = state.magicStunReadyAt[skillId] || 0;
    if (Date.now() < readyAt) return;

    const sk = findSkillById(skillId);
    const chance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
    if (Math.random() * 100 >= chance) return;

    const cdSec = Array.isArray(sk.internalCooldown) ? sk.internalCooldown[lv - 1] : (sk.internalCooldown || 10);
    state.magicStunReadyAt[skillId] = Date.now() + cdSec * 1000;

    const stunSec = Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : (sk.stunSec || 10);
    applyStun(mon, stunSec, true);
    mon.frozenByProc = true;
    const dmgMult = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
    const elemMult = getElementMultiplierVsMonster(sk.element || 'none', monDef);
    const dmg = mitigateDamage(state.matk * dmgMult * elemMult, monDef.def);
    mon.hp -= dmg;
    logMsg(`❄️ 「${sk.name}」觸發！${monDef.name} 暈眩了，並受到 ${dmg} 點魔法傷害！`);
    if (mon.hp <= 0) killMonster(monDef, mon);
  });
}

// 長矛刺擊：被攻擊時機率反制，對攻擊者造成傷害並使其暈眩（需裝備矛類武器，不影響原本受到的傷害）
function trySpearCounterProc(mon, monDef) {
  if (!state.hasSpearCounterProc || !hasSpearEquipped()) return;
  if (Date.now() < (state.spearCounterReadyAt || 0)) return;
  if (Math.random() * 100 >= state.spearCounterChance) return;
  state.spearCounterReadyAt = Date.now() + (state.spearCounterCooldownSec || 10) * 1000;
  const dmg = mitigateDamage(state.atk * state.spearCounterMult, monDef.def);
  mon.hp -= dmg;
  applyStun(mon, state.spearCounterStunSec || 2, true);
  logMsg(`🔱 長矛刺擊發動！對 ${monDef.name} 造成 ${dmg} 點反擊傷害，並使其暈眩了！`);
  if (mon.hp <= 0) killMonster(monDef, mon);
}

// 投擲長矛：敵人數≥2時，定時隨機對一隻造成傷害（需裝備矛類武器）
function trySpearBoomerangProc() {
  if (!state.hasSpearBoomerangProc || !hasSpearEquipped()) return;
  if (!state.monsters || state.monsters.length < 2) return;
  if (Date.now() < (state.spearBoomerangReadyAt || 0)) return;
  state.spearBoomerangReadyAt = Date.now() + (state.spearBoomerangCooldownSec || 5) * 1000;
  const mon = state.monsters[Math.floor(Math.random() * state.monsters.length)];
  const monDef = MONSTERS[mon.defId];
  const dmg = mitigateDamage(state.atk * state.spearBoomerangMult, monDef.def);
  mon.hp -= dmg;
  logMsg(`🔱 投擲長矛發動！對 ${monDef.name} 造成 ${dmg} 點傷害！`);
  if (mon.hp <= 0) killMonster(monDef, mon);
}

// 衝鋒攻擊：敵人數≥2時，定時隨機對一隻造成傷害（不限武器）
function tryChargeRandomProc() {
  if (!state.hasChargeRandomProc) return;
  if (!state.monsters || state.monsters.length < 2) return;
  if (Date.now() < (state.chargeRandomReadyAt || 0)) return;
  state.chargeRandomReadyAt = Date.now() + (state.chargeRandomCooldownSec || 5) * 1000;
  const mon = state.monsters[Math.floor(Math.random() * state.monsters.length)];
  const monDef = MONSTERS[mon.defId];
  const dmg = mitigateDamage(state.atk * state.chargeRandomMult, monDef.def);
  mon.hp -= dmg;
  logMsg(`🐎 衝鋒攻擊發動！對 ${monDef.name} 造成 ${dmg} 點傷害！`);
  if (mon.hp <= 0) killMonster(monDef, mon);
}

// 火之獵殺：被攻擊時觸發，對全體造成範圍魔法傷害
function tryOnHitAoeProc() {
  if (!state.hasOnHitAoeProc || !state.monsters || state.monsters.length === 0) return;
  if (Date.now() < (state.onHitAoeProcReadyAt || 0)) return;
  if (Math.random() * 100 >= state.onHitAoeProcChance) return;
  state.onHitAoeProcReadyAt = Date.now() + state.onHitAoeProcCooldownSec * 1000;
  logMsg('🔥 火之獵殺發動！');
  for (let i = state.monsters.length - 1; i >= 0; i--) {
    const mon = state.monsters[i];
    const monDef = MONSTERS[mon.defId];
    const elemMult = getElementMultiplierVsMonster(state.onHitAoeProcElement, monDef);
    const dmg = mitigateDamage(state.matk * state.onHitAoeProcMult * elemMult, monDef.def);
    mon.hp -= dmg;
    wakeIfFrozen(mon);
    combatLogBuf.push(`  → 對 ${monDef.name} 造成 ${dmg} 點傷害！`);
    if (mon.hp <= 0) killMonster(monDef, mon);
  }
  if (typeof renderLog === 'function') renderLog();
}

// 火柱攻擊：普攻時機率觸發，對全體造成固定值+百分比範圍魔法傷害
function tryOnAttackAoeProc() {
  if (!state.hasOnAttackAoeProc || !state.monsters || state.monsters.length === 0) return;
  if (Date.now() < (state.onAttackAoeProcReadyAt || 0)) return;
  if (Math.random() * 100 >= state.onAttackAoeProcChance) return;
  state.onAttackAoeProcReadyAt = Date.now() + state.onAttackAoeCooldownSec * 1000;
  logMsg('🔥 火柱攻擊發動！');
  for (let i = state.monsters.length - 1; i >= 0; i--) {
    const mon = state.monsters[i];
    const monDef = MONSTERS[mon.defId];
    const elemMult = getElementMultiplierVsMonster(state.onAttackAoeElement, monDef);
    const dmg = mitigateDamage((state.onAttackAoeFlatDmg + state.matk * state.onAttackAoeMult) * elemMult, monDef.def);
    mon.hp -= dmg;
    wakeIfFrozen(mon);
    combatLogBuf.push(`  → 對 ${monDef.name} 造成 ${dmg} 點傷害！`);
    if (mon.hp <= 0) killMonster(monDef, mon);
  }
  if (typeof renderLog === 'function') renderLog();
}

// 冰刃之牆：沒有護盾在身且冷卻完畢時，自動補上一層護盾
function tryAutoShield() {
  if (!state.hasAutoShield) return;
  if (state.shields && state.shields.some(sh => sh.id === 'icewall')) return;
  if (Date.now() < (state.autoShieldReadyAt || 0)) return;
  state.autoShieldReadyAt = Date.now() + state.autoShieldCooldownSec * 1000;
  if (!state.shields) state.shields = [];
  state.shields.push({ id: 'icewall', remainingHp: state.autoShieldCapacity, remainingCharges: state.autoShieldCharges, expiresAt: Date.now() + 999999 * 1000 });
  logMsg('🧊 冰刃之牆自動展開！');
}

// 霜凍之術：被攻擊時觸發，對全體造成範圍魔法傷害並各自有機率暈眩
function tryOnHitAoeStunProc() {
  if (!state.hasOnHitAoeStunProc || !state.monsters || state.monsters.length === 0) return;
  if (Date.now() < (state.onHitAoeStunReadyAt || 0)) return;
  if (Math.random() * 100 >= state.onHitAoeStunChance) return;
  state.onHitAoeStunReadyAt = Date.now() + state.onHitAoeStunCooldownSec * 1000;
  logMsg('❄️ 霜凍之術發動！');
  for (let i = state.monsters.length - 1; i >= 0; i--) {
    const mon = state.monsters[i];
    const monDef = MONSTERS[mon.defId];
    const elemMult = getElementMultiplierVsMonster(state.onHitAoeStunElement, monDef);
    const dmg = mitigateDamage(state.matk * state.onHitAoeStunMult * elemMult, monDef.def);
    mon.hp -= dmg;
    wakeIfFrozen(mon);
    if (Math.random() * 100 < state.onHitAoeStunStunChance) applyStun(mon, state.onHitAoeStunStunSec, true);
    combatLogBuf.push(`  → 對 ${monDef.name} 造成 ${dmg} 點傷害！`);
    if (mon.hp <= 0) killMonster(monDef, mon);
  }
  if (typeof renderLog === 'function') renderLog();
}

// 泥沼地：被攻擊時觸發反制暈眩攻擊者（獨立於緩速術的狀態，避免同時學習時互相覆蓋）
function tryOnHitStunProc2(mon, monDef) {
  if (!state.hasOnHitStunProc2) return;
  if (Date.now() < (state.onHitStunReadyAt2 || 0)) return;
  if (Math.random() * 100 >= state.onHitStunChance2) return;
  state.onHitStunReadyAt2 = Date.now() + state.onHitStunCooldownSec2 * 1000;
  applyStun(mon, state.onHitStunSec2, true);
  logMsg(`💫 泥沼地發動！${monDef.name} 暈眩了！`);
}

/* ---------------- 戰鬥主迴圈 ---------------- */
function startLoop() {
  if (tickTimer) clearInterval(tickTimer);
  tickTimer = setInterval(gameTick, TICK_MS);
}

function gameTick() {
  if (!state) return;
  tickCooldowns();
  tickBuffs();

  if (state.hp <= 0) return; // 等待復活流程

  // 每秒執行一次的系統（回復、自動喝藥、自動技能）
  if (!state._lastSlowTick) state._lastSlowTick = Date.now();
  if (Date.now() - state._lastSlowTick >= 1000) {
    state._lastSlowTick = Date.now();
    passiveRegen();
    townRestore();
    autoUsePotion();
    autoUseSpPotion();
    autoUseAspdPotion();
    // 成就一律在這裡集中判定，不在戰鬥流程裡埋觸發點（詳見 achievements.js 開頭說明）
    checkAchievements();
    if (state.autoSkill) {
      tryAutoCastSkill();
    }
    // 輔助技能獨立控制，不受自動施放技能開關影響
    tryAutoCastSupportSkills();
    // 中毒持續傷害：每秒跳一次
    tickPoisonDot();
    // 解毒被動：玩家中毒時自動解除（目前遊戲尚無玩家中毒機制，此為預留掛鉤）
    if (state.hasAutoDetox && state.playerPoisoned) {
      const readyAt = state.autoDetoxReadyAt || 0;
      if (Date.now() >= readyAt) {
        state.playerPoisoned = false;
        state.autoDetoxReadyAt = Date.now() + (state.autoDetoxCooldownSec || 30) * 1000;
        logMsg('💊 解毒發動！自動解除了中毒狀態。');
      }
    }
    // 手推車使用被動：定時從等級解鎖的道具池隨機獲得1個
    if (state.hasAutoCartItem) {
      const readyAt = state.cartItemReadyAt || 0;
      if (Date.now() >= readyAt) {
        state.cartItemReadyAt = Date.now() + (state.cartItemIntervalSec || 15) * 1000;
        const pool = (state.cartItemPool && state.cartItemPool.length) ? state.cartItemPool : ['carrot'];
        const itemId = pool[Math.floor(Math.random() * pool.length)];
        addItem(itemId, 1);
        logMsg(`🛒 手推車翻出了一個 ${ITEMS[itemId].name}！`);
      }
    }
    // 露天商店被動：定時自動以10倍價格販售已選擇的道具
    tryAutoVending();
    // 自動販賣：玩家勾選的道具，每30秒自動以原價賣出全部
    tryAutoSell();
    // 自動補箭：弓箭手掛機時箭快見底就自動補貨
    tryAutoBuyArrow();
    // 冰刃之牆被動：自動補上護盾
    tryAutoShield();
    // 投擲長矛：敵人數≥2時定時隨機攻擊
    trySpearBoomerangProc();
    // 衝鋒攻擊：敵人數≥2時定時隨機攻擊
    tryChargeRandomProc();
    // 屬性石製造被動：定時機率隨機獲得一顆屬性石
    if (state.hasElementalStoneProc) {
      const readyAt = state.elementalStoneReadyAt || 0;
      if (Date.now() >= readyAt) {
        state.elementalStoneReadyAt = Date.now() + (state.elementalStoneCooldownSec || 60) * 1000;
        if (Math.random() * 100 < state.elementalStoneChance) {
          const stones = ['gemstone_wind', 'gemstone_water', 'gemstone_fire', 'gemstone_earth'];
          const stoneId = stones[Math.floor(Math.random() * stones.length)];
          addItem(stoneId, 1);
          logMsg(`💎 屬性石製造發動！獲得了 ${ITEMS[stoneId].name}！`);
        }
      }
    }
    // 場域持續效果：光耀之堂(自身補血)、十字驅魔攻擊(範圍聖屬性傷害)等每隔一段時間觸發一次
    if (state.activeFieldEffects && state.activeFieldEffects.length > 0) {
      const now = Date.now();
      state.activeFieldEffects = state.activeFieldEffects.filter(f => now < f.endsAt);
      state.activeFieldEffects.forEach(f => {
        if (now < f.nextTickAt) return;
        f.nextTickAt = now + f.tickIntervalSec * 1000;
        if (f.kind === 'selfheal') {
          const before = state.hp;
          state.hp = Math.min(state.maxHp, state.hp + f.amount);
          if (state.hp > before) logMsg(`💚 「${f.name}」持續恢復了 ${state.hp - before} 點HP。`);
        } else if (f.kind === 'aoe_holydmg') {
          if (state.monsters && state.monsters.length > 0) {
            state.monsters.forEach(mon => {
              const monDef = MONSTERS[mon.defId];
              const elemMult = getElementMultiplierVsMonster(f.element || 'holy', monDef);
              const dmg = mitigateDamage(state.matk * f.mult * elemMult, monDef.def);
              mon.hp -= dmg;
              wakeIfFrozen(mon);
              if (f.stunChance && Math.random() * 100 < f.stunChance) applyStun(mon, f.stunSec || 1, true);
              combatLogBuf.push(`  → 「${f.name}」對 ${monDef.name} 造成 ${dmg} 點傷害！`);
            });
            for (let i = state.monsters.length - 1; i >= 0; i--) {
              const mon = state.monsters[i];
              if (mon.hp <= 0) killMonster(MONSTERS[mon.defId], mon);
            }
            if (typeof renderLog === 'function') renderLog();
          }
        } else if (f.kind === 'multi_dot') {
          if (state.monsters && state.monsters.length > 0 && f.targetIds && f.targetIds.length > 0) {
            const targets = state.monsters.filter(m => f.targetIds.includes(m.id));
            targets.forEach(mon => {
              const monDef = MONSTERS[mon.defId];
              const elemMult = getElementMultiplierVsMonster(f.element || 'none', monDef);
              const dmg = mitigateDamage(state.matk * f.mult * elemMult, monDef.def);
              mon.hp -= dmg;
              wakeIfFrozen(mon);
              combatLogBuf.push(`  → 「${f.name}」對 ${monDef.name} 造成 ${dmg} 點持續傷害！`);
            });
            for (let i = state.monsters.length - 1; i >= 0; i--) {
              const mon = state.monsters[i];
              if (f.targetIds.includes(mon.id) && mon.hp <= 0) killMonster(MONSTERS[mon.defId], mon);
            }
            if (typeof renderLog === 'function') renderLog();
          }
        }
      });
    }
  }

  // 每10秒：移動時恢復HP（戰鬥中也有效）
  if (state.hpMoveRegen) {
    if (!state._lastHpMoveTick) state._lastHpMoveTick = Date.now();
    if (Date.now() - state._lastHpMoveTick >= 10000) {
      state._lastHpMoveTick = Date.now();
      const healAmt = Math.max(1, Math.ceil(state.maxHp * 0.05));
      if (state.hp < state.maxHp) {
        state.hp = Math.min(state.maxHp, state.hp + healAmt);
        logMsg(`💚 移動恢復：回復 ${healAmt} HP。`);
      }
    }
  }

  if (!state.monsters) state.monsters = [];
  // 近戰模式持續生怪，遠攻模式等怪物死後再生
  spawnMonster();
  if (state.monsters.length > 0) {
    // 使用攻擊間隔控制攻擊頻率（累積時間差模式）
    const now = Date.now();
    // 從無怪→有怪時重設，避免安全區累積爆發
    if (!state._prevHadMonsters) {
      state.attackAccumulator = 0;
      state.lastAttackTime = now;
    }
    state._prevHadMonsters = true;
    state.attackAccumulator += now - state.lastAttackTime;
    state.lastAttackTime = now;
    while (state.attackAccumulator >= state.attackInterval) {
      state.attackAccumulator -= state.attackInterval;
      playerAttack();
      if (state.monsters.length === 0) break;
    }

    // 怪物攻擊（每隻怪物獨立攻擊間隔）
    if (state.monsters.length > 0) {
      state.monsters.forEach(mon => {
        if (!mon.lastAttackTime) mon.lastAttackTime = now;
        const monDef = MONSTERS[mon.defId];
        const interval = (monDef && monDef.atkInterval) ? monDef.atkInterval * 1000 : 1000;
        if (now - mon.lastAttackTime >= interval) {
          mon.lastAttackTime = now;
          monsterAttackSingle(mon);
        }
      });
    }
  } else {
    state._prevHadMonsters = false;
  }
  saveGameThrottled();
  onTickUI();
}

function passiveRegen() {
  // 卡片的「HP/SP恢復力+N%」加成
  const regenMult = (state.hpRegenMult || 1) * (1 + (state.cardHpRegenPct || 0) / 100);
  const hpRegen = Math.max(1, Math.ceil((state.maxHp * 0.015 + state.stats.vit * 0.15) * regenMult));
  // 禪心：SP恢復量固定+3~30，並額外+0.2%~2%（以最大SP計）
  const zenFlat = state.zenSpFlatBonus || 0;
  const zenPct = state.maxSp * ((state.zenSpPctBonus || 0) / 100);
  // 聖母之頌歌buff：SP恢復速度倍率
  const sprateMult = buffMult('sprate').mult;
  const spRegen = Math.max(1, Math.ceil((state.maxSp * 0.02 + state.stats.int * 0.15 + zenFlat + zenPct) * (state.spRegenMult || 1) * sprateMult * (1 + (state.cardSpRegenPct || 0) / 100)));
  if (state.hp < state.maxHp) state.hp = Math.min(state.maxHp, state.hp + hpRegen);
  if (state.sp < state.maxSp) state.sp = Math.min(state.maxSp, state.sp + spRegen);
}

function getItemQty(itemId) {
  const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
  return row ? row.qty : 0;
}

/* ---------------- 藥水：自動使用 / 自動購買 ---------------- */
function autoUsePotion() {
  if (!state.autoPotion || !state.autoPotion.enabled) return;
  const threshold = (state.autoPotion.hpThreshold || 50) / 100;
  if (state.hp >= state.maxHp * threshold) return;

  const primary = state.autoPotion.primary;
  const fallback = state.autoPotion.fallback;

  // 優先使用第一選擇（背包道具）
  if (primary && getItemQty(primary) > 0) {
    useItem(primary);
    return;
  }
  // 第一選擇用完，使用第二選擇（固定藥水）
  if (fallback) {
    if (getItemQty(fallback) <= 0 && state.autoBuyPotion) {
      buyItem(fallback, AUTO_BUY_QTY);
    }
    if (getItemQty(fallback) > 0) {
      useItem(fallback);
    }
  }
}

/* SP 藥水自動使用：結構與 HP 那組一模一樣（第一格背包任選、第二格藍水可自動買）。
   商店只賣藍水，其他回SP道具（藍色藥草／葡萄／草莓／蜂蜜／蜂膠／天地樹）都要打怪拿。 */
const AUTO_BUY_SP_QTY = 50;
function autoUseSpPotion() {
  if (!state.autoSpPotion || !state.autoSpPotion.enabled) return;
  const threshold = (state.autoSpPotion.spThreshold || 30) / 100;
  if (state.sp >= state.maxSp * threshold) return;

  const primary = state.autoSpPotion.primary;
  const fallback = state.autoSpPotion.fallback;

  // 優先使用第一選擇（背包裡任何回SP道具）
  if (primary && getItemQty(primary) > 0) {
    useItem(primary);
    return;
  }
  // 第二選擇：藍水（唯一買得到的）
  if (fallback) {
    if (getItemQty(fallback) <= 0 && state.autoBuySpPotion) {
      buyItem(fallback, AUTO_BUY_SP_QTY);
    }
    if (getItemQty(fallback) > 0) useItem(fallback);
  }
}
/* 攻速藥水自動使用：勾選哪幾種就在 buff 消失後自動補上（由高到低挑職業能用的）。
   開了自動購買的話，勾選的那種喝完會自動補貨（買不起就換下一種）。 */
const AUTO_BUY_ASPD_QTY = 10;
function autoUseAspdPotion() {
  if (!state.autoAspdPotion || !state.autoAspdPotion.enabled) return;
  // 已經有攻速 buff 就不重複喝
  if (state.buffs.some(b => b.type === 'aspd' && b.fromPotion)) return;
  const picks = state.autoAspdPotion.items || [];
  // 效果高的優先
  const order = ['berserk_potion', 'awakening_potion', 'center_potion'];
  for (const id of order) {
    if (!picks.includes(id)) continue;
    if (aspdPotionBlockReason(id)) continue;
    if (getItemQty(id) <= 0 && state.autoBuyAspdPotion) {
      const def = ITEMS[id];
      const unit = def && def.buyPrice ? Math.max(1, Math.round(def.buyPrice * (state.shopDiscountMult || 1))) : 0;
      // 買得起整批才買，免得把錢掏空只買到一兩瓶
      if (unit && state.gold >= unit * AUTO_BUY_ASPD_QTY) buyItem(id, AUTO_BUY_ASPD_QTY);
    }
    if (getItemQty(id) <= 0) continue;
    useItem(id);
    return;
  }
}
function setAutoBuyAspdPotion(v) { state.autoBuyAspdPotion = !!v; saveGame(); }
function toggleAutoAspdPotion(itemId, on) {
  if (!state.autoAspdPotion) state.autoAspdPotion = { enabled: true, items: [] };
  const arr = state.autoAspdPotion.items;
  const i = arr.indexOf(itemId);
  if (on && i < 0) arr.push(itemId);
  if (!on && i >= 0) arr.splice(i, 1);
  saveGame();
}
function setAutoAspdPotionEnabled(v) {
  if (!state.autoAspdPotion) state.autoAspdPotion = { enabled: true, items: [] };
  state.autoAspdPotion.enabled = !!v; saveGame();
}

function setAutoSpPotionEnabled(v) { state.autoSpPotion.enabled = !!v; saveGame(); }
function setAutoSpPotionPrimary(v) { state.autoSpPotion.primary = v; saveGame(); }
function setAutoSpPotionFallback(v) { state.autoSpPotion.fallback = v; saveGame(); }
function setAutoSpPotionThreshold(v) { state.autoSpPotion.spThreshold = Math.max(10, Math.min(90, parseInt(v) || 30)); saveGame(); }
function setAutoBuySpPotion(v) { state.autoBuySpPotion = !!v; saveGame(); }

/* 自動補箭：掛機時箭快用完就自動買同一種（只在城鎮外也能買，比照自動買藥水的做法）。
   買不起或那種箭商店沒賣就安靜跳過，playerAttack() 那邊會提示沒箭。 */
const AUTO_BUY_ARROW_QTY = 500;
const AUTO_BUY_ARROW_THRESHOLD = 50;
function tryAutoBuyArrow() {
  if (!state.autoBuyArrow) return;
  if (!needsAmmo()) return;
  const id = getEquippedAmmoId();
  if (!id) return;
  if (getItemQty(id) > AUTO_BUY_ARROW_THRESHOLD) return;
  const def = ITEMS[id];
  if (!def || !def.buyPrice) return;
  const unit = Math.max(1, Math.round(def.buyPrice * (state.shopDiscountMult || 1)));
  if (state.gold < unit * AUTO_BUY_ARROW_QTY) return;
  buyItem(id, AUTO_BUY_ARROW_QTY);
}
function setAutoBuyArrow(v) { state.autoBuyArrow = !!v; saveGame(); }

function buyItem(itemId, qty) {
  const def = ITEMS[itemId];
  if (!def || !def.buyPrice) return false;
  const unitPrice = Math.max(1, Math.round(def.buyPrice * (state.shopDiscountMult || 1)));
  let actualQty = qty;
  if (state.gold < unitPrice * actualQty) {
    actualQty = Math.floor(state.gold / unitPrice);
  }
  if (actualQty <= 0) {
    logMsg(`⚠️ 鋅幣不足，無法購買 ${def.name}。`);
    return false;
  }
  const cost = unitPrice * actualQty;
  state.gold -= cost;
  addItem(itemId, actualQty);
  logMsg(`🛒 購買了 ${def.name} x${actualQty}，花費 ${cost} 鋅幣。`);
  saveGame();
  return true;
}

function setAutoPotionTier(tier) { state.autoPotion.primary = tier; saveGame(); }
function setAutoPotionFallback(tier) { state.autoPotion.fallback = tier; saveGame(); }
function setAutoPotionEnabled(v) { state.autoPotion.enabled = !!v; saveGame(); }
function setAutoPotionThreshold(v) { state.autoPotion.hpThreshold = Math.max(10, Math.min(90, parseInt(v) || 50)); saveGame(); }

// 技能補血：HP%觸發門檻 / SP%下限保護（依技能各自設定）
function setAutoHealHpThreshold(skillId, v) {
  if (!state.autoHealConfig) state.autoHealConfig = {};
  if (!state.autoHealConfig[skillId]) state.autoHealConfig[skillId] = { hpThreshold: 70, spThreshold: 0 };
  state.autoHealConfig[skillId].hpThreshold = Math.max(1, Math.min(99, parseInt(v) || 70));
  saveGame();
}
function setAutoHealSpThreshold(skillId, v) {
  if (!state.autoHealConfig) state.autoHealConfig = {};
  if (!state.autoHealConfig[skillId]) state.autoHealConfig[skillId] = { hpThreshold: 70, spThreshold: 0 };
  state.autoHealConfig[skillId].spThreshold = Math.max(0, Math.min(100, parseInt(v) || 0));
  saveGame();
}
function setAutoBuyPotion(v) { state.autoBuyPotion = !!v; saveGame(); }

// 能量外套：勾選開關與SP%下限
function setEnergyCoatEnabled(v) { state.energyCoatEnabled = !!v; saveGame(); }
function setEnergyCoatSpFloor(v) { state.energyCoatSpFloorPct = Math.max(0, Math.min(100, parseInt(v) || 0)); saveGame(); }

function tickCooldowns() {
  Object.keys(state.cooldowns).forEach(k => {
    state.cooldowns[k] -= TICK_MS;
    if (state.cooldowns[k] <= 0) delete state.cooldowns[k];
  });
}
function tickBuffs() {
  state.buffs = state.buffs.filter(b => {
    b.msRemaining -= TICK_MS;
    return b.msRemaining > 0;
  });
  // buff 變動後重新計算所有衍生數值（心神凝聚等 DEX/AGI% buff 會影響 ATK/MATK/命中/迴避/攻速，
  // 光重算 ASPD 不夠，需要整個 recomputeDerived）
  recomputeDerived(false);
}

// ASPD 計算（每次 tick 重新計算，反映即時 buff）
// 使用武器 ASPD 查表（ro_aspd_data/aspd_weapon_base.json）
/* 弓系：官方對這幾類武器改用另一條素質公式（AGI 權重略低） */
const ASPD_BOW_LIKE = ['bow', 'instrument', 'whip', 'pistol', 'rifle', 'shotgun', 'gatling', 'grenade'];
// 雙持時左手武器對應的表格欄位
const ASPD_DUAL_KEY = { dagger: 'dual_dagger', sword1: 'dual_sword1', axe1: 'dual_axe1' };

function computeAspd() {
  const tbl = ASPD_WEAPON_BASE[state.jobId];
  const weapons = tbl ? tbl.weapons : null;
  const shieldTbl = tbl ? tbl.shield : null;

  // Step 1: 右手武器基礎值。查不到（職業不能拿這種武器、或沒資料）一律退回空手值
  const weaponId = getEquipBaseItemId('weapon');
  const rightCat = aspdCategoryOf(weaponId);
  const bare = (weapons && weapons.bare !== undefined) ? weapons.bare : 154;
  let rightValue = (weapons && weapons[rightCat] !== undefined) ? weapons[rightCat] : bare;

  // Step 2: 左手 —— 盾牌是負修正，副手武器則走雙持公式
  const offId = getEquipBaseItemId('shield');
  const offItem = offId ? ITEMS[offId] : null;
  const dualWield = !!(offItem && offItem.type === 'weapon' && canDualWield(state.jobId));
  let leftValue = 0;
  if (dualWield) {
    const dk = ASPD_DUAL_KEY[aspdCategoryOf(offId)];
    // 左手值查不到就用該武器的單手值，再不行就用右手值（官方雙持限單手武器）
    leftValue = (shieldTbl && dk && shieldTbl[dk] !== undefined) ? shieldTbl[dk]
              : ((weapons && weapons[aspdCategoryOf(offId)] !== undefined) ? weapons[aspdCategoryOf(offId)] : rightValue);
  } else if (offItem) {
    leftValue = (shieldTbl && shieldTbl.shield !== undefined) ? shieldTbl.shield : -5;
  }

  // Step 3: 素質加成。官方用「總 AGI/DEX」，recomputeDerived() 已把職業/裝備/卡片/被動/buff 都算進去
  const agi = (state._totalAgi != null ? state._totalAgi : state.stats.agi);
  const dex = (state._totalDex != null ? state._totalDex : state.stats.dex);
  const statBonus = ASPD_BOW_LIKE.includes(rightCat)
    ? Math.sqrt(Math.abs(agi * (10 - 1 / 400) + dex * 11 / 60))
    : Math.sqrt(Math.abs(agi * 1120 / 111 + dex * 11 / 60));

  // Step 4: BaseTemp
  let core;
  if (dualWield) {
    // 雙持不套盾牌值，左手武器用另一條公式折算
    core = rightValue + (leftValue - 194) / 4 + statBonus * 1.04518;
  } else if (rightValue >= 145) {
    // 高速武器：素質加成有邊際效應
    core = rightValue + statBonus * (1 - (rightValue - 144) / 50) + leftValue;
  } else {
    core = rightValue + statBonus + leftValue;
  }

  // Step 5: 技能/藥水攻速百分比
  let skillAspdPct = 0;
  state.buffs.forEach(b => {
    if (b.type === 'aspd' && b.mult) skillAspdPct += (b.mult - 1);
  });
  const afterSkill = 200 - (200 - core) * (1 - skillAspdPct);

  // Step 6: 裝備攻速百分比 + 固定值（含蒼鷹之眼等被動固定ASPD加成）
  let equipAspdPct = 0;
  let aspdFlatBonus = state.passiveAspdFlat || 0;
  EQUIP_SLOTS_ALL.forEach(slot => {
    const aspdItemId = getEquipBaseItemId(slot);
    const item = aspdItemId ? ITEMS[aspdItemId] : null;
    if (item) {
      if (item.aspdBonus) equipAspdPct += (item.aspdBonus - 1);
      if (item.aspdFlat) aspdFlatBonus += item.aspdFlat;
    }
  });
  const finalAspd = Math.floor(195 - (195 - afterSkill) * (1 - equipAspdPct) + aspdFlatBonus);

  // 官方上限：未滿100等 190，100等以上 193
  const cap = state.baseLevel >= 100 ? 193 : 190;
  state.aspd = Math.min(cap, Math.max(100, finalAspd));
  state.attackInterval = getAttackInterval(state.aspd);
}
function buffMult(type) {
  let mult = 1;
  let flatBonus = 0;
  state.buffs.forEach(b => {
    if (b.type === type) {
      if (typeof b.mult === 'number' && !Number.isNaN(b.mult)) mult *= b.mult;
      if (b.flatBonus) flatBonus += b.flatBonus;
    }
  });
  return { mult, flatBonus };
}

// HIT類buff（例如速度激發、光獵）先前只推進state.buffs卻沒有任何地方讀取，此處統一補上消耗端
function effectiveHitWithBuff() {
  return state.hit + buffMult('hit').flatBonus;
}

/* ---------------- 怪物 ---------------- */
function currentMap() { return MAPS.find(m => m.id === state.mapId); }

function spawnMonster() {
  const map = currentMap();
  if (!map.monsters.length && !(state.mvpMode && MVP_MAP_DATA[map.id])) {
    state.monsters = [];
    return;
  }
  if (!state.monsters) state.monsters = [];
  if (!state.encounterMode) state.encounterMode = 'melee';
  if (!state.lastSpawnTime) state.lastSpawnTime = Date.now();

  const maxMonsters = state.maxMonsters || 5;
  const ridePassive = state.learnedSkills && state.learnedSkills['riding'];

  // 近戰模式：最多5隻，0隻時0.5秒一隻，1隻以上時3秒一隻
  if (state.encounterMode === 'melee') {
    if (state.monsters.length >= maxMonsters) return;
    const now = Date.now();
    const delay = state.monsters.length === 0 ? (ridePassive ? 375 : 500) : (ridePassive ? 2250 : 3000);
    if (now - state.lastSpawnTime < delay) return;
    state.lastSpawnTime = now;
  }
  // 遠攻模式：維持原本邏輯（1隻怪，死後才生下一隻）
  else {
    if (state.monsters.length > 0) return;
  }

  // MVP 模式：20% 機率出 MVP Boss（需該地圖有 MVP 數據，且當前無 MVP 存活）
  let defId;
  const mvpList = MVP_MAP_DATA[map.id];
  const hasMvpAlive = mvpList && state.monsters.some(m => mvpList.includes(m.defId));
  if (state.mvpMode && mvpList && !hasMvpAlive && Math.random() < 0.2) {
    defId = mvpList[Math.floor(Math.random() * mvpList.length)];
  } else {
    defId = pickWeightedMonster(map.monsters);
  }
  const def = MONSTERS[defId];
  if (!def) return; // 怪物不存在，跳過
  state.monsterIdCounter = (state.monsterIdCounter || 0) + 1;
  state.monsters.push({ defId, hp: def.hp, maxHp: def.hp, id: state.monsterIdCounter });
  state.monster = state.monsters[0];
  codexRecordSeen(defId);
  const isMvp = mvpList && mvpList.includes(defId);
  logMsg(isMvp ? `⚠️ ${def.icon} ${def.name}（MVP）降臨了！` : `一隻 ${def.icon} ${def.name} 出現了！`);
}

// 衝鋒攻擊：額外生成一隻怪
function spawnExtraMonster() {
  const map = currentMap();
  if (!map.monsters.length) return;
  if (!state.monsters) state.monsters = [];
  if (state.monsters.length >= state.maxMonsters) return;
  const defId = pickWeightedMonster(map.monsters);
  const def = MONSTERS[defId];
  if (!def) return;
  state.monsterIdCounter = (state.monsterIdCounter || 0) + 1;
  state.monsters.push({ defId, hp: def.hp, maxHp: def.hp, id: state.monsterIdCounter });
  logMsg(`一隻 ${def.icon} ${def.name} 被衝鋒攻擊召喚了！`);
}

function playerAttack() {
  if (!state.monsters || state.monsters.length === 0) return;
  // 弓沒箭就打不出去（先擋在最前面，音效動畫都不放）
  if (needsAmmo() && !consumeAmmo()) {
    if (!state._noAmmoWarned) {
      logMsg('🏹 沒有箭矢，無法用弓攻擊！請到裝備分頁裝上箭矢，或去商店購買。');
      state._noAmmoWarned = true;
    }
    return;
  }
  state._noAmmoWarned = false;
  // 攻擊音效 + 動畫
  if (typeof playAttackSound === 'function') playAttackSound();
  if (typeof playAttackAnim === 'function') playAttackAnim();
  const target = state.monsters[0]; // 攻擊第一隻怪物
  const monDef = MONSTERS[target.defId];
  // 官方RO規則：普通攻擊一律使用物理ATK（不看職業），只有主動施放的技能才會用MATK
  // 之前用 job.matkMod > job.atkMod 判斷，導致法師/巫師/見習修女/祭司的普通攻擊誤用MATK計算

  // Calculate effective crit rate with buff
  const critBuff = buffMult('crit');
  const effectiveCritRate = Math.min(100, state.critRate * critBuff.mult + critBuff.flatBonus);
  const isCrit = Math.random() * 100 < effectiveCritRate;
  if (!isCrit) {
    const hitPct = hitChancePctVsMonster(effectiveHitWithBuff(), monDef);
    if (Math.random() * 100 > hitPct) {
      logMsg(`你的攻擊被 ${monDef.name} 閃避了！`);
      // 攻擊 MISS 飄字（玩家頭上）
      if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
      return;
    }
  }

  let raw = state.atk;
  raw *= buffMult('atk').mult;
  // 狂暴狀態：HP < 25% 時 ATK +32%
  if (state.hasBerserk && state.hp < state.maxHp * 0.25) {
    raw *= 1.32;
  }
  if (isCrit) raw *= 1.5;
  // 武器值最大化：鎖定浮動值為最大值115%，否則正常85%~115%隨機浮動
  const hasMaxRoll = state.buffs.some(b => b.type === 'maxroll');
  raw *= hasMaxRoll ? 1.15 : (0.85 + Math.random() * 0.3);

  // 天使之怒被動：冷卻好時下一次攻擊必定雙倍傷害
  if (state.hasAngelusProc && Date.now() >= (state.angelusReadyAt || 0)) {
    raw *= 2;
    state.angelusReadyAt = Date.now() + (state.angelusCooldownSec || 10) * 1000;
    logMsg('😠 天使之怒發動！本次傷害雙倍！');
  }

  // 屬性相剋：武器屬性 vs 怪物屬性
  const atkWeaponId = getEquipBaseItemId('weapon');
  const weapon = atkWeaponId ? ITEMS[atkWeaponId] : null;
  let atkElement = (weapon && weapon.element) ? weapon.element : 'none';
  // 弓的實際屬性由箭矢決定（弓本身無屬性），屬性箭在此覆寫
  if (isBowWeapon(atkWeaponId)) {
    const ammo = getEquippedAmmo();
    if (ammo && ammo.element) atkElement = ammo.element;
  }
  // 聖之祈福buff：暫時附加聖屬性
  if (state.buffs.some(b => b.type === 'holyweapon')) atkElement = 'holy';
  const elemMult = getElementMultiplierVsMonster(atkElement, monDef);
  if (elemMult !== 1) {
    const pctStr = Math.round(elemMult * 100);
    const tag = elemMult > 1 ? '💚 屬性克制！' : (elemMult < 1 && elemMult > 0 ? '💜 屬性被克…' : (elemMult === 0 ? '🚫 屬性免疫！' : ''));
    if (tag) logMsg(`${tag} ${ELEMENT_NAMES[atkElement]}攻 → ${ELEMENT_NAMES[monDef.element || 'none']}防 (${pctStr}%)`);
  }
  raw *= elemMult;

  // 卡片增傷：對特定屬性/種族/體型的怪物額外增傷
  raw *= cardTargetDmgMult(monDef);

  // 體型傷害修正（依武器類型 vs 怪物體型）
  raw *= getSizeMultiplier(monDef);

  // Apply monster debuff (provoke reduces defense)
  let monDefVal = monDef.def;
  if (target.debuffDef && target.debuffDefEnd && Date.now() < target.debuffDefEnd) {
    monDefVal = Math.round(monDefVal * target.debuffDef);
  } else {
    delete target.debuffDef;
    delete target.debuffDefEnd;
  }

  const dmg = mitigateDamage(raw, monDefVal) + raceFlatBonus(monDef);
  target.hp -= dmg;
  logMsg(`你對 ${monDef.name} 造成 ${dmg} 點傷害${isCrit ? '（暴擊！無視閃避）' : ''}`);
  // 命中音效
  if (typeof playHitSound === 'function') playHitSound();

  if (target.hp <= 0) {
    killMonster(monDef, target);
    return;
  }

  // 怒爆之火：普攻期間額外附加一段火屬性傷害
  const magnumBuff = state.buffs.find(b => b.type === 'magnumfire');
  if (magnumBuff) {
    const fireMult = getElementMultiplierVsMonster('fire', monDef);
    const bonusDmg = mitigateDamage(state.atk * magnumBuff.flatBonus * fireMult, monDefVal);
    target.hp -= bonusDmg;
    logMsg(`🔥 怒爆之火附加了 ${bonusDmg} 點火屬性傷害！`);
    if (target.hp <= 0) {
      killMonster(monDef, target);
      return;
    }
  }

  // 二刀連擊：被動技能，有機率發動第二段攻擊
  const daLv = state.learnedSkills['doubleattack'] || 0;
  if (daLv > 0) {
    const daSkill = findSkillById('doubleattack');
    const daChance = daSkill.doubleAttackChance ? daSkill.doubleAttackChance[daLv - 1] : 10;
    if (Math.random() * 100 < daChance) {
      const daMult = daSkill.mult ? daSkill.mult[daLv - 1] : 1.0;
      const daRaw = raw * daMult;
      const daDmg = mitigateDamage(daRaw, monDefVal);
      target.hp -= daDmg;
      logMsg(`⚔️ 二刀連擊！對 ${monDef.name} 造成 ${daDmg} 點傷害！`);
      if (typeof playHitSound === 'function') playHitSound();
      if (target.hp <= 0) {
        killMonster(monDef, target);
      }
    }
  }

  // 噴砂被動：攻擊時機率使敵人命中下降
  if (state.hasSandmanProc && state.monsters.includes(target) && Math.random() * 100 < state.sandmanProcChance) {
    target.debuffHit = state.sandmanHitDebuff;
    target.debuffHitEnd = Date.now() + state.sandmanDebuffDuration * 1000;
    logMsg(`💨 噴砂發動！${monDef.name} 的命中下降了！`);
  }

  // 大地之擊被動：裝備斧頭或鈍器攻擊時機率使敵人暈眩
  if (state.hasHammerfallProc && state.monsters.includes(target)) {
    const isAxeOrMace = weapon && (weapon.weaponType === 'mace' || /斧/.test(weapon.name || ''));
    if (isAxeOrMace) {
      if (Math.random() * 100 < state.hammerfallSingleChance) {
        applyStun(target, state.hammerfallStunSec, true);
        logMsg(`💥 大地之擊發動！${monDef.name} 暈眩了！`);
      }
      if (Math.random() * 100 < state.hammerfallAoeChance) {
        state.monsters.forEach(m => applyStun(m, state.hammerfallStunSec, true));
        logMsg(`💥 大地之擊（全體）發動！所有敵人都暈眩了！`);
      }
    }
  }

  // 火柱攻擊被動：普攻時機率觸發範圍魔法傷害
  tryOnAttackAoeProc();

  // 塗毒：武器沾毒生效中，攻擊時機率使敵人中毒
  const ewLv = state.learnedSkills['enchantweapon'] || 0;
  if (ewLv > 0 && state.monsters.includes(target) && state.buffs.some(b => b.skillId === 'enchantweapon')) {
    const ewSkill = findSkillById('enchantweapon');
    const ewChance = ewSkill.procChance != null ? ewSkill.procChance : 20;
    if (Math.random() * 100 < ewChance) {
      const ewDmgPct = ewSkill.mult[ewLv - 1];
      applyPoisonDot(target, monDef, state.atk * ewDmgPct);
      logMsg(`☠️ 塗毒發動！${monDef.name} 中毒了！`);
    }
  }

  // 病毒散播被動：攻擊已中毒的敵人時，讓場上所有敵人一起中毒（10秒冷卻）
  if (state.hasVenomdustProc && target.poisonDotEnd && Date.now() >= (state.venomdustReadyAt || 0)) {
    state.venomdustReadyAt = Date.now() + state.venomdustCooldownSec * 1000;
    logMsg(`🦠 病毒散播發動！全場敵人陷入中毒！`);
    state.monsters.forEach(mon => {
      const mDef = MONSTERS[mon.defId];
      applyPoisonDot(mon, mDef, state.atk * state.venomdustDmgPct);
    });
  }

  // 毒性感染被動：攻擊已中毒的敵人時機率引爆全體（10秒冷卻）
  if (state.hasVenominfusionProc && target.poisonDotEnd && Date.now() >= (state.venominfusionReadyAt || 0) && Math.random() * 100 < state.venominfusionProcChance) {
    state.venominfusionReadyAt = Date.now() + state.venominfusionCooldownSec * 1000;
    logMsg(`💥 毒性感染引爆！`);
    for (let i = state.monsters.length - 1; i >= 0; i--) {
      const mon = state.monsters[i];
      const mDef = MONSTERS[mon.defId];
      const elemMult = getElementMultiplierVsMonster('poison', mDef);
      const dmg = mitigateDamage(state.atk * state.venominfusionDmgMult * elemMult, mDef.def);
      mon.hp -= dmg;
      logMsg(`  → 對 ${mDef.name} 造成 ${dmg} 點傷害！`);
      if (mon.hp <= 0) killMonster(mDef, mon);
    }
  }

  // 獵人陷阱被動：攻擊時各陷阱獨立判定觸發
  if (state.monsters.includes(target)) {
    tryTrapProcs(target, monDef);
  }

  // 閃電衝擊被動：普攻時依LUK機率額外觸發一次獵鷹單體攻擊
  const bbLv = state.learnedSkills['blitzbeat'] || 0;
  if (bbLv > 0 && state.monsters.includes(target)) {
    const luk = state.stats.luk || 1;
    const bbChance = Math.min(30, 5 + (luk - 1) * 25 / 119);
    if (Math.random() * 100 < bbChance) {
      const bbSkill = findSkillById('blitzbeat');
      const passiveMultVal = bbSkill.passiveMult[bbLv - 1];
      const bbElemMult = getElementMultiplierVsMonster(bbSkill.element || 'none', monDef);
      let bbDmg = mitigateDamage(state.atk * passiveMultVal * bbElemMult, monDef.def);
      if (state.falconFlatBonus) bbDmg += state.falconFlatBonus;
      target.hp -= bbDmg;
      logMsg(`🦅 獵鷹突襲！對 ${monDef.name} 造成 ${bbDmg} 點傷害！`);
      if (target.hp <= 0) killMonster(monDef, target);
    }
  }
}

// 單一怪物攻擊
function monsterAttackSingle(mon) {
  const monDef = MONSTERS[mon.defId];

  // 暈眩中無法攻擊（例如衝鋒箭擊退效果）
  if (mon.stunnedUntil && Date.now() < mon.stunnedUntil) {
    logMsg(`💫 ${monDef.name} 還在暈眩中，無法攻擊！`);
    return;
  }

  if (Math.random() * 100 < state.perfectDodge) {
    logMsg(`你完全迴避了 ${monDef.name} 的攻擊！`);
    if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
    return;
  }
  // 噴砂被動造成的命中下降：等同降低這隻怪的fleeReq門檻，玩家更容易迴避
  let hitDebuff = 0;
  if (mon.debuffHit && mon.debuffHitEnd && Date.now() < mon.debuffHitEnd) {
    hitDebuff = mon.debuffHit;
  } else {
    delete mon.debuffHit;
    delete mon.debuffHitEnd;
  }
  const dodgePct = dodgeChancePctFromMonster(state.flee, monDef, hitDebuff);
  if (Math.random() * 100 < dodgePct) {
    logMsg(`你迴避了 ${monDef.name} 的攻擊！`);
    if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
    return;
  }

  // 後退迴避被動：被攻擊時機率完全免傷
  if (state.hasBackslideDodge && Math.random() * 100 < state.backslideDodgeChance) {
    logMsg(`💨 後退迴避發動！完全免疫了 ${monDef.name} 的攻擊！`);
    if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
    return;
  }

  // 毒性反彈被動：被毒屬性怪物攻擊時觸發反擊（10秒冷卻，目前遊戲無毒屬性怪物，暫無實際效果）
  if (state.hasPoisonReact && monDef.element === 'poison' && Date.now() >= (state.poisonReactReadyAt || 0)) {
    logMsg(`🛡️ 毒性反彈發動！完全迴避了 ${monDef.name} 的攻擊！`);
    const counterDmg = mitigateDamage(state.atk * state.poisonReactMult, monDef.def);
    mon.hp -= counterDmg;
    logMsg(`⚔️ 反擊造成 ${counterDmg} 點傷害！`);
    state.poisonReactReadyAt = Date.now() + state.poisonReactCooldownSec * 1000;
    if (mon.hp <= 0) {
      killMonster(monDef, mon);
    }
    return;
  }

  // 反擊被動：被攻擊時機率免傷+反擊必暴
  if (state.hasCounterAttack) {
    const counterChance = state.counterAttackChance || 15;
    if (Math.random() * 100 < counterChance) {
      logMsg(`🛡️ 反擊發動！完全迴避了 ${monDef.name} 的攻擊！`);
      const counterDmg = mitigateDamage(state.atk * 1.5, monDef.def);
      mon.hp -= counterDmg;
      logMsg(`⚔️ 反擊造成 ${counterDmg} 點傷害（暴擊）！`);
      if (mon.hp <= 0) {
        killMonster(monDef, mon);
      }
      return;
    }
  }

  let raw = monDef.atk * (0.85 + Math.random() * 0.3);

  // 屬性相剋
  const elemMult = getElementMultiplier(monDef.element || 'none', 'none');
  raw *= elemMult;

  // 強化火屬性：對火屬性/無屬性怪物攻擊的耐性
  const monAtkElement = monDef.element || 'none';
  if (monAtkElement === 'fire' && state.fireResistPct) raw *= (1 - state.fireResistPct / 100);
  if (monAtkElement === 'none' && state.neutralResistPct) raw *= (1 - state.neutralResistPct / 100);

  // 卡片種族減傷（例如畢帝特飛龍卡片：受到龍族傷害-30%）
  if (monDef.race && state.cardRaceDmgReduce && state.cardRaceDmgReduce[monDef.race]) {
    raw *= (1 - state.cardRaceDmgReduce[monDef.race]);
  }
  // 卡片屬性減傷（例如受到地屬性傷害-30%）
  if (state.cardEleDmgReduce && state.cardEleDmgReduce[monAtkElement]) {
    raw *= (1 - state.cardEleDmgReduce[monAtkElement]);
  }

  // 狂暴狀態：DEF -55%
  let playerDef = state.def;
  // 天使之護：官方效果限定對惡魔/不死種族攻擊者生效
  if (state.divineDefBonus && (monDef.race === 'demon' || monDef.race === 'undead')) {
    playerDef += state.divineDefBonus;
  }
  if (state.hasBerserk && state.hp < state.maxHp * 0.25) {
    playerDef = Math.round(state.def * 0.45);
  }

  let dmg = mitigateDamage(raw, playerDef);
  // 能量外套：啟動中減傷並消耗SP，SP%低於下限時暫停生效
  if (state.hasEnergyCoatUnlock && state.energyCoatEnabled) {
    const spPct = state.maxSp > 0 ? (state.sp / state.maxSp) * 100 : 0;
    if (spPct >= (state.energyCoatSpFloorPct || 0)) {
      dmg = Math.round(dmg * (1 - (state.energyCoatDmgReductionPct || 0) / 100));
      const spCost = Math.round(state.maxSp * ((state.energyCoatSpCostPct || 0) / 100));
      state.sp = Math.max(0, state.sp - spCost);
    }
  }
  // 護盾（霸邪之陣/暗之障壁）：吸收近距離物理傷害，直到耐久或次數耗盡
  if (state.shields && state.shields.length > 0) {
    const now = Date.now();
    state.shields = state.shields.filter(sh => now < sh.expiresAt && sh.remainingCharges > 0 && sh.remainingHp > 0);
    if (state.shields.length > 0) {
      const sh = state.shields[0];
      const absorbed = Math.min(dmg, sh.remainingHp);
      sh.remainingHp -= absorbed;
      sh.remainingCharges -= 1;
      dmg -= absorbed;
      logMsg(`🛡️ 護盾抵擋了 ${absorbed} 點傷害！`);
      if (sh.remainingCharges <= 0 || sh.remainingHp <= 0) {
        state.shields.shift();
        logMsg('🛡️ 護盾已破裂！');
      }
    }
  }
  state.hp -= dmg;
  const berserkMsg = (state.hasBerserk && state.hp < state.maxHp * 0.25) ? '（狂暴中：ATK+32% DEF-55%）' : '';
  logMsg(`${monDef.name} 對你造成 ${dmg} 點傷害。${berserkMsg}`);
  // 怪物傷害飄字（玩家頭上）
  if (typeof showPlayerFloat === 'function') showPlayerFloat('-' + dmg, 'element-bad');
  if (state.hp <= 0) {
    state.hp = 0;
    if (tryAutoRevive()) return;
    onPlayerDown();
    return;
  }

  // 緩速術被動：被攻擊時機率反制暈眩攻擊者
  if (state.hasOnHitStunProc && Date.now() >= (state.onHitStunReadyAt || 0) && Math.random() * 100 < state.onHitStunChance) {
    state.onHitStunReadyAt = Date.now() + state.onHitStunCooldownSec * 1000;
    applyStun(mon, state.onHitStunSec, true);
    logMsg(`💫 緩速術發動！${monDef.name} 暈眩了！`);
  }
  // 冰凍術/石化術：被攻擊時機率反制暈眩並造成魔法傷害
  tryMagicStunProcs(mon, monDef);
  // 火之獵殺：被攻擊時觸發範圍魔法傷害
  tryOnHitAoeProc();
  // 霜凍之術：被攻擊時觸發範圍魔法傷害+機率暈眩
  tryOnHitAoeStunProc();
  // 泥沼地：被攻擊時反制暈眩攻擊者
  tryOnHitStunProc2(mon, monDef);
  // 長矛刺擊：被攻擊時機率反擊
  trySpearCounterProc(mon, monDef);
}

/* ---------------- 圖鑑（收集追蹤） ----------------
   state.codex = {
     mon:  { 怪物id: 累計擊殺數 },
     seen: { 怪物id: 1 },          // 遭遇過就算發現，不一定要打倒
     item: { 道具id: 累計取得數 }
   }
   完成度的分母只算「玩家真的碰得到」的內容：掛在地圖上的怪、這些怪掉得到的道具、
   商店買得到的道具。資料表裡有 2000 多隻沒有出沒地圖的孤兒怪與兩萬多個沒有取得
   管道的道具，全部算進分母的話完成度永遠停在個位數，收集就失去意義。
------------------------------------------------- */
function ensureCodex() {
  if (!state.codex) state.codex = {};
  if (!state.codex.mon) state.codex.mon = {};
  if (!state.codex.seen) state.codex.seen = {};
  if (!state.codex.item) state.codex.item = {};
  if (!state.codex.maps) state.codex.maps = {};
  return state.codex;
}
function codexRecordSeen(defId) {
  if (!state || !defId) return;
  ensureCodex().seen[defId] = 1;
}
function codexRecordKill(defId) {
  if (!state || !defId) return;
  const c = ensureCodex();
  c.seen[defId] = 1;
  c.mon[defId] = (c.mon[defId] || 0) + 1;
}
function codexRecordItem(itemId, qty) {
  if (!state || !itemId) return;
  const c = ensureCodex();
  c.item[itemId] = (c.item[itemId] || 0) + (qty || 1);
}

// 可收集清單是靜態資料算出來的，只算一次後快取
let _codexPoolCache = null;
function getCodexPool() {
  if (_codexPoolCache) return _codexPoolCache;
  const monSet = new Set();
  MAPS.forEach(m => (m.monsters || []).forEach(e => { if (MONSTERS[e.id]) monSet.add(e.id); }));
  if (typeof MVP_MAP_DATA !== 'undefined') {
    Object.values(MVP_MAP_DATA).forEach(list => (list || []).forEach(id => { if (MONSTERS[id]) monSet.add(id); }));
  }
  const itemSet = new Set();
  monSet.forEach(id => {
    (MONSTERS[id].drops || []).forEach(d => { if (ITEMS[d.item]) itemSet.add(d.item); });
  });
  if (typeof MONSTER_CARD_DROPS !== 'undefined') {
    Object.entries(MONSTER_CARD_DROPS).forEach(([monId, cd]) => {
      if (monSet.has(monId) && cd && ITEMS[cd.card]) itemSet.add(cd.card);
    });
  }
  Object.values(NPC_SHOPS).forEach(shop => (shop.items || []).forEach(id => { if (ITEMS[id]) itemSet.add(id); }));
  POTION_TIERS.forEach(id => { if (ITEMS[id]) itemSet.add(id); });
  const cardSet = new Set([...itemSet].filter(id => CARDS[id]));
  _codexPoolCache = {
    monsters: [...monSet].sort((a, b) => (MONSTERS[a].level || 0) - (MONSTERS[b].level || 0)),
    items: [...itemSet].filter(id => !CARDS[id]),
    cards: [...cardSet]
  };
  return _codexPoolCache;
}

// 哪些怪會掉這個道具（圖鑑的「取得來源」欄用）
let _codexSourceCache = null;
function getItemSources(itemId) {
  if (!_codexSourceCache) {
    _codexSourceCache = {};
    getCodexPool().monsters.forEach(monId => {
      (MONSTERS[monId].drops || []).forEach(d => {
        (_codexSourceCache[d.item] = _codexSourceCache[d.item] || []).push({ mon: monId, chance: d.chance });
      });
      const cd = (typeof MONSTER_CARD_DROPS !== 'undefined') ? MONSTER_CARD_DROPS[monId] : null;
      if (cd) (_codexSourceCache[cd.card] = _codexSourceCache[cd.card] || []).push({ mon: monId, chance: cd.chance });
    });
  }
  const list = (_codexSourceCache[itemId] || []).slice();
  // 同一隻怪可能同時出現在 drops 與卡片表，取機率高的那筆就好
  const best = {};
  list.forEach(s => { if (!best[s.mon] || best[s.mon].chance < s.chance) best[s.mon] = s; });
  return Object.values(best).sort((a, b) => b.chance - a.chance);
}

// 哪些地圖有這隻怪
let _codexMapCache = null;
function getMonsterMaps(monId) {
  if (!_codexMapCache) {
    _codexMapCache = {};
    MAPS.forEach(m => (m.monsters || []).forEach(e => {
      (_codexMapCache[e.id] = _codexMapCache[e.id] || []).push(m.name);
    }));
  }
  return _codexMapCache[monId] || [];
}

function getCodexProgress() {
  const pool = getCodexPool();
  const c = ensureCodex();
  const count = (ids, book) => ids.reduce((n, id) => n + (book[id] ? 1 : 0), 0);
  return {
    monsters: { found: count(pool.monsters, c.seen), killed: count(pool.monsters, c.mon), total: pool.monsters.length },
    items: { found: count(pool.items, c.item), total: pool.items.length },
    cards: { found: count(pool.cards, c.item), total: pool.cards.length }
  };
}

/* 以太礦石：只有 MVP（王）會掉，機率依王的等級分三段。
   兩種各自獨立擲骰，所以同一隻王有機會兩種都掉。 */
const ETHER_DROP_RATES = [
  { minLevel: 99, chance: 0.05 },
  { minLevel: 50, chance: 0.01 },
  { minLevel: 0,  chance: 0.001 }
];
function getEtherDropChance(monDef) {
  if (!monDef || !monDef.isBoss) return 0;
  const lv = monDef.level || 0;
  const tier = ETHER_DROP_RATES.find(t => lv >= t.minLevel);
  return tier ? tier.chance : 0;
}
function rollEtherDrop(monDef) {
  const chance = getEtherDropChance(monDef);
  if (chance <= 0) return;
  ['ether_oridecon', 'ether_elunium'].forEach(id => {
    if (Math.random() < chance) {
      addItem(id, 1);
      logMsg(`✨ MVP 掉落！獲得了 ${ITEMS[id].name}！`);
    }
  });
}

function killMonster(def, monObj) {
  // 查表一律用 MONSTERS 的 key，不要用 def.id：有 72 隻怪的 def.id 帶著去重時加上的底線
  // 後綴（例如 poring 的 def.id 是 'poring_'），拿 def.id 去查 MONSTER_CARD_DROPS 會落空，
  // 波利/綠棉蟲/小惡魔/耳語的卡片因此一直掉不出來。所有呼叫端都有傳 monObj，用它的 defId 最準。
  const monKey = (monObj && monObj.defId) || def.id;
  logMsg(`擊敗了 ${def.name}！獲得 ${def.exp} 經驗與 ${def.jobExp} 職業經驗。`);
  codexRecordKill(monKey);
  gainExp(def.exp, def.jobExp);
  const goldGain = Math.round((3 + def.level * 1.4) * buffMult('gold').mult);
  state.gold += goldGain;
  (def.drops || []).forEach(d => {
    if (Math.random() < d.chance) addItem(d.item, 1);
  });
  rollEtherDrop(def);
  // 偷竊被動：擊敗怪物時機率額外掉落一份道具
  if (state.stealChance && def.drops && def.drops.length > 0 && Math.random() * 100 < state.stealChance) {
    const stolen = def.drops[Math.floor(Math.random() * def.drops.length)];
    addItem(stolen.item, 1);
    const stolenName = ITEMS[stolen.item] ? ITEMS[stolen.item].name : stolen.item;
    logMsg(`🗡️ 偷竊發動！額外獲得了 ${stolenName}！`);
  }
  // 尋找礦石被動：擊敗怪物時機率額外獲得隨機屬性礦石（供屬性石製造使用）
  if (state.hasFindingOreProc && Math.random() * 100 < state.findingOreChance) {
    const orePool = ['boody_red', 'crystal_blue', 'wind_of_verdure', 'yellow_live'];
    const ore = orePool[Math.floor(Math.random() * orePool.length)];
    addItem(ore, 1);
    logMsg(`⛏️ 尋找礦石發動！額外獲得了 ${ITEMS[ore].name}！`);
  }
  // 貪婪被動：擊敗怪物時機率多獲得一份戰利品
  if (state.hasGreedProc && def.drops && def.drops.length > 0 && Math.random() * 100 < state.greedChance) {
    const bonus = def.drops[Math.floor(Math.random() * def.drops.length)];
    addItem(bonus.item, 1);
    const bonusName = ITEMS[bonus.item] ? ITEMS[bonus.item].name : bonus.item;
    logMsg(`💰 貪婪發動！額外獲得了 ${bonusName}！`);
  }
  // 卡片掉落
  const cardDrop = MONSTER_CARD_DROPS[monKey];
  if (cardDrop && Math.random() < cardDrop.chance) {
    addItem(cardDrop.card, 1);
    const card = CARDS[cardDrop.card];
    logMsg(`🃏 掉落了稀有的 ${card.name}！`);
  }
  // 從怪物列表中移除
  if (monObj && state.monsters) {
    state.monsters = state.monsters.filter(m => m.id !== monObj.id);
  } else if (state.monsters && state.monsters.length > 0) {
    state.monsters.shift();
  }
  // 更新 state.monster 相容性
  state.monster = state.monsters && state.monsters.length > 0 ? state.monsters[0] : null;
}

// 死亡自動復活：復活術優先，若冷卻中或SP不足才輪到捨身取義
function tryAutoRevive() {
  const now = Date.now();
  if (state.hasAutoRevive1 && now >= (state.autoRevive1ReadyAt || 0) && state.sp >= (state.autoRevive1SpCost || 0)) {
    state.sp -= (state.autoRevive1SpCost || 0);
    state.autoRevive1ReadyAt = now + state.autoRevive1CooldownSec * 1000;
    state.hp = Math.max(1, Math.round(state.maxHp * state.autoRevive1HpPct / 100));
    logMsg(`✨ 復活術發動！原地復活，恢復了${state.autoRevive1HpPct}% HP！`);
    return true;
  }
  if (state.hasAutoRevive2 && now >= (state.autoRevive2ReadyAt || 0)) {
    state.autoRevive2ReadyAt = now + state.autoRevive2CooldownSec * 1000;
    state.hp = Math.max(1, Math.round(state.maxHp * state.autoRevive2HpPct / 100));
    logMsg(`✨ 捨身取義發動！原地復活，恢復了${state.autoRevive2HpPct}% HP！`);
    return true;
  }
  return false;
}

function onPlayerDown() {
  state.deaths = (state.deaths || 0) + 1;
  logMsg(`⚠️ 你被擊倒了！正在返回安全地帶療傷……`);
  state.monster = null;
  state.monsters = [];
  // 找到該地區的安全區，沒有就去普隆德拉
  const curRegion = regionOf(state.mapId);
  let safeMap = null;
  if (curRegion) {
    for (const mid of curRegion.maps) {
      const m = MAPS.find(x => x.id === mid);
      if (m && m.monsters.length === 0) { safeMap = m.id; break; }
    }
  }
  if (!safeMap) safeMap = 'prontera'; // 兜底
  state.mapId = safeMap;
  ensureCodex().maps[safeMap] = 1; // 被抬回城也算造訪過，這條路徑沒有經過 changeMap()
  state.hp = state.maxHp;
  state.sp = state.maxSp;
  state.attackAccumulator = 0;
  state.lastAttackTime = Date.now();
  recomputeDerived(false);
  logMsg('你恢復了意識，HP/SP 已全滿。');
  onTickUI();
  renderMapBackground();
  playMapMusic();
  if (typeof renderMapTab === 'function') renderMapTab();
}

/* ---------------- 經驗 / 升級 ---------------- */
function gainExp(baseExp, jobExp) {
  state.baseExp += baseExp;
  const baseLevelCap = 99; // 新手/一轉/二轉最高等級限制
  let need = expToNextBaseLevel(state.baseLevel);
  while (state.baseExp >= need && state.baseLevel < baseLevelCap) {
    state.baseExp -= need;
    state.baseLevel++;
    const gained = statPointsAtLevel(state.baseLevel);
    state.statPoints += gained;
    logMsg(`🎉 基礎等級提升到 ${state.baseLevel}！獲得 ${gained} 點屬性點。`);
    need = expToNextBaseLevel(state.baseLevel);
  }

  const job = currentJob();
  if (state.jobLevel < job.jobLevelMax) {
    state.jobExp += jobExp;
    let jneed = expToNextJobLevel(state.jobLevel);
    while (state.jobExp >= jneed && state.jobLevel < job.jobLevelMax) {
      state.jobExp -= jneed;
      state.jobLevel++;
      // 技能點歸入當前職業的點數池
      if (!state.jobSkillPoints) state.jobSkillPoints = {};
      if (!state.jobSkillPoints[state.jobId]) state.jobSkillPoints[state.jobId] = 0;
      state.jobSkillPoints[state.jobId]++;
      state.skillPoints = Object.values(state.jobSkillPoints).reduce((a, b) => a + b, 0);
      logMsg(`✨ 職業等級提升到 ${state.jobLevel}！獲得 1 點技能點（${currentJob().name}）。`);
      jneed = expToNextJobLevel(state.jobLevel);
    }
    if (state.jobLevel >= job.jobLevelMax) { state.jobExp = 0; }
  }
  recomputeDerived(false);
}

/* ---------------- 屬性加點 ----------------
   兩條公式皆採用 RO 正式版對照表（巴哈姆特/RO Wiki 公開資料）換算：
     每級獲得素質點 = floor((等級-1)/5) + 3   （36~40級每級10點、41~45級每級11點...，與官方對照表一致）
     加點所需素質點 = 2 + floor((目前數值-1)/10)（1→2 花2點、10→11花2點、11→12花3點...與官方2~11/12~21...對照表一致）
------------------------------------------------- */
function statPointsAtLevel(level) {
  return Math.floor((level - 1) / 5) + 3;
}
function statPointCost(currentValue) {
  return 2 + Math.floor((currentValue - 1) / 10);
}

function allocateStat(key) {
  const statCap = 99; // 能力值上限
  if (state.stats[key] >= statCap) return false;
  const cost = statPointCost(state.stats[key]);
  if (state.statPoints < cost) return false;
  state.stats[key]++;
  state.statPoints -= cost;
  recomputeDerived(false);
  saveGame();
  return true;
}

/* ---------------- 技能 ---------------- */
function levelUpSkill(skillId) {
  // 搜尋所有已解鎖職業的技能
  const sk = findSkillById(skillId);
  if (!sk) return false;
  if (sk.isQuest) return false;
  const currentLv = state.learnedSkills[skillId] || 0;
  if (currentLv >= sk.maxLv) return false;

  // 前置技能檢查（目前僅閃電衝擊需要馴鷹術，特例硬綁，尚未做成通用系統）
  if (sk.requires) {
    const reqLv = state.learnedSkills[sk.requires.skillId] || 0;
    if (reqLv < sk.requires.level) {
      const reqSk = findSkillById(sk.requires.skillId);
      logMsg(`⚠️ 需要先學習「${reqSk ? reqSk.name : sk.requires.skillId}」！`);
      return false;
    }
  }

  // 找出這個技能所屬的職業
  const skillJobId = findSkillJob(skillId);
  if (!skillJobId) return false;

  // 檢查該職業的技能點是否足夠
  if (!state.jobSkillPoints) state.jobSkillPoints = {};
  if ((state.jobSkillPoints[skillJobId] || 0) <= 0) {
    logMsg(`⚠️ ${JOB_TREE[skillJobId].name} 的技能點不足！`);
    return false;
  }

  state.learnedSkills[skillId] = currentLv + 1;
  state.jobSkillPoints[skillJobId]--;
  state.skillPoints = Object.values(state.jobSkillPoints).reduce((a, b) => a + b, 0);
  logMsg(`${sk.name} 升級至 Lv${currentLv + 1}！（${JOB_TREE[skillJobId].name} 技能點 -1）`);
  recomputeDerived(true);
  saveGame();
  return true;
}

// 找出技能所屬的職業 ID
function findSkillJob(skillId) {
  const allJobs = getAllLearnedJobs();
  for (const jobId of allJobs) {
    const job = JOB_TREE[jobId];
    if (!job) continue;
    if (job.skills.find(s => s.id === skillId)) return jobId;
  }
  return null;
}

function resetSkills() {
  let totalSpent = 0;
  const allJobs = getAllLearnedJobs();
  for (const jobId of allJobs) {
    const job = JOB_TREE[jobId];
    if (!job) continue;
    let jobSpent = 0;
    job.skills.forEach(sk => {
      const lv = state.learnedSkills[sk.id] || 0;
      if (!sk.isQuest && lv > 0) {
        jobSpent += lv;
        delete state.learnedSkills[sk.id];
      }
    });
    // 歸還到對應職業的點數池
    if (!state.jobSkillPoints) state.jobSkillPoints = {};
    state.jobSkillPoints[jobId] = (state.jobSkillPoints[jobId] || 0) + jobSpent;
    totalSpent += jobSpent;
  }
  state.skillPoints = Object.values(state.jobSkillPoints).reduce((a, b) => a + b, 0);
  logMsg(`技能已重置，返還 ${totalSpent} 點技能點。`);
  recomputeDerived(true);
  saveGame();
}

// Keep old function name as alias for compatibility
function learnSkill(skillId) { return levelUpSkill(skillId); }

function skillReady(skillId) {
  return !state.cooldowns[skillId];
}

function castSkill(skillId) {
  const sk = findSkillById(skillId);
  if (!sk) return false;
  const lv = state.learnedSkills[skillId];
  if (!lv) return false;
  if (!skillReady(skillId)) return false;

  // 武器類型限定技能（例如長矛專用技）：未裝備對應武器時無法施放
  if (sk.requiresWeapon === 'spear' && !hasSpearEquipped()) {
    logMsg(`⚠️ 「${sk.name}」需要裝備矛類武器才能施放！`);
    return false;
  }

  const spCost = Array.isArray(sk.spCost) ? (sk.spCost[lv - 1] ?? sk.spCost[sk.spCost.length - 1] ?? 0) : (sk.spCost || 0);
  if (state.sp < spCost) return false;

  // 金錢攻擊：消耗鋅幣才能施放
  let zenyCost = 0;
  if (sk.zenyCost) {
    zenyCost = Array.isArray(sk.zenyCost) ? sk.zenyCost[lv - 1] : sk.zenyCost;
    // 詭計的商術：降低指定技能的鋅幣消耗
    const zenyReductionPct = (state.zenyCostReductionPct && state.zenyCostReductionPct[sk.id]) || 0;
    if (zenyReductionPct) zenyCost = Math.round(zenyCost * (1 - zenyReductionPct / 100));
    if (state.gold < zenyCost) {
      logMsg(`⚠️ 鋅幣不足，無法施放「${sk.name}」！`);
      return false;
    }
  }

  // 加速術：消耗固定HP才能施放
  let hpCost = 0;
  if (sk.hpCost) {
    hpCost = Array.isArray(sk.hpCost) ? sk.hpCost[lv - 1] : sk.hpCost;
    if (state.hp <= hpCost) {
      logMsg(`⚠️ HP不足，無法施放「${sk.name}」！`);
      return false;
    }
  }

  const isHeal = sk.type === 'heal' || sk.type === 'heal_over_time';
  const isBuff = ['buff_atk', 'buff_def', 'buff_aspd', 'buff_flee', 'buff_gold', 'buff_crit', 'buff_maxroll', 'buff_blessing', 'buff_shield', 'buff_sprate', 'buff_lukflat', 'buff_holyweapon', 'debuff_def', 'debuff'].includes(sk.type);
  const needsMonster = ['damage', 'magic', 'dot', 'damage_multihit', 'damage_multi', 'debuff_def', 'debuff', 'special_charge', 'poison_proc', 'stun_field', 'multi_dot_stun'].includes(sk.type);
  if (needsMonster && (!state.monsters || state.monsters.length === 0)) return false;

  state.sp -= spCost;
  if (hpCost > 0) state.hp -= hpCost;
  if (zenyCost > 0) state.gold -= zenyCost;
  const cd = Array.isArray(sk.cooldown) ? sk.cooldown[lv - 1] : sk.cooldown;
  state.cooldowns[skillId] = cd * 1000;

  const mult = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
  // 'magic_aoe'（例如火球術、雷爆術、光獵、怒雷強擊）先前漏判，導致誤用ATK而非MATK計算傷害
  const useMag = sk.type === 'magic' || sk.type === 'magic_aoe';
  const baseDmgStat = useMag ? state.matk : state.atk;

  // 屬性相剋：技能屬性 vs 怪物屬性
  const skElement = sk.element || 'none';

  switch (sk.type) {
    case 'damage':
    case 'magic': {
      if (!state.monsters || state.monsters.length === 0) break;
      const target = state.monsters[0];
      const def = MONSTERS[target.defId];
      // 命中判定：物理技能才需要，法術類技能無視閃避
      if (sk.type !== 'magic') {
        // 超音速投擲被動：音速投擲命中率修正+90%
        let effectiveHit = effectiveHitWithBuff();
        if (sk.id === 'sonicblow' && state.hasSonicblowBoost) effectiveHit += 90;
        // 狂擊：本次攻擊額外命中加成
        if (sk.id === 'bash' && sk.hitBonus) {
          effectiveHit += Array.isArray(sk.hitBonus) ? sk.hitBonus[lv - 1] : sk.hitBonus;
        }
        const hitPct = hitChancePctVsMonster(effectiveHit, def);
        if (Math.random() * 100 > hitPct) {
          logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
          if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
          break;
        }
      }
      const elemMult = getElementMultiplierVsMonster(skElement, def);
      if (elemMult !== 1) {
        const pctStr = Math.round(elemMult * 100);
        const tag = elemMult > 1 ? '💚 屬性克制！' : (elemMult < 1 && elemMult > 0 ? '💜 屬性被克…' : (elemMult === 0 ? '🚫 屬性免疫！' : ''));
        if (tag) logMsg(`${tag} ${ELEMENT_NAMES[skElement]}攻 → ${ELEMENT_NAMES[def.element || 'none']}防 (${pctStr}%)`);
      }
      // 卡片屬性傷害加成
      const skEleDmgBonus = cardTargetDmgMult(def) - 1;
      let skillMult = mult;
      // 超音速投擲被動：音速投擲傷害+90%
      if (sk.id === 'sonicblow' && state.hasSonicblowBoost) {
        skillMult *= 1.9;
      }
      // 轉生術：依基本等級與INT增加傷害（各自封頂99）
      if (sk.id === 'turnundead') {
        const lvlBonusPct = (state.baseLevel / 99) * (sk.levelScaleMax || 100);
        const intBonusPct = (state.stats.int / 99) * (sk.intScaleMax || 50);
        skillMult *= (1 + lvlBonusPct / 100 + intBonusPct / 100);
      }
      // 聖靈召喚：對不死種族額外加成
      if (sk.id === 'soulstrike' && def.race === 'undead' && sk.undeadBonusPct) {
        const undeadPct = Array.isArray(sk.undeadBonusPct) ? sk.undeadBonusPct[lv - 1] : sk.undeadBonusPct;
        skillMult *= (1 + undeadPct / 100);
      }
      // 低血量加成（例如音速投擲：目標HP低於門檻時傷害加成）
      if (sk.lowHpThreshold && target.hp < target.maxHp * sk.lowHpThreshold) {
        skillMult *= sk.lowHpMult;
      }
      // 負重量上升：加成金錢攻擊/手推車攻擊傷害
      if ((sk.id === 'mammonite' || sk.id === 'cartattack') && state.cartDmgBonusMult) {
        skillMult *= (1 + state.cartDmgBonusMult);
      }
      const sizeMult = useMag ? 1 : getSizeMultiplier(def);
      const dmg = mitigateDamage(baseDmgStat * skillMult * elemMult * sizeMult * (1 + skEleDmgBonus), def.def) + raceFlatBonus(def);
      target.hp -= dmg;
      logMsg(`⚡ 「${sk.name}」Lv${lv} 造成 ${dmg} 點傷害！`);
      // 冰凍術/石化術：魔法傷害命中會提前喚醒被反制暈眩的目標
      if (sk.type === 'magic') wakeIfFrozen(target);
      // 雷鳴術：命中必定使目標暈眩
      if (sk.stunOnHit) {
        const stunSecHit = Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : (sk.stunSec || 1);
        applyStun(target, stunSecHit, true);
        logMsg(`💫 ${def.name} 被暈眩了！`);
      }
      // 攻擊弱點：狂擊命中時有機率使目標暈眩
      if (sk.id === 'bash' && state.hasBashStunProc && target.hp > 0 && Math.random() * 100 < state.bashStunProcChance) {
        applyStun(target, state.bashStunProcSec || 1, true);
        logMsg(`💫 攻擊弱點發動！${def.name} 暈眩了！`);
      }
      // 衝鋒箭：命中時使敵人暈眩1~3秒（代表擊退）
      if (sk.id === 'chargearrow' && target.hp > 0) {
        const stunSec = 1 + Math.random() * 2;
        applyStun(target, stunSec, false);
        logMsg(`💫 ${def.name} 被擊退撞暈了，${stunSec.toFixed(1)}秒內無法攻擊！`);
      }
      if (target.hp <= 0) killMonster(def, target);
      break;
    }
    case 'damage_aoe':
    case 'magic_aoe': {
      // 範圍技：打全部怪物
      if (!state.monsters || state.monsters.length === 0) break;
      logMsg(`💥 「${sk.name}」Lv${lv} 範圍攻擊！`);
      for (let i = state.monsters.length - 1; i >= 0; i--) {
        const mon = state.monsters[i];
        const monDef = MONSTERS[mon.defId];
        // 命中判定：物理範圍技能對每隻怪物個別判定，法術範圍技能無視閃避
        if (sk.type !== 'magic_aoe') {
          const hitPct = hitChancePctVsMonster(effectiveHitWithBuff(), monDef);
          if (Math.random() * 100 > hitPct) {
            combatLogBuf.push(`  → ${monDef.name} 閃避了！`);
            continue;
          }
        }
        const monElemMult = getElementMultiplierVsMonster(skElement, monDef);
        const monEleDmgBonus = cardTargetDmgMult(monDef) - 1;
        // 負重量上升：加成手推車攻擊傷害
        let aoeMult = mult;
        if (sk.id === 'cartattack' && state.cartDmgBonusMult) aoeMult *= (1 + state.cartDmgBonusMult);
        // 騎乘攻擊：依STR增加傷害（STR120封頂）
        if (sk.id === 'brandishspear') {
          const strScaleMax = Array.isArray(sk.strScaleMax) ? sk.strScaleMax[lv - 1] : (sk.strScaleMax || 100);
          const strBonusPct = Math.min(1, state.stats.str / 120) * (strScaleMax / 100);
          aoeMult *= (1 + strBonusPct);
        }
        const aoeSizeMult = useMag ? 1 : getSizeMultiplier(monDef);
        let dmg = mitigateDamage(baseDmgStat * aoeMult * monElemMult * aoeSizeMult * (1 + monEleDmgBonus), monDef.def) + raceFlatBonus(monDef);
        // 鋼製喙：閃電衝擊額外固定傷害（不受倍率影響）
        if (sk.id === 'blitzbeat' && state.falconFlatBonus) dmg += state.falconFlatBonus;
        mon.hp -= dmg;
        // 冰凍術/石化術：魔法傷害命中會提前喚醒被反制暈眩的目標
        if (sk.type === 'magic_aoe') wakeIfFrozen(mon);
        // 怒雷強擊：範圍技附加機率暈眩
        if (sk.stunChance) {
          const scLv = Array.isArray(sk.stunChance) ? sk.stunChance[lv - 1] : sk.stunChance;
          if (Math.random() * 100 < scLv) {
            const ssLv = Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : (sk.stunSec || 1);
            applyStun(mon, ssLv, true);
          }
        }
        combatLogBuf.push(`  → 對 ${monDef.name} 造成 ${dmg} 點傷害！`);
        // AoE 飄字：直接找怪物 DOM 元素
        if (typeof showDamageFloat === 'function') {
          const targetEl = document.getElementById('monster-slot-' + mon.id);
          if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const el = document.createElement('div');
            el.className = 'damage-float';
            el.textContent = '-' + dmg;
            el.style.position = 'fixed';
            el.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 20) + 'px';
            el.style.top = (rect.top - 10) + 'px';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1500);
          }
        }
        if (mon.hp <= 0) killMonster(monDef, mon);
      }
      // 光獵：額外附加HIT加成buff
      if (sk.bonusHitBuff) {
        const hitBonus = Array.isArray(sk.bonusHitBuff) ? sk.bonusHitBuff[lv - 1] : sk.bonusHitBuff;
        const hitDur = Array.isArray(sk.bonusHitDuration) ? sk.bonusHitDuration[lv - 1] : sk.bonusHitDuration;
        state.buffs.push({ type: 'hit', mult: 1, flatBonus: hitBonus, msRemaining: hitDur * 1000 });
      }
      // 怒爆：附加一段時間內普攻額外火屬性傷害buff（重複施放時重新整理，不疊加）
      if (sk.buffPct) {
        const buffPct = Array.isArray(sk.buffPct) ? sk.buffPct[lv - 1] : sk.buffPct;
        const buffDur = Array.isArray(sk.buffDurationSec) ? sk.buffDurationSec[lv - 1] : sk.buffDurationSec;
        state.buffs = state.buffs.filter(b => b.type !== 'magnumfire');
        state.buffs.push({ type: 'magnumfire', flatBonus: buffPct / 100, msRemaining: buffDur * 1000 });
        logMsg(`🔥 「${sk.name}」發動，接下來${buffDur}秒內普攻附加額外火屬性傷害！`);
      }
      if (typeof renderLog === 'function') renderLog();
      break;
    }
    case 'stun_field': {
      if (!state.monsters || state.monsters.length === 0) break;
      const stunSec = sk.stunSec || 1;
      if (sk.aoeFromLv && lv >= sk.aoeFromLv) {
        state.monsters.forEach(m => applyStun(m, stunSec, true));
        logMsg(`💫 「${sk.name}」Lv${lv} 發動，全體敵人暈眩了！`);
      } else {
        applyStun(state.monsters[0], stunSec, true);
        logMsg(`💫 「${sk.name}」Lv${lv} 發動，${MONSTERS[state.monsters[0].defId].name} 暈眩了！`);
      }
      break;
    }
    case 'buff_blessing': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      const statBonus = Array.isArray(sk.statBonus) ? sk.statBonus[lv - 1] : sk.statBonus;
      const hitBonus = Array.isArray(sk.hitBonus) ? sk.hitBonus[lv - 1] : sk.hitBonus;
      state.buffs.push({ type: 'blessing', strBonus: statBonus, intBonus: statBonus, dexBonus: statBonus, msRemaining: dur * 1000 });
      state.buffs.push({ type: 'hit', mult: 1, flatBonus: hitBonus, msRemaining: dur * 1000 });
      logMsg(`✨ 「${sk.name}」Lv${lv} 發動，STR/INT/DEX與HIT上升！`);
      break;
    }
    case 'buff_sprate': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'sprate', mult, msRemaining: dur * 1000 });
      logMsg(`✨ 「${sk.name}」Lv${lv} 發動，SP自然恢復速度上升！`);
      break;
    }
    case 'buff_lukflat': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      const lukBonus = Array.isArray(sk.lukBonus) ? sk.lukBonus[lv - 1] : sk.lukBonus;
      state.buffs.push({ type: 'lukflat', mult: 1, flatBonus: lukBonus, msRemaining: dur * 1000 });
      logMsg(`🍀 「${sk.name}」Lv${lv} 發動，LUK上升！`);
      break;
    }
    case 'buff_holyweapon': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'holyweapon', mult: 1, msRemaining: dur * 1000 });
      logMsg(`✨ 「${sk.name}」Lv${lv} 發動，武器暫時附加聖屬性！`);
      break;
    }
    case 'buff_shield': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      const capacityPct = Array.isArray(sk.shieldCapacityPct) ? sk.shieldCapacityPct[lv - 1] : sk.shieldCapacityPct;
      const capacityFlat = Array.isArray(sk.shieldCapacityFlat) ? sk.shieldCapacityFlat[lv - 1] : sk.shieldCapacityFlat;
      const capacity = capacityFlat != null ? capacityFlat : Math.round(state.maxHp * ((capacityPct || 0) / 100));
      const charges = Array.isArray(sk.shieldCharges) ? sk.shieldCharges[lv - 1] : sk.shieldCharges;
      if (!state.shields) state.shields = [];
      state.shields.push({ id: sk.id, remainingHp: capacity, remainingCharges: charges, expiresAt: Date.now() + dur * 1000 });
      logMsg(`🛡️ 「${sk.name}」Lv${lv} 發動，護盾展開！（耐久${capacity}，可擋${charges}次）`);
      break;
    }
    case 'field_heal': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      const healAmt = Array.isArray(sk.healPerTick) ? sk.healPerTick[lv - 1] : sk.healPerTick;
      const tickSec = sk.fieldTickIntervalSec || 1;
      if (!state.activeFieldEffects) state.activeFieldEffects = [];
      state.activeFieldEffects.push({ kind: 'selfheal', name: sk.name, amount: healAmt, tickIntervalSec: tickSec, nextTickAt: Date.now(), endsAt: Date.now() + dur * 1000 });
      logMsg(`✨ 「${sk.name}」Lv${lv} 發動！`);
      break;
    }
    case 'field_aoe_magic': {
      if (!state.monsters || state.monsters.length === 0) break;
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      const tickSec = sk.fieldTickIntervalSec || 3;
      const stunChance = Array.isArray(sk.stunChance) ? sk.stunChance[lv - 1] : sk.stunChance;
      const stunSec = Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : sk.stunSec;
      if (!state.activeFieldEffects) state.activeFieldEffects = [];
      state.activeFieldEffects.push({ kind: 'aoe_holydmg', name: sk.name, mult, element: skElement || 'holy', stunChance, stunSec, tickIntervalSec: tickSec, nextTickAt: Date.now(), endsAt: Date.now() + dur * 1000 });
      logMsg(`✨ 「${sk.name}」Lv${lv} 發動！`);
      break;
    }
    case 'multi_dot_stun': {
      if (!state.monsters || state.monsters.length === 0) break;
      const maxTargets = Array.isArray(sk.maxTargets) ? sk.maxTargets[lv - 1] : (sk.maxTargets || 1);
      const stunSec = Array.isArray(sk.stunSec) ? sk.stunSec[lv - 1] : (sk.stunSec || 1);
      const tickSec = Array.isArray(sk.tickIntervalSec) ? sk.tickIntervalSec[lv - 1] : (sk.tickIntervalSec || 1);
      const dotDur = Array.isArray(sk.dotDurationSec) ? sk.dotDurationSec[lv - 1] : (sk.dotDurationSec || 1);
      const targets = state.monsters.slice(0, maxTargets);
      const targetIds = targets.map(m => m.id);
      targets.forEach(m => applyStun(m, stunSec, true));
      if (!state.activeFieldEffects) state.activeFieldEffects = [];
      state.activeFieldEffects.push({ kind: 'multi_dot', name: sk.name, mult, element: skElement, targetIds, tickIntervalSec: tickSec, nextTickAt: Date.now() + tickSec * 1000, endsAt: Date.now() + dotDur * 1000 });
      logMsg(`🔥 「${sk.name}」Lv${lv} 發動！${targets.length}隻敵人暈眩了！`);
      break;
    }
    case 'dot': {
      if (!state.monsters || state.monsters.length === 0) break;
      const target = state.monsters[0];
      const def = MONSTERS[target.defId];
      // 命中判定：中毒類技能屬於物理技能
      const dotHitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def);
      if (Math.random() * 100 > dotHitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplierVsMonster(skElement, def);
      const dotEleDmgBonus = cardTargetDmgMult(def) - 1;
      const dmg = mitigateDamage(baseDmgStat * mult * elemMult * (1 + dotEleDmgBonus), def.def * 0.6);
      target.hp -= dmg;
      logMsg(`☠️ 「${sk.name}」Lv${lv} 造成 ${dmg} 點持續傷害！`);
      if (target.hp <= 0) killMonster(def, target);
      break;
    }
    case 'poison_proc': {
      // 施毒：命中後造成固定傷害（不隨等級變化），另外骰一次中毒機率（依等級），中毒固定3秒不疊加
      if (!state.monsters || state.monsters.length === 0) break;
      const target = state.monsters[0];
      const def = MONSTERS[target.defId];
      const hitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def);
      if (Math.random() * 100 > hitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplierVsMonster(skElement, def);
      const dmg = mitigateDamage(baseDmgStat * mult * elemMult, def.def);
      target.hp -= dmg;
      logMsg(`⚡ 「${sk.name}」Lv${lv} 造成 ${dmg} 點傷害！`);
      if (target.hp <= 0) { killMonster(def, target); break; }
      const procChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
      if (Math.random() * 100 < procChance) {
        applyPoisonDot(target, def, baseDmgStat * mult);
        logMsg(`☠️ ${def.name} 中毒了！`);
      }
      break;
    }
    case 'heal': {
      const amt = Math.round((state.stats.int + state.baseLevel) * mult);
      state.hp = Math.min(state.maxHp, state.hp + amt);
      logMsg(`💚 「${sk.name}」Lv${lv} 恢復了 ${amt} 點HP。`);
      break;
    }
    case 'heal_over_time': {
      const amt = Math.round((state.stats.int + state.baseLevel) * mult);
      state.hp = Math.min(state.maxHp, state.hp + amt);
      logMsg(`💫 「${sk.name}」Lv${lv} 持續恢復HP。`);
      break;
    }
    case 'buff_def': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'def', mult, msRemaining: dur * 1000 });
      logMsg(`🛡️ 「${sk.name}」Lv${lv} 發動，防禦力上升！`);
      break;
    }
    case 'buff_atk': {
      let dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      // 武器保有：凶砍持續時間+10%
      if (sk.id === 'overthrustbuff' && state.hiltBindingDurationBonus) dur *= (1 + state.hiltBindingDurationBonus);
      state.buffs.push({ type: 'atk', mult, msRemaining: dur * 1000 });
      logMsg(`💪 「${sk.name}」Lv${lv} 發動，攻擊力上升！`);
      break;
    }
    case 'buff_aspd': {
      let dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      // 武器保有：速度激發持續時間+10%
      if (sk.id === 'adrenaline' && state.hiltBindingDurationBonus) dur *= (1 + state.hiltBindingDurationBonus);
      state.buffs.push({ type: 'aspd', mult, msRemaining: dur * 1000 });
      // 雙手劍加速額外加成：暴擊率+命中
      if (sk.bonusCrit) {
        const critBonus = Array.isArray(sk.bonusCrit) ? sk.bonusCrit[lv - 1] : sk.bonusCrit;
        state.buffs.push({ type: 'crit', mult: 1, flatBonus: critBonus, msRemaining: dur * 1000 });
      }
      if (sk.bonusHit) {
        const hitBonus = Array.isArray(sk.bonusHit) ? sk.bonusHit[lv - 1] : sk.bonusHit;
        state.buffs.push({ type: 'hit', mult: 1, flatBonus: hitBonus, msRemaining: dur * 1000 });
      }
      // 加速術：附加AGI固定加成
      if (sk.agiFlatBonus) {
        const agiBonus = Array.isArray(sk.agiFlatBonus) ? sk.agiFlatBonus[lv - 1] : sk.agiFlatBonus;
        state.buffs.push({ type: 'agiflat', mult: 1, flatBonus: agiBonus, msRemaining: dur * 1000 });
      }
      logMsg(`💨 「${sk.name}」Lv${lv} 發動，攻速上升！`);
      break;
    }
    case 'buff_maxroll': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'maxroll', mult: 1, msRemaining: dur * 1000 });
      logMsg(`⚒️ 「${sk.name}」Lv${lv} 發動，武器傷害浮動值最大化！`);
      break;
    }
    case 'damage_multihit': {
      // 怪物互擊：2段傷害，第二段打全部怪物
      if (!state.monsters || state.monsters.length === 0) break;
      const target = state.monsters[0];
      const def = MONSTERS[target.defId];
      // 命中判定：整招視為一次判定，miss 時兩段都不生效
      const mhHitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def);
      if (Math.random() * 100 > mhHitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplierVsMonster(skElement, def);
      const mhEleDmgBonus = cardTargetDmgMult(def) - 1;
      // 第一段：單體傷害
      const dmg1 = mitigateDamage(baseDmgStat * mult * elemMult * getSizeMultiplier(def) * (1 + mhEleDmgBonus), def.def) + raceFlatBonus(def);
      target.hp -= dmg1;
      pendingFloatTargetId = target.id;
      logMsg(`⚡ 「${sk.name}」Lv${lv} 第一段對 ${def.name} 造成 ${dmg1} 點傷害！`);
      pendingFloatTargetId = null;
      if (target.hp <= 0) killMonster(def, target);
      // 第二段：範圍傷害，打全部怪物
      const mult2 = Array.isArray(sk.mult2) ? sk.mult2[lv - 1] : sk.mult2;
      logMsg(`💥 「${sk.name}」Lv${lv} 第二段範圍攻擊！`);
      for (let i = state.monsters.length - 1; i >= 0; i--) {
        const mon = state.monsters[i];
        const monDef = MONSTERS[mon.defId];
        const monElemMult = getElementMultiplierVsMonster(skElement, monDef);
        const mon2EleDmgBonus = cardTargetDmgMult(monDef) - 1;
        const dmg2 = mitigateDamage(baseDmgStat * mult2 * monElemMult * getSizeMultiplier(monDef) * (1 + mon2EleDmgBonus), monDef.def) + raceFlatBonus(monDef);
        mon.hp -= dmg2;
        combatLogBuf.push(`  → 對 ${monDef.name} 造成 ${dmg2} 點範圍傷害！`);
        // AoE 飄字：直接找怪物 DOM 元素
        if (typeof showDamageFloat === 'function') {
          const targetEl = document.getElementById('monster-slot-' + mon.id);
          if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const el = document.createElement('div');
            el.className = 'damage-float';
            el.textContent = '-' + dmg2;
            el.style.position = 'fixed';
            el.style.left = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 20) + 'px';
            el.style.top = (rect.top - 10) + 'px';
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1500);
          }
        }
        if (mon.hp <= 0) killMonster(monDef, mon);
      }
      break;
    }
    case 'damage_multi': {
      // 連刺攻擊：依體型多段
      if (!state.monsters || state.monsters.length === 0) break;
      const target = state.monsters[0];
      const def = MONSTERS[target.defId];
      // 命中判定：整招視為一次判定
      const dmHitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def);
      if (Math.random() * 100 > dmHitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplierVsMonster(skElement, def);
      const multiEleDmgBonus = cardTargetDmgMult(def) - 1;
      const hits = Array.isArray(sk.hits) ? sk.hits[lv - 1] : (sk.hits || 1);
      let totalDmg = 0;
      for (let i = 0; i < hits; i++) {
        const dmg = mitigateDamage(baseDmgStat * mult * elemMult * getSizeMultiplier(def) * (1 + multiEleDmgBonus), def.def) + raceFlatBonus(def);
        totalDmg += dmg;
        target.hp -= dmg;
        if (target.hp <= 0) break;
      }
      logMsg(`⚡ 「${sk.name}」Lv${lv} 造成 ${hits} 段攻擊，共 ${totalDmg} 點傷害！`);
      if (target.hp <= 0) killMonster(def, target);
      break;
    }
    case 'special_charge': {
      // 衝鋒攻擊：普攻一下 + 立即生成新怪
      if (!state.monsters || state.monsters.length === 0) break;
      const target = state.monsters[0];
      const def = MONSTERS[target.defId];
      // 命中判定：miss 時不造成傷害，但衝鋒生怪效果仍然發動
      const scHitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def);
      if (Math.random() * 100 <= scHitPct) {
        const elemMult = getElementMultiplierVsMonster(skElement, def);
        const scEleDmgBonus = cardTargetDmgMult(def) - 1;
        const dmg = mitigateDamage(baseDmgStat * mult * elemMult * (1 + scEleDmgBonus), def.def);
        target.hp -= dmg;
        logMsg(`⚡ 「${sk.name}」Lv${lv} 造成 ${dmg} 點傷害！`);
        if (target.hp <= 0) killMonster(def, target);
      } else {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
      }
      // 立即生成新怪（不取代現有怪物）
      if (state.monsters && state.monsters.length < 5) {
        spawnExtraMonster();
        logMsg(`🐎 衝鋒攻擊生成了一隻新怪物！（場上 ${state.monsters.length}/5）`);
      }
      break;
    }
    case 'buff_flee': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'flee', mult, msRemaining: dur * 1000, skillId: sk.id });
      logMsg(`🌫️ 「${sk.name}」Lv${lv} 發動，迴避上升！`);
      break;
    }
    case 'buff_poison': {
      // 塗毒：武器沾毒，生效期間攻擊有機率使敵人中毒（實際觸發在 playerAttack()）
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'poison', mult: 1, msRemaining: dur * 1000, skillId: sk.id });
      logMsg(`☠️ 「${sk.name}」Lv${lv} 發動，武器沾上了毒！`);
      break;
    }
    case 'buff_statpct': {
      // 心神凝聚：DEX/AGI 百分比加成（實際套用在 recomputeDerived()）
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'statpct', mult, msRemaining: dur * 1000, skillId: sk.id });
      logMsg(`🎯 「${sk.name}」Lv${lv} 發動，DEX/AGI提升 ${Math.round(mult * 100)}%！`);
      recomputeDerived(false);
      break;
    }
    case 'buff_flatstat': {
      // 大聲吶喊：STR/ATK 固定加成（實際套用在 recomputeDerived()），隊伍效果暫不支援
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      const strBonus = Array.isArray(sk.strBonus) ? sk.strBonus[lv - 1] : (sk.strBonus || 0);
      const flatBonus = mult; // mult 存的是 ATK 固定加成
      state.buffs.push({ type: 'flatstat', mult: 1, strBonus, flatBonus, msRemaining: dur * 1000, skillId: sk.id });
      logMsg(`📢 「${sk.name}」Lv${lv} 發動，STR+${strBonus}、ATK+${flatBonus}！`);
      recomputeDerived(false);
      break;
    }
    case 'buff_gold': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'gold', mult, msRemaining: dur * 1000 });
      logMsg(`💰 「${sk.name}」Lv${lv} 發動，掉錢增加！`);
      break;
    }
    case 'buff_crit': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'crit', mult, msRemaining: dur * 1000 });
      logMsg(`🎯 「${sk.name}」Lv${lv} 發動，暴擊率上升！`);
      break;
    }
    case 'debuff_def': {
      if (!state.monsters || state.monsters.length === 0) break;
      const target = state.monsters[0];
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      target.debuffDef = mult;
      target.debuffDefEnd = Date.now() + dur * 1000;
      logMsg(`🔥 「${sk.name}」Lv${lv} 發動，敵人防禦下降！`);
      break;
    }
  }
  saveGame();
  return true;
}

// 在城鎮安全區休息時，HP/SP每秒都會被townRestore()自動補滿：
// 此時自動施放會消耗HP的技能，或只對治療/場域/戰鬥才有意義的技能，
// 只會造成「扣了又馬上補回」的無謂消耗與畫面閃爍，故休息時應跳過
function wastesResourceInTown(sk, lv) {
  if (!isInTown()) return false;
  const hpCostCheck = Array.isArray(sk.hpCost) ? sk.hpCost[lv - 1] : sk.hpCost;
  if (hpCostCheck > 0) return true;
  return ['heal', 'heal_over_time', 'field_heal', 'field_aoe_magic', 'stun_field', 'multi_dot_stun', 'debuff_def', 'debuff'].includes(sk.type);
}

function tryAutoCastSkill() {
  if (!state.autoSkillConfig) state.autoSkillConfig = { skillId: null, mode: 'once', spThreshold: 30, skillId2: null, spThreshold2: 50, monsterCount2: 2 };

  const config = state.autoSkillConfig;
  const spPct = (state.sp / state.maxSp) * 100;
  const monsterCount = state.monsters ? state.monsters.length : 0;

  // 兩招都沒有設定時，回退到自動施放第一個可用技能
  if (!config.skillId && !config.skillId2) {
    const allJobs = getAllLearnedJobs();
    for (const jobId of allJobs) {
      const job = JOB_TREE[jobId];
      if (!job) continue;
      for (const sk of job.skills) {
        const lv = state.learnedSkills[sk.id];
        if (!lv) continue;
        if (!skillReady(sk.id)) continue;
        const spCost = Array.isArray(sk.spCost) ? sk.spCost[lv - 1] : sk.spCost;
        if (state.sp < spCost) continue;
        const isAttack = ['damage', 'magic', 'dot', 'damage_multihit', 'damage_multi', 'damage_aoe', 'magic_aoe', 'poison_proc'].includes(sk.type);
        if (isAttack && monsterCount === 0) continue;
        if (wastesResourceInTown(sk, lv)) continue;
        castSkill(sk.id);
        return;
      }
    }
    return;
  }

  // 第一招：SP 達到門檻 + 有怪物就施放
  if (config.skillId) {
    const sk = findSkillById(config.skillId);
    if (sk) {
      const lv = state.learnedSkills[sk.id];
      if (lv && skillReady(sk.id)) {
        const spCost = Array.isArray(sk.spCost) ? sk.spCost[lv - 1] : sk.spCost;
        const isAttack = ['damage', 'magic', 'dot', 'damage_multihit', 'damage_multi', 'damage_aoe', 'magic_aoe', 'poison_proc'].includes(sk.type);
        if (state.sp >= spCost && spPct >= config.spThreshold && !wastesResourceInTown(sk, lv)) {
          if (!isAttack || monsterCount > 0) {
            castSkill(sk.id);
            return;
          }
        }
      }
    }
  }

  // 第二招：SP 達到門檻 + 怪物數量達到門檻才施放
  if (config.skillId2) {
    const sk2 = findSkillById(config.skillId2);
    if (sk2) {
      const lv2 = state.learnedSkills[sk2.id];
      if (lv2 && skillReady(sk2.id)) {
        const spCost2 = Array.isArray(sk2.spCost) ? sk2.spCost[lv2 - 1] : sk2.spCost;
        if (state.sp >= spCost2 && spPct >= config.spThreshold2 && monsterCount >= config.monsterCount2 && !wastesResourceInTown(sk2, lv2)) {
          castSkill(sk2.id);
          return;
        }
      }
    }
  }
}

// 自動施放輔助技能
function tryAutoCastSupportSkills() {
  if (!state.autoSupportSkills) return;
  const allJobs = getAllLearnedJobs();
  for (const jobId of allJobs) {
    const job = JOB_TREE[jobId];
    if (!job) continue;
    for (const sk of job.skills) {
      if (!state.autoSupportSkills[sk.id]) continue;
      const lv = state.learnedSkills[sk.id];
      if (!lv) continue;
      if (!skillReady(sk.id)) continue;
      if (wastesResourceInTown(sk, lv)) continue;

      const spCost = Array.isArray(sk.spCost) ? sk.spCost[lv - 1] : sk.spCost;
      if (state.sp < spCost) continue;

      // Buff 類：如果已有相同類型 buff 則跳過（等 buff 消失後自動補）
      if (['buff_atk', 'buff_def', 'buff_aspd', 'buff_flee', 'buff_gold', 'buff_crit', 'buff_poison', 'buff_statpct', 'buff_flatstat', 'buff_maxroll', 'buff_blessing', 'buff_sprate', 'buff_lukflat', 'buff_holyweapon'].includes(sk.type)) {
        const buffType = sk.type.replace('buff_', '');
        if (state.buffs.some(b => b.type === buffType)) continue;
      }
      // 護盾類：耐久或次數尚未耗盡時跳過
      if (sk.type === 'buff_shield' && state.shields && state.shields.some(sh => sh.id === sk.id)) continue;
      // Debuff 類：需要有怪物
      if (['debuff_def', 'debuff'].includes(sk.type) && (!state.monsters || state.monsters.length === 0)) continue;
      // Heal 類：依技能自訂的HP%門檻觸發，並可設SP%下限保護
      if (sk.type === 'heal') {
        const healCfg = (state.autoHealConfig && state.autoHealConfig[sk.id]) || { hpThreshold: 70, spThreshold: 0 };
        if (state.hp > state.maxHp * ((healCfg.hpThreshold ?? 70) / 100)) continue;
        if (healCfg.spThreshold > 0 && state.sp < state.maxSp * (healCfg.spThreshold / 100)) continue;
      }

      castSkill(sk.id);
    }
  }

  // 偽裝連動：勾選了自動偽裝，且偽裝生效中時，自動施放無影之牙
  if (state.autoSupportSkills['cloaking']) {
    const cloakActive = state.buffs.some(b => b.type === 'flee' && b.skillId === 'cloaking');
    const gtLv = state.learnedSkills['grimtooth'];
    if (cloakActive && gtLv && skillReady('grimtooth') && state.monsters && state.monsters.length > 0) {
      const gtSk = findSkillById('grimtooth');
      const gtCost = Array.isArray(gtSk.spCost) ? gtSk.spCost[gtLv - 1] : gtSk.spCost;
      if (state.sp >= gtCost) castSkill('grimtooth');
    }
  }
}

// 取得所有已解鎖職業的技能（用於自動施放）
function getAllLearnedJobs() {
  const jobs = [];
  let cur = state.jobId;
  while (cur) {
    jobs.unshift(cur);
    cur = JOB_TREE[cur].parent;
  }
  return jobs;
}

// 計算所有已轉職職業的 job bonus 總和（累計繼承）
function computeJobBonuses() {
  const allJobs = getAllLearnedJobs();
  const totals = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
  for (const jobId of allJobs) {
    const jd = JOB_TREE[jobId];
    if (!jd || !jd.bonusLevels) continue;
    const jobLv = (jobId === state.jobId) ? state.jobLevel : (state.jobLevelHistory?.[jobId] || 0);
    for (const [stat, levels] of Object.entries(jd.bonusLevels)) {
      totals[stat] += levels.filter(lv => lv <= jobLv).length;
    }
  }
  return totals;
}

// 根據 ID 尋找技能（搜尋所有已解鎖職業）
function findSkillById(skillId) {
  const allJobs = getAllLearnedJobs();
  for (const jobId of allJobs) {
    const job = JOB_TREE[jobId];
    if (!job) continue;
    const sk = job.skills.find(s => s.id === skillId);
    if (sk) return sk;
  }
  return null;
}

/* ---------------- 轉職 ---------------- */
function canJobChange(targetId) {
  const job = currentJob();
  if (!job.next.includes(targetId)) return false;
  const target = JOB_TREE[targetId];
  // 基本條件：等級夠
  if (state.jobLevel < job.jobLevelMax || state.baseLevel < target.baseLevelReq) return false;
  // 技能點檢查：當前職業的技能點必須花完
  if (!state.jobSkillPoints) state.jobSkillPoints = {};
  if ((state.jobSkillPoints[state.jobId] || 0) > 0) return false;
  return true;
}

function doJobChange(targetId) {
  if (!canJobChange(targetId)) return false;
  const target = JOB_TREE[targetId];

  // 檢查當前職業的技能點是否已全部花完
  if (!state.jobSkillPoints) state.jobSkillPoints = {};
  const currentJobPoints = state.jobSkillPoints[state.jobId] || 0;
  if (currentJobPoints > 0) {
    logMsg(`⚠️ 你還有 ${currentJobPoints} 點 ${currentJob().name} 的技能點未使用，請先用完再轉職！`);
    return false;
  }

  // 記錄轉職前的技能（保留所有已學技能）
  const prevSkills = { ...state.learnedSkills };

  // 存舊職業的 jobLevel（職業加成跨職業繼承）
  if (!state.jobLevelHistory) state.jobLevelHistory = {};
  state.jobLevelHistory[state.jobId] = state.jobLevel;

  state.jobId = targetId;
  state.jobLevel = 1;
  state.jobExp = 0;

  if (!state.jobSkillPoints[targetId]) state.jobSkillPoints[targetId] = 0;
  state.skillPoints = Object.values(state.jobSkillPoints).reduce((a, b) => a + b, 0);

  // 自動習得新職業的任務技能
  target.skills.forEach(sk => {
    if (sk.isQuest && !state.learnedSkills[sk.id]) {
      state.learnedSkills[sk.id] = 1;
      logMsg(`自動習得任務技能：${sk.name}！`);
    }
  });

  // 確保所有已學技能都保留
  Object.keys(prevSkills).forEach(skId => {
    if (!state.learnedSkills[skId]) {
      state.learnedSkills[skId] = prevSkills[skId];
    }
  });

  recomputeDerived(true);
  logMsg(`🎊 恭喜！你轉職成為「${target.icon} ${target.name}」！`);
  if (typeof updatePlayerSprite === 'function') updatePlayerSprite();
  saveGame();
  return true;
}

/* ---------------- 道具 / 裝備 ---------------- */

/* ---------------- NPC 商店系統 ---------------- */
/* 基於 ro_npcshop_data，剔除不存在的物品 */
const NPC_SHOPS = {
  weapon: {
    name: '武器商人',
    icon: '⚔️',
    items: ['knife', 'cutter', 'main_gauche', 'dirk', 'dagger', 'stiletto', 'gladius', 'damascus', 'cinquedea', 'kindling_dagger', 'obsidian_dagger', 'item_1249', 'jujube_dagger', 'coward', 'sword', 'falchion', 'blade', 'lapier', 'tsurugi', 'haedonggum', 'saber', 'slayer', 'bastard_sword', 'two_hand_sword', 'broad_sword', 'spear', 'pike', 'lance', 'guisarme', 'glaive', 'halberd', 'axe', 'battle_axe', 'hammer', 'buster', 'two_handed_axe', 'club', 'mace', 'smasher', 'flail', 'morning_star', 'sword_mace', 'chain', 'stunner', 'bow', 'composite_bow', 'great_bow', 'cross_bow', 'arbalest', 'kakkung', 'hunter_bow', 'repeting_cross_bow', 'waghnakh', 'knuckle_duster', 'hora', 'fist', 'claw', 'finger', 'violin', 'mandolin', 'lute', 'guitar', 'harp', 'guh_moon_goh',
      // 箭矢：弓箭手系列的消耗品，跟弓放同一家店
      'arrow', 'iron_arrow', 'steel_arrow', 'silver_arrow', 'fire_arrow', 'crystal_arrow', 'arrow_of_wind', 'stone_arrow'],
    getItems() {
      return this.items.filter(id => {
        const item = ITEMS[id];
        if (!item) return false;
        if (item.reqLevel && state.baseLevel < item.reqLevel) return false;
        return true;
      });
    }
  },
  item: {
    name: '道具商人',
    icon: '🧪',
    // 補HP藥水、精煉材料、攻速藥水；SP 只賣藍水（1000z），其餘回SP道具靠打怪掉
    items: ['red_potion', 'orange_potion', 'yellow_potion', 'white_potion',
            'blue_potion',
            'refine_stone',
            'center_potion', 'awakening_potion', 'berserk_potion'],
    getItems() {
      return this.items.filter(id => ITEMS[id]);
    }
  },
  armor: {
    name: '防具商人',
    icon: '🛡️',
    items: ['flu_mask', 'granpa_beard', 'hood', 'muffler', 'manteau', 'novice_manteau', 'cotton_shirt', 'leather_jacket', 'adventure_suit', 'mantle', 'coat', 'padded_armor', 'chain_mail', 'plate_armor', 'silk_robe', 'scapulare', 'saint_robe', 'wooden_mail', 'tights', 'silver_robe', 'thief_clothes', 'wedding_dress', 'novice_breast', 'full_plate_armor', 'guard', 'buckler', 'shield', 'mirror_shield', 'novice_shield', 'arm_guard', 'sandals', 'shoes', 'boots', 'grave', 'novice_shoes', 'rosary', 'skul_ring', 'flower_ring', 'diamond_ring', 'belt', 'novice_armlet', 'wedding_veil', 'ribbon', 'bandana', 'biretta', 'hat', 'turban', 'cap', 'helm', 'gemmed_sallet', 'circlet', 'super_novice_hat', 'fedora', 'sunglasses', 'glasses', 'item_2205', 'eye_bandage', 'one_eyed_glass', 'luxury_sunglasses', 'spinning_eyes', 'goggle', 'blue_coif'],
    getItems() {
      return this.items.filter(id => {
        const item = ITEMS[id];
        if (!item) return false;
        if (item.reqLevel && state.baseLevel < item.reqLevel) return false;
        return true;
      });
    }
  }
};

// NPC 商店開在地圖分頁裡（只有安全區的地圖才會有入口），不再有獨立的 NPC 分頁
function openNpcShop(shopId) {
  const shop = NPC_SHOPS[shopId];
  if (!shop) return;
  if (!isInTown()) return;
  const items = shop.getItems();
  const el = document.getElementById('tab-map');
  if (!el) return;

  // Group items by type
  const grouped = {};
  items.forEach(id => {
    const item = ITEMS[id];
    let category = '其他';
    if (item.type === 'weapon') {
      const weaponType = item.weaponType || 'sword';
      const typeNames = { dagger: '短劍', sword: '劍', tsword: '雙手劍', bow: '弓', rod: '法杖', mace: '鈍器', katar: '拳刃', spear: '長矛', knuckle: '拳套' };
      category = typeNames[weaponType] || weaponType;
    } else if (item.type === 'armor') {
      const armorType = item.armorType || 'cloth';
      const typeNames = { cloth: '衣服', leather: '皮甲', shield: '盾牌', garment: '披風', footgear: '鞋子', accessory: '飾品' };
      category = typeNames[armorType] || armorType;
    } else if (item.aspdPct) {
      category = '攻速藥水';
    } else if (item.restoreSp) {
      category = 'SP 回復';
    } else if (item.heal) {
      category = 'HP 回復';
    } else if (REFINEMENT_MATERIALS[id]) {
      category = '精煉材料';
    }
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(id);
  });

  let html = `<div class="npc-shop">
    <div class="npc-shop-header">
      <button class="btn-small" onclick="renderMapTab()">← 返回地圖</button>
      <h3 class="panel-title">${shop.icon} ${shop.name}</h3>
    </div>`;

  Object.keys(grouped).forEach(category => {
    html += `<div class="shop-category">
      <h4 class="shop-category-title">${category}</h4>
      <div class="shop-items">`;
    grouped[category].forEach(id => {
      const item = ITEMS[id];
      const qty = getItemQty(id);
      const canAfford = state.gold >= item.buyPrice;
      html += `<div class="shop-row ${canAfford ? '' : 'shop-cannot-afford'}">
        <div class="shop-item-info">
          <span class="shop-item-icon">${item.icon}</span>
          <div class="shop-item-details">
            <span class="shop-item-name">${item.name}${item.element ? ' ' + ELEMENT_ICONS[item.element] : ''}</span>
            <span class="shop-item-stats">${item.atk ? 'ATK ' + item.atk : ''}${item.matk ? 'MATK ' + item.matk : ''}${item.def ? 'DEF ' + item.def : ''}${item.element ? ' [' + ELEMENT_NAMES[item.element] + ']' : ''}</span>
          </div>
        </div>
        <div class="shop-item-actions">
          <span class="shop-item-price">${item.buyPrice} 💰</span>
          <span class="shop-item-owned">持有 ${qty}</span>
          <button class="btn-small" ${canAfford ? '' : 'disabled'} onclick="buyItem('${id}',1);openNpcShop('${shopId}');renderTopBar();">購買</button>
        </div>
      </div>`;
    });
    html += '</div></div>';
  });

  html += '</div>';
  el.innerHTML = html;
}

/* ---------------- 城鎮恢復 ---------------- */
function isInTown() {
  const map = currentMap();
  return map && map.monsters.length === 0;
}

function townRestore() {
  if (!isInTown()) return;
  if (state.hp < state.maxHp || state.sp < state.maxSp) {
    state.hp = state.maxHp;
    state.sp = state.maxSp;
    logMsg('🏠 你在城鎮中休息，HP 與 SP 已完全恢復！');
  }
}
// 註：背包裡「個體裝備」是獨立一行（帶 instanceId），跟普通堆疊分開；
// 所有按 itemId 找堆疊的地方都要排除個體行，否則會誤動到那一件獨立裝備。
function addItem(itemId, qty) {
  const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
  if (row) row.qty += qty; else state.inventory.push({ item: itemId, qty });
  codexRecordItem(itemId, qty);
}
function removeItem(itemId, qty) {
  const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
  if (!row) return false;
  row.qty -= qty;
  if (row.qty <= 0) state.inventory = state.inventory.filter(r => !(r.item === itemId && !r.instanceId));
  return true;
}
function useItem(itemId) {
  const def = ITEMS[itemId];
  const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
  if (!def || !row) return false;
  if (def.type === 'consumable' || def.type === 'material') {
    // 攻速藥水：不是回復類，直接掛一個 aspd buff。先擋職業/等級限制
    if (def.aspdPct) {
      const block = aspdPotionBlockReason(itemId);
      if (block) { logMsg(`⚠️ ${def.name}：${block}。`); return false; }
      const dur = def.aspdDuration || 1800;
      // 同類型只留一個，避免疊到爆
      state.buffs = state.buffs.filter(b => b.type !== 'aspd' || !b.fromPotion);
      state.buffs.push({ type: 'aspd', mult: 1 + def.aspdPct / 100, msRemaining: dur * 1000, fromPotion: true });
      removeItem(itemId, 1);
      recomputeDerived(false);
      logMsg(`🧪 使用了 ${def.name}，攻速 +${def.aspdPct}%（${Math.round(dur / 60)} 分鐘）。`);
      saveGame();
      return true;
    }
    // HP 與 SP 要各自判斷：蜂蜜／蜂膠／天地樹果實這類是兩種都回，不能用 else if
    let healed = false;
    if (def.heal) {
      // 快速恢復：HP恢復道具效果加成
      const boostedHeal = Math.round(def.heal * (1 + (state.hpItemEffectBonusPct || 0) / 100));
      state.hp = Math.min(state.maxHp, state.hp + boostedHeal);
      healed = true;
    }
    if (def.restoreSp) {
      // 禪心：SP恢復道具效果+10%~100%
      const boosted = Math.round(def.restoreSp * (1 + (state.spItemEffectBonusPct || 0) / 100));
      state.sp = Math.min(state.maxSp, state.sp + boosted);
      healed = true;
    }
    if (!healed) {
      // 從描述中推斷回復量（背包道具/食材類）
      const desc = def.desc || '';
      const hpMatch = desc.match(/恢復(\d+)/) || desc.match(/恢复(\d+)/);
      if (hpMatch) {
        state.hp = Math.min(state.maxHp, state.hp + parseInt(hpMatch[1]));
      } else if (desc.includes('恢復') || desc.includes('恢复')) {
        // 無具體數值的回復道具，預設恢復 50 HP
        state.hp = Math.min(state.maxHp, state.hp + 50);
      }
    }
    removeItem(itemId, 1);
    logMsg(`使用了 ${def.name}。`);
    saveGame();
    return true;
  }
  if (def.type === 'weapon' || def.type === 'armor') {
    equipItem(itemId);
    return true;
  }
  return false;
}
// 決定某個道具會裝到哪個欄位；equipItem（普通堆疊）跟 equipInstance（個體裝備）共用同一套判斷
function resolveEquipSlotFor(itemId) {
  const def = ITEMS[itemId];
  if (!def) return null;

  let slot;
  if (def.type === 'weapon') {
    if (isTwoHanded(itemId)) {
      slot = 'weapon';
    } else if (!state.equip.weapon) {
      slot = 'weapon';
    } else if (canDualWield(state.jobId) && !isTwoHanded(getEquipBaseItemId('weapon'))) {
      // 主手已有單手武器，且職業支援雙持 → 放入左手（副手武器）
      slot = 'shield';
    } else {
      slot = 'weapon';
    }
  } else if (def.type === 'armor') {
    switch (def.armorType) {
      case 'headgear': {
        // 根據物品描述中的「位置」決定頭部欄位（兼容簡繁體）
        const pos = def.desc || '';
        const hasTop = pos.includes('頭上') || pos.includes('头上');
        const hasMid = pos.includes('頭中') || pos.includes('头中');
        const hasBot = pos.includes('頭下') || pos.includes('头下');
        if (hasTop && !hasMid && !hasBot) slot = 'head_top';
        else if (hasMid && !hasTop && !hasBot) slot = 'head_mid';
        else if (hasBot && !hasTop && !hasMid) slot = 'head_bottom';
        else if (hasTop && hasMid && !hasBot) { slot = !state.equip.head_top ? 'head_top' : 'head_mid'; }
        else if (hasMid && hasBot && !hasTop) { slot = !state.equip.head_mid ? 'head_mid' : 'head_bottom'; }
        else if (hasTop && hasMid && hasBot) {
          if (!state.equip.head_top) slot = 'head_top';
          else if (!state.equip.head_mid) slot = 'head_mid';
          else if (!state.equip.head_bottom) slot = 'head_bottom';
          else slot = 'head_top';
        }
        else slot = 'head_top';
        break;
      }
      case 'shield': slot = 'shield'; break;
      case 'garment': slot = 'garment'; break;
      case 'footgear': slot = 'footgear'; break;
      case 'accessory':
        if (!state.equip.accessory1) slot = 'accessory1';
        else if (!state.equip.accessory2) slot = 'accessory2';
        else slot = 'accessory1';
        break;
      default: slot = 'armor'; break;
    }
  } else {
    return null;
  }
  return slot;
}

/* ---------------- 裝備限制 ----------------
   兩道關卡：
   1. reqJob（道具自己寫的職業限制）—— 用整條職業鏈比對，二轉能穿一轉的裝備
   2. 官方攻速表 —— 表裡沒有這種武器分類就是這個職業不能拿
      （初心者表裡沒有 bow → 新手不能拿弓；法師只有 dagger/rod → 不能拿劍與弓）
   還有等級限制 reqLevel。回傳 null 表示可以裝，否則回傳擋下來的原因。
------------------------------------------------- */
function equipBlockReason(itemId) {
  const d = ITEMS[itemId];
  if (!d) return '道具不存在。';
  if (d.reqLevel && state.baseLevel < d.reqLevel) {
    return `需要基本等級 ${d.reqLevel}（目前 ${state.baseLevel}）。`;
  }
  if (d.reqJob && d.reqJob.length) {
    const chain = getAllLearnedJobs();
    if (!chain.some(j => d.reqJob.includes(j))) {
      return `${currentJob().name}無法裝備這件道具。`;
    }
  }
  if (d.type === 'weapon' && !jobCanUseWeapon(state.jobId, itemId)) {
    // WEAPON_TYPE_LABELS 定義在 ui.js，引擎單獨跑（測試）時可能不存在
    const label = (typeof WEAPON_TYPE_LABELS !== 'undefined' && WEAPON_TYPE_LABELS[d.weaponType]) || '這類武器';
    return `${currentJob().name}不能使用${label}。`;
  }
  return null;
}

// 裝備前的共通檢查與讓位處理；回傳 false 表示不能裝
function prepareEquipSlot(slot, itemId) {
  // 雙手武器：裝備時自動卸下左手欄位（盾牌或副手武器）
  if (slot === 'weapon' && isTwoHanded(itemId) && state.equip.shield) {
    const offName = getItemDisplayName(getEquipBaseItemId('shield'));
    returnEquipToInventory('shield');
    logMsg(`雙手武器無法搭配左手裝備，卸下了 ${offName}。`);
  }
  // 左手欄位：如果目前武器是雙手武器，無法裝備
  if (slot === 'shield' && isTwoHanded(getEquipBaseItemId('weapon'))) {
    logMsg(`⚠️ 雙手武器無法搭配盾牌！`);
    return false;
  }
  return true;
}

function equipItem(itemId) {
  const def = ITEMS[itemId];
  if (!def) return false;
  const block = equipBlockReason(itemId);
  if (block) { logMsg(`⚠️ ${block}`); return false; }
  const slot = resolveEquipSlotFor(itemId);
  if (!slot) return false;
  if (!prepareEquipSlot(slot, itemId)) return false;

  removeItem(itemId, 1);
  returnEquipToInventory(slot);   // 原本穿的那件（不管普通或個體）連同它的精煉/卡片一起回背包
  state.equip[slot] = itemId;
  recomputeDerived(false);
  logMsg(`裝備了 ${def.name}。`);
  saveGame();
  return true;
}

// 裝備背包裡的個體裝備（精煉過或插過卡的那一件）
function equipInstance(instanceId) {
  const inst = state.instances && state.instances[instanceId];
  if (!inst) return false;
  if (state.inventory.findIndex(r => r.instanceId === instanceId) === -1) return false;
  const itemId = inst.item;
  const def = ITEMS[itemId];
  if (!def) return false;
  const block = equipBlockReason(itemId);
  if (block) { logMsg(`⚠️ ${block}`); return false; }
  const slot = resolveEquipSlotFor(itemId);
  if (!slot) return false;
  if (!prepareEquipSlot(slot, itemId)) return false;

  // 讓位可能動到背包，重新定位這一行再移除
  const idx = state.inventory.findIndex(r => r.instanceId === instanceId);
  if (idx !== -1) state.inventory.splice(idx, 1);
  returnEquipToInventory(slot);
  state.equip[slot] = instanceId;
  recomputeDerived(false);
  logMsg(`裝備了 ${describeInstance(inst)}。`);
  saveGame();
  return true;
}

function unequipItem(slotKey) {
  if (!state.equip[slotKey]) return false;
  const baseItemId = getEquipBaseItemId(slotKey);
  const def = ITEMS[baseItemId];
  // 插著卡也能正常卸下——卡片是跟著這一件裝備走的，會一起回到背包，不會變成孤兒
  returnEquipToInventory(slotKey);
  recomputeDerived(false);
  logMsg(`卸下了 ${def ? def.name : '裝備'}。`);
  saveGame();
  return true;
}

/* ---------------- 原石合成 ----------------
   神之金屬原石 ×5 → 神之金屬、鋁原石 ×5 → 鋁。免費，隨時可做。
------------------------------------------------- */
function canSynthesizeOre(key) {
  const r = ORE_SYNTHESIS[key];
  return !!r && getItemQty(r.from) >= r.need;
}
function synthesizeOre(key) {
  const r = ORE_SYNTHESIS[key];
  if (!r) return false;
  if (getItemQty(r.from) < r.need) {
    logMsg(`⚠️ ${ITEMS[r.from].name} 不足 ${r.need} 個。`);
    return false;
  }
  removeItem(r.from, r.need);
  addItem(r.to, 1);
  logMsg(`⚒️ ${ITEMS[r.from].name} ×${r.need} 合成出 ${ITEMS[r.to].name} ×1！`);
  saveGame();
  return true;
}

/* ---------------- 裝備精煉 ---------------- */
// 注意：操作對象是「裝備欄位」，精煉結果掛在那一件裝備的個體紀錄上，跟背包裡同名的其他份無關
function refineItem(slotKey, materialType) {
  const itemId = getEquipBaseItemId(slotKey);
  if (!itemId) return false;
  const currentLevel = getRefinementLevel(slotKey);
  if (currentLevel >= REFINEMENT_MAX) {
    logMsg(`⚠️ ${ITEMS[itemId].name} 已達最大精煉等級 +${REFINEMENT_MAX}！`);
    return false;
  }

  const item = ITEMS[itemId];
  const isArmor = item.type === 'armor';
  const weaponLv = isArmor ? 0 : (item.weaponLv || 1);

  // 檢查材料是否適用
  const mat = REFINEMENT_MATERIALS[materialType];
  if (!mat) { logMsg('⚠️ 無效的精煉材料。'); return false; }
  if (isArmor && !mat.usableArmor) { logMsg(`⚠️ ${mat.name} 不能用於防具精煉。`); return false; }
  if (!isArmor && !mat.usableWeaponLv.includes(weaponLv)) {
    logMsg(`⚠️ ${mat.name} 不能用於 Lv${weaponLv} 武器精煉。`);
    return false;
  }

  // 檢查材料庫存
  const invRow = state.inventory.find(r => r.item === mat.id && !r.instanceId);
  if (!invRow || invRow.qty < 1) {
    logMsg(`⚠️ 你沒有 ${mat.name}。`);
    return false;
  }

  const cost = getRefinementCost(currentLevel);
  if (state.gold < cost) {
    logMsg(`⚠️ 鋅幣不足，精煉需要 ${cost.toLocaleString()} 鋅幣。`);
    return false;
  }

  // 扣除材料和費用
  removeItem(mat.id, 1);
  state.gold -= cost;

  // 計算成功率
  const successRate = getRefinementSuccessRate(currentLevel, weaponLv, materialType);
  const safeLevel = getRefinementSafeLevel(weaponLv, isArmor);
  const inst = state.instances[getOrCreateEquipInstance(slotKey)];

  if (Math.random() * 100 < successRate) {
    // 成功
    inst.refine = currentLevel + 1;
    logMsg(`🔨 精煉成功！${item.name} 提升至 +${currentLevel + 1}！`);
    recomputeDerived(false);
    saveGame();
    return true;
  } else {
    // 失敗
    const penalty = getRefinementFailPenalty(materialType);
    if (penalty === 'none') {
      // 以太礦石：無懲罰
      logMsg(`💥 精煉失敗！${item.name} 維持 +${currentLevel}。${mat.name}保護了裝備！`);
    } else if (currentLevel >= safeLevel) {
      // 安全等級以上：降3級或損壞
      if (currentLevel > 3) {
        inst.refine = Math.max(0, currentLevel - 3);
        logMsg(`💥 精煉失敗！${item.name} 降至 +${Math.max(0, currentLevel - 3)}…`);
      } else {
        // +3 以下直接損壞
        inst.refine = 0;
        logMsg(`💥 精煉失敗！${item.name} 損壞了！`);
      }
    } else {
      // 安全等級以下：不降級
      logMsg(`💥 精煉失敗！${item.name} 維持 +${currentLevel}。`);
    }
    maybeDeinstanceSlot(slotKey);
    recomputeDerived(false);
    saveGame();
    return false;
  }
}

// 注意：精煉度掛在裝備欄位（透過個體紀錄），參數是 slotKey 不是 itemId
function getRefinementLevel(slot) {
  const inst = getEquipInstance(slot);
  return inst ? (inst.refine || 0) : 0;
}

/* ---------------- 怪物卡片系統 ----------------
   state.equippedCards = { 裝備欄位: [卡片id, ...] }
   一個欄位可以插多張卡，張數上限по該件裝備自己的 slots 欄位（武器常見 1~3 孔）。
   卡片資料的 slot 欄位決定它能插在哪些欄位，對照表見 CARD_SLOT_TARGETS。
------------------------------------------------- */

// 卡片的 slot → 允許插入的裝備欄位
const CARD_SLOT_TARGETS = {
  weapon: ['weapon'],
  armor: ['armor'],
  shield: ['shield'],
  headgear: ['head_top', 'head_mid', 'head_bottom'],
  garment: ['garment'],
  footgear: ['footgear'],
  accessory: ['accessory1', 'accessory2'],
  any: ['weapon', 'head_top', 'head_mid', 'head_bottom', 'armor', 'shield', 'garment', 'footgear', 'accessory1', 'accessory2']
};
const EQUIP_SLOT_NAMES = {
  weapon: '武器', head_top: '頭上', head_mid: '頭中', head_bottom: '頭下', armor: '身體',
  shield: '左手', garment: '披風', footgear: '鞋子', accessory1: '飾品1', accessory2: '飾品2'
};

function cardFitsSlot(card, equipSlot) {
  const targets = CARD_SLOT_TARGETS[card.slot] || CARD_SLOT_TARGETS.any;
  return targets.includes(equipSlot);
}
function cardSlotLabel(card) {
  const targets = CARD_SLOT_TARGETS[card.slot] || CARD_SLOT_TARGETS.any;
  if (card.slot === 'any') return '任意部位';
  return targets.map(t => EQUIP_SLOT_NAMES[t] || t).join('／');
}

// 取得某欄位已插的卡片陣列（卡片存在該件裝備的個體紀錄裡，跟著裝備走）
function getEquippedCards(slot) {
  const inst = getEquipInstance(slot);
  return (inst && inst.cards) ? inst.cards : [];
}
// 舊介面：回傳第一張，仍有呼叫端在用
function getEquippedCard(slot) {
  const list = getEquippedCards(slot);
  return list.length ? list[0] : null;
}
// 全身已插的卡片，攤平成一維
function allEquippedCards() {
  const out = [];
  EQUIP_SLOTS_ALL.forEach(slot => {
    getEquippedCards(slot).forEach(id => { if (id) out.push(id); });
  });
  return out;
}
// 個體裝備的顯示字串：「+7 短劍 [3]（🃏波利卡片、瘋兔卡片）」
function describeInstance(inst) {
  if (!inst) return '';
  const name = getItemDisplayName(inst.item);
  const ref = inst.refine > 0 ? `+${inst.refine} ` : '';
  const cards = (inst.cards && inst.cards.length)
    ? `（🃏${inst.cards.map(id => CARDS[id] ? CARDS[id].name : id).join('、')}）` : '';
  return `${ref}${name}${cards}`;
}

function insertCard(equipSlot, cardId) {
  const card = CARDS[cardId];
  if (!card) return false;

  // 卡片本身不會被個體化，只找普通堆疊
  const invRow = state.inventory.find(r => r.item === cardId && !r.instanceId);
  if (!invRow || invRow.qty < 1) {
    logMsg(`⚠️ 你沒有這張卡片。`);
    return false;
  }
  const baseItemId = getEquipBaseItemId(equipSlot);
  if (!baseItemId) {
    logMsg(`⚠️ 該欄位沒有裝備。`);
    return false;
  }
  // 卡片只能插在資料指定的部位
  if (!cardFitsSlot(card, equipSlot)) {
    logMsg(`⚠️ ${card.name} 只能插在${cardSlotLabel(card)}。`);
    return false;
  }

  // 插卡數量上限 = 該件裝備自己的孔數
  const maxSlots = getEquipCardSlots(equipSlot);
  if (maxSlots <= 0) {
    logMsg(`⚠️ ${ITEMS[baseItemId].name} 沒有卡片插槽。`);
    return false;
  }
  const cur = getEquippedCards(equipSlot);
  if (cur.length >= maxSlots) {
    logMsg(`⚠️ ${ITEMS[baseItemId].name} 的 ${maxSlots} 個插槽已經滿了。`);
    return false;
  }

  removeItem(cardId, 1);
  const inst = state.instances[getOrCreateEquipInstance(equipSlot)];
  if (!inst.cards) inst.cards = [];
  inst.cards.push(cardId);
  logMsg(`🃏 將 ${card.name} 插入了${ITEMS[baseItemId].name}（${inst.cards.length}/${maxSlots}）！`);
  recomputeDerived(false);
  saveGame();
  return true;
}

/* 拔卡：卡片可以取回，但裝備會在拆卸過程中損毀。
   這是刻意的取捨——沒有代價的話插卡就變成隨時可換的免費設定，
   卡片的選擇也就不成為決定。呼叫端必須自己先跟玩家確認。 */
// 拆「身上穿著」那件的卡：裝備連同精煉度一起銷毀，卡片全部取回。cardIndex 已無意義（一律全取回），保留參數只為相容舊呼叫。
function removeCard(equipSlot, cardIndex) {
  const ref = state.equip[equipSlot];
  const inst = getEquipInstance(equipSlot);
  const cur = getEquippedCards(equipSlot);
  if (!cur.length) {
    logMsg(`⚠️ 該欄位沒有插卡片。`);
    return false;
  }
  const equipName = ITEMS[inst.item] ? ITEMS[inst.item].name : '裝備';
  cur.forEach(id => { if (CARDS[id]) addItem(id, 1); });
  const names = cur.map(id => CARDS[id] ? CARDS[id].name : id).join('、');

  state.equip[equipSlot] = null;
  delete state.instances[ref];
  logMsg(`💥 ${equipName} 在拆卸過程中損毀了！取回了 ${names}。`);
  recomputeDerived(false);
  saveGame();
  return true;
}

// 拆「背包裡」那件個體裝備的卡：同樣是銷毀裝備換回卡片
function destroyInstanceForCards(instanceId) {
  const idx = state.inventory.findIndex(r => r.instanceId === instanceId);
  const inst = state.instances && state.instances[instanceId];
  if (idx === -1 || !inst) return false;
  const cur = inst.cards || [];
  if (!cur.length) {
    logMsg(`⚠️ 這件裝備沒有插卡片。`);
    return false;
  }
  const equipName = ITEMS[inst.item] ? ITEMS[inst.item].name : '裝備';
  cur.forEach(id => { if (CARDS[id]) addItem(id, 1); });
  const names = cur.map(id => CARDS[id] ? CARDS[id].name : id).join('、');

  state.inventory.splice(idx, 1);
  delete state.instances[instanceId];
  logMsg(`💥 ${equipName} 在拆卸過程中損毀了！取回了 ${names}。`);
  recomputeDerived(false);
  saveGame();
  return true;
}

function getCardBonus(stat) {
  let total = 0;
  allEquippedCards().forEach(cardId => {
    const card = CARDS[cardId];
    if (card && card.bonus && card.bonus[stat]) {
      total += card.bonus[stat];
    }
  });
  return total;
}
/* ---------------- 道具鎖定 ----------------
   鎖定只擋「會讓道具消失」的操作：賣出、全部賣出、自動販賣、露天商店。
   存倉庫不擋——東西還在，取得回來，鎖定的用意是防手滑賣掉珍品，不是禁止搬動。
------------------------------------------------- */
function isItemLocked(itemId) {
  return !!(state.lockedItems && state.lockedItems[itemId]);
}
function toggleItemLock(itemId) {
  if (!state.lockedItems) state.lockedItems = {};
  if (state.lockedItems[itemId]) {
    delete state.lockedItems[itemId];
    logMsg(`🔓 已解除 ${getItemDisplayName(itemId)} 的鎖定。`);
  } else {
    state.lockedItems[itemId] = 1;
    logMsg(`🔒 已鎖定 ${getItemDisplayName(itemId)}，不會被賣出或自動販賣。`);
    // 鎖定時順手從自動販賣清單移除，免得兩個設定互相矛盾
    if (state.autoSellConfig && state.autoSellConfig.items) {
      state.autoSellConfig.items = state.autoSellConfig.items.filter(id => id !== itemId);
    }
  }
  saveGame();
  return true;
}

function sellItem(itemId, qty) {
  const def = ITEMS[itemId];
  const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
  if (!def || !row || row.qty < qty) return false;
  if (isItemLocked(itemId)) {
    logMsg(`🔒 ${def.name} 已鎖定，無法賣出。請先解除鎖定。`);
    return false;
  }
  removeItem(itemId, qty);
  const unitPrice = Math.round(def.sell * (state.shopOverchargeMult || 1));
  const total = unitPrice * qty;
  state.gold += total;
  logMsg(`賣出 ${def.name} x${qty}，獲得 ${total} 鋅幣。`);
  saveGame();
  return true;
}
function sellItemAll(itemId) {
  const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
  if (!row || row.qty < 1) return false;
  return sellItem(itemId, row.qty);
}
// 賣掉背包裡一件個體裝備；插在上面的卡片會跟著消失（要留卡請先用「拆卸取回卡片」）
function sellItemInstance(instanceId) {
  const idx = state.inventory.findIndex(r => r.instanceId === instanceId);
  const inst = state.instances && state.instances[instanceId];
  if (idx === -1 || !inst) return false;
  const def = ITEMS[inst.item];
  if (!def) return false;
  if (isItemLocked(inst.item)) {
    logMsg(`🔒 ${def.name} 已鎖定，無法賣出。請先解除鎖定。`);
    return false;
  }
  const label = describeInstance(inst);
  state.inventory.splice(idx, 1);
  delete state.instances[instanceId];
  const price = Math.round(def.sell * (state.shopOverchargeMult || 1));
  state.gold += price;
  logMsg(`賣出 ${label}，獲得 ${price} 鋅幣。`);
  saveGame();
  return true;
}

/* ---------------- 自動販賣：玩家勾選的道具，每30秒(或手動)自動以原價賣出全部 ---------------- */
const AUTO_SELL_INTERVAL_MS = 30 * 1000;
function toggleAutoSellItem(itemId) {
  if (!state.autoSellConfig) state.autoSellConfig = { enabled: false, items: [] };
  const idx = state.autoSellConfig.items.indexOf(itemId);
  if (idx >= 0) state.autoSellConfig.items.splice(idx, 1);
  else {
    if (isItemLocked(itemId)) {
      logMsg(`🔒 ${getItemDisplayName(itemId)} 已鎖定，無法加入自動販賣。`);
      return;
    }
    state.autoSellConfig.items.push(itemId);
  }
  saveGame();
}
function setAutoSellEnabled(v) {
  if (!state.autoSellConfig) state.autoSellConfig = { enabled: false, items: [] };
  state.autoSellConfig.enabled = !!v;
  state.autoSellReadyAt = Date.now() + AUTO_SELL_INTERVAL_MS;
  saveGame();
}
// 立即執行一次自動販賣（不受30秒週期限制，並重新計時）
function runAutoSellNow() {
  const sold = autoSellSelectedItems();
  state.autoSellReadyAt = Date.now() + AUTO_SELL_INTERVAL_MS;
  saveGame();
  return sold;
}
function autoSellSelectedItems() {
  if (!state.autoSellConfig || !state.autoSellConfig.items || state.autoSellConfig.items.length === 0) return false;
  let soldAny = false;
  let totalGold = 0;
  state.autoSellConfig.items.forEach(itemId => {
    const def = ITEMS[itemId];
    const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
    if (!def || !row || row.qty < 1) return;
    if (isItemLocked(itemId)) return;   // 鎖定的道具自動販賣一律跳過
    const qty = row.qty;
    removeItem(itemId, qty);
    const price = Math.round(def.sell * (state.shopOverchargeMult || 1)) * qty;
    state.gold += price;
    totalGold += price;
    soldAny = true;
  });
  if (soldAny) logMsg(`🏷️ 自動販賣賣出了選定道具，獲得 ${totalGold} 鋅幣！`);
  return soldAny;
}
function tryAutoSell() {
  if (!state.autoSellConfig) state.autoSellConfig = { enabled: false, items: [] };
  if (!state.autoSellConfig.enabled) return;
  const readyAt = state.autoSellReadyAt || 0;
  if (Date.now() < readyAt) return;
  state.autoSellReadyAt = Date.now() + AUTO_SELL_INTERVAL_MS;
  if (autoSellSelectedItems()) saveGame();
}

/* ---------------- 露天商店：選定道具後自動定時以倍率販售 ---------------- */
function setVendingItems(itemIds) {
  state.vendingConfig = { items: (itemIds || []).slice(0, 3) };
  saveGame();
}
function tryAutoVending() {
  if (state.jobId !== 'merchant') return;
  if (!state.learnedSkills || !state.learnedSkills['vending']) return;
  if (!state.vendingConfig || !state.vendingConfig.items || state.vendingConfig.items.length === 0) return;
  const readyAt = state.vendingReadyAt || 0;
  if (Date.now() < readyAt) return;

  const sk = findSkillById('vending');
  const cdSec = sk.internalCooldown || 60;
  const sellMult = sk.sellMultiplier || 10;
  state.vendingReadyAt = Date.now() + cdSec * 1000;

  let soldAny = false;
  state.vendingConfig.items.forEach(itemId => {
    const def = ITEMS[itemId];
    const row = state.inventory.find(r => r.item === itemId && !r.instanceId);
    if (!def || !row || row.qty < 1) return;
    if (isItemLocked(itemId)) return;   // 鎖定的道具露天商店也不賣
    removeItem(itemId, 1);
    const price = Math.round(def.sell * sellMult);
    state.gold += price;
    logMsg(`🏪 露天商店賣出了 ${def.name}，獲得 ${price} 鋅幣！`);
    soldAny = true;
  });
  if (soldAny) saveGame();
}

/* ---------------- 鐵匠鍛造系統 ---------------- */
const CRAFT_SUBTYPE_MATERIALS = {
  dagger:   { iron: 3, steel: 1 },
  sword1h:  { iron: 5, steel: 2 },
  sword2h:  { iron: 8, steel: 3 },
  axe1h:    { iron: 5, steel: 2 },
  axe2h:    { iron: 8, steel: 3 },
  knuckle:  { iron: 4, steel: 1 },
  mace:     { iron: 5, steel: 2 },
  spear1h:  { iron: 6, steel: 2 },
  spear2h:  { iron: 9, steel: 3 },
};
const CRAFT_SUBTYPE_CATEGORY = {
  dagger: 'dagger', sword1h: 'sword', sword2h: 'sword', axe1h: 'axe', axe2h: 'axe',
  knuckle: 'knuckle', mace: 'mace', spear1h: 'spear', spear2h: 'spear',
};
const CRAFT_ELEMENT_STONE = { wind: 'gemstone_wind', water: 'gemstone_water', fire: 'gemstone_fire', earth: 'gemstone_earth' };
const CRAFT_ZENY_COST = 10000;
const CRAFT_CATEGORY_NAMES = { dagger: '短劍', sword: '劍', axe: '斧頭', knuckle: '拳套', mace: '鈍器', spear: '長矛' };
const CRAFT_SUBTYPE_NAMES = { dagger: '短劍', sword1h: '單手劍', sword2h: '雙手劍', axe1h: '單手斧頭', axe2h: '雙手斧頭', knuckle: '拳套', mace: '鈍器', spear1h: '單手長矛', spear2h: '雙手長矛' };
const CRAFT_ELEMENT_NAMES = { wind: '風', water: '水', fire: '火', earth: '地' };

// 鍛造成功率：基礎15% + DEX(滿120給+20%) + LUK(滿120給+10%) + 神之金屬研究加成
function getCraftingSuccessChance() {
  const dexBonus = Math.min(20, (state.stats.dex || 0) / 120 * 20);
  const lukBonus = Math.min(10, (state.stats.luk || 0) / 120 * 10);
  return 15 + dexBonus + lukBonus + (state.craftBonusPct || 0);
}

// 掃描帳號內所有存檔欄位，找出鐵匠角色名字：剛好1位就用他的名字，2位以上顯示「某人」
function getAccountBlacksmithName() {
  const names = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    try {
      const raw = localStorage.getItem(getSlotKey(i));
      if (!raw) continue;
      const s = JSON.parse(raw);
      if (s && s.jobId === 'blacksmith' && s.name) names.push(s.name);
    } catch (e) { /* 忽略壞檔 */ }
  }
  if (names.length === 0) return '鐵匠';
  if (names.length === 1) return names[0];
  return '某人';
}

// 取得道具顯示名稱：鐵匠鍛造武器會自動加上「XX製作的」前綴
function getItemDisplayName(itemId) {
  const def = ITEMS[itemId];
  if (!def) return itemId;
  if (typeof itemId !== 'string' || !itemId.startsWith('crafted_')) return def.name;
  return getAccountBlacksmithName() + '製作的' + def.name;
}

function craftWeapon(subtype, element) {
  const category = CRAFT_SUBTYPE_CATEGORY[subtype];
  if (!category || !state.unlockedCraftCategories.includes(category)) {
    logMsg('⚠️ 尚未學會這個鍛造技能！');
    return false;
  }
  const stoneId = CRAFT_ELEMENT_STONE[element];
  const mat = CRAFT_SUBTYPE_MATERIALS[subtype];
  if (!stoneId || !mat) return false;

  if (getItemQty('iron') < mat.iron || getItemQty('steel') < mat.steel || getItemQty(stoneId) < 1) {
    logMsg('⚠️ 材料不足，無法鍛造！');
    return false;
  }
  if (state.gold < CRAFT_ZENY_COST) {
    logMsg('⚠️ 鋅幣不足，無法鍛造！');
    return false;
  }

  // 消耗材料（不論成功與否）
  removeItem('iron', mat.iron);
  removeItem('steel', mat.steel);
  removeItem(stoneId, 1);
  state.gold -= CRAFT_ZENY_COST;

  const chance = getCraftingSuccessChance();
  const success = Math.random() * 100 < chance;
  if (success) {
    const itemId = 'crafted_' + subtype + '_' + element;
    addItem(itemId, 1);
    logMsg(`🔨 鍛造成功！獲得了 ${getItemDisplayName(itemId)}！`);
  } else {
    logMsg('🔨 鍛造失敗了……材料已經消耗。');
  }
  saveGame();
  return success;
}

/* ---------------- 原料鍛造（鐵/鋼/屬性原石）---------------- */
const MATERIAL_CRAFT_ZENY_COST = 500;
const MATERIAL_CRAFT_SUCCESS_CHANCE = 50;
const MATERIAL_CRAFT_RECIPES = {
  iron:        { unlockCategory: 'iron',  consume: [{ item: 'iron_ore', qty: 1 }],                              result: 'iron' },
  steel:       { unlockCategory: 'steel', consume: [{ item: 'iron', qty: 5 }, { item: 'coal', qty: 1 }],        result: 'steel' },
  stone_fire:  { unlockCategory: 'stone', consume: [{ item: 'boody_red', qty: 10 }],                            result: 'gemstone_fire' },
  stone_water: { unlockCategory: 'stone', consume: [{ item: 'crystal_blue', qty: 10 }],                         result: 'gemstone_water' },
  stone_wind:  { unlockCategory: 'stone', consume: [{ item: 'wind_of_verdure', qty: 10 }],                      result: 'gemstone_wind' },
  stone_earth: { unlockCategory: 'stone', consume: [{ item: 'yellow_live', qty: 10 }],                          result: 'gemstone_earth' },
};

function craftMaterial(kind) {
  const recipe = MATERIAL_CRAFT_RECIPES[kind];
  if (!recipe) return false;
  if (!state.unlockedMaterialCrafts.includes(recipe.unlockCategory)) {
    logMsg('⚠️ 尚未學會這個鍛造技能！');
    return false;
  }
  for (const c of recipe.consume) {
    if (getItemQty(c.item) < c.qty) {
      logMsg('⚠️ 材料不足，無法鍛造！');
      return false;
    }
  }
  if (state.gold < MATERIAL_CRAFT_ZENY_COST) {
    logMsg('⚠️ 鋅幣不足，無法鍛造！');
    return false;
  }

  // 消耗材料（不論成功與否）
  recipe.consume.forEach(c => removeItem(c.item, c.qty));
  state.gold -= MATERIAL_CRAFT_ZENY_COST;

  const success = Math.random() * 100 < MATERIAL_CRAFT_SUCCESS_CHANCE;
  if (success) {
    addItem(recipe.result, 1);
    logMsg(`🔨 鍛造成功！獲得了 ${ITEMS[recipe.result].name}！`);
  } else {
    logMsg('🔨 鍛造失敗了……材料已經消耗。');
  }
  saveGame();
  return success;
}

/* ---------------- 地圖切換 ---------------- */
function changeMap(mapId) {
  const map = MAPS.find(m => m.id === mapId);
  if (!map) return false;
  state.mapId = mapId;
  ensureCodex().maps[mapId] = 1; // 探索成就用
  state.monsters = [];
  state.monster = null;
  logMsg(`前往「${map.name}」。`);
  spawnMonster();
  saveGame();
  return true;
}

/* ---------------- MVP 模式切換 ---------------- */
function toggleMvpMode(enabled) {
  state.mvpMode = enabled;
  logMsg(enabled ? '🎯 MVP 模式已開啟，Boss 可能隨時降臨！' : 'MVP 模式已關閉。');
  saveGame();
}

/* ---------------- 存讀檔 ---------------- */
let lastSaveTs = 0;
function saveGameThrottled() {
  if (Date.now() - lastSaveTs > 5000) saveGame();
}
function saveGame() {
  if (!state) return;
  try {
    state.lastActiveAt = Date.now();
    localStorage.setItem(getSlotKey(currentSlot), JSON.stringify(state));
    lastSaveTs = Date.now();
  } catch (e) { /* 儲存失敗時靜默略過，不中斷遊戲 */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(getSlotKey(currentSlot));
    if (!raw) return false;
    state = JSON.parse(raw);
    if (!state.lastActiveAt) state.lastActiveAt = Date.now();
    if (!state.autoPotion) state.autoPotion = { enabled: true, primary: '', fallback: 'red_potion', hpThreshold: 50 };
    if (typeof state.autoPotion.hpThreshold !== 'number') state.autoPotion.hpThreshold = 50;
    // 舊版 tier 欄位遷移
    if (state.autoPotion.tier && !state.autoPotion.fallback) {
      state.autoPotion.fallback = state.autoPotion.tier;
      delete state.autoPotion.tier;
    }
    if (typeof state.autoBuyPotion !== 'boolean') state.autoBuyPotion = true;
    if (typeof state.autoBuyArrow !== 'boolean') state.autoBuyArrow = true;
    if (!state.autoSpPotion) state.autoSpPotion = { enabled: false, primary: '', fallback: 'blue_potion', spThreshold: 30 };
    if (typeof state.autoSpPotion.spThreshold !== 'number') state.autoSpPotion.spThreshold = 30;
    if (typeof state.autoBuySpPotion !== 'boolean') state.autoBuySpPotion = false;
    if (!state.autoAspdPotion) state.autoAspdPotion = { enabled: false, items: [] };
    if (!Array.isArray(state.autoAspdPotion.items)) state.autoAspdPotion.items = [];
    if (typeof state.autoBuyAspdPotion !== 'boolean') state.autoBuyAspdPotion = false;
    if (typeof state.muted !== 'boolean') state.muted = false;
    // 圖鑑遷移：舊存檔沒有紀錄，至少把背包/裝備裡現有的東西補登為「已取得」，
    // 免得老角色開圖鑑看到一片空白
    if (!state.codex) {
      state.codex = { mon: {}, seen: {}, item: {}, maps: {} };
      (state.inventory || []).forEach(r => { state.codex.item[r.item] = r.qty; });
      Object.values(state.equip || {}).forEach(id => { if (id) state.codex.item[id] = state.codex.item[id] || 1; });
      allEquippedCards().forEach(id => { state.codex.item[id] = state.codex.item[id] || 1; });
    }
    if (!state.codex.maps) state.codex.maps = {};
    if (state.mapId) state.codex.maps[state.mapId] = 1; // 至少把現在站的地圖算進去
    if (typeof state.deaths !== 'number') state.deaths = 0;
    if (!state.achievements) state.achievements = { done: {}, points: 0 };
    if (!state.lockedItems) state.lockedItems = {};
    if (!state.autoSkillConfig) state.autoSkillConfig = { skillId: null, mode: 'once', spThreshold: 30, skillId2: null, spThreshold2: 50, monsterCount2: 2 };
    if (!state.autoSkillConfig.skillId2) state.autoSkillConfig.skillId2 = null;
    if (!state.autoSkillConfig.spThreshold2) state.autoSkillConfig.spThreshold2 = 50;
    if (!state.autoSkillConfig.monsterCount2) state.autoSkillConfig.monsterCount2 = 2;
    if (!state.autoSupportSkills) state.autoSupportSkills = {};
    if (!state.autoHealConfig) state.autoHealConfig = {};
    // 多怪物系統遷移
    if (!state.monsters) state.monsters = [];
    if (!state.maxMonsters) state.maxMonsters = 5;
    if (!state.monsterIdCounter) state.monsterIdCounter = 0;
    if (!state.encounterMode) state.encounterMode = 'melee';
    if (!state.lastSpawnTime) state.lastSpawnTime = 0;
    // 如果舊存檔有 state.monster 但沒有 state.monsters，遷移過來
    if (state.monster && state.monsters.length === 0) {
      state.monsters = [state.monster];
      state.monster = state.monsters[0];
    }
    // 技能點遷移：如果沒有 jobSkillPoints，從全域 skillPoints 初始化
    if (!state.jobSkillPoints) {
      state.jobSkillPoints = {};
      if (state.skillPoints > 0) {
        state.jobSkillPoints[state.jobId] = state.skillPoints;
      }
    }
    // 同步全域技能點
    state.skillPoints = Object.values(state.jobSkillPoints).reduce((a, b) => a + b, 0);
    if (!state.lastAttackTime) state.lastAttackTime = Date.now();
    state.lastAttackTime = Date.now(); // 防止離線時間差造成爆量攻擊
    if (!state.attackAccumulator) state.attackAccumulator = 0;
    state.attackAccumulator = 0;

    // Migration: add new equip slots if missing
    if (!state.equip) state.equip = {};
    if (!state.equip.head_top) state.equip.head_top = null;
    if (!state.equip.head_mid) state.equip.head_mid = null;
    if (!state.equip.head_bottom) state.equip.head_bottom = null;
    if (!state.equip.shield) state.equip.shield = null;
    if (!state.equip.garment) state.equip.garment = null;
    if (!state.equip.footgear) state.equip.footgear = null;
    if (!state.equip.accessory1) state.equip.accessory1 = null;
    if (!state.equip.accessory2) state.equip.accessory2 = null;
    if (!state.equip.ammo) state.equip.ammo = null;
    if (!state.equipSkin) state.equipSkin = 'grid';
    if (!state.refinement) state.refinement = {};
    if (!state.equippedCards) state.equippedCards = {};
    if (!state.instances) state.instances = {};
    // 卡片改成一欄位多張後，舊存檔的單張字串要正規化成陣列；
    // 順便丟掉插在不合法部位的卡（早期沒有部位檢查，可能插錯地方），卡片退回背包不沒收
    Object.keys(state.equippedCards).forEach(slot => {
      const v = state.equippedCards[slot];
      if (!v) { delete state.equippedCards[slot]; return; }
      let list = Array.isArray(v) ? v.slice() : [v];
      const kept = [];
      list.forEach(id => {
        const card = CARDS[id];
        if (!card) return;                                   // 卡片已不存在
        if (!cardFitsSlot(card, slot)) { addItem(id, 1); return; }
        kept.push(id);
      });
      const max = state.equip[slot] ? getEquipCardSlots(slot) : 0;
      while (kept.length > max) addItem(kept.pop(), 1);       // 超過孔數的退回背包
      if (kept.length) state.equippedCards[slot] = kept; else delete state.equippedCards[slot];
    });
    // Migration：舊存檔的精煉度掛在itemId、卡片掛在欄位，改成掛在「那一件裝備」的個體紀錄上
    (function migrateEquipToInstances() {
      let n = 0;
      EQUIP_SLOTS_ALL.forEach(slot => {
        const cur = state.equip[slot];
        if (!cur || state.instances[cur]) return;   // 空欄位或已經是個體
        const legacyRefine = state.refinement[cur] || 0;
        const legacyCards = state.equippedCards[slot] || [];
        if (legacyRefine > 0 || legacyCards.length) {
          const id = cur + '#mig' + Date.now() + '_' + (n++);
          state.instances[id] = { item: cur, refine: legacyRefine, cards: legacyCards.slice() };
          state.equip[slot] = id;
          delete state.equippedCards[slot];
        }
      });
    })();

    // Migration: convert old boolean learnedSkills to level format
    if (state.learnedSkills) {
      Object.keys(state.learnedSkills).forEach(k => {
        if (state.learnedSkills[k] === true) {
          state.learnedSkills[k] = 1; // convert boolean to level 1
        }
      });
    }

    // Migration: 清理不存在的怪物引用
    if (state.monsters && state.monsters.length > 0) {
      state.monsters = state.monsters.filter(m => MONSTERS[m.defId]);
      if (state.monsters.length === 0) {
        state.monster = null;
      } else {
        state.monster = state.monsters[0];
      }
    }
    if (state.monster && !MONSTERS[state.monster.defId]) {
      state.monster = null;
      state.monsters = [];
    }

    recomputeDerived(false);
    return true;
  } catch (e) {
    console.error('loadGame error:', e);
    return false;
  }
}

/* ---------------- 離線掛機結算 ----------------
   回傳結算摘要（若離線時間太短則回傳 null），並直接把結果套用到 state 上。
------------------------------------------------- */
function computeOfflineProgress() {
  if (!state) return null;
  const rawElapsed = Date.now() - (state.lastActiveAt || Date.now());
  const elapsedMs = Math.min(rawElapsed, OFFLINE_CAP_MS);
  if (elapsedMs < OFFLINE_MIN_MS) { state.lastActiveAt = Date.now(); return null; }
  const elapsedSec = Math.floor(elapsedMs / 1000);

  const map = currentMap();
  const pool = map.monsters; // [{id, weight}]

  if (!pool.length) {
    // 城鎮安全區：沒有怪物可打，離線期間只是安穩休息，沒有戰鬥收穫
    state.lastActiveAt = Date.now();
    saveGame();
    return { elapsedMs, elapsedSec, expGained: 0, jobExpGained: 0, goldGained: 0, itemsGained: [], baseLevelUps: 0, jobLevelUps: 0, kills: 0, safeTown: true };
  }

  const totalWeight = pool.reduce((s, m) => s + m.weight, 0);
  const wAvg = (getter) => {
    let total = 0;
    let weightSum = 0;
    pool.forEach(m => {
      const mon = MONSTERS[m.id];
      if (mon) {
        total += getter(mon) * m.weight;
        weightSum += m.weight;
      }
    });
    return weightSum > 0 ? total / weightSum : 0;
  };
  const avgHp = wAvg(m => m.hp || 100);
  const avgDef = wAvg(m => m.def || 0);
  const avgExp = wAvg(m => m.exp || 1);
  const avgJobExp = wAvg(m => m.jobExp || 1);
  const avgLevel = wAvg(m => m.level || 1);

  // 離線掛機估算的是普通攻擊傷害，官方規則普通攻擊一律用物理ATK（同playerAttack()的修正）
  const raw = state.atk;
  const critFactor = 1 + (state.critRate / 100) * 0.5;
  const hasDmgSkill = currentJob().skills.some(sk => state.learnedSkills[sk.id] && ['damage', 'magic', 'dot'].includes(sk.type));
  const skillFactor = hasDmgSkill ? 1.15 : 1.0; // 有主動傷害技能時，離線效率略為提升
  const avgFlee = 80 + avgLevel * 4; // 對應 monsterFleeOf 的平均值
  const avgHitPct = hitChancePct(effectiveHitWithBuff(), avgFlee) / 100;
  const dmgPerAttack = mitigateDamage(raw * critFactor * skillFactor, avgDef) * avgHitPct;

  const killsPerSec = dmgPerAttack / avgHp;
  const totalKills = killsPerSec * elapsedSec;

  const expGained = Math.round(avgExp * totalKills);
  const jobExpGained = Math.round(avgJobExp * totalKills);
  const goldGained = Math.round((3 + avgLevel * 1.4) * totalKills);

  // 掉落物期望值（依真實怪物密度權重計算每次擊殺的期望掉落機率）
  const dropAgg = {};
  pool.forEach(m => {
    const def = MONSTERS[m.id];
    if (!def) return; // 跳過不存在的怪物
    const spawnShare = m.weight / totalWeight;
    (def.drops || []).forEach(d => {
      const perKillChance = d.chance * spawnShare;
      dropAgg[d.item] = (dropAgg[d.item] || 0) + perKillChance;
    });
  });
  const itemsGained = [];
  Object.keys(dropAgg).forEach(itemId => {
    const expected = dropAgg[itemId] * totalKills;
    let qty = Math.floor(expected);
    if (Math.random() < (expected - qty)) qty++;
    if (qty > 0) { addItem(itemId, qty); itemsGained.push({ item: itemId, qty }); }
  });

  // 離線擊殺也要記進圖鑑，依出沒權重分配到各怪物；掛機一整晚回來圖鑑卻沒動會很奇怪
  pool.forEach(m => {
    if (!MONSTERS[m.id]) return;
    const share = Math.floor(totalKills * (m.weight / totalWeight));
    if (share > 0) codexRecordKill(m.id);
    if (share > 1) ensureCodex().mon[m.id] += share - 1;
  });

  const beforeBaseLv = state.baseLevel;
  const beforeJobLv = state.jobLevel;
  gainExp(expGained, jobExpGained);
  state.gold += goldGained;
  state.lastActiveAt = Date.now();
  state.lastAttackTime = Date.now();
  state.attackAccumulator = 0;
  state.lastMonsterAttackTime = Date.now();
  saveGame();

  return {
    elapsedMs, elapsedSec,
    expGained, jobExpGained, goldGained,
    itemsGained,
    baseLevelUps: state.baseLevel - beforeBaseLv,
    jobLevelUps: state.jobLevel - beforeJobLv,
    kills: Math.round(totalKills)
  };
}
function hasSave() {
  return !!localStorage.getItem(getSlotKey(currentSlot));
}
function deleteSave() {
  localStorage.removeItem(getSlotKey(currentSlot));
}
function hasAnySave() {
  for (let i = 0; i < MAX_SLOTS; i++) {
    if (localStorage.getItem(getSlotKey(i))) return true;
  }
  return false;
}

/* ---------------- 訊息紀錄 ---------------- */
function logMsg(text) {
  combatLogBuf.push(text);
  if (combatLogBuf.length > 60) combatLogBuf.shift();
  if (typeof renderLog === 'function') renderLog();

  // 傷害飄字（僅玩家攻擊時在怪物頭上顯示）
  if (typeof showDamageFloat === 'function') {
    const dmgMatch = text.match(/造成 (\d+) 點傷害/);
    // 只有玩家攻擊（以"你"開頭）才在怪物頭上顯示飄字
    if (dmgMatch && text.startsWith('你')) {
      const dmg = dmgMatch[1];
      const isCrit = text.includes('暴擊');
      const elemGood = text.includes('屬性克制');
      const elemBad = text.includes('屬性被克');
      const elemImmune = text.includes('屬性免疫');
      let type = 'normal';
      if (isCrit) type = 'crit';
      else if (elemGood) type = 'element-good';
      else if (elemBad) type = 'element-bad';
      else if (elemImmune) type = 'element-immune';
      showDamageFloat('-' + dmg, type);
      if (typeof triggerMonsterHit === 'function') triggerMonsterHit(isCrit);
      // 玩家攻擊動畫
      const playerSprite = document.getElementById('player-sprite');
      if (playerSprite) {
        playerSprite.classList.remove('attacking');
        void playerSprite.offsetWidth;
        playerSprite.classList.add('attacking');
      }
    }
    const healMatch = text.match(/恢復了 (\d+) 點/);
    if (healMatch) {
      showDamageFloat('+' + healMatch[1], 'heal');
    }
    if (text.includes('擊敗了') && typeof triggerMonsterDie === 'function') {
      triggerMonsterDie();
    }
  }
}
