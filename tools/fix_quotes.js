const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Fix corrupted quotes in ITEMS section
// Replace patterns like 'id":"'xxx' with "id":"xxx"
d = d.replace(/'id":"'([^']*)'/g, '"id":"$1"');
d = d.replace(/'imgId'':(\d+)/g, '"imgId":$1');
d = d.replace(/'shop':true/g, '"shop":true');
d = d.replace(/'name':'([^']*)'/g, '"name":"$1"');
d = d.replace(/'type':'([^']*)'/g, '"type":"$1"');
d = d.replace(/'icon':'([^']*)'/g, '"icon":"$1"');
d = d.replace(/'weight':(\d+)/g, '"weight":$1');
d = d.replace(/'sell':(\d+)/g, '"sell":$1');
d = d.replace(/'buyPrice':(\d+)/g, '"buyPrice":$1');
d = d.replace(/'desc':'([^']*)'/g, '"desc":"$1"');

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', d);
console.log('Fixed quotes');
