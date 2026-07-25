# ASPD 系統實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 實作完整的 RO Renewal 風格 ASPD 系統，讓攻擊速度真正影響攻擊頻率

**Architecture:** 使用 RO 原版 ASPD 公式，搭配查找表將 ASPD 轉換為攻擊間隔。技能/BUFF 以乘法方式增加 ASPD，裝備大部分用乘法、特殊裝备用加法。

**Tech Stack:** HTML/CSS/JavaScript (純前端，無框架)

## Global Constraints

- ASPD 範圍：100 ~ 193
- ASPD 上限：193
- 攻擊間隔公式：查找表 (ASPD → 攻擊頻率)
- 技能/BUFF 修正：乘法
- 裝備修正：大部分乘法，特殊裝備加法

---

## 檔案結構

| 檔案 | 職責 |
|------|------|
| `js/data.js` | 新增武器 ASPD 基礎值、攻速技能、攻速裝備 |
| `js/engine.js` | 實作 ASPD 計算邏輯、修改戰鬥迴圈使用攻擊間隔 |

---

### Task 1: 新增武器 ASPD 基礎值

**Covers:** 武器 ASPD 基礎值

**Files:**
- Modify: `D:\mimo\ro-idle\js\data.js`

**Interfaces:**
- Consumes: 無
- Produces: 武器物件新增 `weaponAspd` 屬性

- [ ] **Step 1: 為現有武器新增 ASPD 基礎值**

在 `js/data.js` 的 `ITEMS` 物件中，為每個武器新增 `weaponAspd` 屬性：

```javascript
// 武器
sword_basic: { id: 'sword_basic', imgId: 3001, name: '新手用劍', type: 'weapon', icon: '🗡️', atk: 8, weaponAspd: 145, sell: 20, reqJobTier: [1, 2], desc: '鏽跡斑斑但堪用的鐵劍。' },
wand_basic: { id: 'wand_basic', imgId: 3002, name: '見習法杖', type: 'weapon', icon: '🪄', matk: 10, weaponAspd: 130, sell: 20, desc: '刻有簡易咒文的木杖。' },
bow_basic: { id: 'bow_basic', imgId: 3003, name: '短弓', type: 'weapon', icon: '🏹', atk: 9, weaponAspd: 140, sell: 20, desc: '輕便的獵人用弓。' },
dagger_basic: { id: 'dagger_basic', imgId: 3004, name: '生鏽小刀', type: 'weapon', icon: '🔪', atk: 7, weaponAspd: 150, sell: 18, desc: '適合快速突刺的短刃。' },
```

**武器 ASPD 基礎值對照：**
- 劍：145
- 杖：130
- 弓：140
- 匕首：150

- [ ] **Step 2: 驗證修改**

開啟瀏覽器開發者工具，檢查 `ITEMS.sword_basic.weaponAspd` 是否為 145。

- [ ] **Step 3: Commit**

```bash
git add js/data.js
git commit -m "feat: add weapon ASPD base values to items"
```

---

### Task 2: 新增攻速技能

**Covers:** 攻速相關技能

**Files:**
- Modify: `D:\mimo\ro-idle\js\data.js`

**Interfaces:**
- Consumes: 無
- Produces: 技能物件新增 `type: 'buff_aspd'` 和 `aspdMult` 屬性

- [ ] **Step 1: 為現有技能新增攻速加成**

在 `js/data.js` 的 `JOB_TREE` 中，為已有的 `buff_aspd` 類型技能新增 `aspdMult` 屬性：

```javascript
// 騎士技能
twohandquicken: { id: 'twohandquicken', name: '二刀流駕馭', spCost: 14, cooldown: 30, type: 'buff_aspd', aspdMult: 1.25, duration: 20, desc: '大幅提升攻擊速度。' },
```

- [ ] **Step 2: 新增攻速相關技能**

為各職業新增攻速相關技能：

```javascript
// 劍士
{ id: 'increaseagility', name: '速度激發', spCost: 10, cooldown: 25, type: 'buff_aspd', aspdMult: 1.15, duration: 30, desc: '提升攻擊速度與迴避。' },

// 盜賊
{ id: 'adrenalinerush', name: '腎上腺素', spCost: 12, cooldown: 20, type: 'buff_aspd', aspdMult: 1.20, duration: 15, desc: '短時間內大幅提升攻擊速度。' },

// 弓箭手
{ id: 'unlimited', name: '無限箭矢', spCost: 8, cooldown: 30, type: 'buff_aspd', aspdMult: 1.15, duration: 25, desc: '提升射箭速度。' },
```

- [ ] **Step 3: 驗證修改**

檢查新增技能是否正確加入 `JOB_TREE`。

- [ ] **Step 4: Commit**

```bash
git add js/data.js
git commit -m "feat: add ASPD skills to job tree"
```

---

### Task 3: 新增攻速裝備

**Covers:** 裝備 ASPD 加成

