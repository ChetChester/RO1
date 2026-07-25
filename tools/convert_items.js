/* ============================================================
   裝備道具資料轉換工具
   將 ro_items_data/items.json 轉換為遊戲 ITEMS 格式
   
   使用方式：node tools/convert_items.js
   輸出：js/items_generated.js
   ============================================================ */

const fs = require('fs');
const path = require('path');

// ---- 讀取原始資料 ----
const rawItems = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'ro_items_data', 'items.json'), 'utf8')
);
console.log(`已載入 ${rawItems.length} 個原始物品`);

// ---- 讀取遊戲怪物資料，建立 imgId → monsterId 對照 ----
const monstersRaw = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const imgIdMap = {};
const monsterRegex = /(\w+):\s*\{[^}]*imgId:(\d+)[^}]*\}/g;
let m;
while ((m = monsterRegex.exec(monstersRaw)) !== null) {
  imgIdMap[parseInt(m[2])] = m[1];
}
console.log(`已載入 ${Object.keys(imgIdMap).length} 個怪物 imgId 對照`);

// ---- 武器類型映射 ----
const WEAPON_TYPE_MAP = {
  '短剑': 'dagger', '剑': 'sword', '双手剑': 'tsword',
  '弓': 'bow', '法杖': 'rod', '杖': 'rod',
  '斧': 'mace', '单手斧': 'mace', '双手斧': 'tsword',
  '锤': 'mace', '钝器': 'mace', '单手锤': 'mace',
  '矛': 'spear', '枪': 'spear', '长矛': 'spear',
  '拳套': 'knuckle', '爪': 'knuckle',
  '书籍': 'rod', '鞭': 'bow', '乐器': 'bow',
  '匕首': 'dagger',
};

// ---- 防具類型映射 ----
const ARMOR_TYPE_MAP = {
  '盔甲': 'leather', '铠甲': 'leather', '衣服': 'cloth', '布甲': 'cloth',
  '盾': 'shield', '盾牌': 'shield',
  '披肩': 'garment', '斗篷': 'garment', '披风': 'garment',
  '鞋子': 'footgear', '靴': 'footgear', '靴子': 'footgear',
  '头盔': 'headgear', '头饰': 'headgear',
  '饰品': 'accessory', '戒': 'accessory', '项链': 'accessory',
};

// ---- 屬性映射 ----
const ELEMENT_MAP = {
  '无': 'none', '水': 'water', '地': 'earth', '火': 'fire', '風': 'wind',
  '风': 'wind', '毒': 'poison', '圣': 'holy', '暗': 'shadow',
  '念': 'ghost', '不死': 'undead', '黑暗': 'shadow',
};

// ---- 職業映射 ----
const JOB_MAP = {
  '初学者': 'novice', '剑士': 'swordsman', '魔法师': 'mage',
  '弓箭手': 'archer', '商人': 'merchant', '盗贼': 'thief',
  '服事': 'acolyte', '悟灵士': 'acolyte', '忍者': 'thief',
  '骑士': 'knight', '巫师': 'mage', '猎人': 'archer',
  '铁匠': 'merchant', '刺客': 'thief', '祭司': 'acolyte',
  '流氓': 'thief', '炼金术师': 'merchant', '神工匠': 'merchant',
  '诗人': 'acolyte', '舞娘': 'dancer',
};

// ---- 從名稱提取裝備欄位 ----
function getEquipSlot(name) {
  if (name.includes('盾')) return 'shield';
  if (name.includes('披肩') || name.includes('斗篷') || name.includes('披风')) return 'garment';
  if (name.includes('鞋子') || name.includes('靴')) return 'footgear';
  if (name.includes('头盔') || name.includes('头饰') || name.includes('冠')) return 'headgear';
  if (name.includes('戒') || name.includes('项链') || name.includes('耳环')) return 'accessory';
  return null;
}

