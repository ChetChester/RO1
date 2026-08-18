/* 全庫冒煙測試：把每一筆資料都推過一次引擎，看有沒有東西會炸。

   跑法：node tools/test_smoke.js
   全過印一行；有例外才列出來（同一支函式只列前 3 筆，免得洗版）。

   這支取代了以前在瀏覽器 console 裡跑的那段全量掃描——同樣的覆蓋率，
   但輸出從上千行變成一行。**不驗畫面**（沒載 ui.js），畫面要另外開瀏覽器看。

   覆蓋：
     每個技能 × 每一級      free-cast 一次
     每個職業               點滿自己的技能後重算 + 攻速 + 防禦
     每張卡片               插上去重算 + 說明字串
     每件裝備               穿戴檢查 + 欄位解析
     每隻怪物               物防/魔防/家族/屬性/普攻追擊
     每張地圖               區域查詢
     轉生 × 每條職業線      路線鎖定判斷
*/
const H = require('./harness');

const t = H.tester();
const g = H.boot();

const errs = [];
const seen = {};
function run(bucket, label, fn) {
  try { fn(); } catch (e) {
    errs.push(bucket);
    seen[bucket] = seen[bucket] || [];
    if (seen[bucket].length < 3) seen[bucket].push(`${label}：${e.message}`);
  }
}

const counts = {};
const bump = k => { counts[k] = (counts[k] || 0) + 1; };

/* ---- 1. 每個技能 × 每一級 free-cast ---- */
H.mkChar(g, { path: ['swordsman', 'knight'], rebirth: true, job: 'lordknight' });
H.wield(g, 'spear1');
Object.keys(g.SKILLS).forEach(id => {
  const sk = g.SKILLS[id];
  for (let lv = 1; lv <= (sk.maxLv || 1); lv++) {
    run('castSkill', `${id} Lv${lv}`, () => {
      H.mon(g, { size: 'medium', isBoss: false });
      g.state.sp = g.state.maxSp; g.state.hp = g.state.maxHp;
      g.castSkill(id, { free: true, forceLv: lv });
      bump('技能施放');
    });
  }
});

/* ---- 2. 每個職業：點滿自己的技能後重算 ---- */
Object.keys(g.JOB_TREE).forEach(j => {
  run('job', j, () => {
    const save = { job: g.state.jobId, learned: g.state.learnedSkills };
    g.state.jobId = j;
    g.state.learnedSkills = {};
    (g.JOB_TREE[j].skills || []).forEach(sk => { g.state.learnedSkills[sk.id] = sk.maxLv || 1; });
    g.recomputeDerived();
    g.computeAspd();
    g.debuffedDef(g.state.defHard, g.state.defSoft);
    g.state.jobId = save.job; g.state.learnedSkills = save.learned;
    bump('職業');
  });
});
g.recomputeDerived(true);

/* ---- 3. 每張卡片：真的插上去重算 ---- */
Object.keys(g.CARDS).forEach(k => {
  run('card', k, () => {
    const c = g.CARDS[k];
    // 只挑本作有道具本體、而且部位對得上的（其餘是附魔石，插不上去是正常的）
    if (g.ITEMS[k] && c.slot) {
      const w = H.wear(g, c.slot === 'any' ? 'armor' : c.slot);
      if (w) {
        g.addItem(k, 1);
        g.insertCard(w.slot, k);
        g.recomputeDerived(true);
        g.getCardBonus('atk'); g.effectiveGearBonuses();
        g.state.equip = {};              // 下一張重來，避免累積
        g.recomputeDerived(true);
      }
    }
    bump('卡片');
  });
});
H.wield(g, 'spear1');

/* ---- 4. 每件裝備 ---- */
Object.keys(g.ITEMS).forEach(k => {
  const it = g.ITEMS[k];
  if (it.type !== 'weapon' && it.type !== 'armor') return;
  run('equip', k, () => {
    g.equipBlockReason(k); g.resolveEquipSlotFor(k); g.jobCanUseWeapon(g.state.jobId, k);
    bump('裝備');
  });
});

/* ---- 5. 每隻怪物 ---- */
Object.keys(g.MONSTERS).forEach(k => {
  run('monster', k, () => {
    const md = g.MONSTERS[k];
    g.defOf(md, 1, false); g.defOf(md, 1, true);
    g.cardFamilyDmgTakenMult(md); g.familyOfMonster(md); g.raceFlatBonus(md);
    g.getElementMultiplier(md.element || 'none', g.state.playerElement || 'none');
    g.weaponChainDamage(md, 1, 'mid', g.SKILLS.lk_spiralpierce);
    const m = { defId: k, hp: 9e9, maxHp: 9e9, id: ++g.state.monsterIdCounter };
    g.state.monsters = [m];
    g.state.onAttackStrikeReadyAt = {};
    g.tryOnAttackStrikes(m, md);
    bump('怪物');
  });
});

