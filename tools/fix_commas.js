const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Fix missing commas between card entries
// Pattern: } followed by newline and space then identifier_card:
d = d.replace(/\}\n  (\w+_card):/g, '},\n  $1:');

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);
console.log('Fixed commas');
