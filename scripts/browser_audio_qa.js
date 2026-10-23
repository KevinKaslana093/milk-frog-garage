/* Run with playwright-cli run-code --filename scripts/browser_audio_qa.js.
 * Test-local instrumentation only; the shipped game exposes no instance hooks.
 */
async page=>{
 const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
 const check=(value,message)=>{if(!value)throw Error(message);checks.push(message);};
 await page.addInitScript(()=>{
   let api;Object.defineProperty(window,'NaiAudio',{configurable:true,get:()=>api,set:v=>{api=v;const Base=v.Soundscape;v.Soundscape=class extends Base{constructor(){super();window.qaSound=this;this.heard=[];}sfx(...args){this.heard.push(args[0]);super.sfx(...args);}};}});
   let physics;Object.defineProperty(window,'NaiPhysics',{configurable:true,get:()=>physics,set:v=>{physics=v;const Base=v.Simulation;v.Simulation=class extends Base{constructor(...a){super(...a);window.qaSim=this;}};}});
 });
 await page.evaluate(()=>{localStorage.removeItem('naiwa-audio-v1');localStorage.removeItem('naiwa-muted');localStorage.setItem('naiwa-car-v011-progress','{"unlocked":20}');});
 await page.reload();await page.setViewportSize({width:1440,height:900});
 check(await page.evaluate(()=>qaSound.ctx===null),'Audio waits for a user gesture');
 await page.locator('#homePlay').click();await page.locator('#skipIntro').click();await page.waitForTimeout(500);
 check(await page.evaluate(()=>qaSound.ctx.state==='running'&&qaSound.beat>0),'Gesture starts the original workshop score');
 const signal=async()=>page.evaluate(async()=>{const a=qaSound.ctx.createAnalyser();a.fftSize=2048;qaSound.master.connect(a);const samples=new Float32Array(2048);let energy=0,peak=0;for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,30));a.getFloatTimeDomainData(samples);for(const x of samples){energy+=x*x;peak=Math.max(peak,Math.abs(x));}}qaSound.master.disconnect(a);return {rms:Math.sqrt(energy/(20*2048)),peak};});
 const music=await signal();check(music.rms>.002&&music.peak<1,'Music produces a non-clipping audio signal');
 await page.locator('#soundBtn').click();await page.locator('#musicVolume').fill('30');await page.locator('#effectsVolume').fill('65');await page.locator('#muteBtn').click();await page.waitForTimeout(150);
 check((await signal()).rms<.00001,'Mute silences music and effects immediately');
 await page.locator('#muteBtn').click();await page.locator('#closeSound').click();
 await page.reload();await page.locator('#homePlay').click();await page.locator('#skipIntro').click();
 check(await page.evaluate(()=>qaSound.music===.3&&qaSound.effects===.65&&!qaSound.muted),'Independent volume settings survive reload');
 // Invalid save and unrelated drag data cannot enter the editor or crash it.
 await page.evaluate(()=>localStorage.setItem('naiwa-car-blueprint-0',JSON.stringify({grid:{columns:5,rows:4},cockpit:null,parts:[null]})));
 await page.locator('#loadBtn').click();check((await page.locator('#buildWarning').innerText()).includes('无效'),'Corrupt blueprint is rejected with a readable message');
 await page.locator('.cell').first().evaluate(el=>{const dt=new DataTransfer();dt.setData('text/plain','{"type":"constructor"}');el.dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:dt}));});
 await page.locator('#saveBtn').click();check(await page.evaluate(()=>JSON.parse(localStorage.getItem('naiwa-car-blueprint-0')).parts.length===0),'Foreign drag payload does not mutate the blueprint');
 await page.locator('[data-part="wood"]').click();await page.locator('.cell').nth(0).click();await page.locator('.cell').nth(1).click();await page.locator('#undoBtn').click();await page.locator('[data-part="erase"]').click();await page.locator('.cell').nth(19).click();check(await page.locator('#redoBtn').isEnabled(),'Erasing an empty cell preserves redo history');
 await page.evaluate(()=>localStorage.setItem('naiwa-car-blueprint-0',JSON.stringify(NAIWA_CONFIG.levels.levels[0].example)));await page.locator('#loadBtn').click();
 await page.locator('#startBtn').click();await page.locator('#autoBtn').click();await page.waitForTimeout(350);
 check(await page.evaluate(()=>qaSound.mode==='drive'&&qaSound.voices.engine.gain.gain.value>.06),'Driving music and engine sound follow actual motor power');
 await page.locator('#soundBtn').click();check(await page.locator('#app').getAttribute('data-state')==='paused','Opening sound settings pauses a moving car');
 check(await page.evaluate(()=>qaSound.ctx.state==='suspended'),'Paused game suspends audio');
 for(const [width,height] of [[320,568],[390,844],[667,375],[1440,900]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(100);
   check(await page.evaluate(()=>['musicVolume','effectsVolume','closeSound','muteBtn'].every(id=>{const el=document.getElementById(id),r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&Math.min(r.width,r.height)>=44&&(hit===el||el.contains(hit));})),`${width}x${height}: rotated sound controls fit and remain tappable`);
 }
 await page.locator('#closeSound').click();check(await page.locator('#app').getAttribute('data-state')==='paused','Closing settings waits for explicit resume');await page.locator('#resumeBtn').click();await page.waitForTimeout(150);
 check(await page.evaluate(()=>qaSound.ctx.state==='running'),'Resume restarts audio without another context');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(100);
 check(await page.evaluate(()=>qaSound.ctx.state==='suspended'),'Switching away silences the whole game');await page.locator('#resumeBtn').click();
 await page.locator('#editBtn').click();await page.locator('#levelSelect').selectOption('4');await page.locator('#skipIntro').click();await page.evaluate(()=>localStorage.setItem('naiwa-car-blueprint-4',JSON.stringify(NAIWA_CONFIG.levels.levels[4].example)));await page.locator('#loadBtn').click();await page.locator('#startBtn').click();await page.keyboard.down('Space');await page.waitForTimeout(150);
 check(await page.evaluate(()=>qaSound.voices.rocket.gain.gain.value>.1&&qaSound.heard.includes('ignite')),'Rocket ignition and sustained exhaust sound activate together');
 await page.evaluate(()=>{for(const p of qaSim.items.filter(p=>p.type==='rocket'))qaSim.detach(p);});await page.waitForTimeout(300);
 check(await page.evaluate(()=>qaSound.voices.rocket.gain.gain.value<.001&&qaSound.heard.includes('break')),'Detached rocket loses its engine sound and plays fracture once');await page.keyboard.up('Space');
 // Offline rendering exercises each authored sound independently and catches silent/clipped effects.
 const effects=await page.evaluate(async()=>{
   const results=[],live=qaSound;
   for(const name of ['place','remove','switch','start','star','win','fail','impact','break','pop','ignite']){
     const c=new OfflineAudioContext(1,48000*2,48000),s=new NaiAudio.Soundscape();
     s.ctx=new Proxy(c,{get:(target,key)=>key==='state'?'running':typeof target[key]==='function'?target[key].bind(target):target[key]});s.musicBus=c.createGain();s.fxBus=c.createGain();s.fxBus.connect(c.destination);s.noise=live.noise;s.effects=1;s.muted=false;s.sfx(name);
     const out=(await c.startRendering()).getChannelData(0);let energy=0,peak=0;for(const x of out){energy+=x*x;peak=Math.max(peak,Math.abs(x));}results.push({name,rms:Math.sqrt(energy/out.length),peak});
   }window.qaSound=live;return results;
 });check(effects.every(x=>x.rms>.001&&x.peak<1),'All 11 sound effects render audible, unclipped signals');
 // Repeated real retries must reuse one context and leave only three machinery voices.
 await page.locator('#editBtn').click();await page.locator('#levelSelect').selectOption('0');await page.locator('#skipIntro').click();await page.locator('#loadBtn').click();await page.locator('#startBtn').click();
 await page.evaluate(()=>window.initialContext=qaSound.ctx);
 for(let i=0;i<20;i++)await page.locator('#retryBtn').click();await page.waitForTimeout(1000);
 check(await page.evaluate(()=>qaSound.ctx===initialContext&&Object.keys(qaSound.voices).length===3&&qaSound.nodes.size<30),'Twenty retries keep one context and bounded active audio nodes');
 await page.locator('#autoBtn').click();await page.getByRole('heading',{name:'两个小家伙都到啦！'}).waitFor({timeout:20000});
 check(await page.evaluate(()=>qaSound.heard.includes('star')&&qaSound.heard.includes('win')),'Real UI playthrough triggers collectible and finish sounds');
 check(errors.length===0,'No browser exceptions');return {checks,music,effects};
}