// ---- 解析描述中的數值 ----
function parseDescription(desc) {
  if (!desc) return {};
  const stats = {};
  
  // 移除 HTML 標籤，保留文字
  const text = desc.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  
  // 攻擊力
  const atkMatch = text.match(/攻击[:：]\s*(\d+)/);
  if (atkMatch) stats.atk = parseInt(atkMatch[1]);
  
  // 防禦力
  const defMatch = text.match(/防御[:：]\s*(\d+)/);
  if (defMatch) stats.def = parseInt(defMatch[1]);
  
  // 魔法攻擊
  const matkMatch = text.match(/MATK[+:：]\s*(\d+)/i);
  if (matkMatch) stats.matk = parseInt(matkMatch[1]);
  
  // 屬性
  const eleMatch = text.match(/属性[:：]\s*(\S+)/);
  if (eleMatch) {
    const ele = eleMatch[1].trim();
    if (ELEMENT_MAP[ele]) stats.element = ELEMENT_MAP[ele];
  }
  
  // 武器類型
  const seriesMatch = text.match(/系列[:：]\s*(\S+)/);
  if (seriesMatch) {
    const series = seriesMatch[1].trim();
    if (WEAPON_TYPE_MAP[series]) {
      stats.weaponType = WEAPON_TYPE_MAP[series];
      stats.type = 'weapon';
    } else if (ARMOR_TYPE_MAP[series]) {
      stats.armorType = ARMOR_TYPE_MAP[series];
      stats.type = 'armor';
    }
  }
  
  // 重量
  const weightMatch = text.match(/重量[:：]\s*(\d+)/);
  if (weightMatch) stats.weight = parseInt(weightMatch[1]);
  
  // 要求等級
  const reqLevelMatch = text.match(/要求等级[:：]\s*(\d+|无|没有)/);
  if (reqLevelMatch && reqLevelMatch[1] !== '无' && reqLevelMatch[1] !== '没有') {
    stats.reqLevel = parseInt(reqLevelMatch[1]);
  }
  
  // 武器等級
  const weaponLvMatch = text.match(/武器等级[:：]\s*(\d+)/);
  if (weaponLvMatch) stats.weaponLv = parseInt(weaponLvMatch[1]);
  
  // 裝備限制
  const equipMatch = text.match(/装备[:：]\s*([^<]+)/);
  if (equipMatch) {
    stats.equipRestrict = equipMatch[1].trim();
  }
  
  // 六圍加成
  const statPatterns = [
    { regex: /STR[+:：]\s*(\d+)/i, key: 'str' },
    { regex: /AGI[+:：]\s*(\d+)/i, key: 'agi' },
    { regex: /VIT[+:：]\s*(\d+)/i, key: 'vit' },
    { regex: /INT[+:：]\s*(\d+)/i, key: 'int' },
    { regex: /DEX[+:：]\s*(\d+)/i, key: 'dex' },
    { regex: /LUK[+:：]\s*(\d+)/i, key: 'luk' },
  ];
  for (const { regex, key } of statPatterns) {
    const match = text.match(regex);
    if (match) stats[key] = parseInt(match[1]);
  }
  
  // All State
  const allStateMatch = text.match(/All State[+:：]\s*(\d+)/i);
  if (allStateMatch) {
    const val = parseInt(allStateMatch[1]);
    stats.str = (stats.str || 0) + val;
    stats.agi = (stats.agi || 0) + val;
    stats.vit = (stats.vit || 0) + val;
    stats.int = (stats.int || 0) + val;
    stats.dex = (stats.dex || 0) + val;
    stats.luk = (stats.luk || 0) + val;
  }
  
  // HIT / FLEE / CRI
  const hitMatch = text.match(/HIT[+:：]\s*(\d+)/i);
  if (hitMatch) stats.hit = parseInt(hitMatch[1]);
  const fleeMatch = text.match(/FLEE[+:：]\s*(\d+)/i);
  if (fleeMatch) stats.flee = parseInt(fleeMatch[1]);
  const criMatch = text.match(/CRI[+:：]\s*(\d+)/i);
  if (criMatch) stats.critRate = parseInt(criMatch[1]);
  
  // HP / SP
  const hpMatch = text.match(/MAXHP[上升增加+：:]+\s*(\d+)/i);
  if (hpMatch) stats.hp = parseInt(hpMatch[1]);
  const spMatch = text.match(/MAXSP[上升增加+：:]+\s*(\d+)/i);
  if (spMatch) stats.sp = parseInt(spMatch[1]);
  
  // 完全回避
  const pdMatch = text.match(/完全回避[+：:]\s*(\d+)/);
  if (pdMatch) stats.perfectDodge = parseInt(pdMatch[1]);
  
  // 回復量（藥水）
  const healMatch = text.match(/恢复(\d+)点HP/);
  if (healMatch) stats.heal = parseInt(healMatch[1]);
  const spHealMatch = text.match(/恢复(\d+)点SP/);
  if (spHealMatch) stats.restoreSp = parseInt(spHealMatch[1]);
  
  return stats;
}

