/* 在 Node 裡把整個遊戲跑起來的測試治具。

   **為什麼要有這個東西**：以前每次驗證都得開瀏覽器、在 console 裡重打一次
   「建角 → 轉職 → 轉生 → 再轉職 → 學技能 → 穿裝備」的三十行 setup，
   然後把整包結果吐回來。同一段 setup 一輪要重打四五次，而且回傳的
   JSON 動輒上千行（556 卡片 × 4,544 裝備 × 2,538 怪的全量掃描）。
   改成 Node + 這支治具之後，跑一次只印幾行結論。

   **仍然是真的跑**，不是靜態分析：載入的是 js/ 底下同一份程式碼，
   走的是 recomputeDerived() / castSkill() / playerAttack() 本尊。
   這個專案抓到的幾個 bug（buff_flee #24、buff_def #58「推了卻沒人讀」）
   都只有真的跑起來才看得到，所以驗證不能退回讀程式碼。

   **不含 js/ui.js**：那一份幾乎每一行都在碰 DOM。engine.js 呼叫 UI 的地方
   大多寫成 `typeof f === 'function' && f()`，少數沒有防呆的在下面補成 no-op。
   所以這支治具驗得了「數值與機制」，驗不了「畫面長怎樣」——
   要驗畫面還是得開瀏覽器，那是兩件事。

   用法：
     const H = require('./harness');
     const g = H.boot();                       // 拿到整個遊戲的 context
     H.mkChar(g, { path: ['swordsman','knight'], rebirth: true, job: 'lordknight' });
     H.learn(g, 'lk_spiralpierce', 5);
     H.wield(g, 'spear1');
     const t = H.tester();
     t.eq('螺旋擊刺倍率', g.SKILLS.lk_spiralpierce.mult[4], 17.5);
     process.exit(t.report('領主騎士'));
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/* 載入清單**直接從 index.html 讀**，不在這裡另抄一份。
   抄一份的話，之後有人加了新的 js 檔，這支治具會安靜地少載一個檔案，
   然後在某個看起來毫不相干的地方炸掉——第一次寫就是這樣漏掉
   hp_sp_tables.js / img_alias.js / aspd_data.js 三個。
   ui.js 刻意排除（見檔頭）。 */
const EXCLUDE = ['js/ui.js'];
const GAME_FILES = (function () {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const out = [];
  const re = /<script\s+src="([^"]+)"><\/script>/g;
  let m;
  while ((m = re.exec(html))) { if (!EXCLUDE.includes(m[1])) out.push(m[1]); }
  if (!out.length) throw new Error('index.html 裡找不到任何 <script src>');
  return out;
})();
// engine.js 會直接呼叫、而且**沒有** typeof 防呆的 UI 函式，一律補成 no-op
const UI_STUBS = [
  'renderAll', 'onTickUI', 'renderMapBackground', 'playMapMusic', 'renderMapTab',
  'renderJobTree', 'renderSkillsTab', 'renderCharacterTab',
  'showDamageFloat', 'showDamageFloatAt', 'showPlayerFloat', 'showElementFloat',
  'playHitSound', 'playAttackSound', 'playAttackAnim', 'playSkillSound',
  'showSkillCastEffect', 'triggerMonsterHit', 'playStatusSound',
];

function fakeEl() {
  const e = {
    style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild() {}, removeChild() {}, remove() {}, setAttribute() {}, getAttribute: () => null,
    addEventListener() {}, innerHTML: '', textContent: '', value: '', checked: false,
    querySelector: () => null, querySelectorAll: () => [], closest: () => null, children: [],
  };
  return e;
}

/* 啟動一份乾淨的遊戲。每次呼叫都是全新的 context，測試之間不會互相汙染。
   opts.captureLog：true 的話把 logMsg 收進 g.__log（要驗訊息內容時用）。 */
