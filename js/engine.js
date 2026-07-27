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
    return raw ? JSON.parse(raw) : { items: [] };
  } catch (e) { return { items: [] }; }
}
function saveWarehouse(wh) {
  try { localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(wh)); } catch (e) { /* 忽略儲存失敗 */ }
}
function depositToWarehouse(itemId, qty) {
  const row = state.inventory.find(r => r.item === itemId);
  if (!row || row.qty < qty) return false;
  removeItem(itemId, qty);
  const wh = loadWarehouse();
  const whRow = wh.items.find(r => r.item === itemId);
  if (whRow) whRow.qty += qty; else wh.items.push({ item: itemId, qty });
  saveWarehouse(wh);
  saveGame();
  logMsg(`📦 將 ${getItemDisplayName(itemId)} x${qty} 存入倉庫。`);
  return true;
}
function withdrawFromWarehouse(itemId, qty) {
  const wh = loadWarehouse();
  const whRow = wh.items.find(r => r.item === itemId);
  if (!whRow || whRow.qty < qty) return false;
  whRow.qty -= qty;
  if (whRow.qty <= 0) wh.items = wh.items.filter(r => r.item !== itemId);
  saveWarehouse(wh);
  addItem(itemId, qty);
  saveGame();
  logMsg(`📦 從倉庫領出 ${getItemDisplayName(itemId)} x${qty}。`);
  return true;
}
const OFFLINE_CAP_MS = 12 * 60 * 60 * 1000; // 離線掛機最多累積 12 小時
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
    equip: { head_top: null, head_mid: null, head_bottom: null, weapon: null, armor: null, shield: null, garment: null, footgear: null, accessory1: null, accessory2: null },
    refinement: {},   // { itemId: refinementLevel } 例：{ sword_basic: 3 } 表示 +3
    equippedCards: {}, // { equipSlot: cardId } 例：{ weapon: 'poring_card' }
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
    autoBuyPotion: true,
    cardEleDmgBonus: {}, // 屬性傷害加成（由卡片提供）
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

