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
    dpsTracker: { since: Date.now(), damage: 0, exp: 0, jobExp: 0, gold: 0, kills: 0 },
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
// 只有真的弓要箭。樂器在本作的 weaponType 也是 'bow'（分類壓縮的產物），
// 但官方樂器是詩人專用、不吃箭，所以這裡要看還原後的官方分類而不是 weaponType。
function isBowWeapon(itemId) {
  return aspdCategoryOf(itemId) === 'bow';
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
  const mult = pct !== undefined ? pct / 100 : 1;
  // 海盜之王卡片：無視體型修正，一律照 100% 打（只補到 1，本來就超過 1 的不會被壓下來）
  if (state.cardIgnoreSizePenalty) return Math.max(1, mult);
  return mult;
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
  const weaponLv = w ? getRefineWeaponLv(w) : 1;
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
    const offWeaponLv = getRefineWeaponLv(offItem);
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

/* buff 是誰給的。大部分 buff 身上有 skillId，查得到就用技能名，
   查不到才退回一個看得懂的中文標籤（總比畫面上出現 "statpct" 好）。 */
const BUFF_TYPE_LABELS = {
  blessing: '天使之賜福', flatstat: '大聲吶喊', agiflat: '加速術',
  lukflat: '幸運之頌歌', statpct: '心神凝聚'
};
function buffSourceLabel(b) {
  if (b.skillId && typeof findSkillById === 'function') {
    const sk = findSkillById(b.skillId);
    if (sk) return sk.name;
  }
  return BUFF_TYPE_LABELS[b.type] || b.type;
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

  /* 素質加成一律記帳到 skillSrc/buffSrc，角色分頁才有辦法把「這 +10 是哪來的」列出來。
     沒有這份帳，鶚梟之眼的 DEX+10、心神凝聚的 DEX/AGI% 都只會默默混進戰鬥數值，
     玩家在角色分頁完全看不到數字，會以為技能沒效果。 */
  const skillFlat = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
  const buffFlat  = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 };
  const skillSrc = {}, buffSrc = {};
  const addSrc = (bag, flat, stat, v, name) => {
    if (!v) return;
    flat[stat] += v;
    (bag[stat] = bag[stat] || []).push({ name, v });
  };

  // 被動技能 STR/INT/DEX 固定加成（必須在衍生數值計算之前，避免直接修改 state.stats 導致膨脹）
  const passiveJobsEarly = getAllLearnedJobs();
  for (const jid of passiveJobsEarly) {
    const jd = JOB_TREE[jid];
    if (!jd) continue;
    jd.skills.forEach(sk => {
      const lv = state.learnedSkills[sk.id];
      if (!lv || sk.type !== 'passive') return;
      const label = `${sk.name} Lv${lv}`;
      if (sk.passiveStat === 'dexFlat') {
        const val = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
        addSrc(skillSrc, skillFlat, 'dex', Math.round(val), label);
      } else if (sk.passiveStat === 'triStatBonus') {
        // 物品鑑定：STR/INT/DEX 同時加成
        const val = Math.round(Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult);
        addSrc(skillSrc, skillFlat, 'str', val, label);
        addSrc(skillSrc, skillFlat, 'int', val, label);
        addSrc(skillSrc, skillFlat, 'dex', val, label);
      }
      // 武器保有：附加固定STR加成
      if (sk.strBonus) {
        const sb = Array.isArray(sk.strBonus) ? sk.strBonus[lv - 1] : sk.strBonus;
        addSrc(skillSrc, skillFlat, 'str', Math.round(sb), label);
      }
      // 怪物情報：附加固定INT加成
      if (sk.intBonus) {
        const ib = Array.isArray(sk.intBonus) ? sk.intBonus[lv - 1] : sk.intBonus;
        addSrc(skillSrc, skillFlat, 'int', Math.round(ib), label);
      }
    });
  }

  // buff 類的固定加成：大聲吶喊(STR)、天使之賜福(STR/INT/DEX)、加速術(AGI)、幸運之頌歌(LUK)
  state.buffs.forEach(b => {
    const label = buffSourceLabel(b);
    if (b.type === 'flatstat' && b.strBonus) addSrc(buffSrc, buffFlat, 'str', b.strBonus, label);
    if (b.type === 'blessing') {
      addSrc(buffSrc, buffFlat, 'str', b.strBonus || 0, label);
      addSrc(buffSrc, buffFlat, 'int', b.intBonus || 0, label);
      addSrc(buffSrc, buffFlat, 'dex', b.dexBonus || 0, label);
    }
    if (b.type === 'agiflat') addSrc(buffSrc, buffFlat, 'agi', b.flatBonus || 0, label);
    if (b.type === 'lukflat') addSrc(buffSrc, buffFlat, 'luk', b.flatBonus || 0, label);
  });

  const passiveStrBonus = skillFlat.str + buffFlat.str;
  const passiveIntBonus = skillFlat.int + buffFlat.int;
  const passiveDexBonus = skillFlat.dex + buffFlat.dex;
  const buffAgiBonus = buffFlat.agi;
  const buffLukBonus = buffFlat.luk;
  state._passiveDexBonus = passiveDexBonus;

  // 心神凝聚buff：DEX/AGI 百分比加成（影響下面所有衍生自DEX/AGI的數值，含攻速）
  let buffStatPct = 0;
  const pctSrc = [];
  state.buffs.forEach(b => {
    if (b.type !== 'statpct') return;
    buffStatPct += b.mult;
    pctSrc.push({ name: buffSourceLabel(b), v: b.mult });
  });
  state._buffStatPct = buffStatPct;

  // ATK：官方有兩套 StatusATK 公式，弓／樂器／鞭以 DEX 為主屬性、STR 退為副屬性
  //   一般武器：STR + (STR/10)² + DEX/5 + LUK/5
  //   弓系武器：DEX + (DEX/10)² + STR/5 + LUK/5
  // （含職業加成與卡片加成）
  const cStr = s.str + jobBonus.str + getCardBonus('str') + equippedStatBonus('str') + passiveStrBonus;
  const cDex = Math.round((s.dex + jobBonus.dex + getCardBonus('dex') + equippedStatBonus('dex') + passiveDexBonus) * (1 + buffStatPct));
  const cLuk = s.luk + jobBonus.luk + getCardBonus('luk') + equippedStatBonus('luk') + buffLukBonus;
  const cAgi = Math.round((s.agi + jobBonus.agi + getCardBonus('agi') + equippedStatBonus('agi') + buffAgiBonus) * (1 + buffStatPct));
  const cVit = s.vit + jobBonus.vit + getCardBonus('vit') + equippedStatBonus('vit');
  const cInt = s.int + jobBonus.int + getCardBonus('int') + equippedStatBonus('int') + passiveIntBonus;
  /* 角色分頁要用的素質明細：base / 職業 / 裝備卡片 / 技能 / buff 各佔多少，
     以及百分比 buff 最後實際加了幾點（四捨五入後的差額，跟戰鬥用的數字一致）。 */
  const STAT_TOTALS = { str: cStr, agi: cAgi, vit: cVit, int: cInt, dex: cDex, luk: cLuk };
  state._statBreakdown = {};
  ['str', 'agi', 'vit', 'int', 'dex', 'luk'].forEach(k => {
    const gear = equippedStatBonus(k) + getCardBonus(k);
    const flat = s[k] + jobBonus[k] + gear + skillFlat[k] + buffFlat[k];
    state._statBreakdown[k] = {
      base: s[k],
      job: jobBonus[k],
      gear,
      skill: skillFlat[k],
      buff: buffFlat[k],
      pct: STAT_TOTALS[k] - flat,          // 心神凝聚之類的 % 加成實際多出來的點數
      pctSrc: (k === 'dex' || k === 'agi') ? pctSrc : [],
      skillSrc: skillSrc[k] || [],
      buffSrc: buffSrc[k] || [],
      total: STAT_TOTALS[k]
    };
  });

  const dexAtk = isDexAtkWeapon(getEquipBaseItemId('weapon'));
  const atkMain = dexAtk ? cDex : cStr;
  const atkSub = dexAtk ? cStr : cDex;
  const statusAtk = atkMain + Math.floor((atkMain / 10) ** 2) + Math.floor(atkSub / 5) + Math.floor(cLuk / 5);
  state._atkUsesDex = dexAtk;
  /* ATK 拆成三個桶子，總和仍然是 state.atk（其他地方照舊只讀 state.atk）。
     普通攻擊的傷害鏈要分開處理它們——官方的體型修正與屬性倍率**只作用在武器ATK**上：
       _atkWeapon   武器本體＋精煉＋箭矢＋裝備/卡片的 ATK 加成 → 吃體型、屬性、武器浮動
       _atkStatus   素質衍生的 ATK（STR/DEX 那條公式 × 職業係數） → 不吃
       _atkMastery  熟練度被動、大聲吶喊之類的固定加成 → 不吃（官方「熟練度無視體型懲罰」） */
  state._atkStatus = Math.round(statusAtk * job.atkMod);
  state._atkWeapon = equippedAtk();
  state._atkMastery = 0;
  state.atk = state._atkStatus + state._atkWeapon;
  // 大聲吶喊buff：ATK 固定加成（於狀態ATK算完後直接加）
  let buffAtkFlat = 0;
  state.buffs.forEach(b => { if (b.type === 'flatstat' && b.flatBonus) buffAtkFlat += b.flatBonus; });
  state.atk += buffAtkFlat;
  state._atkMastery += buffAtkFlat;

  // MATK：區間公式，min = INT+(INT/7)²，max = INT+(INT/5)²，取平均當戰鬥數值
  const matkMinRaw = cInt + Math.floor((cInt / 7) ** 2) + Math.floor(cDex / 5);
  const matkMaxRaw = cInt + Math.floor((cInt / 5) ** 2) + Math.floor(cDex / 5) + Math.floor(cLuk / 3);
  state.matkMin = Math.round(matkMinRaw * job.matkMod) + equippedMatk();
  state.matkMax = Math.round(matkMaxRaw * job.matkMod) + equippedMatk();
  state.matk = Math.round((state.matkMin + state.matkMax) / 2);

  /* DEF 拆成硬防與軟防，兩者的運算方式完全不同（官方 battle_calc_defense）：
       硬防（裝備DEF）→ 比例減傷 傷害 × (4000+硬防)/(4000+10×硬防)
       軟防（等級+VIT）→ 固定扣血，每一擊各扣一次
     `state.def` 只留給介面顯示（兩者相加），戰鬥一律讀 defHard / defSoft。 */
  state.defHard = equippedDef();
  state.defSoft = Math.floor((bl + cVit) / 2);   // 官方 renewal 的怪物軟防公式，玩家沿用同一條
  state.def = state.defHard + state.defSoft;

  /* 場上同時最多幾隻怪：一律由遇怪模式推導，不要用「取大值」的寫法累積。
     以前是 setEncounterMode() 直接寫值、被動技能再 Math.max 疊上去，只要疊過一次
     就再也降不回來——切到遠攻模式（該只有 1 隻）時會殘留近戰的數字。 */
  state.maxMonsters = state.encounterMode === 'remote' ? 1 : 5;

  // HIT / FLEE：經典 RO 常數公式
  state.hit = 175 + bl + cDex;
  state.flee = 100 + bl + cAgi;

  // 完全迴避（無視命中判定）與暴擊率（無視閃避判定）
  state.perfectDodge = Math.floor(cLuk / 10);
  state.critRate = Math.min(50, 4 + Math.floor(cLuk / 3));
  // 拳刃：暴擊率加倍（官方特性，也是刺客拿拳刃而不是雙短劍的主要理由）
  state._katarEquipped = isKatarWeapon(getEquipBaseItemId('weapon'));
  if (state._katarEquipped) state.critRate = Math.min(100, state.critRate * KATAR_CRIT_MULT);

  // ASPD 初始計算（不含 buff，buff 在 tick 時動態套用）
  // 官方計算機用的是「總 AGI/DEX」（含職業、裝備、卡片、buff），先寄存給 computeAspd() 用
  state._totalAgi = cAgi;
  state._totalDex = cDex;
  state._totalStr = cStr;   // 武器浮動用（官方 1 + STR/200 ± 武器等級×0.05）
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
          // 武器限定的熟練度（單手劍／雙手劍／拳刃／鈍器／長矛）：沒拿對武器就不加
          if (!weaponReqMet(sk.requiresWeapon)) break;
          // 天使之擊：官方效果限定對惡魔/不死種族生效，改成攻擊時依目標種族判定，不再全體適用
          if (sk.id === 'angelic') { state.angelicAtkBonus = Math.round(val); break; }
          state.atk += Math.round(val);
          state._atkMastery += Math.round(val);   // 熟練度加成不吃體型/屬性修正
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
          // 技能給的 DEF+N 當硬防（跟裝備同性質）；state.def 之後會重新加總
          state.defHard = (state.defHard || 0) + Math.round(val);
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
        /* 騎乘術：技能敘述寫的是「生怪速度+25%」，那條在 spawnMonster() 裡看 hasRiding
           判斷（補怪間隔 3000→2250ms、清場後 500→375ms），本來就有在作用。
           原本這裡還有一行 state.maxMonsters = Math.max(state.maxMonsters || 1, 1)，
           取大值跟 1 比永遠等於原值，是個從來沒生效過的空動作，已移除。
           沒有改成拉高同屏怪物數是刻意的：場上每一隻怪都會攻擊玩家（gameTick 的
           怪物攻擊迴圈是 forEach 全部），而玩家普攻只打 monsters[0]，
           拉高上限對單體流是純粹挨打，會把一個獎勵技能變成懲罰。 */
        case 'riding': state.hasRiding = true; break;
        case 'cavalierBonus': {
          state.flee += Math.round(val);
          if (sk.atkBonus) { const ab = Array.isArray(sk.atkBonus) ? sk.atkBonus[lv - 1] : sk.atkBonus; state.atk += Math.round(ab); state._atkMastery += Math.round(ab); }
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
          // 火柱攻擊在本作做成被動（普攻機率觸發），不走 castSkill，
          // 所以卡片的 skillDmg_firepillar 要在這裡自己套上去
          {
            const fpBonus = 1 + getCardBonus('skillDmg_' + sk.id) / 100;
            state.onAttackAoeFlatDmg = Math.round((Array.isArray(sk.flatDmg) ? sk.flatDmg[lv - 1] : (sk.flatDmg || 0)) * fpBonus);
            state.onAttackAoeMult = (Array.isArray(sk.mult) ? sk.mult[lv - 1] : (sk.mult || 0)) * fpBonus;
          }
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
  // 裝備與卡片的 ATK 算「裝備攻擊力」，跟武器本體同一桶，會吃體型與屬性修正
  const gearAtk = getCardBonus('atk') + equippedStatBonus('atk');
  state.atk += gearAtk;
  state._atkWeapon += gearAtk;
  state.matk += getCardBonus('matk') + equippedStatBonus('matk');
  state.matkMin += getCardBonus('matk') + equippedStatBonus('matk');
  state.matkMax += getCardBonus('matk') + equippedStatBonus('matk');
  // 卡片的 DEF+N 是裝備類加成，歸到硬防
  state.defHard += getCardBonus('def');
  state.def = state.defHard + state.defSoft;
  state.hit += getCardBonus('hit') + equippedStatBonus('hit');
  state.flee += getCardBonus('flee') + equippedStatBonus('flee');
  state.critRate = Math.min(100, state.critRate + getCardBonus('critRate') + equippedStatBonus('critRate'));
  state.perfectDodge += getCardBonus('perfectDodge') + equippedStatBonus('perfectDodge');
  state.maxHp += getCardBonus('hp') + equippedStatBonus('hp');
  state.maxSp += getCardBonus('sp') + equippedStatBonus('sp');

  // 卡片加成 — 百分比（負值也要吃，塔奧群卡那種有取捨的卡才成立）
  const hpPctBonus = getCardBonus('hpPct') / 100;
  if (hpPctBonus !== 0) {
    state.maxHp = Math.max(1, Math.round(state.maxHp * (1 + hpPctBonus)));
  }
  const spPctBonus = getCardBonus('spPct') / 100;
  if (spPctBonus !== 0) {
    state.maxSp = Math.max(1, Math.round(state.maxSp * (1 + spPctBonus)));
  }
  // 塔奧群卡片：MaxHP 翻倍但固定防減半。放在所有 DEF 來源加完之後才乘。
  const defPctBonus = getCardBonus('defPct') / 100;
  if (defPctBonus !== 0) {
    state.defHard = Math.max(0, Math.round(state.defHard * (1 + defPctBonus)));
    state.defSoft = Math.max(0, Math.round(state.defSoft * (1 + defPctBonus)));
  }
  state.def = state.defHard + state.defSoft;

  /* 戰鬥迴圈每次揮擊都會用到的卡片數值，先在這裡收斂成純量，
     免得每一擊都去掃一遍所有插槽的卡片 */
  state.cardCritDmgPct = getCardBonus('critDmgPct');
  state.cardBossDmgPct = getCardBonus('bossDmgPct');
  state.cardAllTargetDmgPct = getCardBonus('allTargetDmgPct');
  state.cardRangedDmgPct = getCardBonus('rangedDmgPct');
  state.cardIgnoreSizePenalty = getCardBonus('ignoreSizePenalty') > 0;
  state.cardBossDmgTakenPct = getCardBonus('bossDmgTakenPct');
  state.cardNormalDmgTakenPct = getCardBonus('normalDmgTakenPct');
  state.cardSpCostPct = getCardBonus('spCostPct');
  state.cardRangedCritRate = getCardBonus('rangedCritRate');
  state.cardLifeStealChance = getCardBonus('lifeStealChance');
  state.cardLifeStealPct = getCardBonus('lifeStealPct');
  state.cardSpStealChance = getCardBonus('spStealChance');
  state.cardSpStealPct = getCardBonus('spStealPct');

  // 卡片加成 — 對特定目標的加傷/減傷（存入 state 供戰鬥使用）
  //   eleDmg_X / raceDmg_X / sizeDmg_X       ：打「屬性X / 種族X / 體型X」的怪時增傷
  //   eleReduce_X / raceDmgReduce_X          ：被「屬性X / 種族X」的怪打時減傷
  state.cardEleDmgBonus = {};
  state.cardRaceDmgBonus = {};
  state.cardSizeDmgBonus = {};
  state.cardEleDmgReduce = {};
  state.cardRaceDmgReduce = {};
  state.cardSizeDmgReduce = {};
  state.cardFamilyDmgBonus = {}; // 打某個魔物家族時增傷（哥布靈族、獸人族…）
  state.cardMonsterDmgBonus = {}; // 指名單一隻怪的增傷（熔岩巨石卡片）
  state.cardRaceCrit = {};      // 對某種族的 CRI 加點（點數，不是%）
  state.cardExpRace = {};       // 擊殺某種族的經驗加成（比例）
  state.cardSpOnKillRace = {};  // 近戰擊殺某種族回復的 SP（點數）
  state.itemHealBonus = {};     // 指定道具的回復量加成（道具id → %）
  state.ailResist = {};         // 玩家的異常狀態抗性（狀態 → %，100 以上＝免疫）
  // 自動念咒與異常狀態：都依觸發時機分籃，戰鬥時直接取用不必再掃卡片
  state.cardAutoSpells = { attack: [], hit: [] };
  state.cardAilments = { attack: [], hit: [], magic: [] };
  state.cardKillDrops = [];
  {
    const lo = buildLoadout();
    lo.cards.forEach(cardId => {
      const c = CARDS[cardId];
      if (!c) return;
      // 條件式的那幾條（精煉、職業、同時裝了哪張卡、素質門檻）共用 condMet()
      const pass = e => {
        if (!e.when) return true;
        const host = (lo.cardHosts[cardId] || [])[0] || null;
        return condMet(e.when, host, lo);
      };
      (c.autoSpell || []).forEach(e => {
        // 自動念咒也可以帶條件（例：鴞裊首領要跟鴞裊男爵一起裝備才會放雷擊術）
        if (!pass(e)) return;
        const bucket = state.cardAutoSpells[e.on];
        if (bucket) bucket.push(e);
      });
      (c.ailment || []).forEach(e => {
        if (!pass(e)) return;
        const bucket = state.cardAilments[e.on];
        if (bucket) bucket.push(e);
      });
      (c.killDrop || []).forEach(e => { if (pass(e)) state.cardKillDrops.push(e); });
    });
  }
  state.cardHpRegenPct = 0;
  state.cardSpRegenPct = 0;
  // 黑蛇卡片：賦予二刀連擊，且不受「只有短劍能觸發」的限制
  state.hasSideWinderDoubleAttack = allEquippedCards().includes('side_winder_card');
  const CARD_BONUS_MAPS = {
    'eleDmg_': 'cardEleDmgBonus',
    'raceDmg_': 'cardRaceDmgBonus',
    'sizeDmg_': 'cardSizeDmgBonus',
    'familyDmg_': 'cardFamilyDmgBonus',
    'monDmg_': 'cardMonsterDmgBonus',
    'eleReduce_': 'cardEleDmgReduce',
    'raceDmgReduce_': 'cardRaceDmgReduce',
    'sizeDmgReduce_': 'cardSizeDmgReduce'
  };
  {
    // 卡片無條件加成、條件成立的加成、依精煉倍增的加成、以及套裝加成，
    // 在 effectiveGearBonuses() 就已經合併成一張表了，這裡只負責分流到各個桶子
    for (const [k, v] of Object.entries(effectiveGearBonuses())) {
      if (k === 'hpRegenPct') { state.cardHpRegenPct += v; continue; }
      if (k === 'spRegenPct') { state.cardSpRegenPct += v; continue; }
      // 這兩個不是「打某種怪時的傷害%」，不能丟進下面那個一律除以100的迴圈
      if (k.startsWith('raceCrit_')) {
        const r = k.slice(9);
        state.cardRaceCrit[r] = (state.cardRaceCrit[r] || 0) + v;
        continue;
      }
      if (k.startsWith('expRace_')) {
        const r = k.slice(8);
        state.cardExpRace[r] = (state.cardExpRace[r] || 0) + v / 100;
        continue;
      }
      if (k.startsWith('spOnKillRace_')) {
        const r = k.slice(13);
        state.cardSpOnKillRace[r] = (state.cardSpOnKillRace[r] || 0) + v;
        continue;
      }
      // 指定道具的回復量加成（啤酒企鵝的果汁、雪怪的冰淇淋），值就是百分比不用再除
      if (k.startsWith('itemHeal_')) {
        const it = k.slice(9);
        state.itemHealBonus[it] = (state.itemHealBonus[it] || 0) + v;
        continue;
      }
      // 異常狀態抗性（馬克免疫冰凍那一類）。值就是百分比，100 以上等於免疫
      if (k.startsWith('ailResist_')) {
        const t = k.slice(10);
        state.ailResist[t] = (state.ailResist[t] || 0) + v;
        continue;
      }
      // raceDmgReduce_ 必須排在 raceDmg_ 前面比對，否則會被前者的前綴先吃掉
      const prefix = Object.keys(CARD_BONUS_MAPS)
        .sort((a, b) => b.length - a.length)
        .find(p => k.startsWith(p));
      if (!prefix) continue;
      const bucket = state[CARD_BONUS_MAPS[prefix]];
      const key = k.slice(prefix.length);
      bucket[key] = (bucket[key] || 0) + v / 100;
    }
  }

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
/* 魔物 key → 家族 key。MONSTER_FAMILIES 是靜態資料，建一次索引就好。 */
let _monFamilyIndex = null;
function familyOfMonster(monDef) {
  if (!monDef) return null;
  if (!_monFamilyIndex) {
    _monFamilyIndex = {};
    if (typeof MONSTER_FAMILIES !== 'undefined') {
      for (const [fam, f] of Object.entries(MONSTER_FAMILIES)) {
        (f.members || []).forEach(k => { _monFamilyIndex[k] = fam; });
      }
    }
  }
  return _monFamilyIndex[monDef.id] || null;
}

function cardTargetDmgMult(monDef) {
  if (!monDef) return 1;
  let bonus = 0;
  const ele = monDef.element || 'none';
  if (state.cardEleDmgBonus && state.cardEleDmgBonus[ele]) bonus += state.cardEleDmgBonus[ele];
  if (monDef.race && state.cardRaceDmgBonus && state.cardRaceDmgBonus[monDef.race]) bonus += state.cardRaceDmgBonus[monDef.race];
  if (monDef.size && state.cardSizeDmgBonus && state.cardSizeDmgBonus[monDef.size]) bonus += state.cardSizeDmgBonus[monDef.size];
  // 魔物家族（哥布靈族／獸人族…）與指名單一隻怪的增傷
  if (state.cardFamilyDmgBonus) {
    const fam = familyOfMonster(monDef);
    if (fam && state.cardFamilyDmgBonus[fam]) bonus += state.cardFamilyDmgBonus[fam];
  }
  if (monDef.id && state.cardMonsterDmgBonus && state.cardMonsterDmgBonus[monDef.id]) bonus += state.cardMonsterDmgBonus[monDef.id];
  // 對所有階級敵人增傷（烏龜將軍／狂徒那類），以及只對首領類的增傷（深淵騎士）
  if (state.cardAllTargetDmgPct) bonus += state.cardAllTargetDmgPct / 100;
  if (monDef.isBoss && state.cardBossDmgPct) bonus += state.cardBossDmgPct / 100;
  return 1 + bonus;
}
/* 取怪物的「硬防, 軟防」一對，配 mitigateDamage 用展開運算子傳進去：
     mitigateDamage(raw, ...defOf(monDef))
   scale 給「無視部分防禦」的傷害用（持續傷害那類），硬防軟防同比例縮。
   官方沒有 def 拆分資料的 16 隻可遇怪沒有 defSoft 欄位，會當作純硬防。

   magic=true 時改查**魔防**。官方魔法傷害根本不看 DEF，看的是 MDEF；
   本作先前沒有魔防資料，只好拿物理硬防頂著，那是錯的。
   魔防的量級跟物防差很多——可遇怪平均物防 103+53、魔防只有 42，但軟魔防反而更大（73），
   所以換過去之後大魔法傷害會上升、小額魔法傷害會下降。

   軟魔防跟軟防一樣是「每一擊各扣一次」。場地類魔法（隕石術、火焰之壁）雖然會跳好幾次，
   但每一跳打的是**完整技能倍率**，本來就等於一次完整的法術命中，所以照扣不打折。

   inst 是「場上那一隻」的實體（不是 MONSTERS 的定義），有傳的話會套上異常狀態
   對防禦的修正（石化 +25%、中毒 −25%）。 */
function defOf(mon, scale, magic, inst) {
  const s = (scale === undefined ? 1 : scale) * (inst ? ailDefMult(inst) : 1);
  if (magic) return [(mon.mdef || 0) * s, (mon.mdefSoft || 0) * s];
  return [(mon.def || 0) * s, (mon.defSoft || 0) * s];
}

/* 玩家打怪的減傷：官方硬防公式 (4000 + DEF) / (4000 + 10 × DEF)，再扣掉軟防。

   硬防是比例減傷、軟防是固定扣血，這是兩種不同的運算。資料匯入時原本把官方的
   "16+17" 直接相加成 33 丟進比例公式，等於把固定扣血當成比例在放大。
   軟防按官方是「每一擊各扣一次」，所以多段技能與持續傷害對高軟防的怪特別吃虧。

   硬防公式原本用的是 def/(def+60)，那條是為「DEF 只有個位數到二三十」的尺度設計的，
   但 MONSTERS 的 def 是從 renewal 資料匯入的（中位 101、最大 999），
   丟進去等於中階怪就吃掉六成傷害、高階怪吃掉八成，全庫平均傷害只有應有的 54%。
   兩條曲線在 DEF>30 之後劇烈分岔，這是傷害偏低的主因。 */
function mitigateDamage(rawDmg, def, softDef) {
  const defMultiplier = (4000 + def) / (4000 + 10 * def);
  const dmg = Math.max(1, Math.round(rawDmg * defMultiplier - (softDef || 0)));
  // DPS 統計：玩家造成的傷害全都會經過這裡（怪打玩家走 mitigatePlayerIncoming），
  // 是唯一乾淨的收斂點。離線結算也會呼叫本函式，那時要跳過，否則會灌水。
  if (!_dpsPaused && state && state.dpsTracker) state.dpsTracker.damage += dmg;
  return dmg;
}
let _dpsPaused = false;   // 離線估算期間暫停累計

/* ---------------- 怪物的基礎攻擊力（官方 renewal 公式）----------------
   rAthena `battle_calc_base_damage()` 的怪物分支：

     傷害 = ATK × (0.8 ~ 1.2) + batk
     batk = STR + Level

   `batk` 那一項由 `status_base_atk()` 算，而它被 battle.conf 的開關擋著——
   `enable_baseatk_renewal: 0x29F` 含 BL_MOB，`enable_baseatk: 0x9` 不含，
   所以**只有 renewal 的怪物才有 batk**，pre-RE 是純 rnd(ATK1, ATK2)。
   本作的怪物資料（等級／硬防／STR）全部對得上 renewal，所以走 renewal 這套。

   **怪物沒有體型修正**——原始碼那行註解直接寫著 "Size fix only for players"。
   也沒有武器浮動、沒有熟練度，跟玩家那條鏈（#12/#28）完全是兩回事。

   roll：'mid' 取期望值（產出估算用），其餘正常浮動。 */
function monsterBaseAtk(monDef, roll) {
  const v = roll === 'mid' ? 1 : (0.8 + Math.random() * 0.4);
  return (monDef.atk || 0) * v + (monDef.mobStr || 0) + (monDef.level || 0);
}

/* ---------------- 玩家挨打的減傷（硬防／軟防拆開）----------------
   官方 `battle_calc_defense()` 的 renewal 分支：

     傷害 = 傷害 × (4000 + 硬防) / (4000 + 10 × 硬防) − 軟防

   硬防與軟防**從來不相加**。這裡以前是把兩者加成一個 `state.def` 再套
   `def/(def+60)`，等於讓 VIT 每一點都變成百分比減傷，而且 `def/(def+60)`
   天生會飽和——完全沒穿裝備、只靠 VIT 就能減傷 60% 以上。
   跟 #11 替怪物修的是同一個錯，只是這次在玩家身上。

   硬防用 renewal 的 4000 式（本作的裝備 DEF 是 renewal 尺度，盾牌到 190、鎧甲到 450，
   套 pre-RE 的 (100−DEF)/100 會直接免疫）；軟防用 renewal 的 floor((等級 + VIT)/2)。

   `MONSTER_DAMAGE_SCALE` 是唯一的難度旋鈕：官方數值是給有走位、有隊友、
   會嗑藥的即時遊戲用的，放置遊戲是站著硬扛。要調難度只改這一個數。 */
const MONSTER_DAMAGE_SCALE = 1.0;
function mitigatePlayerIncoming(rawDmg, hardDef, softDef) {
  const hard = Math.max(0, hardDef || 0);
  const after = rawDmg * (4000 + hard) / (4000 + 10 * hard) - (softDef || 0);
  return Math.max(1, Math.round(after * MONSTER_DAMAGE_SCALE));
}
/* ---------------- DPS／收益統計 ----------------
   兩套數字並存，用途不同：
     實測 —— 從上次重置到現在真的打出多少傷害、拿到多少經驗與錢，用來看「現在跑得如何」
     預估 —— 拿目前素質去推算某張地圖的產出，用來看「該不該換圖」，不必先去打
------------------------------------------------- */
function resetDpsTracker() {
  state.dpsTracker = { since: Date.now(), damage: 0, exp: 0, jobExp: 0, gold: 0, kills: 0 };
  saveGame();
}

// 實測值。時間太短時比值會亂跳，交給 UI 決定要不要顯示
function dpsStats() {
  const t = state.dpsTracker;
  if (!t) return null;
  const sec = Math.max(1, (Date.now() - t.since) / 1000);
  return {
    sec,
    dps: t.damage / sec,
    kills: t.kills,
    expPer10m: t.exp / sec * 600,
    jobExpPer10m: t.jobExp / sec * 600,
    goldPer10m: t.gold / sec * 600,
  };
}

/* 預估：用目前素質推算在某張地圖的產出。
   走的是普攻路線（技能倍率無法一概而論，只用一個保守的加成係數帶過），
   命中率、體型、屬性、DEF 都照怪物權重加權，跟實戰同一套函式。 */
function estimateMapYield(mapObj) {
  const pool = (mapObj && mapObj.monsters) || [];
  if (!pool.length || !state.attackInterval) return null;
  const wSum = pool.reduce((s, m) => s + m.weight, 0) || 1;

  const weaponId = getEquipBaseItemId('weapon');
  const weapon = weaponId ? ITEMS[weaponId] : null;
  const atkElement = (weapon && weapon.element) ? weapon.element : 'none';
  const critRate = Math.min(100, state.critRate) / 100;

  let dmg = 0, exp = 0, jobExp = 0, gold = 0, hp = 0;
  pool.forEach(o => {
    const mon = MONSTERS[o.id];
    if (!mon) return;
    const share = o.weight / wSum;
    // 走跟實戰同一條傷害鏈（weaponChainDamage），浮動取中間值。
    // 暴擊分開算：官方暴擊無視 DEF，用「暴擊率加權」把兩種結果混起來才會準
    const hitPct = hitChancePctVsMonster(effectiveHitWithBuff(), mon) / 100;
    const elemMult = getElementMultiplierVsMonster(atkElement, mon);
    const base = weaponChainDamage(mon, elemMult, 'mid') * cardTargetDmgMult(mon);
    const critRaw = base * 1.5 * (1 + (state.cardCritDmgPct || 0) / 100);
    _dpsPaused = true;
    const normalPer = mitigateDamage(base, ...defOf(mon)) + raceFlatBonus(mon);
    _dpsPaused = false;
    const critPer = Math.max(1, Math.round(critRaw)) + raceFlatBonus(mon);
    dmg += (normalPer * (1 - critRate) * hitPct + critPer * critRate) * share;
    hp += (mon.hp || 1) * share;
    exp += (mon.exp || 0) * share;
    jobExp += (mon.jobExp || 0) * share;
    gold += Math.round(3 + (mon.level || 1) * 1.4) * share;
  });

  const dps = dmg / (state.attackInterval / 1000);
  /* 生怪速度會吃掉一部分產出，但不是單純的「每秒最多幾隻」上限。
     spawnMonster() 有兩段節流：場上還有怪時 3 秒補一隻、場上清空時 0.5 秒補一隻
     （騎乘術各縮短成 2.25 / 0.375 秒）。

     殺一隻要花的時間 >= 3 秒時，場上那 5 隻永遠補得回來，玩家不會空手，產出就是 dps/血量。
     殺得比 3 秒快時，緩衝那幾隻很快被清光，之後就變成「等 0.5 秒生一隻 → 花 T 秒殺掉」的循環，
     每隻的實際週期是 T + 0.5 秒，而不是 T。

     先前這裡寫成「上限 = 1/3 隻每秒」，等於假設緩衝永遠是空的，把擊殺數低估了一半以上。 */
  const ridePassive = state.learnedSkills && state.learnedSkills['riding'];
  const refillSec = (ridePassive ? 2250 : 3000) / 1000;
  const emptyGapSec = (ridePassive ? 375 : 500) / 1000;
  const secPerKill = hp > 0 && dps > 0 ? hp / dps : Infinity;
  // 遠攻模式是「死一隻補一隻」，沒有清場等待
  const throttled = state.encounterMode === 'melee' && secPerKill < refillSec;
  const killsPerSec = secPerKill === Infinity
    ? 0
    : 1 / (secPerKill + (throttled ? emptyGapSec : 0));
  return {
    dps, hpAvg: hp, spawnCapped: throttled,
    killsPer10m: killsPerSec * 600,
    expPer10m: exp * killsPerSec * 600,
    jobExpPer10m: jobExp * killsPerSec * 600,
    goldPer10m: gold * killsPerSec * 600 * buffMult('gold').mult,
  };
}

function monsterHitOf(def) { return def.hit || (90 + def.level * 2.5); }
function monsterFleeOf(def) { return def.flee || (80 + def.level * 4); }

/* ---------------- 命中/迴避（官方 pre-RE 的差值制）----------------
   `hitReq` / `fleeReq` 就是官方資料的「100% 命中」與「95% 回避」：
     hitReq  = 玩家 HIT 達到這個值 → 對這隻怪 100% 命中
     fleeReq = 玩家 FLEE 達到這個值 → 迴避這隻怪 95%（RO 的迴避上限）

   官方公式是 `命中% = 80 + 攻方HIT − 守方FLEE`，也就是**差 1 點就差 1%**。
   換算成上面那兩個門檻就是：
     命中% = 100 − (hitReq  − 玩家HIT)      夾在 5 ~ 100
     迴避% =  95 − (fleeReq − 玩家FLEE)     夾在 5 ~ 95

   2026-08-03 之前這裡寫的是**比例制**（玩家HIT / hitReq × 100），性質完全不同：
   官方的有效區間只有 95~100 點寬，門檻往下 95 點就歸零；比例制是「達成率」，永遠不會歸零。
   實測 422 隻可遇怪的平均迴避率，FLEE 150 時比例制給 62%、官方只有 17%；
   反過來打高門檻的怪（fleeReq 450）時比例制還有 85%、官方只剩 28%。
   等於 AGI 這條屬性線在前中期幾乎不用點就有九成效果，點滿也只多 5%。

   迴避的下限維持 5%（使用者指定）——再怎麼打不過也留一線生機，跟命中的 5% 下限對稱。
   沒有 hitReq/fleeReq 的怪才退回 monDef.hit/monDef.flee，但可遇怪已經全部補齊
   （見 tools/fix_monster_hit_flee_req.js），這條路實務上不會走到。
------------------------------------------------- */
/* hitReq = 怪物FLEE + 20、fleeReq = 怪物HIT + 75（官方「100%命中」「95%回避」的定義）。
   要對怪物的 HIT/FLEE 本身做百分比增減時，得先把這兩個偏移剝掉。 */
const REQ_HIT_OFFSET = 20;
const REQ_FLEE_OFFSET = 75;

function hitChancePctVsMonster(playerHit, monDef, inst) {
  let threshold = monDef.hitReq || monsterFleeOf(monDef);
  // 黑暗讓怪物的迴避下降（門檻變低＝更好打中）；冰凍與睡眠則是必定命中
  if (inst) {
    if (ailAlwaysHit(inst)) return 100;
    /* 官方的黑暗是「FLEE −25%」，打折的對象是**怪物的 FLEE** 而不是 hitReq。
       hitReq = 怪物FLEE + 20（100% 命中的定義），所以要先剝掉那 20 再打折、再加回去。
       直接對 hitReq 打折會多扣 5 點——比例制時代無所謂，差值制下 1 點就是 1%。 */
    threshold = Math.max(1, (threshold - REQ_HIT_OFFSET) * ailFleeMult(inst) + REQ_HIT_OFFSET);
  }
  return Math.min(100, Math.max(5, Math.round(100 - (threshold - playerHit))));
}
function dodgeChancePctFromMonster(playerFlee, monDef, hitDebuff) {
  let threshold = monDef.fleeReq || monsterHitOf(monDef);
  if (hitDebuff) threshold = Math.max(1, threshold - hitDebuff);
  return Math.min(95, Math.max(5, Math.round(95 - (threshold - playerFlee))));
}

/* ---------------- 中毒（施毒/塗毒共用）----------------
   固定持續3秒、不疊加（同一隻怪再次中毒直接覆蓋刷新）、毒屬性怪物免疫 */
function applyPoisonDot(mon, monDef, rawDmgPerTick) {
  const elemMult = getElementMultiplierVsMonster('poison', monDef);
  if (elemMult === 0) {
    logMsg(`🚫 ${monDef.name} 對毒免疫！`);
    return;
  }
  const wasPoisoned = mon.poisonDotEnd && Date.now() < mon.poisonDotEnd;
  mon.poisonDotPerTick = Math.round(rawDmgPerTick * elemMult);
  mon.poisonDotEnd = Date.now() + 3000;
  // 只有從沒中毒變成中毒才出聲，續毒不重放
  if (!wasPoisoned && typeof playStatusSound === 'function') playStatusSound('poison');
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
    const dmg = mitigateDamage(mon.poisonDotPerTick, ...defOf(monDef, 0.6));
    mon.hp -= dmg;
    logMsg(`☠️ 中毒對 ${monDef.name} 造成 ${dmg} 點傷害！`);
    if (mon.hp <= 0) killMonster(monDef, mon);
  }
}

/* ---------------- 怪物異常狀態 ----------------
   官方 pre-RE 的核心異常狀態共 10 種，這裡全部收進同一張表。以前本作只有「暈眩」
   一個欄位（`mon.stunnedUntil`），冰凍、石化都硬塞在裡面，分不出是哪一種。

   資料放在 `mon.ail = { 狀態: 結束時間戳 }`。無法行動類的狀態**同時**寫進
   `mon.stunnedUntil`，這樣既有那些讀 stunnedUntil 的地方（怪物攻擊判定、
   冰凍術甦醒）一行都不用改。

   刻意的偏離：
   - **混亂**官方是「移動方向隨機」，本作沒有移動概念，改成無法行動 1~3 秒（隨機）
   - **沉默**官方是「無法使用技能」，本作怪物目前只會平A，所以掛得上但沒有效果，
     等怪物技能做出來（見 docs/BUGS.md #29）就會自動生效
   - **黑暗**只做「怪物命中下降」與「怪物迴避下降」，官方的視野縮小無從表現
   - **詛咒**官方是 LUK 歸 0 + ATK -25% + 移速下降，對怪物只有 ATK 那項有意義
------------------------------------------------- */
const MON_AILMENTS = {
  stun:      { name: '昏迷', icon: '💫', sec: 3, immobile: true },
  freeze:    { name: '冰凍', icon: '🧊', sec: 4, immobile: true, alwaysHit: true, immuneElement: ['water'], immuneRace: ['undead'] },
  stone:     { name: '石化', icon: '🗿', sec: 5, immobile: true, defMult: 1.25, immuneElement: ['earth'] },
  sleep:     { name: '睡眠', icon: '💤', sec: 6, immobile: true, alwaysHit: true, dmgTakenMult: 1.5, breakOnHit: true, immuneRace: ['undead'] },
  confusion: { name: '混亂', icon: '😵', secMin: 1, secMax: 3, immobile: true },
  blind:     { name: '黑暗', icon: '🌑', sec: 8, hitPenaltyPct: 25, fleePenaltyPct: 25 },
  curse:     { name: '詛咒', icon: '💀', sec: 8, atkMult: 0.75, immuneRace: ['undead'] },
  bleed:     { name: '出血', icon: '🩸', sec: 8, dotPctMaxHp: 1, immuneRace: ['undead', 'formless'] },
  poison:    { name: '中毒', icon: '☠️', sec: 3, defMult: 0.75, immuneElement: ['poison'] },
  silence:   { name: '沉默', icon: '🤐', sec: 8 },
};

function ailImmune(monDef, type) {
  const A = MON_AILMENTS[type];
  if (!A || !monDef) return true;
  if (A.immuneElement && A.immuneElement.includes(monDef.element || 'none')) return true;
  if (A.immuneRace && A.immuneRace.includes(monDef.race)) return true;
  return false;
}

/* 掛上一個異常狀態。回傳有沒有真的掛上去。
   同一種狀態重複觸發是「取較長的那個」而不是疊加——不然被連續攻擊時會無限延長。
   BOSS 階級的持續時間減半（官方 MVP 對狀態異常有高抗性，本作用減半代替完全免疫，
   免得那些卡片對 BOSS 完全失效）。 */
function applyAilment(mon, monDef, type, opts) {
  const A = MON_AILMENTS[type];
  if (!A || !mon || mon.hp <= 0) return false;
  if (ailImmune(monDef, type)) return false;

  let sec = (opts && opts.sec) || (A.secMin != null ? A.secMin + Math.random() * (A.secMax - A.secMin) : A.sec);
  if (monDef.isBoss) sec *= 0.5;

  const now = Date.now();
  mon.ail = mon.ail || {};
  const had = mon.ail[type] && now < mon.ail[type];
  mon.ail[type] = Math.max(mon.ail[type] || 0, now + sec * 1000);
  if (A.immobile) mon.stunnedUntil = Math.max(mon.stunnedUntil || 0, mon.ail[type]);
  if (A.dotPctMaxHp) mon.bleedNextTick = mon.bleedNextTick || now;

  if (!had) {
    logMsg(`${A.icon} ${monDef.name} ${A.name}了！（${sec.toFixed(1)}秒）`);
    if (typeof playStatusSound === 'function') playStatusSound(A.immobile ? 'stun' : 'poison');
  }
  return true;
}

function ailActive(mon, type) {
  return !!(mon && mon.ail && mon.ail[type] && Date.now() < mon.ail[type]);
}
// 目前掛著的狀態清單（顯示與除錯用）
function ailList(mon) {
  if (!mon || !mon.ail) return [];
  const now = Date.now();
  return Object.keys(mon.ail).filter(t => mon.ail[t] > now && MON_AILMENTS[t]);
}
function ailFold(mon, key, init) {
  let v = init;
  ailList(mon).forEach(t => { const x = MON_AILMENTS[t][key]; if (x != null) v *= x; });
  return v;
}
const ailAtkMult = mon => ailFold(mon, 'atkMult', 1);          // 詛咒
const ailDefMult = mon => ailFold(mon, 'defMult', 1);          // 石化↑／中毒↓
const ailDmgTakenMult = mon => ailFold(mon, 'dmgTakenMult', 1); // 睡眠
const ailAlwaysHit = mon => ailList(mon).some(t => MON_AILMENTS[t].alwaysHit);   // 冰凍／睡眠
// 黑暗：怪物的命中與迴避各降一截，回傳「要打幾折」
function ailHitMult(mon) {
  let v = 1;
  ailList(mon).forEach(t => { const p = MON_AILMENTS[t].hitPenaltyPct; if (p) v *= (1 - p / 100); });
  return v;
}
function ailFleeMult(mon) {
  let v = 1;
  ailList(mon).forEach(t => { const p = MON_AILMENTS[t].fleePenaltyPct; if (p) v *= (1 - p / 100); });
  return v;
}
// 睡眠：受到任何傷害就醒（官方規則）
function ailBreakOnDamage(mon, monDef) {
  ailList(mon).forEach(t => {
    if (!MON_AILMENTS[t].breakOnHit) return;
    delete mon.ail[t];
    if (MON_AILMENTS[t].immobile) mon.stunnedUntil = Date.now();
    if (monDef) logMsg(`${MON_AILMENTS[t].icon} ${monDef.name} 被打醒了！`);
  });
}

/* 出血：每秒扣最大 HP 的固定比例，**無視防禦**（官方出血是直接扣血）。
   跟中毒分開跑，因為中毒的每跳傷害是從技能傷害推導的，出血則是純比例。 */
function tickBleed() {
  if (!state.monsters || state.monsters.length === 0) return;
  const now = Date.now();
  for (let i = state.monsters.length - 1; i >= 0; i--) {
    const mon = state.monsters[i];
    if (!ailActive(mon, 'bleed')) { delete mon.bleedNextTick; continue; }
    if (now < (mon.bleedNextTick || 0)) continue;
    mon.bleedNextTick = now + 1000;
    const monDef = MONSTERS[mon.defId];
    const dmg = Math.max(1, Math.round(mon.maxHp * MON_AILMENTS.bleed.dotPctMaxHp / 100));
    mon.hp -= dmg;
    if (!_dpsPaused && state && state.dpsTracker) state.dpsTracker.damage += dmg;
    logMsg(`🩸 出血對 ${monDef.name} 造成 ${dmg} 點傷害！`);
    if (mon.hp <= 0) killMonster(monDef, mon);
  }
}

/* ---------------- 卡片附加掉落 ----------------
   資料寫在 `CARDS[x].killDrop = [{ race?, items?, pool?, chance }]`：
     race   限定種族，省略代表任何魔物
     items  候選道具 id 陣列，隨機挑一個
     pool   改用分類池（'food' 食品類／'elementResist' 屬性抵抗藥水）
     chance 百分比。本作的規範是**限定種族 5%、不限種族 1%**
   跟 autoSpell / ailment 一樣支援 when（目前沒有卡片用到，留著格式一致）。 */
const ITEM_POOLS = {
  // 食品：有回血值的道具，扣掉藥水藥草那一類（那是藥品不是食品）
  food: () => Object.keys(ITEMS).filter(k => ITEMS[k].heal > 0 && !/药水|藥水|药草|藥草/.test(ITEMS[k].name)),
  elementResist: () => Object.keys(ITEMS).filter(k => /属性抵抗药水$/.test(ITEMS[k].name)),
};
const _itemPoolCache = {};
function itemPool(name) {
  if (!_itemPoolCache[name]) _itemPoolCache[name] = (ITEM_POOLS[name] || (() => []))();
  return _itemPoolCache[name];
}

function tryCardKillDrops(monDef) {
  if (!state.cardKillDrops || !state.cardKillDrops.length) return;
  state.cardKillDrops.forEach(e => {
    if (e.race && monDef.race !== e.race) return;
    if (Math.random() * 100 >= e.chance) return;
    const pool = e.pool ? itemPool(e.pool) : e.items;
    if (!pool || !pool.length) return;
    const id = pool[Math.floor(Math.random() * pool.length)];
    if (!ITEMS[id]) return;
    addItem(id, 1);
    logMsg(`🎁 卡片效果！額外獲得了 ${ITEMS[id].name}！`);
  });
}

/* ---------------- 箱子 ----------------
   神秘箱子：從「全部道具扣掉卡片」均勻抽一件。裝備天然就佔 20%，不必另外做權重。
             三轉裝備與 1z 雜物都留在池子裡——這個箱子的定位就是賭博。
   禮物箱　：從 500z ~ 3,000,000z 的道具裡抽，但**權重 1/√售價**。
             均勻抽的話期望值 15,432z（現在整體收入的 8.8 倍），加權後降到 1,871z，
             300 萬的世界之星鑽石照樣抽得到，只是機率壓下來了。
   兩個池子都只建一次，之後查快取。 */
const BOX_ITEM_NAMES = ['神秘箱子', '神秘紫箱', '礼物箱'];   // 箱子不會開出箱子（同名的另一份也一起擋掉）
const EQUIP_TYPES = ['armor', 'weapon', 'ammo'];

/* 能不能進箱子的道具池。
   `ITEMS` 有 23,407 筆，裡面混著大量沒翻譯完或本作根本取得不到的東西：
   韓文名（손목 아대）、日文假名、以及完全沒有漢字的英文名（Costume Engineer Cap）。
   使用者要求把這些擋掉，只留有中文名的道具。過濾後剩 14,509 件。 */
function boxEligible(k) {
  const it = ITEMS[k];
  if (!it || CARDS[k] || /卡片$/.test(it.name)) return false;
  if (it.boxOpen || BOX_ITEM_NAMES.includes(it.name)) return false;
  const n = it.name || '';
  if (/[가-힯ᄀ-ᇿ]/.test(n)) return false;    // 韓文
  if (/[぀-ヿ]/.test(n)) return false;         // 日文假名
  if (!/[一-鿿]/.test(n)) return false;        // 完全沒有漢字（英文名）
  /* 時裝與轉蛋一律排除（使用者要求）。
     時裝在官方是獨立的外觀欄位，本作沒有時裝欄，開出來只是佔背包；
     轉蛋是抽獎容器，開箱子開出另一個抽獎道具很怪。

     **只認名字不認 desc**：desc 裡的「同時裝備」「與XX一起裝備時」都含有「時裝」兩個字，
     用 desc 比對會把幻影生存的魔杖那種正常武器一起誤殺。
     `(时装)` 是官方時裝的固定前綴；「系列: 时装」是結構化欄位，兩個都安全。 */
  if (/[(（]时装[)）]/.test(n)) return false;
  if (/转蛋\s*$/.test(n) || /转蛋专用/.test(n)) return false;
  if (/系列:\s*时装/.test(it.desc || '')) return false;
  return true;
}

const BOX_POOLS = {
  /* 神秘箱子：過濾之後裝備的天然占比會從 20% 跳到 31%（被擋掉的多半是雜物而不是裝備），
     所以改成兩段抽：先擲 20% 決定要不要給裝備，再從對應的子池裡均勻抽。
     三轉裝與 1z 雜物照樣留在池子裡——這個箱子的定位就是賭博。 */
  any: {
    build: () => Object.keys(ITEMS).filter(boxEligible),
    split: { rate: 0.2, pick: k => EQUIP_TYPES.includes(ITEMS[k].type) },
  },
  /* 神秘紫箱：跟神秘箱子同一個道具池，差別只在**裝備比例 40%**（神秘箱子是 20%）。
     兩者在官方都是「開出隨機道具」的雜物箱，本作拿裝備比例做出區隔——
     紫箱比較容易開出裝備，藍箱比較容易開出雜物但兩邊的大獎池一模一樣。 */
  violet: {
    build: () => Object.keys(ITEMS).filter(boxEligible),
    split: { rate: 0.4, pick: k => EQUIP_TYPES.includes(ITEMS[k].type) },
  },
  /* 禮物箱：售價 500z~3,000,000z，權重 1/√售價。
     均勻抽的期望值是 15,432z（全系 1% 等於每 10 分鐘 8.3 個箱子，收入會變成 8.8 倍），
     因為價格帶前 5% 的那 35 件吃掉了 83% 的期望值。加權之後降到 1,800z 上下，
     300 萬的世界之星鑽石照樣抽得到，只是機率壓到 0.005%。 */
  valuable: {
    build: () => Object.keys(ITEMS).filter(k => {
      if (!boxEligible(k)) return false;
      const s = ITEMS[k].sell || 0;
      return s >= 500 && s <= 3000000;
    }),
    weight: id => 1 / Math.sqrt(ITEMS[id].sell || 1),
  },
};
/* ---------------- 卡冊 ----------------
   一條「花錢換運氣」的鏈：道具商人賣 500 萬的**未解封的卡冊** → 開出某一種卡冊 → 再開出卡片。

     未解封的卡冊    → 9 種卡冊之一（具有魔力的卡片冊權重壓到很低）
     老舊收集冊      → 全部 553 張卡，**王卡權重壓很低**
     老舊收集冊(部位) → 只開該部位能插的卡（含任意部位卡），王卡一樣壓低
     具有魔力的卡片冊 → 全部 553 張**完全平均**，王卡機率最高，是這條鏈的頭獎

   王卡的判定：從 MONSTER_CARD_DROPS 反查來源怪，怪是 BOSS 階級就算。
   MVP 30 張、迷你王 39 張。 */
const CARD_ALBUM_WEIGHT = { mvp: 0.02, miniBoss: 0.1, normal: 1 };
let _bossCardKind = null;
function bossCardKind(cardId) {
  if (!_bossCardKind) {
    _bossCardKind = {};
    for (const [monKey, d] of Object.entries(MONSTER_CARD_DROPS)) {
      const m = MONSTERS[monKey];
      if (m && m.isBoss) _bossCardKind[d.card] = m.isMvp ? 'mvp' : 'miniBoss';
    }
  }
  return _bossCardKind[cardId] || 'normal';
}
/* 可以從卡冊開出來的卡片。兩道過濾：
   1. `CARDS` 裡有 108 筆其實是**附魔石**（STR+1、DEF+6、流溢Lv3、魔神的幸運精髓1…），
      沒有任何怪物會掉，也不該從卡冊開出來——用名稱結尾是不是「卡片」來擋
   2. 有 3 張卡片沒有對應的 ITEMS 條目，addItem 進不了背包
   剩下 445 張，其中 MVP 卡 30 張、迷你王卡 39 張。 */
const cardDrawable = () => Object.keys(CARDS).filter(k => ITEMS[k] && /卡片$/.test(CARDS[k].name));
const cardWeight = id => CARD_ALBUM_WEIGHT[bossCardKind(id)];

const ALBUM_ITEMS = {
  old_card_album: 10,          // 老舊收集冊：全部卡片
  old_c_album_helm: 5, old_c_album_armor: 5, old_c_album_shield: 5,
  old_c_album_garment: 5, old_c_album_shoes: 5, old_c_album_acc: 5,
  old_c_album_weapon: 5,       // 部位限定：命中率高，權重中等
  magic_card_album: 1,         // 完全平均的那本，權重壓到 1/46 ≈ 2%
};
// 部位限定卡冊 → 卡片的 slot
const ALBUM_SLOT = {
  old_c_album_helm: 'headgear', old_c_album_armor: 'armor', old_c_album_shield: 'shield',
  old_c_album_garment: 'garment', old_c_album_shoes: 'footgear', old_c_album_acc: 'accessory',
  old_c_album_weapon: 'weapon',
};

Object.assign(BOX_POOLS, {
  album: {
    build: () => Object.keys(ALBUM_ITEMS).filter(k => ITEMS[k]),
    weight: id => ALBUM_ITEMS[id],
  },
  card: { build: cardDrawable, weight: cardWeight },
  cardFlat: { build: cardDrawable },     // 完全平均
});
Object.entries(ALBUM_SLOT).forEach(([album, slot]) => {
  BOX_POOLS['card_' + slot] = {
    build: () => cardDrawable().filter(k => CARDS[k].slot === slot || CARDS[k].slot === 'any'),
    weight: cardWeight,
  };
});

const _boxCache = {};
function boxPool(kind) {
  if (_boxCache[kind]) return _boxCache[kind];
  const spec = BOX_POOLS[kind];
  if (!spec) return null;
  const all = spec.build();
  const mk = ids => {
    let cum = null, total = ids.length;
    if (spec.weight) {
      cum = new Float64Array(ids.length);
      let acc = 0;
      ids.forEach((id, i) => { acc += spec.weight(id); cum[i] = acc; });
      total = acc;
    }
    return { ids, cum, total };
  };
  const p = mk(all);
  if (spec.split) {
    p.split = spec.split.rate;
    p.hit = mk(all.filter(spec.split.pick));
    p.miss = mk(all.filter(k => !spec.split.pick(k)));
  }
  return (_boxCache[kind] = p);
}
function drawFromSub(p) {
  if (!p.ids.length) return null;
  if (!p.cum) return p.ids[Math.floor(Math.random() * p.ids.length)];
  // 加權抽：在累積權重上二分搜尋
  const r = Math.random() * p.total;
  let lo = 0, hi = p.ids.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (p.cum[mid] < r) lo = mid + 1; else hi = mid;
  }
  return p.ids[lo];
}
function drawFromBox(kind) {
  const p = boxPool(kind);
  if (!p || !p.ids.length) return null;
  if (p.split != null) {
    const sub = Math.random() < p.split ? p.hit : p.miss;
    if (sub.ids.length) return drawFromSub(sub);
  }
  return drawFromSub(p);
}

