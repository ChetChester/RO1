/* 各職業的隊伍效果（#130）。

   機制早就做好了（castSkill → shareBuffsWithAllies），但一年來只有服事線
   七支技能掛著 `party: true`，其他職業一支都沒有——使用者回報「只有祭司
   能放到玩家」就是這個。這支盯的是**旗標有沒有掉**與**分享有沒有真的到位**。

   驗的是行為，不是資料：不逐支斷言「這支要標 party」（那是抄資料檔），
   而是抽幾個代表職業真的雇一個隊友、真的施放、看玩家身上有沒有拿到。 */
const H = require('./harness');
const t = H.tester();

/* 造一組「玩家（騎士）＋一名指定職業的隊友」。
   隊友是從別的存檔格雇來的，所以要先把那一格寫進 localStorage。 */
function party(path, job, gender, lv, rebirth) {
  const g = H.boot();
  H.mkChar(g, { path: ['swordsman', 'knight'], job: 'knight', baseLevel: 90 });
  g.state.name = '主角';
  g.changeMap(g.MAPS.find(m => (m.monsters || []).length === 0).id);   // 安全區才雇得了
  const c = H.boot();
  H.mkChar(c, { path, job, baseLevel: lv || 80, gender: gender || 'male', rebirth: !!rebirth });
  if (c.state.jobId !== job) throw new Error('隊友沒轉成 ' + job + '（實際 ' + c.state.jobId + '）');
  c.state.name = '隊友';
  c.recomputeDerived(true);
  g.localStorage.setItem(g.getSlotKey(1), JSON.stringify(c.state));
  g.state.gold = 1e7;
  if (!g.hireAlly('1')) throw new Error('雇不到隊友');
  return { g, ally: g.state.allies[0] };
}
// 讓隊友學會某招、拿對武器、放出來
function allyCast(g, ally, skillId, lv, weaponCat) {
  let ok = false;
  g.withAlly(ally, () => {
    g.state.learnedSkills = g.state.learnedSkills || {};
    g.state.learnedSkills[skillId] = lv;
    if (weaponCat) {
      const w = Object.keys(g.ITEMS).find(k => g.ITEMS[k].type === 'weapon'
        && g.aspdCategoryOf(k) === weaponCat && !g.equipBlockReason(k));
      if (w) { g.addItem(w, 1); g.equipItem(w); }
    }
    g.state.sp = g.state.maxSp;
    g.state.gold = 1e9;                       // 化學保護那批要鋅幣
    g.recomputeDerived(true);
    ok = g.castSkill(skillId, { free: true, forceLv: lv });
  });
  g.recomputeDerived(false);
  return ok;
}
const hasBuff = (who, id) => (who.buffs || []).some(b => b.skillId === id);

/* ---------- 涵蓋面：不能又縮回只剩服事線 ---------- */
{
  const g = H.boot();
  const jobOf = {};
  Object.values(g.JOB_TREE).forEach(j => (j.skills || []).forEach(sk => { if (!jobOf[sk.id]) jobOf[sk.id] = j.id; }));
  const partySkills = Object.values(g.SKILLS).filter(s => s.party);
  const families = new Set(partySkills.map(s => g.jobLineRoot(jobOf[s.id]) || jobOf[s.id]));
  t.ok('party 技能不只服事線那七支', partySkills.length >= 30, partySkills.length + ' 支');
  t.ok('至少涵蓋五條職業線', families.size >= 5, [...families].join(', '));
  ['swordsman', 'merchant', 'archer', 'mage', 'acolyte'].forEach(root => {
    t.ok(`${root} 線有隊伍技能`, families.has(root));
  });
  /* 標了 party 卻推不出 buff 的話，`shareBuffsWithAllies()` 那條路搬不動它——
     必須在自己的分支裡用 forEachPartyMate() 另外做。目前只有這三支是這種
     （痊癒術清異常、光耀之堂每跳回血、聖音每跳跑祝福），有第四支冒出來就要補程式。 */
  const HAND_WRITTEN = ['strecovery', 'sanctuary', 'pa_gospel'];
  const noBuff = partySkills.filter(s => !/^buff_/.test(s.type || '') && !HAND_WRITTEN.includes(s.id));
  t.eq('不走 buff 的 party 技能都有自己的實作', noBuff.map(s => s.name).join('、'), '');
}

