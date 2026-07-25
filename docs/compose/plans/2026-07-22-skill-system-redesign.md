# RO-Style Leveled Skill System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the full RO 1st-job skill system with per-level scaling (Lv1-10), quest vs normal skill categories, and skill point allocation.

**Architecture:** Redesign `data.js` skill objects to use per-level arrays, update `engine.js` to support leveled skills with `learnedSkills = {id: level}`, and rebuild the skills UI in `ui.js` with level-up/respec controls.

**Tech Stack:** Pure HTML/CSS/JavaScript (no build tools)

## Global Constraints

- ASPD range: 100-193 (unchanged)
- Skill levels: 1-10 per skill
- Quest skills: auto-learned on job change, fixed Lv1, no skill point cost
- Normal skills: 1 skill point per level
- 3 bonus skill points on job change
- Free respec available
- Must maintain save/load compatibility (migrate old format)

---

### Task 1: Redesign Skill Data Structure in `data.js`

**Covers:** [S3, S6]

**Files:**
- Modify: `D:\mimo\ro-idle\js\data.js` (skill objects in JOB_TREE)

**Interfaces:**
- Consumes: 無
- Produces: New skill object format with `maxLv`, per-level arrays, `isQuest` flag

- [x] **Step 1: Define new skill format template**

Replace the existing skill objects in `JOB_TREE.swordsman.skills` with the new format. Here is the complete Swordsman skill set:

```javascript
swordsman: {
  // ... (keep existing job properties)
  skills: [
    // Quest skills (free, fixed Lv1)
    { id: 'magnumbreak', name: '怒爆', maxLv: 1, isQuest: true, type: 'damage', element: 'fire', spCost: [30], cooldown: [10], mult: [1.0], desc: '以火焰之力強力一擊，造成火屬性傷害並擊退敵人。' },
    { id: 'endure', name: '霸體', maxLv: 1, isQuest: true, type: 'buff_def', spCost: [10], cooldown: [10], mult: [1.5], duration: [10], desc: '短時間內不會被擊退，防禦力提升。' },

    // Normal skills (cost skill points, Lv1-10)
    { id: 'bash', name: '狂擊', maxLv: 10, type: 'damage', element: 'neutral',
      spCost:    [8, 8, 8, 8, 8, 15, 15, 15, 15, 15],
      cooldown:  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      mult:      [1.3, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.4, 3.7, 4.0],
      desc: '單手強力一擊，造成物理傷害。有機率使敵人暈眩。' },
    { id: 'provoke', name: '挑釁', maxLv: 10, type: 'debuff_def', element: 'neutral',
      spCost:    [3, 3, 4, 4, 5, 5, 6, 6, 7, 8],
      cooldown:  [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      mult:      [1.02, 1.04, 1.06, 1.08, 1.10, 1.12, 1.14, 1.16, 1.18, 1.20],
      duration:  [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
      desc: '激怒敵人，使其防禦力下降但攻擊力提升。' },
    { id: 'increasehp', name: '快速恢復', maxLv: 10, type: 'passive', passiveStat: 'maxHpMult', element: 'neutral',
      spCost:    [0], cooldown: [0],
      mult:      [1.02, 1.04, 1.06, 1.08, 1.10, 1.12, 1.14, 1.16, 1.18, 1.20],
      desc: '永久提升最大HP。' },
    { id: 'swordmastery', name: '單手劍熟練度', maxLv: 10, type: 'passive', passiveStat: 'atkFlat', element: 'neutral',
      spCost:    [0], cooldown: [0],
      mult:      [4, 8, 12, 16, 20, 24, 28, 32, 36, 40],
      desc: '永久提升單手劍攻擊力。' },
    { id: 'twoswordmastery', name: '雙手劍熟練度', maxLv: 10, type: 'passive', passiveStat: 'atkFlat', element: 'neutral',
      spCost:    [0], cooldown: [0],
      mult:      [4, 8, 12, 16, 20, 24, 28, 32, 36, 40],
      desc: '永久提升雙手劍攻擊力。' },
    { id: 'fatalblow', name: '攻擊弱點', maxLv: 5, type: 'passive', passiveStat: 'critRate', element: 'neutral',
      spCost:    [0], cooldown: [0],
      mult:      [1, 2, 3, 4, 5],
      desc: '永久提升暴擊率。' },
    { id: 'berserk', name: '狂暴狀態', maxLv: 1, isQuest: true, type: 'buff_atk', spCost: [0], cooldown: [120], mult: [2.0], duration: [15], desc: '進入狂暴狀態，攻擊力大幅提升但防禦力下降。' },
  ],
  desc: '以劍與盾為伴的近戰戰士，堅韌不拔。'
},
```