function boot(opts) {
  opts = opts || {};
  let src = '';
  GAME_FILES.forEach(f => { src += fs.readFileSync(path.join(ROOT, f), 'utf8') + '\n;\n'; });

  const ctx = {
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    isNaN, isFinite, parseInt, parseFloat, Set, Map, Float64Array, Promise,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;

  ctx.localStorage = {
    _d: {},
    getItem(k) { return k in this._d ? this._d[k] : null; },
    setItem(k, v) { this._d[k] = String(v); },
    removeItem(k) { delete this._d[k]; },
    clear() { this._d = {}; },
    key(i) { return Object.keys(this._d)[i] || null; },
    get length() { return Object.keys(this._d).length; },
  };
  ctx.document = {
    getElementById: fakeEl, querySelector: () => null, querySelectorAll: () => [],
    createElement: fakeEl, body: fakeEl(), documentElement: fakeEl(), addEventListener() {},
  };
  ctx.Audio = function () { return { play() { return { catch() {} }; }, pause() {}, volume: 1 }; };

  /* `let` / `const` 的頂層宣告**不會變成 context 的屬性**（只有 function 宣告會）。
     `state` 是 `let state = null`，所以外面看不到也改不到——engine.js 內部
     `state = {...}` 動的是它自己的繫結。這裡開一對存取器把它接出來，
     再在 ctx 上掛同名的 getter/setter，測試碼就能照常寫 `g.state`。
     `CARDS`/`ITEMS` 那些 `const` 同理，一併補上。 */
  const EXPOSE_CONST = ['SKILLS', 'JOB_TREE', 'CARDS', 'ITEMS', 'MONSTERS', 'MAPS',
    'MONSTER_SKILLS', 'EQUIP_SETS', 'MVP_MAP_DATA', 'MONSTER_CARD_DROPS', 'ELEMENT_CHART',
    'ELEMENT_NAMES', 'ELEMENT_ICONS', 'EQUIP_SLOTS_ALL', 'JOB_BASE_HP', 'JOB_BASE_SP',
    'ASPD_WEAPON_BASE', 'MONSTER_FAMILIES', 'REBIRTH_REQ', 'REBIRTH_MAX', 'TRANSCENDENT_HPSP_MULT',
    'ALLY_ARROW_FALLBACK', 'AUTO_BUY_ALLY_ARROW_QTY', 'AUTO_BUY_ALLY_ARROW_THRESHOLD', 'NPC_SHOPS',
    'REGIONS', 'KINGDOMS', 'MATERIAL_CRAFT_RECIPES', 'MATERIAL_CRAFT_SUCCESS_CHANCE',
    'MATERIAL_CRAFT_ZENY_COST', 'BASE_STAT_KEYS', 'SIZE_MODIFIER', 'WEAPON_REQ_CATEGORIES', 'EQUIP_REQ_NAMES',
    'JOBS_TIER2_PENDING', 'JOBS_TRANS_PENDING', 'JOBS_TIER3_PENDING',
    'GOSPEL_BLESSINGS', 'GOSPEL_CURSES', 'DOUBLECAST_SKILLS', 'TAROT_CARDS',
    'ailDmgTakenMult', 'PLAGIARISM_ATTACK_TYPES', 'combatLogLanes', 'ALLY_MAX',
    'ALLY_REVIVE_ITEM', 'ALLY_POTION_FALLBACK', 'ALLY_MERC_EXP_PCT',
    'SKILL_ATTACK_TYPES', 'SKILL_NEEDS_MONSTER_TYPES', 'MELEE_MAX_MONSTERS',
    'MELEE_SPAWN_BATCH_MAX', 'MVP_SPAWN_CHANCE_PCT', 'FARM_MODE_MULT', 'FARM_MODE_NAMES',
    'FARM_MODE_OFF', 'FARM_MODE_NORMAL', 'FARM_MODE_MAD', 'BASE_LEVEL_CAP', 'BASE_LEVEL_CAP_ADVANCED',
    'RELIC_SLOTS', 'RELIC_SLOT_NAMES', 'RELIC_SETS', 'RELIC_ITEMS', 'RELIC_PIECE_IDS',
    'RELIC_TICKET_ID', 'RELIC_TICKET_COST', 'RELIC_DROP_PCT_NORMAL', 'RELIC_DROP_BOSS_TIERS',
    'RELIC_PROC_MAGE', 'RELIC_PROC_ASSASSIN', 'RELIC_TIER_NEEDS', 'GM_RELIC_TICKETS',
    'RELIC_PROC_KNIGHT', 'RELIC_PROC_MONK', 'RELIC_PROC_PRIEST', 'RELIC_PROC_BLACKSMITH',
    'JOB3_EXP_L1', 'JOB3_EXP_SEGS', 'JOB_EXP_COEF', 'BASE_EXP_L100', 'BASE_EXP_SEGS',
    'STAT_RESET_COST_ZENY',
    'ALLY_MONSTER_TARGET_PLAYER_PCT',
    'OFFLINE_LOG_MAX', 'OFFLINE_LOG_ITEMS_MAX', 'OFFLINE_MIN_MS', 'OFFLINE_CAP_MS',
    'MAX_SLOTS', 'SAVE_KEY_PREFIX'];
  src += '\n;globalThis.__getState = () => state;'
       + '\nglobalThis.__setState = v => { state = v; };'
       + '\nglobalThis.__consts = { '
       + EXPOSE_CONST.map(n => `get ${n}(){ try { return ${n}; } catch (e) { return undefined; } }`).join(', ')
       + ' };\n';

  vm.runInNewContext(src, ctx, { filename: 'ro-idle' });

  Object.defineProperty(ctx, 'state', {
    get: ctx.__getState, set: ctx.__setState, configurable: true,
  });
  EXPOSE_CONST.forEach(n => {
    if (n in ctx) return;                    // function 宣告或本來就掛得上的不用動
    const v = ctx.__consts[n];
    if (v !== undefined) ctx[n] = v;
  });

  /* logMsg 定義在 engine.js（分流到 combatLogLanes 的入口也在那）。
     這裡**不能整支蓋掉**——蓋掉的話 combatLogLanes 永遠是空的，三分流測不到。
     captureLog 只是在原本的行為上多推一份到 __log。 */
  ctx.__log = [];
  const realLogMsg = ctx.logMsg;
  ctx.logMsg = opts.captureLog
    ? ((t, lane) => { ctx.__log.push(String(t)); realLogMsg(t, lane); })
    : realLogMsg;
  UI_STUBS.forEach(n => { if (typeof ctx[n] !== 'function') ctx[n] = () => {}; });
  return ctx;
}

/* 建一隻角色並走完整條職業路線。

     path     一轉起的職業鏈，例 ['swordsman','knight']
     rebirth  true 的話走到底之後轉生、再照原路重走一次（進階二轉必須）
     job      最後要停在哪個職業（省略就停在 path 的最後一個）
     stats    加點素質
     baseLevel/jobLevel  最後停下來時的等級（預設 99 / 該職業上限）

   等級與技能點是直接寫進 state 的——這是測試治具，目的是快速到達某個狀態，
   不是模擬玩家真的去練。 */
function mkChar(g, o) {
  o = o || {};
  const s = () => g.state;
  g.createCharacter(o.name || 'T', { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 }, o.gender || 'male');
  s().gold = o.gold != null ? o.gold : 5000000;
  // 安全區才轉得了生
  const safe = g.MAPS.filter(m => m.monsters && m.monsters.length === 0)[0];
  if (safe) s().mapId = safe.id;

  const walk = (chain) => {
    s().baseLevel = 99; s().jobLevel = 10;
    s().jobSkillPoints = s().jobSkillPoints || {};
    s().jobSkillPoints.novice = 0;
    chain.forEach(j => {
      g.doJobChange(j);
      s().jobLevel = (g.JOB_TREE[j] || {}).jobLevelMax || 50;
      s().jobSkillPoints[j] = 0;
    });
  };
  const chain = o.path || [];
  walk(chain);
  if (o.rebirth) {
    g.recomputeDerived(true);
    if (!g.doRebirth()) throw new Error('轉生失敗：' + g.rebirthBlockReason());
    walk(chain);
    if (o.job && o.job !== chain[chain.length - 1]) {
      s().baseLevel = 99;
      g.doJobChange(o.job);
    }
  } else if (o.job && o.job !== chain[chain.length - 1]) {
    g.doJobChange(o.job);
  }

  const jid = s().jobId;
  s().baseLevel = o.baseLevel != null ? o.baseLevel : 99;
  s().jobLevel = o.jobLevel != null ? o.jobLevel : ((g.JOB_TREE[jid] || {}).jobLevelMax || 50);
  s().jobSkillPoints[jid] = o.skillPoints != null ? o.skillPoints : 200;
  s().stats = Object.assign({ str: 60, agi: 50, vit: 50, int: 30, dex: 50, luk: 30 }, o.stats || {});
  g.recomputeDerived(true);
  return g.state;
}

// 學技能。lv 省略＝點到滿
function learn(g, id, lv) {
  const max = (g.SKILLS[id] || {}).maxLv || 1;
  const n = lv == null ? max : lv;
  for (let i = 0; i < n; i++) g.levelUpSkill(id);
  g.recomputeDerived(true);
  return g.state.learnedSkills[id] || 0;
}
// 把該職業所有技能點滿
function learnAll(g) {
  (g.currentJob().skills || []).forEach(sk => learn(g, sk.id));
  return g.state.learnedSkills;
}

// 裝上某個攻速分類的第一把能用的武器（'spear1' / 'sword2' / 'dagger' / 'bow'…）
function wield(g, cat) {
  const k = Object.keys(g.ITEMS).find(x => g.ITEMS[x].type === 'weapon'
    && g.aspdCategoryOf(x) === cat && !g.equipBlockReason(x));
  if (!k) return null;
  g.addItem(k, 1); g.equipItem(k); g.recomputeDerived(true);
  return k;
}
// 裝上某個防具部位的第一件有孔裝備，回傳 { itemId, slot }
const ARMOR_TYPE_OF = {
  armor: 'leather', shield: 'shield', garment: 'garment',
  footgear: 'footgear', headgear: 'headgear', accessory: 'accessory',
};
function wear(g, slot) {
  const at = ARMOR_TYPE_OF[slot];
  const k = Object.keys(g.ITEMS).find(x => {
    const it = g.ITEMS[x];
    return it.type === 'armor' && it.armorType === at && it.slots
      && !(it.reqLevel && it.reqLevel > g.state.baseLevel) && !g.equipBlockReason(x);
  });
  if (!k) return null;
  g.addItem(k, 1); g.equipItem(k); g.recomputeDerived(true);
  const es = g.EQUIP_SLOTS_ALL.find(x => g.getEquipBaseItemId(x) === k);
  return { itemId: k, slot: es };
}
// 插卡。自動找該卡片能插的部位並穿好裝備
function insertCard(g, cardId) {
  const c = g.CARDS[cardId];
  if (!c) throw new Error('沒有這張卡：' + cardId);
  const w = wear(g, c.slot === 'any' ? 'armor' : c.slot);
  if (!w) return null;
  g.addItem(cardId, 1);
  const ok = g.insertCard(w.slot, cardId);
  g.recomputeDerived(true);
  return ok ? w : null;
}
function refine(g, slot, n) {
  const id = g.getOrCreateEquipInstance(slot);
  g.state.instances[id].refine = n;
  g.recomputeDerived(true);
  return n;
}

/* 造一隻測試怪。預設血量拉到極高，才不會測到一半就被打死換一隻。
     size / race / element / isBoss  用來挑符合條件的怪物定義 */
function mon(g, o) {
  o = o || {};
  let def;
  if (o.defId) def = g.MONSTERS[o.defId];
  else {
    def = Object.values(g.MONSTERS).find(m =>
      (o.size == null || m.size === o.size) &&
      (o.race == null || m.race === o.race) &&
      (o.element == null || m.element === o.element) &&
      (o.isBoss == null || !!m.isBoss === o.isBoss) &&
      (o.minHp == null || (m.hp || 0) >= o.minHp));
  }
  if (!def) throw new Error('找不到符合條件的怪：' + JSON.stringify(o));
  g.state.monsterIdCounter = (g.state.monsterIdCounter || 0) + 1;
  const hp = o.hp != null ? o.hp : 9e9;
  const m = { defId: def.id, hp, maxHp: hp, id: g.state.monsterIdCounter };
  g.state.monsters = [m]; g.state.monster = m;
  return m;
}

/* 擲 n 次，回傳命中次數。給「機率型」的機制用（觸發率、異常狀態、格擋…）。
   fn 每次呼叫前會先跑 before（通常是重置冷卻或換一隻新的怪）。 */
function rate(n, fn, before) {
  let hit = 0;
  for (let i = 0; i < n; i++) {
    if (before) before(i);
    if (fn(i)) hit++;
  }
  return hit;
}

/* 斷言收集器。**只印失敗的**，全過就一行帶過——這是省 token 的關鍵。 */
function tester() {
  const fails = [];
  let n = 0;
  const api = {
    ok(label, cond, detail) {
      n++;
      if (!cond) fails.push(`  ✗ ${label}${detail != null ? '　' + detail : ''}`);
      return !!cond;
    },
    eq(label, actual, expected) {
      return api.ok(label, actual === expected, `實際 ${JSON.stringify(actual)} / 預期 ${JSON.stringify(expected)}`);
    },
    // 機率型的比對：允許誤差（預設 ±6 個百分點，400 次抽樣的合理範圍）
    near(label, actual, expected, tol) {
      const t = tol == null ? Math.max(2, expected * 0.25) : tol;
      return api.ok(label, Math.abs(actual - expected) <= t,
        `實際 ${typeof actual === 'number' ? actual.toFixed(2) : actual} / 預期 ${expected}±${t}`);
    },
    report(title) {
      if (fails.length) {
        console.log(`\n❌ ${title}：${n} 項中 ${fails.length} 項失敗`);
        fails.forEach(f => console.log(f));
      } else {
        console.log(`✅ ${title}：${n} 項全過`);
      }
      return fails.length ? 1 : 0;
    },
    get failCount() { return fails.length; },
  };
  return api;
}

module.exports = {
  boot, mkChar, learn, learnAll, wield, wear, insertCard, refine, mon, rate, tester,
  GAME_FILES,
};