/* ---------- 詩人：演奏給整隊聽 ---------- */
{
  const { g, ally } = party(['archer', 'bard'], 'bard');
  const before = g.effectiveFleeWithBuff();
  t.ok('詩人放得出吹口哨', allyCast(g, ally, 'ba_whistle', 10, 'instrument'));
  t.ok('玩家身上有這首歌', hasBuff(g.state, 'ba_whistle'));
  /* 迴避的 buff 不在 state.flee 裡（見 effectiveFleeWithBuff 的註解），
     所以要驗使用端的數字，驗 state.flee 會永遠看不出差別。 */
  t.ok('玩家的迴避真的變高', g.effectiveFleeWithBuff() > before,
    `${before} → ${g.effectiveFleeWithBuff()}`);

  // 換一首歌：互斥組要在收禮的人身上也生效，不然隊友會兩首歌一起響
  allyCast(g, ally, 'ba_appleidun', 10, 'instrument');
  t.ok('玩家換成了新的那首', hasBuff(g.state, 'ba_appleidun'));
  t.ok('舊的那首被換掉（互斥組有跟上）', !hasBuff(g.state, 'ba_whistle'));
  const songs = new Set(g.state.buffs.filter(b => b.exclusiveGroup === 'song').map(b => b.skillId));
  t.eq('同時只會有一首演奏在身上', songs.size, 1);
}

/* ---------- 舞孃：跟詩人同一套，但要拿鞭子、而且是女性限定 ---------- */
{
  const { g, ally } = party(['archer', 'dancer'], 'dancer', 'female');
  t.eq('舞孃真的轉成功了（性別對）', ally.jobId, 'dancer');
  t.ok('舞孃放得出女神之吻', allyCast(g, ally, 'dc_fortunekiss', 10, 'whip'));
  t.ok('玩家吃得到舞蹈', hasBuff(g.state, 'dc_fortunekiss'));
}

/* ---------- 鐵匠：速度激發只給拿斧／鈍器的人 ---------- */
{
  // 玩家拿鈍器 → 吃得到
  const { g, ally } = party(['merchant', 'blacksmith'], 'blacksmith');
  const mace = Object.keys(g.ITEMS).find(k => g.ITEMS[k].type === 'weapon'
    && g.aspdCategoryOf(k) === 'mace' && !g.equipBlockReason(k));
  g.addItem(mace, 1); g.equipItem(mace); g.recomputeDerived(true);
  const before = g.state.aspd;
  t.ok('鐵匠放得出速度激發', allyCast(g, ally, 'adrenaline', 5, 'mace'));
  t.ok('拿鈍器的玩家吃得到', hasBuff(g.state, 'adrenaline'));
  g.recomputeDerived(true);
  t.ok('攻速真的變快', g.state.aspd > before, `${before} → ${g.state.aspd}`);

  /* 玩家拿長矛 → 吃不到。官方的速度激發只讓隊上拿斧或鈍器的人加速，
     這一條就是 `partyRequiresWeapon` 的驗收：擋的是**收禮的人**，
     施術者那邊本來就被 requiresWeapon 擋過一次了。 */
  const { g: g2, ally: a2 } = party(['merchant', 'blacksmith'], 'blacksmith');
  const spear = Object.keys(g2.ITEMS).find(k => g2.ITEMS[k].type === 'weapon'
    && g2.aspdCategoryOf(k) === 'spear1' && !g2.equipBlockReason(k));
  g2.addItem(spear, 1); g2.equipItem(spear); g2.recomputeDerived(true);
  t.ok('鐵匠一樣放得出來', allyCast(g2, a2, 'adrenaline', 5, 'mace'));
  t.ok('施術者自己有', hasBuff(a2, 'adrenaline'));
  t.ok('拿長矛的玩家吃不到', !hasBuff(g2.state, 'adrenaline'));
}

