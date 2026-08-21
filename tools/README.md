# tools/

這個資料夾裡**大部分的東西沒有進版控**（見根目錄 `.gitignore`）。

原因：`tools/` 底下有 190 多支一次性的資料搬遷腳本（`add_*` / `backfill_*` /
`fix_*` / `implement_card_*` …），那些是把官方資料匯進 `js/data.js` 時用的，
跑完就沒用了，而且全都依賴不在版控裡的原始資料檔（`ro_items_data/`、
`item_db_usable.yml` 那些）。留在 repo 裡只會讓 fork 的人以為那些腳本能跑。

進版控的只有這三樣：

| 檔案 | 用途 |
|---|---|
| `harness.js` | 測試治具：把整個遊戲載進 Node 真的跑起來 |
| `test.js` + `test_*.js` | 測試套件（27 個測試檔） |
| `pack_release.js` | 打包單機版 zip |
| `exp_simlib.js` + `measure_exp_*.js` + `tune_exp_100_200.js` | 經驗曲線的量測與校準 |

## 測試

```bash
node tools/test.js            # 全部跑一遍
node tools/test_relics.js     # 只跑其中一個
```

治具載入的是 `js/` 底下同一份程式碼，走的是 `recomputeDerived()` /
`castSkill()` / `playerAttack()` 本尊——不是靜態分析。這個專案抓到的幾個 bug
（buff 推了卻沒人讀、存檔被換身流程蓋掉）都只有真的跑起來才看得到。

**但它不載入 `js/ui.js`**（那一份幾乎每一行都在碰 DOM）。所以治具驗得了
「數值與機制」，驗不了「畫面長怎樣」——畫面要開瀏覽器看。

⚠️ **改完 JS 記得 `node --check`。** 語法錯誤測試抓不到（ui.js 不在治具裡），
整支檔案掛掉時畫面只會剩靜態 HTML，而測試照樣全過。

寫測試的原則：只驗**會壞的東西**。不要把資料檔裡的數字抄一遍當斷言——
那是在驗「資料等於資料」，改一次數值就要改兩個地方，而且抓不到任何 bug。
驗的應該是「引擎有沒有照那份資料算」。

## 經驗曲線

```bash
node tools/measure_exp_curve.js        # 1~99：量每級實際 exp/秒
node tools/measure_exp_100_200.js      # 100~200：領主騎士 + 打寶一般檔
node tools/tune_exp_100_200.js         # 拿實測值反推該用哪組係數
```

量的方式是**真的把 gameTick() 接上假時鐘跑過去**，不是查表估算。
`js/data.js` 的曲線註解會指回這幾支，改係數之後請重跑一次再改註解裡的數字。

⚠️ 校準時記得：**離線結算沒有折扣**（`applyOfflineProgress()` 抽 3 秒實戰再外推），
所以「掛機一天」就是滿速一天。舊版曲線假設離線只有主動的 24%，總量因此少配了 2.3 倍。

## 打包

```bash
node tools/pack_release.js v1.1
```

產出 `dist/諸神放置錄_v1.1.zip`，玩家解壓縮後雙擊 `index.html` 就能玩。
只放遊戲真的會用到的檔案（`index.html` / `css` / `js` / `images` / `music` /
`WAV` / `LICENSE` / 玩法說明），排除 `tools`、`docs`、`node_modules`、`.git`。
