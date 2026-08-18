/* 搞笑藝人／冷豔舞姬（#77）。官方 6 個做 5 個。

   只驗會壞的東西（照 AGENTS.md 的 Testing Guidelines）：
     - blockScope 分流：普攻免傷與技能免傷不能互相擋
     - 互斥組：合奏類與歌曲類各一，兩組之間不互斥
     - SP 維持費扣得到、SP 不足會中斷
     - 塔羅牌十張每張都真的動得了東西（推了沒人讀是這個 repo 的老毛病）
*/
const H = require('./harness');
const t = H.tester();

const mk = (path, job, gender) => {
  const g = H.boot({ captureLog: true });
  H.mkChar(g, { path, rebirth: true, job, gender });
  ['archer', path[1], job].forEach(j => { g.state.jobSkillPoints[j] = 300; });
  return g;
};
const CLOWN = () => mk(['archer', 'bard'], 'clown', 'male');
const anyMon = g => Object.keys(g.MONSTERS)[0];
const learnDeep = (g, id, lv) => {
  const sk = g.SKILLS[id];
  const rs = sk.requires ? (Array.isArray(sk.requires) ? sk.requires : [sk.requires]) : [];
  rs.forEach(r => learnDeep(g, r.skillId, r.level));
  return H.learn(g, id, lv);
};

/* ---- 1. 兩個職業共用同一份，傀儡師沒有偷偷做進來 ---- */
{
  const g = CLOWN();
  t.eq('搞笑藝人', g.JOB_TREE.clown.name, '搞笑藝人');
  t.eq('冷豔舞姬', g.JOB_TREE.gypsy.name, '冷豔舞姬');
  const ids = j => g.JOB_TREE[j].skills.map(s => s.id).filter(x => x.startsWith('cg_')).sort().join(',');
  t.eq('兩邊共用同一份 5 個技能', ids('clown'), ids('gypsy'));
  t.eq('5 個', ids('clown').split(',').length, 5);
  t.ok('傀儡師的把戲沒做（等隊伍系統）', !g.SKILLS.cg_marionette);
}

/* ---- 2. blockScope 分流 ---- */
{
  const g = CLOWN();
  H.wield(g, 'instrument');
  g.state.sp = g.state.maxSp;
  H.learn(g, 'cg_moonlit', 5);
  H.learn(g, 'cg_hermode', 5);
  g.state.cooldowns = {};
  t.eq('落花放得出來', g.castSkill('cg_moonlit'), true);
  g.state.sp = g.state.maxSp;
  t.eq('海羅默德放得出來', g.castSkill('cg_hermode'), true);
  t.eq('兩個都在（合奏類與歌曲類互不排斥）',
    g.state.buffs.filter(b => b.type === 'block' && b.blockScope).length, 2);

  // 只擋自己那一種：擋掉之後冷卻 10 秒，所以第二次同 scope 一定擋不下來
  const first = g.playerBlocked('attack');
  const second = g.playerBlocked('attack');
  t.ok('普攻免傷發動一次', !!first);
  t.eq('冷卻內不再發動', second, null);
  t.ok('技能免傷不受普攻那次影響', !!g.playerBlocked('skill'));

  // 沒寫 scope 的（自動防禦）兩邊都擋
  g.state.buffs = [{ type: 'block', flatBonus: 100, mult: 1 }];
  t.ok('沒寫 blockScope 的擋普攻', !!g.playerBlocked('attack'));
  t.ok('沒寫 blockScope 的也擋技能', !!g.playerBlocked('skill'));
}

