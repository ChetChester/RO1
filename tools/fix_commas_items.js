const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Fix missing commas between ITEMS entries
// Pattern: } followed by newline and space then identifier:
d = d.replace(/\}\n  (\w+):/g, '},\n  $1:');

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);
console.log('Fixed commas');
