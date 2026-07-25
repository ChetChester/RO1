/* 用 rAthena 資料更新遊戲商店 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
const enginePath = path.join(__dirname, '..', 'js', 'engine.js');
let data = fs.readFileSync(dataPath, 'utf8');
let engine = fs.readFileSync(enginePath, 'utf8');

// rAthena Prontera 商店物品 ID（無 slot 版本）
const weaponShopIds = [
  1750, 1751, 1701, 1201, 1204, 1207, 1601,
  1101, 1104, 1107, 1110, 1113, 1122, 1119, 1123, 1126, 1129, 1116, 1301,
  1401, 1404, 1407, 1410, 1451, 1454, 1457, 1460, 1463,
  1801, 1803, 1805
];

const armorShopIds = [
  2101, 2103,
  2401, 2403, 2405,
  2501, 2503, 2505,
  2220, 2226,
  2301, 2303, 2305, 2307, 2309, 2312, 2314, 2328, 2330, 2335,
  2628, 2627
];

// rAthena Buy 價格 (imgId -> buyPrice)
const rathenaPrices = {
  // 短劍
  1201: 50, 1204: 1250, 1207: 2400, 1210: 8500, 1213: 14000, 1216: 19500, 1219: 43000, 1222: 49000,
  // 劍
  1101: 100, 1104: 1500, 1107: 2900, 1110: 10000, 1113: 17000, 1119: 51000, 1122: 24000, 1123: 50000, 1126: 49000, 1129: 60000,
  1116: 2000,
  // 斧
  1301: 500, 1304: 20, 1307: 18000, 1351: 5400, 1354: 15500, 1357: 34000, 1360: 55000,
  // 矛
  1401: 150, 1404: 1700, 1407: 3450, 1410: 60000, 1451: 13000, 1454: 20000, 1457: 27000, 1460: 51000, 1463: 54000,
  // 鈍器
  1501: 120, 1504: 1600, 1507: 9000, 1510: 16000, 1513: 41000, 1516: 50000, 1519: 23000, 1522: 60000,
  // 法杖
  1601: 50, 1604: 2500, 1607: 9500, 1610: 45000,
  // 弓
  1701: 1000, 1704: 2500, 1707: 10000, 1710: 17000, 1713: 48000, 1714: 42000, 1718: 64000,
  // 拳套
  1801: 8000, 1803: 25000, 1805: 32000, 1807: 53000, 1809: 67000, 1811: 58000,
  // 樂器
  1901: 4000, 1903: 18000, 1905: 24500, 1907: 47000, 1909: 62000, 1911: 54000,
  // 鞭子
  1950: 2500, 1952: 12000, 1954: 17500, 1958: 41000, 1960: 38000,
  // 盾牌
  2101: 500, 2103: 14000,
  // 頭飾
  2220: 1000, 2226: 12000,
  // 鎧甲
  2301: 10, 2303: 200, 2305: 1000, 2307: 10000, 2309: 22000, 2312: 48000, 2314: 65000, 2328: 5500, 2330: 71000, 2335: 74000,
  // 鞋子
  2401: 400, 2403: 3500, 2405: 18000,
  // 披肩
  2501: 1000, 2503: 5000, 2505: 32000,
  // 飾品
  2627: 20000, 2628: 400,
  // 箭矢
  1750: 1, 1751: 30,
};

// 1. 更新 data.js 中的 buyPrice
let updateCount = 0;
for (const [imgIdStr, buyPrice] of Object.entries(rathenaPrices)) {
  const imgId = parseInt(imgIdStr);
  // 找到對應的物品 ID
  const regex = new RegExp(`"imgId":${imgId}`);
  if (data.match(regex)) {
    // 更新 buyPrice
    const itemRegex = new RegExp(`("imgId":${imgId}[^}]*?"buyPrice":)(\\d+)`);
    const match = data.match(itemRegex);
    if (match) {
      data = data.replace(itemRegex, `$1${buyPrice}`);
      updateCount++;
    } else {
      // 沒有 buyPrice，加上
      const addRegex = new RegExp(`("imgId":${imgId}[^}]*?)}`);
      data = data.replace(addRegex, `$1,"buyPrice":${buyPrice}}`);
      updateCount++;
    }
  }
}
console.log(`更新了 ${updateCount} 個物品的 buyPrice`);

// 2. 更新 sellPrice（sell = buy / 2）
let sellUpdateCount = 0;
for (const [imgIdStr, buyPrice] of Object.entries(rathenaPrices)) {
  const imgId = parseInt(imgIdStr);
  const sellPrice = Math.floor(buyPrice / 2);
  const regex = new RegExp(`"imgId":${imgId}`);
  if (data.match(regex)) {
    const itemRegex = new RegExp(`("imgId":${imgId}[^}]*?"sell":)(\\d+)`);
    const match = data.match(itemRegex);
    if (match) {
      data = data.replace(itemRegex, `$1${sellPrice}`);
      sellUpdateCount++;
    }
  }
}
console.log(`更新了 ${sellUpdateCount} 個物品的 sellPrice`);

fs.writeFileSync(dataPath, data, 'utf8');
console.log('data.js 已儲存');

// 3. 更新 engine.js 中的 NPC_SHOPS
const weaponIds = weaponShopIds.map(id => {
  // 找到對應的遊戲 ID
  const regex = new RegExp(`"imgId":${id},"shop":true`);
  const match = data.match(regex);
  if (match) {
    // 往前找 ID
    const before = data.substring(Math.max(0, match.index - 200), match.index);
    const idMatch = before.match(/(\w+):\s*\{"id":"(\w+)"/);
    if (idMatch) return idMatch[2];
  }
  return null;
}).filter(Boolean);

const armorIds = armorShopIds.map(id => {
  const regex = new RegExp(`"imgId":${id},"shop":true`);
  const match = data.match(regex);
  if (match) {
    const before = data.substring(Math.max(0, match.index - 200), match.index);
    const idMatch = before.match(/(\w+):\s*\{"id":"(\w+)"/);
    if (idMatch) return idMatch[2];
  }
  return null;
}).filter(Boolean);

console.log(`\n武器商店物品: ${weaponIds.length} 個`);
console.log(`防具商店物品: ${armorIds.length} 個`);

// 替換 NPC_SHOPS
const newShopCode = `/* ---------------- NPC 商店系統 ---------------- */
/* 基於 rAthena Prontera 商店清單 */
const NPC_SHOPS = {
  weapon: {
    name: '武器商人',
    icon: '⚔️',
    items: [${weaponIds.map(id => `'${id}'`).join(', ')}],
    getItems() {
      return this.items.filter(id => {
        const item = ITEMS[id];
        if (!item) return false;
        if (item.reqJob && !item.reqJob.includes(state.jobId)) return false;
        if (item.reqLevel && state.baseLevel < item.reqLevel) return false;
        return true;
      });
    }
  },
  armor: {
    name: '防具商人',
    icon: '🛡️',
    items: [${armorIds.map(id => `'${id}'`).join(', ')}],
    getItems() {
      return this.items.filter(id => {
        const item = ITEMS[id];
        if (!item) return false;
        if (item.reqJob && !item.reqJob.includes(state.jobId)) return false;
        if (item.reqLevel && state.baseLevel < item.reqLevel) return false;
        return true;
      });
    }
  }
};`;

engine = engine.replace(/\/\* ---------------- NPC 商店系統 ---------------- \*\/[\s\S]*?^};/m, newShopCode);
fs.writeFileSync(enginePath, engine, 'utf8');
console.log('engine.js 已儲存');

// 列出未找到的物品
const allIds = [...weaponShopIds, ...armorShopIds];
const missing = allIds.filter(id => !data.match(new RegExp(`"imgId":${id}`)));
if (missing.length > 0) {
  console.log(`\n未在遊戲中找到的物品 ID: ${missing.join(', ')}`);
}
