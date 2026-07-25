/* 更新職業等級上限為 99 */
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
let data = fs.readFileSync(dataPath, 'utf8');

// 找到所有 jobLevelMax 並設為 99
data = data.replace(/jobLevelMax:\s*\d+/g, 'jobLevelMax: 99');

fs.writeFileSync(dataPath, data, 'utf8');
console.log('已將所有職業的 jobLevelMax 設為 99');