- [x] **Step 2: Apply same format to all 6 classes**

Apply the same pattern to `mage`, `archer`, `merchant`, `thief`, `acolyte` in `data.js`. Each class gets its full RO 1st-job skill set with per-level arrays. Keep existing quest skills marked as `isQuest: true` with `maxLv: 1`.

For classes not yet modified, here is the Mage skill set as an example:

```javascript
mage: {
  // ... (keep existing job properties)
  skills: [
    // Quest skills
    { id: 'sight', name: '火狩', maxLv: 1, isQuest: true, type: 'reveal', spCost: [0], cooldown: [0], mult: [1], desc: '顯示隱形的敵人。' },
    // Normal skills
    { id: 'firebolt', name: '火箭術', maxLv: 10, type: 'magic', element: 'fire',
      spCost:    [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
      cooldown:  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      mult:      [1.0, 1.3, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.4, 3.7],
      desc: '發射火箭，造成火屬性魔法傷害。' },
    { id: 'fireball', name: '火球術', maxLv: 10, type: 'magic', element: 'fire',
      spCost:    [25, 25, 25, 25, 25, 25, 25, 25, 25, 25],
      cooldown:  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      mult:      [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9],
      desc: '投擲火球，造成火屬性範圍魔法傷害。' },
    { id: 'firewall', name: '火焰之壁', maxLv: 10, type: 'dot', element: 'fire',
      spCost:    [40, 40, 40, 40, 40, 40, 40, 40, 40, 40],
      cooldown:  [15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
      mult:      [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4],
      duration:  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      desc: '創造一道火焰之牆，對經過的敵人造成持續火屬性傷害。' },
    { id: 'lightningbolt', name: '雷擊術', maxLv: 10, type: 'magic', element: 'wind',
      spCost:    [24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
      cooldown:  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      mult:      [1.0, 1.3, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.4, 3.7],
      desc: '召喚雷電，造成風屬性魔法傷害。' },
    { id: 'thunderstorm', name: '雷爆術', maxLv: 10, type: 'magic', element: 'wind',
      spCost:    [34, 36, 38, 40, 42, 44, 46, 48, 50, 52],
      cooldown:  [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      mult:      [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8],
      desc: '從天空降下雷電，造成風屬性範圍魔法傷害。' },
    { id: 'coldbolt', name: '冰箭術', maxLv: 10, type: 'magic', element: 'water',
      spCost:    [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
      cooldown:  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      mult:      [1.0, 1.3, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.4, 3.7],
      desc: '發射冰箭，造成水屬性魔法傷害。' },
    { id: 'frostdiver', name: '冰凍術', maxLv: 10, type: 'magic', element: 'water',
      spCost:    [35, 35, 35, 35, 35, 35, 35, 35, 35, 35],
      cooldown:  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      mult:      [1.0, 1.3, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.4, 3.7],
      desc: '造成水屬性魔法傷害，有機率冰凍敵人。' },
    { id: 'stonecurse', name: '石化術', maxLv: 10, type: 'debuff', element: 'earth',
      spCost:    [24, 24, 24, 24, 24, 24, 24, 24, 24, 24],
      cooldown:  [15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
      mult:      [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65],
      duration:  [8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      desc: '嘗試將敵人石化，使其無法行動。' },
    { id: 'soulstrike', name: '心靈爆破', maxLv: 10, type: 'magic', element: 'neutral',
      spCost:    [10, 10, 12, 12, 14, 14, 16, 16, 18, 18],
      cooldown:  [2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
      mult:      [1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8],
      desc: '用念力攻擊敵人，無視部分魔防。' },
    { id: 'napalmbeat', name: '聖靈召喚', maxLv: 10, type: 'magic', element: 'shadow',
      spCost:    [8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
      cooldown:  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      mult:      [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7],
      desc: '召喚聖靈進行攻擊，造成暗屬性魔法傷害。' },
    { id: 'safetywall', name: '安全壁障', maxLv: 10, type: 'buff_def', spCost: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30], cooldown: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], mult: [1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4], duration: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10], desc: '創造一道安全壁障，大幅提升防禦力。' },
    { id: 'energycoat', name: '能量外套', maxLv: 1, type: 'buff_def', spCost: [100], cooldown: [300], mult: [2.0], duration: [60], desc: '消耗大量SP，大幅提升防禦力。' },
    { id: 'spregen', name: '禪心', maxLv: 10, type: 'passive', passiveStat: 'spRegen', spCost: [0], cooldown: [0], mult: [1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0], desc: '永久提升SP自然回復速度。' },
  ],
  desc: '操控元素之力的智慧使者，SP 是最強武器。'
},
```

