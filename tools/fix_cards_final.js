const fs = require('fs');
let d = fs.readFileSync('D:/mimo/ro-idle/js/data.js', 'utf8');

// Find and fix CARDS section
const carStart = d.indexOf('const CARDS = {');
const carEnd = d.indexOf('};', carStart + 20);

if (carStart === -1 || carEnd === -1) {
  console.log('CARDS section not found properly');
  process.exit(1);
}

// Extract CARDS content
const carContent = d.substring(carStart, carEnd + 2);

// Fix corrupted entries in CARDS
let fixedCar = carContent;
// Fix bonus objects with wrong quotes
fixedCar = fixedCar.replace(/"'\w+'":/g, '"');
// Remove lines with missing key names
fixedCar = fixedCar.replace(/^\s+:\s*\{[^}]*\},?\s*$/gm, '');

// Reconstruct file
const before = d.substring(0, carStart);
const after = d.substring(carEnd + 2);

fs.writeFileSync('D:/mimo/ro-idle/js/data.js', before + fixedCar + after);
console.log('Fixed CARDS section');
