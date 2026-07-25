# RO-Style Leveled Skill System — Design Spec

## [S1] Problem

The current skill system is too simple: each job has 2-3 boolean skills (learned or not), no levels, no depth. The user wants to port the full RO skill system with per-level scaling.

## [S2] Scope

**Phase 1 (this spec):** 1st job only — 6 classes (Swordsman, Mage, Archer, Merchant, Thief, Acolyte), each with 10-15 skills from RO.

**Phase 2 (future):** 2nd job skills (Knight, Wizard, Hunter, Blacksmith, Assassin, Priest).

## [S3] Skill Data Structure

Replace flat skill objects with per-level arrays:

```javascript
{
  id: 'bash', name: '狂擊', maxLv: 10,
  type: 'damage', element: 'neutral',
  spCost:    [8, 8, 8, 8, 8, 15, 15, 15, 15, 15],
  cooldown:  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  mult:      [1.3, 1.6, 1.9, 2.2, 2.5, 2.8, 3.1, 3.4, 3.7, 4.0],
  desc: '單手強力一擊，造成物理傷害。'
}
```

**Supported types:**
- `damage` — physical attack (× ATK)
- `magic` — magical attack (× MATK)
- `heal` — restore HP (× INT+baseLv)
- `heal_over_time` — HoT
- `buff_atk/def/aspd/flee/gold/crit` — temporary stat boost
- `dot` — damage over time
- `passive` — permanent stat bonus (no activation needed)

**`learnedSkills`** changes from `{skillId: true}` to `{skillId: currentLevel}`.

## [S4] Skill Acquisition Rules

Two categories:

| Category | How to learn | Cost | Examples |
|----------|-------------|------|----------|
| **Quest skills** | Auto-learn on job change | Free, fixed Lv1 | Magnum Break, Endure, Sight, Create Arrow, Steal, Detoxify |
| **Normal skills** | Spend skill points | 1 point per level | Bash, Fire Bolt, Double Strafe, Heal |

- All quest skills are unlocked immediately after job change
- No quest completion required (simplified from RO)
- Prerequisite skill levels still apply (e.g., Bash Lv5 required for next-tier skill)

## [S5] Skill Point System

- 1 skill point per job level gained
- **3 bonus skill points on job change**
- Total skill points = jobLevel + 3 (from job change)
- **Free respec** available in Skills tab

## [S6] Skills Per Class (1st Job)

### Swordsman (劍士)
- **Quest skills:** Magnum Break (怒爆), Endure (霸體)
- **Normal skills:** Bash (狂擊) Lv10, Provoke (挑釁) Lv10, Increase HP Recovery (快速恢復) Lv10, Sword Mastery (單手劍熟練度) Lv10, Two-Handed Sword Mastery (雙手劍熟練度) Lv10, Fatal Blow (攻擊弱點), Berserk (狂暴狀態)

### Mage (法師)
- **Quest skills:** Sight (火狩)
- **Normal skills:** Fire Bolt (火箭術) Lv10, Fire Ball (火球術) Lv10, Fire Wall (火焰之壁) Lv10, Lightning Bolt (雷擊術) Lv10, Thunderstorm (雷爆術) Lv10, Cold Bolt (冰箭術) Lv10, Frost Diver (冰凍術) Lv10, Stone Curse (石化術) Lv10, Soul Strike (心靈爆破) Lv10, Napalm Beat (聖靈召喚) Lv10, Safety Wall (暗之障壁) Lv10, Energy Coat (能量外套), Increase SP Recovery (禪心) Lv10

### Archer (弓箭手)
- **Quest skills:** Create Arrow (製作箭)
- **Normal skills:** Owl's Eye (鶚梟之眼) Lv10, Vulture's Eye (蒼鷹之眼) Lv10, Improve Concentration (心神凝聚) Lv10, Double Strafe (二連矢) Lv10, Arrow Shower (箭雨) Lv10, Charge Arrow (衝鋒箭)

### Merchant (商人)
- **Quest skills:** Vending (露天商店), Item Appraisal (物品鑑定), Pushcart (手推車使用) Lv10, Enlarge Weight Limit (負重量上升) Lv10
- **Normal skills:** Discount (低價買進) Lv10, Overcharge (高價賣出) Lv10, Mammonite (金錢攻擊) Lv10, Cart Attack (手推車攻擊), Cart Revolution (改裝手推車), Loud Exclamation (大聲吶喊)

### Thief (盜賊)
- **Quest skills:** Steal (偷竊), Detoxify (解毒), Sandman (噴砂), Back Sliding (後退迴避)
- **Normal skills:** Double Attack (二刀連擊) Lv10, Improve Dodge (殘影) Lv10, Hiding (隱匿) Lv10, Envenom (施毒) Lv10

### Acolyte (服事)
- **Quest skills:** Teleport (瞬間移動), Warp Portal (傳送之陣), Ruwach (光獵), Pneuma (光之障壁), Angelus (天使之障壁) Lv10, Divine Protection (天使之護) Lv10
- **Normal skills:** Heal (治癒術) Lv10, Blessing (加速術) Lv10, Decrease AGI (緩速術) Lv10, Angelic Chant (天使之擊) Lv10, Aqua Benedicta (天使之賜福) Lv10, Signum Crusis (天使之光) Lv10, Cure (天使之淚), Holy Light (神聖之光)

## [S7] Effect Mapping

| Skill Type | Engine Implementation |
|------------|----------------------|
| `damage` | `mult[lv] × ATK` — physical damage formula |
| `magic` | `mult[lv] × MATK` — magical damage formula |
| `heal` | `mult[lv] × (INT + baseLv)` — HP restoration |
| `heal_over_time` | `mult[lv] × (INT + baseLv)` per tick for `duration[lv]` seconds |
| `buff_*` | Push buff with `mult[lv]` for `duration[lv]` seconds |
| `dot` | `mult[lv] × ATK` per tick for `duration[lv]` seconds |
| `passive` | Permanent stat modifier applied in `recomputeDerived()` |

## [S8] UI Changes

1. **Skills tab:** Scrollable list with level display (Lv 0/10), + button to level up, - button to respec individual skill
2. **Respec button:** "重置技能" at top of Skills tab (free)
3. **Skill bar:** Show learned skills with current level badge
4. **Skill tooltips:** Show damage formula, SP cost, cooldown for current level
5. **Quest skills:** Show as "已習得" (learned) with lock icon, no + button

## [S9] Engine Changes

- `learnSkill(skillId)` → `levelUpSkill(skillId)` (increment level)
- `castSkill` uses `sk.mult[state.learnedSkills[skillId]-1]` for level-scaled values
- Passive skills apply in `recomputeDerived()` as permanent multipliers
- `skillPoints` tracks remaining points (total earned - total spent)
- Add `resetSkills()` function to refund all points
- Save/load compatibility: migrate old `learnedSkills` format

## [S10] Data Source

- **Skill names & max levels:** ro.ntome.com/skill (reference site)
- **Per-level values (SP, damage, cooldown):** iRO Wiki (irowiki.org)
- **Fallback:** If exact values unavailable, design reasonable interpolation

## [S11] Testing

1. Create new character, verify 3 bonus skill points on job change
2. Learn each skill type, verify correct damage/heal/buff behavior
3. Test passive skills apply correctly in stat panel
4. Test respec refunds all points correctly
5. Test save/load preserves skill levels
6. Verify quest skills are auto-learned on job change