- [ ] **Step 3: Verify data structure**

Open browser console, check `JOB_TREE.swordsman.skills[2].mult` is an array of 10 values, and `JOB_TREE.swordsman.skills[0].isQuest` is `true`.

- [ ] **Step 4: Commit**

```bash
git add js/data.js
git commit -m "feat: redesign skill data structure with per-level arrays for all 1st job classes"
```

---

### Task 2: Update Engine Skill Functions

**Covers:** [S4, S5, S7, S9]

**Files:**
- Modify: `D:\mimo\ro-idle\js\engine.js`

**Interfaces:**
- Consumes: `JOB_TREE` (new skill format), `state.learnedSkills`, `state.skillPoints`
- Produces: `levelUpSkill()`, `resetSkills()`, updated `castSkill()`, updated `tryAutoCastSkill()`

- [ ] **Step 1: Add `levelUpSkill` function (replaces `learnSkill`)**

Replace the existing `learnSkill` function (lines 437-448) with:

```javascript
function levelUpSkill(skillId) {
  const job = currentJob();
  const sk = job.skills.find(s => s.id === skillId);
  if (!sk) return false;
  if (sk.isQuest) return false; // quest skills can't be leveled
  const currentLv = state.learnedSkills[skillId] || 0;
  if (currentLv >= sk.maxLv) return false;
  if (state.skillPoints <= 0) return false;

  state.learnedSkills[skillId] = currentLv + 1;
  state.skillPoints--;
  logMsg(`${sk.name} 升級至 Lv${currentLv + 1}！`);
  recomputeDerived(true);
  saveGame();
  return true;
}
```

- [ ] **Step 2: Add `resetSkills` function**

Add after `levelUpSkill`:

```javascript
function resetSkills() {
  const job = currentJob();
  let totalSpent = 0;
  job.skills.forEach(sk => {
    const lv = state.learnedSkills[sk.id] || 0;
    if (!sk.isQuest && lv > 0) {
      totalSpent += lv;
      delete state.learnedSkills[sk.id];
    }
  });
  state.skillPoints += totalSpent;
  logMsg(`技能已重置，返還 ${totalSpent} 點技能點。`);
  recomputeDerived(true);
  saveGame();
}
```

- [ ] **Step 3: Update `castSkill` for level-scaled values**

