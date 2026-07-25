const d=require('fs').readFileSync('js/data.js','utf8');
const items=['knife','falchion','blade','rapier','scimitar','tsurugi','bow','rod','club','spear'];
items.forEach(id=>{
  const regex=new RegExp(id+':\\s*\\{[^}]+\\}');
  const m=d.match(regex);
  if(m){
    const wl=m[0].match(/"weaponLv":(\d+)/);
    const atk=m[0].match(/"atk":(\d+)/);
    console.log(id+': weaponLv='+(wl?wl[1]:'N/A')+', ATK='+(atk?atk[1]:'N/A'));
  }
});
