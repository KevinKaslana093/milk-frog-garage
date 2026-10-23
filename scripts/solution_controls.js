// Test fixtures only: the player always starts with an empty workshop.
module.exports=function solutionInput(level,route=0){let phase=0;return s=>{
 const k=level.solution?.kind||'drive',p=s.cabin.position;
 if(k==='switchback'){if(phase===0&&p.y>330)phase=1;if(phase===1&&p.y>525)phase=2;return {right:phase!==1,left:phase===1};}
 const windows=level.solution?.windows||[level.rocketWindow||[650,810]];
 return {right:k!=='coast',fan:k==='fan'||k==='balloon'||(k==='bridge'&&route===0),rocket:k==='rocket'&&windows.some(([a,b])=>p.x>a&&p.x<b),vent:k==='balloon'&&(level.solution.popX?p.x>level.solution.popX:p.y<250)};
};};
