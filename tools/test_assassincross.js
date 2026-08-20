/* 十字刺客 5 個技能 + 技能點溢出修復的回歸測試（#59）。

   跑法：node tools/test_assassincross.js
   全過就印一行；有失敗才列出來，並以 exit code 1 結束。

   跟 test_lordknight.js 同一套：走 recomputeDerived / castSkill / tryEdpProc 本尊，
   不是讀資料檔對答案。機率型的用 rate() 抽樣。
*/
const H = require('./harness');

const t = H.tester();
const AX = { path: ['thief', 'assassin'], rebirth: true, job: 'assassincross' };

/* ---------- 1. 職業框架 ---------- */
{
  const g = H.boot();
  H.mkChar(g, AX);
  t.eq('職業是十字刺客', g.state.jobId, 'assassincross');
  t.eq('職業等級上限 70', g.currentJob().jobLevelMax, 70);
  const have = new Set(g.currentJob().skills.map(s => s.id));
  const own = ['asc_katar', 'asc_cdp', 'asc_edp', 'asc_breaker', 'asc_meteorassault'];
  t.ok('自己的 5 個技能到齊（幻影步已刪）', own.every(id => have.has(id)));
  t.ok('幻影步不存在', !g.SKILLS.asc_hallucination && !g.SKILLS.hallucination);
  // #60：進階二轉取代二轉，所以刺客的技能整份借過來
  const asIds = g.JOB_TREE.assassin.skills.map(s => s.id);
  t.ok('刺客的技能整份借過來', asIds.every(id => have.has(id)),
    asIds.filter(id => !have.has(id)).join(','));
  t.eq('轉生路線鎖住下一站', g.rebirthPathNext(), 'guillotinecross');
}

/* ---------- 2. 高階拳刃修練（拳刃限定的物理傷害%）---------- */
{
  const g = H.boot();
  H.mkChar(g, AX);
  const katar = H.wield(g, 'katar');
  t.ok('拿得到拳刃', !!katar);
  const md = g.MONSTERS[H.mon(g, { size: 'medium', isBoss: false }).defId];
  const before = g.weaponChainDamage(md, 1, 'mid');
  H.learn(g, 'asc_katar');
  t.eq('Lv5 是 +20%', g.state.physDmgPct, 20);
  const after = g.weaponChainDamage(md, 1, 'mid');
  t.near('普攻鏈 ×1.20', after / before, 1.20, 0.01);

  // 技能傷害也要吃到（官方寫的是「物理傷害」，不是「普攻傷害」）
  H.learn(g, 'asc_breaker');
  g.state.sp = g.state.maxSp;
  // 走 'mid' 不走隨機浮動，否則兩次抽到的浮動不同，比值會抖
  const skWith = g.weaponChainDamage(md, 1, 'mid', g.SKILLS.asc_breaker);
  g.state.physDmgPct = 0;
  const skWithout = g.weaponChainDamage(md, 1, 'mid', g.SKILLS.asc_breaker);
  t.near('物理技能也吃 ×1.20', skWith / skWithout, 1.20, 0.01);

  // 換非拳刃武器就歸零
  H.wield(g, 'dagger');
  H.learn(g, 'asc_katar');
  t.eq('拿短劍時歸零', g.state.physDmgPct, 0);
}

