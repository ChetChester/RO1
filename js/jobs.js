/* ---------------- 職業樹 ----------------
   從 js/data.js 搬出來（原本佔 412 行，夾在 23,000 筆 ITEMS 中間很難改）。

   **技能的定義本體在 js/skills.js**，這邊的 skills 只列 id，檔案尾端會換回物件陣列。
   所以 js/skills.js 必須先載入（index.html 已經排好）。
   要改某個技能的數值請去 js/skills.js；要改某個職業「學得到什麼」才改這裡。

   注意：tools/ 底下有幾支舊工具（find_error / fix_consumable_food / rebuild_full /
   revert_job_level_cap）是直接在 data.js 的文字裡找 'const JOB_TREE' 或 eval data.js
   來取用它的，那幾支都是當初的一次性腳本、跑完就沒再用；若日後要寫類似的工具，
   記得連 js/jobs.js 一起讀進去。
------------------------------------------------- */

const JOB_TREE = {
  novice: {
    id: 'novice', name: '新手', tier: 0, icon: '🌱',
    baseLevelReq: 1, jobLevelReq: 1, jobLevelMax: 10,
    hpMod: 1.0, spMod: 1.0, atkMod: 1.0, matkMod: 1.0,
    baseAspd: {"dagger":138,"sword":137,"tsword":null,"bow":null,"rod":129,"mace":144,"katar":null,"spear":null,"knuckle":null}, shieldPenalty: -6,
    next: ['swordsman', 'mage', 'archer', 'merchant', 'thief', 'acolyte', 'supernovice'],
    bonusLevels: { str:[8], agi:[5], vit:[6], int:[9], dex:[3], luk:[2] },
    skills: [
      'novice_firstaid', 'novice_basicskill', 'novice_hpboost', 'novice_flee',
    ],
    desc: '每個冒險者的起點，尚未踏上任何職業道路。'
  },

  /* ---- 超級新手 ----
     官方的特殊路線：不轉一轉，直接留在新手系但能使用「全部六個一轉職業」的技能。
     這裡靠 borrowSkillsFrom 一次借齊，不複製任何技能定義——這也是把技能表獨立出來的主因。

     幾個數值是本作自訂的（官方沒有可直接對應的欄位），全部以「同等級劍士」為基準校準：
       hpMod 0.37  HP 約劍士的 70%——技能雜是它的長處，體質就是它的代價。
                   （JOB_BASE_HP 沒有 supernovice，會自動 fallback 到 novice 的成長表，
                     而本作的 novice 表在高等反而比劍士高，所以係數要壓得比直覺低）
       spMod 12.0  SP 約見習修女的 55%。六系技能都要放，SP 不能太寒酸；
                   novice 的 SP 基礎表數字很小，係數看起來大是這個緣故
       atk/matk    兩邊都給 1.0，物理魔法都能打但都不專精，正是這個職業的性格
     轉職條件依官方：新手職業等級滿 10、基本等級 45。轉了就不能再轉（next 為空）。 */
  supernovice: {
    id: 'supernovice', name: '超級新手', tier: 1, icon: '⭐', parent: 'novice',
    baseLevelReq: 45, jobLevelReq: 10, jobLevelMax: 99,
    hpMod: 0.37, spMod: 12.0, atkMod: 1.0, matkMod: 1.0,
    baseAspd: {"dagger":138,"sword":137,"tsword":null,"bow":null,"rod":129,"mace":144,"katar":null,"spear":null,"knuckle":null}, shieldPenalty: -6,
    next: [],
    // 職業等級上限 99，加成點數比照一轉的密度往後鋪；六項平均分配，呼應「什麼都會一點」
    bonusLevels: {
      str: [4, 16, 28, 40, 52, 64, 76, 88],
      agi: [7, 19, 31, 43, 55, 67, 79, 91],
      vit: [10, 22, 34, 46, 58, 70, 82, 94],
      int: [1, 13, 25, 37, 49, 61, 73, 85, 97],
      dex: [3, 15, 27, 39, 51, 63, 75, 87, 99],
      luk: [6, 18, 30, 42, 54, 66, 78, 90]
    },
    skills: [],   // 自己沒有專屬技能，全部靠下面借
    borrowSkillsFrom: ['swordsman', 'mage', 'archer', 'merchant', 'thief', 'acolyte'],
    desc: '不選擇任何一條路，於是每一條路都走得到。體質孱弱，卻能使出六個職業的看家本領。'
  },

  // ---- 一轉 ----
  swordsman: {
    id: 'swordsman', name: '劍士', tier: 1, icon: '⚔️', parent: 'novice',
    baseLevelReq: 10, jobLevelReq: 10, jobLevelMax: 50,
    hpMod: 0.7, spMod: 2.0, atkMod: 1.25, matkMod: 0.7,
    next: ['knight'],
    nextLocked: ['crusader'],
    bonusLevels: { str:[2,14,33,40,47,49,50], agi:[30,46], vit:[6,18,38,42], int:[], dex:[10,22,36], luk:[26,44] },
    skills: [
      'berserk_sword', 'fatalblow', 'hpmove', 'bash',
      'magnumbreak', 'provoke', 'endure', 'increasehp',
      'swordmastery', 'twoswordmastery',
    ],
    desc: '以劍與盾為伴的近戰戰士，堅韌不拔。'
  },
  mage: {
    id: 'mage', name: '法師', tier: 1, icon: '🔮', parent: 'novice',
    baseLevelReq: 10, jobLevelReq: 10, jobLevelMax: 50,
    hpMod: 0.3, spMod: 6.0, atkMod: 0.55, matkMod: 1.35,
    next: ['wizard'],
    nextLocked: ['sage'],
    bonusLevels: { str:[], agi:[18,26,40,47], vit:[], int:[2,14,22,33,38,44,46,50], dex:[6,10,36], luk:[30,42,49] },
    skills: [
      'sight', 'energycoat', 'firebolt', 'fireball',
      'firewall', 'lightningbolt', 'thunderstorm', 'coldbolt',
      'frostdiver', 'stonecurse', 'napalmbeat', 'soulstrike',
      'safetywall', 'spregen',
    ],
    desc: '操控元素之力的智慧使者，SP 是最強武器。'
  },
  archer: {
    id: 'archer', name: '弓箭手', tier: 1, icon: '🏹', parent: 'novice',
    baseLevelReq: 10, jobLevelReq: 10, jobLevelMax: 50,
    hpMod: 0.5, spMod: 2.0, atkMod: 1.3, matkMod: 0.6,
    next: ['hunter'],
    // 詩人／舞孃官方依性別二選一（男→詩人、女→舞孃），兩個都先登記，
    // 之後開放轉職時再依 state.gender 過濾（詳見 JOBS_TIER2_PENDING 的 genderLock）
    nextLocked: ['bard', 'dancer'],
    bonusLevels: { str:[6,38,40], agi:[26,33,49], vit:[46], int:[10,47], dex:[2,14,18,30,36,42,50], luk:[22,44] },
    skills: [
      'createarrow', 'chargearrow', 'owleye', 'vultureeye',
      'improveconc', 'doublestrafe', 'arrowshower',
    ],
    desc: '遠距離精準打擊的專家，先發制人。'
  },
  merchant: {
    id: 'merchant', name: '商人', tier: 1, icon: '💰', parent: 'novice',
    baseLevelReq: 10, jobLevelReq: 10, jobLevelMax: 50,
    hpMod: 0.4, spMod: 3.0, atkMod: 1.05, matkMod: 0.6,
    next: ['blacksmith'],
    nextLocked: ['alchemist'],
    bonusLevels: { str:[10,22,40,44,49], agi:[33], vit:[2,18,30,47], int:[26], dex:[6,14,38,42,50], luk:[36,46] },
    skills: [
      'vending', 'itemappraisal', 'loudexclamation', 'cartattack',
      'discount', 'overcharge', 'pushcart', 'mammonite',
      'weightup',
    ],
    desc: '精打細算的鍛造與交易好手。'
  },
  thief: {
    id: 'thief', name: '盜賊', tier: 1, icon: '🗡️', parent: 'novice',
    baseLevelReq: 10, jobLevelReq: 10, jobLevelMax: 50,
    hpMod: 0.5, spMod: 2.0, atkMod: 1.2, matkMod: 0.55,
    next: ['assassin'],
    nextLocked: ['rogue'],
    bonusLevels: { str:[6,30,38,47], agi:[2,33,36,50], vit:[14,44], int:[18], dex:[10,22,42,49], luk:[26,40,46] },
    skills: [
      'detoxify', 'sandman', 'backsliding', 'steal',
      'doubleattack', 'improvedodge', 'hiding', 'envenom',
    ],
    desc: '身法敏捷、擅長暗殺的邊緣行走者。'
  },
  acolyte: {
    id: 'acolyte', name: '見習修女', tier: 1, icon: '🙏', parent: 'novice',
    baseLevelReq: 10, jobLevelReq: 10, jobLevelMax: 50,
    hpMod: 0.4, spMod: 5.0, atkMod: 0.7, matkMod: 1.1,
    next: ['priest'],
    nextLocked: ['monk'],
    bonusLevels: { str:[26,42,49], agi:[22,40], vit:[6,30,44], int:[10,33,46], dex:[14,36,47], luk:[2,18,38,50] },
    skills: [
      'teleport', 'warpportal', 'ruwach', 'pneuma',
      'divineprotection', 'heal', 'blessing', 'decreaseagi',
      'angelic', 'aquabenedicta', 'signumcrusis', 'cure',
      'holylight',
    ],
    desc: '侍奉光明神的治療者，慈悲亦堅定。'
  },

  // ---- 二轉（已實作代表分支）----
  knight: {
    id: 'knight', name: '騎士', tier: 2, icon: '🐎', parent: 'swordsman',
    baseLevelReq: 40, jobLevelReq: 40, jobLevelMax: 50,
    hpMod: 1.5, spMod: 3.0, atkMod: 1.7, matkMod: 0.7,
    next: [], nextLocked: ['lordknight'],
    bonusLevels: { str:[4,10,15,21,27,33,46,47], agi:[13,38], vit:[1,3,8,12,17,18,23,29,36,43], int:[], dex:[11,19,31,40,48,49], luk:[5,20,28,37] },
    skills: [
      'riding', 'charge', 'cavaliermastery', 'bowlingbash',
      'pierce', 'twohandquicken', 'spearmastery', 'spearstab',
      'spearboomerang', 'brandishspear', 'counter',
    ],
    desc: '身騎戰馬、統率戰場的貴族戰士。'
  },
  wizard: {
    id: 'wizard', name: '巫師', tier: 2, icon: '🧙', parent: 'mage',
    baseLevelReq: 40, jobLevelReq: 40, jobLevelMax: 50,
    hpMod: 0.55, spMod: 9.0, atkMod: 0.5, matkMod: 1.9,
    baseAspd: 150,
    next: [], nextLocked: ['highwizard'],
    bonusLevels: { str:[12], agi:[6,10,24,34,41,43,46,47], vit:[38], int:[1,4,9,18,22,29,31,33,40,45,48,50], dex:[2,5,13,26,32,39], luk:[15,36] },
    skills: [
      'sense', 'firebolt_wiz', 'firepillar', 'meteorstorm',
      'jupitel', 'lordofvermillion', 'waterball', 'icewall',
      'frostdiver_wiz', 'stormgust', 'earthspike', 'heavensdrive',
      'quagmire',
    ],
    desc: '掌握高階咒文的元素支配者。'
  },
  hunter: {
    id: 'hunter', name: '獵人', tier: 2, icon: '🎯', parent: 'archer',
    baseLevelReq: 40, jobLevelReq: 40, jobLevelMax: 50,
    hpMod: 0.85, spMod: 4.0, atkMod: 1.75, matkMod: 0.6,
    baseAspd: 150,
    next: [], nextLocked: ['sniper'],
    bonusLevels: { str:[6,10,11,44], agi:[12,19,20,31,39,47], vit:[17,23], int:[3,34,41,46], dex:[1,4,8,14,21,27,33,38,43,49], luk:[5,15,29,42] },
    skills: [
      'falcondelivery', 'huntingmastery', 'blitzbeat', 'falconnastery',
      'trap', 'skidtrap', 'flasher', 'sleeptrap',
      'freezingtrap', 'blastmine', 'claymoretrap', 'magnumbreak_h',
      'removetrap', 'researchtrap', 'animalslayer',
    ],
    desc: '與獵鷹並肩作戰的森林狙擊手。'
  },
  blacksmith: {
    id: 'blacksmith', name: '鐵匠', tier: 2, icon: '🔨', parent: 'merchant',
    baseLevelReq: 40, jobLevelReq: 40, jobLevelMax: 50,
    hpMod: 0.9, spMod: 4.0, atkMod: 1.8, matkMod: 0.6,
    baseAspd: 145,
    next: [], nextLocked: ['whitesmith'],
    bonusLevels: { str:[3,8,16,23,31,44], agi:[29,38], vit:[7,13,20,32,37,49], int:[21,34], dex:[1,4,5,9,12,19,26,28,36,39,40,47], luk:[11,46] },
    skills: [
      'weaponrepair', 'ironworking', 'steelworking', 'elementalstone',
      'oridecon', 'hiltbinding', 'findingore', 'daggercraft',
      'swordcraft', 'axecraft', 'knucklecraft', 'macecraft',
      'spearcraft', 'weaponresearch', 'hammerfall', 'adrenaline',
      'skintemper', 'cartrevo', 'overthrust', 'overthrustbuff',
      'maximize', 'weaponfusion', 'greed',
    ],
    desc: '鎚起鎚起鎚落，鍛出無堅不摧的武器與力量。'
  },
  assassin: {
    id: 'assassin', name: '刺客', tier: 2, icon: '🥷', parent: 'thief',
    baseLevelReq: 40, jobLevelReq: 40, jobLevelMax: 50,
    hpMod: 1.1, spMod: 4.0, atkMod: 1.85, matkMod: 0.5,
    baseAspd: 140,
    next: [], nextLocked: ['assassincross'],
    bonusLevels: { str:[11,25,27,32,45,48], agi:[1,2,3,15,16,17,18,19,20,21], vit:[6,8], int:[4,14,38,42], dex:[9,24,30,31,40,41,46,50], luk:[] },
    skills: [
      'rightmaster', 'leftmaster', 'katarmastery', 'cloaking',
      'sonicblow', 'grimtooth', 'enchantweapon', 'poisonreact',
      'venomdust', 'venominfusion', 'sonicblow_max', 'enchantblade',
    ],
    desc: '潛行於暗處、一擊致命的殺手。'
  },
  priest: {
    id: 'priest', name: '祭司', tier: 2, icon: '✨', parent: 'acolyte',
    baseLevelReq: 40, jobLevelReq: 40, jobLevelMax: 50,
    hpMod: 0.75, spMod: 8.0, atkMod: 0.6, matkMod: 1.3,
    baseAspd: 150,
    next: [], nextLocked: ['highpriest'],
    bonusLevels: { str:[4,11,17,27,35], agi:[6,29,37,48], vit:[7,14,34,36,45], int:[8,9,22,42,43], dex:[16,20,25,32], luk:[1,3,10,21,31,39,50] },
    skills: [
      'maceMastery', 'zenrecovery', 'sanctuary', 'magnificat',
      'gloria', 'kyrie', 'assumptio', 'sanctuary_holy',
      'resurrection', 'impositio', 'turnundead', 'angelus',
      'asperio', 'suffragium', 'darkbarrier',
    ],
    desc: '光輝籠罩之地，皆為信徒的庇護所。'
  },

  /* ---------------- 進階二轉（tier 3，轉生後才走得到）----------------
     只有**轉生過**的角色接得到（`canJobChange()` 走 `state.rebirthPath` → `nextLocked`）。
     轉生的定位是「把本職練得更強」，所以這六個是原二轉的加強版，不是新路線。

     這一批是**框架**：職業本體、成長曲線、轉職條件都到位，`skills` 先留空，
     36 個官方技能分批補（清單見 docs/BUGS.md #56）。留空不會壞——技能表本來就是
     id 陣列，空陣列在 jobs.js 尾端的還原、技能分頁、被動掃描全部都走得通。

     四個共通設定，理由寫在這裡不逐條重複：

     `jobLevelMax: 70`  官方轉生二轉就是 70（一般二轉 50）。多出來的 20 級＝20 點技能點，
                        剛好夠點那批新技能，不必另外發點。

     `baseLevelReq: 70` **本作自訂**。官方的轉職條件是另一套階層（轉生一轉 job 40），
                        本作沒有轉生一轉那一層，所以改用基礎等級當門檻。
                        一轉 10 / 二轉 40 / 進階二轉 70，間距一致。

     `hpSpFrom` / `aspdFrom`  一律指回本職。官方轉生職**用的就是同一張 HP/SP 表與攻速表**，
                        差別在轉生職身上那個固定加成——本作把那份加成折進 hpMod / spMod，
                        所以不複製 100 格陣列，也不新增攻速表。

     `hpMod` / `spMod`  本職 ×1.25。官方轉生職的體質加成就是這個量級，
                        六個職業一致，之後要調平衡只要動這個係數。

     `bonusLevels` 沿用本職的表（職業加成是累計繼承的，見 computeJobBonuses），
     51~70 那段再補一輪，讓多出來的 20 級不是白練。 */

  lordknight: {
    id: 'lordknight', name: '領主騎士', tier: 3, icon: '⚔️', parent: 'knight',
    baseLevelReq: 70, jobLevelReq: 50, jobLevelMax: 70,
    hpMod: 1.875, spMod: 3.75, atkMod: 1.8, matkMod: 0.7,
    hpSpFrom: 'knight', aspdFrom: 'knight',
    next: [], nextLocked: ['runeknight'],
    bonusLevels: { str:[4,10,15,21,27,33,46,47,52,58,64,70], agi:[13,38,55], vit:[1,3,8,12,17,18,23,29,36,43,60,66], int:[], dex:[11,19,31,40,48,49,62,68], luk:[5,20,28,37,57] },
    // 官方 8 個技能全數到齊（2026-08-08）
    skills: [
      'lk_berserk', 'lk_tensionrelax', 'lk_parrying', 'lk_aurablade',
      'lk_concentration', 'lk_headcrush', 'lk_jointbeat', 'lk_spiralpierce',
    ],
    desc: '騎士之上的騎士。戰場上的旗幟只為他而立。'
  },
  highwizard: {
    id: 'highwizard', name: '高等巫師', tier: 3, icon: '🔮', parent: 'wizard',
    baseLevelReq: 70, jobLevelReq: 50, jobLevelMax: 70,
    hpMod: 0.6875, spMod: 11.25, atkMod: 0.5, matkMod: 2.0,
    hpSpFrom: 'wizard', aspdFrom: 'wizard', baseAspd: 150,
    next: [], nextLocked: ['warlock'],
    bonusLevels: { str:[12,56], agi:[6,10,24,34,41,43,46,47,60], vit:[38,64], int:[1,4,9,18,22,29,31,33,40,45,48,50,52,58,66,70], dex:[2,5,13,26,32,39,54,62], luk:[15,36,68] },
    skills: [],
    desc: '把咒文推到極限的人，最後連自己都成了咒文的一部分。'
  },
  sniper: {
    id: 'sniper', name: '狙擊之王', tier: 3, icon: '🏹', parent: 'hunter',
    baseLevelReq: 70, jobLevelReq: 50, jobLevelMax: 70,
    hpMod: 1.0625, spMod: 5.0, atkMod: 1.6, matkMod: 0.8,
    hpSpFrom: 'hunter', aspdFrom: 'hunter',
    next: [], nextLocked: ['ranger'],
    bonusLevels: { str:[11,25,34,47,58], agi:[3,7,15,19,27,31,39,43,52,62], vit:[9,21,37,50,66], int:[5,17,29,41,56], dex:[1,2,6,13,23,33,45,49,54,60,68,70], luk:[10,26,42,64] },
    skills: [],
    desc: '一箭，一命。距離只是他與獵物之間的一個數字。'
  },
  whitesmith: {
    id: 'whitesmith', name: '神匠', tier: 3, icon: '🔨', parent: 'blacksmith',
    baseLevelReq: 70, jobLevelReq: 50, jobLevelMax: 70,
    hpMod: 1.125, spMod: 5.0, atkMod: 1.75, matkMod: 0.7,
    hpSpFrom: 'blacksmith', aspdFrom: 'blacksmith',
    next: [], nextLocked: ['mechanic'],
    bonusLevels: { str:[1,7,13,22,30,38,44,50,54,62,70], agi:[10,26,40,58], vit:[4,16,28,36,46,52,66], int:[6,19,33,48,60], dex:[3,9,15,24,32,42,56,64], luk:[12,20,35,68] },
    skills: [],
    desc: '鐵砧上敲出來的不只是武器，還有一整個時代的重量。'
  },
  assassincross: {
    id: 'assassincross', name: '十字刺客', tier: 3, icon: '🗡️', parent: 'assassin',
    baseLevelReq: 70, jobLevelReq: 50, jobLevelMax: 70,
    hpMod: 1.375, spMod: 5.0, atkMod: 1.75, matkMod: 0.7,
    hpSpFrom: 'assassin', aspdFrom: 'assassin',
    next: [], nextLocked: ['guillotinecross'],
    bonusLevels: { str:[2,9,17,26,35,44,52,60,68], agi:[1,5,11,19,28,37,46,50,56,64,70], vit:[14,31,41,58], int:[23,48], dex:[7,21,33,43,54,66], luk:[3,15,29,39,62] },
    skills: [],
    desc: '影子裡的影子。你察覺的那一刻，已經是他允許的。'
  },
  highpriest: {
    id: 'highpriest', name: '高階祭司', tier: 3, icon: '🕊️', parent: 'priest',
    baseLevelReq: 70, jobLevelReq: 50, jobLevelMax: 70,
    hpMod: 0.9375, spMod: 10.0, atkMod: 0.6, matkMod: 1.4,
    hpSpFrom: 'priest', aspdFrom: 'priest', baseAspd: 150,
    next: [], nextLocked: ['archbishop'],
    bonusLevels: { str:[4,11,17,27,35,56], agi:[6,29,37,48,62], vit:[7,14,34,36,45,58,68], int:[8,9,22,42,43,52,60,70], dex:[16,20,25,32,54,64], luk:[1,3,10,21,31,39,50,66] },
    skills: [],
    desc: '祈禱到了盡頭，連神都會側耳。'
  }
};

