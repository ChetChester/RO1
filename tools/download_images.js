/**
 * 從 divine-pride.net 下載缺失的道具/武器/防具圖片
 * 使用 RO 官方 Aegis ID 對應圖片
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 我們的 imgId → RO Aegis ID 映射
// 來源: divine-pride.net 搜尋結果 + RO 官方資料
const ITEM_AEGIS_MAP = {
  // ===== 消耗品/素材 (images/items/) =====
  // 已有: 2001(RedPotion=501), 2002(OrangePotion=502), 2003(YellowPotion=503),
  //       2004(WhitePotion=504), 2005(FreshFish=504?), 2006(BluePotion=506),
  //       2007(Strawberry=507), 2008(Jellopy=909)
  2009: 914,   // 獸毛 (Fluff)
  2010: 913,   // 尖牙 (Fang)
  2011: 916,   // 羽毛 (Feather)

  // ===== 武器 (images/equip/weapon/) =====
  // 短劍 Dagger (RO IDs: 1750-1799)
  3005: 1752,  // 切割者 (Cutter)
  3006: 1754,  // 格鬥短劍 (Main Gauche)
  3007: 1756,  // 匕首 (Dirk)
  3008: 1757,  // 細劍 (Stiletto)
  3009: 1759,  // 羅馬短劍 (Gladius)
  3010: 1761,  // 大馬士革短劍 (Damascus)

  // 劍 Sword (RO IDs: 1750-1799)
  3021: 1752,  // 彎刀 (Falchion) - 與 Cutter 同 ID?
  3022: 1754,  // 利刃 (Blade)
  3023: 1756,  // 刺劍 (Rapier)
  3024: 1758,  // 軍刀 (Saber)
  3025: 1762,  // 波浪劍 (Flamberge)

  // 雙手劍 Two-Handed Sword (RO IDs: 1176-1199)
  3040: 1176,  // 雙手劍 (Zweihander)
  3041: 1178,  // 雙手大劍 (Claymore)
  3042: 1180,  // 破壞者 (Buster)
  3043: 1182,  // 雙手巨劍 (Massive)
  3044: 1184,  // 雙手巨劍
  3045: 1186,  // 屠殺者 (Slayer)

  // 弓 Bow (RO IDs: 1750-1799)
  3061: 1752,  // 複合弓 (Composite Bow)
  3062: 1754,  // 大弓 (Great Bow)
  3063: 1756,  // 十字弓 (Crossbow)
  3064: 1758,  // 強弓 (Gakkung)
  3065: 1762,  // 獵人弓 (Hunter Bow)
  3066: 1764,  // 弩砲 (Ballista)

  // 法杖 Rod (RO IDs: 1601-1699)
  3081: 1602,  // 樹枝法杖 (Branch)
  3082: 1603,  // 魔杖 (Wand)
  3083: 1604,  // 奧秘法杖 (Arcane)
  3084: 1605,  // 長杖 (Staff)
  3085: 1606,  // 巫師之杖 (Wizard Staff)
  3086: 1607,  // 巫毒法杖 (Voodoo)
  3087: 1608,  // 破壞之杖 (Staff of Destruction)

  // 鈍器 Mace (RO IDs: 1601-1699)
  3100: 1601,  // 棍棒 (Club)
  3101: 1602,  // 鎚 (Mace)
  3102: 1603,  // 鏈鎚 (Flail)
  3103: 1604,  // 寬刃劍 (Broad Sword)

  // 拳刃 Katar (RO IDs: 1250-1299)
  3120: 1250,  // 拳刃 (Katar)
  3121: 1252,  // 印度拳刃 (Jamadhar)
  3122: 1254,  // 震動拳刃 (Quaking)

  // 長矛 Spear (RO IDs: 1460-1499)
  3140: 1460,  // 長柄斧 (Pole Axe)
  3141: 1462,  // 長槍 (Lance)
  3142: 1464,  // 精緻長槍

  // 拳套 Knuckle (RO IDs: 1800-1849)
  3160: 1800,  // 拳套 (Iron Driver)
  3161: 1802,  // 爪型拳套 (Claw)
  3162: 1804,  // 青銅拳套 (Finger)
  3163: 1806,  // 鋼鐵拳套 (Raptor)

  // ===== 防具 (images/equip/armor/) =====
  // 衣服 Cloth (RO IDs: 2301-2399)
  4003: 2301,  // 水貂皮大衣
  4004: 2302,  // 冒險者套裝
  4005: 2303,  // 外套
  4006: 2304,  // 披風外套

  // 皮甲 Leather (RO IDs: 2311-2399)
  4020: 2311,  // 木製護甲
  4021: 2312,  // 皮革護甲
  4022: 2313,  // 鎖子甲
  4023: 2314,  // 獸皮護甲
  4024: 2315,  // 填充護甲
  4025: 2316,  // 鎖甲

  // 盾 Shield (RO IDs: 2101-2199)
  4040: 2101,  // 盾牌
  4041: 2102,  // 圓盾
  4042: 2103,  // 鐵盾
  4043: 2104,  // 鏡盾
  4044: 2105,  // 花型盾
  4045: 2107,  // 神聖之盾

  // 披風 Garment (RO IDs: 2501-2599)
  4060: 2501,  // 圍巾
  4061: 2502,  // 披風
  4062: 2503,  // 兜帽
  4063: 2504,  // 溫暖圍巾
  4064: 2505,  // 斗篷
  4065: 2506,  // 瓦爾披風

  // 鞋子 Footgear (RO IDs: 2401-2499)
  4080: 2401,  // 涼鞋
  4081: 2402,  // 鞋子
  4082: 2403,  // 長靴
  4083: 2404,  // 水晶靴
  4084: 2405,  // 潮汐之靴
  4085: 2406,  // 女武神之靴
  4086: 2407,  // 神速之靴

  // 飾品 Accessory (RO IDs: 2601-2699)
  4100: 2601,  // 戒指
  4101: 2602,  // 耳環
  4102: 2603,  // 項鏈
  4103: 2604,  // 念珠
  4104: 2605,  // 胸針
  4105: 2606,  // 手套
  4106: 2607,  // 髮夾
  4107: 2608,  // 寶石頭盔

  // 攻速裝備
  4108: 2507,  // 攻速鬥篷
  4109: 2609,  // 敏捷戒指
  4110: 2610,  // 遊俠手套
};

// 圖片 URL 模式
const IMG_BASE_URL = 'https://static.divine-pride.net/images/items/item/';

// 目標目錄
const BASE_DIR = path.join(__dirname, '..');
const ITEMS_DIR = path.join(BASE_DIR, 'images', 'items');
const WEAPON_DIR = path.join(BASE_DIR, 'images', 'equip', 'weapon');
const ARMOR_DIR = path.join(BASE_DIR, 'images', 'equip', 'armor');

// 延遲函式（遵守 API 速率限制）
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 下載圖片
function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (res2) => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(true); });
        }).on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      } else if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(true); });
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// 判斷檔案屬於哪個目錄
function getDestDir(imgId) {
  if (imgId >= 2001 && imgId <= 2099) return ITEMS_DIR;
  if (imgId >= 3001 && imgId <= 3199) return WEAPON_DIR;
  if (imgId >= 4001 && imgId <= 4199) return ARMOR_DIR;
  return null;
}

async function main() {
  console.log('開始從 divine-pride.net 下載缺失圖片...\n');
  console.log(`待下載項目: ${Object.keys(ITEM_AEGIS_MAP).length} 個\n`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failedItems = [];

  for (const [imgIdStr, aegisId] of Object.entries(ITEM_AEGIS_MAP)) {
    const imgId = parseInt(imgIdStr);
    const destDir = getDestDir(imgId);
    if (!destDir) continue;

    const destPath = path.join(destDir, `${imgId}.png`);

    // 跳過已存在的檔案
    if (fs.existsSync(destPath)) {
      skipped++;
      continue;
    }

    const url = `${IMG_BASE_URL}${aegisId}.png`;
    console.log(`[${imgId}] ← Aegis ${aegisId} ...`);

    try {
      await downloadImage(url, destPath);
      downloaded++;
      console.log(`  ✓ OK`);
    } catch (err) {
      failed++;
      failedItems.push({ imgId, aegisId, error: err.message });
      console.log(`  ✗ FAIL: ${err.message}`);
    }

    // 遵守 API 速率限制
    await delay(1100);
  }

  console.log(`\n===== 完成 =====`);
  console.log(`下載成功: ${downloaded}`);
  console.log(`已存在跳過: ${skipped}`);
  console.log(`下載失敗: ${failed}`);

  if (failedItems.length > 0) {
    console.log(`\n失敗清單:`);
    failedItems.forEach(item => {
      console.log(`  - imgId=${item.imgId}, Aegis=${item.aegisId}: ${item.error}`);
    });
  }
}

main().catch(console.error);
