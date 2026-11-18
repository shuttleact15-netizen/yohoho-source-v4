/* ============================================================
   バトル本体：assets/js/game.js
   キャラ性能と全体バランスの数値は assets/js/data.js
   （REGEN_DELAY / REGEN_RATE / キューブ倍率などもそちら）
   ここにあるのは毒ゾーンの段階ダメージとゾーンの縮み方だけ
   操作まわりは assets/js/input.js を見る

   【このファイルの中身（上から順に）】
     1. 毒ゾーンのダメージ計算・共通の小物関数
     2. バトル開始（startGame）・勝敗判定（checkWin / endGame）
     3. 戦闘（通常攻撃 attack／溜め攻撃 chargeAttack／オートエイム）
     4. BOTの動き（botAI）
     5. 毎フレームの更新（update：移動・リロード・自動回復・HUD）
     6. 描画（drawEntity などキャラ描画／drawWorld）
   ============================================================ */
/* 毒ゾーンの毎秒ダメージ：ゾーンが小さい（終盤）ほど強い。
   序盤は逃げ遅れても立て直せるが、終盤は回復（最大HPの6%/秒）より
   毒の方が速くなり、隠れ続けることはできない */
function poisonDps(){
 if(zone.targetR>=520) return 35;
 if(zone.targetR>=360) return 50;
 if(zone.targetR>=220) return 60;
 return 75;
}
function maxHpOf(e){ return e.maxHp + e.power*POWER_HP_PER_CUBE; }
const canvas=document.getElementById('game'), ctx=canvas.getContext('2d');
let W=960,H=640, DPR=1;
function resize(){ const r=canvas.parentElement.getBoundingClientRect(); DPR=Math.min(devicePixelRatio||1,2); W=r.width; H=r.height; canvas.width=W*DPR; canvas.height=H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); }
addEventListener('resize',resize);

let state='menu', entities=[], bullets=[], particles=[], cubes=[], crates=[], floaters=[];
let zone={x:0,y:0,r:0,targetR:0}, cam={x:0,y:0}, keys={}, mouse={x:0,y:0,down:false}, startTime=0, elapsed=0, shake=0;
let player=null, joyVec={x:0,y:0}, atkHeld=false, touchMode=false, winScheduled=false;
const WORLD=1600;
const names=BOT_NAMES;

