const fs = require('fs');
const d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');
const s = d.indexOf('const MONSTERS = {');
const e = d.indexOf('\n};', s);
const c = d.substring(s, e + 3);

const ids = ['poring', 'scorpion', 'zombie', 'wolf', 'poporing', 'spore', 'drainliar', 'verit', 'ghoul', 'mummy', 'bathory', 'joker', 'anubis', 'baphomet_', 'doppelganger', 'dark_lord', 'raydric', 'gargoyle', 'dokebi'];

ids.forEach(id => {
  const idx = c.indexOf(id + ': {id:' + id);
  if (idx === -1) return;
  const chunk = c.substring(idx, idx + 500);
  const m = chunk.match(/drops:\[([^\]]*)\]/);
  if (m) {
    const drops = [];
    const dr = /item:'([^']+)'/g;
    let d;
    while ((d = dr.exec(m[1])) !== null) drops.push(d[1]);
    console.log(id + ': ' + drops.length + ' drops - ' + drops.join(', '));
  }
});
