/* Run: node scripts/test_physics.js. Tests exercise the same simulation as the browser. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const P=require('../src/physics.js'),M=require('../vendor/matter.min.js');
const read=f=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/',f),'utf8'));
const config={parts:read('parts.json'),levels:read('levels.json')},base=read('starter_blueprint.json');
const clone=x=>JSON.parse(JSON.stringify(x)),results=[];
const types=Object.fromEntries(config.parts.types.map(p=>[p.id,p]));
const newSim=(i=0,b)=>new P.Simulation(config,i,b||config.levels.levels[i].example);
function test(name,fn){fn();results.push({name,status:'PASS'});console.log('PASS',name);}
function drive(s,fn,max=7200){for(let n=0;n<max&&s.status==='test';n++)s.step(fn(s));return s;}
function solutionInput(i,route=0){let phase=0;return s=>{
 if(i===1){if(phase===0&&s.cabin.position.y>330)phase=1;if(phase===1&&s.cabin.position.y>525)phase=2;return {right:phase!==1,left:phase===1};}
 return {right:true,fan:(i===2&&route===0)||i===3,rocket:i===4&&s.cabin.position.x>650&&s.cabin.position.x<810,vent:i===3&&s.cabin.position.y<250};
};}
for(let i=0;i<5;i++)test('Level '+(i+1)+' real-force solution',()=>{
 const s=drive(newSim(i),solutionInput(i));
 assert.equal(s.status,'success');assert(s.maxAxleError<1);results.push({level:i+1,seconds:+s.time.toFixed(3),axleError:+s.maxAxleError.toFixed(5),candy:s.candy,blueprint:clone(s.blueprint)});
});
test('Valley recovery route on level 3 is also solvable',()=>{const s=drive(newSim(2),()=>({right:true}));assert.equal(s.status,'success');assert(s.time>15);});
test('Empty workshop is a savable draft, never a playable prebuilt vehicle',()=>{const b=P.emptyBlueprint();assert.equal(b.cockpit,null);assert.deepEqual(b.parts,[]);assert.equal(P.validate(b,config.levels.levels[0].inventory,types,true),'');assert(P.validate(b,config.levels.levels[0].inventory,types));assert.throws(()=>newSim(0,b));const other=P.emptyBlueprint();b.parts.push({id:'x',type:'wood',x:0,y:0,rotation:0});assert.equal(other.parts.length,0);});
test('Draft save accepts unfinished design but rejects invalid placements',()=>{const b=P.emptyBlueprint();b.parts=[{id:'x',type:'wood',x:4,y:3,rotation:0}];assert.equal(P.validate(b,config.levels.levels[0].inventory,types,true),'');b.parts.push({...b.parts[0]});assert(P.validate(b,config.levels.levels[0].inventory,types,true));b.parts=[];b.cockpit=0;assert(P.validate(b,{},types,true));});
test('Second map requires reversal and all three stacked roads are used',()=>{const stuck=drive(newSim(1),()=>({right:true}),3600);assert.notEqual(stuck.status,'success');let minX=Infinity,maxY=0;const controls=solutionInput(1),s=drive(newSim(1),s=>{if(s.cabin.position.y>330&&s.cabin.position.y<525)minX=Math.min(minX,s.cabin.position.x);maxY=Math.max(maxY,s.cabin.position.y);return controls(s);});assert.equal(s.status,'success');assert(minX<700);assert(maxY>550);assert(s.collected.every(Boolean));});
test('Second valid vehicle solves level 1',()=>{const b=clone(base);b.parts.push({id:'extra',type:'wood',x:3,y:0,rotation:0});assert.equal(drive(newSim(0,b),()=>({right:true})).status,'success');});
test('Stationary wheels settle without explosion',()=>{const s=newSim();drive(s,()=>({}),1200);assert(s.maxAxleError<.1);const y=s.cabin.position.y;drive(s,()=>({}),120);assert(Math.abs(s.cabin.position.y-y)<.1);assert(s.cabin.position.y<420);});
test('No ground means no scripted horizontal propulsion',()=>{const s=newSim();M.Composite.remove(s.engine.world,s.ground);s.engine.gravity.scale=0;const massCentre=()=>[s.chassis,...s.wheels].reduce((v,b)=>v+b.position.x*b.mass,0)/[s.chassis,...s.wheels].reduce((v,b)=>v+b.mass,0);const x=massCentre();drive(s,()=>({right:true}),120);assert(Math.abs(massCentre()-x)<2);assert(s.wheels[0].angle>1);});
test('No motor means no wheel drive',()=>{const b=clone(config.levels.levels[2].example);b.parts=b.parts.filter(p=>p.type!=='motor');const s=newSim(2,b),x=s.chassis.position.x;drive(s,()=>({right:true}),360);assert(Math.abs(s.chassis.position.x-x)<2);});
test('Mass and centre change with actual parts',()=>{const s=newSim(),b=clone(base);b.parts.push({id:'extra',type:'wood',x:3,y:0,rotation:0});const t=newSim(0,b);assert(t.chassis.mass>s.chassis.mass);assert(t.chassis.position.x>s.chassis.position.x);});
test('Four thruster orientations change force direction',()=>{
 for(let rot=0;rot<4;rot++){const b=clone(config.levels.levels[2].example);b.parts.find(p=>p.type==='fan').rotation=rot;const s=newSim(2,b);M.Composite.remove(s.engine.world,s.ground);s.engine.gravity.scale=0;s.step({fan:true});const v=s.chassis.velocity;assert(v.x*Math.cos(rot*Math.PI/2)+v.y*Math.sin(rot*Math.PI/2)>0);}
});
test('Off-centre thrust causes angular response',()=>{const b=clone(config.levels.levels[2].example);b.parts.find(p=>p.type==='fan').rotation=1;const s=newSim(2,b);M.Composite.remove(s.engine.world,s.ground);s.engine.gravity.scale=0;drive(s,()=>({fan:true}),30);assert(Math.abs(s.chassis.angle)>.001);});
test('Balloons apply lift and vent reduces it',()=>{const a=newSim(3),b=newSim(3);for(const s of [a,b])M.Composite.remove(s.engine.world,s.ground);for(let n=0;n<60;n++){a.step({});b.step({vent:true});}assert(a.cabin.position.y<b.cabin.position.y-10);});
test('Rocket fuel runs out',()=>{const s=newSim(4);M.Composite.remove(s.engine.world,s.ground);s.engine.gravity.scale=0;for(let n=0;n<400;n++){s.status='test';s.step({rocket:true});}assert.equal(s.fuel,0);});
test('Wall blocks vehicle',()=>{const s=newSim();M.Composite.add(s.engine.world,M.Bodies.rectangle(450,250,50,500,{isStatic:true}));drive(s,()=>({right:true}),1200);assert(s.cabin.position.x<450);assert(s.maxAxleError<1);});
test('Inversion alone does not fail and both passengers stay',()=>{const s=newSim();M.Body.setAngle(s.chassis,Math.PI);s.step({});assert.equal(s.status,'test');assert.deepEqual(s.passengers,['naidan','naidou']);});
test('Cabin outside finish cannot win via another part',()=>{const s=newSim();const g=s.level.goal;M.Body.setPosition(s.chassis,{x:g.x-90,y:g.y-70});s.step({});assert.equal(s.status,'test');});
test('Both passengers required at finish',()=>{const s=newSim();s.passengers=['naidan'];drive(s,()=>({right:true}),900);assert.notEqual(s.status,'success');});
test('Falling loses, retry preserves immutable blueprint',()=>{const b=clone(base),before=JSON.stringify(b),s=newSim(0,b);M.Composite.remove(s.engine.world,s.ground);drive(s,()=>({}),600);assert.equal(s.status,'failed');assert.equal(JSON.stringify(b),before);const retry=newSim(0,b);assert.equal(retry.status,'test');assert.deepEqual(retry.blueprint,b);});
test('Duplicate and cabin overlap rejected',()=>{for(const p of [{...base.parts[0]},{id:'bad',type:'wood',x:1,y:0,rotation:0}]){const b=clone(base);b.parts.push(p);assert(P.validate(b,config.levels.levels[0].inventory,types).includes('重叠'));}});
test('Disconnected frame and unanchored wheels rejected',()=>{for(const t of ['wood','wheel']){const b=clone(base);b.parts.push({id:'bad',type:t,x:4,y:3,rotation:0});assert(P.validate(b,config.levels.levels[0].inventory,types));}});
test('Stock, cabin bounds, malformed save rejected',()=>{const b=clone(base);b.cockpit.x=4;assert(P.validate(b,config.levels.levels[0].inventory,types));assert(P.validate(null,{},types));assert(P.validate(config.levels.levels[3].example,config.levels.levels[0].inventory,types));});
test('Independent passenger reactions',()=>{const s=newSim();drive(s,()=>({right:true}),90);assert.notEqual(s.motion[0].x,s.motion[1].x);assert(s.motion.every(m=>Math.abs(m.x)<=3));});
test('Finish does not require collecting stars',()=>{const cfg=clone(config);cfg.levels.levels[0].stars.forEach(p=>p.y=-100);const s=new P.Simulation(cfg,0,cfg.levels.levels[0].example);drive(s,()=>({right:true}));assert.equal(s.status,'success');assert.equal(s.collected.filter(Boolean).length,0);});
test('All three rewards on every map are attainable',()=>{
 for(let i=0;i<5;i++){const masks=[];for(let route=0;route<(i===2?2:1);route++){const s=drive(newSim(i),solutionInput(i,route));assert.equal(s.status,'success');masks.push(s.collected);}assert([0,1,2].every(j=>masks.some(m=>m[j])),'Unreachable reward in level '+(i+1));}
});
test('Retry restores all three world stars',()=>{const s=drive(newSim(),()=>({right:true}));assert(s.collected.every(Boolean));assert(newSim().collected.every(v=>!v));});
test('Thirty restart cycles stay finite and stable',()=>{for(let i=0;i<30;i++){const s=drive(newSim(),()=>({right:true}),480);assert(Number.isFinite(s.chassis.position.x+s.chassis.angle));assert(s.maxAxleError<1);M.Composite.clear(s.engine.world,false);M.Engine.clear(s.engine);}});
const out=path.join(__dirname,'../test-results');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'physics.json'),JSON.stringify({engine:'Matter.js 0.20.0',fixedStepHz:120,passed:results.filter(r=>r.status==='PASS').length,results},null,2));
console.log('All physics checks passed.');
