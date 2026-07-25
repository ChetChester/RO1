/* 分析哪些 NPC 賣什麼類型的物品 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_items_data', 'items.json'), 'utf8'));

// 分析最常見的 NPC ID 賣什麼
const topNpcs = [603, 617, 616, 12023, 12698, 12623, 12105, 664, 665, 666, 667, 644];

for (const npcId of topNpcs) {
  const items = raw.filter(i => i.other_sources && i.other_sources.includes(npcId));
  if (items.length === 0) continue;
  
  // 分析物品類型
  const types = {};
  items.forEach(i => {
    const desc = i.description || '';
    let type = '其他';
    if (desc.includes('系列:') && desc.includes('攻击:')) type = '武器';
    else if (desc.includes('系列:') && desc.includes('防御:')) type = '防具';
    else if (desc.includes('恢复') || desc.includes('药水')) type = '消耗品';
    else if (desc.includes('重量:') && !desc.includes('攻击')) type = '材料';
    types[type] = (types[type] || 0) + 1;
  });
  
  console.log(`\nNPC ${npcId}: ${items.length} 個物品`);
  console.log(`  類型: ${JSON.stringify(types)}`);
  console.log(`  範例: ${items.slice(0, 3).map(i => i.name).join(', ')}`);
}
