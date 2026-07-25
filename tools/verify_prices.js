const d=require('fs').readFileSync('js/data.js','utf8');
const items=['red_potion','orange_potion','yellow_potion','white_potion','blue_potion'];
items.forEach(id=>{
  const regex=new RegExp(id+':\\s*\\{[^}]+\\}');
  const m=d.match(regex);
  if(m){
    const bp=m[0].match(/"buyPrice":(\d+)/);
    const sell=m[0].match(/"sell":(\d+)/);
    console.log(id+': buyPrice='+(bp?bp[1]:'N/A')+', sell='+(sell?sell[1]:'N/A'));
  }
});
