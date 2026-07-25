const fs = require('fs');
const d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Try to find the error by checking sections
const sections = [
  { name: 'STAT_KEYS', start: 'const STAT_KEYS', end: '];' },
  { name: 'ELEMENTS', start: 'const ELEMENTS', end: '};' },
  { name: 'JOB_TREE', start: 'const JOB_TREE', end: '};' },
  { name: 'ITEMS', start: 'const ITEMS', end: '};' },
  { name: 'MONSTERS', start: 'const MONSTERS', end: '};' },
  { name: 'MAPS', start: 'const MAPS', end: '];' },
  { name: 'REGIONS', start: 'const REGIONS', end: '];' },
  { name: 'CARDS', start: 'const CARDS', end: '};' },
];

sections.forEach(sec => {
  const s = d.indexOf(sec.start);
  const e = d.indexOf(sec.end, s);
  if (s === -1 || e === -1) {
    console.log(sec.name + ': NOT FOUND');
    return;
  }
  // Skip any comments before the section
  let startIdx = s;
  while (startIdx > 0 && d[startIdx - 1] === '\n') startIdx--;
  while (startIdx > 0 && d.substring(startIdx - 2, startIdx) === '//') {
    startIdx--;
    while (startIdx > 0 && d[startIdx - 1] !== '\n') startIdx--;
    startIdx--;
    while (startIdx > 0 && d[startIdx - 1] === '\n') startIdx--;
  }
  const chunk = d.substring(startIdx, e + sec.end.length);
  try {
    new Function(chunk);
    console.log(sec.name + ': OK');
  } catch(err) {
    console.log(sec.name + ': ERR - ' + err.message);
  }
});
