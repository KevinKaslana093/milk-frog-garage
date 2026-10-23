/* Original procedural score and sound design. No external audio downloads.
 * One context, three reusable machinery voices, bounded one-shots; RAF schedules
 * a short audio-clock lookahead, so tab pauses cannot accumulate a timer backlog.
 */
(() => {
  'use strict';
  const hz = midi => 440 * 2 ** ((midi - 69) / 12);
  const melody = [76,0,79,76,74,72,0,67, 72,74,76,0,79,76,74,0,
    77,0,81,79,77,76,74,0, 71,74,79,0,77,74,71,0,
    76,79,84,0,83,79,76,0, 81,79,76,74,72,0,69,0,
    77,76,74,72,71,74,79,0, 76,74,72,0,67,71,72,0];
  class Soundscape {
    constructor() {
      this.ctx=null; this.nodes=new Set(); this.paused=false; this.mode='build';
      this.music=.55; this.effects=.75; this.muted=false; this.beat=0; this.next=0;
      this.lastEffects=new Map(); this.lastEvent=0; this.run=null;
      try {
        const s=JSON.parse(localStorage.getItem('naiwa-audio-v1')||'null');
        if(s && typeof s==='object') {
          for(const key of ['music','effects'])if(typeof s[key]==='number'&&Number.isFinite(s[key]))this[key]=Math.max(0,Math.min(1,s[key]));
          this.muted=s.muted===true;
        } else this.muted=localStorage.getItem('naiwa-muted')==='true';
      } catch(_) {}
    }
    unlock() {
      try {
        if(!this.ctx) {
          const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
          this.ctx=new Context();const c=this.ctx;
          this.master=c.createGain();this.musicBus=c.createGain();this.fxBus=c.createGain();
          const limiter=c.createDynamicsCompressor();limiter.threshold.value=-15;limiter.knee.value=15;limiter.ratio.value=5;
          this.musicBus.connect(this.master);this.fxBus.connect(this.master);this.master.connect(limiter);limiter.connect(c.destination);
          this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const channel=this.noise.getChannelData(0);let seed=918273;
          for(let i=0;i<channel.length;i++){seed=(1664525*seed+1013904223)>>>0;channel[i]=(seed/4294967296)*2-1;}
          this.voices={};
          for(const name of ['engine','fan','rocket']) {
            const source=name==='engine'?c.createOscillator():c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
            if(name==='engine'){source.type='triangle';source.frequency.value=65;filter.type='lowpass';filter.frequency.value=500;}
            else{source.buffer=this.noise;source.loop=true;filter.type=name==='fan'?'bandpass':'lowpass';filter.frequency.value=name==='fan'?450:1200;filter.Q.value=.6;}
            gain.gain.value=0;source.connect(filter).connect(gain).connect(this.fxBus);source.start();this.voices[name]={source,filter,gain};
          }
          this.next=c.currentTime+.04;this.applyVolumes();
        }
        if(!this.paused)this.ctx.resume().catch(()=>{});
      } catch(_) { /* Silent fallback keeps the game playable without Web Audio. */ }
    }
    configure(key,value) {
      if(key==='muted')this.muted=!!value;
      else if(['music','effects'].includes(key)&&Number.isFinite(value))this[key]=Math.max(0,Math.min(1,value));
      this.applyVolumes();
      try{localStorage.setItem('naiwa-audio-v1',JSON.stringify({music:this.music,effects:this.effects,muted:this.muted}));localStorage.setItem('naiwa-muted',String(this.muted));}catch(_){}
    }
    applyVolumes() {
      if(!this.ctx)return;const t=this.ctx.currentTime;
      for(const [node,value] of [[this.master,this.paused||this.muted?0:1],[this.musicBus,this.music],[this.fxBus,this.effects]]){
        node.gain.cancelScheduledValues(t);node.gain.setTargetAtTime(value,t,.015);
      }
    }
    silenceNotes() {for(const n of this.nodes){try{n.source.stop();}catch(_){}n.source.disconnect();n.gain.disconnect();if(n.filter)n.filter.disconnect();}this.nodes.clear();}
    setPaused(value) {
      if(this.paused===value)return;this.paused=value;
      if(!this.ctx)return;
      this.silenceNotes();this.stopMachines();this.applyVolumes();
      if(value){this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setValueAtTime(0,this.ctx.currentTime);this.ctx.suspend().catch(()=>{});}
      else{this.next=this.ctx.currentTime+.05;this.unlock();}
    }
    setMode(mode) {
      const next=mode==='test'?'drive':'build';
      if(next!==this.mode){this.mode=next;this.beat=0;if(this.ctx){this.silenceNotes();this.next=this.ctx.currentTime+.05;}}
      if(mode!=='test')this.stopMachines();
    }
    stopMachines(){if(this.voices)for(const v of Object.values(this.voices)){v.gain.gain.cancelScheduledValues(this.ctx.currentTime);v.gain.gain.setValueAtTime(0,this.ctx.currentTime);}}
    note(freq,time,duration,volume,type='triangle',bus=this.musicBus,endFreq) {
      if(this.nodes.size>=80)return;
      const c=this.ctx,source=c.createOscillator(),gain=c.createGain();source.type=type;source.frequency.setValueAtTime(freq,time);
      if(endFreq)source.frequency.exponentialRampToValueAtTime(endFreq,time+duration);
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.006);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
      source.connect(gain).connect(bus);this.track(source,gain);source.start(time);source.stop(time+duration+.01);
    }
    noiseHit(time,duration,volume,frequency,bus=this.fxBus) {
      if(this.nodes.size>=80)return;
      const c=this.ctx,source=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter();source.buffer=this.noise;
      filter.type='lowpass';filter.frequency.value=frequency;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(volume,time+.004);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
      source.connect(filter).connect(gain).connect(bus);this.track(source,gain,filter);source.start(time);source.stop(time+duration+.01);
    }
    track(source,gain,filter) {const n={source,gain,filter};this.nodes.add(n);source.onended=()=>{source.disconnect();gain.disconnect();filter?.disconnect();this.nodes.delete(n);};}
    sfx(name,strength=1) {
      if(!this.ctx||this.ctx.state!=='running'||this.paused||this.muted||!this.effects)return;
      const t=this.ctx.currentTime;
      if(t-(this.lastEffects.get(name)??-10)<(name==='impact'?.1:.04))return;
      this.lastEffects.set(name,t);
      const note=(m,d=.13,v=.15,delay=0,type='triangle')=>this.note(hz(m),t+delay,d,v,type,this.fxBus);
      if(name==='star'){[79,83,86,91].forEach((m,i)=>note(m,.22,.13,i*.055));}
      else if(name==='win'){[72,76,79,84,79,84,88].forEach((m,i)=>note(m,.35,.15,i*.11));}
      else if(name==='fail'){[67,64,60,55].forEach((m,i)=>note(m,.27,.13,i*.13));}
      else if(name==='start'){[60,67,72].forEach((m,i)=>note(m,.18,.12,i*.07));}
      else if(name==='pop'){this.noiseHit(t,.17,.32,2500);this.note(180,t,.1,.19,'sine',this.fxBus,45);}
      else if(name==='break'){this.noiseHit(t,.28,.4,1700);this.noiseHit(t+.065,.17,.24,3300);this.note(110,t,.18,.2,'triangle',this.fxBus,35);}
      else if(name==='impact'){this.noiseHit(t,.09,.1*Math.min(2,strength),700);this.note(90,t,.11,.12*Math.min(2,strength),'sine',this.fxBus,42);}
      else if(name==='place'){note(62,.055,.13);this.noiseHit(t,.035,.13,1600);}
      else if(name==='remove'){note(55,.07,.12);this.noiseHit(t,.04,.1,900);}
      else if(name==='ignite'){this.noiseHit(t,.32,.22,2300);}
      else {note(name==='switch'?74:79,.07,.09);}
    }
    schedule() {
      const c=this.ctx,drive=this.mode==='drive',step=60/(drive?134:112)/2;
      if(this.next<c.currentTime-.15)this.next=c.currentTime+.03;
      while(this.next<c.currentTime+.16){
        const b=this.beat%128,bar=Math.floor(b/8),slot=b%8,t=this.next;
        const roots=[48,45,53,55,48,45,53,55,48,52,53,55,45,53,55,48];
        const root=roots[bar],minor=[1,5,9,12].includes(bar),chord=[root+12,root+(minor?15:16),root+19];
        if(this.music&&!this.muted){
          if(slot===0||slot===4)this.note(hz(root+(slot===4?7:0)),t,.27,.15,'sine');
          if(slot===2||slot===6)chord.forEach((m,i)=>this.note(hz(m),t+i*.012,.17,.035));
          const m=melody[b%64];if(m){this.note(hz(m),t,slot===7?.35:.23,.105,'triangle');this.note(hz(m+12),t,.09,.025,'sine');}
          if(drive){if(slot%2===0)this.note(95,t,.09,.09,'sine',this.musicBus,38);if(slot===2||slot===6)this.noiseHit(t,.055,.055,1900,this.musicBus);}
          if(slot%2===1)this.noiseHit(t,.025,.022,5000,this.musicBus);
        }
        this.next+=step;this.beat++;
      }
    }
    update(state,sim,input) {
      if(!this.ctx||this.ctx.state!=='running'||this.paused)return;
      this.schedule();
      if(state!=='test'||!sim){this.stopMachines();return;}
      if(this.run!==sim){this.run=sim;this.lastEvent=0;this.rocketOn=false;}
      const speed=Math.hypot(sim.chassis.velocity.x,sim.chassis.velocity.y),dir=Number(!!input.right)-Number(!!input.left);
      const motor=dir&&sim.attachedCount('motor')&&sim.attachedCount('wheel');
      const fans=sim.items.filter(p=>p.type==='fan'&&p.attached&&input.fans[p.fanIndex]).length;
      const rocket=!!(input.rocket&&sim.fuel>0&&sim.attachedCount('rocket'));
      if(rocket&&!this.rocketOn)this.sfx('ignite');this.rocketOn=rocket;
      const t=this.ctx.currentTime;
      this.voices.engine.source.frequency.setTargetAtTime(55+Math.min(140,speed*12),t,.1);
      this.voices.fan.filter.frequency.setTargetAtTime(380+fans*110,t,.08);
      for(const [name,value] of [['engine',motor?.075:0],['fan',fans?Math.min(.14,.055+fans*.025):0],['rocket',rocket?.2:0]]){
        this.voices[name].gain.gain.setTargetAtTime(value,t,.035);
      }
      for(const e of sim.damageEvents)if(e.id>this.lastEvent){this.lastEvent=e.id;this.sfx(e.type,e.strength||1);}
    }
  }
  window.NaiAudio={Soundscape};
})();
