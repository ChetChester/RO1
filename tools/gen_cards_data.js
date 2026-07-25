/* 生成更新後的 CARDS 和 MONSTER_CARD_DROPS 資料 */
const fs = require('fs');
const path = require('path');

const rawCards = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'ro_cards_data', 'cards.json'), 'utf8')
);

// 讀取怪物 imgId 對照
const monstersRaw = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const imgIdMap = {};
const monsterRegex = /(\w+):\s*\{[^}]*imgId:(\d+)[^}]*\}/g;
let m;
while ((m = monsterRegex.exec(monstersRaw)) !== null) {
  imgIdMap[parseInt(m[2])] = m[1];
}

const SLOT_MAP = {
  '武器类': 'weapon', '盔甲类': 'armor', '盾牌类': 'shield',
  '披肩类': 'garment', '鞋子类': 'footgear', '头盔类': 'headgear', '饰品类': 'accessory',
};

function parseAttributes(attrs) {
  const bonus = {};
  const descParts = [];
  for (const attr of attrs) {
    if (attr.startsWith('[')) continue;
    const simpleMatch = attr.match(/^(STR|AGI|VIT|INT|DEX|LUK|ATK|MATK|DEF|HIT|FLEE|CRI)\+(\d+)$/i);
    if (simpleMatch) {
      const stat = simpleMatch[1].toLowerCase();
      const val = parseInt(simpleMatch[2]);
      const statMap = { str:'str',agi:'agi',vit:'vit',int:'int',dex:'dex',luk:'luk',atk:'atk',matk:'matk',def:'def',hit:'hit',flee:'flee',cri:'critRate' };
      const key = statMap[stat] || stat;
      bonus[key] = (bonus[key] || 0) + val;
      descParts.push(`${stat.toUpperCase()}+${val}`);
      continue;
    }
    const hpMatch = attr.match(/^M(?:AX)?HP\+(\d+)(%?)$/i);
    if (hpMatch) {
      const val = parseInt(hpMatch[1]);
      if (hpMatch[2] === '%') { bonus.hpPct = (bonus.hpPct || 0) + val; descParts.push(`MaxHP +${val}%`); }
      else { bonus.hp = (bonus.hp || 0) + val; descParts.push(`MaxHP +${val}`); }
      continue;
    }
    const spMatch = attr.match(/^M(?:AX)?SP\+(\d+)(%?)$/i);
    if (spMatch) {
      const val = parseInt(spMatch[1]);
      if (spMatch[2] === '%') { bonus.spPct = (bonus.spPct || 0) + val; descParts.push(`MaxSP +${val}%`); }
      else { bonus.sp = (bonus.sp || 0) + val; descParts.push(`MaxSP +${val}`); }
      continue;
    }
    if (attr.includes('完全回避')) {
      const dodgeMatch = attr.match(/(\d+)/);
      if (dodgeMatch) { bonus.perfectDodge = (bonus.perfectDodge || 0) + parseInt(dodgeMatch[1]); descParts.push(`完全回避+${dodgeMatch[1]}`); }
      continue;
    }
    const eleDmgMatch = attr.match(/对(\S+?)属性魔物增加(\d+)%的伤害/);
    if (eleDmgMatch) {
      const ele = eleDmgMatch[1], pct = parseInt(eleDmgMatch[2]);
      const eleMap = { '无':'none','水':'water','地':'earth','火':'fire','風':'wind','风':'wind','毒':'poison','圣':'holy','暗':'shadow','念':'ghost','不死':'undead' };
      const eleKey = eleMap[ele] || ele;
      bonus[`eleDmg_${eleKey}`] = (bonus[`eleDmg_${eleKey}`] || 0) + pct;
      descParts.push(`對${ele}屬性魔物傷害+${pct}%`);
      continue;
    }
    if (attr.includes('攻击时') || attr.includes('攻擊時') || attr.includes('几率') || attr.includes('機率')) {
      descParts.push(attr); continue;
    }
    if (attr.trim() && attr !== '...') descParts.push(attr);
  }
  return { bonus, desc: descParts.join(', ') || '—' };
}

function generateCardId(englishName, rawId) {
  if (englishName) {
    return englishName.replace(/[_\s]+/g, '_').replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '');
  }
  return `card_${rawId}`;
}

// 轉換
const gameCards = {};
const gameDrops = {};
const slotIcons = { weapon:'⚔️', armor:'🛡️', shield:'🛡️', garment:'🧣', footgear:'👢', headgear:'👑', accessory:'💍', any:'🃏' };
const supportedKeys = ['str','agi','vit','int','dex','luk','atk','matk','def','hit','flee','critRate','hp','sp','perfectDodge','hpPct','spPct'];

for (const card of rawCards) {
  const { bonus, desc } = parseAttributes(card.attributes || []);
  const slot = SLOT_MAP[card.equip_slot] || 'any';
  const cardId = generateCardId(card.english_name, card.id);

  let monsterId = null;
  if (card.drop_monster_ids && card.drop_monster_ids.length > 0) {
    for (const mid of card.drop_monster_ids) {
      if (imgIdMap[mid]) { monsterId = imgIdMap[mid]; break; }
    }
  }

  // 只保留有遊戲支援屬性的卡片
  const gameBonus = {};
  for (const [k, v] of Object.entries(bonus)) {
    if (supportedKeys.includes(k)) gameBonus[k] = v;
    if (k.startsWith('eleDmg_')) gameBonus[k] = v;
  }
  if (Object.keys(gameBonus).length === 0) continue;

  gameCards[cardId] = {
    id: cardId,
    monsterId: monsterId,
    name: card.name,
    icon: slotIcons[slot] || '🃏',
    slot: slot,
    bonus: gameBonus,
    desc: desc
  };

  if (monsterId) {
    gameDrops[monsterId] = { card: cardId, chance: 0.005 };
  }
}

// 輸出 JS 格式
const cardLines = [];
for (const [id, c] of Object.entries(gameCards)) {
  const bonusStr = JSON.stringify(c.bonus);
  const monsterStr = c.monsterId ? `'${c.monsterId}'` : 'null';
  cardLines.push(`  ${id}: { id: '${id}', monsterId: ${monsterStr}, name: '${c.name}', icon: '${c.icon}', slot: '${c.slot}', bonus: ${bonusStr}, desc: '${c.desc}' }`);
}

const dropLines = [];
for (const [mid, d] of Object.entries(gameDrops)) {
  dropLines.push(`  ${mid}: { card: '${d.card}', chance: ${d.chance} }`);
}

// 寫入檔案
const output = `/* ---------------- 怪物卡片系統 ---------------- */
/* 自動產生：由 tools/gen_cards_data.js 從 ro_cards_data/cards.json 轉換 */
const CARDS = {
${cardLines.join(',\n')}
};

const MONSTER_CARD_DROPS = {
${dropLines.join(',\n')}
};
`;

fs.writeFileSync(path.join(__dirname, '..', 'js', 'cards_generated.js'), output, 'utf8');
console.log(`已產生 cards_generated.js`);
console.log(`卡片數量: ${Object.keys(gameCards).length}`);
console.log(`怪物掉落: ${Object.keys(gameDrops).length}`);
