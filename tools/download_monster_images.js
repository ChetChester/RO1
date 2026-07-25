/**
 * 下載 RO 怪物圖片腳本
 * 從 divine-pride.net 抓取所有怪物的 PNG 圖片
 * 
 * 使用方式：
 *   node tools/download_monster_images.js
 */
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const MONSTERS = [
  { imgId: 1001, name: 'lunatic' },
  { imgId: 1002, name: 'poring' },
  { imgId: 1003, name: 'fabre' },
  { imgId: 1004, name: 'wolf' },
  { imgId: 1005, name: 'hornet' },
  { imgId: 1006, name: 'goblin' },
  { imgId: 1007, name: 'orc' },
  { imgId: 1008, name: 'pupa' },
  { imgId: 1009, name: 'willow' },
  { imgId: 1010, name: 'spore' },
  { imgId: 1011, name: 'poporing' },
  { imgId: 1012, name: 'pecopeco' },
  { imgId: 1013, name: 'picky' },
  { imgId: 1014, name: 'creamy' },
  { imgId: 1015, name: 'thief_bug' },
  { imgId: 1016, name: 'mandragora' },
  { imgId: 1017, name: 'yoyo' },
  { imgId: 1018, name: 'smokie' },
  { imgId: 1019, name: 'rocker' },
  { imgId: 1020, name: 'thief_bug_egg' },
  { imgId: 1021, name: 'drops' },
  { imgId: 1022, name: 'savage_babe' },
  { imgId: 1023, name: 'baby_desert_wolf' },
  { imgId: 1024, name: 'condor' },
  { imgId: 1025, name: 'savage' },
  { imgId: 1026, name: 'goblin_archer' },
  { imgId: 1027, name: 'green_plant' },
  { imgId: 1028, name: 'blue_plant' },
  { imgId: 1029, name: 'shining_plant' },
  { imgId: 1030, name: 'yellow_plant' },
  { imgId: 1031, name: 'red_mushroom' },
  { imgId: 1032, name: 'black_mushroom' },
  { imgId: 1033, name: 'eclipse' },
  { imgId: 1034, name: 'panzer_goblin' },
];

// divine-pride.net 圖片 URL 格式
const BASE_URL = 'https://static.divine-pride.net/images/mobs/png';
const OUT_DIR = path.join(__dirname, '..', 'images', 'monsters');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 RO-Idle-Game-Asset-Downloader' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // follow redirect
        https.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
          res2.pipe(file);
          file.on('finish', () => { file.close(); resolve(res2.statusCode); });
        }).on('error', (err) => { fs.unlink(dest, () => {}); reject(err); });
      } else if (res.statusCode === 200) {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(res.statusCode); });
      } else {
        file.close();
        fs.unlink(dest, () => {});
        resolve(res.statusCode);
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let ok = 0, fail = 0, skip = 0;

  for (const m of MONSTERS) {
    const outFile = path.join(OUT_DIR, `${m.imgId}.png`);
    const url = `${BASE_URL}/${m.imgId}.png`;

    // 跳過已存在且不為 0 bytes 的檔案
    if (fs.existsSync(outFile) && fs.statSync(outFile).size > 100) {
      console.log(`[SKIP] ${m.imgId} ${m.name} — already exists (${fs.statSync(outFile).size} bytes)`);
      skip++;
      continue;
    }

    process.stdout.write(`[DOWN] ${m.imgId} ${m.name} ... `);
    try {
      const code = await downloadFile(url, outFile);
      const size = fs.existsSync(outFile) ? fs.statSync(outFile).size : 0;
      if (code === 200 && size > 100) {
        console.log(`OK (${size} bytes)`);
        ok++;
      } else {
        console.log(`WARN status=${code} size=${size}`);
        fail++;
      }
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
      fail++;
    }
    // 禮貌延遲，避免被ban
    await sleep(300);
  }

  console.log(`\n完成：成功 ${ok}，失敗 ${fail}，跳過 ${skip}（共 ${MONSTERS.length} 個怪物）`);
}

main().catch(console.error);
