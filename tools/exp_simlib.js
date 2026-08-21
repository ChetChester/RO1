const H = require('./harness');

function build(L, withSkills) {
  const g = H.boot();
  g.createCharacter('S', { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 }, 'male');
  const s = g.state;
  s.gold = 1e9;
  s.baseLevel = Math.max(L, 1);
  s.jobLevel = 50; s.jobSkillPoints = { novice: 0 };
  if (L >= 10) g.doJobChange('swordsman');
  if (L >= 45) { s.jobLevel = 50; s.jobSkillPoints.swordsman = 0; g.doJobChange('knight'); }
  s.baseLevel = L;
  let pts = 0; for (let l = 2; l <= L; l++) pts += g.statPointsAtLevel(l);
  s.statPoints = pts;
  let guard = 0;
  while (guard++ < 5000) {
    const b = s.statPoints;
    ['str', 'agi', 'dex', 'vit'].forEach(k => g.allocateStat(k));
    if (s.statPoints === b) break;
  }
  if (withSkills) {
    ['swordsman', 'knight', s.jobId].forEach(j => {
      if (!g.JOB_TREE[j]) return;
      s.jobSkillPoints[j] = 200;
      (g.JOB_TREE[j].skills || []).forEach(sk => {
        for (let i = 0; i < (sk.maxLv || 1); i++) g.levelUpSkill(sk.id);
      });
    });
  }
  g.recomputeDerived(true);
  let best = null;
  Object.keys(g.ITEMS).forEach(k => {
    const it = g.ITEMS[k];
    if (it.type !== 'weapon' || !it.buyPrice) return;
    if (it.reqLevel && it.reqLevel > L) return;
    if (g.equipBlockReason(k)) return;
    if (!best || (it.atk || 0) > (g.ITEMS[best].atk || 0)) best = k;
  });
  if (best) { g.addItem(best, 1); g.equipItem(best); }
  ['leather', 'shield', 'garment', 'footgear', 'headgear'].forEach(type => {
    let b = null;
    Object.keys(g.ITEMS).forEach(k => {
      const it = g.ITEMS[k];
      if (it.type !== 'armor' || it.armorType !== type || !it.buyPrice) return;
      if (it.reqLevel && it.reqLevel > L) return;
      if (g.equipBlockReason(k)) return;
      if (!b || (it.def || 0) > (g.ITEMS[b].def || 0)) b = k;
    });
    if (b) { g.addItem(b, 1); g.equipItem(b); }
  });
  g.recomputeDerived(true);
  return g;
}

function mapAvgLevel(g, m) {
  const tw = m.monsters.reduce((a, x) => a + x.weight, 0);
  return m.monsters.reduce((a, x) => a + (g.MONSTERS[x.id] ? g.MONSTERS[x.id].level : 0) * x.weight / tw, 0);
}

function rankMaps(g, L, n, band) {
  band = band || 10;
  const list = [];
  g.MAPS.forEach(m => {
    if (!m.monsters || !m.monsters.length || m.id === 'test_field') return;
    const ml = mapAvgLevel(g, m);
    if (ml < L - band || ml > L + band) return;
    const e = g.estimateMapYield(m);
    if (!e || !isFinite(e.expPer10m) || e.expPer10m <= 0) return;
    list.push({ m, ml, est: e.expPer10m / 600 });
  });
  list.sort((a, b) => b.est - a.est);
  if (!list.length && band < 60) return rankMaps(g, L, n, band + 15);
  return list.slice(0, n);
}

function runSim(g, mapId, minutes) {
  let t = 1700000000000;
  const Real = g.Date;
  function FakeDate(...a) { return new Real(...a); }
  FakeDate.now = () => t;
  FakeDate.prototype = Real.prototype;
  g.Date = FakeDate;
  g.changeMap(mapId);
  g.state.autoSkill = true;
  g.state.hp = g.state.maxHp; g.state.sp = g.state.maxSp;
  let exp = 0;
  g.gainExp = (b) => { exp += b; };
  const ticks = minutes * 60 * 10;
  for (let i = 0; i < ticks; i++) {
    t += 100;
    if (g.state.hp <= 0) g.state.hp = g.state.maxHp;
    g.gameTick();
  }
  return exp / (minutes * 60);
}

module.exports = { build, rankMaps, runSim, mapAvgLevel };
