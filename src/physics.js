/* Shared browser / Node simulation, extracted from the supplied prototype.
 * Fixed 120 Hz; all driving uses torque/forces. No runtime position correction.
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('../vendor/matter.min.js'));
  else root.NaiPhysics=factory(root.Matter);
})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  const {Engine,Bodies,Body,Composite,Constraint,Vertices,Events}=M;
  const TILE=34, STEP=1000/120;
  const copy=x=>JSON.parse(JSON.stringify(x));
  function emptyBlueprint(){return {version:1,grid:{columns:5,rows:4},cockpit:null,parts:[]};}
  function validate(b,inventory,types,draft=false){
    if(!b||b.grid?.columns!==5||b.grid?.rows!==4||!Array.isArray(b.parts))return '蓝图格式不正确';
    const c=b.cockpit;
    if(c!==null&&(!c||typeof c!=='object'||Array.isArray(c)))return '双人舱数据不正确';
    if(!c&&!draft)return '先从零件栏放入奶蛋和奶豆的双人舱';
    if(c&&c.passengers?.join(',')!=='naidan,naidou')return '双人舱必须同时容纳奶蛋与奶豆';
    if(c&&(!Number.isInteger(c.x)||!Number.isInteger(c.y)||c.x<0||c.x>3||c.y<0||c.y>2))return '双人舱必须完整放在网格内';
    const cells=new Map(),frame=new Set(),counts={};
    if(c)for(let y=c.y;y<c.y+2;y++)for(let x=c.x;x<c.x+2;x++){cells.set(`${x},${y}`,'cockpit');frame.add(`${x},${y}`);}
    for(const p of b.parts){
      if(!types[p.type]||p.type==='cockpit'||!Number.isInteger(p.x)||!Number.isInteger(p.y)||p.x<0||p.x>4||p.y<0||p.y>3||!Number.isInteger(p.rotation)||p.rotation<0||p.rotation>3)return '存在无效零件、方向或坐标';
      const k=`${p.x},${p.y}`;if(cells.has(k))return '零件不能重叠';cells.set(k,p.type);
      if(p.type!=='wheel')frame.add(k);counts[p.type]=(counts[p.type]||0)+1;
    }
    for(const [t,n] of Object.entries(counts))if(n>(inventory[t]||0))return `${types[t].name}超出本关库存`;
    if(draft)return '';
    const q=[[c.x,c.y]],seen=new Set([`${c.x},${c.y}`]);
    for(let i=0;i<q.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=q[i][0]+dx,y=q[i][1]+dy,k=`${x},${y}`;if(frame.has(k)&&!seen.has(k)){seen.add(k);q.push([x,y]);}
    }
    if(seen.size!==frame.size)return '有零件未连接双人舱：请用木框连接';
    for(const p of b.parts.filter(p=>p.type==='wheel'))if(![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>frame.has(`${p.x+dx},${p.y+dy}`)))return '轮子必须紧邻车架或双人舱';
    if(counts.motor&&!counts.wheel)return '发动机通过轮轴传动，请连接轮子';
    return '';
  }
  function terrain(level){
    // Convex slabs have their top vertices exactly on the visible profile.
    return level.segments.map(([x1,y1,x2,y2])=>{
      const vs=[{x:x1,y:y1},{x:x2,y:y2},{x:x2,y:850},{x:x1,y:850}],c=Vertices.centre(vs);
      return Bodies.fromVertices(c.x,c.y,[vs],{isStatic:true,friction:1,frictionStatic:2,label:'terrain'});
    }).concat((level.platforms||[]).map(([x1,y1,x2,y2])=>{
      const vs=[{x:x1,y:y1},{x:x2,y:y2},{x:x2,y:y2+22},{x:x1,y:y1+22}],c=Vertices.centre(vs);
      return Bodies.fromVertices(c.x,c.y,[vs],{isStatic:true,friction:1,label:'bridge'});
    }), (level.obstacles||[]).map(o=>Bodies.rectangle(o.x,o.y,o.w,o.h,{isStatic:true,friction:.8,label:'obstacle'})));
  }
  class Simulation{
    constructor(config,index,blueprint){
      this.level=config.levels.levels[index];this.types=Object.fromEntries(config.parts.types.map(p=>[p.id,p]));
      const err=validate(blueprint,this.level.inventory,this.types);if(err)throw Error(err);
      this.blueprint=copy(blueprint);this.engine=Engine.create({gravity:{x:0,y:1,scale:.001},positionIterations:10,velocityIterations:10,constraintIterations:8});
      this.ground=terrain(this.level);Composite.add(this.engine.world,this.ground);
      const g=this.level.goal;this.goal=Bodies.rectangle(g.x,g.y-55,150,170,{isStatic:true,isSensor:true,label:'goal'});Composite.add(this.engine.world,this.goal);
      const bp=this.blueprint,defs=this.types,group=Body.nextGroup(true),ox=this.level.spawn.x;
      const bottom=Math.max((bp.cockpit.y+2)*TILE,...bp.parts.map(p=>(p.y+1)*TILE));
      const oy=this.level.spawn.groundY-bottom-5,cp=bp.cockpit;
      this.cabin=Bodies.rectangle(ox+(cp.x+1)*TILE,oy+(cp.y+1)*TILE,63,63,{density:defs.cockpit.density,label:'cockpit-piece'});
      const frame=[this.cabin];
      this.items=bp.parts.map(p=>({...p,worldX:ox+(p.x+.5)*TILE,worldY:oy+(p.y+.5)*TILE}));
      for(const p of this.items)if(p.type!=='wheel'){p.body=Bodies.rectangle(p.worldX,p.worldY,27,p.type==='wood'?22:27,{density:defs[p.type].density,label:p.type+'-piece'});frame.push(p.body);}
      this.chassis=Body.create({parts:frame,friction:.65,frictionAir:.0015,restitution:.02,collisionFilter:{group},label:'vehicle'});
      for(const p of this.chassis.parts)p.collisionFilter.group=group;
      this.wheels=[];this.joints=[];
      for(const p of this.items){
        p.attached=true;p.health=100;p.popped=false;
        p.mountOffset={x:p.worldX-this.chassis.position.x,y:p.worldY-this.chassis.position.y};
        if(p.type!=='wheel')continue;
        const wheel=Bodies.circle(p.worldX,p.worldY,defs.wheel.radius,{density:defs.wheel.density,friction:1,frictionStatic:2,frictionAir:.002,restitution:.01,collisionFilter:{group},label:'wheel'});
        p.body=wheel;this.wheels.push(wheel);p.joint=Constraint.create({bodyA:this.chassis,pointA:{...p.mountOffset},bodyB:wheel,length:0,stiffness:1,damping:.08,label:'axle'});this.joints.push(p.joint);
      }
      Composite.add(this.engine.world,[this.chassis,...this.wheels,...this.joints]);
      this.time=0;this.fuel=1;this.status='test';this.collected=[false,false,false];this.candy=false;this.maxAxleError=0;this.impact=0;
      this.passengers=['naidan','naidou'];this.motion=[{x:0,v:0},{x:0,v:0}];this.prevVX=0;
      this.damageEvents=[];this.pendingDamage=new Map();this.ventHeld=false;
      Events.on(this.engine,'collisionStart',e=>this.detectImpacts(e.pairs));
    }
    mount(p){return p.body.position;}
    angle(p){return p.attached&&p.type!=='wheel'?this.chassis.angle:p.body.angle;}
    attachedCount(type){return this.items.filter(p=>p.type===type&&p.attached&&!p.popped).length;}
    force(p,x,y){Body.applyForce(p.attached?this.chassis:p.body,this.mount(p),{x,y});}
    popBalloon(){const p=this.items.find(p=>p.type==='balloon'&&p.attached&&!p.popped);if(p){p.popped=true;this.damageEvents.push({type:'pop',x:p.body.position.x,y:p.body.position.y,time:this.time});}return !!p;}
    detectImpacts(pairs){
      for(const pair of pairs){
        if(pair.isSensor)continue;
        const hit=pair.collision,n=hit.normal;
        for(const [piece,other] of [[hit.bodyA,hit.bodyB],[hit.bodyB,hit.bodyA]]){
          if(!other.parent.isStatic)continue;
          let p=this.items.find(p=>p.attached&&p.body===piece);
          const parent=piece.parent,v=Body.getVelocity(parent),w=Body.getAngularVelocity(parent),r={x:piece.position.x-parent.position.x,y:piece.position.y-parent.position.y};
          const speed=Math.abs((v.x-w*r.y)*n.x+(v.y+w*r.x)*n.y);
          if(!p&&piece===this.cabin&&speed>17)p=this.items.filter(p=>p.attached).sort((a,b)=>Math.hypot(a.body.position.x-piece.position.x,a.body.position.y-piece.position.y)-Math.hypot(b.body.position.x-piece.position.x,b.body.position.y-piece.position.y))[0];
          if(!p)continue;
          if(p.type==='balloon'&&!p.popped&&speed>2){p.popped=true;continue;}
          const safe=p.type==='wheel'?19:p.type==='wood'?12:14;
          if(speed>safe)this.pendingDamage.set(p,Math.max(this.pendingDamage.get(p)||0,(speed-safe)*16));
        }
      }
    }
    detach(target){
      if(!target.attached)return;
      const c=this.chassis,centre={...c.position},velocity=Body.getVelocity(c),spin=Body.getAngularVelocity(c);
      const pointVelocity=pos=>({x:velocity.x-spin*(pos.y-centre.y),y:velocity.y+spin*(pos.x-centre.x)});
      const lost=new Set([target]),cp=this.blueprint.cockpit,seen=new Set(),queue=[];
      for(let x=cp.x;x<cp.x+2;x++)for(let y=cp.y;y<cp.y+2;y++){seen.add(`${x},${y}`);queue.push([x,y]);}
      const frame=new Map(this.items.filter(p=>p.attached&&p!==target&&p.type!=='wheel').map(p=>[`${p.x},${p.y}`,p]));
      for(let i=0;i<queue.length;i++)for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=queue[i][0]+dx,y=queue[i][1]+dy,key=`${x},${y}`;if(frame.has(key)&&!seen.has(key)){seen.add(key);queue.push([x,y]);}}
      for(const p of this.items)if(p.attached&&(p.type==='wheel'?![[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>seen.has(`${p.x+dx},${p.y+dy}`)):!seen.has(`${p.x},${p.y}`)))lost.add(p);
      const anchors=new Map(this.items.filter(p=>p.attached&&p.joint).map(p=>[p,{...Constraint.pointAWorld(p.joint)}]));
      for(const p of lost){
        p.attached=false;p.health=0;
        if(p.joint){Composite.remove(this.engine.world,p.joint);this.joints.splice(this.joints.indexOf(p.joint),1);}
        else{
          // Split at the existing world pose; inherit the rigid body's point velocity.
          // This is momentum transfer at fracture, never a scripted propulsion impulse.
          const old=p.body,b=Bodies.rectangle(old.position.x,old.position.y,27,p.type==='wood'?22:27,{angle:c.angle,density:this.types[p.type].density,friction:.65,frictionAir:.0015,restitution:.08,label:'debris-'+p.type});
          Body.setVelocity(b,pointVelocity(b.position));Body.setAngularVelocity(b,spin);p.body=b;Composite.add(this.engine.world,b);
        }
        p.body.collisionFilter.group=0;this.damageEvents.push({type:'break',part:p.type,x:p.body.position.x,y:p.body.position.y,time:this.time});
      }
      Body.setParts(c,[this.cabin,...this.items.filter(p=>p.attached&&p.type!=='wheel').map(p=>p.body)]);
      Body.setVelocity(c,pointVelocity(c.position));Body.setAngularVelocity(c,spin);
      for(const [p,a] of anchors)if(p.attached){p.joint.pointA={x:a.x-c.position.x,y:a.y-c.position.y};p.joint.angleA=c.angle;}
      Composite.setModified(this.engine.world,true,true,false);
    }
    step(input={}){
      if(this.status!=='test')return;
      const c=this.chassis,defs=this.types,dir=Number(!!input.right)-Number(!!input.left),motors=this.attachedCount('motor');
      if(input.vent&&!this.ventHeld)this.popBalloon();this.ventHeld=!!input.vent;
      const driven=this.items.filter(p=>p.type==='wheel'&&p.attached);
      for(const p of driven){const w=p.body;
        const rel=w.angularVelocity-c.angularVelocity;
        const torque=dir*defs.motor.torque*motors/Math.max(1,driven.length)*Math.max(0,1-dir*rel/defs.motor.maxSpeed);
        w.torque+=torque;c.torque-=torque; // equal and opposite axle reaction
        if(input.brake){const t=Math.max(-.14,Math.min(.14,-rel*.8));w.torque+=t;c.torque-=t;}
      }
      for(const p of this.items){
        const a=p.rotation*Math.PI/2+this.angle(p);
        if(p.type==='balloon'&&!p.popped)this.force(p,0,-defs.balloon.lift);
        if(p.type==='fan'&&p.attached&&input.fan)this.force(p,Math.cos(a)*defs.fan.thrust,Math.sin(a)*defs.fan.thrust);
        if(p.type==='rocket'&&p.attached&&input.rocket&&this.fuel>0)this.force(p,Math.cos(a)*defs.rocket.thrust,Math.sin(a)*defs.rocket.thrust);
      }
      if(input.rocket&&this.items.some(p=>p.type==='rocket'))this.fuel=Math.max(0,this.fuel-STEP/defs.rocket.fuelMs);
      Engine.update(this.engine,STEP);this.time+=STEP/1000;
      for(const [p,damage] of this.pendingDamage)if(p.attached){p.health-=damage;if(p.health<=0)this.detach(p);}this.pendingDamage.clear();
      this.damageEvents=this.damageEvents.filter(e=>this.time-e.time<1.2);
      const dv=c.velocity.x-this.prevVX;this.prevVX=c.velocity.x;
      this.motion.forEach((m,i)=>{m.v+=(-dv*(i?1.9:1.3)-m.x*(i?.055:.075));m.v*=.82;m.x=Math.max(-3,Math.min(3,m.x+m.v));});
      for(const j of this.joints){const a=Constraint.pointAWorld(j),b=Constraint.pointBWorld(j);this.maxAxleError=Math.max(this.maxAxleError,Math.hypot(a.x-b.x,a.y-b.y));}
      const p=this.cabin.position,g=this.level.goal;
      for(let i=0;i<(this.level.stars||[]).length;i++){const star=this.level.stars[i];if(Math.hypot(p.x-star.x,p.y-star.y)<38)this.collected[i]=true;}
      this.candy=this.collected.some(Boolean);
      if(!Number.isFinite(p.x+p.y+c.angle)||p.y>760||p.y< -350||p.x< -200||p.x>g.x+550)this.status='failed';
      // Only the occupied cabin counts. A long chassis / wheel touching the goal cannot win.
      if(this.status==='test'&&this.passengers.join(',')==='naidan,naidou'&&this.cabin.vertices.every(v=>v.x>=g.x-75&&v.x<=g.x+75&&v.y>=g.y-140&&v.y<=g.y+30))this.status='success';
    }
  }
  return {Simulation,validate,emptyBlueprint,terrain,STEP};
});
