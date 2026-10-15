/*
 * 《奶蛙造车记》V0.3.3 场景拼装版 — based on supplied prototype
 * Local Matter.js 0.20; character sprites derived from user supplied references.
 * Goal: an editable blueprint + a physically-driven test cart.
 */
(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const loading = $('loading');
  if (!window.Matter) {
    loading.classList.remove('hidden');
    loading.textContent = '未能载入 Matter.js 物理引擎。请联网打开，或按 README 将固定版本 matter.min.js 放到本地再修改 index.html。';
    return;
  }
  if (!window.NAIWA_CONFIG) {
    loading.classList.remove('hidden');
    loading.textContent = '配置加载失败：请检查 src/data.js 是否存在。';
    return;
  }

  const M = window.Matter;
  const {Engine, World, Bodies, Body, Composite, Constraint, Events} = M;
  const data = window.NAIWA_CONFIG;
  const parts = Object.fromEntries(data.parts.types.map(p => [p.id, p]));
  const levels = data.levels.levels;
  const W = 960, TILE = 34, GRID_W = 5, GRID_H = 4;
  let H=540, cameraY=0, zoom=1.5, overview=false, autoDrive=false, introStart=0, starProgress={}, lastStarCount=0;
  const reducedMotion=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = $('gameCanvas');
  const ctx = canvas.getContext('2d');
  function resize(){const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;H=W*height/width;canvas.width=Math.round(width*Math.min(devicePixelRatio||1,2));canvas.height=Math.round(height*Math.min(devicePixelRatio||1,2));ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);}
  window.addEventListener('resize',resize);resize();
  new ResizeObserver(resize).observe(canvas);
  let levelIndex = 0, blueprint = structuredClone(levels[0].example||data.blueprint), state = 'build';
  let selectedPart = 'wood', selectedRotation = 0;
  let engine = null, car = null, wheelBodies = [], groundBodies = [], goalBody = null;
  let cameraX = 0, last = 0, accumulator = 0, now = 0, fuel = 1, fanOn = false;
  let sim = null, history = [], future = [], scores = {}, muted = false, audio = null;
  let elapsed = 0, status = '', unlocked = 1;
  const controls = {left:false,right:false,rocket:false,brake:false,vent:false};
  const STORAGE = 'naiwa-car-v011-progress';

  try { starProgress=JSON.parse(localStorage.getItem('naiwa-stars-v032')||'{}');if(!starProgress||typeof starProgress!=='object')starProgress={};scores=Object.fromEntries(Object.entries(starProgress).map(([k,v])=>[k,Array.isArray(v)?v.filter(Boolean).length:0])); muted=localStorage.getItem('naiwa-muted')==='true'; }catch(_){}
  try { unlocked = Math.max(1, Number(JSON.parse(localStorage.getItem(STORAGE) || '{}').unlocked) || 1); } catch (_) {}

  function info(msg) { status = msg; $('statusText').textContent = msg; }
  function inventory() { return levels[levelIndex].inventory; }
  function partName(t) { return parts[t]?.name || t; }
  function countType(t) { return blueprint.parts.filter(p => p.type === t).length; }
  function occupancy() {
    const grid = Array(GRID_W * GRID_H).fill(null);
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
      grid[(blueprint.cockpit.y + dy)*GRID_W + blueprint.cockpit.x + dx] = blueprint.cockpit;
    for (const p of blueprint.parts) if (p.x >= 0 && p.x < GRID_W && p.y >= 0 && p.y < GRID_H)
      grid[p.y * GRID_W + p.x] = p;
    return grid;
  }
  function isLocked(cellX, cellY) {
    const c = blueprint.cockpit;
    return cellX >= c.x && cellX < c.x+2 && cellY >= c.y && cellY < c.y+2;
  }
  function validate() { return NaiPhysics.validate(blueprint,inventory(),parts); }
  function remember(){history.push(structuredClone(blueprint));if(history.length>60)history.shift();future=[];}
  function undo(){if(!history.length)return;future.push(structuredClone(blueprint));blueprint=history.pop();drawGrid();}
  function redo(){if(!future.length)return;history.push(structuredClone(blueprint));blueprint=future.pop();drawGrid();}
  function tone(freq=440,duration=.12){
    if(muted)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.055,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch(_){}
  }
  function drawGrid() {
    const grid = $('grid'); grid.replaceChildren();
    const cells=occupancy();
    for (let y=0;y<GRID_H;y++) for(let x=0;x<GRID_W;x++) {
      const part=cells[y*GRID_W+x];const b=document.createElement('button');
      b.type='button';b.className='cell '+(isLocked(x,y)?'locked':part?'part':'');
      b.textContent='';
      
      b.setAttribute('aria-label',`第${y+1}行第${x+1}列 ${isLocked(x,y)?'双人舱':part?partName(part.type):'空格'}`);
      b.draggable=!!part;b.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',JSON.stringify({x,y})));b.addEventListener('dragover',e=>e.preventDefault());b.addEventListener('drop',e=>{e.preventDefault();try{const from=JSON.parse(e.dataTransfer.getData('text/plain'));if(from.type){selectedPart=from.type;putPart(x,y);}else movePiece(from.x,from.y,x,y);}catch(_){}});
      b.title=`${x},${y} ${part?.type?partName(part.type):'空格'}`;
      b.addEventListener('click',()=>putPart(x,y));grid.appendChild(b);
    }
    $('buildWarning').textContent=validate()||'连接完成，可以出发！'; $('startBtn').disabled=!!validate();
    $('undoBtn').disabled=!history.length;$('redoBtn').disabled=!future.length;
    $('levelHint').textContent=levels[levelIndex].hint; $('starGoal').textContent=`本关收藏 ${starMarks(starProgress[levelIndex])} · 到家即可通关`; 
    $('selection').textContent=selectedPart==='cockpit'?'点一个格子作为双人舱左上角':`已选：${selectedPart==='erase'?'拆除':partName(selectedPart)} · ${selectedRotation*90}°`;
    drawPartList();
  }
  function drawPartList() {
    const host=$('parts'); host.replaceChildren();
    for(const t of ['wood','wheel','motor','fan','balloon','rocket','cockpit','erase']) {
      const available=inventory()[t]||0;
      const b=document.createElement('button');
      b.type='button';b.className=selectedPart===t?'active':'';
      b.textContent=t==='cockpit'?'移动双人舱':t==='erase'?'⌫ 拆除':`${parts[t].name} ${available-countType(t)}`;
      b.dataset.part=t; b.title=t==='erase'?'点击已装零件拆除':t==='cockpit'?'点击新的左上角位置':`${partName(t)}：剩余 ${available-countType(t)}`;
      b.draggable=!['erase','cockpit'].includes(t);b.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',JSON.stringify({type:t})));
      if(!['erase','cockpit'].includes(t)){const icon=document.createElement('canvas');icon.width=60;icon.height=50;const ic=icon.getContext('2d');ic.translate(30,26);ic.scale(1.1,1.1);NaiArt.part(ic,{type:t,rotation:0},0,0);b.prepend(icon);}
      b.disabled=!['erase','cockpit'].includes(t)&&available===0;
      b.addEventListener('click',()=>{selectedPart=t;$('selection').textContent=`当前：${t==='erase'?'拆除':partName(t)}；方向 ${selectedRotation*90}°`;drawPartList();});
      host.appendChild(b);
    }
  }
  function putPart(x,y) {
    if(state!=='build')return;
    if(selectedPart==='cockpit'){movePiece(blueprint.cockpit.x,blueprint.cockpit.y,x,y);return;}
    if(isLocked(x,y)){ $('buildWarning').textContent='双人舱不可拆除，可选择「移动双人舱」重新放置';return;}
    remember();tone(380,.04);
    const occupying=blueprint.parts.find(p=>p.x===x&&p.y===y);
    if(occupying) {
      if(selectedPart===occupying.type && parts[selectedPart]?.rotatable) occupying.rotation=(occupying.rotation+1)%4;
      else blueprint.parts=blueprint.parts.filter(p=>p!==occupying);
    } else if(selectedPart!=='erase') {
      if(countType(selectedPart)>=(inventory()[selectedPart]||0)) {
        $('buildWarning').textContent=`${partName(selectedPart)}已用完`;return;
      }
      blueprint.parts.push({id:`${selectedPart}-${Date.now().toString(36)}-${x}-${y}`,type:selectedPart,x,y,rotation:selectedRotation});
    }
    drawGrid();
  }
  function movePiece(fx,fy,x,y){
    if(state!=='build')return;
    const cabin=isLocked(fx,fy),target=cabin?blueprint.cockpit:blueprint.parts.find(p=>p.x===fx&&p.y===fy);if(!target)return;
    const w=cabin?2:1,h=w;
    if(x<0||y<0||x+w>5||y+h>4||blueprint.parts.some(p=>p!==target&&p.x>=x&&p.x<x+w&&p.y>=y&&p.y<y+h)||(!cabin&&isLocked(x,y))){$('buildWarning').textContent='这里放不下，先拆除占用的零件';return;}
    remember();target.x=x;target.y=y;drawGrid();
  }
  function resetBlueprint() { remember();blueprint=structuredClone(levels[levelIndex].example||data.blueprint); selectedRotation=0;drawGrid(); }
  function saveBlueprint() {
    const error=validate();if(error){$('buildWarning').textContent='请先修好蓝图：'+error;return;}
    try{localStorage.setItem('naiwa-car-blueprint-'+levelIndex,JSON.stringify(blueprint));$('buildWarning').textContent='蓝图已保存至浏览器';}
    catch(e){$('buildWarning').textContent='保存失败：本浏览器可能禁用了本地存储';}
  }
  function loadBlueprint() {
    try{const raw=localStorage.getItem('naiwa-car-blueprint-'+levelIndex);if(!raw)throw Error('还没有已保存的蓝图');
      const b=JSON.parse(raw);if(!b||b.grid?.columns!==5||b.grid?.rows!==4||!Array.isArray(b.parts)||b.cockpit?.passengers?.length!==2)throw Error('存档格式不正确');
      const error=NaiPhysics.validate(b,inventory(),parts);if(error)throw Error(error);remember();blueprint=b;drawGrid();
    }catch(e){$('buildWarning').textContent=e.message;}
  }
  function makeWorld() { if(engine){Events.off(engine);World.clear(engine.world,false);Engine.clear(engine);} }
  function makeCar(){
    sim=new NaiPhysics.Simulation(data,levelIndex,blueprint);engine=sim.engine;
    car={chassis:sim.chassis,wheels:sim.wheels,jointList:sim.joints,items:sim.items,passengers:sim.passengers};wheelBodies=sim.wheels;
    lastStarCount=0;fuel=1;elapsed=0;cameraX=levels[levelIndex].spawn.x-105;fanOn=false;autoDrive=false;overview=false;accumulator=0;
    $('fanBtn').textContent='风扇 F · 关';
    $('fanBtn').disabled=!countType('fan');$('rocketBtn').disabled=!countType('rocket');$('ventBtn').disabled=!countType('balloon');
  }
  function start() {
    if(state==='build') {const error=validate();if(error){$('buildWarning').textContent=error;return;}}
    resetControls();makeWorld();makeCar();state='test';tone(660);setVisibleState();info('长按驱动轮子，F 开关风扇，空格按住点火');
  }
  function edit() {state='build';overview=false;cameraX=0;sim=null;car=null;resetControls();$('modal').classList.add('hidden');setVisibleState();drawGrid();}
  function retry() {resetControls();$('modal').classList.add('hidden');start();}
  function resetControls(){for(const k in controls)controls[k]=false;document.querySelectorAll('.engaged').forEach(e=>e.classList.remove('engaged'));}
  function setVisibleState() {
    $('app').dataset.state=state;
    $('introOverlay').classList.toggle('hidden',state!=='intro');$('starGoal').classList.toggle('hidden',!['build','intro'].includes(state));$('tourBtn').classList.toggle('hidden',state!=='build');
    $('mapBtn').classList.toggle('hidden',!['build','test','paused'].includes(state));$('mapBtn').textContent=overview?'回到载具':'查看全图';
    $('buildPanel').classList.toggle('overview',overview);
    $('autoBtn').textContent=autoDrive?'发动机 · 开':'发动机 · 关';
    $('buildPanel').classList.toggle('hidden',state!=='build');
    $('hud').classList.toggle('hidden',!['test','paused'].includes(state));
    $('pauseBtn').textContent=state==='paused'?'继续':'暂停';$('pauseBtn').disabled=!['test','paused'].includes(state);$('resumeBtn').classList.toggle('hidden',state!=='paused');
  }
  function succeed() {
    if(state!=='test') return;
    state='success';resetControls();setVisibleState();tone(880,.35);
    const previous=Array.isArray(starProgress[levelIndex])?starProgress[levelIndex]:[false,false,false];
    starProgress[levelIndex]=sim.collected.map((v,i)=>v||previous[i]);
    const stars=sim.collected.filter(Boolean).length; scores[levelIndex]=starProgress[levelIndex].filter(Boolean).length;
    try{localStorage.setItem('naiwa-stars-v032',JSON.stringify(starProgress));}catch(_){}
    unlocked=Math.max(unlocked,Math.min(levels.length,levelIndex+2));
    try{localStorage.setItem(STORAGE,JSON.stringify({unlocked}));}catch(_){}
    $('modalTitle').textContent='两个小家伙都到啦！';
    $('modalText').textContent=`${starMarks(sim.collected)} 本次 ${stars}/3 颗 · 用时 ${elapsed.toFixed(1)} 秒。两人一起到家，通关！本关已收藏 ${scores[levelIndex]}/3 颗，可反复改装补齐。${levels[levelIndex].starHint}`;
    $('nextBtn').style.display=levelIndex+1<levels.length?'':'none';
    $('modal').classList.remove('hidden');
    refreshSelect();
  }
  function fail(msg) {
    if(state!=='test') return;
    state='failed';resetControls();setVisibleState();tone(180,.25);
    $('modalTitle').textContent='掉出安全区了，再试一次';
    $('modalText').textContent=msg+' 不要紧，载具设计已经保留，回去改改就好。';
    $('nextBtn').style.display='none';$('modal').classList.remove('hidden');
  }
  function refreshSelect(){
    const select=$('levelSelect');select.replaceChildren();
    for(let i=0;i<levels.length;i++){const o=document.createElement('option');o.value=i;o.textContent=`${i+1} · ${levels[i].name}${scores[i]?' '+ '★'.repeat(scores[i]):i+1>unlocked?' 🔒':''}`;o.disabled=i+1>unlocked;select.appendChild(o)}
    select.value=levelIndex;
  }
  function changeLevel(i){overview=false;autoDrive=false;levelIndex=Math.min(Math.max(i,0),levels.length-1);blueprint=structuredClone(levels[levelIndex].example||data.blueprint);history=[];future=[];state='build';cameraX=0;car=null;sim=null;$('modal').classList.add('hidden');resetControls();setVisibleState();drawGrid();info('准备造车');refreshSelect();beginIntro();}
  function tick(){
    if(state!=='test'||!sim)return;
    sim.step({...controls,right:controls.right||(autoDrive&&!controls.left&&!controls.brake),fan:fanOn});elapsed=sim.time;fuel=sim.fuel;
    const n=sim.collected.filter(Boolean).length;if(n>lastStarCount){tone(740+n*130,.14);lastStarCount=n;}
    if(sim.status==='failed'){fail('奶蛋和奶豆一起掉出了安全区域。');return;}
    if(sim.status==='success'){succeed();return;}
    const p=sim.cabin.position;
    if(!overview){cameraX=Math.max(-20,Math.min(levels[levelIndex].worldWidth-W/zoom+60,cameraX+(p.x-W/zoom*.32-cameraX)*.07));cameraY+=(p.y-(H-110)/zoom*.57-cameraY)*.07;}
    $('fuelBar').style.width=`${Math.round(fuel*100)}%`;
    if(Math.floor(elapsed*10)!==Math.floor((elapsed-NaiPhysics.STEP/1000)*10))$('statusText').textContent=`奶蛋 ✓  奶豆 ✓  ·  ${elapsed.toFixed(1)} 秒  ·  距终点 ${Math.max(0,Math.round((levels[levelIndex].goal.x-p.x)/10))} 米  ·  ${starMarks(sim.collected)}`;
  }
  function roundedRect(x,y,w,h,r,fill,stroke=null){
    ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}
  }
  function drawCloud(x,y,size){
    ctx.fillStyle='#ffffffaa';for(const [dx,dy,rx,ry] of [[0,0,45,19],[-26,5,31,18],[25,3,30,18]]){
      ctx.beginPath();ctx.ellipse(x+dx*size,y+dy*size,rx*size,ry*size,0,0,Math.PI*2);ctx.fill();}
  }
  function background(){NaiArt.background(ctx,levels[levelIndex],cameraX,now,H);}
  function drawTerrain(){
    const l=levels[levelIndex];NaiArt.terrain(ctx,l,now);
    for(let i=0;i<l.stars.length;i++){
      if(sim?.collected[i])continue;const p=l.stars[i],owned=!!starProgress[levelIndex]?.[i];
      ctx.save();ctx.translate(p.x,p.y);const pulse=reducedMotion?0:Math.sin(now*.003+i)*2;
      ctx.fillStyle=owned?'#ecf9d333':'#fff1a344';ctx.beginPath();ctx.arc(0,0,21+pulse,0,Math.PI*2);ctx.fill();
      ctx.beginPath();for(let j=0;j<10;j++){const a=-Math.PI/2+j*Math.PI/5,rr=j%2?6:14;const x=Math.cos(a)*rr,y=Math.sin(a)*rr;j?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();ctx.fillStyle=owned?'#c9d995':'#f8d05d';ctx.strokeStyle=owned?'#7b9c5b':'#a78339';ctx.lineWidth=1.6;ctx.fill();ctx.stroke();ctx.fillStyle='#806c36';ctx.font='bold 8px sans-serif';ctx.textAlign='center';ctx.fillText(String(i+1),0,3);ctx.restore();
    }
  }
  function drawCar(){
    if(!car)return;
    const c=car.chassis;
    // Axles explicitly connect wheel centres to the rigid frame.
    ctx.strokeStyle='#8a7a53';ctx.lineWidth=5;
    for(const j of sim.joints){const pt=M.Constraint.pointAWorld(j);ctx.beginPath();ctx.moveTo(pt.x,pt.y);ctx.lineTo(c.position.x,c.position.y+20);ctx.stroke();}
    for(const p of car.items)if(p.type!=='wheel'){const pt=sim.mount(p);NaiArt.part(ctx,p,pt.x,pt.y,c.angle,sim.time,p.type==='fan'?fanOn:p.type==='rocket'?controls.rocket&&fuel>0:autoDrive||controls.right||controls.left);}
    NaiArt.cabin(ctx,sim.cabin.position.x,sim.cabin.position.y,c.angle,sim.motion);
    for(const w of sim.wheels)NaiArt.part(ctx,{type:'wheel'},w.position.x,w.position.y,w.angle);
  }
  function buildOrigin(){const l=levels[levelIndex],b=blueprint,bottom=Math.max((b.cockpit.y+2)*34,...b.parts.map(p=>(p.y+1)*34));return {x:l.spawn.x,y:l.spawn.groundY-bottom-5};}
  function drawBuildPreview(){
    const o=buildOrigin();for(const p of blueprint.parts)NaiArt.part(ctx,p,o.x+(p.x+.5)*34,o.y+(p.y+.5)*34);
    NaiArt.cabin(ctx,o.x+(blueprint.cockpit.x+1)*34,o.y+(blueprint.cockpit.y+1)*34,0);
  }
  function buildPose(){const l=levels[levelIndex],z=Math.max(1.5,45*W/(canvas.clientWidth*TILE)),top=canvas.clientHeight<280?29:62;return {x:l.spawn.x-100,y:canvas.clientHeight<500?buildOrigin().y-(top*W/canvas.clientWidth)/z:l.spawn.groundY-(H-125)/z,z};}
  function starMarks(mask){return [0,1,2].map(i=>mask?.[i]?'★':'☆').join('');}
  function beginIntro(){state='intro';overview=false;resetControls();car=null;sim=null;introStart=performance.now();setVisibleState();}
  function finishIntro(){state='build';overview=false;setVisibleState();drawGrid();}
  function updateIntro(){
    const l=levels[levelIndex],t=(now-introStart)/1000,wide=Math.min(W/(l.worldWidth+100),(H-100)/650);
    const whole={x:-40,y:-30,z:wide},start=buildPose();
    const focus=(p,z=1.05)=>({x:p.x-W/z*.5,y:p.y-(H-80)/z*.5,z});
    const middle=focus(l.stars[1],.9),end=focus({x:l.goal.x,y:l.goal.y-70},1.05);
    let a=whole,b=whole,u=0,label='先看全貌：起点、地形与回家的路';
    if(reducedMotion){if(t>1.5){finishIntro();return;}}
    else if(t<1.5){}
    else if(t<3){a=whole;b=end;u=(t-1.5)/1.5;label='终点在这里：两个人一起抵达就能过关';}
    else if(t<4.6){a=end;b=middle;u=(t-3)/1.6;label='三颗星分布在途中：看好高度，想想怎么造车';}
    else if(t<6.3){a=middle;b=start;u=(t-4.6)/1.7;label='回到起点，把你的解法拼出来';}
    else{finishIntro();return;}
    u=u*u*(3-2*u);cameraX=a.x+(b.x-a.x)*u;cameraY=a.y+(b.y-a.y)*u;zoom=a.z+(b.z-a.z)*u;
    $('introCaption').textContent=label;$('introProgress').style.width=Math.min(100,t/(reducedMotion?1.5:6.3)*100)+'%';
  }
  function updateView(){
    const l=levels[levelIndex];
    if(state==='intro'){updateIntro();}
    else if(overview){zoom=Math.min(W/(l.worldWidth+100),(H-110)/650);cameraX=-40;cameraY=-30;}
    else if(state==='build'){const v=buildPose();zoom=v.z;cameraX=v.x;cameraY=v.y;}
    else zoom=1.45;
    // Use layout pixels before CSS rotation so touch targets remain aligned with the vehicle.
    const o=buildOrigin(),g=$('grid'),scale=canvas.clientWidth/W;
    g.style.left=((o.x-cameraX)*zoom*scale)+'px';g.style.top=((o.y-cameraY)*zoom*scale)+'px';g.style.width=(170*zoom*scale)+'px';g.style.height=(136*zoom*scale)+'px';
  }
  function paint(timestamp){
    now=timestamp;const raw=Math.min(100,timestamp-(last||timestamp));last=timestamp;
    if(state==='test'){accumulator+=raw;let n=0;while(state==='test'&&accumulator>=NaiPhysics.STEP&&n++<10){tick();accumulator-=NaiPhysics.STEP;}if(n>=10)accumulator=0;}
    updateView();background();ctx.save();ctx.scale(zoom,zoom);ctx.translate(-cameraX,-cameraY);drawTerrain();if(car&&state!=='build')drawCar();if(state==='build'||state==='intro')drawBuildPreview();ctx.restore();
    if(state==='paused') {ctx.fillStyle='#0005';ctx.fillRect(0,0,W,H);ctx.fillStyle='#fff';ctx.font='bold 45px sans-serif';ctx.textAlign='center';ctx.fillText('已暂停',W/2,H/2);ctx.textAlign='left';}
    requestAnimationFrame(paint);
  }
  function bindHold(id,key){
    const el=$(id);
    el.addEventListener('pointerdown',e=>{if(state!=='test')return;e.preventDefault();tone(220,.03);el.setPointerCapture(e.pointerId);controls[key]=true;el.classList.add('engaged');});
    for(const ev of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(ev,()=>{controls[key]=false;el.classList.remove('engaged');});
  }
  bindHold('leftBtn','left');bindHold('rightBtn','right');bindHold('rocketBtn','rocket');bindHold('brakeBtn','brake');bindHold('ventBtn','vent');
  $('fanBtn').addEventListener('click',()=>{if(state!=='test')return;fanOn=!fanOn;$('fanBtn').textContent=fanOn?'风扇 F · 开':'风扇 F · 关';});
  $('rotateBtn').addEventListener('click',()=>{selectedRotation=(selectedRotation+1)%4;$('rotateBtn').textContent=`旋转 ${selectedRotation*90}°`;$('selection').textContent=`当前：${partName(selectedPart)}；方向 ${selectedRotation*90}°`;});
  $('startBtn').addEventListener('click',start);$('editBtn').addEventListener('click',edit);$('retryBtn').addEventListener('click',retry);
  $('resetBtn').addEventListener('click',resetBlueprint);$('saveBtn').addEventListener('click',saveBlueprint);$('loadBtn').addEventListener('click',loadBlueprint);
  $('modalEdit').addEventListener('click',edit);$('modalRetry').addEventListener('click',retry);
  $('nextBtn').addEventListener('click',()=>changeLevel(levelIndex+1));
  $('levelSelect').addEventListener('change',e=>changeLevel(Number(e.target.value)));
  $('pauseBtn').addEventListener('click',()=>{if(state==='test'){state='paused';resetControls();if(audio)audio.suspend();setVisibleState();}else if(state==='paused'){state='test';last=performance.now();accumulator=0;if(audio&&!muted)audio.resume();setVisibleState();}});
  $('soundBtn').textContent=muted?'声音：关':'声音：开';$('soundBtn').onclick=()=>{muted=!muted;try{localStorage.setItem('naiwa-muted',String(muted));}catch(_){}$('soundBtn').textContent=muted?'声音：关':'声音：开';tone();};
  $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('resumeBtn').onclick=()=>$('pauseBtn').click();
  $('homePlay').onclick=()=>{$('home').classList.add('hidden');tone(550);beginIntro();};
  $('skipIntro').onclick=finishIntro;$('tourBtn').onclick=beginIntro;
  $('mapBtn').onclick=()=>{overview=!overview;$('mapBtn').textContent=overview?'回到载具':'查看全图';$('buildPanel').classList.toggle('overview',overview);};
  $('autoBtn').onclick=()=>{if(state!=='test')return;autoDrive=!autoDrive;$('autoBtn').textContent=autoDrive?'发动机 · 开':'发动机 · 关';tone(260,.05);};
  $('fullscreenBtn').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}catch(_){$('fullscreenBtn').textContent='窗口模式';$('fullscreenBtn').title='当前浏览器不支持全屏，窗口内可直接游玩';}};
  document.addEventListener('fullscreenchange',()=>{$('fullscreenBtn').textContent=document.fullscreenElement?'退出全屏':'全屏';resize();});
  $('controlHelp').textContent=matchMedia('(pointer: coarse)').matches?'点选零件，再点格子；驾驶时可同时按多个按钮':'鼠标拼装 · A / D 驱动 · B 刹车 · 空格点火 · Esc 暂停';
  window.addEventListener('keydown',e=>{
    if(e.target.matches('select,input,textarea'))return;
    if(!$('home').classList.contains('hidden'))return;
    if(state==='build'){
      if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();e.shiftKey?redo():undo();return;}
      if((e.ctrlKey||e.metaKey)&&e.code==='KeyY'){e.preventDefault();redo();return;}
      if(e.code==='KeyR'&&!e.repeat){$('rotateBtn').click();return;}
      if(e.code==='Enter'&&!e.target.closest('button')){e.preventDefault();start();return;}
    }
    if(e.code==='KeyM'&&!e.repeat&&['build','test','paused'].includes(state)){$('mapBtn').click();return;}
    if(['ArrowLeft','ArrowRight','Space','ArrowDown'].includes(e.code))e.preventDefault();
    if(state!=='test'){if(e.code==='Escape'&&state==='paused')$('pauseBtn').click();return;}
    if(e.code==='KeyB'||e.code==='ArrowDown')controls.brake=true;if(e.code==='KeyV')controls.vent=true;
    if(e.code==='ArrowLeft'||e.code==='KeyA')controls.left=true;
    if(e.code==='ArrowRight'||e.code==='KeyD')controls.right=true;
    if(e.code==='Space')controls.rocket=true;
    if(e.code==='KeyF'&&!e.repeat&&state==='test'){$('fanBtn').click();}
    if(e.code==='Escape'&&['test','paused'].includes(state))$('pauseBtn').click();
  });
  window.addEventListener('keyup',e=>{
    if(e.code==='ArrowLeft'||e.code==='KeyA')controls.left=false;
    if(e.code==='ArrowRight'||e.code==='KeyD')controls.right=false;
    if(e.code==='Space')controls.rocket=false;if(e.code==='KeyB'||e.code==='ArrowDown')controls.brake=false;if(e.code==='KeyV')controls.vent=false;
  });
  const autoPause=()=>{resetControls();if(state==='test'){state='paused';setVisibleState();}if(audio)audio.suspend();};
  window.addEventListener('blur',autoPause);document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();});window.addEventListener('orientationchange',autoPause);
  // Initial physics world for terrain preview; vehicle gets constructed only at Start.
  refreshSelect();drawGrid();makeWorld();setVisibleState();requestAnimationFrame(paint);
})();