/* ---------------- 技能 id → 定義本體 ----------------
   技能定義住在 js/skills.js，職業這邊只列 id。載入時換回物件陣列，
   所以 engine.js / ui.js 讀到的 job.skills 跟以前完全一樣。

   陣列元素可以是：
     'bash'                     直接引用
     { id: 'bash', maxLv: 5 }   引用並覆寫欄位（轉生職上限不同時用得到）

   技能物件是共用參照——超級新手借用一轉技能時指到的是同一份。
   全專案沒有任何地方會寫入技能物件（只讀 mult/spCost/desc 這些），所以共用是安全的；
   若日後要改成可寫，這裡要改成複製一份。
------------------------------------------------- */
for (const job of Object.values(JOB_TREE)) {
  job.skills = (job.skills || []).map(ref => {
    if (typeof ref === 'string') return SKILLS[ref];
    return SKILLS[ref.id] ? Object.assign({}, SKILLS[ref.id], ref) : null;
  }).filter(Boolean);
}

/* borrowSkillsFrom：把別的職業「學得到什麼」整份借過來。
   超級新手就是靠這個一次拿到六個一轉職業的技能，不必複製 61 筆定義。
   要在上面的解析跑完之後才做，因為借的是解析後的技能物件。 */
for (const job of Object.values(JOB_TREE)) {
  if (!job.borrowSkillsFrom) continue;
  const seen = new Set(job.skills.map(s => s.id));
  job.borrowSkillsFrom.forEach(srcId => {
    const src = JOB_TREE[srcId];
    if (!src) return;
    src.skills.forEach(sk => {
      if (seen.has(sk.id)) return;
      seen.add(sk.id);
      job.skills.push(sk);
    });
  });
}

