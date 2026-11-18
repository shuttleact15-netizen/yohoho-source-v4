/* ============================================================
   部屋データ：assets/js/data.js
   ★ キャラの性能・見た目を変えたいときは、このファイルだけ触ればOK
   hp=体力 / speed=足の速さ(px/秒) / dmg=攻撃力 / range=射程 / rate=攻撃間隔(秒,小さいほど速い)
   chargeDmg=溜め攻撃のダメージ
   ★ バランスの考え方（役割がかぶらないように設計）：
     ジャック＝近接アタッカー。射程95と一番短い代わりに単発240・連打が利く（約533/秒）。
       ただしHPは中くらい（1080）。飛び込めば強いが、囲まれると逃げ切れない。
     ルビー＝遠距離シューター。射程340・最速182で距離を保って撃ち続けるのが仕事。
       単発150は控えめで、倒し切るには8発前後かかる。HP900と一番柔らかいので、
       近づかれたら足で逃げるしかない。連射を少し遅くし（0.35秒間隔）、
       リロードも0.85秒にして「撃ちまくり」を抑えた。
     ドン＝タンク／範囲ブラスター。HP1380で一番硬い代わりに最遅138・連射も一番遅い。
       爆発は範囲が強いので単発は220に抑え、リロード1.05秒と長め。
       近づかれても耐えるが、足の遅さで追いかけっこには負ける。
     → 目安の倒すまでのヒット数：ジャック→ルビー4発／ドン6発、
       ルビー→ジャック8発／ドン10発、ドン→ルビー5発／ジャック5発。
       誰も一方的に勝てず、「距離」と「地形」で勝敗が変わるようにしてある。
   ★ 足の速さ：ルビー182（最速・軽快）／ジャック168（中速）／ドン138（最遅・重量級）
   trophy・power・rank はロビーの表示用
   ★ リロード（遠距離キャラだけ）：
   ammo=装弾数（撃てる回数） / reload=1発分の装填にかかる秒数
   ジャックは近接なので ammo=0（リロードなし・何度でも振れる）
   ★ 溜め攻撃：攻撃ボタンを長押しして chargeTime 秒たまると発動できる
   chargeName / chargeDesc / chargeDmg がキャラごとの溜め攻撃
   ★ デザイン（Yohoho風の丸っこい見下ろしキャラ用）：
   skin=肌色 / outfit=服の色 / outfitDark=服の影色 / hat=頭の飾り
   (bandana=バンダナ / feather=羽付き帽子 / beard=ヒゲ) / r=体の大きさ
   ============================================================ */
const CHARS=[
 {id:'jack', name:'キャプテン・ジャック', emoji:'🏴‍☠️', weapon:'⚔️', color:'#e84118', role:'近接アタッカー',
  desc:'近接の剣士。カットラスを振り回して大ダメージ。リロードなしで何度でも斬れる。溜めると高速ダッシュ斬り！飛び込む勇気がいる分、火力は一番高い。', quote:'剣ひと振りで決めるぜ！',
  hp:1080, speed:168, dmg:240, range:95, rate:0.45, type:'melee', ammo:0, reload:0,
  chargeTime:0.6, chargeDmg:190, chargeName:'疾風ダッシュ斬り', chargeDesc:'数メートルを一気に駆け抜け、通り道の敵全員に190ダメージ',
  trophy:165, power:4, rank:11,
  skin:'#f0bd82', outfit:'#2b5fc7', outfitDark:'#1d4391', hat:'bandana', hatColor:'#c0271f', hair:'#4a2c14', r:23},
 {id:'ruby', name:'ガンナー・ルビー', emoji:'🏹', weapon:'🏹', color:'#9b59b6', role:'遠距離シューター',
  desc:'遠距離の射手。クロスボウで狙い撃ち。3発撃つとリロードが要る。溜めると敵を貫く強力な一矢！一番速くて一番遠くまで届くが、体は一番柔らかい。', quote:'遠くからでも外さないよ！',
  hp:900, speed:182, dmg:150, range:340, rate:0.35, type:'gun', ammo:3, reload:0.85,
  chargeTime:0.7, chargeDmg:300, chargeName:'貫通パワーボルト', chargeDesc:'一直線に敵を貫く太い矢。300ダメージで壁役もまとめて射抜く',
  trophy:132, power:3, rank:9,
  skin:'#ffd7ad', outfit:'#12a594', outfitDark:'#0b7a6e', hat:'feather', hatColor:'#d94f7e', hair:'#7a3b12', r:21},
 {id:'don', name:'ボマー・ドン', emoji:'💣', weapon:'💣', color:'#e67e22', role:'範囲ブラスター',
  desc:'爆弾使い。範囲爆発で宝箱も敵も吹き飛ばす。2発投げるとリロード。溜めると特大の爆弾を投げる！一番硬いタンクだが、足と連射は一番遅い。', quote:'ドカンと行こうぜ、ドカンと！',
  hp:1380, speed:138, dmg:220, range:280, rate:0.82, type:'bomb', ammo:2, reload:1.05,
  chargeTime:0.8, chargeDmg:440, chargeName:'特大メガボム', chargeDesc:'巨大な爆弾を投げる。爆発範囲が広く440ダメージ',
  trophy:98, power:5, rank:8,
  skin:'#e8a96b', outfit:'#e8a90c', outfitDark:'#b57e06', hat:'beard', hatColor:'#26221f', hair:'#26221f', r:29},
];
/* ============================================================
   全体バランスの共通ルール（数値を変えたいときはここ）
   ★ 自動回復（ブロスタ式）：攻撃もせず・されずに REGEN_DELAY 秒たつと、
     最大HPの REGEN_RATE（割合）ずつ毎秒ゆっくり回復する。満タンで止まる。
     攻撃する／ダメージを受ける／毒ゾーンにいる間は回復しないし、
     タイマーも最初から数え直しになる。逃げて立て直すための仕組みで、
     戦いながら回復はできない。
   ★ パワーキューブ：1個で最大HP +40、攻撃力 +9%（以前の+12%から弱体化。
     集めすぎた人が一人勝ちしないように）、拾った瞬間に HP +100 回復。
   ★ 毒ゾーン：序盤は毎秒35と弱め、ゾーンが縮むにつれて 50→60→75 と強くなる
     （段階は game.js の poisonDps）。終盤は回復より毒が速いので、隠れ続けられない。
   ============================================================ */
