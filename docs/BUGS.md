# RO-Idle Bug 追蹤清單

> 建立日期：2026-07-26
> 用法：每次維修前讀這份文件，修完後把對應項目標記 `[x]` 並附上修復日期

---

## 嚴重 Bug（會影響遊戲數值正確性）

### [x] #1 DEX 被動技能屬性膨脹
- **位置**：`js/engine.js` recomputeDerived() 第 194 行
- **問題**：`dexFlat` 被動技能直接修改 `state.stats.dex`，每次呼叫 recomputeDerived() 都會再加一次，導致 DEX 隨升級/轉職/加點無限累加
- **影響**：owleye Lv5（dexFlat=5）在 10 次 recomputeDerived 後 DEX 多出 50 點
- **觸發時機**：升級、轉職、加點、穿脫裝備、插拔卡片、死亡復活、離線結算
- **修法**：在 recomputeDerived 開頭先算出 passiveDexBonus，加入 cDex 參與衍生數值計算；computeAspd() 改用 effectiveDex；移除 dexFlat 對 state.stats.dex 的直接寫入
- **修復日期**：2026-07-26 ✅

### [ ] #2 騎乘術 maxMonsters 無效
- **位置**：`js/engine.js` recomputeDerived() 第 201 行
- **問題**：`Math.max(state.maxMonsters || 1, 1)` 永遠回傳現值（5），沒有實際增加
- **影響**：騎士騎乘波利後最多怪物數量沒有增加
- **修法**：改為 `state.maxMonsters = Math.max(state.maxMonsters || 5, 7)` 或依技能描述增加
- **修復日期**：

### [x] #3 角色分頁 DEF 精煉顯示錯誤
- **位置**：`js/ui.js` renderCharacterTab() 第 1282 行
- **問題**：顯示時把所有欄位精煉等級加總後傳入 getRefinementDefBonus(total)，但戰鬥計算時是逐欄位個別計算
- **影響**：顯示的 DEF 精煉加成與實際不符
- **修法**：改為逐欄位計算後加總，與 equippedDef() 保持一致
- **修復日期**：2026-07-26 ✅

### [x] #4 Wizard baseAspd 格式錯誤
- **位置**：`js/data.js` 第 279 行 / `js/engine.js` computeAspd()
- **問題**：`baseAspd: 150` 是數字而非武器類型物件，computeAspd() 取 `job.baseAspd[weaponType]` 會得到 undefined
- **影響**：巫師 ASPD 設定被忽略，回退到預設值 154
- **修法**：修正 computeAspd() 同時支援數字與物件格式——數字代表全武器統一值，物件依武器類型查表
- **修復日期**：2026-07-26 ✅

### [x] #5 doubleattack 技能類型錯誤
- **位置**：`js/data.js` 第 200 行 / `js/engine.js` playerAttack()
- **問題**：描述為「被動技能，普攻有機率造成二連擊」，但 `type: 'damage'` 被當主動技
- **影響**：自動戰鬥中會嘗試施放此技能，而非被動觸發
- **修法**：改為 `type: 'passive'` + `passiveStat: 'doubleAttack'`；新增 `doubleAttackChance` 陣列（10%~55%）；在 playerAttack() 中第一段命中後檢查是否觸發二連擊，第二段傷害 ×1.1~2.0
- **修復日期**：2026-07-26 ✅

---

## 中等問題

### [ ] #6 自動喝藍水缺失
- **問題**：POTION_TIERS 只有紅橙黃白藥水，沒有 SP 藥水
- **建議**：自動戰鬥設定加 SP 條件喝藍水

### [x] #7 飾品不能插卡
- **問題**：`EQUIP_CARD_SLOTS` 中 accessory1/accessory2 為 0 孔
- **建議**：改為 1 孔或依物品欄位 slots 決定
- **修復日期**：2026-07-26 ✅

### [ ] #8 三轉路線未實作
- **問題**：JOB_TIER3_PLACEHOLDER 已預留但三轉路線為空
- **建議**：實作 lordknight/highwizard/sniper 等三轉職業

### [x] #9 死代碼 monsterAttack()
- **位置**：`js/engine.js`
- **問題**：monsterAttack() 從未被呼叫，gameTick 裡已用 inline 邏輯取代
- **建議**：刪除
- **修復日期**：2026-07-26 ✅

### [x] #10 CSS 重複定義
- **問題**：`.slot-title`、`.npc-shop-list` 等多個 class 重複定義兩次
- **建議**：清理重複的 CSS 規則
- **修復日期**：2026-07-26 ✅

---

## 小問題 / 建議

- [ ] 裝備比較：換裝時顯示 ATK/DEF 變化
- [ ] 死亡復活加倒計時（3-5 秒）
- [ ] 屬性克制在怪物頭上加大飄字
- [ ] `items_generated.js` / `cards_generated.js` 未被載入（已合併進 data.js，可清理）
- [ ] `pendingFloatTargetId` 跨檔案引用（engine.js 使用 ui.js 定義的變數）
- [ ] 遊戲目前沒有任何補SP的消耗品道具（`ITEMS` 裡沒有 `restoreSp` 欄位）。手推車使用（`pushcart`）被動目前只會給HP藥水，等新增SP藥水道具後要讓它也能隨機給SP藥水