/* ---------------- 玩家異常狀態 ----------------
   怪物端那套（MON_AILMENTS）的鏡像版本。放在 `state.playerAil = { 狀態: 結束時間戳 }`。

   官方那 10 種對玩家的效果跟對怪物不完全一樣，這裡各自寫清楚：
     昏迷／冰凍／石化／睡眠／混亂  無法攻擊（本作沒有移動，所以「不能動」＝不能攻擊）
     睡眠   額外：受到的傷害 ×1.5，而且**被打就醒**
     冰凍   額外：一定被打中
     黑暗   命中 −25%、迴避 −25%
     詛咒   ATK −25%
     沉默   **不能施放技能**（這是玩家端才真正有意義的那一條）
     中毒   每秒扣最大HP 0.8%
     出血   每秒扣最大HP 1%，而且**HP/SP 不會自然回復**

   抗性：`state.ailResist[狀態]` 是百分比減免（卡片給的），100 以上等於免疫。 */
const PLAYER_AILMENTS = {
  stun:      { name: '昏迷', icon: '💫', sec: 3, immobile: true },
  freeze:    { name: '冰凍', icon: '🧊', sec: 4, immobile: true, alwaysHit: true },
  stone:     { name: '石化', icon: '🗿', sec: 5, immobile: true },
  sleep:     { name: '睡眠', icon: '💤', sec: 6, immobile: true, alwaysHit: true, dmgTakenMult: 1.5, breakOnHit: true },
  confusion: { name: '混亂', icon: '😵', secMin: 1, secMax: 3, immobile: true },
  blind:     { name: '黑暗', icon: '🌑', sec: 8, hitPct: -25, fleePct: -25 },
  curse:     { name: '詛咒', icon: '💀', sec: 8, atkMult: 0.75 },
  silence:   { name: '沉默', icon: '🤐', sec: 8, noSkill: true },
  poison:    { name: '中毒', icon: '☠️', sec: 10, dotPctMaxHp: 0.8 },
  bleed:     { name: '出血', icon: '🩸', sec: 10, dotPctMaxHp: 1, noRegen: true },
};