Replace the existing `castSkill` function (lines 454-508) with:

```javascript
function castSkill(skillId) {
  const job = currentJob();
  const sk = job.skills.find(s => s.id === skillId);
  if (!sk) return false;
  const lv = state.learnedSkills[skillId];
  if (!lv) return false;
  if (!skillReady(skillId)) return false;

  const spCost = Array.isArray(sk.spCost) ? sk.spCost[lv - 1] : sk.spCost;
  if (state.sp < spCost) return false;

  const isHeal = sk.type === 'heal' || sk.type === 'heal_over_time';
  if (!isHeal && !['buff_atk', 'buff_def', 'buff_aspd', 'buff_flee', 'buff_gold', 'buff_crit', 'debuff_def', 'debuff'].includes(sk.type) && !state.monster) return false;

  state.sp -= spCost;
  const cd = Array.isArray(sk.cooldown) ? sk.cooldown[lv - 1] : sk.cooldown;
  state.cooldowns[skillId] = cd * 1000;

  const mult = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
  const useMag = sk.type === 'magic';
  const baseDmgStat = useMag ? state.matk : state.atk;

  switch (sk.type) {
    case 'damage':
    case 'magic': {
      if (!state.monster) break;
      const def = MONSTERS[state.monster.defId];
      const dmg = mitigateDamage(baseDmgStat * mult, def.def);
      state.monster.hp -= dmg;
      logMsg(`⚡ 「${sk.name}」Lv${lv} 造成 ${dmg} 點傷害！`);
      if (state.monster.hp <= 0) killMonster(def);
      break;
    }
    case 'dot': {
      if (!state.monster) break;
      const def = MONSTERS[state.monster.defId];
      const dmg = mitigateDamage(baseDmgStat * mult, def.def * 0.6);
      state.monster.hp -= dmg;
      logMsg(`☠️ 「${sk.name}」Lv${lv} 造成 ${dmg} 點持續傷害！`);
      if (state.monster.hp <= 0) killMonster(def);
      break;
    }
    case 'heal': {
      const amt = Math.round((state.int + state.baseLevel) * mult);
      state.hp = Math.min(state.maxHp, state.hp + amt);
      logMsg(`💚 「${sk.name}」Lv${lv} 恢復了 ${amt} 點HP。`);
      break;
    }
    case 'heal_over_time': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      const amt = Math.round((state.int + state.baseLevel) * mult);
      state.hp = Math.min(state.maxHp, state.hp + amt);
      logMsg(`💫 「${sk.name}」Lv${lv} 持續恢復HP。`);
      break;
    }
    case 'buff_def': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'def', mult, msRemaining: dur * 1000 });
      logMsg(`🛡️ 「${sk.name}」Lv${lv} 發動，防禦力上升！`);
      break;
    }
    case 'buff_atk': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'atk', mult, msRemaining: dur * 1000 });
      logMsg(`💪 「${sk.name}」Lv${lv} 發動，攻擊力上升！`);
      break;
    }
    case 'buff_aspd': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'aspd', mult, msRemaining: dur * 1000 });
      logMsg(`💨 「${sk.name}」Lv${lv} 發動，攻速上升！`);
      break;
    }
    case 'buff_flee': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'flee', mult, msRemaining: dur * 1000 });
      logMsg(`🌫️ 「${sk.name}」Lv${lv} 發動，迴避上升！`);
      break;
    }
    case 'buff_gold': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'gold', mult, msRemaining: dur * 1000 });
      logMsg(`💰 「${sk.name}」Lv${lv} 發動，掉錢增加！`);
      break;
    }
    case 'buff_crit': {
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.buffs.push({ type: 'crit', mult, msRemaining: dur * 1000 });
      logMsg(`🎯 「${sk.name}」Lv${lv} 發動，暴擊率上升！`);
      break;
    }
    case 'debuff_def': {
      if (!state.monster) break;
      const dur = Array.isArray(sk.duration) ? sk.duration[lv - 1] : sk.duration;
      state.monster.debuffDef = mult;
      state.monster.debuffDefEnd = Date.now() + dur * 1000;
      logMsg(`🔥 「${sk.name}」Lv${lv} 發動，敵人防禦下降！`);
      break;
    }
  }
  saveGame();
  return true;
}
```

