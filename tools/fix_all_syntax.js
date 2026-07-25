const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Fix missing commas between entries (})
d = d.replace(/\}\n  (\w+):/g, '},\n  $1:');

// Fix double quotes inside strings
d = d.replace(/"([^"]*"[^"]*")/g, "'$1'");

// Fix trailing underscores in identifiers
d = d.replace(/(\w+)_:/g, '$1:');

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);
console.log('Fixed all syntax issues');