**Files:**
- Modify: `D:\mimo\ro-idle\js\data.js`

**Interfaces:**
- Consumes: 無
- Produces: 裝備物件新增 `aspdBonus` (乘法) 或 `aspdFlat` (加法) 屬性

- [ ] **Step 1: 新增攻速裝備**

在 `js/data.js` 的 `ITEMS` 物件中新增攻速裝備：

```javascript
// 飾品（乘法）
speed_cape: { id: 'speed_cape', imgId: 5001, name: '攻速鬥篷', type: 'armor', icon: '🧥', def: 3, aspdBonus: 1.05, sell: 500, desc: '提升攻擊速度 5%。' },
agi_ring: { id: 'agi_ring', imgId: 5002, name: '敏捷戒指', type: 'armor', icon: '💍', def: 1, aspdBonus: 1.03, sell: 300, desc: '提升攻擊速度 3%。' },

// 特殊裝備（加法）
ranger_glove: { id: 'ranger_glove', imgId: 5003, name: '遊俠手套', type: 'armor', icon: '🧤', def: 2, aspdFlat: 8, sell: 800, desc: '直接提升攻擊速度 8 點。' },
```

**裝備 ASPD 規則：**
- `aspdBonus`：乘法加成（如 1.05 = +5%）
- `aspdFlat`：加法加成（如 8 = +8 ASPD）

- [ ] **Step 2: 驗證修改**

檢查新增裝備是否正確加入 `ITEMS`。

- [ ] **Step 3: Commit**

```bash
git add js/data.js
git commit -m "feat: add ASPD equipment items"
```

---

### Task 4: 實作 ASPD 計算邏輯

**Covers:** ASPD 計算公式、查找表

**Files:**
- Modify: `D:\mimo\ro-idle\js\engine.js`

**Interfaces:**
- Consumes: `state.stats`, `state.equip`, `state.buffs`, `currentJob()`
- Produces: `state.aspd`, `state.attackInterval`

- [ ] **Step 1: 新增 ASPD 查找表**

在 `js/engine.js` 開頭新增查找表：

```javascript
/* ---------------- ASPD 查找表 ----------------
   ASPD 範圍：100 ~ 193
   攻擊頻率與攻擊間隔的對應關係
------------------------------------------------- */
const ASPD_TABLE = [
  { aspd: 100, attacksPerSec: 0.5 },
  { aspd: 150, attacksPerSec: 1.0 },
  { aspd: 175, attacksPerSec: 2.0 },
  { aspd: 190, attacksPerSec: 5.0 },
  { aspd: 193, attacksPerSec: 7.14 }
];

function getAttackInterval(finalASPD) {
  // 在查找表中插值
  if (finalASPD <= ASPD_TABLE[0].aspd) {
    return Math.round(1000 / ASPD_TABLE[0].attacksPerSec);
  }
  if (finalASPD >= ASPD_TABLE[ASPD_TABLE.length - 1].aspd) {
    return Math.round(1000 / ASPD_TABLE[ASPD_TABLE.length - 1].attacksPerSec);
  }
  
  for (let i = 0; i < ASPD_TABLE.length - 1; i++) {
    if (finalASPD >= ASPD_TABLE[i].aspd && finalASPD <= ASPD_TABLE[i + 1].aspd) {
      const lower = ASPD_TABLE[i];
      const upper = ASPD_TABLE[i + 1];
      const t = (finalASPD - lower.aspd) / (upper.aspd - lower.aspd);
      const attacksPerSec = lower.attacksPerSec + t * (upper.attacksPerSec - lower.attacksPerSec);
      return Math.round(1000 / attacksPerSec);
    }
  }
  return 1000; // 預設 1 秒
}
```

- [ ] **Step 2: 修改 ASPD 計算邏輯**

修改 `recomputeDerived()` 函數中的 ASPD 計算：

```javascript
// ASPD：RO 原版公式 Base ASPD = (200 - 武器ASPD) + (AGI/4) + (DEX/5)
const weapon = state.equip.weapon ? ITEMS[state.equip.weapon] : null;
const weaponAspd = weapon && weapon.weaponAspd ? weapon.weaponAspd : 150; // 預設空手 150
const baseAspd = (200 - weaponAspd) + Math.floor(s.agi / 4) + Math.floor(s.dex / 5);

// 技能/BUFF 修正（乘法）
let aspdMult = 1;
state.buffs.forEach(b => {
  if (b.type === 'buff_aspd' && b.aspdMult) {
    aspdMult *= b.aspdMult;
  }
});

// 裝備修正（乘法 + 加法混合）
let aspdBonusMult = 1;
let aspdFlatBonus = 0;
['weapon', 'armor'].forEach(slot => {
  const item = state.equip[slot] ? ITEMS[state.equip[slot]] : null;
  if (item) {
    if (item.aspdBonus) aspdBonusMult *= item.aspdBonus;
    if (item.aspdFlat) aspdFlatBonus += item.aspdFlat;
  }
});

// 最終 ASPD
let finalAspd = Math.round((baseAspd * aspdMult * aspdBonusMult) + aspdFlatBonus);
finalAspd = Math.min(193, Math.max(100, finalAspd));

state.aspd = finalAspd;
state.attackInterval = getAttackInterval(finalAspd);
```

