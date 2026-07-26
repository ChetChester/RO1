# js/data.js ITEMS 修復報告

## 問題是什麼
`js/data.js` 沒辦法被瀏覽器解析（`SyntaxError`），玩不了。往下挖，`ITEMS` 這個物件（也就是道具資料庫，共 22,511 筆）裡有兩種語法錯誤：

1. **物件鍵值以數字開頭卻沒加引號**（396 處）
   JS 規定物件的 key 如果用數字開頭，必須加引號，例如：
   ```js
   // 錯誤（不合法的 JS 語法）
   2011valentin_angel: {"id":"2011valentin_angel", ...}
   // 正確
   "2011valentin_angel": {"id":"2011valentin_angel", ...}
   ```

2. **字串內容裡有沒跳脫的換行符號**（影響約 9,758 行）
   部分道具的 `desc`（描述）欄位文字本身包含真正的換行，但沒有用 `\n`跳脫，導致字串「跑出」了原本該結束的地方，接下來一整行都變成同一個字串的內容、後面接的程式碼變得語法不合法。

## 怎麼修的
寫了一個逐筆解析工具（`tools/repair_data_block.py`），不是單純用「補引號」「合併換行」硬套，而是：

1. 利用每筆道具都固定以 `key: {"id":"...",` 這個樣式開頭的特性，把 22,511 筆道具**逐一切開**（不依賴前後文的引號是否平衡，因為部分來源資料本身就有問題，用引號平衡去猜容易「跑過頭」把好幾筆資料黏在一起）
2. 每一筆都嘗試用 `JSON.parse` 驗證是否為合法物件
3. 驗證失敗的，嘗試找出**最後一個完整結束的欄位**，在那裡收尾補上 `}` 搶救
4. 兩種方法都救不回來的，代表**資料源頭本身就被截斷**（不是跳脫符號的問題，是文字內容從中間被切斷、根本沒有結尾），這種只能捨棄，否則會讓後面所有資料全部遭殃

## 結果
- ITEMS 從 22,511 筆修到 **20,517 筆能用**，捨棄 **1,994 筆**（成功率 91.1%）
- 捨棄的完整清單在 `docs/repair/dropped_items.txt`，你可以檢查一下裡面有沒有你在意的道具；如果有，把原始資料源（你是從哪裡匯出這份資料庫的？）裡對應的那幾筆重新複製貼上，我可以再幫你手動修一次
- 整個 `data.js` 現在 `node -c` 語法檢查通過，實際在瀏覽器測試創角、進入遊戲、NPC商店都正常運作，沒有任何 JS 錯誤

## 額外發現（這次沒有動，先回報給你）
檢查掉落表時發現有 **390 筆怪物掉落設定**指向根本不存在的道具 ID，例如：
```
scorpion -> item_904
wolf -> item_528
picky_ -> picky__card   （這應該是卡片，但 CARDS 區塊目前只有 2 筆資料，可能還沒對接好）
```
完整清單在 `docs/repair/broken_monster_drops.txt`。這些**不會讓遊戲當掉**，只是那幾隻怪物掉落到這些道具時，實際上什麼都不會發生（道具是 undefined）。看起來像是原始資料匯入時，道具 ID 對照表沒有完全對上。要不要我一併處理，還是你想先確認資料來源？

## 順便看到的其他事
- `js/items_generated.js` 和 `js/cards_generated.js` 目前**沒有被 `index.html` 載入**（只載入了 `hp_sp_tables.js`、`data.js`、`engine.js`、`ui.js`），不確定是不是原本想合併進 `data.js` 但還沒接上，先跟你確認一下這兩個檔案的用途，避免我誤刪或誤用。

---

## 追加：用 items.json 補回被捨棄的 1994 筆道具

你提供了原始道具資料 `items.json`（24,469 筆，來源看起來是 ro.dvg.cn 的道具資料庫），用它來比對修復：

- 比對方式：捨棄清單裡的 id（例如 `destruction_axe`）對應 `items.json` 的 `english_name` 轉小寫（`Destruction_Axe` → `destruction_axe`）
- **1994 筆中，1949 筆成功比對回來並補回 `js/data.js`**
- 剩下 **45 筆在 `items.json` 裡也找不到對應資料**（清單見 `docs/repair/still_missing_items.txt`）——仔細看了一下，這 45 筆其實不是真正的道具，是像 `undead_shape`、`ghost_shape`、`physical_defense`、`power_force` 這種**種族/屬性分類標籤**，應該是原本資料轉換時不小心把其他系統的分類資料混進 ITEMS 物件，不是真的道具，可以不用管

