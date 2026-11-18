/* ============================================================
   ロビーと部屋の切り替え：assets/js/lobby.js
   画面（部屋）を増やしたいときは、index.htmlに .room を足して
   ボタンに data-go="部屋id" を付けるだけ
   キャラの立ち絵は data.js のデザイン（skin/outfit/hat）から
   丸っこいキャラをSVGで描く（バトル中の見た目とおそろい）
   ============================================================ */
let selected=0;

function showRoom(id){
  document.querySelectorAll('.room').forEach(r=>r.classList.toggle('is-active', r.id==='room-'+id));
  document.querySelectorAll('[data-go]').forEach(b=>b.classList.toggle('active', b.dataset.go===id));
  const lobby=document.getElementById('startScreen');
  if(lobby) lobby.scrollTop=0;
}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showRoom(b.dataset.go)));

/* 丸っこいキャラの立ち絵（SVG）。バトルの drawEntity と同じデザイン。
   ほっぺの赤みはやめて、眉・傷・服の仕立てで海賊らしく描き込む */
function charArt(c){
  const R=c.id==='don'?37:33, fy=c.id==='don'?44:48;
  /* 服の仕立て */
  let outfit='';
  if(c.id==='jack'){ /* 青ベスト＋白シャツ＋金ボタン */
    outfit=`<path d="M46 62 L74 62 L67 110 L53 110 Z" fill="#e9e2d0"/>
    <path d="M46 62 L53 110 M74 62 L67 110" stroke="${c.outfitDark}" stroke-width="3" fill="none"/>
    <circle cx="60" cy="76" r="2.4" fill="#c98f00"/><circle cx="60" cy="90" r="2.4" fill="#c98f00"/><circle cx="60" cy="104" r="2.4" fill="#c98f00"/>`;
  } else if(c.id==='ruby'){ /* 矢筒の斜めベルト＋襟巻き */
    outfit=`<path d="M36 62 L86 112" stroke="#5d3a12" stroke-width="8" stroke-linecap="round"/>
    <path d="M36 62 L86 112" stroke="#ffc93c" stroke-width="2" stroke-linecap="round"/>
    <path d="M38 66 A26 26 0 0 0 82 66" stroke="${c.outfitDark}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
  } else { /* ドン：コートの前立て＋ボタン */
    outfit=`<rect x="53" y="56" width="14" height="58" fill="#ffffff45"/>
    <circle cx="60" cy="72" r="2.8" fill="#3a2c14"/><circle cx="60" cy="88" r="2.8" fill="#3a2c14"/><circle cx="60" cy="104" r="2.8" fill="#3a2c14"/>`;
  }
  /* 頭の飾りと顔まわり（キャラごとに描き分け） */
  let gear='', face='';
  if(c.id==='jack'){ /* 赤バンダナ＋ドクロ印＋結び目、頬の傷 */
    gear=`<path d="M33 ${fy} a27 27 0 0 1 54 0 Z" fill="${c.hatColor}"/>
    <path d="M33 ${fy-2} L87 ${fy-2}" stroke="#00000030" stroke-width="2.5"/>
    <circle cx="60" cy="${fy-13}" r="4.2" fill="#fff"/><rect x="57.6" y="${fy-9.5}" width="4.8" height="2.6" fill="#fff"/>
    <circle cx="89" cy="${fy-5}" r="6" fill="${c.hatColor}"/><path d="M92 ${fy-2} l11 9 l-5 7 l-9-7 Z" fill="${c.hatColor}"/><path d="M88 ${fy} l4 12 l-6 3 l-3-10 Z" fill="#00000018"/>
    <path d="M42 ${fy+7} l6 8" stroke="#a03c28" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
    face=`<path d="M55 ${fy+13} L65 ${fy+13}" stroke="#7a4a2a" stroke-width="2.4" stroke-linecap="round"/>`;
  } else if(c.id==='ruby'){ /* 横分けの髪＋羽付き帽子 */
    gear=`<path d="M33 ${fy} a27 27 0 0 1 54 0 Z" fill="${c.hair}"/>
    <path d="M46 ${fy-24} q4 12 1 22 M60 ${fy-27} q5 13 2 25 M74 ${fy-23} q4 11 1 20" stroke="#00000030" stroke-width="1.8" fill="none"/>
    <ellipse cx="83" cy="${fy-38}" rx="5.5" ry="13" transform="rotate(24 83 ${fy-38})" fill="#27ae60"/>
    <path d="M83 ${fy-50} L83 ${fy-27}" stroke="#0a5030" stroke-width="1.6"/>
    <ellipse cx="60" cy="${fy-23}" rx="25" ry="9.5" transform="rotate(-8 60 ${fy-23})" fill="${c.hatColor}"/>
    <ellipse cx="60" cy="${fy-20}" rx="25" ry="6" transform="rotate(-8 60 ${fy-20})" fill="#00000018"/>
    <circle cx="44" cy="${fy-25}" r="2.6" fill="#ffc93c"/>`;
    face=`<path d="M56 ${fy+13} L64 ${fy+13}" stroke="#7a4a2a" stroke-width="2.4" stroke-linecap="round"/>`;
  } else { /* ドン：大きな黒ヒゲ（毛流れ付き）＋口ヒゲ＋太眉 */
    gear=`<circle cx="60" cy="${fy+14}" r="24" fill="${c.hair}"/>
    <circle cx="60" cy="${fy-3}" r="20.5" fill="${c.skin}" stroke="rgba(0,0,0,.25)" stroke-width="2.5"/>
    <path d="M39.5 ${fy-3} a20.5 20.5 0 0 1 41 0 Z" fill="${c.hair}"/>
    <path d="M44 ${fy+34} q3 8 1 13 M60 ${fy+37} q1 8 0 14 M76 ${fy+34} q-3 8 -1 13" stroke="#ffffff22" stroke-width="2" fill="none"/>
    <path d="M47 ${fy+9} q13 7 26 0" stroke="${c.hair}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    face=``;
  }
  /* 眉（決意の角度）＋目（ハイライト入り）。ドンは太眉 */
  const browW=c.id==='don'?4.5:3, browY=c.id==='don'?fy-9:fy-6, eyeY=c.id==='don'?fy-1:fy+2;
  const faceBase=`
    <path d="M40 ${browY} L54 ${browY+4} M80 ${browY} L66 ${browY+4}" stroke="#2a1c10" stroke-width="${browW}" stroke-linecap="round" fill="none"/>
    <circle cx="49" cy="${eyeY}" r="3.4" fill="#1d1f26"/><circle cx="71" cy="${eyeY}" r="3.4" fill="#1d1f26"/>
    <circle cx="48" cy="${eyeY-1}" r="1.1" fill="#fff"/><circle cx="70" cy="${eyeY-1}" r="1.1" fill="#fff"/>`;
  let weapon='';
  if(c.id==='jack'){ /* カットラス */
    weapon=`<path d="M90 76 q27-5 32-27" stroke="#dfe7ef" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M92 73 q22-5 27-22" stroke="#93a5b8" stroke-width="2" fill="none"/><path d="M84 82 l12-7" stroke="#5d3a12" stroke-width="6" stroke-linecap="round"/><path d="M88 70 a8 8 0 0 1 10 6" stroke="#ffc93c" stroke-width="4" fill="none"/>`;
  } else if(c.id==='ruby'){ /* クロスボウ */
    weapon=`<g transform="translate(93 74) rotate(18)"><rect x="-4" y="-4" width="30" height="8" rx="3" fill="#6e4517"/><path d="M21 -17 A19 19 0 0 1 21 17" stroke="#3d4450" stroke-width="4.5" fill="none"/><path d="M21 -17 L8 0 L21 17" stroke="#f5f0dc" stroke-width="1.6" fill="none"/><path d="M-2 0 L24 0" stroke="#e8eef5" stroke-width="3"/><path d="M24 0 L18 -3.4 L18 3.4 Z" fill="#c0271f"/></g>`;
  } else { /* 爆弾 */
    weapon=`<circle cx="95" cy="72" r="15" fill="#1d1f26"/><rect x="90" y="54" width="10" height="6" fill="#39404d"/><circle cx="90" cy="67" r="4.5" fill="#ffffff40"/><path d="M95 54 q2-8 9-9" stroke="#8a5a24" stroke-width="3" fill="none"/><circle cx="105" cy="44" r="4" fill="#ffcf3f"/><circle cx="105" cy="44" r="2" fill="#ff7b1c"/>`;
  }
  return `<svg viewBox="-2 -8 124 134" class="char-art" aria-hidden="true">
    ${weapon}
    <circle cx="27" cy="82" r="9.5" fill="${c.skin}" stroke="rgba(0,0,0,.25)" stroke-width="2.5"/>
    <circle cx="60" cy="86" r="${R}" fill="${c.outfit}" stroke="rgba(0,0,0,.30)" stroke-width="3"/>
    <ellipse cx="47" cy="70" rx="14" ry="9" transform="rotate(-20 47 70)" fill="#ffffff2e"/>
    <path d="M ${60-R*0.55} ${86+R*0.72} A ${R} ${R} 0 0 0 ${60+R*0.55} ${86+R*0.72}" stroke="#00000020" stroke-width="7" fill="none"/>
    ${outfit}
    <path d="M ${60-R*0.82} ${86+R*0.52} A ${R} ${R} 0 0 0 ${60+R*0.82} ${86+R*0.52}" stroke="#5d3a12" stroke-width="4.5" fill="none"/>
    <rect x="55" y="${86+R*0.80}" width="10" height="8" rx="2" fill="#ffc93c" stroke="#8a5a24" stroke-width="1.6"/>
    <circle cx="60" cy="${fy}" r="27" fill="${c.skin}" stroke="rgba(0,0,0,.25)" stroke-width="3"/>
    ${gear}
    ${faceBase}
    ${face}
    <circle cx="93" cy="80" r="9.5" fill="${c.skin}" stroke="rgba(0,0,0,.25)" stroke-width="2.5"/>
  </svg>`;
}

