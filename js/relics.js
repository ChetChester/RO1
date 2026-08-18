/* ============================================================
   諸神放置錄 — 免費同人放置遊戲
   本作完全免費，純為懷舊而作。**禁止任何形式的販售或營利**
   （販售、內購、付費解鎖、廣告分潤皆不允許），修改版本亦同。
   設定致敬《仙境傳說 Ragnarok Online》；程式與文字為原創實作，
   與 Gravity Co., Ltd. 無關，亦未獲其授權或認可。
   授權：CC BY-NC-SA 4.0（可散布可改作，不得商用，衍生版本須同樣授權）。
   特別鳴謝：本作靈感源自 秋玥[shifine] 發布的免費遊戲。
   完整聲明與授權全文見 repo 根目錄的 LICENSE。
   ============================================================ */
/* ================= 遺物系統（#113）=================

   打寶模式專屬的「第二套裝備」。跟一般裝備完全分開：自己的 8 個欄位、
   自己的分頁、不能精煉也不能插卡（保持單一能力），只在打寶模式掉落。

   為什麼另開一套欄位，而不是沿用 EQUIP_SETS：
     EQUIP_SETS 的語意是「全套穿齊才生效」（見 engine.js 的 effectiveGearBonuses），
     遺物要的是 2/3/5 三段門檻，而且要能兩套混搭（5+3）。
     硬塞進去會讓那支函式同時服務兩種互相矛盾的語意。

   八個欄位一對一對應八個部位，每套剛好 8 件。實際上不會有人穿滿一套——
   湊到 5 件就拿到全部效果，剩下 3 格留給第二套。**多出來的那 3 件是設計的一部分**，
   它們就是換遺物券的材料（見 engine.js 的 exchangeRelicTicket）。

   數值加成走 `bonus`，最終併進 effectiveGearBonuses() 那張總表，
   所以所有既有的消費端（ATK、HP%、爆傷…）一行都不用改。
   做不到「一個數值」的效果走 `proc`，由 engine.js 的普攻流程認旗標。
================================================== */

/* 八個遺物欄位。順序＝畫面上的排列順序 */
const RELIC_SLOTS = [
  'relic_head', 'relic_armor', 'relic_garment', 'relic_weapon',
  'relic_shield', 'relic_footgear', 'relic_acc1', 'relic_acc2',
];
const RELIC_SLOT_NAMES = {
  relic_head: '帽子', relic_armor: '衣服', relic_garment: '披風', relic_weapon: '武器',
  relic_shield: '盾牌', relic_footgear: '鞋子', relic_acc1: '飾品甲', relic_acc2: '飾品乙',
};
const RELIC_SLOT_ICONS = {
  relic_head: '🎩', relic_armor: '🥋', relic_garment: '🧣', relic_weapon: '🗡️',
  relic_shield: '🛡️', relic_footgear: '👢', relic_acc1: '💍', relic_acc2: '📿',
};

/* 三段門檻。改這裡會同時改掉所有套裝——資料裡的 need 要對得上 */
const RELIC_TIER_NEEDS = [2, 3, 5];

/* 掉落設定。**瘋狂模式不加成**（使用者指定）：打寶開著就是這個數字，
   一般怪與頭目各自獨立擲兩次——一次遺物、一次遺物券。 */
const RELIC_DROP_PCT_NORMAL = 0.1;
const RELIC_DROP_PCT_BOSS = 5;
const RELIC_TICKET_ID = 'relic_ticket';
const RELIC_TICKET_COST = 10;      // 背包裡的遺物 10 件 → 1 張券

/* ---- 特殊效果的參數（engine.js 的普攻流程讀這兩張表）----
   寫成資料而不是寫死在 engine，是因為這兩組數字之後一定會調。 */