/* ---------- 3. 毒液製作（七種材料 + 25%）---------- */
{
  const g = H.boot();
  H.mkChar(g, AX);
  t.ok('學之前沒有毒藥瓶配方', !g.state.unlockedMaterialCrafts.includes('poison'));
  H.learn(g, 'asc_cdp');
  t.ok('學了之後解鎖', g.state.unlockedMaterialCrafts.includes('poison'));

  const R = g.MATERIAL_CRAFT_RECIPES.poison_bottle;
  t.eq('官方七種材料一項不減', R.consume.length, 7);
  t.eq('成功率 25%', g.materialCraftChance(R), 25);
  t.eq('產物是毒藥瓶', R.result, 'poison_bottle');
  t.ok('七種材料在 ITEMS 裡都有', R.consume.every(c => !!g.ITEMS[c.item]),
    R.consume.filter(c => !g.ITEMS[c.item]).map(c => c.item).join(','));

  /* 使用者要求「確認七樣道具都可以打怪取得」。
     六樣有可遇怪掉落，菠色克藥水**只有道具商人賣**——這條斷言把那個事實鎖住，
     哪天有人改了掉落表或商店清單，測試會講話。 */
  const reachable = new Set();
  g.MAPS.forEach(m => (m.monsters || []).forEach(x => reachable.add(x.id || x)));
  const shopItems = new Set();
  Object.values(g.NPC_SHOPS).forEach(s => (s.items || []).forEach(id => shopItems.add(id)));
  const noDrop = R.consume.map(c => c.item).filter(id =>
    !Object.values(g.MONSTERS).some(mo => reachable.has(mo.id) && (mo.drops || []).some(d => d.item === id)));
  t.eq('只有菠色克藥水沒有怪會掉', noDrop.join(','), 'berserk_potion');
  t.ok('那一樣商店買得到', noDrop.every(id => shopItems.has(id)));

  // 真的鍛造：材料不論成敗都消耗，成功率落在 25% 附近
  const give = () => { R.consume.forEach(c => g.addItem(c.item, 1)); g.state.gold = 1e9; };
  give();
  const qtyBefore = g.getItemQty(R.consume[0].item);
  g.craftMaterial('poison_bottle');
  t.eq('失敗也消耗材料', g.getItemQty(R.consume[0].item), qtyBefore - 1);

  let made = 0;
  const N = 2000;
  for (let i = 0; i < N; i++) { give(); if (g.craftMaterial('poison_bottle')) made++; }
  t.near('實際成功率 25%', made / N * 100, 25, 3);
  t.ok('成功時真的拿到瓶子', g.getItemQty('poison_bottle') >= made - 1, `瓶子 ${g.getItemQty('poison_bottle')} / 成功 ${made}`);

  // 沒學的人鍛不了
  const g2 = H.boot();
  H.mkChar(g2, AX);
  g2.state.gold = 1e9;
  R.consume.forEach(c => g2.addItem(c.item, 1));
  t.eq('沒學就鍛不出來', g2.craftMaterial('poison_bottle'), false);
}