- [ ] **Step 4: Update `tryAutoCastSkill` for level-scaled values**

Replace the existing `tryAutoCastSkill` (lines 510-520) with:

```javascript
function tryAutoCastSkill() {
  const job = currentJob();
  for (const sk of job.skills) {
    const lv = state.learnedSkills[sk.id];
    if (!lv) continue;
    if (!skillReady(sk.id)) continue;
    const spCost = Array.isArray(sk.spCost) ? sk.spCost[lv - 1] : sk.spCost;
    if (state.sp < spCost) continue;
    if (sk.type === 'heal' && state.hp > state.maxHp * 0.7) continue;
    if (['damage', 'magic', 'dot'].includes(sk.type) && !state.monster) continue;
    if (['buff_atk', 'buff_def', 'buff_aspd', 'buff_flee', 'buff_gold', 'buff_crit', 'debuff_def', 'debuff'].includes(sk.type)) {
      // don't re-cast if already buffed
      if (state.buffs.some(b => b.type === sk.type.replace('buff_', '').replace('debuff_', ''))) continue;
    }
    castSkill(sk.id);
    break;
  }
}
```

- [ ] **Step 5: Update `doJobChange` to grant 3 bonus skill points**

Modify the `doJobChange` function (lines 530-540):

```javascript
function doJobChange(targetId) {
  if (!canJobChange(targetId)) return false;
  const target = JOB_TREE[targetId];
  state.jobId = targetId;
  state.jobLevel = 1;
  state.jobExp = 0;
  state.skillPoints += 3; // bonus skill points on job change

  // Auto-learn quest skills for new job
  target.skills.forEach(sk => {
    if (sk.isQuest && !state.learnedSkills[sk.id]) {
      state.learnedSkills[sk.id] = 1;
      logMsg(`自動習得任務技能：${sk.name}！`);
    }
  });

  recomputeDerived(true);
  logMsg(`🎊 恭喜！你轉職成為「${target.icon} ${target.name}」！獲得 3 點技能點！`);
  saveGame();
  return true;
}
```

- [ ] **Step 6: Add passive skill support in `recomputeDerived`**

Find the `recomputeDerived` function and add passive skill calculations after stat computation:

```javascript
// After existing stat calculations, before return:
// Passive skill bonuses
const job = currentJob();
job.skills.forEach(sk => {
  const lv = state.learnedSkills[sk.id];
  if (!lv || sk.type !== 'passive') return;
  const val = Array.isArray(sk.mult) ? sk.mult[lv - 1] : sk.mult;
  switch (sk.passiveStat) {
    case 'atkFlat': state.atk += Math.round(val); break;
    case 'matkFlat': state.matk += Math.round(val); break;
    case 'maxHpMult': state.maxHp = Math.round(state.maxHp * val); break;
    case 'maxSpMult': state.maxSp = Math.round(state.maxSp * val); break;
    case 'critRate': state.critRate += val; break;
    case 'hitFlat': state.hit += Math.round(val); break;
    case 'fleeFlat': state.flee += Math.round(val); break;
    case 'spRegen': state.spRegen = (state.spRegen || 1) * val; break;
  }
});
```

- [ ] **Step 7: Update save/load migration**

In the `loadGame` function (around line 621), add migration for old skill format:

```javascript
// Migration: convert old boolean learnedSkills to level format
if (state.learnedSkills) {
  Object.keys(state.learnedSkills).forEach(k => {
    if (state.learnedSkills[k] === true) {
      state.learnedSkills[k] = 1; // convert boolean to level 1
    }
  });
}
```

