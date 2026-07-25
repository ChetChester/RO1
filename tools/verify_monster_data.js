const d=require('fs').readFileSync('js/data.js','utf8');
const monstersStart=d.indexOf('const MONSTERS = {');
const monstersBlock=d.substring(monstersStart);

const monsters=['scorpion','poring','wolf','osiris'];
monsters.forEach(id=>{
  const regex=new RegExp(id+':\\s*\\{[^}]+\\}');
  const m=monstersBlock.match(regex);
  if(m){
    const ai=m[0].match(/atkInterval:([\d.]+)/);
    const atk=m[0].match(/atk:(\d+)/);
    const flee=m[0].match(/flee:(\d+)/);
    const hit=m[0].match(/hit:(\d+)/);
    console.log(id+': atkInterval='+(ai?ai[1]:'N/A')+', atk='+(atk?atk[1]:'N/A')+', hit='+(hit?hit[1]:'N/A')+', flee='+(flee?flee[1]:'N/A'));
  } else {
    console.log(id+': NOT FOUND');
  }
});