/* ---------- 鐵匠：無視體型攻擊（官方的武器完全定義）---------- */
{
  const { g, ally } = party(['merchant', 'blacksmith'], 'blacksmith');
  // 玩家拿短劍打大型怪：短劍對大型是 50% 懲罰，最看得出差別
  const dagger = Object.keys(g.ITEMS).find(k => g.ITEMS[k].type === 'weapon'
    && g.aspdCategoryOf(k) === 'dagger' && !g.equipBlockReason(k));
  g.addItem(dagger, 1); g.equipItem(dagger); g.recomputeDerived(true);
  const large = Object.values(g.MONSTERS).find(m => m.size === 'large');
  const before = g.getSizeMultiplier(large);
  t.ok('短劍打大型本來有懲罰', before < 1, '倍率 ' + before);
  t.ok('鐵匠放得出無視體型攻擊', allyCast(g, ally, 'overthrust', 5));
  t.ok('玩家身上有', hasBuff(g.state, 'overthrust'));
  t.eq('體型懲罰被拿掉（補到 1，不是變成加成）', g.getSizeMultiplier(large), 1);
}

/* ---------- 賢者：元素領域也是互斥組 ---------- */
{
  const { g, ally } = party(['mage', 'sage'], 'sage');
  g.addItem('blue_gemstone', 20);
  allyCast(g, ally, 'sa_volcano', 5);
  t.ok('玩家吃得到火元素領域', hasBuff(g.state, 'sa_volcano'));
  allyCast(g, ally, 'sa_deluge', 5);
  t.ok('換成水元素領域', hasBuff(g.state, 'sa_deluge'));
  t.ok('火元素領域被換掉', !hasBuff(g.state, 'sa_volcano'));
}

/* ---------- 鍊金術士：化學保護掛在別人身上 ---------- */
{
  const { g, ally } = party(['merchant', 'alchemist'], 'alchemist');
  allyCast(g, ally, 'am_cp_armor', 5);
  t.ok('玩家吃得到化學鎧甲保護', hasBuff(g.state, 'am_cp_armor'));
}

/* ---------- 十字軍：神祐之光 ---------- */
{
  const { g, ally } = party(['swordsman', 'crusader'], 'crusader');
  allyCast(g, ally, 'cr_providence', 5);
  t.ok('玩家吃得到神祐之光', hasBuff(g.state, 'cr_providence'));
}

/* ---------- 自己的強化不該外流 ---------- */
{
  const { g, ally } = party(['swordsman', 'knight'], 'knight');
  allyCast(g, ally, 'twohandquicken', 10, 'sword2');
  t.ok('隊友自己有雙手劍加速', hasBuff(ally, 'twohandquicken'));
  t.ok('玩家沒有被傳染', !hasBuff(g.state, 'twohandquicken'));
}

/* ---------- 倒地的隊友不收禮 ---------- */
{
  const { g, ally } = party(['archer', 'bard'], 'bard');
  const g2 = g;
  // 再雇一個，讓他倒地
  const c = H.boot();
  H.mkChar(c, { path: ['merchant', 'blacksmith'], job: 'blacksmith', baseLevel: 80 });
  c.state.name = '倒地的'; c.recomputeDerived(true);
  g2.localStorage.setItem(g2.getSlotKey(2), JSON.stringify(c.state));
  g2.state.gold = 1e7;
  t.ok('雇得到第二位', g2.hireAlly('2'));
  const down = g2.state.allies[1];
  down._downed = true;
  down.buffs = [];
  allyCast(g2, ally, 'ba_whistle', 10, 'instrument');
  t.ok('站著的玩家收得到', hasBuff(g2.state, 'ba_whistle'));
  t.ok('倒地的隊友收不到', !hasBuff(down, 'ba_whistle'));
}