/* ---------------- 尚未實作的職業路線 ----------------
   原本只有一個 JOB_TIER3_PLACEHOLDER，名字寫 tier-3、內容卻是
   「6 個沒做的普通二轉」＋「6 個轉生二轉」混在一起，而且漏了詩人（bard），
   拿來鋪三轉的路會踩到。這裡按實際的職業階層拆成三份。

   三份都只是待辦清單，engine/ui 目前都不讀；等哪個職業真的要做，
   就照這裡的 id/parent 在上面的 JOB_TREE 補一筆完整條目。
   parent 一律指向轉職前的職業，跟 JOB_TREE 裡的 parent 欄位同一套語意。

   中文名採台服慣用譯名，日後要動到 UI 前請再確認一次。
------------------------------------------------- */

// 一、還沒做的普通二轉（tier 2）。每個一轉都有兩條分支，目前只做了其中一條
const JOBS_TIER2_PENDING = [
  { id: 'crusader',  name: '十字軍',   parent: 'swordsman' },
  { id: 'sage',      name: '賢者',     parent: 'mage' },
  // 詩人／舞孃在官方是依性別二選一，原本的清單只有 dancer，這裡補上 bard
  { id: 'bard',      name: '詩人',     parent: 'archer', genderLock: 'male' },
  { id: 'dancer',    name: '舞孃',     parent: 'archer', genderLock: 'female' },
  { id: 'alchemist', name: '鍊金術士', parent: 'merchant' },
  { id: 'rogue',     name: '流氓',     parent: 'thief' },
  { id: 'monk',      name: '武僧',     parent: 'acolyte' },
];

