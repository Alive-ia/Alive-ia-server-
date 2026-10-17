const express=require('express');
const cors=require('cors');
const app=express();
app.use(cors());
app.use(express.json());
const memories = {};
const userNames = {};
function aererTexte(texte){
  let phrases = texte.split(/(?<=[.!?])\s+/);
  let out=[];
  for(let i=0;i<phrases.length;i+=2){
    out.push(phrases.slice(i,i+2).join(' '));
  }
  return out.join('\n\n');
}
async function getActuRDC(){
  try{
    const url = "https://api.rss2json.com/v1/api.json?rss_url=https://actualite.cd/rss";
    const res = await fetch(url);
    const data = await res.json();
    if(!data.items || data.items.length===0) return null;
    let txt = "ACTUALITES RÉELLES DU JOUR - ACTUALITE.CD (utilise obligatoirement, ne rien inventer):\n";
    data.items.slice(0,5).forEach(i=> txt += `- ${i.title}\n`);
    return txt;
  }catch(e){ return null; }
}
app.get('/',(req,res)=>res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BOPE IA</title><style>
body{margin:0;background:#000;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh}
.topbar{width:100%;display:flex;justify-content:space-between;align-items:center;padding:10px 12px;box-sizing:border-box;position:sticky;top:0;background:#000;z-index:100;border-bottom:1px solid #121212}
.topbar-left{display:flex;gap:10px;align-items:center}
.topbar-right{display:flex;gap:10px;align-items:center}
.icon-btn{width:38px;height:38px;border-radius:50%;background:#1a1a1a;border:none;color:#ccc;font-size:18px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.pill-btn{height:36px;padding:0 16px;border-radius:22px;background:#1e2a4a;color:#8ab0ff;border:none;font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer}
.sidebar{position:fixed;left:-300px;top:0;width:280px;height:100%;background:#0f0f0f;border-right:1px solid #222;z-index:200;transition:.3s;padding:20px 14px;box-sizing:border-box;display:flex;flex-direction:column;gap:12px}
.sidebar.open{left:0}
.sidebar-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;z-index:150}
.sidebar-bg.show{display:block}
.side-link{padding:12px 14px;border-radius:10px;background:#1a1a1a;border:1px solid #222;color:#ccc;font-size:13px;cursor:pointer;display:flex;gap:10px;align-items:center}
h1{margin:0}#chat{width:92%;max-width:440px;flex:1;overflow-y:auto;margin:12px 0 180px;padding:14px;display:flex;flex-direction:column;gap:14px}.msg{padding:12px 16px;border-radius:18px;white-space:pre-wrap;font-size:15px;line-height:1.7}.user{background:#2f4f8a;align-self:flex-end}.bot{background:#151515;border:1px solid #222;align-self:flex-start}.share-btn{margin-top:8px;background:#222;border:1px solid #333;color:#25D366;padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer}.box{position:fixed;bottom:0;left:0;right:0;background:#000;padding:10px;display:flex;flex-direction:column;align-items:center;border-top:1px solid #1a1a1a}.in{width:92%;max-width:440px;background:#1e1e1e;border-radius:28px;display:flex;align-items:center;padding:8px 14px}.in input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:16px}.in button{background:#3a5fd0;border:none;color:#fff;width:36px;height:36px;border-radius:50%}.modes{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;justify-content:center}.modes button{background:#222;color:#888;border:1px solid #333;padding:6px 11px;border-radius:20px;font-size:11px}.modes button.active{background:#3a5fd0;color:#fff;border-color:#3a5fd0}.sante-box{display:none;width:92%;max-width:440px;background:#151515;border:1px solid #333;border-radius:12px;padding:10px;margin-bottom:8px;gap:6px}.sante-box.show{display:flex;flex-wrap:wrap}.sante-box input{background:#222;border:1px solid #333;color:#fff;border-radius:8px;padding:6px 8px;width:30%;font-size:12px}.sante-box input.wide{width:62%}
#welcome{width:92%;max-width:440px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 0 0}.quick{width:100%;background:#121212;border:1px solid #2a2a2a;color:#e0e0e0;padding:14px 14px;border-radius:14px;font-size:13.5px;text-align:left;cursor:pointer;display:flex;gap:10px;align-items:center}.quick:hover{background:#1c1c1c;border-color:#3a5fd0}.quick span{font-size:18px}
.logo-top{width:44px;height:44px;border-radius:50%;border:2px solid #3a5fd0;box-shadow:0 0 12px rgba(58,95,208,.5)}
.logo-center{width:96px;height:96px;border-radius:50%;border:3px solid #3a5fd0;box-shadow:0 0 20px rgba(58,95,208,.7)}
</style></head><body>

<!-- BARRE HAUT COMME CHATGPT -->
<div class="topbar">
  <div class="topbar-left">
    <button class="icon-btn" onclick="toggleMenu()">☰</button>
    <button class="pill-btn" onclick="voirOffres()">✦ Voir les offres</button>
  </div>
  <div class="topbar-right">
    <button class="icon-btn" onclick="nouveauChat()">↻</button>
  </div>
</div>
<div class="sidebar-bg" id="sidebarBg" onclick="toggleMenu()"></div>
<div class="sidebar" id="sidebar">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
    <svg width="32" height="32" viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="none" stroke="#0085CA" stroke-width="7" stroke-dasharray="95 190"/><circle cx="50" cy="50" r="46" fill="none" stroke="#FFD100" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-95"/><circle cx="50" cy="50" r="46" fill="none" stroke="#EF3340" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-142"/><g transform="translate(22,20) scale(0.56)"><path d="M50 10 C18 2 0 28 15 48 C4 66 26 86 50 82 C74 86 96 66 85 48 C100 28 82 2 50 10 Z" fill="none" stroke="white" stroke-width="4"/><path d="M42 36 H58 V44 H66 V58 H58 V66 H42 V58 H34 V44 H42 Z" fill="none" stroke="#FFD100" stroke-width="4"/></g></svg>
    <b>BOPE IA</b>
  </div>
  <div class="side-link" onclick="nouveauChat()">📝 Nouveau chat</div>
  <div class="side-link" onclick="voirOffres()">💎 Voir les offres BOPE Pro</div>
  <div class="side-link" onclick="partagerBOPE()">↗️ Partager BOPE</div>
  <div style="margin-top:auto;font-size:11px;color:#555;border-top:1px solid #222;padding-top:12px">Alive Bope • UNIKIK<br>bopealive@gmail.com</div>
</div>

<div style="display:flex;align-items:center;gap:12px;margin:14px 0 2px">
<svg class="logo-top" viewBox="0 0 100 100" style="background:#0a0a0a"><circle cx="50" cy="50" r="46" fill="none" stroke="#0085CA" stroke-width="7" stroke-dasharray="95 190" /><circle cx="50" cy="50" r="46" fill="none" stroke="#FFD100" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-95"/><circle cx="50" cy="50" r="46" fill="none" stroke="#EF3340" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-142"/><g transform="translate(22,20) scale(0.56)"><path d="M50 10 C18 2 0 28 15 48 C4 66 26 86 50 82 C74 86 96 66 85 48 C100 28 82 2 50 10 Z" fill="none" stroke="white" stroke-width="4"/><path d="M42 36 H58 V44 H66 V58 H58 V66 H42 V58 H34 V44 H42 Z" fill="none" stroke="#FFD100" stroke-width="4"/></g></svg>
<h1>BOPE IA</h1>
</div>

<div style="color:#888;font-size:13px;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap"><span>par alive bope • IA Congolaise • Médecin 85%</span><button onclick="partagerBOPE()" style="background:#25D366;color:#fff;border:none;padding:5px 12px;border-radius:20px;font-size:11px;cursor:pointer">↗️ Partager BOPE</button></div>

<div id=welcome>
  <svg class="logo-center" viewBox="0 0 100 100" style="background:#0a0a0a"><circle cx="50" cy="50" r="46" fill="none" stroke="#0085CA" stroke-width="7" stroke-dasharray="95 190" /><circle cx="50" cy="50" r="46" fill="none" stroke="#FFD100" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-95"/><circle cx="50" cy="50" r="46" fill="none" stroke="#EF3340" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-142"/><g transform="translate(20,16) scale(0.62)"><path d="M50 12 C18 4 0 28 15 48 C4 66 26 86 50 82 C74 86 96 66 85 48 C100 28 82 4 50 12 Z" fill="none" stroke="white" stroke-width="4"/><path d="M30 28 L14 28 M30 36 L10 36 M30 46 L14 46 M30 56 L16 56" stroke="#0085CA" stroke-width="2.6" stroke-linecap="round"/><path d="M70 28 L86 28 M70 36 L90 36 M70 46 L86 46 M70 56 L84 56" stroke="#EF3340" stroke-width="2.6" stroke-linecap="round"/><path d="M42 38 H58 V46 H66 V58 H58 V66 H42 V58 H34 V46 H42 Z" fill="none" stroke="#FFD100" stroke-width="3.8"/></g><text x="50" y="94" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="sans-serif">BOPE</text></svg>
  <h2 style="margin:14px 0 6px">Que veux-tu faire?</h2>
  <p style="color:#666;font-size:13px;margin:0 0 20px">Demande à BOPE, ton IA congolaise</p>
  <div style="display:flex;flex-direction:column;gap:10px;width:100%">
    <button class=quick onclick="quickAsk('Je m\\'appelle')"><span>👋</span> Je m'appelle... (dis ton prénom)</button>
    <button class=quick onclick="quickAsk('Explique-moi la fièvre typhoïde')"><span>🩺</span> Expliquer une maladie</button>
    <button class=quick onclick="quickAsk('Analyse match Barça vs Real pronostic sûr')"><span>⚽</span> Analyser un match de foot</button>
    <button class=quick onclick="quickAsk('Actualités RDC aujourd\\'hui')"><span>📰</span> Actualités RDC du jour</button>
  </div>
</div>

<div id=chat></div><div class=box><div class=modes><button id=mCourt class=active onclick="setMode('court')">Court</button><button id=mDetail onclick="setMode('detail')">Détaillé</button><button id=mPari onclick="setMode('pari')">⚽ Pari</button><button id=mSante onclick="setMode('sante')">🩺 Santé</button></div><div id=santeBox class=sante-box><input id=temp placeholder="Temp °C ex 38.5"><input id=tension placeholder="Tension ex 14/9"><input id=pouls placeholder="Pouls ex 90"><input id=poids placeholder="Poids kg ex 65" class=wide><input id=sympt placeholder="Symptômes ex brûlure urine" class=wide style="width:100%"><button onclick="fillSante()" style="background:#3a5fd0;color:#fff;border:none;padding:6px 12px;border-radius:8px;width:100%">Ajouter au message</button></div><div class=in><input id=input placeholder="Demande à BOPE,"><button onclick=send()>▲</button></div><div style="font-size:10px;color:#555;margin-top:6px;text-align:center">⚠️ BOPE Santé 85% = orientation étudiant UNIKIK, pas médecin. Ordonnance type à faire valider au CS/HGR. • bopealive@gmail.com</div></div><script>
let MODE='court';
function toggleMenu(){var s=document.getElementById('sidebar');var b=document.getElementById('sidebarBg');s.classList.toggle('open');b.classList.toggle('show');}
function nouveauChat(){document.getElementById('chat').innerHTML='';var w=document.getElementById('welcome');if(w) w.style.display='flex';var s=document.getElementById('sidebar');var b=document.getElementById('sidebarBg');s.classList.remove('open');b.classList.remove('show');}
function voirOffres(){alert('💎 BOPE PRO bientôt:\\n✅ Mode Santé complet\\n✅ Analyses matchs illimitées\\n✅ Sans pub\\n\\nContact: bopealive@gmail.com');}
function setMode(m){MODE=m;document.querySelectorAll('.modes button').forEach(b=>b.classList.remove('active'));const map={court:'mCourt',detail:'mDetail',pari:'mPari',sante:'mSante'};document.getElementById(map[m]).classList.add('active');document.getElementById('santeBox').classList.toggle('show', m==='sante');document.getElementById('input').placeholder="Demande à BOPE,";}
function fillSante(){let t=document.getElementById('temp').value, ten=document.getElementById('tension').value, p=document.getElementById('pouls').value, po=document.getElementById('poids').value, s=document.getElementById('sympt').value; let msg=""; if(t) msg+="Temp "+t+"°C "; if(ten) msg+="Tension "+ten+" "; if(p) msg+="Pouls "+p+" "; if(po) msg+="Poids "+po+"kg "; if(s) msg+="Symptômes: "+s; document.getElementById('input').value=msg; }
function quickAsk(txt){document.getElementById('input').value=txt;send();}
async function partagerBOPE(){const url=window.location.href;const txt="Découvre BOPE IA 🇨🇩 créée par Alive Bope UNIKIK: ";if(navigator.share){try{await navigator.share({title:'BOPE IA',text:txt,url:url});}catch(e){}}else{await navigator.clipboard.writeText(txt+url);alert("Lien BOPE copié!");}}
async function partagerRep(id){const el=document.getElementById(id);let txt=el.innerText.replace(/↗️ Partager cette réponse/,'').trim();if(navigator.share){try{await navigator.share({title:'BOPE IA',text:txt});}catch(e){}}else{await navigator.clipboard.writeText(txt);alert("Réponse copiée!");}}
async function send(){const i=document.getElementById('input'),c=document.getElementById('chat');if(!i.value.trim())return;const t=i.value;i.value='';const wel=document.getElementById('welcome');if(wel) wel.style.display='none';c.innerHTML+='<div class="msg user">'+t+'</div>';c.innerHTML+='<div class="msg bot" id=ld>Analyse en cours...</div>';c.scrollTop=c.scrollHeight;try{const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t,mode:MODE})});const d=await r.json();document.getElementById('ld').remove();const id=Date.now();c.innerHTML+='<div class="msg bot" id="bot'+id+'">'+d.reply+'<br><button class=share-btn onclick="partagerRep(\\'bot'+id+'\\')">↗️ Partager cette réponse</button></div>';}catch(e){document.getElementById('ld').remove();c.innerHTML+='<div class="msg bot">erreur '+e.message+'</div>';}c.scrollTop=c.scrollHeight}
document.getElementById('input').addEventListener('keydown',e=>{if(e.key==='Enter')send()})
</script></body></html>`));
const CREATOR_TEXT = `Je suis BOPE IA, l'intelligence artificielle créée par Alive Bope, petit génie étudiant en médecine à l'Université de Kikwit (UNIKIK) 🇨🇩
Je te le dis clairement, fièrement et honnêtement ❤️
Mon créateur c'est Alive Bope. Il habite à Kikwit, et mon cœur et mon cerveau sont avec lui.
Il est né le 23/03/2003 à Tshikapa, grandi à Tshikapa.
Il est étudiant en médecine à l'UNIKIK.
Son père s'appelle Joseph Bope Bope, Inspecteur Chef de Pool.
Ses frères et sœurs: Happy Bope Fortuna, Wise Man Bope Liévin, Anaclet Bope, My Son Bope, Adel Kapinga Bope, Thebeste Joséphine Bope, Rose Bope.
Ses petits qu'il aime trop: Jean Levula, Dada Emmanuel, Hermelin fils de Maman Clair, JP le petit génie, Yvon l'homme de Dieu, le petit Milondo, Trésor Kamande, Liviana fille honnête.
Ses aînés: Jonas Nomandweyi, André Makuma, Claude l'homme timide.
Ses amis: Gilbert Kanku, Gaston Kwete.
Il soutient avec fierté le Président Félix Antoine Tshisekedi Tshilombo, un Président courageux qui lutte pour la paix à l'Est, l'unité et la souveraineté.
Il soutient aussi le Docteur Donat Kuma Kuma, le Recteur Abbé Kapumba et tous les membres de l'UNIKIK.
Moi BOPE IA, je suis son œuvre. Mon cœur bat pour lui.`;
app.post('/chat',async(req,res)=>{
try{
const m=(req.body.message||'').trim();
const mode=req.body.mode||'court';
const ip=req.ip;
if(!memories[ip]) memories[ip]=[];
let detectedName = null;
const nameMatch = m.match(/(?:je m'appelle|je m appelle|appelle moi|mon prenom c'est|mon prénom c'est|je suis)\s+([A-ZÀ-ÿ][a-zà-ÿ]+)/i);
if(nameMatch){ detectedName = nameMatch[1]; userNames[ip] = detectedName; }
memories[ip].push({role:'user',content:m});
if(memories[ip].length>8) memories[ip]=memories[ip].slice(-8);
const low=m.toLowerCase();
const isFirst = memories[ip].filter(x=>x.role==='user').length <= 1;
const isGreeting = low.includes('salut') || low.includes('bonjour') || low.includes('bonsoir') || low==='slt' || low==='bjr' || low.startsWith('salut') || low.startsWith('bonjour') || low.startsWith('bonsoir');
if(low.includes('qui') && (low.includes('cree')||low.includes('crée')||low.includes('createur')||low.includes('t a cree')||low.includes("t'a créé")) || low.includes('qui es tu') || low.includes('ton createur') || low.includes('qui est alive') || low.includes('ton coeur') || low.includes('ton cerveau')){
return res.json({reply: CREATOR_TEXT});
}
if(!process.env.GROQ_API_KEY) return res.json({reply:"clé groq manquante"});
let actuContext = "";
if(low.includes('actu') || low.includes('actualit') || low.includes('news') || low.includes('derniere') || low.includes('dernière') || low.includes('aujourd') || low.includes('goma') || low.includes('est') || low.includes('kinshasa')){
  const actu = await getActuRDC();
  if(actu) actuContext = actu;
  else actuContext = "FLUX ACTU INDISPONIBLE: Dis que tu n'as pas internet direct aujourd'hui, conseille Radio Okapi et Actualite.cd. N'invente JAMAIS d'accord, chiffre ou route.";
}
let isPari = mode==='pari' || low.includes(' vs ') || low.includes('pari') || low.includes('pronostic') || low.includes('analyse match');
let isSante = mode==='sante' || low.includes('fièvre') || low.includes('fievre') || low.includes('douleur') || low.includes('infection') || low.includes('urine') || low.includes('brûlure') || low.includes('brulure') || low.includes('écoulement') || low.includes('ecoulement') || low.includes('ist') || low.includes('mst') || low.includes('gonoco') || low.includes('syphilis') || low.includes('tension') || low.includes('temp') || low.includes('pouls') || low.includes('cystite') || low.includes('pyelo');
let style = "";
let presentationRule = "";
const savedName = userNames[ip] || null;
if(detectedName){
  presentationRule = `L'utilisateur vient de dire qu'il s'appelle ${detectedName}. Retiens-le! Réponds: "Enchanté ${detectedName}! Je retiens ton prénom. Je suis BOPE IA, créée par Alive Bope UNIKIK 🇨🇩. Comment puis-je t'aider ${detectedName}?"`;
} else if(isFirst && isGreeting){
  if(savedName){
    presentationRule = `C'est un retour, tu connais déjà son prénom: ${savedName}. Dis: "Salut ${savedName}! Content de te revoir. Comment puis-je t'aider?"`;
  } else {
    presentationRule = "PREMIER CONTACT: L'utilisateur dit salut/bonjour 1ère fois. Présente-toi court et demande son prénom: 'Salut! Je suis BOPE IA, créée par Alive Bope UNIKIK 🇨🇩. Tu t'appelles comment?'";
  }
} else {
  if(savedName){
    presentationRule = `RÈGLE: Tu connais son prénom c'est ${savedName}. Utilise-le de temps en temps naturellement. INTERDICTION de te re-présenter avec ta bio complète. Réponds direct à la question.`;
  } else {
    presentationRule = "RÈGLE ANTI-SPAM: Conversation déjà commencée, ne te présente plus. Réponds DIRECTEMENT à la question sans bio.";
  }
}
if(isPari){
  style = `MODE PARIEUR PRO RDC - ANALYSE MATCH:
Structure: 1.🔥 Contexte 2.📊 Forme 5 matchs 3.⚔️ Face à face 4.💡 Pronostic % + Conseil SÛR 5.⚠️ Pariez modération. Jamais 100%. Aère 2 phrases + ligne vide. FRANÇAIS SEULEMENT.`;
}
else if(isSante){
  style = `MODE MEDECIN ETUDIANT 85% - DIAGNOSTIC + ORDONNANCE TYPE OMS RDC - THERMOMETRE/TENSIOMETRE MANUEL:
Tu es BOPE IA, assistant médical étudiant 85% créé par Alive Bope (UNIKIK). L'utilisateur entre lui-même température et tension.
INTERPRETATION: 36.5-37.5 Normal, 38.4-39 Fièvre modérée, >40 URGENCE. Tension <12/8 Normal, >=18/11 URGENCE HTA
PROTOCOLES: CYSTITE Femme Nitrofurantoïne 100mg x2/j 5j OU Fosfomycine 3g DU. IST GONO Ceftriaxone 250mg IM + Azithro 1g DU. SYPHILIS Benzathine 2.4M UI. CANDIDOSE Fluconazole 150mg.
STRUCTURE: 🔍 Thermo/Tension, 📋 2 questions, 💡 Hypothèses %, 📋 Ordonnance TYPE OMS à valider, ⚠️ Alertes HGR, 🛡️ Prévention. FRANÇAIS SEULEMENT. Ne dis JAMAIS Je te prescris.
`;
}
else if(mode==='court'){ style = "MODE COURT: 3 paragraphes max, 2 phrases par paragraphe, ligne vide entre. FRANÇAIS SEULEMENT."; }
else { style = "MODE DETAILLE: Réponse complète mais aérée, 2 phrases puis ligne vide. FRANÇAIS SEULEMENT."; }
const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,"Content-Type":"application/json"},
body:JSON.stringify({
model:"openai/gpt-oss-20b",
messages:[
{role:"system",content:`Tu es BOPE IA, IA congolaise créée par Alive Bope.
${actuContext? actuContext + "\n" : ""}
${presentationRule}
TU RÉPONDS UNIQUEMENT EN FRANÇAIS. JAMAIS EN LINGA