function statRow(label,val,max,color){
  const pct=Math.max(4,Math.min(100,Math.round(val/max*100)));
  return `<div class="statbar"><span>${label}</span><span class="track"><i style="width:${pct}%;background:${color}"></i></span><span>${val}</span></div>`;
}
function reloadText(c){
  return c.ammo>0?`弾${c.ammo}発 ／ 1発 ${c.reload}秒で装填`:'なし（近接）';
}
/* 自動回復は全キャラ共通ルール：5秒戦闘なしで、最大HPの6%/秒 */
function regenText(c){
  return `${REGEN_DELAY}秒戦闘なしで回復開始 ／ 毎秒 +${Math.round(c.hp*REGEN_RATE)}（最大HPの${Math.round(REGEN_RATE*100)}%）`;
}
function renderChars(){
  const list=document.getElementById('charList');
  list.innerHTML=CHARS.map((c,i)=>`
    <button class="char ${i===selected?'selected':''}" data-i="${i}">
      <div class="face">${charArt(c)}</div>
      <h3>${c.name}</h3>
      <p>${c.desc}</p>
      <span class="role">${c.role} ／ ランク${c.rank}</span>
      ${statRow('❤️ HP',c.hp,1400,'#2ed573')}
      ${statRow('⚔️ 攻撃',c.dmg,300,'#ff4757')}
      ${statRow('👟 速さ',c.speed,200,'#25a6e8')}
      ${statRow('🎯 射程',c.range,360,'#ffc93c')}
      <div class="speed-line">👟 足の速さ：<b>${c.speedNote||''}</b></div>
      <div class="charge-line">💥 溜め攻撃：<b>${c.chargeName}</b>（${c.chargeTime}秒長押し／${c.chargeDmg}ダメージ）</div>
      <div class="reload-line">🔁 リロード：<b>${reloadText(c)}</b></div>
      <div class="reload-line">💚 自動回復：<b>${regenText(c)}</b></div>
    </button>`).join('');
  list.querySelectorAll('.char').forEach(b=>b.onclick=()=>{selected=+b.dataset.i;renderChars();renderHero();});
  renderDetail();
}
function renderDetail(){
  const c=CHARS[selected], el=document.getElementById('charDetail');
  if(!el) return;
  el.innerHTML=`<div class="big">${charArt(c)}</div><div><h3>${c.name} ― ${c.role}</h3><p>${c.desc}<br>💥 溜め攻撃「${c.chargeName}」：${c.chargeDesc}<br>🔁 リロード：${reloadText(c)}<br>💚 自動回復：${regenText(c)}<br>👟 足の速さ：${c.speed}（${c.speedNote||''}）<br>🏆 トロフィー ${c.trophy} ／ パワー ${c.power}<br>💬 「${c.quote}」</p></div>`;
}
function renderHero(){
  const c=CHARS[selected];
  const body=document.getElementById('heroBody');
  body.innerHTML=charArt(c);
  body.style.background='radial-gradient(circle at 50% 30%, #ffffff40, #00000010 72%)';
  document.getElementById('heroWeapon').textContent='';
  document.getElementById('heroName').textContent=c.name;
  document.getElementById('heroQuote').innerHTML=`💬 「${c.quote}」 ― 溜め攻撃 <b>${c.chargeName}</b>`;
  document.getElementById('heroTrophy').innerHTML=`<small>トロフィー</small>🏆 ${c.trophy}`;
  document.getElementById('heroPower').innerHTML=`<small>パワー</small>⚡ ${c.power} ／ ランク${c.rank}`;
}
function renderCrew(){
  const el=document.getElementById('crewList');
  if(el) el.innerHTML=BOT_NAMES.map((n,i)=>`<div class="crew-member"><span class="face">${BOT_FACES[i]}</span>${n}<small>バトルではライバルBOTとして登場。<br>倒すとパワーキューブを落とすよ。</small></div>`).join('');
  const ev=document.getElementById('eventInfo');
  if(ev) ev.innerHTML=`<div class="gem">${GAME_EVENT.icon}</div><div><b>${GAME_EVENT.name}</b><small>${GAME_EVENT.map} ― ${GAME_EVENT.note}</small></div><div class="timer">毒ゾーンは<br>12秒後から縮小</div>`;
}
renderChars();
renderHero();
renderCrew();
