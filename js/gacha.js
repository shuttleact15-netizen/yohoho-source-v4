/* ============================================================
   ガチャ部屋：assets/js/gacha.js
   コインで宝箱ガチャを回し、キャラの特別スキン（服の色）を集める
   当たったスキンは着せ替えでき、ロビーとバトルの見た目に反映される
   ★ 所持コイン・コレクション・着せ替えはブラウザに保存される
     （localStorage。タブを閉じても・ZIPを開き直しても残る。
      バトル報酬でコインが増える仕組みは game.js の endGame から earnCoins を呼ぶ。
      保存できないブラウザのときだけ、このページを開いている間だけの記録になる）
   ★ 排出プールと確率は assets/js/data.js の GACHA_POOL（weight合計=100）
   ============================================================ */
/* --- 保存と読み込み（localStorage）。失敗してもゲームは止めない --- */
const SAVE_KEY = 'yohoho-gacha-v1';
function loadSave(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    const d = JSON.parse(raw);
    if(!d || typeof d !== 'object') return null;
    return d;
  }catch(e){ return null; }
}
function saveGame(){
  try{
    localStorage.setItem(SAVE_KEY, JSON.stringify({coins: walletCoins, owned: ownedSkins, equipped: equippedSkin}));
  }catch(e){ /* 保存できないブラウザでは、このプレイ中だけの記録になる */ }
}
const _saved = loadSave();
let walletCoins = (_saved && Number.isFinite(+_saved.coins) && +_saved.coins >= 0) ? Math.floor(+_saved.coins) : 494;
const ownedSkins = (_saved && _saved.owned && typeof _saved.owned === 'object') ? _saved.owned : {};   /* itemId -> 持っている個数 */
const equippedSkin = (_saved && _saved.equipped && typeof _saved.equipped === 'object') ? _saved.equipped : {}; /* charId -> itemId（着せ替え中） */
const baseOutfit = {};       /* charId -> {outfit, outfitDark} 元の服の色 */
CHARS.forEach(c=>{ baseOutfit[c.id]={outfit:c.outfit, outfitDark:c.outfitDark}; });
/* 保存されていた着せ替えをキャラに反映する（持っていないスキンの記録は消す） */
Object.keys(equippedSkin).forEach(charId=>{
  const item = GACHA_POOL.find(i=>i.id===equippedSkin[charId]);
  const c = CHARS.find(x=>x.id===charId);
  if(item && c && ownedSkins[item.id]){ c.outfit=item.outfit; c.outfitDark=item.outfitDark; }
  else delete equippedSkin[charId];
});
saveGame();
let gachaBusy = false;

function updateWalletUI(){
  const a=document.getElementById('coinVal'); if(a) a.textContent=walletCoins;
  const b=document.getElementById('gachaCoinVal'); if(b) b.textContent=walletCoins;
  const b1=document.getElementById('gacha1Btn'), b10=document.getElementById('gacha10Btn');
  if(b1) b1.disabled = gachaBusy || walletCoins < GACHA_COST_1;
  if(b10) b10.disabled = gachaBusy || walletCoins < GACHA_COST_10;
}
/* バトルの報酬などでコインを増やす（game.js から呼ばれる） */
function earnCoins(n){ walletCoins += n; updateWalletUI(); saveGame(); }