// ---- 生成物品 ID ----
function generateItemId(englishName, rawId, name) {
  let id;
  if (englishName) {
    id = englishName
      .replace(/[_\s]+/g, '_')
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  } else {
    // fallback: 用中文名拼音或 id
    id = `item_${rawId}`;
  }
  // 以數字開頭的 ID 加前綴（JS 屬性名不能以數字開頭）
  if (/^\d/.test(id)) {
    id = 'item_' + id;
  }
  return id;
}

// ---- 判斷物品類型 ----
function getItemType(item, parsed) {
  if (parsed.type === 'weapon') return 'weapon';
  if (parsed.type === 'armor') return 'armor';
  
  const name = item.name || '';
  const desc = item.description || '';
  
  // 藥水
  if (desc.includes('恢复') && desc.includes('HP')) return 'consumable';
  if (desc.includes('恢复') && desc.includes('SP')) return 'consumable';
  if (name.includes('药水') || name.includes('藥水')) return 'consumable';
  
  // 材料
  if (item.id >= 700 && item.id < 1000) return 'material';
  if (item.id >= 900 && item.id < 1000) return 'material';
  if (desc.includes('重量:') && !desc.includes('攻击') && !desc.includes('防御')) {
    // 可能是材料
    if (!parsed.atk && !parsed.def && !parsed.heal) return 'material';
  }
  
  return 'unknown';
}

// ---- 圖標映射 ----
function getIcon(type, weaponType, armorType) {
  const weaponIcons = {
    dagger: '🔪', sword: '🗡️', tsword: '⚔️', bow: '🏹',
    rod: '🪄', mace: '🔨', spear: '🔱', knuckle: '👊',
  };
  const armorIcons = {
    cloth: '👕', leather: '🦺', shield: '🛡️', garment: '🧣',
    footgear: '👢', headgear: '👑', accessory: '💍',
  };
  
  if (type === 'weapon') return weaponIcons[weaponType] || '⚔️';
  if (type === 'armor') return armorIcons[armorType] || '🛡️';
  if (type === 'consumable') return '🧪';
  if (type === 'material') return '📦';
  return '❓';
}

// ---- 主轉換邏輯 ----
const converted = [];
const stats = { total: 0, weapon: 0, armor: 0, consumable: 0, material: 0, unknown: 0, skipped: 0 };

// 已存在的物品 ID（避免重複）
const existingIds = new Set();

for (const item of rawItems) {
  stats.total++;
  
  const parsed = parseDescription(item.description);
  const type = getItemType(item, parsed);
  
  if (type === 'unknown') {
    stats.unknown++;
    continue;
  }
  
  // 跳過已存在的物品（保留手動定義的）
  const itemId = generateItemId(item.english_name, item.id, item.name);
  if (existingIds.has(itemId)) continue;
  
  // 基本物品資料
  const gameItem = {
    id: itemId,
    imgId: item.id,
    name: item.name,
    type: type,
    icon: getIcon(type, parsed.weaponType, parsed.armorType),
    weight: parsed.weight || 1,
    desc: (item.description || '').replace(/<[^>]+>/g, '').replace(/[\r\n]+/g, ' ').substring(0, 80),
  };
  
  // 根據類型添加屬性
  if (type === 'weapon') {
    gameItem.weaponType = parsed.weaponType || 'dagger';
    if (parsed.atk) gameItem.atk = parsed.atk;
    if (parsed.matk) gameItem.matk = parsed.matk;
    if (parsed.element) gameItem.element = parsed.element;
    gameItem.weaponWeight = -(parsed.weight || 50);
    // 售價估算（攻擊力 × 2）
    gameItem.sell = Math.floor((parsed.atk || 10) * 2);
    gameItem.buyPrice = gameItem.sell * 2;
    stats.weapon++;
  } else if (type === 'armor') {
    gameItem.armorType = parsed.armorType || 'leather';
    if (parsed.def) gameItem.def = parsed.def;
    // 售價估算（防禦力 × 4）
    gameItem.sell = Math.floor((parsed.def || 5) * 4);
    gameItem.buyPrice = gameItem.sell * 2;
    stats.armor++;
  } else if (type === 'consumable') {
    if (parsed.heal) gameItem.heal = parsed.heal;
    if (parsed.restoreSp) gameItem.restoreSp = parsed.restoreSp;
    gameItem.sell = 10;
    gameItem.buyPrice = 20;
    stats.consumable++;
  } else if (type === 'material') {
    gameItem.sell = 1;
    stats.material++;
  }
  
  // 添加數值加成
  const bonusKeys = ['str', 'agi', 'vit', 'int', 'dex', 'luk', 'hit', 'flee', 'critRate', 'hp', 'sp', 'perfectDodge'];
  for (const key of bonusKeys) {
    if (parsed[key]) gameItem[key] = parsed[key];
  }
  
  // 要求等級
  if (parsed.reqLevel) gameItem.reqLevel = parsed.reqLevel;
  
  // 裝備限制 → reqJob
  if (parsed.equipRestrict) {
    const jobs = [];
    const restrict = parsed.equipRestrict;
    for (const [cn, en] of Object.entries(JOB_MAP)) {
      if (restrict.includes(cn)) jobs.push(en);
    }
    if (jobs.length > 0) gameItem.reqJob = [...new Set(jobs)];
  }
  
  existingIds.add(itemId);
  converted.push(gameItem);
}