/* ---------- 4. 致命塗毒（被動：敵人中毒 + 身上有瓶子）---------- */
{
  const g = H.boot();
  H.mkChar(g, AX);
  H.wield(g, 'katar');
  H.learn(g, 'asc_edp');
  t.eq('Lv5 裝備ATK ×4.0', g.state.edpWeaponMult, 4.0);
  t.eq('毒傷害 ×2', g.state.edpPoisonMult, 2);
  t.eq('持續 10 秒', g.state.edpDurSec, 10);
  t.eq('冷卻 30 秒', g.state.edpCdSec, 30);

  const fresh = () => {
    g.state.buffs = []; g.state.edpReadyAt = 0;
    const m = H.mon(g, { size: 'medium', isBoss: false });
    return m;
  };
  const fired = () => g.state.buffs.some(b => b.skillId === 'asc_edp');

  // 目標沒中毒 → 不觸發
  let m = fresh();
  g.tryEdpProc(m);
  t.ok('目標沒中毒就不觸發', !fired());

  // 中毒但身上沒瓶子 → 不觸發
  m = fresh();
  g.applyAilment(m, g.MONSTERS[m.defId], 'poison');
  t.ok('目標確實中毒了', g.ailActive(m, 'poison'));
  g.tryEdpProc(m);
  t.ok('沒有毒藥瓶就不觸發', !fired());

  // 中毒 + 有瓶子 → 必定觸發（不是機率技）
  g.addItem('poison_bottle', 3);
  m = fresh();
  g.applyAilment(m, g.MONSTERS[m.defId], 'poison');
  g.tryEdpProc(m);
  t.ok('條件齊全就觸發', fired());
  t.eq('毒藥瓶不消耗', g.getItemQty('poison_bottle'), 3);
  t.eq('推了兩個 buff', g.state.buffs.filter(b => b.skillId === 'asc_edp').length, 2);

  // 冷卻中不重複觸發
  g.state.buffs = [];
  g.tryEdpProc(m);
  t.ok('30 秒冷卻內不重複', !fired());

  /* 本作有兩套毒：塗毒／施毒走 applyPoisonDot（mon.poisonDotEnd），
     卡片與 #29 的異常狀態走 applyAilment（mon.ail.poison）。
     刺客自己的塗毒是**前者**——只認後者的話這個職業用自己的招觸發不了自己的技能。 */
  m = fresh();
  g.applyPoisonDot(m, g.MONSTERS[m.defId], 100);
  t.ok('塗毒那條路也算中毒', g.monPoisoned(m));
  g.tryEdpProc(m);
  t.ok('塗毒（applyPoisonDot）也能觸發', fired());

  /* 「裝備ATK ×4」只能乘武器那一桶——素質 ATK 與熟練度不跟著漲。
     所以整條鏈的倍率一定小於 4，而且要正好等於「武器桶放大 4 倍」後的結果。 */
  g.state.buffs = []; g.state.edpReadyAt = 0;
  const md = g.MONSTERS[m.defId];
  const plain = g.weaponChainDamage(md, 1, 'mid');
  g.tryEdpProc(m);
  const buffed = g.weaponChainDamage(md, 1, 'mid');
  /* 鏈的形狀是 (武器桶 × 浮動×體型×屬性 + 素質桶)。
     浮動那一段從 plain 反推（roll:'mid' 沒有亂數，所以解得出來），
     這樣預期值不必自己重算體型與屬性，也就不會跟引擎算兩套。 */
  const nw = (g.state._atkStatus || 0) + (g.state._atkMastery || 0);
  const wV = plain - nw;                       // 武器桶乘完所有修正之後的值
  t.ok('整條鏈的放大倍率小於 4（素質ATK沒跟著漲）', buffed / plain < 4 && buffed / plain > 1,
    `實際 ×${(buffed / plain).toFixed(2)}`);
  t.near('正好等於武器桶 ×4', buffed, wV * 4 + nw, Math.max(1, buffed * 0.005));

  // 毒屬性傷害 ×2
  t.eq('毒屬性傷害 buff ×2', g.elementDmgMult('poison'), 2);
  t.eq('其他屬性不受影響', g.elementDmgMult('fire'), 1);
}

/* ---------- 5. 心靈震波（半暴擊率、半暴擊加成）---------- */
{
  const g = H.boot();
  H.mkChar(g, AX);
  H.wield(g, 'katar');
  H.learn(g, 'asc_breaker');
  const sk = g.SKILLS.asc_breaker;
  t.eq('官方 Lv10 是 ATK 1500%', sk.mult[9], 15);
  t.eq('critRateMult 0.5', sk.critRateMult, 0.5);
  t.eq('critDmgMult 0.5', sk.critDmgMult, 0.5);

  /* 引擎沒有對外回報「這一發有沒有暴擊」，而單發傷害還帶著武器浮動，
     所以不用單筆分群，改**比平均值**——樣本夠多時浮動會自己抵銷掉。

     暴擊率 0 → 平均 = 基準
     暴擊率 100 → 實際只有一半會暴擊，每次暴擊加 25%（+50% 打對折）
                  ⇒ 平均應該是基準 × (1 + 0.5×0.25) = ×1.125
     這一個比值同時卡住兩個欄位：critRateMult 錯了會偏離 0.5，
     critDmgMult 錯了會變成 ×1.25（沒打折）或 ×1.0（沒暴擊）。 */
  const meanDmg = (critRate, n) => {
    let sum = 0, hits = 0;
    for (let i = 0; i < n; i++) {
      const m = H.mon(g, { size: 'medium', isBoss: false });
      g.state.sp = g.state.maxSp;
      g.state.hit = 100000;            // 技能會判命中，這裡不測命中，直接鎖必中
      g.state.critRate = critRate;
      const hp0 = m.hp;
      g.castSkill('asc_breaker', { free: true, forceLv: 10 });
      const d = hp0 - m.hp;
      if (d > 0) { sum += d; hits++; }
    }
    return { mean: sum / hits, hits, n };
  };
  const base = meanDmg(0, 2500);
  const full = meanDmg(100, 2500);
  t.eq('鎖必中之後沒有一發落空', base.hits, base.n);
  t.near('暴擊率100時平均只漲 12.5%（半機率×半加成）', full.mean / base.mean, 1.125, 0.02);

  // 反面：把 critRateMult 拿掉就完全不該暴擊
  const saved = sk.critRateMult;
  delete sk.critRateMult;
  const none = meanDmg(100, 1200);
  sk.critRateMult = saved;
  t.near('沒有 critRateMult 就不暴擊', none.mean / base.mean, 1.0, 0.03);
}

