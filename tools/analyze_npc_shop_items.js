/* 分析 NPC ID 和對應的物品類型 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_items_data', 'items.json'), 'utf8'));

// 分析 NPC 603 和 617 賣的武器和防具
const npc603 = raw.filter(i => i.other_sources && i.other_sources.includes(603));
const npc617 = raw.filter(i => i.other_sources && i.other_sources.includes(617));

console.log('=== NPC 603 ===');
console.log('總物品:', npc603.length);

// 分析武器
const weapons603 = npc603.filter(i => i.description && i.description.includes('系列:') && i.description.includes('攻击:'));
console.log('武器:', weapons603.length);
weapons603.forEach(w => {
  const atkMatch = w.description.match(/攻击[:：]\s*(\d+)/);
  const seriesMatch = w.description.match(/系列[:：]\s*<[^>]*>([^<]+)/);
  const series = seriesMatch ? seriesMatch[1].trim() : '?';
  console.log(`  ${w.id} ${w.name}: ATK ${atkMatch ? atkMatch[1] : '?'}, 類型 ${series}`);
});

// 分析防具
const armors603 = npc603.filter(i => i.description && i.description.includes('系列:') && i.description.includes('防御:'));
console.log('\n防具:', armors603.length);
armors603.forEach(a => {
  const defMatch = a.description.match(/防御[:：]\s*(\d+)/);
  const seriesMatch = a.description.match(/系列[:：]\s*<[^>]*>([^<]+)/);
  const series = seriesMatch ? seriesMatch[1].trim() : '?';
  console.log(`  ${a.id} ${a.name}: DEF ${defMatch ? defMatch[1] : '?'}, 類型 ${series}`);
});

console.log('\n=== NPC 617 ===');
console.log('總物品:', npc617.length);

const weapons617 = npc617.filter(i => i.description && i.description.includes('系列:') && i.description.includes('攻击:'));
console.log('武器:', weapons617.length);
weapons617.forEach(w => {
  const atkMatch = w.description.match(/攻击[:：]\s*(\d+)/);
  const seriesMatch = w.description.match(/系列[:：]\s*<[^>]*>([^<]+)/);
  const series = seriesMatch ? seriesMatch[1].trim() : '?';
  console.log(`  ${w.id} ${w.name}: ATK ${atkMatch ? atkMatch[1] : '?'}, 類型 ${series}`);
});