/* ---- 3. 互斥組：同組換曲、SP 維持費 ---- */
{
  const g = CLOWN();
  H.wield(g, 'instrument');
  H.learn(g, 'cg_moonlit', 5);
  H.learn(g, 'bd_intoabyss', 5);        // 也是 ensemble 組
  g.state.sp = g.state.maxSp; g.state.cooldowns = {};
  g.castSkill('cg_moonlit');
  g.state.sp = g.state.maxSp;
  g.castSkill('bd_intoabyss');
  t.eq('同組只留一個', g.state.buffs.filter(b => b.exclusiveGroup === 'ensemble').length, 1);

  // 維持費
  const g2 = CLOWN();
  H.wield(g2, 'instrument');
  H.learn(g2, 'cg_moonlit', 5);
  g2.state.mapId = g2.MAPS.find(m => m.monsters && m.monsters.length).id;
  g2.state.sp = g2.state.maxSp; g2.state.cooldowns = {};
  g2.castSkill('cg_moonlit');
  const b = g2.state.buffs.find(x => x.skillId === 'cg_moonlit');
  t.eq('Lv5 每跳扣 20 SP', b.spDrain, 20);
  /* **不要動 _lastSlowTick**：那會把慢心跳一起叫起來，自然回復（每跳約 +23 SP）
     會把 −20 的維持費蓋掉，看起來就像沒扣。維持費本身每個 tick 都會檢查。 */
  const sp0 = g2.state.sp;
  b.drainNextAt = Date.now() - 1;
  g2.gameTick();
  t.eq('維持費剛好扣 20', sp0 - g2.state.sp, 20);

  // SP 不夠就中斷
  g2.state.sp = 5;
  b.drainNextAt = Date.now() - 1;
  g2.gameTick();
  t.ok('SP 不足時演奏中斷', !g2.state.buffs.some(x => x.skillId === 'cg_moonlit'));
}

/* ---- 4. 塔羅牌十張都動得了東西 ---- */
{
  const g = CLOWN();
  H.learn(g, 'cg_tarotcard', 1);
  t.eq('數字有人讀', g.state.tarotCard.chance, 20);
  t.eq('十張', g.TAROT_CARDS.length, 10);

  // 逐張抽，看有沒有真的改到怪物狀態（雙重命運會遞迴抽兩張）
  const dead = [];
  g.TAROT_CARDS.forEach((card, i) => {
    // 挑不免疫睡眠／冰凍／石化的怪：地屬性免疫石化、水屬性免疫冰凍、不死免疫睡眠
    const m = H.mon(g, { race: 'brute', element: 'fire', hp: 9e8 });
    const md = g.MONSTERS[m.defId];
    g.monBuffAdd(m, 'atkPct', 50, 60);   // 給「淨化」一個真的增益當對象
    const before = JSON.stringify({ hp: m.hp, ail: m.ail, a: m.debuffAtk, d: m.debuffDef, mb: m.mbuff });
    // 直接呼叫那一張，不靠隨機抽中
    if (card.flat) { m.hp -= card.flat; } else if (card.double) {
      g.drawTarot(m, md, false); g.drawTarot(m, md, false);
    } else { card.run(m, md); }
    const after = JSON.stringify({ hp: m.hp, ail: m.ail, a: m.debuffAtk, d: m.debuffDef, mb: m.mbuff });
    if (before === after) dead.push(`${i}:${card.name}`);
  });
  t.eq('十張都改得到怪物狀態', dead.join(','), '');

  // 觸發路徑 + 內部冷卻
  H.wield(g, 'instrument');
  const m = H.mon(g, { defId: anyMon(g), hp: 9e8 });
  g.state.songProcReadyAt = {};
  g.state.tarotCard.chance = 100;
  g.tryTarotCard(m, g.MONSTERS[m.defId]);
  t.ok('觸發後進入冷卻', g.state.songProcReadyAt.cg_tarotcard > Date.now());
}

/* ---- 5. 奧義箭亂舞：ATK 技能要判定命中、要箭、要樂器/鞭 ---- */
{
  const g = CLOWN();
  learnDeep(g, 'cg_arrowvulcan', 10);
  t.eq('點得到 Lv10', g.state.learnedSkills.cg_arrowvulcan, 10);
  H.mon(g, { defId: anyMon(g) });
  H.wield(g, 'sword1');
  g.state.cooldowns = {}; g.state.sp = g.state.maxSp;
  t.eq('拿劍放不出來', g.castSkill('cg_arrowvulcan'), false);
  H.wield(g, 'instrument');
  g.addItem('arrow', 100);
  g.equipAmmo('arrow');            // 箭矢要裝到彈藥欄，放背包不算
  g.state.cooldowns = {};
  t.eq('拿樂器就放得出來', g.castSkill('cg_arrowvulcan'), true);
  t.ok('沒有標 alwaysHit（ATK 技能要判定命中）', !g.SKILLS.cg_arrowvulcan.alwaysHit);
}

/* ---- 6. 職人演奏家 ---- */
{
  const g = CLOWN();
  H.wield(g, 'instrument');
  g.recomputeDerived(true);
  const a0 = g.state.aspd;
  H.learn(g, 'cg_specialsinger', 1);
  t.eq('攻速 +1', g.state.aspd - a0, 1);
}

t.report('搞笑藝人／冷豔舞姬 5 技能');