/* ---------- 6. 黑暗瞬間（普攻 20% 觸發的物理範圍追擊）---------- */
{
  const g = H.boot();
  H.mkChar(g, AX);
  H.wield(g, 'katar');
  H.learn(g, 'asc_meteorassault');
  t.eq('登記了一筆', g.state.physAoeStrikes.length, 1);
  t.eq('觸發率 20%', g.state.physAoeStrikes[0].chance, 20);
  t.eq('Lv10 是 ATK 1400%', g.SKILLS.asc_meteorassault.mult[9], 14);

  // 打全場：放三隻怪，觸發時三隻都要掉血
  const mkThree = () => {
    const ids = Object.keys(g.MONSTERS).filter(k => !g.MONSTERS[k].isBoss).slice(0, 3);
    g.state.monsters = ids.map((id, i) => {
      g.state.monsterIdCounter = (g.state.monsterIdCounter || 0) + 1;
      return { defId: id, hp: 9e9, maxHp: 9e9, id: g.state.monsterIdCounter };
    });
    return g.state.monsters;
  };
  // 樣本數要夠：400 次的標準差是 2%，配 ±4 的容許值等於 2σ，大約每 20 次會誤報一次。
  const N = 2000;   // sd 0.9%，±4 變成 4σ
  let allHit = 0, tries = 0;
  for (let i = 0; i < N; i++) {
    const ms = mkThree();
    g.state.physAoeReadyAt = {};
    g.tryPhysAoeStrikes(g.MONSTERS[ms[0].defId]);
    const hurt = ms.filter(m => m.hp < m.maxHp).length;
    if (hurt > 0) { tries++; if (hurt === 3) allHit++; }
  }
  t.near('觸發率 20%', tries / N * 100, 20, 4);
  t.eq('觸發時場上每一隻都吃到', allHit, tries);

  // 異常狀態：Lv10 是 55%，三種隨機挑一種
  const seen = {};
  for (let i = 0; i < 600; i++) {
    const ms = mkThree();
    g.state.physAoeReadyAt = {};
    g.state.physAoeStrikes[0].chance = 100;     // 只測異常狀態這一段
    g.tryPhysAoeStrikes(g.MONSTERS[ms[0].defId]);
    ms.forEach(m => (g.ailList(m) || []).forEach(a => { seen[a] = (seen[a] || 0) + 1; }));
  }
  g.state.physAoeStrikes[0].chance = 20;
  const kinds = Object.keys(seen).sort().join(',');
  t.ok('三種異常狀態都出現過', ['bleed', 'blind', 'stun'].every(k => seen[k] > 0), kinds);
}

