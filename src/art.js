/* Original scenery and parts. Character sprites are background extractions from user references. */
window.NaiArt=(()=>{
 const egg=new Image(),bean=new Image();egg.src='assets/naidan.png';bean.src='assets/naidou.png';
 const palette={meadow:['#bfe7ea','#f2efc1','#9bc9a6','#609c83'],forest:['#bfdfd7','#e6e6ad','#86b39c','#538a73'],river:['#c4e8ec','#ebf1cf','#a0cbb3','#6ba393'],sky:['#cae8f4','#f7eed1','#afcbbc','#85ad9c'],sunset:['#f0d8b1','#f5dfad','#c9bb9b','#9aab90']};
 function rr(c,x,y,w,h,r,fill,stroke){c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}}
 function cloud(c,x,y,z){c.fillStyle='#fffdf2b0';c.beginPath();c.ellipse(x,y,55*z,14*z,0,0,7);c.ellipse(x-23*z,y-9*z,23*z,20*z,0,0,7);c.ellipse(x+10*z,y-17*z,30*z,25*z,0,0,7);c.fill();}
 function background(c,l,camera,now,height=540){
  const p=palette[l.theme]||palette.meadow,g=c.createLinearGradient(0,0,0,height);g.addColorStop(0,p[0]);g.addColorStop(1,p[1]);c.fillStyle=g;c.fillRect(0,0,960,height);
  c.fillStyle='#fff7c7';c.beginPath();c.arc(760-camera*.035,100,43,0,7);c.fill();
  for(let i=0;i<7;i++)cloud(c,((i*230+90-camera*.08)%1400+1400)%1400-100,72+(i%3)*41,.7+(i%2)*.3);
  for(let layer=0;layer<3;layer++){c.fillStyle=[p[2]+'70',p[2],p[3]+'70'][layer];c.beginPath();c.moveTo(0,540);for(let x=-60;x<1030;x+=16){const wx=x+camera*(.08+layer*.07);const y=310+layer*64+Math.sin(wx*.005+layer*2)*55+Math.sin(wx*.011+layer)*22;c.lineTo(x,y);}c.lineTo(1030,540);c.fill();}
  // A distant windmill is a landmark, never a collidable foreground obstruction.
  const x=660-camera*.18,y=315;c.fillStyle='#edf0d6';c.beginPath();c.moveTo(x-12,y);c.lineTo(x-7,y-63);c.lineTo(x+8,y-63);c.lineTo(x+15,y);c.fill();c.fillStyle='#8ba08b';c.beginPath();c.moveTo(x-13,y-62);c.lineTo(x,y-78);c.lineTo(x+13,y-62);c.fill();
  c.save();c.translate(x,y-56);c.rotate(.4);c.strokeStyle='#809884';c.lineWidth=3;for(let i=0;i<4;i++){c.rotate(Math.PI/2);c.beginPath();c.moveTo(0,0);c.lineTo(38,0);c.stroke();rr(c,12,-7,26,7,1,'#eff2d1','#a8b59a');}c.restore();
 }
 function renderTerrain(c,l,now){
  // Cacheable deterministic rock pattern clipped to actual collision geometry.
  for(const [x1,y1,x2,y2] of l.segments){
   c.save();c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.lineTo(x2,900);c.lineTo(x1,900);c.closePath();c.clip();
   const g=c.createLinearGradient(0,180,0,850);g.addColorStop(0,'#b6ad84');g.addColorStop(.18,'#9b9a77');g.addColorStop(1,'#72876e');c.fillStyle=g;c.fillRect(x1,Math.min(y1,y2),x2-x1,900);
   for(let row=0;row<13;row++)for(let x=Math.floor(x1/67)*67-67;x<x2+67;x+=67){const seed=Math.sin(x*.13+row*72)*.5+.5,xx=x+(row%2)*31,yy=330+row*47+seed*13;c.fillStyle=['#d2cba244','#596f5930','#dce0b52b'][row%3];c.beginPath();c.moveTo(xx,yy);c.lineTo(xx+30+seed*24,yy-8);c.lineTo(xx+56,yy+22);c.lineTo(xx+22,yy+34);c.lineTo(xx-3,yy+18);c.closePath();c.fill();}
   c.restore();c.lineCap='round';c.lineJoin='round';c.strokeStyle='#476d42';c.lineWidth=13;c.beginPath();c.moveTo(x1,y1+6);c.lineTo(x2,y2+6);c.stroke();c.strokeStyle='#8fb962';c.lineWidth=9;c.beginPath();c.moveTo(x1,y1+2);c.lineTo(x2,y2+2);c.stroke();c.strokeStyle='#bdcf7c';c.lineWidth=2;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
   for(let x=x1+18;x<x2-8;x+=31){const y=y1+(y2-y1)*(x-x1)/(x2-x1);c.strokeStyle='#668e48';c.lineWidth=1.4;c.beginPath();c.moveTo(x-3,y+3);c.lineTo(x-5,y-4);c.moveTo(x,y+2);c.lineTo(x+2,y-5);c.stroke();if(Math.floor(x/31)%5===0){c.fillStyle='#fff0ae';c.beginPath();c.arc(x+2,y-6,2,0,7);c.fill();}}
  }
  for(const [x1,y1,x2,y2] of l.platforms||[]){c.save();c.translate(x1,y1);c.rotate(Math.atan2(y2-y1,x2-x1));const len=Math.hypot(x2-x1,y2-y1);rr(c,0,0,len,22,2,'#ad8353','#624f36');for(let x=8;x<len;x+=20){c.strokeStyle='#684e33';c.beginPath();c.moveTo(x,1);c.lineTo(x-2,20);c.stroke();}c.strokeStyle='#98794e';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(0,-32);c.lineTo(len,-32);c.lineTo(len,0);c.stroke();c.restore();}
  for(const o of l.obstacles||[])rr(c,o.x-o.w/2,o.y-o.h/2,o.w,o.h,5,'#89987b','#4c674d');
  const g=l.goal; c.strokeStyle='#f8f2c5';c.lineWidth=5;c.beginPath();c.moveTo(g.x-50,g.y);c.lineTo(g.x-50,g.y-120);c.moveTo(g.x+50,g.y);c.lineTo(g.x+50,g.y-120);c.stroke();
  for(let i=0;i<10;i++)for(let j=0;j<2;j++){c.fillStyle=(i+j)%2?'#4c6a53':'#fff7d6';c.fillRect(g.x-50+i*10,g.y-120+j*10,10,10);}
  c.fillStyle='#fcf5d1';c.font='bold 13px sans-serif';c.textAlign='center';c.fillText('一起到家',g.x,g.y-132);c.textAlign='left';
  house(c,g.x+100,g.y);sign(c,l.spawn.x-35,l.spawn.groundY,'出发 →');
  if(l.rocketWindow)sign(c,l.rocketWindow[0],430,'点火 ↑');
  if(l.theme==='river'){sign(c,700,385,'断桥！');sign(c,850,620,'谷底也能走 →');}
  // Small scenery follows the ground profile, never disguises a collision.
  for(let i=0;i<l.segments.length;i+=2){const [x1,y1,x2,y2]=l.segments[i],x=x2-32,y=y2-2;if(x>l.spawn.x+210&&x<g.x-80){c.fillStyle='#648a4d';c.beginPath();c.ellipse(x,y-8,16,10,0,0,7);c.ellipse(x+18,y-6,12,8,0,0,7);c.fill();c.fillStyle='#ded9aa';c.fillRect(x+6,y-13,4,13);c.fillStyle='#c78c69';c.beginPath();c.ellipse(x+8,y-14,9,5,0,Math.PI,7);c.fill();}}
 }
 function sign(c,x,y,text){rr(c,x-3,y-37,6,37,2,'#967044');rr(c,x-30,y-50,82,25,4,'#e8cf8e','#876f47');c.fillStyle='#6b613d';c.font='bold 10px sans-serif';c.fillText(text,x-23,y-34);}
 function house(c,x,y){rr(c,x-25,y-53,50,53,4,'#f0dfad','#8e8964');c.fillStyle='#8fa17a';c.beginPath();c.moveTo(x-35,y-50);c.lineTo(x,y-85);c.lineTo(x+35,y-50);c.closePath();c.fill();rr(c,x-7,y-28,14,28,5,'#9d8051');rr(c,x-20,y-40,10,12,3,'#a9d6d0','#8e8964');c.fillStyle='#b0c68a';c.beginPath();c.ellipse(x+30,y-5,18,9,0,0,7);c.fill();}
 function wood(c,x,y,w=29,h=27){rr(c,x-w/2,y-h/2,w,h,2,'#a97540','#674e32');rr(c,x-w/2+4,y-h/2+4,w-8,h-8,1,'#e5bb72','#b58b4c');c.fillStyle='#725235';for(const dx of [-w/2+3,w/2-3])for(const dy of [-h/2+3,h/2-3]){c.beginPath();c.arc(x+dx,y+dy,1,0,7);c.fill();}}
 function part(c,p,x,y,angle=0,t=0,active=false){
  c.save();c.translate(x,y);c.rotate(angle);const type=p.type;
  if(type==='wood'){wood(c,0,0);rr(c,-8,-7,16,14,1,'#9ec6a5');c.strokeStyle='#b7894c';c.lineWidth=2;c.beginPath();c.moveTo(-10,-8);c.lineTo(10,8);c.stroke();}
  if(type==='wheel'){c.fillStyle='#4b5047';c.beginPath();c.arc(0,0,17,0,7);c.fill();c.strokeStyle='#2d3c35';c.lineWidth=3;c.stroke();c.fillStyle='#bcbda0';c.beginPath();c.arc(0,0,12,0,7);c.fill();c.strokeStyle='#626d58';c.lineWidth=2;for(let i=0;i<8;i++){const a=i*Math.PI/4;c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*11,Math.sin(a)*11);c.stroke();}rr(c,-4,-4,8,8,3,'#e9d8a5','#776b4b');}
  if(type==='motor'){rr(c,-13,-10,26,23,4,'#a2aaa0','#4c645b');rr(c,-9,-15,16,8,2,'#c1b99c','#65705d');rr(c,8,-18,5,14,1,'#6c7b6a');for(let i=0;i<3;i++)rr(c,-9,-5+i*5,16,2,1,'#596c60');c.fillStyle='#e2bb6a';c.beginPath();c.arc(0,1,3,0,7);c.fill();if(active){c.fillStyle='#ececd490';c.beginPath();c.arc(11,-24-(t*20%12),4,0,7);c.fill();}}
  if(type==='fan'){c.rotate(p.rotation*Math.PI/2);rr(c,-11,-9,15,18,3,'#86a99e','#4b6b5d');c.strokeStyle='#698476';c.lineWidth=2;c.beginPath();c.arc(5,0,16,0,7);c.stroke();c.save();c.translate(5,0);c.rotate(active?t*30:.5);for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);rr(c,-3,-14,6,14,3,'#c1d5bb','#6f9280');}c.restore();c.fillStyle='#ecd295';c.beginPath();c.arc(5,0,4,0,7);c.fill();}
  if(type==='balloon'){c.strokeStyle='#bba776';c.lineWidth=1.5;c.beginPath();c.moveTo(0,12);c.quadraticCurveTo(4,1,0,-6);c.stroke();const g=c.createRadialGradient(-5,-14,1,0,-9,18);g.addColorStop(0,'#fff2c3');g.addColorStop(1,'#e8ad73');c.fillStyle=g;c.beginPath();c.ellipse(0,-12,13,16,0,0,7);c.fill();c.strokeStyle='#b88b5a';c.stroke();}
  if(type==='rocket'){c.rotate(p.rotation*Math.PI/2);rr(c,-14,-7,25,14,4,'#d6b985','#866c4b');c.fillStyle='#bf7552';c.beginPath();c.moveTo(9,-7);c.lineTo(19,0);c.lineTo(9,7);c.fill();if(active){c.fillStyle='#f6cd63';c.beginPath();c.moveTo(-13,-6);c.lineTo(-29-Math.sin(t*80)*7,0);c.lineTo(-13,6);c.fill();}}
  c.restore();
 }
 function cabin(c,x,y,angle,motion=[{x:0},{x:0}]){
  c.save();c.translate(x,y);c.rotate(angle);
  rr(c,-31,-31,62,62,3,'#d7e3bd55','#775c39');
  for(const [img,px,i] of [[egg,-30,0],[bean,0,1]])if(img.complete&&img.naturalWidth){const lean=motion[i]?.x||0;c.save();c.translate(px+16+lean,-1);c.rotate(lean*.018);c.drawImage(img,-22,-26,44,46);c.restore();}
  // Open wood cabin, passengers stay fully visible behind the lower safety rail.
  rr(c,-33,-33,66,5,1,'#c69450','#785931');rr(c,-33,25,66,7,1,'#c69450','#785931');rr(c,-33,-30,5,58,1,'#bd8848','#785931');rr(c,28,-30,5,58,1,'#bd8848','#785931');
  c.fillStyle='#f3dfab';for(const x of [-30,30])for(const y of [-30,29]){c.beginPath();c.arc(x,y,1.4,0,7);c.fill();}c.restore();
 }
 let cache=null,cacheLevel=null;
 function terrain(c,l,now){
  if(cacheLevel!==l){cache=document.createElement('canvas');cache.width=Math.ceil((l.worldWidth+200)*1.5);cache.height=1350;const cc=cache.getContext('2d');cc.scale(1.5,1.5);renderTerrain(cc,l,now);cacheLevel=l;}
  c.drawImage(cache,0,0,cache.width/1.5,900);
 }
 return {background,terrain,part,cabin,egg,bean};
})();