function playerAilActive(type) {
  return !!(state.playerAil && state.playerAil[type] && Date.now() < state.playerAil[type]);
}
function playerAilList() {
  if (!state.playerAil) return [];
  const now = Date.now();
  return Object.keys(state.playerAil).filter(t => state.playerAil[t] > now && PLAYER_AILMENTS[t]);
}
function playerAilFold(key, init) {
  let v = init;
  playerAilList().forEach(t => { const x = PLAYER_AILMENTS[t][key]; if (x != null) v *= x; });
  return v;
}
const playerImmobile = () => playerAilList().some(t => PLAYER_AILMENTS[t].immobile);
const playerSilenced = () => playerAilList().some(t => PLAYER_AILMENTS[t].noSkill);
const playerNoRegen = () => playerAilList().some(t => PLAYER_AILMENTS[t].noRegen);
const playerAilAtkMult = () => playerAilFold('atkMult', 1);
const playerAilDmgTakenMult = () => playerAilFold('dmgTakenMult', 1);
const playerAlwaysHit = () => playerAilList().some(t => PLAYER_AILMENTS[t].alwaysHit);
function playerAilPct(key) {
  let v = 0;
  playerAilList().forEach(t => { const x = PLAYER_AILMENTS[t][key]; if (x) v += x; });
  return v;
}