/* ---------- 玩家自己放，隊友也要收得到（方向相反的那一半）---------- */
{
  const { g, ally } = party(['merchant', 'blacksmith'], 'blacksmith');
  // 主角改成詩人才唱得了歌
  const g2 = H.boot();
  H.mkChar(g2, { path: ['archer', 'bard'], job: 'bard', baseLevel: 90 });
  g2.changeMap(g2.MAPS.find(m => (m.monsters || []).length === 0).id);
  const c = H.boot();
  H.mkChar(c, { path: ['merchant', 'blacksmith'], job: 'blacksmith', baseLevel: 80 });
  c.state.name = '隊友'; c.recomputeDerived(true);
  g2.localStorage.setItem(g2.getSlotKey(1), JSON.stringify(c.state));
  g2.state.gold = 1e7; g2.hireAlly('1');
  const mate = g2.state.allies[0];
  H.learn(g2, 'ba_whistle', 10);
  const inst = Object.keys(g2.ITEMS).find(k => g2.ITEMS[k].type === 'weapon'
    && g2.aspdCategoryOf(k) === 'instrument' && !g2.equipBlockReason(k));
  g2.addItem(inst, 1); g2.equipItem(inst);
  g2.state.sp = g2.state.maxSp;
  t.ok('玩家自己唱得出來', g2.castSkill('ba_whistle', { free: true, forceLv: 10 }));
  t.ok('隊友收得到玩家唱的歌', hasBuff(mate, 'ba_whistle'));
  t.ok('兩份是不同物件（殘餘時間各自算）',
    g2.state.buffs.find(b => b.skillId === 'ba_whistle')
      !== mate.buffs.find(b => b.skillId === 'ba_whistle'));
}

/* ---------- 不走 buff 的那三支（#131）----------

   痊癒術、光耀之堂、聖音都不是推 buff，所以 `party: true` 那條路搬不動它們，
   是各自用 forEachPartyMate() 換身重跑一次。這一段就是驗那三段有沒有接上。 */
{
  // 痊癒術：清掉隊上每個人的異常狀態
  const { g, ally } = party(['acolyte', 'priest'], 'priest');
  g.state.playerAil = { poison: { until: Date.now() + 99999 } };
  t.ok('玩家先中毒', Object.keys(g.state.playerAil).length > 0);
  allyCast(g, ally, 'strecovery', 1);
  t.eq('隊友的痊癒術清掉了玩家的異常', Object.keys(g.state.playerAil || {}).length, 0);
}
{
  // 光耀之堂：每一跳連隊友一起回
  const { g, ally } = party(['acolyte', 'priest'], 'priest');
  g.state.hp = 1;
  allyCast(g, ally, 'sanctuary', 10);
  const fx = (ally.activeFieldEffects || []).find(f => f.kind === 'selfheal');
  t.ok('場域效果掛在施術者身上', !!fx);
  t.ok('而且標成了 party', !!(fx && fx.party));
  /* 隊友的場域效果以前**完全不會跳**——那段 tick 只長在 gameTick() 裡，
     而 gameTick 只跑玩家那一份。抽成 tickFieldEffects() 之後 alliesTick
     會換身進去跑，這一條驗的就是那個。 */
  g.withAlly(ally, () => { g.tickFieldEffects(); });
  t.ok('玩家被治療到了', g.state.hp > 1, 'HP ' + g.state.hp);
}
{
  // 聖音：每一跳的隨機祝福也要及於隊友
  // 聖殿十字軍是進階二轉，要先轉生才轉得過去
  const { g, ally } = party(['swordsman', 'crusader'], 'paladin', 'male', 90, true);
  t.eq('聖殿十字軍轉得成功', ally.jobId, 'paladin');
  allyCast(g, ally, 'pa_gospel', 10);
  const fx = (ally.activeFieldEffects || []).find(f => f.kind === 'gospel');
  t.ok('聖音掛上了場域效果', !!fx);
  t.ok('而且標成了 party', !!(fx && fx.party));
  /* 祝福是機率觸發的，逐跳驗會 flaky——把機率拉到 100% 再跳一次，
     然後看玩家身上有沒有出現任何一個 pa_gospel 的痕跡（buff 或回血）。 */
  fx.chance = 100;
  g.state.hp = Math.max(1, Math.floor(g.state.maxHp / 2));
  const hp0 = g.state.hp;
  let touched = false;
  for (let i = 0; i < 30 && !touched; i++) {
    fx.nextTickAt = 0;
    g.withAlly(ally, () => { g.tickFieldEffects(); });
    touched = (g.state.buffs || []).some(b => b.skillId === 'pa_gospel') || g.state.hp > hp0;
  }
  t.ok('聖音的祝福有落到玩家身上', touched);
}

process.exit(t.report('各職業的隊伍效果'));