function gachaCharName(charId){ const c=CHARS.find(x=>x.id===charId); return c?c.name:charId; }
function rollGacha(minRarity){
  /* minRarity='SR' のときは SR以上のプールから抽選（10連の確定枠用） */
  let pool=GACHA_POOL;
  if(minRarity==='SR') pool=GACHA_POOL.filter(i=>i.rarity==='SSR'||i.rarity==='SR');
  const total=pool.reduce((s,i)=>s+i.weight,0);
  let r=Math.random()*total;
  for(const item of pool){ r-=item.weight; if(r<0) return item; }
  return pool[pool.length-1];
}
function pullGacha(count){
  if(gachaBusy) return;
  const cost = count===10 ? GACHA_COST_10 : GACHA_COST_1;
  const msg=document.getElementById('gachaMsg');
  if(walletCoins < cost){ if(msg) msg.textContent='コインが足りないよ！バトルで上位に入ってコインを貯めよう。'; return; }
  gachaBusy=true; walletCoins-=cost; updateWalletUI();
  const chest=document.getElementById('gachaChest');
  const box=document.getElementById('gachaResults');
  if(box) box.innerHTML='';
  if(msg) msg.textContent='宝箱を開けているよ…';
  if(chest){ chest.classList.remove('open'); void chest.offsetWidth; chest.classList.add('shaking'); }
  setTimeout(()=>{
    if(chest){ chest.classList.remove('shaking'); chest.classList.add('open'); }
    const results=[];
    for(let i=0;i<count;i++) results.push(rollGacha(null));
    if(count===10 && !results.some(i=>i.rarity==='SSR'||i.rarity==='SR')){
      results[results.length-1]=rollGacha('SR'); /* 10連はSR以上1つ確定 */
    }
    let dupCoins=0;
    results.forEach(item=>{
      if(ownedSkins[item.id]){ dupCoins+=30; } /* かぶりはコインに変換 */
      ownedSkins[item.id]=(ownedSkins[item.id]||0)+1;
    });
    if(dupCoins>0) walletCoins+=dupCoins;
    saveGame();
    if(box){
      box.innerHTML=results.map(item=>`
        <div class="gacha-card rarity-${item.rarity.toLowerCase()}">
          <span class="gacha-rarity">${item.rarity}</span>
          <span class="gacha-emoji">${item.emoji}</span>
          <b>${item.name}</b>
          <small>${gachaCharName(item.charId)} のスキン${(ownedSkins[item.id]||0)>1?'（かぶり→🪙30）':''}</small>
          <span class="gacha-swatch"><i style="background:${item.outfit}"></i><i style="background:${item.outfitDark}"></i></span>
        </div>`).join('');
    }
    if(msg){
      const best=results.some(i=>i.rarity==='SSR')?'SSRが出た！おめでとう！':results.some(i=>i.rarity==='SR')?'SRが出たよ！':'結果が出たよ。下の「集めたスキン」から着せ替えできるよ。';
      msg.textContent=best+(dupCoins>0?` かぶり分で 🪙${dupCoins} 戻ってきたよ。`:'');
    }
    gachaBusy=false; updateWalletUI(); renderCollection();
  }, 650);
}
function equipSkin(itemId){
  const item=GACHA_POOL.find(i=>i.id===itemId); if(!item||!ownedSkins[itemId]) return;
  const c=CHARS.find(x=>x.id===item.charId); if(!c) return;
  equippedSkin[item.charId]=itemId;
  c.outfit=item.outfit; c.outfitDark=item.outfitDark;
  if(typeof renderChars==='function') renderChars();
  if(typeof renderHero==='function') renderHero();
  renderCollection();
  saveGame();
  const note=document.getElementById('gachaColNote');
  if(note) note.textContent=`「${item.name}」を ${c.name} に着せたよ。ロビーとバトルで服の色が変わっているはずだよ。`;
}
function unequipSkin(charId){
  const c=CHARS.find(x=>x.id===charId); if(!c) return;
  delete equippedSkin[charId];
  c.outfit=baseOutfit[charId].outfit; c.outfitDark=baseOutfit[charId].outfitDark;
  if(typeof renderChars==='function') renderChars();
  if(typeof renderHero==='function') renderHero();
  renderCollection();
  saveGame();
}
function renderCollection(){
  const el=document.getElementById('gachaCollection'); if(!el) return;
  const owned=GACHA_POOL.filter(i=>ownedSkins[i.id]);
  if(!owned.length){ el.innerHTML=''; return; }
  el.innerHTML=owned.map(item=>{
    const worn=equippedSkin[item.charId]===item.id;
    return `<div class="gacha-owned rarity-${item.rarity.toLowerCase()}">
      <span class="gacha-rarity">${item.rarity}</span>
      <span class="gacha-emoji">${item.emoji}</span>
      <b>${item.name}</b>
      <small>${gachaCharName(item.charId)} 用 ／ ×${ownedSkins[item.id]}<br>${item.desc}</small>
      <span class="gacha-swatch"><i style="background:${item.outfit}"></i><i style="background:${item.outfitDark}"></i></span>
      ${worn
        ? `<button class="gacha-equip worn" data-unequip="${item.charId}">着せ替え中（はずす）</button>`
        : `<button class="gacha-equip" data-equip="${item.id}">このスキンを着せる</button>`}
    </div>`;
  }).join('');
  el.querySelectorAll('[data-equip]').forEach(b=>b.onclick=()=>equipSkin(b.dataset.equip));
  el.querySelectorAll('[data-unequip]').forEach(b=>b.onclick=()=>unequipSkin(b.dataset.unequip));
}
document.getElementById('gacha1Btn').addEventListener('click',()=>pullGacha(1));
document.getElementById('gacha10Btn').addEventListener('click',()=>pullGacha(10));
updateWalletUI();
renderCollection();
/* 保存されていた着せ替えをロビーの立ち絵にも反映する（lobby.js は先に描画済みのため） */
if(typeof renderChars==='function') renderChars();
if(typeof renderHero==='function') renderHero();
