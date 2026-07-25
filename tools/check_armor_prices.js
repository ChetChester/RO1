const d=require('fs').readFileSync('js/data.js','utf8');
const items=['cotton_shirt','leather_jacket','guard','buckler','sandals','shoes','boots','hood','muffler','manteau'];
items.forEach(id=>{
  const regex = new RegExp(id+':\\s*\\{[^}]+\\}');
  const m=d.match(regex);
  if(m){
    const bp=m[0].match(/"buyPrice":(\d+)/);
    const def=m[0].match(/"def":(\d+)/);
    console.log(id+': buyPrice='+(bp?bp[1]:'N/A')+', def='+(def?def[1]:'N/A'));
  }
});