/* ---- 6. 每張地圖 ---- */
g.MAPS.forEach(m => run('map', m.id, () => { g.regionOf(m.id); bump('地圖'); }));

/* ---- 7. 轉生路線鎖定：六條線 × 每個職業 ---- */
[null, ['swordsman', 'knight'], ['mage', 'wizard'], ['archer', 'hunter'],
 ['merchant', 'blacksmith'], ['thief', 'assassin'], ['acolyte', 'priest']].forEach(path => {
  g.state.rebirthPath = path;
  g.state.rebirthCount = path ? 1 : 0;
  Object.keys(g.JOB_TREE).forEach(j => {
    run('rebirth', `${j}/${path}`, () => {
      const save = g.state.jobId;
      g.state.jobId = j;
      g.rebirthBlockReason(); g.rebirthPathNext(); g.inSafeZone();
      Object.keys(g.JOB_TREE).forEach(k => { g.canJobChange(k); g.jobLockReason(k); });
      g.state.jobId = save;
      bump('轉生組合');
    });
  });
});
g.state.rebirthPath = null; g.state.rebirthCount = 0;

/* ---- 8. 體型修正表對照官方 size_fix（2026-08-09）----

   舊表用 weaponType 當索引，而斧頭的 weaponType 是 mace、拳刃／書／杖／槍
   在表上根本沒有那一列——532 把武器一律吃 100/100/100，傷害整層偏高。
   改成用 aspdCategoryOf() 之後把每一類都對死，免得哪天有人改回去沒人發現。 */
{
  const OFFICIAL = {
    bare: '100/100/100', dagger: '100/75/50', sword1: '75/100/75', sword2: '75/75/100',
    spear1: '75/75/100', spear2: '75/75/100', axe1: '50/75/100', axe2: '50/75/100',
    mace: '75/100/100', rod1: '100/100/100', rod2: '100/100/100', bow: '100/100/75',
    knuckle: '100/75/50', instrument: '75/100/75', whip: '75/100/75', book: '100/100/50',
    katar: '75/100/75', pistol: '100/100/100', rifle: '100/100/100',
    gatling: '100/100/100', shotgun: '100/100/100', grenade: '100/100/100',
  };
  H.mkChar(g, { path: ['merchant'] });
  const sz = {};
  ['small', 'medium', 'large'].forEach(s => { sz[s] = g.MONSTERS[H.mon(g, { size: s, isBoss: false }).defId]; });
  const wrong = [];
  Object.keys(OFFICIAL).forEach(cat => {
    // 直接寫 state.equip.weapon，繞過職業限制（這裡只驗表，不驗誰拿得動）
    const k = cat === 'bare' ? null
      : Object.keys(g.ITEMS).find(x => g.ITEMS[x].type === 'weapon' && g.aspdCategoryOf(x) === cat);
    if (cat !== 'bare' && !k) { wrong.push(`${cat}：資料裡找不到這類武器`); return; }
    g.state.equip.weapon = k;
    const got = ['small', 'medium', 'large']
      .map(s => Math.round(g.getSizeMultiplier(sz[s]) * 100)).join('/');
    if (got !== OFFICIAL[cat]) wrong.push(`${cat}：${got} / 官方 ${OFFICIAL[cat]}`);
  });
  g.state.equip.weapon = null;
  t.eq('體型修正表與官方 size_fix 完全一致', wrong.join('　'), '');

  // 每一種武器都要查得到自己的那一列，不能掉進 default
  const missing = new Set();
  Object.values(g.ITEMS).forEach(it => {
    if (it.type !== 'weapon') return;
    const cat = g.aspdCategoryOf(it.id);
    if (!g.SIZE_MODIFIER[cat]) missing.add(cat);
  });
  t.eq('沒有任何武器類別掉進 default', [...missing].join(','), '');
}

/* ---- 9. 每個職業都查得到自己的攻速表（#75）----

   `aspdJobKey()` 查不到表時**不會報錯**：`computeAspd()` 悄悄退回空手值 154，
   `jobCanUseWeapon()` 更糟——`if (!tbl) return true` 等於那個職業什麼武器都拿得動。
   超級新手就這樣錯了很久（表名是 `x_超級初心者`，沒寫 aspdFrom 就查 supernovice）。
   兩個症狀都是靜默的，所以在這裡釘死。 */
{
  const noTable = Object.keys(g.JOB_TREE).filter(j => !g.ASPD_WEAPON_BASE[g.aspdJobKey(j)]);
  t.eq('每個職業都查得到攻速表', noTable.join(','), '');

  // aspdFrom 指到的東西必須存在：不是另一個職業，就是一張表
  const dangling = Object.values(g.JOB_TREE).filter(j =>
    j.aspdFrom && !g.JOB_TREE[j.aspdFrom] && !g.ASPD_WEAPON_BASE[j.aspdFrom]).map(j => j.id);
  t.eq('aspdFrom 沒有指到不存在的東西', dangling.join(','), '');

  // 多段指向要跟得到底（聖殿十字軍 → 十字軍 → x_十字軍_聖殿十字軍）
  t.eq('aspdFrom 一路跟到終點', g.aspdJobKey('paladin'), g.aspdJobKey('crusader'));
}