const RELIC_PROC_MAGE = {
  blindChance: 20,        // 普攻有多少 % 觸發「全場黑暗」
  blindPerMonster: 50,    // 觸發後，每隻怪各自再擲這個 % 決定中不中
  splashChance: 30,       // 普攻有多少 % 改成打全體
};
const RELIC_PROC_ASSASSIN = {
  /* **互斥**（使用者指定）：擲一次骰，由高倍率往低倍率比對，中了就停。
     所以陣列要照倍率由大到小排，累計機率 1% / 6% / 16%。 */
  ladder: [
    { chance: 1, mult: 10 },
    { chance: 5, mult: 5 },
    { chance: 10, mult: 2 },
  ],
  aspdChance: 0.5,        // 另外獨立擲的一次
  aspdSec: 5,
  aspdValue: 193,         // 官方 100 級以上的攻速上限（見 engine.js 的 cap）
};

/* 騎士：被打時機率完全免傷。跟光之盾（defenderNegates）是同一類效果，
   所以走同一個插入點，普攻與怪物技能兩條路都擋得到。 */
const RELIC_PROC_KNIGHT = { immuneChance: 20 };
/* 武僧：普攻機率打出固定傷害。**固定＝不吃怪物防禦**，所以 CD 是唯一的節流閥。
   CD 3 秒時實測只有基準的 +29%（CD 結束後還要再等一次 20% 判定，平均 1.7 秒），
   改成 1 秒後循環 2.7 秒 → +50%，跟刺客／法師那兩套對齊。 */
const RELIC_PROC_MONK = {
  procChance: 20, fixedDamage: 3600, cooldownSec: 1,
  gatlingHits: 12,          // 飄字要跳幾顆「-1」（純特效，傷害還是一次結算）
  immuneChance: 5,
};
/* 牧師：倒下後自動站起來。放置遊戲裡死亡的代價是掛機中斷（被抬回安全區），
   所以這條的價值不在數字而在「整晚不用管」——次數用完要換圖才回滿，
   不然 CD 一到就等於無限次。 */
const RELIC_PROC_PRIEST = {
  charges: 3, cooldownSec: 180, reviveHpPct: 50, reviveDelaySec: 5,
  takeDamagePct: 10,        // 3 件：從隊友身上多接 10% 的攻擊
};
/* 鐵匠：定時護盾 + 普攻追打。
   護盾對低攻速怪吸收率很高、對高攻速怪幾乎無感（實測差 30 倍），
   這是刻意的——它的定位是「高難度怪的生存墊」，不是通用減傷。 */
const RELIC_PROC_BLACKSMITH = {
  shieldHp: 5000, shieldCooldownSec: 5,
  procChance: 20, targets: 2, atkPct: 100, matkPct: 100,
};

/* ---- 套裝本體 ----
   pieceNames：八個部位各自的名字，組出來是「法師的遺物・法杖」。
   tiers[].bonus：併進 effectiveGearBonuses()，鍵名必須是引擎認得的。
   tiers[].proc ：引擎認旗標，見 state.relicProcs。
   tiers[].text ：畫面上照這句顯示，不要在 UI 那邊重寫一次。 */
