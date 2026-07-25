const fs = require('fs');
const path = require('path');

// 讀取怪物資料
const rawData = JSON.parse(fs.readFileSync('D:/mimo/ro-idle/ro_monster_data/monsters.json', 'utf8'));

// 屬性映射
const ELEMENT_MAP = {
  '无属性': 'none', '水属性': 'water', '地属性': 'earth', '火属性': 'fire',
  '风属性': 'wind', '毒属性': 'poison', '圣属性': 'holy', '暗属性': 'shadow',
  '念属性': 'ghost', '不死属性': 'undead'
};

// 體型映射
const SIZE_MAP = { '小型': 'small', '中型': 'medium', '大型': 'large' };

// 種族映射
const RACE_MAP = {
  '昆虫': 'insect', '動物': 'brute', '恶魔': 'demon', '魚類': 'fish',
  '植物': 'plant', ' undead': 'undead', '人形': 'formless', '不死': 'undead',
  '暗属性': 'shadow', '无形': 'formless'
};

// emoji 預設
const DEFAULT_ICONS = {
  insect: '🐛', brute: '🐺', demon: '😈', fish: '🐟',
  plant: '🌿', undead: '💀', formless: '👻', demon: '👿'
};

// 轉換攻擊力字串 "33 ~ 36" 為數字（處理逗號）
function parseAtk(atkStr) {
  if (!atkStr) return 0;
  const clean = atkStr.replace(/,/g, '');
  const match = clean.match(/(\d+)\s*~\s*(\d+)/);
  if (match) return Math.round((parseInt(match[1]) + parseInt(match[2])) / 2);
  return parseInt(clean) || 0;
}

// 轉換數字字串（處理逗號）
function parseNum(str) {
  if (!str) return 0;
  return parseInt(str.replace(/,/g, '')) || 0;
}

// 轉換屬性字串 "火 1" 為元素名稱
function parseElement(elemStr) {
  if (!elemStr) return 'none';
  for (const [cn, en] of Object.entries(ELEMENT_MAP)) {
    if (elemStr.includes(cn)) return en;
  }
  return 'none';
}

// 轉換種族
function parseRace(raceStr) {
  if (!raceStr) return 'formless';
  for (const [cn, en] of Object.entries(RACE_MAP)) {
    if (raceStr.includes(cn)) return en;
  }
  return 'formless';
}

// 轉換體型
function parseSize(sizeStr) {
  if (!sizeStr) return 'medium';
  return SIZE_MAP[sizeStr] || 'medium';
}

// 生成內部 ID（英文小寫+下底線）
function genId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
}

// 轉換怪物資料
const monsters = {};
const skipped = [];

rawData.forEach(mon => {
  try {
    const id = mon.id;
    const stats = mon.stats || {};

    // 基本數值
    const level = parseNum(stats['等级(LV)']) || 1;
    const hp = parseNum(stats['HP']) || 100;
    const atk = parseAtk(stats['攻击力']);
    const def = parseNum(stats['防御力']) || 0;
    const mdef = parseNum(stats['魔法防御']) || 0;
    const exp = parseNum(stats['基础经验']) || 1;
    const jobExp = parseNum(stats['职业经验']) || 1;
    const element = parseElement(stats['属性']);
    const race = parseRace(stats['种族']);
    const size = parseSize(stats['体型']);

    // 掉落物
    const drops = (mon.drops || []).map(d => ({
      item_id: d.item_id,
      name: d.name,
      drop_rate: parseFloat(d.drop_rate) || 0
    }));

    // 內部 ID
    const internalId = genId(mon.english_name || mon.name);

    monsters[internalId] = {
      id: internalId,
      imgId: id,
      name: mon.name,
      englishName: mon.english_name,
      icon: DEFAULT_ICONS[race] || '👾',
      level,
      hp,
      atk,
      def,
      mdef,
      element,
      race,
      size,
      exp,
      jobExp,
      drops,
      maps: (mon.maps || []).map(m => m.map_name)
    };
  } catch (e) {
    skipped.push({ id: mon.id, name: mon.name, error: e.message });
  }
});

// 輸出轉換後的怪物資料
const output = JSON.stringify(monsters, null, 2);
fs.writeFileSync('D:/mimo/ro-idle/tools/monsters_converted.json', output);

console.log(`Converted: ${Object.keys(monsters).length} monsters`);
console.log(`Skipped: ${skipped.length}`);
if (skipped.length > 0) {
  console.log('Skipped samples:', skipped.slice(0, 5));
}
