/* 檢查問題物品 */
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ro_items_data', 'items.json'), 'utf8'));
const item = raw.find(i => i.id === 510);
console.log(JSON.stringify(item, null, 2));
