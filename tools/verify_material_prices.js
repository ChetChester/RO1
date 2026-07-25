const d=require('fs').readFileSync('js/data.js','utf8');
const items=['jellopy','fluff','fang','feather','tentacle','shell','snake_squama'];
items.forEach(id=>{
  const regex=new RegExp(id+':\\s*\\{[^}]+\\}');
  const m=d.match(regex);
  if(m){
    const sell=m[0].match(/"sell":(\d+)/);
    console.log(id+': sell='+(sell?sell[1]:'N/A'));
  }
});