const RELIC_SETS = {
  mage: {
    id: 'mage', name: '法師的遺物', icon: '🔮',
    desc: '只會閃光術的法師遺物。',
    pieceNames: {
      relic_head: '尖帽', relic_armor: '法袍', relic_garment: '披風', relic_weapon: '法杖',
      relic_shield: '法盾', relic_footgear: '法靴', relic_acc1: '魔戒', relic_acc2: '護符',
    },
    tiers: [
      { need: 2, bonus: { hpPct: 10, spPct: 5 }, text: 'MHP +10%、MSP +5%' },
      /* ATK 與命中放在法師套上不是玩笑：普通攻擊**一律**用物理 ATK（不看職業，
         見 playerAttackInner 的註解），所以這三十點是在餵下面那條 5 件的普攻效果。 */
      { need: 3, bonus: { atk: 30, hit: 10 }, text: 'ATK +30、命中 +10' },
      { need: 5, bonus: {}, proc: 'mage',
        text: '普攻 20% 機率讓全場敵人各 50% 判定黑暗；30% 機率普攻改為打全體' },
    ],
  },
  assassin: {
    id: 'assassin', name: '刺客的遺物', icon: '🗡️',
    desc: '只要幹掉所有敵人，就是完美的潛行。',
    pieceNames: {
      relic_head: '頭巾', relic_armor: '忍衣', relic_garment: '暗披', relic_weapon: '匕首',
      relic_shield: '臂盾', relic_footgear: '軟靴', relic_acc1: '銀環', relic_acc2: '毒囊',
    },
    tiers: [
      /* 完全迴避而不是迴避：迴避走 dodgeChancePctFromMonster，會先被迴避上限
         （1 隻 95%…5 隻 75%）夾住，再被打寶模式給怪的 +40 命中吃掉一半，
         加十點等於沒加。完全迴避是獨立判定，兩者都影響不到。 */
      { need: 2, bonus: { perfectDodge: 5, critRate: 5 }, text: '完全迴避 +5、爆擊率 +5' },
      { need: 3, bonus: { critDmgPct: 10, vit: 5 }, text: '爆擊傷害 +10%、VIT +5' },
      { need: 5, bonus: {}, proc: 'assassin',
        text: '普攻 10%／5%／1% 機率造成 2／5／10 倍傷害（互斥）；0.5% 機率攻速恆定 193 持續 5 秒' },
    ],
  },
  knight: {
    id: 'knight', name: '騎士的遺物', icon: '🛡️',
    desc: '翻滾只是小丑，盾戳正是為王的理由！',
    pieceNames: {
      relic_head: '盔面', relic_armor: '重鎧', relic_garment: '戰袍', relic_weapon: '長槍',
      relic_shield: '塔盾', relic_footgear: '鐵靴', relic_acc1: '徽章', relic_acc2: '誓約環',
    },
    tiers: [
      { need: 2, bonus: { hpPct: 20 }, text: 'MHP +20%' },
      /* DEF 的減傷公式是遞減的（(4000+DEF)/(4000+10·DEF)），+50 只換到 6.9%；
         反倒是 MDEF——物理職通常只有個位數——加 50 是從 0% 直接到 10%。
         兩個一起給才有「坦」的感覺，只給 DEF 會弱得看不出來。 */
      { need: 3, bonus: { def: 50, mdef: 50 }, text: 'DEF +50、MDEF +50' },
      { need: 5, bonus: { atkPct: 10, matkPct: 10 }, proc: 'knight',
        text: '被攻擊時 20% 機率完全免疫傷害；ATK +10%、MATK +10%' },
    ],
  },
  monk: {
    id: 'monk', name: '武僧的遺物', icon: '👊',
    desc: '南無加特林菩薩，一息三千六百轉。',
    pieceNames: {
      relic_head: '念珠冠', relic_armor: '袈裟', relic_garment: '禪披', relic_weapon: '拳套',
      relic_shield: '護腕', relic_footgear: '草鞋', relic_acc1: '佛珠', relic_acc2: '木魚',
    },
    tiers: [
      /* INT 對純物理的武僧看似無用，但阿修羅霸凰拳吃 INT，算是有典故的 */
      { need: 2, bonus: { int: 10, dex: 10 }, text: 'INT +10、DEX +10' },
      { need: 3, bonus: { vit: 10, agi: 5 }, text: 'VIT +10、AGI +5' },
      { need: 5, bonus: {}, proc: 'monk',
        text: '普攻 20% 機率造成 3600 固定傷害（冷卻 1 秒）；被攻擊時 5% 機率完全免疫傷害' },
    ],
  },
  priest: {
    id: 'priest', name: '牧師的遺物', icon: '✝️',
    desc: '聖光阿！那個敵人看起來值得一戰。',
    pieceNames: {
      relic_head: '聖冠', relic_armor: '祭衣', relic_garment: '聖袍', relic_weapon: '權杖',
      relic_shield: '聖典', relic_footgear: '聖履', relic_acc1: '十字架', relic_acc2: '聖水瓶',
    },
    tiers: [
      { need: 2, bonus: { hpPct: 10, vit: 5 }, text: 'MHP +10%、VIT +5' },
      /* 「被打機率 +10%」是**主動去接隊友的傷害**（使用者確認的本意）：
         本作的承傷是寫死的「怪 60% 打玩家、40% 平分隊友」，沒有仇恨系統，
         所以只能實作成把玩家那一份拉到 70%。對玩家自己是純減益，
         換到的是隊友少挨打——搭配上面的 MHP 與 DEF 才成立。 */
      { need: 3, bonus: { def: 30, mdef: 30 }, proc: 'priest_taunt',
        text: '從隊友身上多接 10% 的攻擊；DEF +30、MDEF +30' },
      { need: 5, bonus: { atkPct: 10, matkPct: 10 }, proc: 'priest',
        text: '倒下後 5 秒自動復活（HP 50%，3 次，冷卻 3 分鐘，換圖回滿）；ATK +10%、MATK +10%' },
    ],
  },
  blacksmith: {
    id: 'blacksmith', name: '鐵匠的遺物', icon: '⚙️',
    desc: 'I Am Iron Man.',
    pieceNames: {
      relic_head: '護目鏡', relic_armor: '合金甲', relic_garment: '排氣披風', relic_weapon: '戰鎚',
      relic_shield: '臂盾', relic_footgear: '推進靴', relic_acc1: '扳手', relic_acc2: '反應爐',
    },
    tiers: [
      { need: 2, bonus: { hpPct: 20 }, text: 'MHP +20%' },
      { need: 3, bonus: { atkPct: 5, matkPct: 5 }, text: 'ATK +5%、MATK +5%' },
      /* ATK100%+MATK100% 是刻意的雙傷害（使用者確認）：遺物不限職業，
         所以這條讓玩家自己決定要走純物理、純魔法還是混合，三種都吃得到一半以上。 */
      { need: 5, bonus: {}, proc: 'blacksmith',
        text: '每 5 秒獲得 5000 點護盾；普攻 20% 機率對隨機 2 名敵人造成 ATK100%+MATK100% 傷害' },
    ],
  },
};

