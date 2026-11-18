/* ============================================================
   操作まわり：assets/js/input.js
   キーやボタンを変えたいときはここだけ
   ★ PC：攻撃は Space キー。押して離す＝通常攻撃、長押しして離す＝溜め攻撃
        狙う操作はなし：攻撃はオートエイム（射程内の一番近い敵を自動で狙う）
        キャラの向きは移動方向に連動する（game.js の update で処理）
   ★ スマホ：攻撃ボタンも同じ。タップ＝通常攻撃、長押し＝溜め攻撃（こちらもオートエイム）
   実際の攻撃・溜め判定は game.js の beginHold() / endHold()
   ============================================================ */
addEventListener('keydown',e=>{
 keys[e.key.toLowerCase()]=true;
 if(e.key===' '){ e.preventDefault(); if(!e.repeat){ atkHeld=true; beginHold(); } }
 if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(e.key.toLowerCase())) e.preventDefault();
});
addEventListener('keyup',e=>{
 keys[e.key.toLowerCase()]=false;
 if(e.key===' '){ atkHeld=false; endHold(); }
});
addEventListener('blur',()=>{ keys={}; if(atkHeld){ atkHeld=false; if(player) player.holding=false; } });
canvas.addEventListener('mousemove',e=>{ const r=canvas.getBoundingClientRect(); mouse.x=e.clientX-r.left; mouse.y=e.clientY-r.top; });
canvas.addEventListener('contextmenu',e=>e.preventDefault());

const joy=document.getElementById('joy'), knob=document.getElementById('joyKnob'); let joyId=null;
joy.addEventListener('pointerdown',e=>{joyId=e.pointerId; joy.setPointerCapture(e.pointerId); moveJoy(e);});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId) moveJoy(e);});
joy.addEventListener('pointerup',()=>{joyId=null; joyVec={x:0,y:0}; knob.style.left='33px'; knob.style.top='33px';});
function moveJoy(e){ const r=joy.getBoundingClientRect(); let dx=e.clientX-(r.left+r.width/2), dy=e.clientY-(r.top+r.height/2); const l=Math.hypot(dx,dy), max=36; if(l>max){dx=dx/l*max; dy=dy/l*max;} joyVec={x:dx/max,y:dy/max}; knob.style.left=(33+dx)+'px'; knob.style.top=(33+dy)+'px'; if(player) player.angle=Math.atan2(dy,dx); }
const atkBtn=document.getElementById('atkBtn');
atkBtn.addEventListener('pointerdown',e=>{e.preventDefault(); touchMode=true; atkHeld=true; atkBtn.classList.add('holding'); beginHold();});
['pointerup','pointerleave','pointercancel'].forEach(ev=>atkBtn.addEventListener(ev,()=>{ if(atkHeld&&touchMode){ atkHeld=false; atkBtn.classList.remove('holding'); endHold(); } }));

document.getElementById('startBtn').onclick=startGame;
document.getElementById('toBattleBtn').onclick=startGame;
document.getElementById('againBtn').onclick=startGame;
document.getElementById('changeBtn').onclick=()=>{document.getElementById('endScreen').classList.add('hidden'); const s=document.getElementById('startScreen'); s.classList.remove('hidden'); document.getElementById('topbar').classList.add('hidden'); state='menu'; showRoom('chars');};
document.getElementById('restartTop').onclick=()=>{ if(state==='playing'||state==='ended') startGame(); else { document.getElementById('startScreen').classList.remove('hidden'); } };
