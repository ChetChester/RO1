/* ============================================================
   攻速基礎值資料（官方 R 版素質計算機）
   來源：https://ro.dvg.cn/tools/rocal/  js/Array.js
   ------------------------------------------------------------
   weapons 的 key 就是官方的武器分類，值是該職業拿該武器的基礎攻速值。
   一個職業的 weapons 裡「有沒有那個分類」同時也代表「這個職業能不能拿這種武器」，
   所以裝備限制直接讀這張表，不需要另外維護一份可用武器清單。
   （例：初心者沒有 bow → 新手不能拿弓；法師只有 dagger/rod → 不能拿劍與弓）

   shield.none / shield.shield 是左手空手／持盾的修正值；
   dual_* 是刺客系雙持時左手武器的值。

   本作用不到的職業（三轉、擴充職業）也一併保留，日後擴充可直接調用。
============================================================ */
const ASPD_WEAPON_BASE = {
  novice: { name: "初心者", weapons: { bare: 154, dagger: 138, sword1: 137, axe1: 144, mace: 144, rod1: 129 }, shield: { none: 0, shield: -6 } },
  x_超級初心者: { name: "超級初心者", weapons: { bare: 154, dagger: 138, sword1: 137, axe1: 144, mace: 144, rod1: 129 }, shield: { none: 0, shield: -6 } },
  x_超級初心者_等級突破_: { name: "超級初心者(等級突破)", weapons: { bare: 154, dagger: 138, sword1: 137, axe1: 144, mace: 144, rod1: 129 }, shield: { none: 0, shield: -6 } },
  swordsman: { name: "劍士", weapons: { bare: 154, dagger: 147, sword1: 147, sword2: 140, spear1: 137, spear2: 129, axe1: 139, axe2: 134, mace: 144 }, shield: { none: 0, shield: -5 } },
  knight: { name: "騎士/騎士領主", weapons: { bare: 154, dagger: 145, sword1: 149, sword2: 142, spear1: 139, spear2: 134, axe1: 144, axe2: 139, mace: 149 }, shield: { none: 0, shield: -5 } },
  x_十字軍_聖殿十字軍: { name: "十字軍/聖殿十字軍", weapons: { bare: 154, dagger: 146, sword1: 151, sword2: 139, spear1: 141, spear2: 142, axe1: 144, axe2: 139, mace: 149 }, shield: { none: 0, shield: -5 } },
  x_盧恩騎士: { name: "盧恩騎士", weapons: { bare: 154, dagger: 144, sword1: 142, sword2: 139, spear1: 134, spear2: 136, axe1: 146, axe2: 142, mace: 149 }, shield: { none: 0, shield: -5 } },
  x_皇家禁衛軍: { name: "皇家禁衛軍", weapons: { bare: 154, dagger: 147, sword1: 149, sword2: 141, spear1: 144, spear2: 144, axe1: 146, axe2: 142, mace: 150 }, shield: { none: 0, shield: -5 } },
  mage: { name: "法師", weapons: { bare: 144, dagger: 144, rod1: 139, rod2: 139 }, shield: { none: 0, shield: -10 } },
  wizard: { name: "巫師/超魔導", weapons: { bare: 144, dagger: 140, rod1: 141, rod2: 141 }, shield: { none: 0, shield: -8 } },
  x_賢者_智者: { name: "賢者/智者", weapons: { bare: 149, dagger: 141, rod1: 139, rod2: 139, book: 151 }, shield: { none: 0, shield: -5 } },
  x_咒術士: { name: "咒術士", weapons: { bare: 149, dagger: 142, rod1: 144, rod2: 138 }, shield: { none: 0, shield: -5 } },
  x_妖術師: { name: "妖術師", weapons: { bare: 154, dagger: 144, rod1: 149, rod2: 139, book: 149 }, shield: { none: 0, shield: -5 } },
  archer: { name: "弓箭手", weapons: { bare: 154, dagger: 139, bow: 144 }, shield: { none: 0, shield: -9 } },
  hunter: { name: "獵人/神射手", weapons: { bare: 154, dagger: 141, bow: 146 }, shield: { none: 0, shield: -9 } },
  x_詩人_舞孃: { name: "詩人/舞孃", weapons: { bare: 154, dagger: 141, bow: 146, instrument: 149 }, shield: { none: 0, shield: -7 } },
  x_遊俠: { name: "遊俠", weapons: { bare: 154, dagger: 144, bow: 145 }, shield: { none: 0, shield: -8 } },
  x_宮廷樂師: { name: "宮廷樂師", weapons: { bare: 154, dagger: 142, bow: 145, instrument: 150 }, shield: { none: 0, shield: -7 } },
  x_浪跡舞者: { name: "浪跡舞者", weapons: { bare: 154, dagger: 142, bow: 145, whip: 150 }, shield: { none: 0, shield: -7 } },
  merchant: { name: "商人", weapons: { bare: 154, dagger: 142, sword1: 142, axe1: 146, axe2: 139, mace: 144 }, shield: { none: 0, shield: -5 } },
  blacksmith: { name: "鐵匠/神工匠", weapons: { bare: 154, dagger: 144, sword1: 144, axe1: 148, axe2: 141, mace: 146 }, shield: { none: 0, shield: -5 } },
  x_煉金術師_創造者: { name: "煉金術師/創造者", weapons: { bare: 154, dagger: 144, sword1: 149, axe1: 149, axe2: 142, mace: 149 }, shield: { none: 0, shield: -4 } },
  x_機械工匠: { name: "機械工匠", weapons: { bare: 154, dagger: 134, sword1: 129, axe1: 149, axe2: 146, mace: 146 }, shield: { none: 0, shield: -6 } },
  x_基因學者: { name: "基因學者", weapons: { bare: 154, dagger: 144, sword1: 150, axe1: 146, axe2: 143, mace: 150 }, shield: { none: 0, shield: -4 } },
  thief: { name: "盜賊", weapons: { bare: 154, dagger: 146, sword1: 144, axe1: 134, bow: 141 }, shield: { none: 0, shield: -6 } },
  assassin: { name: "刺客/十字刺客", weapons: { bare: 154, dagger: 152, sword1: 144, axe1: 143, katar: 152 }, shield: { none: 0, shield: -6, dual_dagger: 152, dual_sword1: 144, dual_axe1: 143 } },
  x_流氓_神行太保: { name: "流氓/神行太保", weapons: { bare: 154, dagger: 149, sword1: 144, axe1: -6, bow: 144 }, shield: { none: 0, shield: -5 } },
  x_十字斬首者: { name: "十字斬首者", weapons: { bare: 154, dagger: 152, sword1: 129, axe1: 114, katar: 152 }, shield: { none: 0, shield: -9, dual_dagger: 152, dual_sword1: 129, dual_axe1: 114 } },
  x_魅影追蹤者: { name: "魅影追蹤者", weapons: { bare: 154, dagger: 151, sword1: 147, axe1: -6, bow: 147 }, shield: { none: 0, shield: -4 } },
  acolyte: { name: "服事", weapons: { bare: 154, mace: 149, rod1: 134, rod2: 134 }, shield: { none: 0, shield: -7 } },
  priest: { name: "祭司/神官", weapons: { bare: 154, mace: 151, rod1: 134, rod2: 134, book: 150, knuckle: 134 }, shield: { none: 0, shield: -5 } },
  x_武僧_武宗術師: { name: "武僧/武宗術師", weapons: { bare: 154, mace: 151, rod1: 134, rod2: 136, knuckle: 154 }, shield: { none: 0, shield: -5 } },
  x_大主教: { name: "大主教", weapons: { bare: 149, mace: 149, rod1: 134, rod2: 139, book: 150, knuckle: 144 }, shield: { none: 0, shield: -5 } },
  x_修羅: { name: "修羅", weapons: { bare: 156, mace: 151, rod1: 146, rod2: 144, knuckle: 155 }, shield: { none: 0, shield: -5 } },
  x_召喚師_喵_: { name: "召喚師(喵)", weapons: { bare: 154, rod1: 134 }, shield: { none: 0, shield: -7 } },
  x_忍者: { name: "忍者", weapons: { bare: 154, dagger: 151, shuriken: 139 }, shield: { none: 0, shield: -3, dual_dagger: 149 } },
  x_影狼_日影: { name: "影狼/日影", weapons: { bare: 154, dagger: 149, shuriken: 144 }, shield: { none: 0, shield: -3, dual_dagger: 149 } },
  x_朧_月影: { name: "朧/月影", weapons: { bare: 154, dagger: 149, shuriken: 144 }, shield: { none: 0, shield: -3, dual_dagger: 149 } },
  x_神槍手: { name: "神槍手", weapons: { bare: 144, pistol: 149, rifle: 139, shotgun: 104, gatling: 144, grenade: 94 }, shield: { none: 0, shield: -10 } },
  x_叛亂者: { name: "叛亂者", weapons: { bare: 149, pistol: 144, rifle: 139, shotgun: 104, gatling: 146, grenade: 114 }, shield: { none: 0, shield: -10 } },
  x_跆拳家: { name: "跆拳家", weapons: { bare: 154 }, shield: { none: 0, shield: -6 } },
  x_拳聖: { name: "拳聖", weapons: { bare: 154, book: 144 }, shield: { none: 0, shield: -6 } },
  x_悟靈士: { name: "悟靈士", weapons: { bare: 144, dagger: 144, rod1: 141, rod2: 139 }, shield: { none: 0, shield: -6 } },
  x_拳皇: { name: "拳皇", weapons: { bare: 154, book: 149 }, shield: { none: 0, shield: -3 } },
  x_獵靈士: { name: "獵靈士", weapons: { bare: 149, dagger: 154, rod1: 144, rod2: 138 }, shield: { none: 0, shield: -5 } },
};