/* ---- 由套裝表長出道具 ----
   type:'relic' 是新的道具分類：不進武器／防具的裝備流程（resolveEquipSlotFor 不認），
   所以不會有人不小心把遺物穿到一般裝備欄上。 */
const RELIC_ITEMS = {};
Object.values(RELIC_SETS).forEach(set => {
  RELIC_SLOTS.forEach(slot => {
    const id = 'relic_' + set.id + '_' + slot.slice('relic_'.length);
    RELIC_ITEMS[id] = {
      id, name: set.name + '・' + set.pieceNames[slot],
      type: 'relic', icon: set.icon,
      relicSet: set.id, relicSlot: slot,
      weight: 0, sell: 0, buyPrice: 0,
      desc: set.desc + '（' + RELIC_SLOT_NAMES[slot] + '）',
    };
  });
});
RELIC_ITEMS[RELIC_TICKET_ID] = {
  id: RELIC_TICKET_ID, name: '遺物券', type: 'item', icon: '🎫',
  weight: 0, sell: 0, buyPrice: 0,
  desc: '背包裡的遺物 ' + RELIC_TICKET_COST + ' 件可換 1 張。'
    + '拿到安全區的遺物商人那裡，可以換指定套裝的隨機一件。',
};

/* 併進 ITEMS：背包、圖鑑、掉落全部靠這張表認人 */
if (typeof ITEMS !== 'undefined') Object.assign(ITEMS, RELIC_ITEMS);

/* 這一套的全部遺物 id（掉落抽選用；不含券） */
const RELIC_PIECE_IDS = Object.keys(RELIC_ITEMS).filter(id => RELIC_ITEMS[id].type === 'relic');
function relicPieceIdsOfSet(setId) {
  return RELIC_PIECE_IDS.filter(id => RELIC_ITEMS[id].relicSet === setId);
}