function equippedAtk() {
  const w = state.equip.weapon ? ITEMS[state.equip.weapon] : null;
  const baseAtk = w && w.atk ? w.atk : 0;
  const refLevel = (state.refinement && state.equip.weapon) ? (state.refinement[state.equip.weapon] || 0) : 0;
  const weaponLv = w ? (w.weaponLv || 1) : 1;
  let mainAtk = baseAtk + getRefinementAtkBonus(refLevel, weaponLv);

  // 雙持：左手欄位裝備的是單手武器而非盾牌時，套用右手/左手修練的傷害修正
  const offItem = state.equip.shield ? ITEMS[state.equip.shield] : null;
  if (offItem && offItem.type === 'weapon' && canDualWield(state.jobId)) {
    const offRefLevel = (state.refinement && state.equip.shield) ? (state.refinement[state.equip.shield] || 0) : 0;
    const offWeaponLv = offItem.weaponLv || 1;
    const offAtk = (offItem.atk || 0) + getRefinementAtkBonus(offRefLevel, offWeaponLv);
    const rightPct = (state.rightHandPct != null ? state.rightHandPct : 50) / 100;
    const leftPct = (state.leftHandPct != null ? state.leftHandPct : 30) / 100;
    mainAtk = mainAtk * rightPct + offAtk * leftPct;
  }
  return mainAtk;
}
function equippedMatk() {
  const w = state.equip.weapon ? ITEMS[state.equip.weapon] : null;
  return w && w.matk ? w.matk : 0;
}
function equippedDef() {
  let def = 0;
  // Check all equipped armor slots
  ['head_top', 'head_mid', 'head_bottom', 'armor', 'shield', 'garment', 'footgear', 'accessory1', 'accessory2'].forEach(slot => {
    const a = state.equip[slot] ? ITEMS[state.equip[slot]] : null;
    const baseDef = a && a.def ? a.def : 0;
    const refLevel = (state.refinement && state.equip[slot]) ? (state.refinement[state.equip[slot]] || 0) : 0;
    def += baseDef + getRefinementDefBonus(refLevel);
  });
  return def;
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
  if (fullHeal) { state.hp = newMaxHp; state.sp = newMaxSp; }
  else { state.hp = Math.min(state.hp, newMaxHp); state.sp = Math.min(state.sp, newMaxSp); }

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
  const cStr = s.str + jobBonus.str + getCardBonus('str') + passiveStrBonus;
  const cDex = Math.round((s.dex + jobBonus.dex + getCardBonus('dex') + passiveDexBonus) * (1 + buffStatPct));
  const cLuk = s.luk + jobBonus.luk + getCardBonus('luk') + buffLukBonus;
  const cAgi = Math.round((s.agi + jobBonus.agi + getCardBonus('agi') + buffAgiBonus) * (1 + buffStatPct));
  const cVit = s.vit + jobBonus.vit + getCardBonus('vit');
  const cInt = s.int + jobBonus.int + getCardBonus('int') + passiveIntBonus;
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
        case 'maxHpMult': state.maxHp = Math.round(state.maxHp * val); state.hp = Math.min(state.hp, state.maxHp); break;
        case 'maxSpMult': state.maxSp = Math.round(state.maxSp * val); state.sp = Math.min(state.sp, state.maxSp); break;
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
        case 'defFlat': state.def += Math.round(val); break;
        case 'spRegen': state.spRegenMult = (state.spRegenMult || 1) * val; break;
        case 'hpRegenMult': state.hpRegenMult = (state.hpRegenMult || 1) * val; break;
        case 'hpMoveRegen': state.hpMoveRegen = true; break;
        case 'berserk': state.hasBerserk = true; break;
        case 'bashStun': state.hasBashStun = true; break;
        case 'riding': state.maxMonsters = Math.max(state.maxMonsters || 1, 1); state.hasRiding = true; break;
        case 'counterAttack': state.hasCounterAttack = true; state.counterAttackChance = val; break;
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
      }
    });
  }

  // 卡片加成 — 固定值（僅影響衍生數值，不修改 base stats 避免累加）
  state.atk += getCardBonus('atk');
  state.matk += getCardBonus('matk');
  state.matkMin += getCardBonus('matk');
  state.matkMax += getCardBonus('matk');
  state.def += getCardBonus('def');
  state.hit += getCardBonus('hit');
  state.flee += getCardBonus('flee');
  state.critRate = Math.min(100, state.critRate + getCardBonus('critRate'));
  state.perfectDodge += getCardBonus('perfectDodge');
  state.maxHp += getCardBonus('hp');
  state.maxSp += getCardBonus('sp');

  // 卡片加成 — 百分比
  const hpPctBonus = getCardBonus('hpPct') / 100;
  if (hpPctBonus > 0) {
    state.maxHp = Math.round(state.maxHp * (1 + hpPctBonus));
    state.hp = Math.min(state.hp, state.maxHp);
  }
  const spPctBonus = getCardBonus('spPct') / 100;
  if (spPctBonus > 0) {
    state.maxSp = Math.round(state.maxSp * (1 + spPctBonus));
    state.sp = Math.min(state.sp, state.maxSp);
  }

  // 卡片加成 — 屬性傷害加成（存入 state 供戰鬥使用）
  state.cardEleDmgBonus = {};
  Object.values(state.equippedCards || {}).forEach(cardId => {
    const card = CARDS[cardId];
    if (!card || !card.bonus) return;
    for (const [k, v] of Object.entries(card.bonus)) {
      if (k.startsWith('eleDmg_')) {
        const ele = k.replace('eleDmg_', '');
        state.cardEleDmgBonus[ele] = (state.cardEleDmgBonus[ele] || 0) + v / 100;
      }
    }
  });
}

/* ---------------- 戰鬥公式輔助 ----------------
   命中率% = 100 + 攻擊方HIT - 防守方FLEE，夾在 5%~100% 之間（RO 經典公式）
   減傷比例 = DEF/(DEF+60)，讓 DEF 呈現遞減曲線而非直接相減（避免高防怪變成零傷害）
------------------------------------------------- */
function hitChancePct(attackerHit, defenderFlee) {
  return Math.min(100, Math.max(5, 100 + attackerHit - defenderFlee));
}
function mitigateDamage(rawDmg, def) {
  const reduction = def / (def + 60);
  return Math.max(1, Math.round(rawDmg * (1 - reduction)));
}
function monsterHitOf(def) { return def.hit || (90 + def.level * 2.5); }
function monsterFleeOf(def) { return def.flee || (80 + def.level * 4); }

/* ---------------- 中毒（施毒/塗毒共用）----------------
   固定持續3秒、不疊加（同一隻怪再次中毒直接覆蓋刷新）、毒屬性怪物免疫 */