/* ---------- 7. 技能點溢出：轉生清技能 + 重置砍多餘 ---------- */
{
  // 轉生後技能應該全部清空（以前新手四個技能會留著，導致 11 點無處可花）
  const g = H.boot();
  H.mkChar(g, { path: ['thief', 'assassin'] });
  H.learn(g, 'firstaid');
  g.state.baseLevel = 99; g.state.jobLevel = 50; g.state.gold = 2000000;
  const safe = g.MAPS.filter(m => m.monsters && m.monsters.length === 0)[0];
  g.state.mapId = safe.id;
  t.ok('轉生前有學過技能', Object.keys(g.state.learnedSkills).length > 0);
  t.ok('轉生成功', g.doRebirth());
  const nonQuest = Object.keys(g.state.learnedSkills)
    .filter(id => !(g.SKILLS[id] || {}).isQuest);
  t.eq('轉生後沒有任何非任務技能', nonQuest.length, 0);
  t.eq('新手技能點正好 11', g.state.jobSkillPoints.novice, 11);

  // 11 點 + JOB1→10 的 9 點 = 20 點，剛好點滿新手四個技能且不多不少
  g.state.jobSkillPoints.novice = 20;
  const novice = g.JOB_TREE.novice.skills.filter(s => !s.isQuest);
  novice.forEach(sk => H.learn(g, sk.id));
  t.eq('20 點剛好點滿新手全部技能', g.state.jobSkillPoints.novice, 0);
  t.ok('四個技能都滿級', novice.every(sk => g.state.learnedSkills[sk.id] === sk.maxLv));

  // 重置技能：把「上限之外」的點數砍掉（修舊存檔用）
  g.state.jobLevel = 10;
  g.state.jobSkillPoints.novice += 37;      // 模擬舊 bug 留下的溢出
  g.resetSkills();
  t.eq('重置後回到應得的上限 20', g.state.jobSkillPoints.novice, 20);
  t.eq('earnedSkillPoints 算出 20', g.earnedSkillPoints('novice'), 20);
  t.eq('skillPoints 加總同步', g.state.skillPoints, 20);

  // 不在路線上的殘留池子也要清掉
  g.state.jobSkillPoints.wizard = 99;
  g.resetSkills();
  t.ok('路線外的殘留點數被清除', !g.state.jobSkillPoints.wizard);
}

/* ---------- 8. 回歸：同一隻怪不會被結算兩次 ---------- */
{
  const g = H.boot();
  H.mkChar(g, AX);
  H.wield(g, 'katar');
  const m = H.mon(g, { size: 'medium', isBoss: false });
  const md = g.MONSTERS[m.defId];
  m.hp = 1;
  const expBefore = g.state.baseExp, goldBefore = g.state.gold;
  g.killMonster(md, m);
  const exp1 = g.state.baseExp - expBefore, gold1 = g.state.gold - goldBefore;
  g.killMonster(md, m);                        // 第二次應該完全沒作用
  t.eq('第二次結算不再給經驗', g.state.baseExp - expBefore, exp1);
  t.eq('第二次結算不再給鋅幣', g.state.gold - goldBefore, gold1);
  t.ok('有拿到第一次的獎勵', exp1 > 0);
}

/* ---------- 武器欄位（#116）：拳刃雙手、短劍可雙持 ---------- */
{
  // 十字刺客也能雙持短劍
  const g = H.boot();
  H.mkChar(g, AX);
  g.addItem('knife', 2);
  g.equipItem('knife');
  g.equipItem('knife');
  t.eq('十字刺客可雙持短劍', g.state.equip.shield, 'knife');

  // 拳刃是雙手武器：只能裝一把
  const g2 = H.boot();
  H.mkChar(g2, AX);
  t.ok('拳刃被判定為雙手武器', g2.isTwoHanded('jur'));
  g2.addItem('jur', 2);
  g2.equipItem('jur');
  g2.equipItem('jur');
  t.eq('拳刃不能雙持（左手不佔）', g2.state.equip.shield, null);
  t.ok('拳刃 ASPD 分類仍正確', g2.aspdCategoryOf('jur') === 'katar');
}

process.exit(t.report('十字刺客 5 技能 + 技能點修復'));