console.log(`\n轉換完成！`);
console.log(`  武器: ${stats.weapon}`);
console.log(`  防具: ${stats.armor}`);
console.log(`  消耗品: ${stats.consumable}`);
console.log(`  材料: ${stats.material}`);
console.log(`  未知/跳過: ${stats.unknown}`);
console.log(`  已轉換: ${converted.length}`);

// ---- 輸出遊戲格式 ----
const lines = [];
for (const item of converted) {
  // 構建屬性物件
  const props = [];
  props.push(`"id":"${item.id}"`);
  props.push(`"imgId":${item.imgId}`);
  props.push(`"name":"${item.name.replace(/"/g, '\\"')}"`);
  props.push(`"type":"${item.type}"`);
  props.push(`"icon":"${item.icon}"`);
  
  if (item.type === 'weapon') {
    props.push(`"weaponType":"${item.weaponType}"`);
    if (item.atk) props.push(`"atk":${item.atk}`);
    if (item.matk) props.push(`"matk":${item.matk}`);
    if (item.element) props.push(`"element":"${item.element}"`);
    props.push(`"weaponWeight":${item.weaponWeight || -5}`);
  } else if (item.type === 'armor') {
    props.push(`"armorType":"${item.armorType}"`);
    if (item.def) props.push(`"def":${item.def}`);
  } else if (item.type === 'consumable') {
    if (item.heal) props.push(`"heal":${item.heal}`);
    if (item.restoreSp) props.push(`"restoreSp":${item.restoreSp}`);
  }
  
  if (item.weight) props.push(`"weight":${item.weight}`);
  if (item.sell !== undefined) props.push(`"sell":${item.sell}`);
  if (item.buyPrice !== undefined) props.push(`"buyPrice":${item.buyPrice}`);
  if (item.reqLevel) props.push(`"reqLevel":${item.reqLevel}`);
  if (item.reqJob) props.push(`"reqJob":${JSON.stringify(item.reqJob)}`);
  
  // 數值加成
  const bonusKeys = ['str', 'agi', 'vit', 'int', 'dex', 'luk', 'hit', 'flee', 'critRate', 'hp', 'sp', 'perfectDodge'];
  for (const key of bonusKeys) {
    if (item[key]) props.push(`"${key}":${item[key]}`);
  }
  
  props.push(`"desc":"${item.desc.replace(/"/g, '\\"')}"`);
  
  lines.push(`  ${item.id}: {${props.join(',')}}`);
}

const output = `/* ---------------- 道具系統 ---------------- */
/* 自動產生：由 tools/convert_items.js 從 ro_items_data/items.json 轉換 */
/* 共 ${converted.length} 個物品（武器 ${stats.weapon} / 防具 ${stats.armor} / 消耗品 ${stats.consumable} / 材料 ${stats.material}） */
const ITEMS = {
${lines.join(',\n')}
};
`;

fs.writeFileSync(path.join(__dirname, '..', 'js', 'items_generated.js'), output, 'utf8');
console.log(`\n已產生 js/items_generated.js`);