function applyPoisonDot(mon, monDef, rawDmgPerTick) {
  const elemMult = getElementMultiplier('poison', monDef.element || 'none');
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
      const elemMult = getElementMultiplier(sk.element || 'none', monDef.element || 'none');
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
        const elemMult = getElementMultiplier(sk.element || 'none', mDef.element || 'none');
        const dmg = mitigateDamage(state.atk * mult * elemMult, mDef.def);
        mon.hp -= dmg;
        logMsg(`  → 對 ${mDef.name} 造成 ${dmg} 點傷害！`);
        if (mon.hp <= 0) killMonster(mDef, mon);
      }
    }
  });
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
              const elemMult = getElementMultiplier('holy', monDef.element || 'none');
              const dmg = mitigateDamage(state.matk * f.mult * elemMult, monDef.def);
              mon.hp -= dmg;
              combatLogBuf.push(`  → 「${f.name}」對 ${monDef.name} 造成 ${dmg} 點傷害！`);
            });
            for (let i = state.monsters.length - 1; i >= 0; i--) {
              const mon = state.monsters[i];
              if (mon.hp <= 0) killMonster(MONSTERS[mon.defId], mon);
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
  const regenMult = state.hpRegenMult || 1;
  const hpRegen = Math.max(1, Math.ceil((state.maxHp * 0.015 + state.stats.vit * 0.15) * regenMult));
  // 禪心：SP恢復量固定+3~30，並額外+0.2%~2%（以最大SP計）
  const zenFlat = state.zenSpFlatBonus || 0;
  const zenPct = state.maxSp * ((state.zenSpPctBonus || 0) / 100);
  // 聖母之頌歌buff：SP恢復速度倍率
  const sprateMult = buffMult('sprate').mult;
  const spRegen = Math.max(1, Math.ceil((state.maxSp * 0.02 + state.stats.int * 0.15 + zenFlat + zenPct) * (state.spRegenMult || 1) * sprateMult));
  if (state.hp < state.maxHp) state.hp = Math.min(state.maxHp, state.hp + hpRegen);
  if (state.sp < state.maxSp) state.sp = Math.min(state.maxSp, state.sp + spRegen);
}

