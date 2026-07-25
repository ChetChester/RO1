const d=require('fs').readFileSync('js/data.js','utf8');
const regex=new RegExp('rod:\\s*\\{[^}]+\\}');
const m=d.match(regex);
if(m){
  const wl=m[0].match(/"weaponLv":(\d+)/);
  const atk=m[0].match(/"atk":(\d+)/);
  console.log('rod: weaponLv='+(wl?wl[1]:'N/A')+', ATK='+(atk?atk[1]:'N/A'));
} else {
  console.log('rod NOT FOUND');
}
