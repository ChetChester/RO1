# 圖片資料夾使用說明

把美術圖丟進對應資料夾、用「編號.png」命名覆蓋掉佔位圖，遊戲就會自動改用你的圖，
**完全不用改程式碼**。目前每個項目都已經有一張自動產生的佔位圖佔著位置，
佔位圖上寫著分類／編號／英文代號，方便你知道每個檔案對應哪個怪物或道具。

## 資料夾結構
```
images/
├── _placeholder_monster.png   ← 找不到怪物圖時的通用預留圖
├── _placeholder_item.png      ← 找不到道具圖時的通用預留圖
├── _placeholder_weapon.png    ← 找不到武器圖時的通用預留圖
├── _placeholder_armor.png     ← 找不到防具圖時的通用預留圖
├── _placeholder_map.png       ← 找不到地圖底圖時的通用預留圖
├── monsters/     怪物圖，檔名 = 怪物編號.png（例如 1002.png）
├── items/        消耗品/素材圖，檔名 = 道具編號.png
├── maps/         地圖背景圖，檔名 = 地圖編號.png（例如 5001.png，建議 480×270 或同比例橫圖）
├── frames/       玩家角色的逐格動畫，見下面「角色動畫」
└── equip/
    ├── weapon/   武器圖，檔名 = 武器編號.png
    └── armor/    防具圖，檔名 = 防具編號.png
```

音樂資料夾請見 `music/README.md`。

## 角色動畫 frames/

一個資料夾一組動作，裡面放 `frame_000.png` ～ `frame_019.png`（連號，不必放滿 20 張，
放幾張就播幾格）。同一組裡的圖尺寸要一致，不同組之間不用。畫面上固定顯示成 120×160。

資料夾名稱就是 `js/ui.js` 的 `getAnimKey()` 算出來的 key：

| 格式 | 什麼時候播 | 例子 |
|---|---|---|
| `<職業id>_<性別>` | 普攻，也是站著不動時的預設 | `monk_male`、`sage_female` |
| `<職業id>_<性別>_mount` | 該職業**手上拿槍**時，整組取代上面那個 | `lordknight_male_mount` |
| `<職業id>_<性別>_skill` | 放技能的瞬間播一次，播完自己回上面那組 | `wizard_female_skill` |
| `<職業id>_<性別>_mount_skill` | 騎乘中放技能 | `lordknight_male_mount_skill` |

職業 id 看 `js/jobs.js` 的 `JOB_TREE`，性別只有 `male` / `female`。
**沒有的組合就是沒有**——找不到資料夾不會噴錯，`_skill` 沒圖就不播施放動作，
連普攻那組都沒有才會退回 `player_swordsman.svg` 那張靜圖。

兩張對照表在 `js/ui.js`：
- `MOUNT_SPRITE_JOBS` — 哪些職業拿槍要換騎乘圖，以及沒有自己的圖時去借誰的
  （騎士與十字軍目前借騎士領主那組大嘴鳥）
- `SPRITE_ALIAS` — 整個職業直接借別人的圖（超級新手借新手）

還沒實作的職業（`JOBS_TRANS_PENDING` / `JOBS_TIER3_PENDING`）的圖已經先照
上面的規則放好了，職業做出來當天不用再動圖。

## 規格建議
- 格式：PNG（支援透明背景）
- 尺寸：建議 128×128px（正方形），遊戲內會自動縮放適應版面
- 檔名：**必須是純數字編號 + .png**，例如 `1002.png`，不要加怪物名字

## 編號對照表

### 怪物 monsters/（1001 ~ 1034）
| 編號 | 英文代號 | 名稱 | 編號 | 英文代號 | 名稱 |
|---|---|---|---|---|---|
| 1001 | lunatic | 瘋兔 | 1018 | smokie | 鍬形蟲 |
| 1002 | poring | 波利 | 1019 | rocker | 搖滾蝗蟲 |
| 1003 | fabre | 綠棉蟲 | 1020 | thief_bug_egg | 盜蟲卵 |
| 1004 | wolf | 狼 | 1021 | drops | 露珠 |
| 1005 | hornet | 蜂兵 | 1022 | savage_babe | 獸人女戰士 |
| 1006 | goblin | 哥布林 | 1023 | baby_desert_wolf | 沙漠幼狼 |
| 1007 | orc | 半獸人戰士 | 1024 | condor | 禿鷹 |
| 1008 | pupa | 蟲蛹 | 1025 | savage | 獸人戰士 |
| 1009 | willow | 柳精 | 1026 | goblin_archer | 哥布林弓兵 |
| 1010 | spore | 孢子 | 1027 | green_plant | 綠精 |
| 1011 | poporing | 波波利 | 1028 | blue_plant | 藍精 |
| 1012 | pecopeco | 波利波利鳥 | 1029 | shining_plant | 閃光精靈（稀有） |
| 1013 | picky | 小雞 | 1030 | yellow_plant | 黃精 |
| 1014 | creamy | 克瑞米 | 1031 | red_mushroom | 紅菇 |
| 1015 | thief_bug | 盜蟲 | 1032 | black_mushroom | 黑菇 |
| 1016 | mandragora | 曼陀羅魔花 | 1033 | eclipse | 日蝕（稀有） |
| 1017 | yoyo | 溜溜猴 | 1034 | panzer_goblin | 裝甲哥布林（稀有精英） |