- [ ] **Step 3: 驗證計算**

在瀏覽器中建立新角色，檢查 `state.aspd` 和 `state.attackInterval` 是否正確計算。

- [ ] **Step 4: Commit**

```bash
git add js/engine.js
git commit -m "feat: implement ASPD calculation with lookup table"
```

---

### Task 5: 修改戰鬥迴圈使用攻擊間隔

**Covers:** 攻擊頻率系統

**Files:**
- Modify: `D:\mimo\ro-idle\js\engine.js`

**Interfaces:**
- Consumes: `state.attackInterval`
- Produces: 戰鬥迴圈使用攻擊間隔

- [ ] **Step 1: 新增攻擊計時器**

在 `state` 物件中新增攻擊計時器：

```javascript
// 在 createCharacter 函數的 state 物件中新增
lastAttackTime: Date.now(),
```

- [ ] **Step 2: 修改戰鬥迴圈**

修改 `gameTick()` 函數，使用攻擊間隔：

```javascript
function gameTick() {
  if (!state) return;
  tickCooldowns();
  tickBuffs();

  if (state.hp <= 0) return; // 等待復活流程

  passiveRegen();
  autoUsePotion();
  if (state.autoSkill) tryAutoCastSkill();

  if (!state.monster) spawnMonster();
  if (state.monster) {
    // 使用攻擊間隔控制攻擊頻率
    const now = Date.now();
    if (now - state.lastAttackTime >= state.attackInterval) {
      playerAttack();
      state.lastAttackTime = now;
    }
    
    if (state.monster && state.monster.hp > 0) {
      monsterAttack();
    }
  }
  saveGameThrottled();
  onTickUI();
}
```

- [ ] **Step 3: 驗證攻擊頻率**

在瀏覽器中測試，確認攻擊頻率符合 ASPD 數值。

- [ ] **Step 4: Commit**

```bash
git add js/engine.js
git commit -m "feat: update combat loop to use ASPD-based attack interval"
```

---

### Task 6: 更新 UI 顯示 ASPD 資訊

**Covers:** ASPD 資訊顯示

**Files:**
- Modify: `D:\mimo\ro-idle\js\ui.js`

**Interfaces:**
- Consumes: `state.aspd`, `state.attackInterval`
- Produces: UI 顯示 ASPD 資訊

- [ ] **Step 1: 在角色面板顯示 ASPD**

在 `js/ui.js` 的角色面板渲染函數中，新增 ASPD 顯示：

```javascript
// 在角色面板中新增 ASPD 資訊
html += `<div class="stat-row"><span class="stat-name">攻擊速度</span><span class="stat-value">${state.aspd}</span></div>`;
html += `<div class="stat-row"><span class="stat-name">攻擊間隔</span><span class="stat-value">${(state.attackInterval / 1000).toFixed(2)} 秒</span></div>`;
```

- [ ] **Step 2: 驗證 UI 顯示**

在瀏覽器中檢查角色面板是否正確顯示 ASPD 資訊。

- [ ] **Step 3: Commit**

```bash
git add js/ui.js
git commit -m "feat: add ASPD display to character panel"
```

---

### Task 7: 端對端測試

**Covers:** 完整 ASPD 系統

**Files:**
- 無新增檔案

**Interfaces:**
- Consumes: 所有先前任務的產出
- Produces: 完整功能的 ASPD 系統

- [ ] **Step 1: 測試基礎 ASPD 計算**

1. 開啟遊戲，建立新角色
2. 檢查 `state.aspd` 是否在合理範圍（100-193）
3. 確認攻擊頻率符合查找表

- [ ] **Step 2: 測試技能 ASPD 加成**

1. 學習攻速技能（如二刀流駕馭）
2. 使用技能，檢查 ASPD 是否乘法增加
3. 確認攻擊頻率加快

- [ ] **Step 3: 測試裝備 ASPD 加成**

1. 裝備攻速裝備（如攻速鬥篷）
2. 檢查 ASPD 是否正確增加
3. 確認攻擊頻率加快

- [ ] **Step 4: 測試 ASPD 上限**

1. 嘗試將 ASPD 堆到 193 以上
2. 確認 ASPD 被截斷在 193
3. 確認攻擊間隔不低於 140ms

- [ ] **Step 5: 最終驗證**

1. 遊戲運行 5 分鐘，觀察攻擊頻率穩定
2. 確認沒有 JavaScript 錯誤
3. 確認存檔/讀檔後 ASPD 資訊正確保留
