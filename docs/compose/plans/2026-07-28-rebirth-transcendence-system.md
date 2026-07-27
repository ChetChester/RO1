# 轉生（Trans）系統提案 — 暫緩實裝

> **狀態：僅存檔備查，尚未獲得實裝許可。** 使用者要求「先將此方案存檔暫不使用」，日後若要繼續，請先回頭跟使用者確認「四、需要你決定的地方」裡的問題，取得明確「可以」之後才動工，比照本專案這學期其他職業改版的既有流程（先出方案 → 使用者確認 → 才動 data.js/engine.js）。

## 背景

`js/data.js` 的 `JOB_TREE` 裡，六個2轉職業（騎士/巫師/獵人/鐵匠/刺客/祭司）都已經寫了 `nextLocked` 欄位指向轉生二轉職業：

```
knight      -> nextLocked: ['lordknight']
wizard      -> nextLocked: ['highwizard']
hunter      -> nextLocked: ['sniper']
blacksmith  -> nextLocked: ['whitesmith']
assassin    -> nextLocked: ['assassincross']
priest      -> nextLocked: ['highpriest']
```

`nextLocked` 目前在 `engine.js`/`ui.js` 完全沒有被讀取（純資料佔位），代表原始設計就預留了轉生功能，只是從未實裝。本方案就是把這個坑填起來。

## 一、轉生機制設計

- **觸發條件**（比照現有 `canJobChange()` 邏輯）：
  - 目前為2轉職業之一，職業等級達到該職業的 `jobLevelMax`（現行皆為50）
  - 當前職業技能點必須用完（`state.jobSkillPoints[state.jobId] === 0`）
  - 基本等級（`state.baseLevel`）達到99（`baseLevelCap` 現在硬編碼在 `engine.js:1977`）
- **重置內容**：`state.baseLevel = 1`、`state.jobLevel = 1`、`state.jobExp = 0`、`state.skillPoints`／`state.jobSkillPoints[newJobId]` 歸零 —— 完全比照現有 `doJobChange()` 的重置邏輯，不需要新機制。
- **保留內容（永久誘因的關鍵）**：`state.jobLevelHistory` 繼續累積寫入（`doJobChange()` 本來就會在轉職前把 `state.jobLevelHistory[state.jobId] = state.jobLevel` 存起來）。`computeJobBonuses()`（`engine.js:2803`）是「跨職業累計繼承」機制，會把 `getAllLearnedJobs()` 沿著 `parent` 鏈往回走的每個職業的 `bonusLevels` 都加總進最終屬性加成。轉生後多了「轉生一轉」＋「轉生二轉」兩層新的 `bonusLevels`，永久屬性加成點數會比不轉生多——這是轉生唯一但關鍵的機制性誘因，不需要另外發明新的「轉生獎勵」系統。
- **等級上限**：轉生後 `baseLevelCap` 建議維持99不變（比照官方：轉生後等級歸零重新練到99，不是把上限拉高到198）。

## 二、新增根職業：超新手（High Novice）

- `parent: null`（跟 `novice` 平級，但只有轉生後才能進入）
- 沒有技能（比照 `novice` 的起始定位）
- `next`: 六個轉生一轉職業

## 三、轉生一轉（6個）

鏡像現有六個一轉職業（劍士/魔法師/弓箭手/商人/盜賊/服事）：技能表、數值原封不動沿用，只是 `parent` 改成 `high_novice`。純架構性的過渡層，不需要新設計。

## 四、轉生二轉（6個）— 初步方案

技能名稱已對照官方 pre-renewal skill_db 核對過（見下方「已核實資料」）。**數值（等級曲線/SP消耗/倍率）尚未設計**，待使用者確認方向後才會補上，比照本次工程一貫先出骨架再談數值的做法。