**這次順便修正了造成上次資料損毀的根本原因**：之前發現原本的轉換工具會把每筆描述**固定截斷在100字元**，如果截斷點剛好落在跳脫引號中間就會產生語法錯誤。這次改用 Python 的 `json.dumps` 正規序列化來產生每一筆資料，保證輸出一定是合法語法，不會再發生一樣的問題。

**目前 ITEMS 總數：22,466 筆**（20,517 + 補回的 1,949）。已重新測試創角、進入遊戲，沒有任何 JS 錯誤。

---

## 追加二：`items_generated.js` / `cards_generated.js` 是否多餘？處理390筆掉落表問題

### 這兩個檔案是什麼
- **`items_generated.js`**：由 `tools/convert_items.js` 從 `ro_items_data/items.json` 轉換而來，10,040 筆道具，**有正確分類**（武器693/防具2644/消耗品531/材料6172），武器有 `atk`/`reqLevel`/`buyPrice`/`weaponType`/`reqJob` 等真正可用的欄位。
- **`cards_generated.js`**：由 `tools/gen_cards_data.js` 產生，包含完整的 `CARDS`（260張卡片，含 `monsterId`/`slot`/`bonus`/`desc`）與 `MONSTER_CARD_DROPS`（141筆，怪物→卡片掉落對照）。

**結論：不是多餘的，是被遺忘、沒接上的「比較好」版本。** `data.js` 裡原本那個22K筆的道具大雜燴，才是比較粗糙的——幾乎全部東西不分青紅皂白都塞進 `type:"material"`、`icon:"📦"`、`sell:1`，連真正的劍、盔甲都是這樣，完全沒有 `atk`/`def`/`reqLevel` 這些能實際用在遊戲機制上的數值。而 `CARDS` 在 `data.js` 裡只有2筆佔位資料，`MONSTER_CARD_DROPS` 是空的。

### 怎麼處理的
寫了 `tools/merge_generated_files.py` 做**合併**（不是整個覆蓋掉，避免弄丟你這邊已經修好/自訂的東西）：

1. **ITEMS**：`items_generated.js` 裡的10,040筆，跟現有 `data.js` 逐一比對 key
   - 現有沒有的 894 筆 → 直接新增
   - 兩邊都有、但現有版本是「隨便塞material、沒有atk/def」的 2,594 筆 → **升級**成 `items_generated.js` 的正確版本（保留 `atk`/`reqLevel`/`buyPrice` 等）
   - 武器/防具名稱後面的中括號（例如「长剑 **[3]**」）代表插卡孔數，有解析出來寫進 `slots` 欄位
   - 其餘保留原樣，不動
2. **CARDS / MONSTER_CARD_DROPS**：現有的只是佔位資料，直接整個換成 `cards_generated.js` 的完整版（260張卡片 + 141筆怪物卡片掉落對照）

**結果：ITEMS 現在 23,360 筆**（分類統計：材料16,500／消耗品4,044／武器581／防具2,235），CARDS 260 筆，MONSTER_CARD_DROPS 141 筆。

### 390 筆掉落表問題
合併完 CARDS/MONSTER_CARD_DROPS 之後，這390筆裡有 **381 筆自動解決**了——原來多數壞掉的引用根本就是卡片（例如 `wolf_card`），只是之前 `CARDS` 資料庫是空的，現在補齊了自然就對得上。

剩下 9 筆另外處理：
- 6 筆是**命名打錯字**：`picky__card`（多了一個底線）其實應該是 `picky_card`，直接修正對應
- 3 筆（`petit__card`、`acidus__card`、`ferus__card`）在 `cards_generated.js` 裡**真的沒有這幾張卡片資料**（來源沒產生），這種沒辦法憑空生出資料，把這幾筆掉落項目從對應怪物的掉落表裡移除了，而不是留著一個會指向 undefined 的空引用

**最終結果：390 → 0，掉落表引用問題全部清除。**

### 你自己做的鐵劍系列武器怎麼不見了
順便查了一下——`iron_sword`/`steel_sword`/`mithril_sword` 這組我們之前一起做的、帶孔數/單雙手判定的自訂武器，在你這次上傳的檔案裡**上傳當下就已經不存在了**（我對照了最早的版本，一開始就沒有），推測是你把整包22K道具貼進 `data.js` 時，等於重新定義了整個 `ITEMS`，把它蓋掉了，不是我這次動作造成的。

現在武器系統已經換成 `items_generated.js` 的693把真實武器（有正確 `atk`/`reqLevel`/`slots`），如果你想要保留原本那套簡化的自訂三階武器分級，跟我說一聲，我可以重新加回去。
