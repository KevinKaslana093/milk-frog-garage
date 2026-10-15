const fs = require('node:fs');
const path = require('node:path');
const root=path.join(__dirname,'..');
const data=f=>JSON.parse(fs.readFileSync(path.join(root,'data',f),'utf8'));
const parts=data('parts.json'), levels=data('levels.json'), blueprint=data('starter_blueprint.json');
const ids=new Set(parts.types.map(p=>p.id));
if(levels.levels.length!==5)throw Error('Expected 5 levels');
if(blueprint.cockpit.passengers.join(',')!=='naidan,naidou')throw Error('Double cockpit missing');
if(blueprint.grid.columns!==5 || blueprint.grid.rows!==4)throw Error('Wrong grid size');
for(const p of blueprint.parts){if(!ids.has(p.type))throw Error('Unknown part '+p.type);if(p.x<0||p.x>=5||p.y<0||p.y>=4)throw Error('Part out of grid');}
for(const level of levels.levels){if(!level.segments.length||!level.goal||!level.inventory)throw Error('Incomplete level '+level.id);}
console.log('JSON schema basic checks PASS: double cockpit + parts + 5 levels');
