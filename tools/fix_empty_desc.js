const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Fix empty desc fields
d = d.replace(/,"desc":\}/g, '}');
d = d.replace(/"desc":\}/g, '"desc":""}');

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);
console.log('Fixed empty desc fields');
