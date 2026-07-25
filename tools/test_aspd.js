const fs = require('fs');

// Knight with Two-Handed Sword
const tswordVal = 142;
const shieldVal = -5;
const AGI = 103, DEX = 51;

const statBonus = Math.sqrt(AGI * 1120 / 111 + DEX * 11 / 60);
console.log('StatBonus:', statBonus.toFixed(3));

const core = tswordVal + statBonus + 0;
console.log('Core:', core.toFixed(3));

// No buff
const afterSkill0 = 200 - (200 - core) * 1.0;
console.log('AfterSkill (no buff):', afterSkill0.toFixed(3));
const final0 = Math.floor(195 - (195 - afterSkill0));
console.log('FinalASPD (no buff):', final0);

// +30% buff
const afterSkill30 = 200 - (200 - core) * 0.70;
console.log('AfterSkill (+30%):', afterSkill30.toFixed(3));
const final30 = Math.floor(195 - (195 - afterSkill30));
console.log('FinalASPD (+30%):', final30);