/* 掛狀態到玩家身上。抗性由卡片提供（`ailResist`），100% 就是完全免疫。
   跟怪物端一樣「取較長的那個」而不是疊加。 */
function applyPlayerAilment(type, opts) {
  const A = PLAYER_AILMENTS[type];
  if (!A || state.hp <= 0) return false;
  const resist = (state.ailResist && state.ailResist[type]) || 0;
  if (resist >= 100) return false;
  if (resist > 0 && Math.random() * 100 < resist) return false;

  let sec = (opts && opts.sec) || (A.secMin != null ? A.secMin + Math.random() * (A.secMax - A.secMin) : A.sec);
  const now = Date.now();
  state.playerAil = state.playerAil || {};
  const had = state.playerAil[type] && now < state.playerAil[type];
  state.playerAil[type] = Math.max(state.playerAil[type] || 0, now + sec * 1000);
  if (A.dotPctMaxHp) state.playerAilTick = state.playerAilTick || now;
  if (!had) {
    logMsg(`${A.icon} 你${A.name}了！（${sec.toFixed(1)}秒）`);
    if (typeof playStatusSound === 'function') playStatusSound(A.immobile ? 'stun' : 'poison');
  }
  return true;
}
// 睡眠：受到任何傷害就醒
function playerAilBreakOnDamage() {
  playerAilList().forEach(t => {
    if (!PLAYER_AILMENTS[t].breakOnHit) return;
    delete state.playerAil[t];
    logMsg(`${PLAYER_AILMENTS[t].icon} 你被打醒了！`);
  });
}
/* 玩家身上的持續傷害（中毒／出血），每秒跳一次。
   打不死玩家——扣到剩 1 點就停，這種「站著不動被毒死」在放置遊戲裡體驗太差。 */
function tickPlayerAilments() {
  const now = Date.now();
  if (!state.playerAil) return;
  // 過期的清掉
  Object.keys(state.playerAil).forEach(t => { if (state.playerAil[t] <= now) delete state.playerAil[t]; });
  const dots = playerAilList().filter(t => PLAYER_AILMENTS[t].dotPctMaxHp);
  if (!dots.length) { delete state.playerAilTick; return; }
  if (now < (state.playerAilTick || 0)) return;
  state.playerAilTick = now + 1000;
  let dmg = 0;
  dots.forEach(t => { dmg += Math.max(1, Math.round(state.maxHp * PLAYER_AILMENTS[t].dotPctMaxHp / 100)); });
  const before = state.hp;
  state.hp = Math.max(1, state.hp - dmg);
  if (state.hp < before) {
    logMsg(`${dots.map(t => PLAYER_AILMENTS[t].icon).join('')} 持續傷害讓你損失了 ${before - state.hp} 點HP。`);
    if (typeof showPlayerFloat === 'function') showPlayerFloat('-' + (before - state.hp), 'normal');
  }
}

/* ---------------- 怪物技能 ----------------
   資料在 js/monster_skills.js（由 tools/import_monster_skills.js 從 rAthena 匯入）。
   每隻怪在自己攻擊的時候擲一次，命中的技能取代那一次普通攻擊。
   冷卻記在**怪物實體**上，所以同一種怪的不同隻各自獨立。 */
function monsterSkillFor(mon, monDef) {
  const list = (typeof MONSTER_SKILLS !== 'undefined') && MONSTER_SKILLS[mon.defId];
  if (!list || !list.length) return null;
  const now = Date.now();
  mon.skCd = mon.skCd || {};
  for (const e of list) {
    if (now < (mon.skCd[e.s] || 0)) continue;
    if (Math.random() * 100 >= e.rate) continue;
    mon.skCd[e.s] = now + e.cd * 1000;
    return e;
  }
  return null;
}

/* ---------------- 怪物端的暈眩 ----------------
   技能造成的暈眩走這條（不吃 BOSS 減半，維持既有平衡），卡片造成的走 applyAilment()。
   additive=true 時會疊加時長（滑動/睡魔/定位陷阱共用），否則直接覆蓋（衝鋒箭） */
function applyStun(mon, sec, additive) {
  const now = Date.now();
  const wasStunned = mon.stunnedUntil && now < mon.stunnedUntil;
  if (additive) {
    mon.stunnedUntil = Math.max(now, mon.stunnedUntil || 0) + sec * 1000;
  } else {
    mon.stunnedUntil = now + sec * 1000;
  }
  // 一併登記成正式的異常狀態，讓畫面上的狀態圖示看得到
  mon.ail = mon.ail || {};
  mon.ail.stun = Math.max(mon.ail.stun || 0, mon.stunnedUntil);
  // 只有從沒暈到暈才出聲，續暈不重放
  if (!wasStunned && typeof playStatusSound === 'function') playStatusSound('stun');
}

// 冰凍術/石化術：被反制暈眩的目標，之後只要受到我方魔法傷害就會提前甦醒
function wakeIfFrozen(mon) {
  if (mon && mon.frozenByProc) {
    mon.stunnedUntil = Date.now();
    if (mon.ail) { delete mon.ail.stun; delete mon.ail.freeze; }
    mon.frozenByProc = false;
  }
}

/* 卡片觸發的異常狀態。trigger：'attack' 普攻命中後／'hit' 被打到後／'magic' 魔法技能命中後。
   type 可以寫成 'stun+curse+blind+stone'，代表隨機挑一種（火焰顱骨卡片）。 */