function rand(a,b){return a+Math.random()*(b-a)}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function angleTo(a,b){return Math.atan2(b.y-a.y,b.x-a.x)}
function fmt(s){return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')}

function makeEntity(charDef,x,y,isPlayer,name){
 return {x,y,vx:0,vy:0,char:charDef,hp:charDef.hp,maxHp:charDef.hp,r:charDef.r||22,angle:rand(0,6.28),cool:0,power:0,alive:true,isPlayer,name,think:rand(0,.3),tx:x,ty:y,hitFlash:0,kills:0,regen:0,swing:0,bob:rand(0,6.28),skin:isPlayer?charDef.skin:BOT_SKINS[Math.floor(Math.random()*BOT_SKINS.length)],
  ammo:charDef.ammo||0, reloadT:0, holding:false, chargeT:0, dashT:0, dashDir:0, dashHit:null, botChargeCd:rand(2,5),
  /* 自動回復用：最後に「攻撃した／された」からの経過秒数。REGEN_DELAY を超えると回復が始まる */
  lastCombat:REGEN_DELAY+1, isRegen:false, regenFxT:0};
}
function startGame(){
 const pc=CHARS[selected];
 entities=[]; bullets=[]; particles=[]; cubes=[]; crates=[]; floaters=[];
 zone={x:WORLD/2,y:WORLD/2,r:720,targetR:720};
 player=makeEntity(pc,WORLD/2+rand(-80,80),WORLD/2+rand(-80,80),true,'あなた');
 entities.push(player);
 /* ★ 参加者はここで作る全10人（あなた＋BOT9人）だけ。バトル中に追加・復活は一切しない */
 for(let i=0;i<BOT_COUNT;i++){ const c=CHARS[Math.floor(Math.random()*3)]; const a=i/BOT_COUNT*Math.PI*2; entities.push(makeEntity(c,WORLD/2+Math.cos(a)*480,WORLD/2+Math.sin(a)*480,false,names[i])); }
 winScheduled=false;
 for(let i=0;i<14;i++){ const a=rand(0,6.28), d=rand(80,620); crates.push({x:WORLD/2+Math.cos(a)*d,y:WORLD/2+Math.sin(a)*d,hp:400,r:24,alive:true}); }
 for(let i=0;i<10;i++){ const a=rand(0,6.28), d=rand(100,600); cubes.push({x:WORLD/2+Math.cos(a)*d,y:WORLD/2+Math.sin(a)*d,r:11}); }
 state='playing'; startTime=performance.now(); elapsed=0;
 document.getElementById('startScreen').classList.add('hidden');
 document.getElementById('endScreen').classList.add('hidden');
 document.getElementById('topbar').classList.remove('hidden');
 document.getElementById('hud').classList.remove('hidden');
 document.getElementById('pname').textContent=pc.emoji+' '+pc.name;
 document.getElementById('aliveUI').textContent=TOTAL_PLAYERS;
 document.getElementById('killUI').textContent='0';
 feed(`🏁 バトル開始！全${TOTAL_PLAYERS}人（あなた＋BOT${BOT_COUNT}人）、最後の1人まで生き残れ！`);
}
function feed(t){ const el=document.getElementById('killfeed'); const d=document.createElement('div'); d.textContent=t; el.prepend(d); setTimeout(()=>d.remove(),3800); while(el.children.length>4) el.lastChild.remove(); }

function damage(target,amt,attacker){
 if(!target.alive) return; target.hp-=amt; target.hitFlash=0.12;
 /* ダメージを受けたら回復タイマーはリセット。与えた側も「戦闘中」なので同じくリセット */
 target.lastCombat=0; target.isRegen=false;
 if(attacker&&attacker!==target){ attacker.lastCombat=0; attacker.isRegen=false; }
 floaters.push({x:target.x+rand(-10,10),y:target.y-28,text:Math.round(amt),life:0.7,color:target.isPlayer?'#ff6b81':'#fff'});
 if(target.hp<=0){ target.alive=false; target.hp=0; if(attacker){attacker.kills++; if(attacker.isPlayer) feed('💀 敵を倒した！ +パワーキューブ'); }
   for(let i=0;i<2;i++) cubes.push({x:target.x+rand(-25,25),y:target.y+rand(-25,25),r:11});
   burst(target.x,target.y,target.char.color,18);
   if(target.isPlayer) feed('💀 あなたは倒れた…'); else feed(`💀 ${target.name} が倒れた`);
   if(target.isPlayer) setTimeout(endGame,900);
   checkWin();
 }
}
function burst(x,y,color,n){ for(let i=0;i<n;i++) particles.push({x,y,vx:rand(-160,160),vy:rand(-160,160),life:rand(.3,.7),max:.7,color,size:rand(2,6)}); }
/* ★ クリア判定：残りがプレイヤーだけ（＝他の9人全員がいなくなった）ら優勝で終了。
   damage／毒死のたびに加えて update() からも毎フレーム呼ばれるので、
   どんな倒れ方でも見落とさず必ずクリアになる。二重予約は winScheduled で防ぐ */
function checkWin(){ if(winScheduled) return; const alive=entities.filter(e=>e.alive); if(alive.length===1 && alive[0].isPlayer){ winScheduled=true; setTimeout(endGame,600); } }
function endGame(){
 if(state!=='playing') return; state='ended';
 const aliveCount=entities.filter(e=>e.alive).length;
 const p=player.alive?1:Math.min(TOTAL_PLAYERS,aliveCount+1);
 document.getElementById('endEmoji').textContent=p===1?'🏆':'💀';
 document.getElementById('endTitle').textContent=p===1?'優勝！海賊王だ！': p+'位でフィニッシュ';
 document.getElementById('endSub').textContent=p===1?`やったね！${BOT_COUNT}人のBOTの中で最後まで生き残った！`:'あと少しだったね。キャラや立ち回りを変えて再挑戦しよう！';
 /* ガチャ用コインの報酬：順位が上なほど多く、キルでも少し増える */
 const coinReward=(TOTAL_PLAYERS-p)*25 + player.kills*20 + (p===1?100:0);
 if(typeof earnCoins==='function') earnCoins(coinReward);
 document.getElementById('rPlace').textContent=p+'位'; document.getElementById('rKills').textContent=player.kills; document.getElementById('rTime').textContent=fmt(elapsed);
 const rc=document.getElementById('rCoins'); if(rc) rc.textContent='+'+coinReward;
 document.getElementById('endScreen').classList.remove('hidden');
}

/* 通常攻撃。遠距離キャラは弾（ammo）を消費し、撃ったら1発ずつリロードする。
   ジャックは近接なので弾もリロードもなし（ammo=0 のキャラは無制限）。 */
function attack(e,targetAngle){
 if(e.cool>0||!e.alive||e.dashT>0) return false;
 if(targetAngle==null) targetAngle=autoAimAngle(e); /* オートエイム */
 if(e.char.ammo>0){ if(e.ammo<=0) return false; e.ammo--; if(e.reloadT<=0) e.reloadT=e.char.reload; }
 e.cool=e.char.rate; e.angle=targetAngle; e.swing=0.22;
 /* 攻撃したら回復タイマーはリセット（空振り・宝箱狙いでも同じ。当て続けている間は回復しない） */
 e.lastCombat=0; e.isRegen=false;
 const dmg=e.char.dmg*(1+e.power*POWER_DMG_PER_CUBE);
 if(e.char.type==='melee'){
   entities.forEach(t=>{ if(t!==e&&t.alive&&dist(e,t)<e.char.range+t.r&&Math.abs(angDiff(targetAngle,angleTo(e,t)))<1.1) damage(t,dmg,e); });
   crates.forEach(c=>{ if(c.alive&&dist(e,c)<e.char.range+c.r) hitCrate(c,dmg,e); });
   particles.push({x:e.x+Math.cos(targetAngle)*55,y:e.y+Math.sin(targetAngle)*55,vx:Math.cos(targetAngle)*40,vy:Math.sin(targetAngle)*40,life:.18,max:.18,color:'#fff',size:18,slash:true,angle:targetAngle});
 } else if(e.char.type==='gun'){
   bullets.push({x:e.x,y:e.y,vx:Math.cos(targetAngle)*620,vy:Math.sin(targetAngle)*620,r:6,dmg,owner:e,life:0.6,color:'#ffeaa7',type:'bullet'});
 } else {
   bullets.push({x:e.x,y:e.y,vx:Math.cos(targetAngle)*380,vy:Math.sin(targetAngle)*380,r:13,dmg,owner:e,life:0.75,color:'#2d3436',type:'bomb'});
 }
 return true;
}
/* 溜め攻撃：長押しが chargeTime 秒に達してから離すと発動。短押しは通常攻撃。
   input.js から呼ばれる（プレイヤー専用の入り口）。 */
function beginHold(){ if(player&&state==='playing'&&player.alive){ player.holding=true; player.chargeT=0; } }
function endHold(){
 if(!player||state!=='playing'||!player.alive||!player.holding) return;
 player.holding=false;
 /* 攻撃は全デバイス共通でオートエイム：射程内の一番近い敵を自動で狙う */
 if(player.chargeT>=player.char.chargeTime) chargeAttack(player,autoAimAngle(player,chargeSearchRange(player))); else attack(player,autoAimAngle(player));
 player.chargeT=0;
}
function nearestEnemy(e){ let t=null,b=1e9; entities.forEach(en=>{ if(en!==e&&en.alive){ const d=dist(e,en); if(d<b){b=d;t=en;} } }); return t; }
/* オートエイム：射程内にいる一番近い敵を返す。敵がいなければ射程内の一番近い宝箱。
   どちらもいなければ null（その場合は今向いている方向＝進行方向に攻撃する）。 */
function autoAimTarget(e,searchRange){
 const R=searchRange||e.char.range, margin=e.char.type==='melee'?0:20;
 let best=null,bd=1e9;
 entities.forEach(t=>{ if(t!==e&&t.alive){ const d=dist(e,t); if(d<R+t.r+margin&&d<bd){bd=d;best=t;} } });
 if(best) return best;
 let bc=null,cd=1e9;
 crates.forEach(c=>{ if(c.alive){ const d=dist(e,c); if(d<R+c.r&&d<cd){cd=d;bc=c;} } });
 return bc;
}
function autoAimAngle(e,searchRange){ const t=autoAimTarget(e,searchRange); return t?angleTo(e,t):e.angle; }
/* 溜め攻撃の索敵範囲：ジャックのダッシュ到達距離／ルビーの貫通矢の届く距離に合わせる */
function chargeSearchRange(e){ return e.char.id==='ruby'?540:330; }
function chargeReady(e){ return e.chargeT>=e.char.chargeTime; }
function chargeAttack(e,aim){
 if(aim==null) aim=autoAimAngle(e,chargeSearchRange(e)); /* オートエイム */
 e.angle=aim; e.swing=0.22;
 e.lastCombat=0; e.isRegen=false; /* 溜め攻撃も戦闘行動：回復タイマーをリセット */
 const pw=1+e.power*POWER_DMG_PER_CUBE;
 if(e.char.id==='jack'){ /* 疾風ダッシュ斬り：数メートルを高速で駆け抜け、通り道の敵にダメージ */
   e.dashT=0.30; e.dashDir=aim; e.dashHit=new Set(); e.cool=Math.max(e.cool,0.3);
   burst(e.x,e.y,'#ffc93c',10);
 } else if(e.char.id==='ruby'){ /* 貫通パワーボルト：敵を貫く太い矢（弾は消費しない） */
   bullets.push({x:e.x,y:e.y,vx:Math.cos(aim)*780,vy:Math.sin(aim)*780,r:10,dmg:e.char.chargeDmg*pw,owner:e,life:0.85,color:'#ff6b81',type:'powerbolt',hitSet:new Set()});
   shake=Math.max(shake,4);
 } else if(e.char.id==='don'){ /* 特大メガボム */
   bullets.push({x:e.x,y:e.y,vx:Math.cos(aim)*330,vy:Math.sin(aim)*330,r:22,dmg:e.char.chargeDmg*pw,owner:e,life:0.8,color:'#111',type:'megabomb'});
   shake=Math.max(shake,5);
 }
 if(e.isPlayer) feed('💥 溜め攻撃！ '+e.char.chargeName);
}
function hitCrate(c,amt,e){ c.hp-=amt; if(c.hp<=0&&c.alive){c.alive=false; cubes.push({x:c.x,y:c.y,r:11}); burst(c.x,c.y,'#d29b4a',12);} }
function explode(b){ const R=b.type==='megabomb'?125:85; entities.forEach(t=>{if(t.alive&&dist(b,t)<R+t.r) damage(t,b.dmg,b.owner)}); crates.forEach(c=>{if(c.alive&&dist(b,c)<R) hitCrate(c,b.dmg,b.owner)}); burst(b.x,b.y,'#ff7675',22); burst(b.x,b.y,'#ffc93c',14); shake=Math.max(shake,6); }
function angDiff(a,b){ let d=a-b; while(d>Math.PI)d-=Math.PI*2; while(d<-Math.PI)d+=Math.PI*2; return d; }

function botAI(e,dt){
 e.think-=dt; e.botChargeCd-=dt;
 const dz=dist(e,zone); let moveX=0,moveY=0; let target=null; let best=1e9;
 entities.forEach(t=>{if(t!==e&&t.alive){const d=dist(e,t); if(d<best){best=d;target=t}}});
 if(e.think<=0){ e.think=rand(.2,.5); const a=rand(0,6.28); e.tx=e.x+Math.cos(a)*120; e.ty=e.y+Math.sin(a)*120; }
 /* 溜め中は足を止めて狙い、たまったら溜め攻撃を放つ */
 if(e.holding){
   if(target){ e.angle=angleTo(e,target); }
   if(chargeReady(e)){ e.holding=false; e.chargeT=0; chargeAttack(e); /* オートエイム */ }
   e.vx*=0.2; e.vy*=0.2; return;
 }
 if(dz>zone.r-40){ moveX=zone.x-e.x; moveY=zone.y-e.y; }
 else if(target&&best<380){ const lowHp=e.hp<maxHpOf(e)*0.35; /* HPが残り35%を切ったら逃げ腰になる（キャラごとに違う絶対値ではなく割合で判定） */
   if(best>e.char.range*0.75){moveX=target.x-e.x;moveY=target.y-e.y;} else if(lowHp){moveX=e.x-target.x;moveY=e.y-target.y;} else {moveX=-(target.y-e.y)*.4; moveY=(target.x-e.x)*.4;}
   if(best<e.char.range+20){
     /* 瀕死のときは無理に攻めない：距離を取り、5秒逃げ切れば自動回復で立て直す。
        ただし至近距離まで詰められたら反撃する */
     if(lowHp&&best>e.char.range*0.55){ /* 逃げを優先して攻撃しない */ }
     else if(e.botChargeCd<=0&&best>60&&!lowHp){ e.holding=true; e.chargeT=0; e.botChargeCd=rand(4,7); }
     else attack(e); /* オートエイムで一番近い敵を狙う */
   }
 }
 else { let nc=null,nd=1e9; cubes.forEach(c=>{const d=dist(e,c); if(d<nd){nd=d;nc=c}}); if(nc&&nd<260){moveX=nc.x-e.x;moveY=nc.y-e.y;} else {moveX=e.tx-e.x;moveY=e.ty-e.y;} }
 const l=Math.hypot(moveX,moveY)||1; e.vx=moveX/l*e.char.speed; e.vy=moveY/l*e.char.speed;
 /* キャラは進んでいる方向を向く（攻撃した瞬間だけオートエイム先を向く） */
 if(Math.hypot(e.vx,e.vy)>10) e.angle=Math.atan2(e.vy,e.vx);
}

let last=0;
function loop(ts){
 requestAnimationFrame(loop); const dt=Math.min(.033,(ts-last)/1000||0.016); last=ts;
 drawBG();
 if(state==='playing'){ update(dt); }
 drawWorld();
}
requestAnimationFrame(loop);

function update(dt){
 elapsed=(performance.now()-startTime)/1000;
 if(elapsed>12) zone.targetR=520; if(elapsed>30) zone.targetR=360; if(elapsed>50) zone.targetR=220; if(elapsed>75) zone.targetR=110; if(elapsed>100) zone.targetR=55;
 zone.r+=(zone.targetR-zone.r)*dt*0.25;
 if(player.alive){
   let mx=(keys['d']||keys['arrowright']?1:0)-(keys['a']||keys['arrowleft']?1:0)+joyVec.x;
   let my=(keys['s']||keys['arrowdown']?1:0)-(keys['w']||keys['arrowup']?1:0)+joyVec.y;
   const l=Math.hypot(mx,my); if(l>1){mx/=l;my/=l;}
   const spd=player.char.speed*(player.holding?0.45:1); /* 溜めている間は少し遅い */
   player.vx=mx*spd; player.vy=my*spd;
   /* キャラは進んでいる方向を向く。マウスでは狙わない（攻撃はオートエイム） */
   if(player.dashT<=0){
     if(Math.hypot(mx,my)>0.1) player.angle=Math.atan2(my,mx);
     /* 溜め中はオートエイム先を向いて、離したときの攻撃方向が分かるようにする */
     if(player.holding){ const t=autoAimTarget(player,chargeSearchRange(player)); if(t) player.angle=angleTo(player,t); }
   }
 }
 entities.forEach(e=>{
   if(!e.alive) return; e.cool-=dt; e.hitFlash=Math.max(0,e.hitFlash-dt); e.swing=Math.max(0,(e.swing||0)-dt); if(Math.hypot(e.vx,e.vy)>10) e.bob+=dt*11;
   /* 溜め：長押し中はタイマーが進む（上限は満タンの少し先で止める） */
   if(e.holding) e.chargeT=Math.min(e.char.chargeTime+0.3, e.chargeT+dt);
   /* リロード：弾が満タンでなければ1発ずつ装填していく */
   if(e.char.ammo>0&&e.ammo<e.char.ammo){ e.reloadT-=dt; if(e.reloadT<=0){ e.ammo++; e.reloadT=e.ammo<e.char.ammo?e.char.reload:0; } }
   if(!e.isPlayer) botAI(e,dt);
   /* ジャックのダッシュ斬り：高速で駆け抜け、触れた敵に一度だけダメージ */
   if(e.dashT>0){
     e.dashT-=dt; e.angle=e.dashDir;
     e.vx=Math.cos(e.dashDir)*980; e.vy=Math.sin(e.dashDir)*980;
     particles.push({x:e.x+rand(-8,8),y:e.y+rand(-4,10),vx:-Math.cos(e.dashDir)*60,vy:-Math.sin(e.dashDir)*60,life:.25,max:.25,color:'#ffe9a8',size:5});
     entities.forEach(t=>{ if(t!==e&&t.alive&&!e.dashHit.has(t)&&dist(e,t)<e.r+t.r+8){ e.dashHit.add(t); damage(t,e.char.chargeDmg*(1+e.power*POWER_DMG_PER_CUBE),e); } });
     crates.forEach(c=>{ if(c.alive&&dist(e,c)<e.r+c.r) hitCrate(c,e.char.chargeDmg,e); });
   }
   e.x+=e.vx*dt; e.y+=e.vy*dt;
   const dc=Math.hypot(e.x-WORLD/2,e.y-WORLD/2); if(dc>700){ e.x=WORLD/2+(e.x-WORLD/2)/dc*700; e.y=WORLD/2+(e.y-WORLD/2)/dc*700; }
   crates.forEach(c=>{ if(c.alive){ const d=dist(e,c); if(d<e.r+c.r){ const a=angleTo(c,e); e.x=c.x+Math.cos(a)*(e.r+c.r); e.y=c.y+Math.sin(a)*(e.r+c.r);} }});
   /* ★ 自動回復：攻撃もせず・されずに REGEN_DELAY 秒たったら、最大HPの REGEN_RATE/秒 で回復。
      溜め中・ダッシュ中・毒ゾーン内では回復しない。回復量は全キャラ共通の割合なので、
      硬いドンは1秒あたりの回復量も多く、柔らかいルビーは少なめ（割合は同じで公平）。 */
   e.lastCombat+=dt;
   const inZone=dist(e,zone)<=zone.r;
   const effMax=maxHpOf(e);
   e.isRegen = inZone && !e.holding && e.dashT<=0 && e.lastCombat>=REGEN_DELAY && e.hp>0 && e.hp<effMax;
   if(e.isRegen){
     e.hp=Math.min(effMax, e.hp + effMax*REGEN_RATE*dt);
     e.regenFxT-=dt;
     if(e.regenFxT<=0){ e.regenFxT=0.45; particles.push({x:e.x+rand(-10,10),y:e.y-e.r-4,vx:0,vy:-26,life:.55,max:.55,color:'#2ed573',size:4,heal:true}); }
   }
   if(!inZone){ /* 毒ゾーン：段階ダメージ。回復タイマーもリセットされ、回復も止まる */
     e.hp-=poisonDps()*dt; e.hitFlash=0.05; e.lastCombat=0; e.isRegen=false;
     if(e.hp<=0&&e.alive){ e.alive=false; burst(e.x,e.y,'#a55eea',16); feed(`☠️ ${e.isPlayer?'あなた':e.name} は毒ゾーンで倒れた`); if(e.isPlayer) setTimeout(endGame,800); checkWin(); }
   }
   cubes=cubes.filter(c=>{ if(dist(e,c)<e.r+c.r){ e.power++; e.hp=Math.min(maxHpOf(e), e.hp+CUBE_HEAL); if(e.isPlayer) feed('💚 パワーキューブ！ 攻撃力UP'); return false;} return true;});
 });
 bullets=bullets.filter(b=>{
   b.x+=b.vx*dt; b.y+=b.vy*dt; b.life-=dt;
   if(b.type==='bomb'||b.type==='megabomb'){ if(b.life<=0){explode(b); return false;} }
   else if(b.type==='powerbolt'){ /* 貫通：当たった敵を記録してすり抜ける */
     entities.forEach(t=>{if(t!==b.owner&&t.alive&&!b.hitSet.has(t)&&dist(b,t)<b.r+t.r){b.hitSet.add(t); damage(t,b.dmg,b.owner);}});
     crates.forEach(c=>{if(c.alive&&dist(b,c)<b.r+c.r) hitCrate(c,b.dmg,b.owner);});
   }
   else { let hit=false; entities.forEach(t=>{if(t!==b.owner&&t.alive&&dist(b,t)<b.r+t.r){damage(t,b.dmg,b.owner); hit=true;}}); crates.forEach(c=>{if(c.alive&&dist(b,c)<b.r+c.r){hitCrate(c,b.dmg,b.owner); hit=true;}}); if(hit) return false; }
   return b.life>0;
 });
 particles=particles.filter(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;return p.life>0});
 floaters=floaters.filter(f=>{f.y-=30*dt;f.life-=dt;return f.life>0});
 cam.x=Math.max(0,Math.min(WORLD-W, player.x-W/2)); cam.y=Math.max(0,Math.min(WORLD-H, player.y-H/2));
 if(W>=WORLD) cam.x=(WORLD-W)/2; if(H>=WORLD) cam.y=(WORLD-H)/2;
 shake=Math.max(0,shake-dt*20);
 checkWin(); /* 毎フレーム確認：残りがプレイヤーだけになったら必ずクリア（優勝）にする */
 document.getElementById('aliveUI').textContent=entities.filter(e=>e.alive).length;
 document.getElementById('killUI').textContent=player.kills;
 document.getElementById('timeUI').textContent=fmt(elapsed);
 document.getElementById('hpfill').style.width=Math.max(0,player.hp/maxHpOf(player)*100)+'%';
 document.getElementById('hptext').textContent=Math.max(0,Math.round(player.hp))+' / '+maxHpOf(player)+(player.power?`　💚×${player.power}`:'');
 /* HUD：自動回復の状態（回復中か、あと何秒で回復が始まるか） */
 const rl=document.getElementById('regenline');
 if(rl){
   const pMax=maxHpOf(player);
   if(!player.alive||player.hp>=pMax){ rl.textContent='💚 自動回復：満タン'; rl.className='regen-line full'; }
   else if(player.isRegen){ rl.textContent='💚 回復中… +'+Math.round(pMax*REGEN_RATE)+'/秒'; rl.className='regen-line healing'; }
   else if(dist(player,zone)>zone.r){ rl.textContent='☠️ 毒ゾーン内は回復しない'; rl.className='regen-line blocked'; }
   else { rl.textContent='💚 回復まで あと '+Math.max(0,REGEN_DELAY-player.lastCombat).toFixed(1)+'秒（攻撃すると数え直し）'; rl.className='regen-line waiting'; }
 }
 const hw=document.getElementById('hpwrap'); if(hw) hw.classList.toggle('healing',!!player.isRegen);
 /* HUD：HP／リロード（弾）／溜めゲージ */
 const pips=document.getElementById('ammopips');
 if(player.char.ammo>0){
   pips.classList.remove('none'); pips.textContent='';
   for(let i=0;i<player.char.ammo;i++){ const p=document.createElement('i'); if(i>=player.ammo) p.className='empty'; pips.appendChild(p); }
   const reloading=player.ammo<player.char.ammo;
   document.getElementById('ammowrap').classList.toggle('reloading',reloading);
   document.getElementById('ammotext').textContent=reloading?('装填中… あと '+Math.max(0,player.reloadT).toFixed(1)+'秒'):('弾 '+player.ammo+' / '+player.char.ammo);
   document.getElementById('ammofill').style.width=(reloading? (1-player.reloadT/player.char.reload)*100 : 100)+'%';
 } else {
   pips.classList.add('none'); pips.textContent='近接武器：リロードなし';
   document.getElementById('ammowrap').classList.remove('reloading');
   document.getElementById('ammotext').textContent='リロードなし';
   document.getElementById('ammofill').style.width='100%';
 }
 const cpct=Math.min(100,player.chargeT/player.char.chargeTime*100);
 document.getElementById('chargefill').style.width=cpct+'%';
 document.getElementById('chargewrap').classList.toggle('ready',chargeReady(player)&&player.holding);
 document.getElementById('chargetext').textContent=!player.holding?'長押しで溜める':(chargeReady(player)?player.char.chargeName+' 準備OK！離して発動':'溜め中… '+Math.round(cpct)+'%');
}