### 道具 items/（2001 ~ 2011）
| 編號 | 英文代號 | 名稱 |
|---|---|---|
| 2001 | red_potion | 紅色藥水 |
| 2002 | orange_potion | 橘色藥水 |
| 2003 | yellow_potion | 黃色藥水 |
| 2004 | white_potion | 白色藥水 |
| 2005 | fresh_fish | 新鮮的魚 |
| 2006 | blue_potion | 藍色藥水 |
| 2007 | strawberry | 草莓 |
| 2008 | jellopy | 果凍質塊 |
| 2009 | fluff | 獸毛 |
| 2010 | fang | 尖牙 |
| 2011 | feather | 羽毛 |

### 武器 equip/weapon/（3001 ~ 3163）
完整武器圖片已從 divine-pride.net 下載對應 RO 官方圖片。
| 範圍 | 類型 |
|---|---|
| 3001~3010 | 短劍 (Dagger) |
| 3020~3025 | 劍 (Sword) |
| 3040~3045 | 雙手劍 (Two-Handed Sword) |
| 3060~3066 | 弓 (Bow) |
| 3080~3087 | 法杖 (Rod) |
| 3100~3103 | 鈍器 (Mace) |
| 3120~3122 | 拳刃 (Katar) |
| 3140~3142 | 長矛 (Spear) |
| 3160~3163 | 拳套 (Knuckle) |

### 防具 equip/armor/（4001 ~ 4110）
完整防具圖片已從 divine-pride.net 下載對應 RO 官方圖片。
| 範圍 | 類型 |
|---|---|
| 4001~4006 | 衣服 (Cloth) |
| 4020~4025 | 皮甲 (Leather) |
| 4040~4045 | 盾牌 (Shield) |
| 4060~4065 | 披風 (Garment) |
| 4080~4086 | 鞋子 (Footgear) |
| 4100~4107 | 飾品 (Accessory) |
| 4108~4110 | 攻速裝備 |

### 地圖 maps/（5001 ~ 5018）
普隆德拉地區已完整展開為 1 座城鎮 + 12 張原野（對應真實地圖 prt_fild00~11）。
| 編號 | 英文代號 | 名稱 | 編號 | 英文代號 | 名稱 |
|---|---|---|---|---|---|
| 5001 | novice_ground | 新手訓練場 | 5010 | prt_fild07 | 搖滾蝗蟲谷地 |
| 5002 | prontera | 普隆德拉（城鎮） | 5011 | prt_fild08 | 普隆德拉草原 |
| 5003 | prt_fild00 | 普隆德拉原野·東 | 5012 | prt_fild09 | 蠻荒邊境 |
| 5004 | prt_fild01 | 普隆德拉原野·北 | 5013 | prt_fild10 | 蠻荒之地 |
| 5005 | prt_fild02 | 曼陀羅原野 | 5014 | prt_fild11 | 哥布林前哨 |
| 5006 | prt_fild03 | 溜溜猴谷 | 5015 | payon | 培恩（城鎮） |
| 5007 | prt_fild04 | 搖滾蝗蟲原野 | 5016 | payon_field | 培恩原野 |
| 5008 | prt_fild05 | 普隆德拉原野·西 | 5017 | morroc | 摩洛克（城鎮） |
| 5009 | prt_fild06 | 普隆德拉原野·南 | 5018 | morroc_desert | 摩洛克沙漠 |

## 之後新增怪物/道具/地圖時怎麼辦？
在 `js/data.js` 新增資料時，記得也一起加上 `imgId` 欄位（照分類延續編號，例如新怪物用 1035、
新武器用 3005、新地圖用 5019），對應圖片沒放進資料夾之前，遊戲會自動顯示該分類的通用預留圖
（`_placeholder_xxx.png`），不會噴錯，畫面上就能一眼看出「這個還缺圖」。

如果想重新產生一整套佔位圖（例如新增大量資料後），可以執行：
```
cd tools
node -e "$(cat ../js/data.js); const out={monsters:MONSTERS,items:ITEMS,maps:{}}; MAPS.forEach(m=>out.maps[m.id]=m); console.log(JSON.stringify(out))" > /tmp/gamedata.json
python3 build_placeholders.py
```
（需要 Python3 + Pillow：`pip install pillow`）
