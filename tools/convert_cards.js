/* ============================================================
   卡片資料轉換工具
   將 ro_cards_data/cards.json 轉換為遊戲 CARDS 格式
   
   使用方式：node tools/convert_cards.js
   輸出：轉換結果顯示在終端，可複製到 data.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

// ---- 讀取原始資料 ----
const rawCards = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'ro_cards_data', 'cards.json'), 'utf8')
);

// ---- 讀取遊戲怪物資料，建立 imgId → monsterId 對照 ----
const monstersRaw = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const imgIdMap = {}; // imgId (number) → monsterId (string)

// 從 MONSTERS 區塊中提取 imgId 對照
const monsterRegex = /(\w+):\s*\{[^}]*imgId:(\d+)[^}]*\}/g;
let m;
while ((m = monsterRegex.exec(monstersRaw)) !== null) {
  const monsterId = m[1];
  const imgId = parseInt(m[2]);
  imgIdMap[imgId] = monsterId;
}

console.log(`已載入 ${Object.keys(imgIdMap).length} 個怪物 imgId 對照\n`);

// ---- 裝備欄位映射 ----
const SLOT_MAP = {
  '武器类': 'weapon',
  '盔甲类': 'armor',
  '盾牌类': 'shield',
  '披肩类': 'garment',
  '鞋子类': 'footgear',
  '头盔类': 'headgear',   // 遊戲目前無頭盔欄位，先標記
  '饰品类': 'accessory',
};

// ---- 屬性解析 ----
function parseAttributes(attrs) {
  const bonus = {};
  const descParts = [];

  for (const attr of attrs) {
    // 跳過欄位標記 [武器类] 等
    if (attr.startsWith('[')) continue;

    // 簡單屬性：STR+1, ATK+10, DEX+1, HIT+3, FLEE+2, CRI+1
    const simpleMatch = attr.match(/^(STR|AGI|VIT|INT|DEX|LUK|ATK|MATK|DEF|HIT|FLEE|CRI)\+(\d+)$/i);
    if (simpleMatch) {
      const stat = simpleMatch[1].toLowerCase();
      const val = parseInt(simpleMatch[2]);
      // 映射到遊戲屬性名
      const statMap = {
        str: 'str', agi: 'agi', vit: 'vit', int: 'int', dex: 'dex', luk: 'luk',
        atk: 'atk', matk: 'matk', def: 'def', hit: 'hit', flee: 'flee', cri: 'critRate'
      };
      const key = statMap[stat] || stat;
      bonus[key] = (bonus[key] || 0) + val;
      descParts.push(`${stat.toUpperCase()}+${val}`);
      continue;
    }

    // HP/SP：MHP+100, MSP+80, MHP+5%
    const hpMatch = attr.match(/^M(?:AX)?HP\+(\d+)(%?)$/i);
    if (hpMatch) {
      const val = parseInt(hpMatch[1]);
      if (hpMatch[2] === '%') {
        bonus.hpPct = (bonus.hpPct || 0) + val;
        descParts.push(`MaxHP +${val}%`);
      } else {
        bonus.hp = (bonus.hp || 0) + val;
        descParts.push(`MaxHP +${val}`);
      }
      continue;
    }
    const spMatch = attr.match(/^M(?:AX)?SP\+(\d+)(%?)$/i);
    if (spMatch) {
      const val = parseInt(spMatch[1]);
      if (spMatch[2] === '%') {
        bonus.spPct = (bonus.spPct || 0) + val;
        descParts.push(`MaxSP +${val}%`);
      } else {
        bonus.sp = (bonus.sp || 0) + val;
        descParts.push(`MaxSP +${val}`);
      }
      continue;
    }

    // 完全回避
    if (attr.includes('完全回避')) {
      const dodgeMatch = attr.match(/(\d+)/);
      if (dodgeMatch) {
        bonus.perfectDodge = (bonus.perfectDodge || 0) + parseInt(dodgeMatch[1]);
        descParts.push(`完全回避+${dodgeMatch[1]}`);
      }
      continue;
    }

    // 屬性傷害增加：对暗属性魔物增加20%的伤害。
    const eleDmgMatch = attr.match(/对(\S+?)属性魔物增加(\d+)%的伤害/);
    if (eleDmgMatch) {
      const ele = eleDmgMatch[1];
      const pct = parseInt(eleDmgMatch[2]);
      const eleMap = {
        '无': 'none', '水': 'water', '地': 'earth', '火': 'fire', '風': 'wind',
        '风': 'wind', '毒': 'poison', '圣': 'holy', '暗': 'shadow', '念': 'ghost', '不死': 'undead'
      };
      const eleKey = eleMap[ele] || ele;
      bonus[`eleDmg_${eleKey}`] = (bonus[`eleDmg_${eleKey}`] || 0) + pct;
      descParts.push(`對${ele}屬性魔物傷害+${pct}%`);
      continue;
    }

    // 攻擊時觸發效果（眩暈、中毒等）— 暫存為文字描述
    if (attr.includes('攻击时') || attr.includes('攻擊時') || attr.includes('几率') || attr.includes('機率')) {
      descParts.push(attr);
      continue;
    }

    // 其他未解析的屬性，保留原文
    if (attr.trim() && attr !== '...') {
      descParts.push(attr);
    }
  }

  return { bonus, desc: descParts.join(', ') || '—' };
}

// ---- 生成卡片 ID ----
function generateCardId(englishName, rawId) {
  // 英文名轉 snake_case，如 Poring_Card → poring_card
  if (englishName) {
    return englishName
      .replace(/[_\s]+/g, '_')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
  // fallback: 用 raw id
  return `card_${rawId}`;
}

// ---- 主轉換邏輯 ----
const converted = [];
const skipped = [];
let stats = { total: 0, withBonus: 0, noMonster: 0, slotTypes: {} };

for (const card of rawCards) {
  stats.total++;

  const { bonus, desc } = parseAttributes(card.attributes || []);
  const slot = SLOT_MAP[card.equip_slot] || 'any';
  const cardId = generateCardId(card.english_name, card.id);

  // 找第一個可對照的怪物
  let monsterId = null;
  if (card.drop_monster_ids && card.drop_monster_ids.length > 0) {
    for (const mid of card.drop_monster_ids) {
      if (imgIdMap[mid]) {
        monsterId = imgIdMap[mid];
        break;
      }
    }
  }

  // 統計
  stats.slotTypes[card.equip_slot] = (stats.slotTypes[card.equip_slot] || 0) + 1;
  if (Object.keys(bonus).length > 0) stats.withBonus++;
  if (!monsterId) stats.noMonster++;

  // 跳過無數值加成且無怪物的卡片（純裝飾/特殊卡片）
  // 但如果有加成就保留
  if (Object.keys(bonus).length === 0 && !monsterId) {
    skipped.push({ id: card.id, name: card.name, reason: '無加成且無怪物' });
    continue;
  }

  // 預設圖標（根據欄位）
  const slotIcons = {
    weapon: '⚔️', armor: '🛡️', shield: '🛡️', garment: '🧣',
    footgear: '👢', headgear: '👑', accessory: '💍', any: '🃏'
  };

  converted.push({
    id: cardId,
    rawId: card.id,
    monsterId: monsterId,
    name: card.name,
    englishName: card.english_name,
    icon: slotIcons[slot] || '🃏',
    slot: slot,
    bonus: bonus,
    desc: desc
  });
}

// ---- 輸出結果 ----
console.log('='.repeat(60));
console.log('轉換完成！');
console.log(`  總計: ${stats.total} 張卡片`);
console.log(`  有加成: ${stats.withBonus} 張`);
console.log(`  無怪物對照: ${stats.noMonster} 張`);
console.log(`  已跳過: ${skipped.length} 張`);
console.log(`  已轉換: ${converted.length} 張`);
console.log('');
console.log('欄位分佈:');
for (const [slot, count] of Object.entries(stats.slotTypes)) {
  console.log(`  ${slot}: ${count}`);
}

// ---- 輸出遊戲格式 ----
console.log('\n' + '='.repeat(60));
console.log('// 複製以下內容到 data.js 的 CARDS 區塊');
console.log('// 格式: cardId: { id, monsterId, name, icon, slot, bonus, desc }');
console.log('');

const gameFormat = {};
for (const c of converted) {
  // 只保留遊戲支援的 bonus keys
  const gameBonus = {};
  const supportedKeys = ['str', 'agi', 'vit', 'int', 'dex', 'luk', 'atk', 'matk', 'def', 'hit', 'flee', 'critRate', 'hp', 'sp', 'perfectDodge'];
  for (const [k, v] of Object.entries(c.bonus)) {
    if (supportedKeys.includes(k)) {
      gameBonus[k] = v;
    }
    // hpPct/spPct 也保留（需要 engine 支援）
    if (k === 'hpPct' || k === 'spPct') {
      gameBonus[k] = v;
    }
    // 屬性傷害加成也保留
    if (k.startsWith('eleDmg_')) {
      gameBonus[k] = v;
    }
  }

  if (Object.keys(gameBonus).length === 0) continue;

  gameFormat[c.id] = {
    id: c.id,
    monsterId: c.monsterId,
    name: c.name,
    icon: c.icon,
    slot: c.slot,
    bonus: gameBonus,
    desc: c.desc
  };
}

// 輸出為 JS 格式
const lines = [];
for (const [id, card] of Object.entries(gameFormat)) {
  const bonusStr = JSON.stringify(card.bonus);
  const monsterStr = card.monsterId ? `'${card.monsterId}'` : 'null';
  lines.push(
    `  ${id}: { id: '${id}', monsterId: ${monsterStr}, name: '${card.name}', icon: '${card.icon}', slot: '${card.slot}', bonus: ${bonusStr}, desc: '${card.desc}' }`
  );
}

console.log(lines.join(',\n'));

// ---- 輸出怪物卡片掉落表 ----
console.log('\n' + '='.repeat(60));
console.log('// MONSTER_CARD_DROPS 格式');
console.log('');

const dropLines = [];
for (const c of converted) {
  if (!c.monsterId) continue;
  // 跳過遊戲中不存在的怪物
  if (!imgIdMap[c.rawId]) continue;
  dropLines.push(`  ${c.monsterId}: { card: '${c.id}', chance: 0.005 }`);
}
console.log(dropLines.join(',\n'));

// ---- 輸出跳過的卡片 ----
if (skipped.length > 0) {
  console.log('\n' + '='.repeat(60));
  console.log(`跳過的卡片 (${skipped.length}):`);
  for (const s of skipped.slice(0, 20)) {
    console.log(`  #${s.id} ${s.name} - ${s.reason}`);
  }
  if (skipped.length > 20) console.log(`  ... 還有 ${skipped.length - 20} 張`);
}

// ---- 輸出需要 engine 支援的新屬性 ----
console.log('\n' + '='.repeat(60));
console.log('需要在 engine.js 中額外支援的屬性:');
const newAttrs = new Set();
for (const c of converted) {
  for (const k of Object.keys(c.bonus)) {
    if (!['str', 'agi', 'vit', 'int', 'dex', 'luk', 'atk', 'matk', 'def', 'hit', 'flee', 'critRate', 'hp', 'sp'].includes(k)) {
      newAttrs.add(k);
    }
  }
}
if (newAttrs.size > 0) {
  for (const a of newAttrs) {
    console.log(`  - ${a}`);
  }
} else {
  console.log('  (無，全部使用現有屬性)');
}