- [ ] **Step 8: Commit**

```bash
git add js/engine.js
git commit -m "feat: update engine for leveled skill system with quest/normal categories"
```

---

### Task 3: Rebuild Skills UI

**Covers:** [S8]

**Files:**
- Modify: `D:\mimo\ro-idle\js\ui.js` (renderSkillsTab, renderSkillBar)
- Modify: `D:\mimo\ro-idle\css\style.css` (skill list styles)

**Interfaces:**
- Consumes: `JOB_TREE` (new skill format), `state.learnedSkills`, `state.skillPoints`, `levelUpSkill()`, `resetSkills()`
- Produces: Updated skills tab with level display, + / - buttons, respec button

- [ ] **Step 1: Rewrite `renderSkillsTab`**

Replace the existing `renderSkillsTab` function (lines 220-234) with:

```javascript
function renderSkillsTab() {
  const job = currentJob();
  const el = document.getElementById('tab-skills');

  let html = `<div class="skills-header">
    <h3 class="panel-title">技能點：${state.skillPoints}</h3>
    <button class="btn-small btn-respec" onclick="if(confirm('確定要重置所有技能嗎？')){resetSkills();renderSkillsTab();}">重置技能</button>
  </div>`;

  html += '<div class="skill-list">';

  if (!job.skills.length) {
    html += '<div class="empty-hint">新手尚無技能，轉職後即可習得專屬技能。</div>';
  } else {
    job.skills.forEach(sk => {
      const lv = state.learnedSkills[sk.id] || 0;
      const isQuest = sk.isQuest;
      const isMaxed = lv >= sk.maxLv;
      const canLevelUp = !isQuest && !isMaxed && state.skillPoints > 0;

      // Get current level stats
      const spCost = Array.isArray(sk.spCost) ? sk.spCost[Math.max(0, lv - 1)] : sk.spCost;
      const cd = Array.isArray(sk.cooldown) ? sk.cooldown[Math.max(0, lv - 1)] : sk.cooldown;
      const multVal = Array.isArray(sk.mult) ? sk.mult[Math.max(0, lv - 1)] : sk.mult;

      let statusTag = '';
      if (isQuest) {
        statusTag = '<span class="skill-tag quest">任務技能</span>';
      } else if (isMaxed) {
        statusTag = '<span class="skill-tag maxed">MAX</span>';
      } else if (lv > 0) {
        statusTag = `<span class="skill-tag">Lv${lv}/${sk.maxLv}</span>`;
      } else {
        statusTag = '<span class="skill-tag unlearned">未習得</span>';
      }

      html += `<div class="skill-row ${lv > 0 ? 'learned' : ''}">
        <div class="skill-info">
          <div class="skill-name">${sk.name} ${statusTag}</div>
          <div class="skill-desc">${sk.desc}</div>
          <div class="skill-cost">SP ${spCost} ・ 冷卻 ${cd}s</div>
        </div>
        ${isQuest ? '' : `<div class="skill-actions">
          <button class="btn-small btn-levelup" ${canLevelUp ? '' : 'disabled'}
            onclick="levelUpSkill('${sk.id}');renderSkillsTab();renderSkillBar();">+</button>
        </div>`}
      </div>`;
    });
  }

  html += '</div>';
  el.innerHTML = html;
}
```

- [ ] **Step 2: Update `renderSkillBar` for level display**

Replace the existing `renderSkillBar` (lines 236-251) with:

```javascript
function renderSkillBar() {
  const job = currentJob();
  const bar = document.getElementById('skill-bar');
  const learned = job.skills.filter(s => state.learnedSkills[s.id] && s.type !== 'passive' && !s.isQuest);
  if (!learned.length) { bar.innerHTML = ''; return; }
  bar.innerHTML = learned.map(sk => {
    const lv = state.learnedSkills[sk.id];
    const ready = skillReady(sk.id);
    const spCost = Array.isArray(sk.spCost) ? sk.spCost[lv - 1] : sk.spCost;
    const enoughSp = state.sp >= spCost;
    const cdSec = state.cooldowns[sk.id] ? Math.ceil(state.cooldowns[sk.id] / 1000) : 0;
    return `<button class="skill-btn" title="${sk.desc}" ${(!ready || !enoughSp) ? 'disabled' : ''} onclick="castSkill('${sk.id}')">
      <span class="skill-btn-name">${sk.name}</span>
      <span class="skill-btn-lv">Lv${lv}</span>
      <span class="skill-btn-cost">${spCost} SP</span>
      ${cdSec > 0 ? `<span class="skill-btn-cd">${cdSec}</span>` : ''}
    </button>`;
  }).join('');
}
```

- [ ] **Step 3: Add CSS styles for new skill UI**

Add to `D:\mimo\ro-idle\css\style.css`:

```css
/* Skills tab */
.skills-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.btn-respec { background: var(--crimson); color: #fff; font-size: 0.7rem; padding: 2px 8px; }
.skill-tag { font-size: 0.65rem; padding: 1px 5px; border-radius: 3px; margin-left: 6px; }
.skill-tag.quest { background: var(--gold); color: var(--bg-deep); }
.skill-tag.maxed { background: var(--teal); color: #fff; }
.skill-tag.unlearned { background: var(--ink-dim); color: var(--bg-deep); }
.skill-actions { display: flex; align-items: center; gap: 4px; }
.btn-levelup { width: 28px; height: 28px; font-size: 1rem; font-weight: 700; padding: 0; }
.btn-levelup:disabled { opacity: 0.3; }
.skill-btn-lv { font-size: 0.6rem; color: var(--gold); margin-left: 2px; }
```

- [ ] **Step 4: Verify UI**

Open browser, navigate to Skills tab, verify:
- Skills show with level display (Lv 0/10 or "任務技能")
- + button works to level up skills
- Respec button works
- Skill bar shows level badge

- [ ] **Step 5: Commit**

```bash
git add js/ui.js css/style.css
git commit -m "feat: rebuild skills UI with level display and respec"
```

---

### Task 4: Update Existing Save Data & Test Full Flow

**Covers:** [S9, S11]

**Files:**
- Modify: `D:\mimo\ro-idle\js\engine.js` (minor fixes)
- Modify: `D:\mimo\ro-idle\js\data.js` (verify all classes)

**Interfaces:**
- Consumes: All previous tasks
- Produces: Working end-to-end skill system

- [ ] **Step 1: Verify old save migration**

1. Open browser with existing save data
2. Check console: `state.learnedSkills` should show levels (1) not booleans (true)
3. Verify old skills still work

- [ ] **Step 2: Test new character flow**

1. Create new character as Swordsman
2. Verify 3 bonus skill points on job change
3. Verify quest skills (怒爆, 霸體, 狂暴狀態) are auto-learned
4. Spend skill points to level up Bash to Lv5
5. Verify damage scales with level
6. Verify save/load preserves skill levels

- [ ] **Step 3: Test all 6 classes**

For each class (Swordsman, Mage, Archer, Merchant, Thief, Acolyte):
1. Create new character or job-change to class
2. Verify quest skills are auto-learned
3. Level up 1-2 normal skills
4. Verify skills work in combat

- [ ] **Step 4: Test respec**

1. Learn several skills
2. Click "重置技能"
3. Confirm dialog
4. Verify all points refunded, skills reset to 0

- [ ] **Step 5: Test passive skills**

1. As Swordsman, learn 單手劍熟練度 Lv5
2. Check ATK in stat panel increases by 20
3. Learn 快速恢復 Lv3
4. Check maxHP increases by 6%

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: complete 1st job leveled skill system with RO skill port"
```
