const fs=require('fs');
let txt=fs.readFileSync('js/data.js','utf8');
const lines=txt.split('\n');
let defLine=-1;
lines.forEach((l,i)=>{
  if(l.includes("'ice_titan_card'")&&l.includes('monsterId'))defLine=i;
});
if(defLine<0){console.log('NF');process.exit(0);}
let line=lines[defLine];
const before=line;
line=line.replace(/"vit":2(?!\d)/,'"def":5').replace(/vit:2(?!\d)/,'def:5');
if(line!==before){
  lines[defLine]=line;
  fs.writeFileSync('js/data.js',lines.join('\n'),'utf8');
  console.log('ice_titan 基礎改為 DEF+5');
}else console.log('無變更');