/* ---- 10. bonusLevels 全部對得上官方（#75）----
   34 個職業的加成表都是 rAthena job_stats.yml 的原始資料。這裡只驗「總點數」——
   完整逐格比對在 tools/ 外面（一次性腳本），但總點數錯了就代表有人手改過。 */
{
  const EXPECT = {
    novice: 6, supernovice: 30, swordsman: 18, mage: 18, archer: 18, merchant: 18, thief: 18, acolyte: 18,
    knight: 30, wizard: 30, hunter: 30, blacksmith: 30, assassin: 30, priest: 30,
    crusader: 30, bard: 30, dancer: 30, rogue: 30, monk: 30, sage: 30, alchemist: 30,
    lordknight: 45, highwizard: 45, sniper: 45, whitesmith: 45, assassincross: 45, highpriest: 45,
    paladin: 45, professor: 45, clown: 45, gypsy: 45, creator: 45, stalker: 45, champion: 45,
  };
  const wrong = [];
  Object.keys(EXPECT).forEach(j => {
    const b = (g.JOB_TREE[j] || {}).bonusLevels || {};
    const n = Object.values(b).reduce((a, v) => a + v.length, 0);
    if (n !== EXPECT[j]) wrong.push(`${j}:${n}≠${EXPECT[j]}`);
  });
  t.eq('職業加成點數與官方一致', wrong.join(' '), '');
  // 進階二轉不是「本職的表 + 補 51~70」——官方那是**另一張表**，1~50 那段就不同了
  t.ok('領主騎士的加成表跟騎士不同（官方本來就是兩張）',
    g.JOB_TREE.lordknight.bonusLevels.vit.join(',') !== g.JOB_TREE.knight.bonusLevels.vit.join(','));
}

/* ---- 11. 前置技能的等級不能超過那個技能的上限（#79）----
   官方的前置等級跟本作的 maxLv 不一定一致（潛遁官方 Lv3、本作壓成 maxLv 1），
   照抄就會做出一個**永遠學不到**的技能，而且不會報錯。 */
{
  const bad = [];
  Object.values(g.SKILLS).forEach(sk => {
    const rs = sk.requires ? (Array.isArray(sk.requires) ? sk.requires : [sk.requires]) : [];
    rs.forEach(r => {
      const tgt = g.SKILLS[r.skillId];
      if (!tgt) { bad.push(`${sk.id}→${r.skillId}(不存在)`); return; }
      if (r.level > (tgt.maxLv || 1)) bad.push(`${sk.id}→${r.skillId} 要 Lv${r.level} 但上限 ${tgt.maxLv}`);
    });
  });
  t.eq('沒有學不到的前置', bad.join(' '), '');
}

/* ---- 12. 職業線起點（#94）----
   轉職樹靠 `jobLineRoot()` 決定「只畫這一條線」。parent 鏈只要有一環接錯，
   畫面上就會出現**別條線的職業**，而且看起來完全正常（節點畫得出來、連線也在）。 */
{
  const roots = new Set(['swordsman', 'mage', 'archer', 'merchant', 'thief', 'acolyte', 'supernovice']);
  const bad = [];
  Object.values(g.JOB_TREE).forEach(jd => {
    const r = g.jobLineRoot(jd.id);
    if (jd.id === 'novice') { if (r !== null) bad.push(`${jd.id}→${r}`); return; }
    if (!roots.has(r)) bad.push(`${jd.id}→${r}`);
  });
  t.eq('每個職業都找得到自己的一轉起點', bad.join(' '), '');
  // 二轉與進階二轉要跟本職同一條線，不然轉生後畫出來的那格會跳到別條
  const pairs = [['priest', 'acolyte'], ['monk', 'acolyte'], ['highpriest', 'acolyte'],
    ['champion', 'acolyte'], ['dancer', 'archer'], ['assassincross', 'thief'],
    ['paladin', 'swordsman'], ['professor', 'mage'], ['creator', 'merchant']];
  const wrong = pairs.filter(([j, r]) => g.jobLineRoot(j) !== r).map(([j]) => j);
  t.eq('進階二轉沒有跳線', wrong.join(' '), '');
  t.eq('超級新手自己就是起點', g.jobLineRoot('supernovice'), 'supernovice');
}

/* ---- 結果 ---- */
t.eq('全庫掃描零例外', errs.length, 0);
if (errs.length) {
  Object.keys(seen).forEach(b => {
    console.log(`  [${b}] 共 ${errs.filter(x => x === b).length} 筆，前 3 筆：`);
    seen[b].forEach(s => console.log('    ' + s));
  });
}
console.log('  覆蓋：' + Object.keys(counts).map(k => `${k} ${counts[k]}`).join('　'));
process.exit(t.report('全庫冒煙'));