function drawBG(){ ctx.fillStyle='#0f5e8c'; ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#1280b3'; for(let i=0;i<20;i++){ ctx.globalAlpha=.12; ctx.beginPath(); ctx.ellipse((i*173)%W, (i*97)%H, 40,10,0,0,6.28); ctx.fill(); } ctx.globalAlpha=1;
}
/* ============================================================
   キャラ描画：Yohoho風の丸っこい見下ろしキャラ（描き込み強化版）
   大きな丸い体＋頭＋帽子/ヒゲ＋手に持った武器、頭上に名前とHPバー
   幼く見えないよう、陰影・服の仕立て・眉と傷などで「海賊らしさ」を足す
   デザインの色は data.js の skin / outfit / hat で変えられる
   ジャックの剣を振る動作（swing）はそのまま活かしてある
   ============================================================ */
function drawWeapon(e,hx,hy,wa,R){
 ctx.save(); ctx.translate(hx,hy); ctx.rotate(wa); ctx.lineCap='round';
 if(e.char.type==='melee'){ /* カットラス：柄・鍔・刀身の峰と刃 */
   ctx.strokeStyle='#5d3a12'; ctx.lineWidth=6.5; ctx.beginPath(); ctx.moveTo(-9,0); ctx.lineTo(1,0); ctx.stroke();
   ctx.fillStyle='#8a5a24'; ctx.beginPath(); ctx.arc(-9,0,3.4,0,6.28); ctx.fill();
   ctx.strokeStyle='#ffc93c'; ctx.lineWidth=4; ctx.beginPath(); ctx.arc(4,0,6.5,-1.2,1.2); ctx.stroke();
   ctx.strokeStyle='#dfe7ef'; ctx.lineWidth=7.5; ctx.beginPath(); ctx.moveTo(7,0); ctx.quadraticCurveTo(R*0.85,-R*0.34,R*1.34,-R*0.06); ctx.stroke();
   ctx.strokeStyle='#93a5b8'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(9,-1.5); ctx.quadraticCurveTo(R*0.85,-R*0.30,R*1.26,-R*0.05); ctx.stroke();
 } else if(e.char.type==='gun'){ /* クロスボウ：木の台＋鉄の弓＋矢 */
   ctx.fillStyle='#6e4517'; ctx.fillRect(-7,-4,R*1.1,8);
   ctx.fillStyle='#8a5a24'; ctx.fillRect(-7,-4,R*1.1,3);
   ctx.strokeStyle='#3d4450'; ctx.lineWidth=5; ctx.beginPath(); ctx.arc(R*0.80,0,R*0.55,-1.18,1.18); ctx.stroke();
   const ey=Math.sin(1.18)*R*0.55, ex=R*0.80+Math.cos(1.18)*R*0.55;
   ctx.strokeStyle='#f5f0dc'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(ex,-ey); ctx.lineTo(R*0.32,0); ctx.lineTo(ex,ey); ctx.stroke();
   ctx.strokeStyle='#e8eef5'; ctx.lineWidth=3.2; ctx.beginPath(); ctx.moveTo(-3,0); ctx.lineTo(R*1.02,0); ctx.stroke();
   ctx.fillStyle='#c0271f'; ctx.beginPath(); ctx.moveTo(R*1.02,0); ctx.lineTo(R*0.86,-3.4); ctx.lineTo(R*0.86,3.4); ctx.closePath(); ctx.fill();
 } else { /* 爆弾：鉄の玉＋口金＋導火線と火花 */
   ctx.beginPath(); ctx.arc(R*0.42,0,R*0.46,0,6.28); ctx.fillStyle='#1d1f26'; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.45)'; ctx.stroke();
   ctx.fillStyle='#39404d'; ctx.fillRect(R*0.30,-R*0.56,R*0.24,R*0.14);
   ctx.fillStyle='rgba(255,255,255,0.28)'; ctx.beginPath(); ctx.arc(R*0.28,-R*0.16,R*0.13,0,6.28); ctx.fill();
   ctx.strokeStyle='#8a5a24'; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(R*0.42,-R*0.52); ctx.quadraticCurveTo(R*0.52,-R*0.70,R*0.66,-R*0.66); ctx.stroke();
   ctx.fillStyle='#ffcf3f'; ctx.beginPath(); ctx.arc(R*0.70,-R*0.66,R*0.12,0,6.28); ctx.fill();
   ctx.fillStyle='#ff7b1c'; ctx.beginPath(); ctx.arc(R*0.70,-R*0.66,R*0.06,0,6.28); ctx.fill();
 }
 ctx.restore();
}
function drawHeadGear(e,hx,hy,hr){
 const c=e.char;
 if(c.hat==='bandana'){ /* ジャック：赤バンダナ＋結び目と垂れ布＋ドクロ印 */
   ctx.beginPath(); ctx.arc(hx,hy,hr,Math.PI,2*Math.PI); ctx.closePath(); ctx.fillStyle=c.hatColor; ctx.fill();
   ctx.beginPath(); ctx.arc(hx,hy,hr,Math.PI*1.02,Math.PI*1.98); ctx.lineTo(hx,hy); ctx.closePath(); ctx.fillStyle='rgba(0,0,0,0.13)'; ctx.fill();
   ctx.strokeStyle='rgba(0,0,0,0.28)'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(hx-hr*0.98,hy-hr*0.06); ctx.lineTo(hx+hr*0.98,hy-hr*0.06); ctx.stroke();
   ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(hx,hy-hr*0.52,hr*0.15,0,6.28); ctx.fill();
   ctx.fillRect(hx-hr*0.13,hy-hr*0.40,hr*0.26,hr*0.07);
   ctx.fillStyle=c.hatColor; ctx.beginPath(); ctx.arc(hx+hr*0.97,hy-hr*0.30,hr*0.20,0,6.28); ctx.fill();
   ctx.beginPath(); ctx.moveTo(hx+hr*1.06,hy-hr*0.16); ctx.lineTo(hx+hr*1.34,hy+hr*0.30); ctx.lineTo(hx+hr*0.97,hy+hr*0.34); ctx.closePath(); ctx.fill();
   ctx.beginPath(); ctx.moveTo(hx+hr*0.88,hy-hr*0.12); ctx.lineTo(hx+hr*1.02,hy+hr*0.38); ctx.lineTo(hx+hr*0.78,hy+hr*0.30); ctx.closePath(); ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.fill();
 } else if(c.hat==='feather'){ /* ルビー：横分けの髪＋羽付き帽子（鍔とバンド） */
   ctx.beginPath(); ctx.arc(hx,hy,hr,Math.PI,2*Math.PI); ctx.closePath(); ctx.fillStyle=c.hair; ctx.fill();
   ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1.8; [-0.5,-0.1,0.3].forEach(o=>{ ctx.beginPath(); ctx.moveTo(hx+o*hr,hy-hr*0.95); ctx.quadraticCurveTo(hx+(o+0.25)*hr,hy-hr*0.55,hx+(o+0.1)*hr,hy-hr*0.08); ctx.stroke(); });
   ctx.save(); ctx.translate(hx+hr*0.55,hy-hr*1.04); ctx.rotate(0.5);
   ctx.beginPath(); ctx.ellipse(0,0,hr*0.17,hr*0.46,0,0,6.28); ctx.fillStyle='#27ae60'; ctx.fill();
   ctx.strokeStyle='rgba(0,60,30,0.5)'; ctx.lineWidth=1.6; ctx.beginPath(); ctx.moveTo(0,hr*0.42); ctx.lineTo(0,-hr*0.42); ctx.stroke(); ctx.restore();
   ctx.save(); ctx.translate(hx,hy-hr*0.80); ctx.rotate(-0.14); ctx.beginPath(); ctx.ellipse(0,0,hr*0.88,hr*0.31,0,0,6.28); ctx.fillStyle=c.hatColor; ctx.fill(); ctx.lineWidth=2.5; ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.stroke();
   ctx.beginPath(); ctx.ellipse(0,hr*0.10,hr*0.88,hr*0.20,0,0,Math.PI); ctx.fillStyle='rgba(0,0,0,0.16)'; ctx.fill(); ctx.restore();
   ctx.fillStyle='#ffc93c'; ctx.beginPath(); ctx.arc(hx-hr*0.52,hy-hr*0.82,hr*0.09,0,6.28); ctx.fill();
 } else if(c.hat==='beard'){ /* ドン：黒髪＋毛流れのある大きな黒ヒゲ＋口ヒゲ */
   ctx.beginPath(); ctx.arc(hx,hy,hr,Math.PI,2*Math.PI); ctx.closePath(); ctx.fillStyle=c.hair; ctx.fill();
   ctx.strokeStyle=c.hair; ctx.lineWidth=hr*0.52; ctx.lineCap='round'; ctx.beginPath(); ctx.arc(hx,hy+hr*0.06,hr*0.74,Math.PI*0.05,Math.PI*0.95); ctx.stroke();
   ctx.strokeStyle='rgba(255,255,255,0.13)'; ctx.lineWidth=2;
   [-0.45,-0.15,0.15,0.45].forEach(o=>{ ctx.beginPath(); ctx.moveTo(hx+o*hr,hy+hr*0.52); ctx.quadraticCurveTo(hx+o*hr*1.25,hy+hr*0.85,hx+o*hr*0.9,hy+hr*1.08); ctx.stroke(); });
   ctx.strokeStyle=c.hair; ctx.lineWidth=hr*0.16; ctx.beginPath(); ctx.moveTo(hx-hr*0.34,hy+hr*0.30); ctx.quadraticCurveTo(hx,hy+hr*0.44,hx+hr*0.34,hy+hr*0.30); ctx.stroke();
 }
}
/* 服の仕立て：キャラごとにベスト／斜めベルト／コートの前立てなどを描く */
function drawOutfit(e,x,y,R){
 const c=e.char, cy=y+R*0.20;
 if(c.id==='jack'){ /* 青ベスト＋白シャツ＋襟 */
   ctx.beginPath(); ctx.moveTo(x-R*0.34,cy-R*0.72); ctx.lineTo(x+R*0.34,cy-R*0.72); ctx.lineTo(x+R*0.16,cy+R*0.55); ctx.lineTo(x-R*0.16,cy+R*0.55); ctx.closePath(); ctx.fillStyle='#e9e2d0'; ctx.fill();
   ctx.strokeStyle=c.outfitDark; ctx.lineWidth=3; ctx.beginPath(); ctx.moveTo(x-R*0.34,cy-R*0.72); ctx.lineTo(x-R*0.16,cy+R*0.55); ctx.moveTo(x+R*0.34,cy-R*0.72); ctx.lineTo(x+R*0.16,cy+R*0.55); ctx.stroke();
   ctx.fillStyle='#ffc93c'; [-0.28,0.02,0.32].forEach(o=>{ ctx.beginPath(); ctx.arc(x+o*R*0.30,cy+o*R,2.4,0,6.28); ctx.fill(); });
 } else if(c.id==='ruby'){ /* 矢筒の斜めベルト＋襟巻き */
   ctx.strokeStyle='#5d3a12'; ctx.lineWidth=R*0.26; ctx.beginPath(); ctx.moveTo(x-R*0.72,cy-R*0.55); ctx.lineTo(x+R*0.72,cy+R*0.62); ctx.stroke();
   ctx.strokeStyle='#ffc93c'; ctx.lineWidth=2.4; ctx.beginPath(); ctx.moveTo(x-R*0.72,cy-R*0.55); ctx.lineTo(x+R*0.72,cy+R*0.62); ctx.stroke();
   ctx.strokeStyle=c.outfitDark; ctx.lineWidth=R*0.30; ctx.beginPath(); ctx.arc(x,cy-R*0.52,R*0.52,Math.PI*0.15,Math.PI*0.85); ctx.stroke();
 } else { /* ドン：黄色コートの前立て＋ボタン＋太ベルト */
   ctx.fillStyle='rgba(255,255,255,0.30)'; ctx.fillRect(x-R*0.13,cy-R*0.85,R*0.26,R*1.15);
   ctx.fillStyle='#3a2c14'; [-0.5,-0.08,0.34].forEach(o=>{ ctx.beginPath(); ctx.arc(x,cy+o*R,2.8,0,6.28); ctx.fill(); });
   ctx.strokeStyle='#26221f'; ctx.lineWidth=R*0.30; ctx.beginPath(); ctx.arc(x,cy,R*0.90,Math.PI*0.30,Math.PI*0.70); ctx.stroke();
 }
}
/* 顔：決意の眉＋目＋口（ほっぺの赤みは廃止）。ジャックは頬の傷、ドンは太眉 */
function drawFace(e,cxp,cyp,hr){
 const a=e.angle, ex=Math.cos(a)*hr*0.18, ey=Math.sin(a)*hr*0.10;
 ctx.strokeStyle='#2a1c10'; ctx.lineCap='round';
 ctx.lineWidth=e.char.id==='don'?4:2.6;
 [-1,1].forEach(s=>{ ctx.beginPath(); ctx.moveTo(cxp+ex+s*hr*0.52,cyp+ey-hr*0.34); ctx.lineTo(cxp+ex+s*hr*0.16,cyp+ey-hr*0.20); ctx.stroke(); });
 ctx.fillStyle='#1d1f26'; [-1,1].forEach(s=>{ ctx.beginPath(); ctx.arc(cxp+ex+s*hr*0.34,cyp+ey,Math.max(2.4,hr*0.11),0,6.28); ctx.fill(); });
 ctx.fillStyle='rgba(255,255,255,0.85)'; [-1,1].forEach(s=>{ ctx.beginPath(); ctx.arc(cxp+ex+s*hr*0.34+1,cyp+ey-1,1.1,0,6.28); ctx.fill(); });
 if(e.char.id==='jack'){ ctx.strokeStyle='rgba(160,60,40,0.75)'; ctx.lineWidth=1.8; ctx.beginPath(); ctx.moveTo(cxp-hr*0.62,cyp+hr*0.10); ctx.lineTo(cxp-hr*0.44,cyp+hr*0.30); ctx.stroke(); }
 if(e.char.id!=='don'){ ctx.strokeStyle='#7a4a2a'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.moveTo(cxp+ex-hr*0.13,cyp+ey+hr*0.34); ctx.lineTo(cxp+ex+hr*0.13,cyp+ey+hr*0.34); ctx.stroke(); }
}
function drawEntity(e){
 const R=e.r, c=e.char;
 const moving=Math.hypot(e.vx,e.vy)>10;
 const bobY=Math.sin(e.bob)*(moving?1.8:0.7);
 const x=e.x, y=e.y+bobY, a=e.angle;
 const skin=e.skin||c.skin;
 /* 影 */
 ctx.fillStyle='#00000030'; ctx.beginPath(); ctx.ellipse(e.x,e.y+R*0.95,R*0.95,R*0.32,0,0,6.28); ctx.fill();
 /* 溜め中：足元に溜まり具合のリング（満タンで金色に光る） */
 if(e.holding){ const p=Math.min(1,e.chargeT/c.chargeTime); ctx.beginPath(); ctx.arc(x,y+R*0.2,R+9,-Math.PI/2,-Math.PI/2+p*6.28); ctx.strokeStyle=p>=1?'#ffc93c':'#ff9f43'; ctx.lineWidth=4; ctx.stroke(); }
 /* ダッシュ中：残像 */
 if(e.dashT>0){ ctx.globalAlpha=0.35; ctx.beginPath(); ctx.arc(x-Math.cos(e.dashDir)*R*0.9,y+R*0.2-Math.sin(e.dashDir)*R*0.5,R*0.9,0,6.28); ctx.fillStyle=c.outfit; ctx.fill(); ctx.globalAlpha=1; }
 /* 武器を持つ手の位置（近接は振り回す） */
 let wa, hd;
 if(c.type==='melee'){ if(e.swing>0){ const p=1-e.swing/0.22; wa=a-1.15+p*1.9; } else wa=a+0.6; hd=R*1.02; }
 else { wa=a; hd=R*0.92; }
 const hx=x+Math.cos(wa)*hd, hy=y+R*0.20+Math.sin(wa)*hd*0.78;
 drawWeapon(e,hx,hy,wa,R);
 /* 丸い体：下側に影、上側に光を入れて立体感を出す */
 ctx.beginPath(); ctx.arc(x,y+R*0.20,R,0,6.28); ctx.fillStyle=c.outfit; ctx.fill(); ctx.lineWidth=3.5; ctx.strokeStyle='rgba(0,0,0,0.38)'; ctx.stroke();
 ctx.beginPath(); ctx.arc(x,y+R*0.20,R,Math.PI*0.15,Math.PI*0.85); ctx.lineWidth=R*0.34; ctx.strokeStyle='rgba(0,0,0,0.13)'; ctx.stroke();
 ctx.beginPath(); ctx.ellipse(x-R*0.30,y-R*0.12,R*0.42,R*0.26,-0.5,0,6.28); ctx.fillStyle='rgba(255,255,255,0.20)'; ctx.fill();
 drawOutfit(e,x,y,R);
 /* 腰ベルト＋金バックル */
 ctx.strokeStyle='#5d3a12'; ctx.lineWidth=4.5; ctx.beginPath(); ctx.arc(x,y+R*0.20,R*0.93,Math.PI*0.30,Math.PI*0.70); ctx.stroke();
 ctx.fillStyle='#ffc93c'; ctx.beginPath(); ctx.roundRect(x-5,y+R*0.20+R*0.80,10,8,2); ctx.fill(); ctx.strokeStyle='#8a5a24'; ctx.lineWidth=1.6; ctx.stroke();
 /* 反対側の手 */
 const fhx=x+Math.cos(a-1.9)*R*0.92, fhy=y+R*0.30+Math.sin(a-1.9)*R*0.45;
 ctx.beginPath(); ctx.arc(fhx,fhy,R*0.24,0,6.28); ctx.fillStyle=skin; ctx.fill(); ctx.lineWidth=2.5; ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.stroke();
 /* 頭と顔 */
 const cxp=x+Math.cos(a)*2.5, cyp=y-R*0.36+Math.sin(a)*1.5, hr=R*0.60;
 ctx.beginPath(); ctx.arc(cxp,cyp,hr,0,6.28); ctx.fillStyle=skin; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='rgba(0,0,0,0.32)'; ctx.stroke();
 ctx.beginPath(); ctx.arc(cxp,cyp,hr,Math.PI*0.25,Math.PI*0.75); ctx.lineWidth=hr*0.30; ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.stroke();
 drawHeadGear(e,cxp,cyp,hr);
 drawFace(e,cxp,cyp,hr);
 /* 武器の手（武器の上に重ねる） */
 ctx.beginPath(); ctx.arc(hx,hy,R*0.24,0,6.28); ctx.fillStyle=skin; ctx.fill(); ctx.lineWidth=2.5; ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.stroke();
 /* 被弾フラッシュ */
 if(e.hitFlash>0){ ctx.globalAlpha=Math.min(0.65,e.hitFlash*5); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(x,y+R*0.2,R,0,6.28); ctx.fill(); ctx.beginPath(); ctx.arc(cxp,cyp,hr,0,6.28); ctx.fill(); ctx.globalAlpha=1; }
 /* プレイヤーは金リング */
 if(e.isPlayer){ ctx.beginPath(); ctx.arc(x,y+R*0.2,R+5.5,0,6.28); ctx.strokeStyle='#ffc93c'; ctx.lineWidth=3; ctx.stroke(); }
 /* 自動回復中：緑のリング＋十字マークで「回復している」ことを見せる */
 if(e.isRegen){ const pulse=0.55+0.35*Math.sin(performance.now()/180); ctx.beginPath(); ctx.arc(x,y+R*0.2,R+10,0,6.28); ctx.strokeStyle=`rgba(46,213,115,${pulse})`; ctx.lineWidth=3; ctx.stroke();
   ctx.fillStyle='#2ed573'; ctx.font='900 13px "M PLUS Rounded 1c"'; ctx.textAlign='center'; ctx.fillText('✚',x+R+13,y-R-2); }
 /* 頭上：名前＋HPバー（Yohoho風） */
 const label=(e.isPlayer?'あなた':e.name)+(e.power?' 💚'+e.power:'');
 ctx.font='800 12px "M PLUS Rounded 1c"'; ctx.textAlign='center'; ctx.lineWidth=3.5; ctx.strokeStyle='rgba(0,0,0,0.5)'; ctx.fillStyle='#fff';
 const ny=y-R-26; ctx.strokeText(label,x,ny); ctx.fillText(label,x,ny);
 const bw=54, bx=x-bw/2, by=ny+5, ratio=Math.max(0,e.hp/maxHpOf(e));
 ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(bx-1.5,by-1.5,bw+3,9,4.5); ctx.fill();
 ctx.fillStyle=e.isPlayer?'#2ed573':'#ff4757'; if(ratio>0){ ctx.beginPath(); ctx.roundRect(bx,by,bw*ratio,6,3); ctx.fill(); }
 if(e.holding&&chargeReady(e)){ ctx.font='14px serif'; ctx.fillText('💥',x+bw/2+11,by+7); }
}

