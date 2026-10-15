const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),dist=path.join(root,'dist');
const data={};for(const [k,f] of [['parts','parts.json'],['blueprint','starter_blueprint.json'],['levels','levels.json']])data[k]=JSON.parse(fs.readFileSync(path.join(root,'data',f),'utf8'));
fs.writeFileSync(path.join(root,'src/data.js'),'/* Generated from data/*.json. */\nwindow.NAIWA_CONFIG = '+JSON.stringify(data,null,2)+';\n');
fs.mkdirSync(dist,{recursive:true});
for(const name of ['index.html','src','vendor','assets'])fs.cpSync(path.join(root,name),path.join(dist,name),{recursive:true});
// Keep a new release from mixing its HTML with cached code from the previous release.
const release=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const publishedHtml=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/((?:src|href)="(?:src\/|vendor\/)[^"?]+)(")/g,(_,url,quote)=>url+'?v='+release+quote);
fs.writeFileSync(path.join(dist,'index.html'),publishedHtml);
// Single HTML is a convenience build for offline play, including both original-reference sprites.
let html=fs.readFileSync(path.join(root,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="src/style.css">','<style>'+fs.readFileSync(path.join(root,'src/style.css'),'utf8')+'</style>');
html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,f)=>'<script>'+fs.readFileSync(path.join(root,f),'utf8').replace(/<\/script/gi,'<\\/script')+'</script>');
for(const name of ['naidan','naidou']){
  const url='data:image/png;base64,'+fs.readFileSync(path.join(root,'assets',name+'.png')).toString('base64');
  // Inline relative runtime references, leaving the absolute social-preview URL intact.
  html=html.replace(new RegExp('([\'\"])assets/'+name+'\\.png\\1','g'),(_,quote)=>quote+url+quote);
}
fs.writeFileSync(path.join(root,'../奶蛙造车记-离线试玩.html'),html);
console.log('Built dist/ and standalone offline HTML. No network dependency.');