| 職業 id | 名稱 | 繼承 | 新增代表技能（僅名稱+概念，無數值） |
|---|---|---|---|
| `lordknight` | 羅德騎士 | 繼承騎士全部技能（狂擊/怒爆/長矛系列本學期已提前實裝） | 狂咲之力 Frenzy（HP<25%大幅ATK提升，持續掉血）、螺旋穿刺 Spiral Pierce（連刺攻擊升級，多段貫穿傷害更高） |
| `highwizard` | 大魔導士 | 繼承巫師全部技能 | 流星雨 Meteor Storm（大範圍火屬性AOE）、暴風雪 Storm Gust（大範圍冰屬性AOE，附凍結）、魂之操縱 Soul Drain（魔法擊殺人型系怪回SP）、坎巴汀 Ganbantein（清除場地類效果） |
| `sniper` | 狙擊手 | 繼承獵人全部技能（獵鷹突襲本學期已實裝雛形） | 疾風步 Wind Walk（移動速度+迴避buff）、鷹眼 True Sight（全屬性buff）、鷹式攻擊 Falcon Assault（獵鷹強化突襲，取代/升級現有獵鷹突襲被動） |
| `whitesmith` | 白匠 | 繼承鐵匠全部技能 | 手推車終結技 Cart Termination（手推車單體爆發傷害）、力量壓榨 Maximize Power（ATK大幅提升但SP消耗加倍）、武器精通 Weapon Perfection（無視體型傷害修正） |
| `assassincross` | 暗影刺客 | 繼承刺客全部技能 | 毒爆 Venom Splasher（範圍毒屬性爆炸）、鬼牙 Grimtooth（多段穿透暗器投擲）、破魂擊 Soul Breaker（無視迴避必定命中）、流星 Meteor Assault（旋轉暗器攻擊附暈眩機率） |
| `highpriest` | 高等祭司 | 繼承祭司全部技能（光耀之堂本學期已實裝） | 假設狀態 Assumptio（大幅減傷buff）、冥想 Meditatio（被動SP自然恢復加成）、聖殿 Basilica（安全結界場域，敵人無法進入/攻擊）、魔力充填 Mana Recharge（INT相關機率回SP被動） |

**核實備註**：搜尋官方資料時發現「流星攻擊 Meteor Assault」「破魂擊 Soul Breaker」屬於暗影刺客而非高等祭司，「意志破壞 Mind Breaker」屬於教授（Professor，本遊戲未實裝的分支）而非高等祭司——已排除誤植，上表為核實後版本。

**誠實揭露**：這學期已經把不少「原本該留給轉生」的機制提前做進2轉職業了（長矛系列技能、獵鷹突襲雛形、光耀之堂），所以真正屬於「轉生才有」的新內容，份量會比單看官方轉生技能列表來得少——這是先前工程進度造成的自然結果，不是這次方案偷工減料。

## 五、系統面需要新增/調整的地方（僅列出，尚未動工）

1. `js/data.js`：新增 `high_novice` + 6個轉生一轉 + 6個轉生二轉，共13個新 `JOB_TREE` 條目
2. `JOB_BASE_HP` / `JOB_BASE_SP` 表：需要新增這13個職業 id 的成長曲線（轉生二轉官方數值通常比2轉更高，例如羅德騎士 hpMod 官方約1.75 vs 騎士現有1.5，需要抓官方倍率或由使用者指定）
3. `engine.js`：轉生的觸發/重置邏輯（可大量沿用 `doJobChange()`，但需要另外處理 `baseLevel` 歸零與「轉生旗標」判斷）
4. `ui.js`：需要新增「轉生」的操作入口與確認流程（目前 `nextLocked` 完全沒有對應UI）
5. `js/data.js` 的 `ITEMS` 裡已經有不少道具的 `desc` 寫著「裝備：轉生劍士系/轉生2轉專用」等字樣（是原始素材裡就帶的flavor text），但 `reqJob` 欄位陣列尚未包含任何轉生職業 id——若要讓這些既有道具在轉生後真正限定/開放裝備，需要回頭補上 `reqJob`，屬於後續加分項，非必要阻塞項

## 六、需要使用者決定的事項（原封不動保留，尚未有答案）

1. 六個轉生二轉都要做，還是先挑1-2個做示範？（比照本學期其他職業都是先做一組再擴充的模式）
2. 上面的代表技能只有官方名稱對照與概念說明，還沒有設計數值（等級/SP消耗/倍率）——要先出完整技能規格表再問一次，還是這次直接把數值一併定案？
3. HP/SP成長表：轉生職業要比現有2轉更高（比照官方），除非使用者有想要的具體數字，否則會抓官方倍率去對應換算。
