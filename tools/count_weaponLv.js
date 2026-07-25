const d=require('fs').readFileSync('js/data.js','utf8');
// 找所有有 weaponLv 的武器
const regex=/(\w+):\s*\{"id":"[^"]+","imgId":\d+[^}]*"weaponLv":(\d+)[^}]*\}/g;
let m;
const weaponLv1=[], weaponLv2=[], weaponLv3=[], weaponLv4=[];
while((m=regex.exec(d))!==null){
  const id=m[1];
  const wl=parseInt(m[2]);
  if(wl===1) weaponLv1.push(id);
  else if(wl===2) weaponLv2.push(id);
  else if(wl===3) weaponLv3.push(id);
  else if(wl===4) weaponLv4.push(id);
}
console.log('Lv1 武器:',weaponLv1.length,'個');
console.log('Lv2 武器:',weaponLv2.length,'個');
console.log('Lv3 武器:',weaponLv3.length,'個');
console.log('Lv4 武器:',weaponLv4.length,'個');
console.log('\nLv1 範例:',weaponLv1.slice(0,10).join(', '));
console.log('Lv2 範例:',weaponLv2.slice(0,10).join(', '));
console.log('Lv3 範例:',weaponLv3.slice(0,10).join(', '));
console.log('Lv4 範例:',weaponLv4.slice(0,10).join(', '));