function getItemQty(itemId) {
  const row = state.inventory.find(r => r.item === itemId);
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
function computeAspd() {
  const job = currentJob();
  const s = state.stats;

  // Step 1: 查表取得武器 ASPD 基礎值 & 盾牌懲罰
  const weapon = state.equip.weapon ? ITEMS[state.equip.weapon] : null;
  const weaponType = weapon ? weapon.weaponType : null;
  // baseAspd 可以是數字（全武器統一值）或物件（依武器類型查表）
  let weaponValue = 154;
  if (job.baseAspd) {
    if (typeof job.baseAspd === 'number') {
      weaponValue = job.baseAspd;
    } else if (weaponType && job.baseAspd[weaponType] !== undefined) {
      weaponValue = job.baseAspd[weaponType];
    }
  }
  // 左手欄位裝備的是武器（雙持）時不算盾牌懲罰，只有真正的盾牌才扣ASPD
  const shieldSlotItem = state.equip.shield ? ITEMS[state.equip.shield] : null;
  const shieldPenalty = (shieldSlotItem && shieldSlotItem.type !== 'weapon') ? (job.shieldPenalty || -5) : 0;

  // Step 2: StatBonus = √(AGI × 1120/111 + DEX × 11/60)
  // 含被動技能 DEX 加成、心神凝聚 DEX/AGI% buff（避免直接修改 state.stats.dex 導致膨脹）
  const buffStatPct = state._buffStatPct || 0;
  const effectiveDex = (s.dex + (state._passiveDexBonus || 0)) * (1 + buffStatPct);
  const effectiveAgi = s.agi * (1 + buffStatPct);
  const statBonus = Math.sqrt(effectiveAgi * 1120 / 111 + effectiveDex * 11 / 60);

  // Step 3: Core（依武器基礎值分高低速公式）
  let core;
  if (weaponValue >= 145) {
    // 高速武器：素質加成有邊際效應
    core = weaponValue + statBonus * (1 - (weaponValue - 144) / 50) + shieldPenalty;
  } else {
    core = weaponValue + statBonus + shieldPenalty;
  }

  // Step 4: 技能/藥水攻速百分比
  let skillAspdPct = 0;
  state.buffs.forEach(b => {
    if (b.type === 'aspd' && b.mult) {
      skillAspdPct += (b.mult - 1);
    }
  });
  const afterSkill = 200 - (200 - core) * (1 - skillAspdPct);

  // Step 5: 裝備攻速百分比 + 固定值（含蒼鷹之眼等被動固定ASPD加成）
  let equipAspdPct = 0;
  let aspdFlatBonus = state.passiveAspdFlat || 0;
  ['weapon', 'armor'].forEach(slot => {
    const item = state.equip[slot] ? ITEMS[state.equip[slot]] : null;
    if (item) {
      if (item.aspdBonus) equipAspdPct += (item.aspdBonus - 1);
      if (item.aspdFlat) aspdFlatBonus += item.aspdFlat;
    }
  });
  const finalAspd = Math.floor(195 - (195 - afterSkill) * (1 - equipAspdPct) + aspdFlatBonus);

  state.aspd = Math.min(193, Math.max(100, finalAspd));
  state.attackInterval = getAttackInterval(state.aspd);
}
function buffMult(type) {
  let mult = 1;
  let flatBonus = 0;
  state.buffs.forEach(b => {
    if (b.type === type) {
      mult *= b.mult;
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
  // 攻擊音效 + 動畫
  if (typeof playAttackSound === 'function') playAttackSound();
  if (typeof playAttackAnim === 'function') playAttackAnim();
  const target = state.monsters[0]; // 攻擊第一隻怪物
  const monDef = MONSTERS[target.defId];
  const useMag = currentJob().matkMod > currentJob().atkMod;

  // Calculate effective crit rate with buff
  const critBuff = buffMult('crit');
  const effectiveCritRate = Math.min(100, state.critRate * critBuff.mult + critBuff.flatBonus);
  const isCrit = Math.random() * 100 < effectiveCritRate;
  if (!isCrit) {
    const hitPct = hitChancePct(effectiveHitWithBuff(), monsterFleeOf(monDef));
    if (Math.random() * 100 > hitPct) {
      logMsg(`你的攻擊被 ${monDef.name} 閃避了！`);
      // 攻擊 MISS 飄字（玩家頭上）
      if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
      return;
    }
  }

  let raw = useMag ? state.matk : state.atk;
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
  const weapon = state.equip.weapon ? ITEMS[state.equip.weapon] : null;
  let atkElement = (weapon && weapon.element) ? weapon.element : 'none';
  // 聖之祈福buff：暫時附加聖屬性
  if (state.buffs.some(b => b.type === 'holyweapon')) atkElement = 'holy';
  const elemMult = getElementMultiplier(atkElement, monDef.element || 'none');
  if (elemMult !== 1) {
    const pctStr = Math.round(elemMult * 100);
    const tag = elemMult > 1 ? '💚 屬性克制！' : (elemMult < 1 && elemMult > 0 ? '💜 屬性被克…' : (elemMult === 0 ? '🚫 屬性免疫！' : ''));
    if (tag) logMsg(`${tag} ${ELEMENT_NAMES[atkElement]}攻 → ${ELEMENT_NAMES[monDef.element || 'none']}防 (${pctStr}%)`);
  }
  raw *= elemMult;

  // 卡片屬性傷害加成：對特定屬性怪物額外增傷
  const monElement = monDef.element || 'none';
  if (state.cardEleDmgBonus && state.cardEleDmgBonus[monElement]) {
    const bonus = state.cardEleDmgBonus[monElement];
    raw *= (1 + bonus);
  }

  // Apply monster debuff (provoke reduces defense)
  let monDefVal = monDef.def;
  if (target.debuffDef && target.debuffDefEnd && Date.now() < target.debuffDefEnd) {
    monDefVal = Math.round(monDefVal * target.debuffDef);
  } else {
    delete target.debuffDef;
    delete target.debuffDefEnd;
  }

  const dmg = mitigateDamage(raw, monDefVal);
  target.hp -= dmg;
  logMsg(`你對 ${monDef.name} 造成 ${dmg} 點傷害${isCrit ? '（暴擊！無視閃避）' : ''}`);
  // 命中音效
  if (typeof playHitSound === 'function') playHitSound();

  if (target.hp <= 0) {
    killMonster(monDef, target);
    return;
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
      const elemMult = getElementMultiplier('poison', mDef.element || 'none');
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
      const bbElemMult = getElementMultiplier(bbSkill.element || 'none', monDef.element || 'none');
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
  // 噴砂被動造成的命中下降
  let monHitVal = monsterHitOf(monDef);
  if (mon.debuffHit && mon.debuffHitEnd && Date.now() < mon.debuffHitEnd) {
    monHitVal = Math.max(0, monHitVal - mon.debuffHit);
  } else {
    delete mon.debuffHit;
    delete mon.debuffHitEnd;
  }
  const hitPct = hitChancePct(monHitVal, state.flee);
  if (Math.random() * 100 > hitPct) {
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

  // 狂暴狀態：DEF -55%
  let playerDef = state.def;
  if (state.hasBerserk && state.hp < state.maxHp * 0.25) {
    playerDef = Math.round(state.def * 0.45);
  }

  let dmg = mitigateDamage(raw, playerDef);
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
}

function killMonster(def, monObj) {
  logMsg(`擊敗了 ${def.name}！獲得 ${def.exp} 經驗與 ${def.jobExp} 職業經驗。`);
  gainExp(def.exp, def.jobExp);
  const goldGain = Math.round((3 + def.level * 1.4) * buffMult('gold').mult);
  state.gold += goldGain;
  (def.drops || []).forEach(d => {
    if (Math.random() < d.chance) addItem(d.item, 1);
  });
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
  const cardDrop = MONSTER_CARD_DROPS[def.id];
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

  const spCost = Array.isArray(sk.spCost) ? sk.spCost[lv - 1] : sk.spCost;
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
  const needsMonster = ['damage', 'magic', 'dot', 'damage_multihit', 'damage_multi', 'debuff_def', 'debuff', 'special_charge', 'poison_proc', 'stun_field'].includes(sk.type);
  if (needsMonster && (!state.monsters || state.monsters.length === 0)) return false;

  state.sp -= spCost;
  if (hpCost > 0) state.hp -= hpCost;
  if (zenyCost > 0) state.gold -= zenyCost;
  const cd = Array.isArray(sk.cooldown) ? sk.cooldown[lv - 1] : sk.cooldown;
  state.cooldowns[skillId] = cd * 1000;

  const mult = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
  const useMag = sk.type === 'magic';
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
        const hitPct = hitChancePct(effectiveHit, monsterFleeOf(def));
        if (Math.random() * 100 > hitPct) {
          logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
          if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
          break;
        }
      }
      const elemMult = getElementMultiplier(skElement, def.element || 'none');
      if (elemMult !== 1) {
        const pctStr = Math.round(elemMult * 100);
        const tag = elemMult > 1 ? '💚 屬性克制！' : (elemMult < 1 && elemMult > 0 ? '💜 屬性被克…' : (elemMult === 0 ? '🚫 屬性免疫！' : ''));
        if (tag) logMsg(`${tag} ${ELEMENT_NAMES[skElement]}攻 → ${ELEMENT_NAMES[def.element || 'none']}防 (${pctStr}%)`);
      }
      // 卡片屬性傷害加成
      const skEleDmgBonus = (state.cardEleDmgBonus && state.cardEleDmgBonus[def.element || 'none']) || 0;
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
      // 低血量加成（例如音速投擲：目標HP低於門檻時傷害加成）
      if (sk.lowHpThreshold && target.hp < target.maxHp * sk.lowHpThreshold) {
        skillMult *= sk.lowHpMult;
      }
      // 負重量上升：加成金錢攻擊/手推車攻擊傷害
      if ((sk.id === 'mammonite' || sk.id === 'cartattack') && state.cartDmgBonusMult) {
        skillMult *= (1 + state.cartDmgBonusMult);
      }
      const dmg = mitigateDamage(baseDmgStat * skillMult * elemMult * (1 + skEleDmgBonus), def.def);
      target.hp -= dmg;
      logMsg(`⚡ 「${sk.name}」Lv${lv} 造成 ${dmg} 點傷害！`);
      // 攻擊弱點：狂擊Lv6以上有機率暈眩
      if (sk.id === 'bash' && state.hasBashStun && lv >= 6 && Math.random() < 0.5) {
        logMsg(`💫 ${def.name} 被暈眩了！`);
      }
      // 怒爆自傷：自身受10%HP傷害
      if (sk.id === 'magnumbreak') {
        const selfDmg = Math.round(state.maxHp * 0.1);
        state.hp = Math.max(1, state.hp - selfDmg);
        logMsg(`🔥 怒爆的反噬對你造成 ${selfDmg} 點傷害！`);
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
          const hitPct = hitChancePct(effectiveHitWithBuff(), monsterFleeOf(monDef));
          if (Math.random() * 100 > hitPct) {
            combatLogBuf.push(`  → ${monDef.name} 閃避了！`);
            continue;
          }
        }
        const monElemMult = getElementMultiplier(skElement, monDef.element || 'none');
        const monEleDmgBonus = (state.cardEleDmgBonus && state.cardEleDmgBonus[monDef.element || 'none']) || 0;
        // 負重量上升：加成手推車攻擊傷害
        let aoeMult = mult;
        if (sk.id === 'cartattack' && state.cartDmgBonusMult) aoeMult *= (1 + state.cartDmgBonusMult);
        let dmg = mitigateDamage(baseDmgStat * aoeMult * monElemMult * (1 + monEleDmgBonus), monDef.def);
        // 鋼製喙：閃電衝擊額外固定傷害（不受倍率影響）
        if (sk.id === 'blitzbeat' && state.falconFlatBonus) dmg += state.falconFlatBonus;
        mon.hp -= dmg;
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
      if (!state.activeFieldEffects) state.activeFieldEffects = [];
      state.activeFieldEffects.push({ kind: 'aoe_holydmg', name: sk.name, mult, tickIntervalSec: tickSec, nextTickAt: Date.now(), endsAt: Date.now() + dur * 1000 });
      logMsg(`✨ 「${sk.name}」Lv${lv} 發動！`);
      break;
    }
    case 'dot': {
      if (!state.monsters || state.monsters.length === 0) break;
      const target = state.monsters[0];
      const def = MONSTERS[target.defId];
      // 命中判定：中毒類技能屬於物理技能
      const dotHitPct = hitChancePct(effectiveHitWithBuff(), monsterFleeOf(def));
      if (Math.random() * 100 > dotHitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplier(skElement, def.element || 'none');
      const dotEleDmgBonus = (state.cardEleDmgBonus && state.cardEleDmgBonus[def.element || 'none']) || 0;
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
      const hitPct = hitChancePct(effectiveHitWithBuff(), monsterFleeOf(def));
      if (Math.random() * 100 > hitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplier(skElement, def.element || 'none');
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
      const mhHitPct = hitChancePct(effectiveHitWithBuff(), monsterFleeOf(def));
      if (Math.random() * 100 > mhHitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplier(skElement, def.element || 'none');
      const mhEleDmgBonus = (state.cardEleDmgBonus && state.cardEleDmgBonus[def.element || 'none']) || 0;
      // 第一段：單體傷害
      const dmg1 = mitigateDamage(baseDmgStat * mult * elemMult * (1 + mhEleDmgBonus), def.def);
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
        const monElemMult = getElementMultiplier(skElement, monDef.element || 'none');
        const mon2EleDmgBonus = (state.cardEleDmgBonus && state.cardEleDmgBonus[monDef.element || 'none']) || 0;
        const dmg2 = mitigateDamage(baseDmgStat * mult2 * monElemMult * (1 + mon2EleDmgBonus), monDef.def);
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
      const dmHitPct = hitChancePct(effectiveHitWithBuff(), monsterFleeOf(def));
      if (Math.random() * 100 > dmHitPct) {
        logMsg(`「${sk.name}」被 ${def.name} 閃避了！`);
        if (typeof showPlayerFloat === 'function') showPlayerFloat('MISS', 'miss');
        break;
      }
      const elemMult = getElementMultiplier(skElement, def.element || 'none');
      const multiEleDmgBonus = (state.cardEleDmgBonus && state.cardEleDmgBonus[def.element || 'none']) || 0;
      const hits = Array.isArray(sk.hits) ? sk.hits[lv - 1] : (sk.hits || 1);
      let totalDmg = 0;
      for (let i = 0; i < hits; i++) {
        const dmg = mitigateDamage(baseDmgStat * mult * elemMult * (1 + multiEleDmgBonus), def.def);
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
      const scHitPct = hitChancePct(effectiveHitWithBuff(), monsterFleeOf(def));
      if (Math.random() * 100 <= scHitPct) {
        const elemMult = getElementMultiplier(skElement, def.element || 'none');
        const scEleDmgBonus = (state.cardEleDmgBonus && state.cardEleDmgBonus[def.element || 'none']) || 0;
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
        if (state.sp >= spCost && spPct >= config.spThreshold) {
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
        if (state.sp >= spCost2 && spPct >= config.spThreshold2 && monsterCount >= config.monsterCount2) {
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
      const spCost = Array.isArray(sk.spCost) ? sk.spCost[lv - 1] : sk.spCost;
      if (state.sp < spCost) continue;

      // Buff 類：如果已有相同類型 buff 則跳過（等 buff 消失後自動補）
      if (['buff_atk', 'buff_def', 'buff_aspd', 'buff_flee', 'buff_gold', 'buff_crit', 'buff_poison', 'buff_statpct', 'buff_flatstat'].includes(sk.type)) {
        const buffType = sk.type.replace('buff_', '');
        if (state.buffs.some(b => b.type === buffType)) continue;
      }
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

  // 轉職獎勵：新職業獲得 3 點技能點
  if (!state.jobSkillPoints[targetId]) state.jobSkillPoints[targetId] = 0;
  state.jobSkillPoints[targetId] += 3;
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
  logMsg(`🎊 恭喜！你轉職成為「${target.icon} ${target.name}」！獲得 3 點技能點！`);
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
    items: ['knife', 'cutter', 'main_gauche', 'dirk', 'dagger', 'stiletto', 'gladius', 'damascus', 'cinquedea', 'kindling_dagger', 'obsidian_dagger', 'item_1249', 'jujube_dagger', 'coward', 'sword', 'falchion', 'blade', 'lapier', 'tsurugi', 'haedonggum', 'saber', 'slayer', 'bastard_sword', 'two_hand_sword', 'broad_sword', 'spear', 'pike', 'lance', 'guisarme', 'glaive', 'halberd', 'axe', 'battle_axe', 'hammer', 'buster', 'two_handed_axe', 'club', 'mace', 'smasher', 'flail', 'morning_star', 'sword_mace', 'chain', 'stunner', 'bow', 'composite_bow', 'great_bow', 'cross_bow', 'arbalest', 'kakkung', 'hunter_bow', 'repeting_cross_bow', 'waghnakh', 'knuckle_duster', 'hora', 'fist', 'claw', 'finger', 'violin', 'mandolin', 'lute', 'guitar', 'harp', 'guh_moon_goh'],
    getItems() {
      return this.items.filter(id => {
        const item = ITEMS[id];
        if (!item) return false;
        if (item.reqLevel && state.baseLevel < item.reqLevel) return false;
        return true;
      });
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

function openNpcShop(shopId) {
  const shop = NPC_SHOPS[shopId];
  if (!shop) return;
  const items = shop.getItems();
  const el = document.getElementById('tab-npc');
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
    }
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(id);
  });

  let html = `<div class="npc-shop">
    <div class="npc-shop-header">
      <button class="btn-small" onclick="renderNpcTab()">← 返回</button>
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
function addItem(itemId, qty) {
  const row = state.inventory.find(r => r.item === itemId);
  if (row) row.qty += qty; else state.inventory.push({ item: itemId, qty });
}
function removeItem(itemId, qty) {
  const row = state.inventory.find(r => r.item === itemId);
  if (!row) return false;
  row.qty -= qty;
  if (row.qty <= 0) state.inventory = state.inventory.filter(r => r.item !== itemId);
  return true;
}
function useItem(itemId) {
  const def = ITEMS[itemId];
  const row = state.inventory.find(r => r.item === itemId);
  if (!def || !row) return false;
  if (def.type === 'consumable' || def.type === 'material') {
    if (def.heal) state.hp = Math.min(state.maxHp, state.hp + def.heal);
    else if (def.restoreSp) {
      // 禪心：SP恢復道具效果+10%~100%
      const boosted = Math.round(def.restoreSp * (1 + (state.spItemEffectBonusPct || 0) / 100));
      state.sp = Math.min(state.maxSp, state.sp + boosted);
    }
    else {
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
function equipItem(itemId) {
  const def = ITEMS[itemId];
  if (!def) return false;

  let slot;
  if (def.type === 'weapon') {
    if (isTwoHanded(itemId)) {
      slot = 'weapon';
    } else if (!state.equip.weapon) {
      slot = 'weapon';
    } else if (canDualWield(state.jobId) && !isTwoHanded(state.equip.weapon)) {
      // 主手已有單手武器，且職業支援雙持 → 放入左手（副手武器）
      slot = 'shield';
    } else {
      slot = 'weapon';
    }
  } else if (def.type === 'armor') {
    switch (def.armorType) {
      case 'headgear':
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
    return false;
  }

  // 雙手武器：裝備時自動卸下左手欄位（盾牌或副手武器）
  if (slot === 'weapon' && isTwoHanded(itemId)) {
    if (state.equip.shield) {
      const offName = ITEMS[state.equip.shield]?.name || '左手裝備';
      addItem(state.equip.shield, 1);
      logMsg(`雙手武器無法搭配左手裝備，卸下了 ${offName}。`);
      state.equip.shield = null;
    }
  }

  // 左手欄位：如果目前武器是雙手武器，無法裝備
  if (slot === 'shield' && isTwoHanded(state.equip.weapon)) {
    logMsg(`⚠️ 雙手武器無法搭配盾牌！`);
    return false;
  }

  const old = state.equip[slot];
  state.equip[slot] = itemId;
  removeItem(itemId, 1);
  if (old) addItem(old, 1);
  recomputeDerived(false);
  logMsg(`裝備了 ${def.name}。`);
  saveGame();
  return true;
}

function unequipItem(slotKey) {
  const itemId = state.equip[slotKey];
  if (!itemId) return false;
  const def = ITEMS[itemId];
  state.equip[slotKey] = null;
  addItem(itemId, 1);
  recomputeDerived(false);
  logMsg(`卸下了 ${def ? def.name : '裝備'}。`);
  saveGame();
  return true;
}

/* ---------------- 裝備精煉 ---------------- */
function refineItem(itemId, materialType) {
  if (!state.refinement) state.refinement = {};
  const currentLevel = state.refinement[itemId] || 0;
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

  // 檢查以太礦石是否需要 +10 以上
  if ((materialType === 'ether_oridecon' || materialType === 'ether_elunium') && currentLevel < 10) {
    logMsg(`⚠️ ${mat.name} 需要 +10 以上才能使用。`);
    return false;
  }

  // 檢查材料庫存
  const invRow = state.inventory.find(r => r.item === mat.id);
  if (!invRow || invRow.qty < 1) {
    logMsg(`⚠️ 你沒有 ${mat.name}。`);
    return false;
  }

  const cost = REFINEMENT_COST;
  if (state.gold < cost) {
    logMsg(`⚠️ 鋅幣不足，精煉需要 ${cost} 鋅幣。`);
    return false;
  }

  // 扣除材料和費用
  removeItem(mat.id, 1);
  state.gold -= cost;

  // 計算成功率
  const successRate = getRefinementSuccessRate(currentLevel, weaponLv, materialType);
  const safeLevel = getRefinementSafeLevel(weaponLv, isArmor);

  if (Math.random() * 100 < successRate) {
    // 成功
    state.refinement[itemId] = currentLevel + 1;
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
        state.refinement[itemId] = Math.max(0, currentLevel - 3);
        logMsg(`💥 精煉失敗！${item.name} 降至 +${Math.max(0, currentLevel - 3)}…`);
      } else {
        // +3 以下直接損壞
        delete state.refinement[itemId];
        logMsg(`💥 精煉失敗！${item.name} 損壞了！`);
      }
    } else {
      // 安全等級以下：不降級
      logMsg(`💥 精煉失敗！${item.name} 維持 +${currentLevel}。`);
    }
    saveGame();
    return false;
  }
}

function getRefinementLevel(itemId) {
  if (!state.refinement) return 0;
  return state.refinement[itemId] || 0;
}

/* ---------------- 怪物卡片系統 ---------------- */
function getEquippedCard(slot) {
  if (!state.equippedCards) return null;
  return state.equippedCards[slot] || null;
}

function insertCard(equipSlot, cardId) {
  if (!state.equippedCards) state.equippedCards = {};
  const card = CARDS[cardId];
  if (!card) return false;

  // 檢查卡片是否在背包中
  const invRow = state.inventory.find(r => r.item === cardId);
  if (!invRow || invRow.qty < 1) {
    logMsg(`⚠️ 你沒有這張卡片。`);
    return false;
  }

  // 檢查卡槽是否正確
  if (card.slot === 'weapon' && equipSlot !== 'weapon') {
    logMsg(`⚠️ ${card.name} 只能插在武器上。`);
    return false;
  }
  if (card.slot === 'armor' && !['head_top', 'head_mid', 'head_bottom', 'armor', 'shield', 'garment', 'footgear'].includes(equipSlot)) {
    logMsg(`⚠️ ${card.name} 只能插在防具上。`);
    return false;
  }

  // 檢查是否有裝備
  if (!state.equip[equipSlot]) {
    logMsg(`⚠️ 該欄位沒有裝備。`);
    return false;
  }

  // 檢查卡槽限制
  const maxSlots = getEquipCardSlots(equipSlot);
  if (maxSlots <= 0) {
    logMsg(`⚠️ 該欄位無法插卡。`);
    return false;
  }

  // 如果已有卡片，先移除
  if (state.equippedCards[equipSlot]) {
    const oldCardId = state.equippedCards[equipSlot];
    addItem(oldCardId, 1);
    logMsg(`移除了 ${CARDS[oldCardId].name}。`);
  }

  // 插入新卡片
  removeItem(cardId, 1);
  state.equippedCards[equipSlot] = cardId;
  logMsg(`🃏 將 ${card.name} 插入了${ITEMS[state.equip[equipSlot]].name}！`);
  recomputeDerived(false);
  saveGame();
  return true;
}

function removeCard(equipSlot) {
  if (!state.equippedCards) return false;
  const cardId = state.equippedCards[equipSlot];
  if (!cardId) {
    logMsg(`⚠️ 該欄位沒有插卡片。`);
    return false;
  }

  const card = CARDS[cardId];
  addItem(cardId, 1);
  delete state.equippedCards[equipSlot];
  logMsg(`移除了 ${card.name}。`);
  recomputeDerived(false);
  saveGame();
  return true;
}

function getCardBonus(stat) {
  if (!state.equippedCards) return 0;
  let total = 0;
  Object.values(state.equippedCards).forEach(cardId => {
    const card = CARDS[cardId];
    if (card && card.bonus && card.bonus[stat]) {
      total += card.bonus[stat];
    }
  });
  return total;
}
function sellItem(itemId, qty) {
  const def = ITEMS[itemId];
  const row = state.inventory.find(r => r.item === itemId);
  if (!def || !row || row.qty < qty) return false;
  removeItem(itemId, qty);
  const unitPrice = Math.round(def.sell * (state.shopOverchargeMult || 1));
  const total = unitPrice * qty;
  state.gold += total;
  logMsg(`賣出 ${def.name} x${qty}，獲得 ${total} 鋅幣。`);
  saveGame();
  return true;
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
    const row = state.inventory.find(r => r.item === itemId);
    if (!def || !row || row.qty < 1) return;
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
    if (typeof state.muted !== 'boolean') state.muted = false;
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
    if (!state.refinement) state.refinement = {};
    if (!state.equippedCards) state.equippedCards = {};

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

  const useMag = currentJob().matkMod > currentJob().atkMod;
  const raw = useMag ? state.matk : state.atk;
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