/* 二、還沒做的進階二轉。
   **六個主線的進階二轉（領主騎士／高等巫師／狙擊之王／神匠／十字刺客／高階祭司）
   已經在上面的 JOB_TREE 裡了**（2026-08-08 的框架），剩下這七個都掛在
   JOBS_TIER2_PENDING 那七個還沒做的普通二轉底下，所以要先有父職業才做得起來。 */
const JOBS_TRANS_PENDING = [
  { id: 'paladin',       name: '聖殿十字軍',   parent: 'crusader' },
  { id: 'professor',     name: '教授',         parent: 'sage' },
  { id: 'clown',         name: '演奏者',       parent: 'bard' },
  { id: 'gypsy',         name: '吉普賽',       parent: 'dancer' },
  { id: 'creator',       name: '生命鍊成師',   parent: 'alchemist' },
  { id: 'stalker',       name: '神行太保',     parent: 'rogue' },
  { id: 'champion',      name: '拳聖',         parent: 'monk' },
];

// 三、三轉（tier 3）。官方一律從轉生二轉接上去，所以 parent 全在上面那份清單裡
const JOBS_TIER3_PENDING = [
  { id: 'runeknight',      name: '盧恩騎士',     parent: 'lordknight' },
  { id: 'royalguard',      name: '皇家禁衛',     parent: 'paladin' },
  { id: 'warlock',         name: '魔導士',       parent: 'highwizard' },
  { id: 'sorcerer',        name: '元素使',       parent: 'professor' },
  { id: 'ranger',          name: '遊俠',         parent: 'sniper' },
  { id: 'minstrel',        name: '樂團',         parent: 'clown' },
  { id: 'wanderer',        name: '漂流者',       parent: 'gypsy' },
  { id: 'mechanic',        name: '機工士',       parent: 'whitesmith' },
  { id: 'geneticist',      name: '基因學者',     parent: 'creator' },
  { id: 'guillotinecross', name: '十字斬首者',   parent: 'assassincross' },
  { id: 'shadowchaser',    name: '影武者',       parent: 'stalker' },
  { id: 'archbishop',      name: '大主教',       parent: 'highpriest' },
  { id: 'sura',            name: '修羅',         parent: 'champion' },
];