function drawWorld(){
 ctx.save();
 const sx=(Math.random()-.5)*shake, sy=(Math.random()-.5)*shake;
 ctx.translate(-cam.x+sx,-cam.y+sy);
 /* Yohoho風：緑の草原アリーナ（市松グリッド＋土のフチの島） */
 ctx.save();
 ctx.beginPath(); ctx.arc(WORLD/2,WORLD/2,730,0,6.28); ctx.clip();
 const sq=92;
 for(let gx=0;gx<WORLD/sq;gx++){ for(let gy=0;gy<WORLD/sq;gy++){ ctx.fillStyle=(gx+gy)%2?'#8fce45':'#85c43c'; ctx.fillRect(gx*sq,gy*sq,sq,sq); } }
 ctx.fillStyle='rgba(0,0,0,0.05)'; for(let i=0;i<90;i++){ const x=(i*211)%WORLD, y=(i*149)%WORLD; if(Math.hypot(x-WORLD/2,y-WORLD/2)<700){ ctx.fillRect(x,y,22,5); ctx.fillRect(x+6,y-7,5,5); } }
 ctx.restore();
 ctx.beginPath(); ctx.arc(WORLD/2,WORLD/2,730,0,6.28); ctx.lineWidth=20; ctx.strokeStyle='#b07a35'; ctx.stroke(); ctx.lineWidth=6; ctx.strokeStyle='#8a5a24'; ctx.stroke();
 ctx.fillStyle='#3e9c35'; [[300,400],[1200,350],[800,1200],[400,1100],[1100,1050]].forEach(([x,y])=>{ctx.beginPath();ctx.arc(x,y,52,0,6.28);ctx.arc(x+38,y+8,42,0,6.28);ctx.fill();});
 if(zone.r<760){ ctx.beginPath(); ctx.arc(zone.x,zone.y,(zone.r+760)/2,0,6.28); ctx.strokeStyle='rgba(165,94,234,0.55)'; ctx.lineWidth=Math.max(0,760-zone.r); ctx.stroke(); }
 ctx.beginPath(); ctx.arc(zone.x,zone.y,zone.r,0,6.28); ctx.strokeStyle='#a55eea'; ctx.lineWidth=5; ctx.stroke();
 cubes.forEach(c=>{ ctx.fillStyle='#2ed573'; ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.roundRect(c.x-11,c.y-11,22,22,5); ctx.fill(); ctx.stroke(); ctx.fillStyle='#fff'; ctx.font='900 13px sans-serif'; ctx.textAlign='center'; ctx.fillText('◆',c.x,c.y+5); });
 crates.forEach(c=>{ if(!c.alive) return; ctx.fillStyle='#b7792b'; ctx.strokeStyle='#7a4a12'; ctx.lineWidth=3; ctx.beginPath(); ctx.roundRect(c.x-24,c.y-24,48,48,6); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(c.x-24,c.y-24); ctx.lineTo(c.x+24,c.y+24); ctx.moveTo(c.x+24,c.y-24); ctx.lineTo(c.x-24,c.y+24); ctx.stroke(); ctx.fillStyle='#00000055'; ctx.fillRect(c.x-20,c.y-32,40,6); ctx.fillStyle='#2ed573'; ctx.fillRect(c.x-20,c.y-32,40*Math.max(0,c.hp/400),6); });
 bullets.forEach(b=>{ if(b.type==='bullet'||b.type==='powerbolt'){ const ba=Math.atan2(b.vy,b.vx); const big=b.type==='powerbolt'; ctx.strokeStyle=big?'#ff6b81':'#f5f0dc'; ctx.lineWidth=big?7:3.5; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(b.x-Math.cos(ba)*(big?16:8),b.y-Math.sin(ba)*(big?16:8)); ctx.lineTo(b.x+Math.cos(ba)*(big?16:8),b.y+Math.sin(ba)*(big?16:8)); ctx.stroke(); ctx.fillStyle='#ffc93c'; ctx.beginPath(); ctx.arc(b.x+Math.cos(ba)*(big?16:8),b.y+Math.sin(ba)*(big?16:8),big?4.5:2.6,0,6.28); ctx.fill(); return; } ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,6.28); ctx.fillStyle=b.color; ctx.fill(); ctx.strokeStyle='#00000066'; ctx.stroke(); if(b.type.includes('bomb')){ctx.fillStyle='#ffc93c'; ctx.fillRect(b.x-2,b.y-b.r-6,4,6);} });
 [...entities].sort((a,b)=>a.y-b.y).forEach(e=>{ if(e.alive) drawEntity(e); });
 particles.forEach(p=>{ ctx.globalAlpha=Math.max(0,p.life/p.max); if(p.slash){ ctx.strokeStyle=p.color; ctx.lineWidth=5; ctx.lineCap='round'; ctx.beginPath(); ctx.arc(p.x,p.y,p.size*2.1,p.angle-1,p.angle+1); ctx.stroke(); } else if(p.heal){ ctx.fillStyle=p.color; ctx.font='900 12px "M PLUS Rounded 1c"'; ctx.textAlign='center'; ctx.fillText('✚',p.x,p.y); } else { ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,6.28); ctx.fill(); } }); ctx.globalAlpha=1;
 floaters.forEach(f=>{ ctx.font='900 16px "M PLUS Rounded 1c"'; ctx.textAlign='center'; ctx.fillStyle=f.color; ctx.strokeStyle='#000'; ctx.lineWidth=3; ctx.strokeText(f.text,f.x,f.y); ctx.fillText(f.text,f.x,f.y); });
 ctx.restore();
 if(player&&state==='playing'&&dist(player,zone)>zone.r){ ctx.fillStyle='rgba(165,94,234,0.18)'; ctx.fillRect(0,0,W,H); ctx.font='900 22px "M PLUS Rounded 1c"'; ctx.textAlign='center'; ctx.fillStyle='#fff'; ctx.fillText('☠️ 毒ゾーンの外だ！早く戻れ！',W/2,42); }
}
resize();
cam={x:320,y:480}; zone={x:WORLD/2,y:WORLD/2,r:720}; player=null;