const REGEN_DELAY=5;        /* 戦闘が終わってから回復が始まるまでの秒数 */
const REGEN_RATE=0.06;      /* 毎秒、最大HPの何割回復するか（6%） */
const POWER_DMG_PER_CUBE=0.09;
const POWER_HP_PER_CUBE=40;
const CUBE_HEAL=100;
/* 足の速さの一言メモ（キャラ部屋に表示） */
CHARS.forEach(c=>{
  c.speedNote = c.id==='ruby' ? '最速・軽快（HPが低い分、足で稼ぐ）'
              : c.id==='don'  ? '最遅・重量級（強い分、足は遅い）'
              : '中速・バランス（近づけるが速すぎない）';
});

/* ============================================================
   ガチャ：assets/js/data.js（排出プールはここだけ触ればOK）
   weight=出やすさ（全部で100。数字が大きいほどよく出る）
   確率は weight そのまま：SSR合計6% ／ SR合計24% ／ R合計70%
   outfit / outfitDark は当たったスキンを着せたときの服の色
   10連は SR以上が1つ確定（仕組みは assets/js/gacha.js）
   ============================================================ */
const GACHA_COST_1=100, GACHA_COST_10=900;
const GACHA_POOL=[
 {id:'g-jack', name:'黄金のジャック', charId:'jack', rarity:'SSR', weight:2, emoji:'👑', outfit:'#e6b800', outfitDark:'#9a7b00', desc:'金ピカのベストをまとった船長スタイル。ロビーでもバトルでも目立つ！'},
 {id:'g-ruby', name:'虹羽のルビー', charId:'ruby', rarity:'SSR', weight:2, emoji:'🌈', outfit:'#d6336c', outfitDark:'#8e1f47', desc:'鮮やかなピンクの衣装と自慢の羽が映える、ルビーの特別スタイル。'},
 {id:'g-don', name:'海賊王ドン', charId:'don', rarity:'SSR', weight:2, emoji:'👑', outfit:'#8e2323', outfitDark:'#5c1212', desc:'深紅のコートが威厳たっぷり。海賊王に一番近いドンの姿。'},
 {id:'s-jack', name:'緋色のジャック', charId:'jack', rarity:'SR', weight:8, emoji:'🔥', outfit:'#a93226', outfitDark:'#6e1f16', desc:'燃えるような赤いベスト。決闘のときの勝負服だ。'},
 {id:'s-ruby', name:'翡翠のルビー', charId:'ruby', rarity:'SR', weight:8, emoji:'💚', outfit:'#1e9e6a', outfitDark:'#116644', desc:'翡翠色の衣装で森の中でも映える、ルビーの狩人スタイル。'},
 {id:'s-don', name:'鋼鉄のドン', charId:'don', rarity:'SR', weight:8, emoji:'⚙️', outfit:'#5d6d7e', outfitDark:'#37424e', desc:'鋼色のコートは重そうに見えて、ドンにはちょうどいい。'},
 {id:'r-jack', name:'森のジャック', charId:'jack', rarity:'R', weight:17, emoji:'🌲', outfit:'#2e7d32', outfitDark:'#1b4d1e', desc:'森の緑に染まったベスト。隠密行動にぴったり。'},
 {id:'r-ruby', name:'夕焼けルビー', charId:'ruby', rarity:'R', weight:17, emoji:'🌇', outfit:'#e67e22', outfitDark:'#9a4f0e', desc:'夕焼け色の衣装。夕方の甲板がよく似合う。'},
 {id:'r-don', name:'深海のドン', charId:'don', rarity:'R', weight:18, emoji:'🌊', outfit:'#1a5276', outfitDark:'#0e3249', desc:'深い海の色のコート。海の底の宝物みたいだ。'},
 {id:'r-jack2', name:'霧のジャック', charId:'jack', rarity:'R', weight:18, emoji:'🌫️', outfit:'#7f8c8d', outfitDark:'#4d5656', desc:'霧色のベスト。霧の海を進むジャックに。'},
];
/* ★ 1プレイの参加人数：あなた1人＋BOT9人＝合計10人で固定。
   バトル中にBOTが追加で湧いたり、倒れたBOTが復活したりは絶対にしない。
   残り人数は10→1へ減るだけで、プレイヤーだけになったら優勝（クリア）。 */
const TOTAL_PLAYERS=10;
const BOT_COUNT=TOTAL_PLAYERS-1; /* BOTは9人 */
const BOT_NAMES=['ボブ','スカリー','アン','モーガン','キッド','ベラ','フック','ティーチ','ローズ'];
const BOT_FACES=['🦜','💀','⚓','🧭','🗡️','🏴‍☠️','🦑','🦈','🐙'];
const BOT_SKINS=['#f0bd82','#ffd7ad','#e8a96b','#c97e4e','#8a5a34'];
const GAME_EVENT={name:'パワーキューブ争奪戦', map:'毒ガスの洞窟島', icon:'💚', note:'宝箱を壊してキューブを集め、縮む毒ゾーンの中心で生き残れ！'};