function tryCardAilments(trigger, mon) {
  if (!mon || !state.cardAilments) return;
  const list = state.cardAilments[trigger];
  if (!list || !list.length) return;
  const monDef = MONSTERS[mon.defId];
  if (!monDef) return;
  list.forEach(e => {
    if (Math.random() * 100 >= e.chance) return;
    const pool = String(e.type).split('+');
    const type = pool[Math.floor(Math.random() * pool.length)];
    applyAilment(mon, monDef, type);
  });
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
      const dmg = mitigateDamage(skillBaseDamage(false, monDef, elemMult) * mult, ...defOf(monDef));
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
        const dmg = mitigateDamage(skillBaseDamage(false, mDef, elemMult) * mult, ...defOf(mDef));
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
    const dmg = mitigateDamage(state.matk * dmgMult * elemMult, ...defOf(monDef, 1, true));
    mon.hp -= dmg;
    if (typeof showDamageFloatAt === 'function') showDamageFloatAt(mon.id, '-' + dmg, 'normal', sk.element || null);
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
  const dmg = mitigateDamage(skillBaseDamage(false, monDef, 1) * state.spearCounterMult, ...defOf(monDef));
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
  const dmg = mitigateDamage(skillBaseDamage(false, monDef, 1) * state.spearBoomerangMult, ...defOf(monDef));
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
  const dmg = mitigateDamage(skillBaseDamage(false, monDef, 1) * state.chargeRandomMult, ...defOf(monDef));
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
    const dmg = mitigateDamage(state.matk * state.onHitAoeProcMult * elemMult, ...defOf(monDef, 1, true));
    mon.hp -= dmg;
    wakeIfFrozen(mon);
    combatLogBuf.push(`  → 對 ${monDef.name} 造成 ${dmg} 點傷害！`);
    if (typeof showDamageFloatAt === 'function') showDamageFloatAt(mon.id, '-' + dmg, 'normal', state.onHitAoeProcElement || null);
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
    const dmg = mitigateDamage((state.onAttackAoeFlatDmg + state.matk * state.onAttackAoeMult) * elemMult, ...defOf(monDef, 1, true));
    mon.hp -= dmg;
    wakeIfFrozen(mon);
    combatLogBuf.push(`  → 對 ${monDef.name} 造成 ${dmg} 點傷害！`);
    if (typeof showDamageFloatAt === 'function') showDamageFloatAt(mon.id, '-' + dmg, 'normal', state.onAttackAoeElement || null);
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
    const dmg = mitigateDamage(state.matk * state.onHitAoeStunMult * elemMult, ...defOf(monDef, 1, true));
    mon.hp -= dmg;
    wakeIfFrozen(mon);
    if (Math.random() * 100 < state.onHitAoeStunStunChance) applyStun(mon, state.onHitAoeStunStunSec, true);
    combatLogBuf.push(`  → 對 ${monDef.name} 造成 ${dmg} 點傷害！`);
    if (typeof showDamageFloatAt === 'function') showDamageFloatAt(mon.id, '-' + dmg, 'normal', state.onHitAoeStunElement || null);
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
    // 出血持續傷害：每秒扣最大HP的固定比例
    tickBleed();
    // 玩家身上的中毒／出血，順便清掉過期的異常狀態
    tickPlayerAilments();
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
              const dmg = mitigateDamage(state.matk * f.mult * elemMult, ...defOf(monDef, 1, true));
              mon.hp -= dmg;
              wakeIfFrozen(mon);
              if (f.stunChance && Math.random() * 100 < f.stunChance) applyStun(mon, f.stunSec || 1, true);
              combatLogBuf.push(`  → 「${f.name}」對 ${monDef.name} 造成 ${dmg} 點傷害！`);
              // 場地魔法（隕石術、十字驅魔…）每一跳也照屬性上色
              if (typeof showDamageFloatAt === 'function') showDamageFloatAt(mon.id, '-' + dmg, 'normal', f.element || 'holy');
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
              const dmg = mitigateDamage(state.matk * f.mult * elemMult, ...defOf(monDef, 1, true));
              mon.hp -= dmg;
              wakeIfFrozen(mon);
              combatLogBuf.push(`  → 「${f.name}」對 ${monDef.name} 造成 ${dmg} 點持續傷害！`);
              if (typeof showDamageFloatAt === 'function') showDamageFloatAt(mon.id, '-' + dmg, 'normal', f.element || null);
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
      // 昏迷／冰凍／石化／睡眠／混亂：不能攻擊。累積器照樣扣，不然解除的瞬間會一口氣連打
      if (playerImmobile()) continue;
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

/* ---------------- 自然回復 ----------------
   官方 pre-RE 的自然回復是**按 tick 給量**：
     HP：每 6 秒回 MaxHP/200 + VIT/5
     SP：每 8 秒回 MaxSP/100 + INT/6
   本作的迴圈是每秒跑一次，所以把官方的量除以 tick 長度換算成每秒速率。

   `REGEN_IDLE_SCALE` 是放置遊戲的加速倍率。改成官方節奏之前這裡是
   `MaxHP×1.5% + VIT×0.15` **每秒**，實測相當於官方的 14~17 倍——
   Lv99 角色 65 秒回滿，而且回血比全遊戲任何一隻怪的輸出都快，站著不動打不死。
   調難度只要改這一個數。 */
const REGEN_IDLE_SCALE = 3.5;
const REGEN_HP_TICK_SEC = 6;
const REGEN_SP_TICK_SEC = 8;
function passiveRegen() {
  // 卡片的「HP/SP恢復力+N%」加成
  const regenMult = (state.hpRegenMult || 1) * (1 + (state.cardHpRegenPct || 0) / 100);
  const hpPerTick = state.maxHp / 200 + state.stats.vit / 5;
  const hpRegen = Math.max(1, Math.ceil(hpPerTick / REGEN_HP_TICK_SEC * REGEN_IDLE_SCALE * regenMult));
  /* 禪心：官方是「每個 SP tick +3~30」，所以跟基底一樣要除以 tick 長度，
     不然一個技能就蓋過整條自然回復。百分比那項同理。 */
  const zenFlat = state.zenSpFlatBonus || 0;
  const zenPct = state.maxSp * ((state.zenSpPctBonus || 0) / 100);
  const spPerTick = state.maxSp / 100 + state.stats.int / 6 + zenFlat + zenPct;
  // 聖母之頌歌buff：SP恢復速度倍率
  const sprateMult = buffMult('sprate').mult;
  const spRegen = Math.max(1, Math.ceil(spPerTick / REGEN_SP_TICK_SEC * REGEN_IDLE_SCALE
    * (state.spRegenMult || 1) * sprateMult * (1 + (state.cardSpRegenPct || 0) / 100)));
  // 出血：官方規則，出血期間 HP/SP 完全不會自然回復
  if (playerNoRegen()) return;
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
  // 卡片的攻速走這一層：官方把卡片跟裝備的攻速%放同一條乘算，跟技能/藥水那層是分開的
  let equipAspdPct = getCardBonus('aspdPct') / 100;
  let aspdFlatBonus = (state.passiveAspdFlat || 0) + getCardBonus('aspdFlat');
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
/* 玩家的有效命中。黑暗會讓它下降（官方 −25%），所以所有命中判定都吃得到。 */
function effectiveHitWithBuff() {
  return (state.hit + buffMult('hit').flatBonus) * (1 + playerAilPct('hitPct') / 100);
}
/* 迴避的 buff 版本。以前 buff_flee 類技能會 push 一個 type:'flee' 的 buff，
   但迴避判定直接讀 state.flee，那個 buff 從來沒有人去讀——等於推了個空的。
   跟 effectiveHitWithBuff() 同樣的處理方式，在使用端套上去。 */
function effectiveFleeWithBuff() {
  const b = buffMult('flee');
  return Math.round(state.flee * b.mult) + b.flatBonus;
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

/* 追加傷害段（拳刃附加、二刀連擊、怒爆之火）的飄字。
   logMsg 那邊的飄字判斷只認「你…造成 N 點傷害」這種句型，這幾段的訊息格式不同，
   所以抓不到、怪物頭上一直沒有數字。與其去改訊息文字（那條規則很脆），
   在這裡直接叫飄字比較清楚。isCrit 由主攻擊那一次判定帶進來。 */
/* 官方普攻傷害鏈的前半段（傷害公式 C 案）。
   體型修正、屬性倍率、武器浮動這三個只作用在**武器 ATK**上，
   素質 ATK 與熟練度固定加成不吃這些修正，是在最後才加進去的。

   武器浮動改成以 1.0 為中心、擺動幅度依武器等級（±武器等級×5%）。
   官方的浮動是「武器 ATK 上下擺」，等級越高的武器擺得越大；
   以前是不分來源一律 0.85~1.15 乘在總傷害上，跟武器等級無關。

   浮動中心照參考計算機取 `1 + 總STR/200`（2026-08-03 由使用者決定改回計算機版本）。
   這一項單獨就讓整體傷害再 +11%，性質上比較接近「額外的 STR 收益」而不是浮動，
   而且 STR 已經在素質 ATK 賺過一次——這是刻意跟計算機對齊的選擇，不是漏算。
   總 STR 含裝備／卡片／職業加成（`state._totalStr`，在 recomputeDerived 算好）。

   回傳「還沒套 buff／暴擊／卡片增傷／DEF」的基礎傷害。 */
function weaponChainDamage(monDef, elemMult, roll) {
  const wpn = state._atkWeapon || 0;
  const nonWpn = (state._atkStatus || 0) + (state._atkMastery || 0);

  const wId = getEquipBaseItemId('weapon');
  const w = wId ? ITEMS[wId] : null;
  const wLv = w ? (typeof getRefineWeaponLv === 'function' ? getRefineWeaponLv(w) : (w.weaponLv || 1)) : 1;

  const mid = 1 + (state._totalStr || 0) / 200;
  const swing = wLv * 0.05;
  // roll：true=鎖最大值（武器值最大化 buff）、'mid'=取中間值（產出估算用，不要隨機）、其餘=正常浮動
  const variance = roll === true ? (mid + swing)
    : roll === 'mid' ? mid
    : (mid - swing + Math.random() * swing * 2);

  // 詛咒：玩家 ATK 下降（官方 −25%），整包 ATK 都吃
  return (wpn * variance * getSizeMultiplier(monDef) * elemMult + nonWpn) * playerAilAtkMult();
}

/* 技能傷害的基底，跟普通攻擊走同一條官方鏈。

   以前技能是 `state.atk × 技能倍率 × 屬性 × 體型`——等於整包 ATK（含素質 ATK 與熟練度）
   都被體型／屬性修正一起乘。#12 只改了普通攻擊，所以同一個角色身上跑著兩套規則：
   普攻的體型懲罰只吃武器 ATK，技能卻吃全部。素質 ATK 佔比越高的職業偏差越大。

   物理技能改成 weaponChainDamage()（體型／屬性／武器浮動只作用在武器 ATK），
   技能倍率乘在整條鏈之後——官方就是這個順序。
   魔法技能沒有武器浮動也不吃體型，維持 MATK × 屬性。

   呼叫端要注意：改用本函式之後就不可以再自己乘一次 elemMult 或 getSizeMultiplier()。 */
function skillBaseDamage(useMag, monDef, elemMult) {
  if (useMag) return state.matk * elemMult;
  return weaponChainDamage(monDef, elemMult, state.buffs.some(b => b.type === 'maxroll'));
}

function showExtraHitFloat(dmg, isCrit) {
  if (typeof showDamageFloat === 'function') showDamageFloat('-' + dmg, isCrit ? 'crit' : 'normal');
  if (typeof triggerMonsterHit === 'function') triggerMonsterHit(!!isCrit);
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
  // 攻擊動畫（音效分兩種：被閃過放揮空、打中放命中，各自在下面觸發）
  if (typeof playAttackAnim === 'function') playAttackAnim();
  const target = state.monsters[0]; // 攻擊第一隻怪物
  const monDef = MONSTERS[target.defId];
  // 官方RO規則：普通攻擊一律使用物理ATK（不看職業），只有主動施放的技能才會用MATK
  // 之前用 job.matkMod > job.atkMod 判斷，導致法師/巫師/見習修女/祭司的普通攻擊誤用MATK計算

  // Calculate effective crit rate with buff
  const critBuff = buffMult('crit');
  // 卡片對特定種族的 CRI 加點（玩具士兵對動物+7 那一類），只在打到該種族時才算
  let raceCrit = (monDef.race && state.cardRaceCrit && state.cardRaceCrit[monDef.race]) || 0;
  // 茅膏菜卡片：遠程攻擊時 CRI+15，本作以裝弓為準
  if (state.cardRangedCritRate && isBowWeapon(getEquipBaseItemId('weapon'))) raceCrit += state.cardRangedCritRate;
  const effectiveCritRate = Math.min(100, state.critRate * critBuff.mult + critBuff.flatBonus + raceCrit);
  const isCrit = Math.random() * 100 < effectiveCritRate;
  if (!isCrit) {
    const hitPct = hitChancePctVsMonster(effectiveHitWithBuff(), monDef, target);
    if (Math.random() * 100 > hitPct) {
      logMsg(`你的攻擊被 ${monDef.name} 閃避了！`);
      // 揮空音效
      if (typeof playAttackSound === 'function') playAttackSound();
      // 攻擊 MISS 飄字（玩家頭上）
      if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
      return;
    }
  }

  /* ---- 官方傷害鏈（C 案）----
     以前是「總 ATK 一路乘上體型、屬性、浮動」，但官方那三個修正**只作用在武器 ATK**上，
     素質 ATK 與熟練度加成是在那之後才加進去的。差別在素質 ATK 約佔總 ATK 四成，
     舊寫法等於讓那四成也一起吃體型懲罰與屬性被剋的懲罰。 */
  const atkWeaponId = getEquipBaseItemId('weapon');
  const weapon = atkWeaponId ? ITEMS[atkWeaponId] : null;

  // 屬性相剋：武器屬性 vs 怪物屬性（弓由箭矢決定）
  let atkElement = (weapon && weapon.element) ? weapon.element : 'none';
  if (isBowWeapon(atkWeaponId)) {
    const ammo = getEquippedAmmo();
    if (ammo && ammo.element) atkElement = ammo.element;
  }
  if (state.buffs.some(b => b.type === 'holyweapon')) atkElement = 'holy';
  const elemMult = getElementMultiplierVsMonster(atkElement, monDef);
  if (elemMult !== 1) {
    const pctStr = Math.round(elemMult * 100);
    const tag = elemMult > 1 ? '💚 屬性克制！' : (elemMult < 1 && elemMult > 0 ? '💜 屬性被克…' : (elemMult === 0 ? '🚫 屬性免疫！' : ''));
    if (tag) logMsg(`${tag} ${ELEMENT_NAMES[atkElement]}攻 → ${ELEMENT_NAMES[monDef.element || 'none']}防 (${pctStr}%)`);
    if (typeof showElementFloat === 'function') showElementFloat(target.id, atkElement, elemMult);
  }

  const hasMaxRoll = state.buffs.some(b => b.type === 'maxroll');
  let raw = weaponChainDamage(monDef, elemMult, hasMaxRoll);

  raw *= buffMult('atk').mult;
  // 狂暴狀態：HP < 25% 時 ATK +32%
  if (state.hasBerserk && state.hp < state.maxHp * 0.25) {
    raw *= 1.32;
  }
  // 暴擊 1.5 倍，卡片的「暴擊時傷害增加N%」再乘上去（紙妖、無顱武士那類）
  if (isCrit) raw *= 1.5 * (1 + (state.cardCritDmgPct || 0) / 100);
  // 遠距離物理傷害加成：官方限定遠程武器，本作以弓為準（邪骸弓箭手卡片）
  if (state.cardRangedDmgPct && isBowWeapon(atkWeaponId)) {
    raw *= 1 + state.cardRangedDmgPct / 100;
  }

  // 天使之怒被動：冷卻好時下一次攻擊必定雙倍傷害
  if (state.hasAngelusProc && Date.now() >= (state.angelusReadyAt || 0)) {
    raw *= 2;
    state.angelusReadyAt = Date.now() + (state.angelusCooldownSec || 10) * 1000;
    logMsg('😠 天使之怒發動！本次傷害雙倍！');
  }

  // 卡片增傷：對特定屬性/種族/體型的怪物額外增傷
  raw *= cardTargetDmgMult(monDef);
  // 異常狀態：睡眠中的目標受到的傷害增加（官方規則）
  raw *= ailDmgTakenMult(target);

  // Apply monster debuff (provoke reduces defense)
  // 異常狀態對防禦的修正（石化 +25%、中毒 −25%）跟破防 debuff 疊乘
  const ailDef = ailDefMult(target);
  let monDefVal = monDef.def * ailDef;
  let monSoftVal = (monDef.defSoft || 0) * ailDef;
  if (target.debuffDef && target.debuffDefEnd && Date.now() < target.debuffDefEnd) {
    monDefVal = Math.round(monDefVal * target.debuffDef);
    monSoftVal = Math.round(monSoftVal * target.debuffDef);
  } else {
    delete target.debuffDef;
    delete target.debuffDefEnd;
  }

  // 官方暴擊無視 DEF（也無視閃避）。以前暴擊照常吃減傷，等於只剩 1.5 倍那半邊效果，
  // 對高 DEF 的怪打起來跟普通攻擊差不了多少
  const dmg = (isCrit ? Math.max(1, Math.round(raw)) : mitigateDamage(raw, monDefVal, monSoftVal)) + raceFlatBonus(monDef);
  if (isCrit && !_dpsPaused && state && state.dpsTracker) state.dpsTracker.damage += dmg;
  target.hp -= dmg;
  logMsg(`你對 ${monDef.name} 造成 ${dmg} 點傷害${isCrit ? '（暴擊！無視閃避與防禦）' : ''}`);
  applyCardLeech(dmg);
  ailBreakOnDamage(target, monDef);   // 睡眠被打就醒
  tryCardAilments('attack', target);
  tryAutoSpells('attack', target);
  // 命中音效（暴擊改放 Critical.ogg）
  if (typeof playHitSound === 'function') playHitSound(isCrit);

  if (target.hp <= 0) {
    killMonster(monDef, target);
    return;
  }

  // 拳刃：普攻命中後附加一段傷害（本作 21%），獨立跳字、獨立放命中音效。
  // 暴擊與否跟著主攻擊那一次判定走（官方一次普攻只擲一次暴擊），
  // 所以 raw 裡已經含 ×1.5，這裡只要讓飄字與音效也用暴擊那一套。
  if (state._katarEquipped) {
    const katarDmg = mitigateDamage(raw * (KATAR_BONUS_DMG_PCT / 100), monDefVal, monSoftVal);
    target.hp -= katarDmg;
    logMsg(`🗡️ 拳刃附加了 ${katarDmg} 點傷害！${isCrit ? '（暴擊）' : ''}`);
    showExtraHitFloat(katarDmg, isCrit);
    if (typeof playHitSound === 'function') playHitSound(isCrit);
    if (target.hp <= 0) {
      killMonster(monDef, target);
      return;
    }
  }

  // 怒爆之火：普攻期間額外附加一段火屬性傷害
  const magnumBuff = state.buffs.find(b => b.type === 'magnumfire');
  if (magnumBuff) {
    const fireMult = getElementMultiplierVsMonster('fire', monDef);
    const bonusDmg = mitigateDamage(skillBaseDamage(false, monDef, fireMult) * magnumBuff.flatBonus, monDefVal, monSoftVal);
    target.hp -= bonusDmg;
    logMsg(`🔥 怒爆之火附加了 ${bonusDmg} 點火屬性傷害！`);
    // 這段是獨立的火屬性傷害，不吃主攻擊的暴擊
    showExtraHitFloat(bonusDmg, false);
    if (target.hp <= 0) {
      killMonster(monDef, target);
      return;
    }
  }

  /* 二刀連擊：技能版官方限定短劍才會觸發（拿拳刃／劍都不會動）。
     黑蛇卡片給的那份不受武器限制——那張卡本來就是給拿不了短劍的職業用的，
     而且卡片說明寫「習得二刀連擊後依技能等級決定機率」，所以兩者取等級高的那個。 */
  const daSkillLv = state.learnedSkills['doubleattack'] || 0;
  const daFromCard = !!state.hasSideWinderDoubleAttack;
  const daByWeapon = daSkillLv > 0 && isDaggerWeapon(atkWeaponId);
  const daLv = Math.max(daSkillLv, daFromCard ? 1 : 0);
  if (daLv > 0 && (daFromCard || daByWeapon)) {
    // 只靠卡片觸發時玩家可能根本不是盜賊系，findSkillById() 查不到，要直接翻技能表
    const daSkill = findSkillById('doubleattack') || JOB_TREE.thief.skills.find(s => s.id === 'doubleattack');
    const daChance = daSkill && daSkill.doubleAttackChance ? daSkill.doubleAttackChance[daLv - 1] : 7;
    if (Math.random() * 100 < daChance) {
      const daMult = daSkill && daSkill.mult ? daSkill.mult[daLv - 1] : 1.0;
      const daRaw = raw * daMult;
      const daDmg = mitigateDamage(daRaw, monDefVal, monSoftVal);
      target.hp -= daDmg;
      // 第二段跟第一段是同一次暴擊判定（daRaw 由 raw 推導，已含 ×1.5）
      logMsg(`⚔️ 二刀連擊！對 ${monDef.name} 造成 ${daDmg} 點傷害！${isCrit ? '（暴擊）' : ''}`);
      showExtraHitFloat(daDmg, isCrit);
      if (typeof playHitSound === 'function') playHitSound(isCrit);
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
    // 原本靠 weaponType==='mace' 或名字有「斧」來認，會漏掉分類正確但名字沒斧字的武器；
    // 現在統一走 weaponCat 的分類表
    if (weaponReqMet('axemace')) {
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
      const dmg = mitigateDamage(skillBaseDamage(false, mDef, elemMult) * state.venominfusionDmgMult, ...defOf(mDef));
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
      let bbDmg = mitigateDamage(skillBaseDamage(false, monDef, bbElemMult) * passiveMultVal, ...defOf(monDef));
      if (state.falconFlatBonus) bbDmg += state.falconFlatBonus;
      target.hp -= bbDmg;
      logMsg(`🦅 獵鷹突襲！對 ${monDef.name} 造成 ${bbDmg} 點傷害！`);
      if (target.hp <= 0) killMonster(monDef, target);
    }
  }
}

/* 怪物施放技能。取代那一次普通攻擊，走跟普攻同一條減傷鏈，
   差別在：帶技能倍率、可能帶屬性、可能對玩家掛異常狀態。

   本作的怪物沒有 MATK 資料，魔法類就用 ATK × 倍率 再多給 20%，
   並且**跳過迴避判定**（官方魔法無視閃避）。 */
function monsterCastSkill(mon, monDef, sk) {
  const nameOf = () => `${monDef.name} 的「${MOB_SKILL_NAMES[sk.s] || sk.s}」`;

  // 自我回復類：不打人，補自己
  if (sk.heal) {
    const before = mon.hp;
    mon.hp = Math.min(mon.maxHp, mon.hp + Math.round(mon.maxHp * sk.heal));
    if (mon.hp > before) logMsg(`💚 ${nameOf()}：回復了 ${mon.hp - before} 點HP！`);
    return;
  }

  // 命中判定：魔法無視閃避，物理照常擲
  if (!sk.magic) {
    if (Math.random() * 100 < state.perfectDodge) {
      logMsg(`你完全迴避了 ${nameOf()}！`);
      if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
      return;
    }
    let hitDebuff = 0;
    const blindMult = ailHitMult(mon);
    // 同理：黑暗打折的是怪物的 HIT，fleeReq = 怪物HIT + 75，先剝掉偏移再折
  if (blindMult < 1) hitDebuff += Math.round(((monDef.fleeReq || monsterHitOf(monDef)) - REQ_FLEE_OFFSET) * (1 - blindMult));
    // 冰凍／睡眠中的玩家必定被打中
    if (!playerAlwaysHit()) {
      let dodgePct = dodgeChancePctFromMonster(effectiveFleeWithBuff(), monDef, hitDebuff);
      dodgePct = Math.max(0, dodgePct + playerAilPct('fleePct'));   // 黑暗讓玩家更難閃
      if (Math.random() * 100 < dodgePct) {
        logMsg(`你迴避了 ${nameOf()}！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        return;
      }
    }
  }

  let dmg = 0;
  if (sk.mult > 0) {
    let raw = monsterBaseAtk(monDef) * sk.mult * (sk.magic ? 1.2 : 1);
    raw *= ailAtkMult(mon);                                   // 詛咒讓怪物 ATK 下降
    raw *= getElementMultiplier(sk.elem || monDef.element || 'none', 'none');
    raw *= playerAilDmgTakenMult();                           // 睡眠中受到的傷害增加
    // 卡片的屬性/種族/體型減傷跟普攻共用同一組
    const el = sk.elem || monDef.element || 'none';
    if (state.cardEleDmgReduce && state.cardEleDmgReduce[el]) raw *= (1 - state.cardEleDmgReduce[el]);
    if (monDef.race && state.cardRaceDmgReduce && state.cardRaceDmgReduce[monDef.race]) raw *= (1 - state.cardRaceDmgReduce[monDef.race]);
    let hardDef = state.defHard, softDef = state.defSoft;
    // 狂暴狀態：DEF -55%（硬軟一起打折）
    if (state.hasBerserk && state.hp < state.maxHp * 0.25) {
      hardDef = Math.round(hardDef * 0.45); softDef = Math.round(softDef * 0.45);
    }
    dmg = mitigatePlayerIncoming(raw, hardDef, softDef);
    state.hp -= dmg;
    logMsg(`✨ ${nameOf()} 造成了 ${dmg} 點傷害！`);
    if (typeof showPlayerFloat === 'function') showPlayerFloat('-' + dmg, 'normal');
    playerAilBreakOnDamage();
  } else {
    logMsg(`✨ ${nameOf()} 發動了！`);
  }

  // 附加的異常狀態
  if (sk.ail) applyPlayerAilment(sk.ail);

  // 自爆：打完自己也死
  if (sk.suicide) {
    logMsg(`💥 ${monDef.name} 自爆了！`);
    mon.hp = 0;
    killMonster(monDef, mon);
  }

  if (state.hp <= 0) {
    state.hp = 0;
    if (tryAutoRevive()) return;
    onPlayerDown();
  }
}

// 官方技能代碼 → 看得懂的名字（只列會用到的，沒列到的直接顯示代碼）
const MOB_SKILL_NAMES = {
  NPC_STUNATTACK: '暈眩攻擊', NPC_CURSEATTACK: '詛咒攻擊', NPC_BLINDATTACK: '黑暗攻擊',
  NPC_SILENCEATTACK: '沉默攻擊', NPC_SLEEPATTACK: '催眠攻擊', NPC_PETRIFYATTACK: '石化攻擊',
  NPC_HALLUCINATION: '幻覺', NPC_CRITICALWOUND: '致命傷', NPC_POISON: '施毒', NPC_POISONATTACK: '毒屬性攻擊',
  TF_POISON: '施毒', NPC_WIDECURSE: '範圍詛咒', NPC_WIDESILENCE: '範圍沉默', NPC_WIDESTUN: '範圍暈眩',
  NPC_WIDESLEEP: '範圍催眠', NPC_WIDECONFUSE: '範圍混亂', NPC_WIDEBLEEDING: '範圍出血',
  MG_FROSTDIVER: '冰凍術', MG_STONECURSE: '石化術', PR_LEXDIVINA: '神聖懲罰',
  NPC_FIREATTACK: '火屬性攻擊', NPC_WATERATTACK: '水屬性攻擊', NPC_WINDATTACK: '風屬性攻擊',
  NPC_GROUNDATTACK: '地屬性攻擊', NPC_DARKNESSATTACK: '暗屬性攻擊', NPC_UNDEADATTACK: '不死屬性攻擊',
  NPC_HOLYATTACK: '聖屬性攻擊', NPC_TELEKINESISATTACK: '念屬性攻擊',
  MG_FIREBOLT: '火箭術', MG_FIREBALL: '火球術', MG_COLDBOLT: '冰箭術', MG_LIGHTNINGBOLT: '雷電術',
  MG_THUNDERSTORM: '雷爆術', MG_SOULSTRIKE: '聖靈召喚', MG_NAPALMBEAT: '心靈爆破',
  WZ_METEOR: '隕石術', WZ_FIREPILLAR: '火柱攻擊', WZ_WATERBALL: '水球術', WZ_JUPITEL: '朱庇特之雷',
  WZ_HEAVENDRIVE: '大地之怒', WZ_EARTHSPIKE: '地面尖刺', WZ_STORMGUST: '暴風雪',
  NPC_MAGICALATTACK: '魔法攻擊', NPC_DARKSTRIKE: '暗之攻擊', NPC_DARKBREATH: '暗之吐息',
  NPC_CRITICALSLASH: '致命一擊', NPC_COMBOATTACK: '連續攻擊', NPC_SPLASHATTACK: '範圍攻擊',
  NPC_PIERCINGATT: '貫穿攻擊', NPC_GUIDEDATTACK: '必中攻擊', NPC_RANGEATTACK: '遠距攻擊',
  NPC_PULSESTRIKE: '波動衝擊', NPC_SELFDESTRUCTION: '自爆',
  SM_BASH: '狂擊', SM_MAGNUM: '怒爆之火', AS_SONICBLOW: '音速投擲', KN_PIERCE: '刺穿',
  KN_BOWLINGBASH: '弓箭陣', KN_BRANDISHSPEAR: '騎乘攻擊', MO_EXTREMITYFIST: '阿修羅霸凰拳',
  LK_SPIRALPIERCE: '螺旋刺擊', AC_DOUBLE: '二連矢', AC_SHOWER: '箭雨', MC_MAMMONITE: '金錢攻擊',
  ASC_METEORASSAULT: '流星墜擊', NPC_WIDESOULDRAIN: '吸魂', NPC_FIREBREATH: '火之吐息',
  NPC_ICEBREATH: '冰之吐息', NPC_THUNDERBREATH: '雷之吐息', NPC_ACIDBREATH: '酸性吐息',
  AL_HEAL: '治癒術', AM_POTIONPITCHER: '藥水製造',
};

// 單一怪物攻擊
function monsterAttackSingle(mon) {
  const monDef = MONSTERS[mon.defId];

  // 無法行動類的異常狀態（昏迷／冰凍／石化／睡眠／混亂）都寫在 stunnedUntil 上
  if (mon.stunnedUntil && Date.now() < mon.stunnedUntil) {
    const by = ailList(mon).filter(t => MON_AILMENTS[t].immobile)[0];
    const A = by ? MON_AILMENTS[by] : MON_AILMENTS.stun;
    logMsg(`${A.icon} ${monDef.name} 還在${A.name}中，無法攻擊！`);
    return;
  }

  // 怪物技能：擲中就用技能取代這一次普通攻擊
  const mSkill = monsterSkillFor(mon, monDef);
  if (mSkill) { monsterCastSkill(mon, monDef, mSkill); return; }

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
  // 黑暗：怪物命中下降，換算成同一個門檻扣減
  const blindMult = ailHitMult(mon);
  // 同理：黑暗打折的是怪物的 HIT，fleeReq = 怪物HIT + 75，先剝掉偏移再折
  if (blindMult < 1) hitDebuff += Math.round(((monDef.fleeReq || monsterHitOf(monDef)) - REQ_FLEE_OFFSET) * (1 - blindMult));
  const dodgePct = dodgeChancePctFromMonster(effectiveFleeWithBuff(), monDef, hitDebuff);
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
    const counterDmg = mitigateDamage(skillBaseDamage(false, monDef, 1) * state.poisonReactMult, ...defOf(monDef));
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
      const counterDmg = mitigateDamage(skillBaseDamage(false, monDef, 1) * 1.5, ...defOf(monDef));
      mon.hp -= counterDmg;
      logMsg(`⚔️ 反擊造成 ${counterDmg} 點傷害（暴擊）！`);
      if (mon.hp <= 0) {
        killMonster(monDef, mon);
      }
      return;
    }
  }

  let raw = monsterBaseAtk(monDef);
  // 詛咒：怪物 ATK 下降
  raw *= ailAtkMult(mon);

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
  // 卡片體型減傷（獸牙怪卡片：受到中型魔物傷害-25%）
  if (monDef.size && state.cardSizeDmgReduce && state.cardSizeDmgReduce[monDef.size]) {
    raw *= (1 - state.cardSizeDmgReduce[monDef.size]);
  }
  // 愛麗絲女僕卡片那種取捨型：對首領類大幅減傷，對一般怪反而增傷
  if (monDef.isBoss) {
    if (state.cardBossDmgTakenPct) raw *= (1 + state.cardBossDmgTakenPct / 100);
  } else if (state.cardNormalDmgTakenPct) {
    raw *= (1 + state.cardNormalDmgTakenPct / 100);
  }

  let hardDef = state.defHard, softDef = state.defSoft;
  // 天使之護：官方效果限定對惡魔/不死種族攻擊者生效（裝備類加成 → 硬防）
  if (state.divineDefBonus && (monDef.race === 'demon' || monDef.race === 'undead')) {
    hardDef += state.divineDefBonus;
  }
  // 狂暴狀態：DEF -55%
  if (state.hasBerserk && state.hp < state.maxHp * 0.25) {
    hardDef = Math.round(hardDef * 0.45); softDef = Math.round(softDef * 0.45);
  }

  let dmg = mitigatePlayerIncoming(raw, hardDef, softDef);
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
  // 卡片的受擊反擊型異常狀態（惡魔女僕那一大類「受到物理傷害時讓敵人得到XX」）
  tryCardAilments('hit', mon);
  // 卡片自動念咒（受擊觸發）：放在最後，此時玩家確定還活著、傷害也結算完了
  tryAutoSpells('hit', mon);
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
  // 卡片的種族經驗加成（狂暴野豬那一組：擊殺該族經驗+10%，代價是被該族打得更痛）
  const expMult = 1 + ((def.race && state.cardExpRace && state.cardExpRace[def.race]) || 0);
  const gotExp = Math.round(def.exp * expMult);
  const gotJobExp = Math.round(def.jobExp * expMult);
  logMsg(`擊敗了 ${def.name}！獲得 ${gotExp} 經驗與 ${gotJobExp} 職業經驗。`);
  codexRecordKill(monKey);
  gainExp(gotExp, gotJobExp);
  const goldGain = Math.round((3 + def.level * 1.4) * buffMult('gold').mult);
  state.gold += goldGain;
  if (state.dpsTracker) {
    const t = state.dpsTracker;
    t.kills++; t.exp += gotExp; t.jobExp += gotJobExp; t.gold += goldGain;
  }
  // 卡片：近距離擊殺某種族回 SP（官方限定近戰，本作以「沒裝弓」為準）
  const spKill = (def.race && state.cardSpOnKillRace && state.cardSpOnKillRace[def.race]) || 0;
  if (spKill && !isBowWeapon(getEquipBaseItemId('weapon'))) {
    state.sp = Math.min(state.maxSp, state.sp + spKill);
  }
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
  // 卡片附加掉落（箱子、料理、精煉素材那一批）
  tryCardKillDrops(def);
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

/* ---------------- 自動念咒 ----------------
   官方卡片有一大類是「攻擊時／受擊時，有一定機率自動施放某個技能」。
   資料寫在 CARDS[x].autoSpell（陣列，一張卡可以有多條）：

     autoSpell: [{ on: 'attack', skill: 'firebolt', lv: 5, chance: 5 }]

     on      'attack' 普通攻擊命中之後／'hit' 被怪物打到之後
     skill   技能 id，不必是本職業的、玩家也不必學過
     lv      施放等級（卡片寫幾級就幾級），會夾在該技能的 maxLv 內
     chance  觸發機率（%）

   施放走 castSkill(id, { free:true, forceLv }) ——不吃 SP/HP/鋅幣、不看武器限制、
   也不寫入冷卻，因為那些都是玩家自己的資源，不該被卡片的被動觸發消耗掉。
------------------------------------------------- */
function tryAutoSpells(trigger, mon) {
  const list = state.cardAutoSpells && state.cardAutoSpells[trigger];
  if (!list || !list.length) return;
  for (const e of list) {
    if (Math.random() * 100 >= e.chance) continue;
    const sk = findSkillAnywhere(e.skill);
    if (!sk) continue;
    // 增益類已經在身上就別再放：自動念咒沒有冷卻與SP擋著，不擋的話護盾/buff 會無限疊。
    // 判斷方式跟 tryAutoCastSupportSkills() 一致，用 skillId 而不是 type。
    if (sk.type === 'buff_shield' && state.shields && state.shields.some(sh => sh.id === sk.id)) continue;
    if (state.buffs && state.buffs.some(b => b.skillId === sk.id)) continue;

    // 本作把火狩／泥沼地／冰凍術／天使之怒做成了被動（passiveStat），castSkill() 放不出來，
    // 改成直接套用那個被動原本的效果一次
    const ok = sk.type === 'passive'
      ? applyPassiveSkillOnce(sk, e.lv, trigger, mon)
      : castSkill(e.skill, { free: true, forceLv: e.lv });
    if (ok) logMsg(`🎴 自動念咒！${sk.name} Lv${e.lv} 發動！`);
  }
}

/* 把「做成被動」的技能當成一次性效果放出來。
   本作有幾個官方技能被實作成常駐被動（例：冰凍術是「被攻擊時機率凍結攻擊者」），
   卡片的自動念咒卻是要「主動放一次」，所以在這裡把該被動的效果抽出來單獨觸發。
   trigger='attack' 時目標是正在打的那隻怪，'hit' 時是打你的那隻。 */
function applyPassiveSkillOnce(sk, lv, trigger, mon) {
  const target = mon || (state.monsters && state.monsters[0]);
  const monDef = target ? MONSTERS[target.defId] : null;
  const pick = (f, d) => (Array.isArray(sk[f]) ? sk[f][lv - 1] : sk[f]) ?? d;

  switch (sk.passiveStat) {
    // 冰凍術：凍結目標並造成 MATK 比例的魔法傷害（跟 tryMagicStunProcs 同一套處理）
    case 'onHitMagicStunProc': {
      if (!target || !monDef) return false;
      applyStun(target, pick('stunSec', 10), true);
      target.frozenByProc = true;
      const elemMult = getElementMultiplierVsMonster(sk.element || 'none', monDef);
      const dmg = mitigateDamage(state.matk * pick('mult', 0.5) * elemMult, ...defOf(monDef, 1, true));
      target.hp -= dmg;
      logMsg(`❄️ ${monDef.name} 被凍結，並受到 ${dmg} 點魔法傷害！`);
      if (target.hp <= 0) killMonster(monDef, target);
      return true;
    }
    // 泥沼地：暈眩目標
    case 'onHitStunProc2':
    case 'onHitStunProc': {
      if (!target || !monDef) return false;
      applyStun(target, pick('stunSec', 0.5), true);
      logMsg(`💫 ${monDef.name} 暈眩了！`);
      return true;
    }
    // 火狩：本作是常駐迴避加成，自動念咒版本給一段限時的等量加成
    case 'fleeFlat': {
      state.buffs.push({ type: 'flee', mult: 1, flatBonus: pick('mult', 10),
        msRemaining: (sk.autoSpellDurationSec || 20) * 1000, skillId: sk.id });
      return true;
    }
    // 天使之怒：讓「下一擊雙倍」立刻就緒
    case 'angelusProc': {
      state.hasAngelusProc = true;
      state.angelusReadyAt = 0;
      state.angelusCooldownSec = sk.angelusCooldownSec || 10;
      return true;
    }
    default:
      return false;
  }
}

/* 全域找技能：findSkillById() 只翻「已轉職過的職業」，自動念咒要放的是別的職業的技能
   （卡片不管你是什麼職業）。技能定義集中在 js/skills.js 的 SKILLS，直接查表就好。 */
function findSkillAnywhere(skillId) {
  return SKILLS[skillId] || null;
}

/* opts.free   ：自動念咒用。跳過「學過沒」「冷卻好沒」「武器對不對」「SP/HP/鋅幣夠不夠」，
                 也不寫入冷卻——那是玩家自己那份資源，不該被卡片的觸發吃掉。
   opts.forceLv：指定施放等級（卡片寫幾級就幾級，跟玩家學到幾級無關），會夾在 1~maxLv。 */
function castSkill(skillId, opts) {
  const free = !!(opts && opts.free);
  const sk = free ? findSkillAnywhere(skillId) : findSkillById(skillId);
  if (!sk) return false;
  // 沉默：完全不能施放技能（連卡片的自動念咒也一起擋，官方沉默就是這樣）
  if (playerSilenced()) { if (!free) logMsg(`🤐 沉默中，無法施放「${sk.name}」！`); return false; }
  let lv;
  if (opts && opts.forceLv) lv = Math.max(1, Math.min(sk.maxLv || opts.forceLv, opts.forceLv));
  else lv = state.learnedSkills[skillId];
  if (!lv) return false;
  if (!free && !skillReady(skillId)) return false;

  // 武器類型限定技能（雙手劍加速、音速投擲、長矛專用技…）：未裝備對應武器時無法施放
  if (!free && !weaponReqMet(sk.requiresWeapon)) {
    logMsg(`⚠️ 「${sk.name}」需要裝備${weaponReqName(sk.requiresWeapon)}才能施放！`);
    return false;
  }

  const spCost = free ? 0 : skillSpCost(sk, lv);
  if (state.sp < spCost) return false;

  // 金錢攻擊：消耗鋅幣才能施放
  let zenyCost = 0;
  if (sk.zenyCost && !free) {
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
  if (sk.hpCost && !free) {
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
  // 自動念咒不寫冷卻：那是玩家自己那份資源，不該被卡片的觸發吃掉
  if (!free) {
    const cd = Array.isArray(sk.cooldown) ? sk.cooldown[lv - 1] : sk.cooldown;
    state.cooldowns[skillId] = cd * 1000;
  }
  // 技能音效與特效：確定放得出來（SP/鋅幣/冷卻都過了）才出聲、才播圖
  if (typeof playSkillSound === 'function') playSkillSound(sk, lv);
  if (typeof showSkillCastEffect === 'function') showSkillCastEffect(sk, lv);

  /* 卡片對「特定技能」的傷害加成（火蜥蜴：隕石術+40%、小雪怪：冰箭術+25%…）。
     乘在 mult 上而不是傷害基底上：直接傷害的 case 都是算 基底 × mult，
     但場地類（隕石術）與持續傷害類（火焰之壁）是把 mult 存進 activeFieldEffects
     之後才結算的，只改基底會漏掉那些。乘 mult 才是唯一涵蓋全部的位置。 */
  const skillDmgPct = getCardBonus('skillDmg_' + sk.id);
  const mult = (Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult) * (1 + skillDmgPct / 100);
  // 'magic_aoe'（例如火球術、雷爆術、光獵、怒雷強擊）先前漏判，導致誤用ATK而非MATK計算傷害
  // 傷害基底一律走 skillBaseDamage(useMag, 怪, 屬性倍率)，物理走官方武器鏈、魔法用 MATK
  const useMag = sk.type === 'magic' || sk.type === 'magic_aoe';

  // 屬性相剋：技能屬性 vs 怪物屬性
  const skElement = sk.element || 'none';

  // 各 case 推 buff 時常忘了標 skillId，導致「同 type 就算已生效」的判斷把不同來源
  // 混為一談（例：喝了集中藥水後，雙手劍加速因為都是 type:'aspd' 而永遠不再自動施放）。
  // 這裡統一在 switch 結束後補標，個別 case 不必再自己寫。
  const buffCountBefore = state.buffs.length;

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
        const hitPct = hitChancePctVsMonster(effectiveHit, def, target);
        if (Math.random() * 100 > hitPct) {
          logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
          if (typeof playAttackSound === 'function') playAttackSound();   // 物理技能揮空
          if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
          break;
        }
      }
      const elemMult = getElementMultiplierVsMonster(skElement, def);
      if (elemMult !== 1) {
        const pctStr = Math.round(elemMult * 100);
        const tag = elemMult > 1 ? '💚 屬性克制！' : (elemMult < 1 && elemMult > 0 ? '💜 屬性被克…' : (elemMult === 0 ? '🚫 屬性免疫！' : ''));
        if (tag) logMsg(`${tag} ${ELEMENT_NAMES[skElement]}攻 → ${ELEMENT_NAMES[def.element || 'none']}防 (${pctStr}%)`);
        if (typeof showElementFloat === 'function') showElementFloat(target.id, skElement, elemMult);
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
      const dmg = mitigateDamage(skillBaseDamage(useMag, def, elemMult) * skillMult * (1 + skEleDmgBonus) * ailDmgTakenMult(target), ...defOf(def, 1, useMag, target)) + raceFlatBonus(def);
      target.hp -= dmg;
      // 單體技能以前完全不飄字（logMsg 的飄字規則只認「你…造成N點傷害」那種普攻句型）
      if (typeof showDamageFloatAt === 'function') showDamageFloatAt(target.id, '-' + dmg, 'normal', useMag ? skElement : null);
      logMsg(`⚡ 「${sk.name}」Lv${lv} 造成 ${dmg} 點傷害！`);
      // 物理技能也是拿武器打的，命中一樣放武器的命中音（法術有自己的音效）
      if (sk.type !== 'magic' && typeof playHitSound === 'function') playHitSound();
      ailBreakOnDamage(target, def);   // 睡眠被打就醒
      // 卡片的「魔法攻擊時對敵人施以XX」
      if (useMag) tryCardAilments('magic', target);
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
          const hitPct = hitChancePctVsMonster(effectiveHitWithBuff(), monDef, mon);
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
        let dmg = mitigateDamage(skillBaseDamage(useMag, monDef, monElemMult) * aoeMult * (1 + monEleDmgBonus) * ailDmgTakenMult(mon), ...defOf(monDef, 1, useMag, mon)) + raceFlatBonus(monDef);
        // 鋼製喙：閃電衝擊額外固定傷害（不受倍率影響）
        if (sk.id === 'blitzbeat' && state.falconFlatBonus) dmg += state.falconFlatBonus;
        mon.hp -= dmg;
        ailBreakOnDamage(mon, monDef);   // 睡眠被打就醒
        if (useMag) tryCardAilments('magic', mon);
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
        if (typeof showDamageFloatAt === 'function') showDamageFloatAt(mon.id, '-' + dmg, 'normal', useMag ? skElement : null);
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
      state.buffs.push({ type: 'blessing', strBonus: statBonus, intBonus: statBonus, dexBonus: statBonus, msRemaining: dur * 1000, skillId: sk.id });
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
      state.buffs.push({ type: 'lukflat', mult: 1, flatBonus: lukBonus, msRemaining: dur * 1000, skillId: sk.id });
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
      const dotHitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def, target);
      if (Math.random() * 100 > dotHitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplierVsMonster(skElement, def);
      const dotEleDmgBonus = cardTargetDmgMult(def) - 1;
      const dmg = mitigateDamage(skillBaseDamage(useMag, def, elemMult) * mult * (1 + dotEleDmgBonus) * ailDmgTakenMult(target), ...defOf(def, 0.6, false, target));
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
      const hitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def, target);
      if (Math.random() * 100 > hitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplierVsMonster(skElement, def);
      const dmg = mitigateDamage(skillBaseDamage(useMag, def, elemMult) * mult * ailDmgTakenMult(target), ...defOf(def, 1, false, target));
      target.hp -= dmg;
      logMsg(`⚡ 「${sk.name}」Lv${lv} 造成 ${dmg} 點傷害！`);
      if (target.hp <= 0) { killMonster(def, target); break; }
      const procChance = Array.isArray(sk.procChance) ? sk.procChance[lv - 1] : sk.procChance;
      if (Math.random() * 100 < procChance) {
        applyPoisonDot(target, def, skillBaseDamage(useMag, def, elemMult) * mult);
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
        state.buffs.push({ type: 'agiflat', mult: 1, flatBonus: agiBonus, msRemaining: dur * 1000, skillId: sk.id });
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
      const mhHitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def, target);
      if (Math.random() * 100 > mhHitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplierVsMonster(skElement, def);
      const mhEleDmgBonus = cardTargetDmgMult(def) - 1;
      // 第一段：單體傷害
      const dmg1 = mitigateDamage(skillBaseDamage(useMag, def, elemMult) * mult * (1 + mhEleDmgBonus) * ailDmgTakenMult(target), ...defOf(def, 1, false, target)) + raceFlatBonus(def);
      target.hp -= dmg1;
      if (typeof showDamageFloatAt === 'function') showDamageFloatAt(target.id, '-' + dmg1, 'normal');
      logMsg(`⚡ 「${sk.name}」Lv${lv} 第一段對 ${def.name} 造成 ${dmg1} 點傷害！`);
      if (target.hp <= 0) killMonster(def, target);
      // 第二段：範圍傷害，打全部怪物
      const mult2 = Array.isArray(sk.mult2) ? sk.mult2[lv - 1] : sk.mult2;
      logMsg(`💥 「${sk.name}」Lv${lv} 第二段範圍攻擊！`);
      for (let i = state.monsters.length - 1; i >= 0; i--) {
        const mon = state.monsters[i];
        const monDef = MONSTERS[mon.defId];
        const monElemMult = getElementMultiplierVsMonster(skElement, monDef);
        const mon2EleDmgBonus = cardTargetDmgMult(monDef) - 1;
        const dmg2 = mitigateDamage(skillBaseDamage(useMag, monDef, monElemMult) * mult2 * (1 + mon2EleDmgBonus) * ailDmgTakenMult(mon), ...defOf(monDef, 1, false, mon)) + raceFlatBonus(monDef);
        mon.hp -= dmg2;
        combatLogBuf.push(`  → 對 ${monDef.name} 造成 ${dmg2} 點範圍傷害！`);
        if (typeof showDamageFloatAt === 'function') showDamageFloatAt(mon.id, '-' + dmg2, 'normal');
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
      const dmHitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def, target);
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
        const dmg = mitigateDamage(skillBaseDamage(useMag, def, elemMult) * mult * (1 + multiEleDmgBonus) * ailDmgTakenMult(target), ...defOf(def, 1, false, target)) + raceFlatBonus(def);
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
      const scHitPct = hitChancePctVsMonster(effectiveHitWithBuff(), def, target);
      if (Math.random() * 100 <= scHitPct) {
        const elemMult = getElementMultiplierVsMonster(skElement, def);
        const scEleDmgBonus = cardTargetDmgMult(def) - 1;
        const dmg = mitigateDamage(skillBaseDamage(useMag, def, elemMult) * mult * (1 + scEleDmgBonus) * ailDmgTakenMult(target), ...defOf(def, 1, false, target));
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
  // 新推的 buff 一律掛上來源技能；同一個技能重放時先清掉自己的舊 buff，避免連點疊加
  if (state.buffs.length > buffCountBefore) {
    for (let i = buffCountBefore; i < state.buffs.length; i++) {
      if (!state.buffs[i].skillId) state.buffs[i].skillId = sk.id;
    }
    const fresh = state.buffs.slice(buffCountBefore);
    state.buffs = state.buffs
      .slice(0, buffCountBefore)
      .filter(b => b.skillId !== sk.id)
      .concat(fresh);
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
        // 武器不對就跳過，不要讓 castSkill 每秒噴一次警告訊息洗版
        if (!weaponReqMet(sk.requiresWeapon)) continue;
        const spCost = skillSpCost(sk, lv);
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
      if (lv && skillReady(sk.id) && weaponReqMet(sk.requiresWeapon)) {
        const spCost = skillSpCost(sk, lv);
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
      if (lv2 && skillReady(sk2.id) && weaponReqMet(sk2.requiresWeapon)) {
        const spCost2 = skillSpCost(sk2, lv2);
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
      if (!weaponReqMet(sk.requiresWeapon)) continue;
      if (wastesResourceInTown(sk, lv)) continue;

      const spCost = skillSpCost(sk, lv);
      if (state.sp < spCost) continue;

      // Buff 類：只有「這個技能自己的」buff 還在時才跳過（等 buff 消失後自動補）。
      // 不能只比 type：攻速藥水與雙手劍加速同樣是 type:'aspd'，比 type 會讓藥水一喝下去
      // 就把技能擋掉 30 分鐘；不同職業同 type 的 buff 也會互相卡住。
      if (['buff_atk', 'buff_def', 'buff_aspd', 'buff_flee', 'buff_gold', 'buff_crit', 'buff_poison', 'buff_statpct', 'buff_flatstat', 'buff_maxroll', 'buff_blessing', 'buff_sprate', 'buff_lukflat', 'buff_holyweapon'].includes(sk.type)) {
        if (state.buffs.some(b => b.skillId === sk.id)) continue;
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
      const gtCost = skillSpCost(gtSk, gtLv);
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
      // 拳刃：刺客專用，官方商店賣的就是這條線
      'jur', 'jur_', 'katar', 'katar_', 'jamadhar', 'jamadhar_',
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
            'center_potion', 'awakening_potion', 'berserk_potion',
            // 未解封的卡冊：500 萬一本，開出卡冊再開出卡片。純粹是給後期消耗金錢的玩法
            'sealed_card_album'],
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
    /* 箱子：開出一件隨機道具。裝備一律進背包不自動穿，
       不然抽到武器會把身上那把換掉（而且個體化裝備的插卡會跟著消失）。 */
    if (def.boxOpen) {
      const got = drawFromBox(def.boxOpen);
      if (!got) { logMsg(`⚠️ ${def.name} 打不開（道具池是空的）。`); return false; }
      removeItem(itemId, 1);
      addItem(got, 1);
      const g = ITEMS[got];
      // 卡片跟高價道具各自有自己的「中大獎」提示
      const kind = CARDS[got] ? bossCardKind(got) : null;
      const rare = kind === 'mvp' || kind === 'miniBoss' || (g.sell || 0) >= 50000;
      const tag = kind === 'mvp' ? '👑👑 MVP 卡片！' : kind === 'miniBoss' ? '👑 迷你王卡片！'
        : rare ? '🎊🎊 大獎！' : '📦';
      const price = (!CARDS[got] && g.sell >= 500) ? `（售價 ${g.sell.toLocaleString()}z）` : '';
      logMsg(`${tag} 打開 ${def.name}，獲得了 ${g.name}${price}！`);
      saveGame();
      return true;
    }
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
    // 百分比回復（官方的 percentheal，例：巧克力球 HP/SP 各 10%）。
    // 這類不吃「快速恢復／禪心」那種道具效果加成——官方就是照最大值算的。
    if (def.healPct) {
      state.hp = Math.min(state.maxHp, state.hp + Math.round(state.maxHp * def.healPct / 100));
      healed = true;
    }
    if (def.restoreSpPct) {
      state.sp = Math.min(state.maxSp, state.sp + Math.round(state.maxSp * def.restoreSpPct / 100));
      healed = true;
    }
    if (def.heal) {
      /* 快速恢復（技能）是所有 HP 道具通吃的加成；
         卡片那批（啤酒企鵝的果汁 +50%、雪怪的冰淇淋 +100%）是**指定道具**才生效，
         所以另外查一張 道具id → 加成% 的表，兩者相加。 */
      const perItemPct = (state.itemHealBonus && state.itemHealBonus[itemId]) || 0;
      const boostedHeal = Math.round(def.heal * (1 + ((state.hpItemEffectBonusPct || 0) + perItemPct) / 100));
      state.hp = Math.min(state.maxHp, state.hp + boostedHeal);
      healed = true;
    }
    if (def.restoreSp) {
      // 禪心：SP恢復道具效果+10%~100%
      const boosted = Math.round(def.restoreSp * (1 + (state.spItemEffectBonusPct || 0) / 100));
      state.sp = Math.min(state.maxSp, state.sp + boosted);
      healed = true;
    }
    /* 沒有任何結構化效果就**不要消耗掉**。

       這裡以前是「desc 出現『恢復\d+』就照抄數字，只出現『恢復』兩字就固定回 50 HP」。
       `ITEMS` 有 18,845 個 consumable/material 沒有回復欄位，其中 502 個 desc 帶「恢復」，
       而數字規則命中的 182 個**幾乎全是卡片**（「擊殺昆蟲系魔物時 SP 可恢復5」）——
       等於把一張卡片吃掉換 5 點 HP。剩下 18,343 個連字樣都沒有的，
       舊碼一樣走到最後的 removeItem()，用一次就無聲蒸發。
       真正會回血的食材已由 tools/backfill_item_heal.js 從官方 item_db 補上 heal/restoreSp。 */
    if (!healed) {
      logMsg(`⚠️ ${def.name} 沒有可以使用的效果。`);
      return false;
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

/* ---------------- 裝備比較 ----------------
   換上這一件之後 ATK/DEF 等等會變成多少。

   作法是「暫時穿上去、重算、讀數字、還原」，而不是自己加減裝備欄位——
   因為精煉加成、卡片加成、條件式加成（#19）、素質衍生的 ATK 全都繞在
   recomputeDerived() 裡，手算一定會跟實際打出來的數字對不上。
   recomputeDerived(false) 除了把 HP/SP 夾回上限之外沒有其他副作用
   （不寫存檔、不寫訊息、不重繪），HP/SP 這裡自己備份還原。

   itemId 給普通堆疊裝備，instanceId 給精煉／插卡過的個體裝備（兩者擇一）。
   回傳 null 代表這件穿不上（職業／等級擋住，或根本不是裝備）。 */
const EQUIP_PREVIEW_FIELDS = [
  ['atk', 'ATK'], ['matk', 'MATK'], ['def', 'DEF'],
  ['maxHp', '最大HP'], ['maxSp', '最大SP'],
  ['hit', '命中'], ['flee', '迴避'], ['critRate', '暴擊率'], ['aspd', '攻速'],
];
function previewEquipDelta(itemId, instanceId) {
  if (!state) return null;
  if (instanceId) {
    const inst = state.instances && state.instances[instanceId];
    if (!inst) return null;
    itemId = inst.item;
  }
  const def = ITEMS[itemId];
  if (!def || (def.type !== 'weapon' && def.type !== 'armor')) return null;
  if (equipBlockReason(itemId)) return null;
  const slot = resolveEquipSlotFor(itemId);
  if (!slot) return null;

  const snap = () => {
    const o = {};
    EQUIP_PREVIEW_FIELDS.forEach(([k]) => { o[k] = state[k]; });
    return o;
  };
  const before = snap();
  const savedEquip = Object.assign({}, state.equip);
  const savedHp = state.hp, savedSp = state.sp;

  let after;
  try {
    state.equip[slot] = instanceId || itemId;
    // 雙手武器會佔掉左手，比較時也要把盾牌拿下來，不然會多算一份盾的 DEF
    if (slot === 'weapon' && isTwoHanded(itemId)) state.equip.shield = null;
    recomputeDerived(false);
    after = snap();
  } finally {
    state.equip = savedEquip;
    state.hp = savedHp; state.sp = savedSp;
    recomputeDerived(false);
    state.hp = savedHp; state.sp = savedSp;
  }

  const changes = EQUIP_PREVIEW_FIELDS
    .map(([k, label]) => ({ key: k, label, before: before[k] || 0, after: after[k] || 0 }))
    .map(c => Object.assign(c, { delta: Math.round(c.after) - Math.round(c.before) }))
    .filter(c => c.delta !== 0);
  return { slot, changes };
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
  const weaponLv = isArmor ? 0 : getRefineWeaponLv(item);

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

/* 卡片吸血／吸SP：赤蒼蠅（3%機率吸傷害的15%成HP）、德古拉伯爵（10%機率吸5%成SP）。
   兩張都寫「物理攻擊時」，所以只掛在普通攻擊命中之後，技能傷害不觸發。 */
function applyCardLeech(dmg) {
  if (!dmg || dmg <= 0) return;
  if (state.cardLifeStealChance && Math.random() * 100 < state.cardLifeStealChance) {
    const heal = Math.max(1, Math.round(dmg * state.cardLifeStealPct / 100));
    state.hp = Math.min(state.maxHp, state.hp + heal);
    logMsg(`🩸 吸血發動！回復了 ${heal} 點HP。`);
  }
  if (state.cardSpStealChance && Math.random() * 100 < state.cardSpStealChance) {
    const gain = Math.max(1, Math.round(dmg * state.cardSpStealPct / 100));
    state.sp = Math.min(state.maxSp, state.sp + gain);
    logMsg(`💧 吸取魔力發動！回復了 ${gain} 點SP。`);
  }
}

/* 技能實際要花多少 SP：查表拿到該等級的基礎消耗後，套上卡片的 SP 消耗增減。
   自動施放與手動施放都走這裡，否則會出現「判斷夠不夠時算一套、實際扣款算另一套」。 */
function skillSpCost(sk, lv) {
  if (!sk) return 0;
  const base = Array.isArray(sk.spCost)
    ? (sk.spCost[lv - 1] ?? sk.spCost[sk.spCost.length - 1] ?? 0)
    : (sk.spCost || 0);
  const pct = (state && state.cardSpCostPct) || 0;
  if (!pct) return base;
  return Math.max(0, Math.round(base * (1 + pct / 100)));
}

/* ---------------- 條件式裝備加成 ----------------
   卡片的條件效果（精煉幾階以上、某職業裝備時、跟某張卡一起裝備時）與裝備套裝，
   判斷式是同一個形狀：「看全身裝備狀態，成立就加一組數值」。所以共用同一套評估器。

   資料格式：
     CARDS[x].bonus      無條件加成
     CARDS[x].condBonus  [{ when: {...}, bonus: {...} }]     條件成立才加
     CARDS[x].perRefine  { str: 1 }                          依「卡片插的那件裝備」的精煉階數倍增
     EQUIP_SETS[y]       { items: [...], bonus: {...} }       全套穿齊才加

   when 支援的條件：
     refineMin / refineMax  宿主裝備的精煉階數（卡片專用，套裝用 refineOf）
     jobLine                職業血脈，例如 'thief' 代表盜賊系列（含刺客、流氓…）
     withCards              需要同時裝備的其他卡片（陣列，全部都要有）
     withItems              需要同時裝備的其他道具
     statMin                加點素質門檻，例 { vit: 77 }（不含裝備加成）
------------------------------------------------- */

/* 目前身上有什麼：一次算好，條件判斷全部拿這個查 */
function buildLoadout() {
  const slots = {};
  const cardHosts = {};          // cardId → [{slot, refine, itemId}]（同一張卡可能插在兩件裝備上）
  const cards = new Set();
  const items = new Set();
  EQUIP_SLOTS_ALL.forEach(slot => {
    const itemId = getEquipBaseItemId(slot);
    if (!itemId) return;
    const inst = getEquipInstance(slot);
    const refine = (inst && inst.refine) || 0;
    const list = (inst && inst.cards) ? inst.cards.filter(Boolean) : [];
    slots[slot] = { itemId, refine, cards: list };
    items.add(itemId);
    list.forEach(cid => {
      cards.add(cid);
      (cardHosts[cid] = cardHosts[cid] || []).push({ slot, refine, itemId });
    });
  });
  let jobLine = [];
  try { jobLine = getAllLearnedJobs(); } catch (e) { jobLine = []; }
  return { slots, cardHosts, cards, items, jobLine: new Set(jobLine) };
}

/* 條件成立與否。host 是「這張卡插在哪一件裝備上」，套裝沒有宿主就傳 null */
function condMet(when, host, lo) {
  if (!when) return true;
  if (when.refineMin != null && !(host && host.refine >= when.refineMin)) return false;
  if (when.refineMax != null && !(host && host.refine <= when.refineMax)) return false;
  if (when.jobLine && !lo.jobLine.has(when.jobLine)) return false;
  if (when.weaponReq && !weaponReqMet(when.weaponReq)) return false;
  if (when.withCards && !when.withCards.every(c => lo.cards.has(c))) return false;
  if (when.withItems && !when.withItems.every(i => lo.items.has(i))) return false;
  /* 素質門檻（官方寫「VIT77以上」「純粹AGI90以上」那種）。
     這裡看的是**加點的基礎素質**，不含裝備加成——官方的「純粹」就是這個意思，
     而且加成表是在 recomputeDerived() 裡算的，拿總素質判斷會變成循環相依。 */
  if (when.statMin) {
    for (const [k, v] of Object.entries(when.statMin)) {
      if ((state.stats[k] || 0) < v) return false;
    }
  }
  return true;
}

function mergeBonus(target, bonus, scale) {
  if (!bonus) return;
  for (const [k, v] of Object.entries(bonus)) target[k] = (target[k] || 0) + v * (scale == null ? 1 : scale);
}

/* 全身裝備提供的加成總表（卡片無條件 + 卡片條件式 + 依精煉倍增 + 套裝）。
   同一份簽章不變就直接回快取，戰鬥迴圈每次揮擊都會查到這裡。 */
let _gearBonusCache = null;
let _gearBonusKey = '';
let _activeSets = [];
function effectiveGearBonuses() {
  const lo = buildLoadout();
  const key = EQUIP_SLOTS_ALL.map(s => {
    const d = lo.slots[s];
    return d ? `${d.itemId}+${d.refine}[${d.cards.join(',')}]` : '-';
  }).join('|') + '#' + state.jobId;
  if (_gearBonusCache && _gearBonusKey === key) return _gearBonusCache;

  const total = {};
  const sets = [];
  lo.cards.forEach(cardId => {
    const card = CARDS[cardId];
    if (!card) return;
    // 同一張卡插在兩件裝備上就算兩份，跟官方一致
    (lo.cardHosts[cardId] || []).forEach(host => {
      mergeBonus(total, card.bonus);
      if (card.perRefine) mergeBonus(total, card.perRefine, host.refine);
      (card.condBonus || []).forEach(cb => {
        if (condMet(cb.when, host, lo)) mergeBonus(total, cb.bonus);
      });
    });
  });
  if (typeof EQUIP_SETS !== 'undefined') {
    for (const [setId, def] of Object.entries(EQUIP_SETS)) {
      if (!def.items || !def.items.every(i => lo.items.has(i))) continue;
      if (def.when && !condMet(def.when, null, lo)) continue;
      mergeBonus(total, def.bonus);
      if (def.perRefine && def.perRefine.of) {
        const slot = EQUIP_SLOTS_ALL.find(s => lo.slots[s] && lo.slots[s].itemId === def.perRefine.of);
        if (slot) mergeBonus(total, def.perRefine.bonus, lo.slots[slot].refine);
      }
      sets.push({ id: setId, name: def.name, bonus: def.bonus });
    }
  }

  _gearBonusKey = key;
  _activeSets = sets;
  _gearBonusCache = total;
  return total;
}
function activeEquipSets() { effectiveGearBonuses(); return _activeSets; }

const BASE_STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
function getCardBonus(stat) {
  const all = effectiveGearBonuses();
  let total = all[stat] || 0;
  if (!BASE_STAT_KEYS.includes(stat)) return total;
  // All State+N（古埃及王卡片）：六項素質一起加
  if (all.allStat) total += all.allStat;
  // perStat_<來源>_<每N點>_<目標>：官方「每 N 點基礎素質換 1 點另一項素質」
  // （黑曜石卡片那一組，看的是純素質，不含裝備／卡片／技能加的點數）
  for (const k in all) {
    if (!k.startsWith('perStat_')) continue;
    const parts = k.split('_');            // perStat, from, per, to
    if (parts[3] !== stat) continue;
    const base = (state.stats && state.stats[parts[1]]) || 0;
    total += Math.floor(base / (+parts[2] || 1)) * all[k];
  }
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
  logMsg(enabled ? '🎯 BOSS 模式已開啟，MVP 與迷你王可能隨時降臨！' : 'BOSS 模式已關閉。');
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
    // 舊存檔沒有 DPS 統計，補一份空的（從讀檔當下開始算）
    if (!state.dpsTracker || typeof state.dpsTracker.damage !== 'number') {
      state.dpsTracker = { since: Date.now(), damage: 0, exp: 0, jobExp: 0, gold: 0, kills: 0 };
    }
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
  const avgSoftDef = wAvg(m => m.defSoft || 0);
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
  _dpsPaused = true;   // 離線結算不算進實測 DPS
  const dmgPerAttack = mitigateDamage(raw * critFactor * skillFactor, avgDef, avgSoftDef) * avgHitPct;
  _dpsPaused = false;

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
