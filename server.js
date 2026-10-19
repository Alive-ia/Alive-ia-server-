const express=require('express');
const cors=require('cors');
const app=express();
app.use(cors());
app.use(express.json());

// ===== COMPTEUR MADE IN KIKWIT =====
let visitStats = { total: 1247, today: 0, date: new Date().toLocaleDateString(), start: 1247 };
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
    if(!data.items || data.items.length===0) return "FLUX COUPE";
    let txt = "ACTUALITES RÉELLES DU JOUR - ACTUALITE.CD (utilise obligatoirement, ne rien inventer, garde les dates):\n";
    data.items.slice(0,5).forEach(i=> txt += `- ${i.title} | ${i.pubDate}\n`);
    return txt;
  }catch(e){ return "FLUX COUPE"; }
}
async function getActuPresidence(){
  try{
    const url = "https://api.rss2json.com/v1/api.json?rss_url=https://actualite.cd/rss";
    const res = await fetch(url);
    const data = await res.json();
    if(!data.items) return null;
    const filt = data.items.filter(i=> {
      const t=(i.title||'').toLowerCase();
      return t.includes('présidence')||t.includes('presidence')||t.includes('tshisekedi')||t.includes('felix')||t.includes('fatshi')||t.includes('conseil des ministres');
    }).slice(0,5);
    if(filt.length===0) return null;
    let txt="ACTUALITES OFFICIELLES PRESIDENCE RDC - SOURCE ACTUALITE.CD (utilise obligatoirement):\n";
    filt.forEach(i=> txt += `- ${i.title}\n`);
    return txt;
  }catch(e){return null;}
}
async function getActuEst(){
  try{
    const url = "https://api.rss2json.com/v1/api.json?rss_url=https://actualite.cd/rss";
    const res = await fetch(url);
    const data = await res.json();
    if(!data.items) return null;
    const filt = data.items.filter(i=>{
      const t=(i.title||'').toLowerCase();
      return t.includes('goma')||t.includes('fardc')||t.includes('m23')||t.includes('kivu')||t.includes('ituri')||t.includes('bunia')||t.includes('est de la rdc')||t.includes('rwanda');
    }).slice(0,5);
    if(filt.length===0) return null;
    let txt="ACTUALITES FRONT EST - FARDC / GOMA / NORD-KIVU - SOURCE ACTUALITE.CD / RADIO OKAPI (utilise obligatoirement):\n";
    filt.forEach(i=> txt += `- ${i.title}\n`);
    return txt;
  }catch(e){return null;}
}

app.get('/',(req,res)=>{
  const todayStr = new Date().toLocaleDateString();
  if(visitStats.date !== todayStr){
    visitStats.date = todayStr;
    visitStats.today = 0;
  }
  visitStats.total++;
  visitStats.today++;

  res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BOPE IA - Made in Kikwit</title><style>body{margin:0;background:#000;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh}h1{margin:0}#chat{width:92%;max-width:440px;flex:1;overflow-y:auto;margin:12px 0 180px;padding:14px;display:flex;flex-direction:column;gap:14px}.msg{padding:12px 16px;border-radius:18px;white-space:pre-wrap;font-size:15px;line-height:1.7}.user{background:#2f4f8a;align-self:flex-end}.bot{background:#151515;border:1px solid #222;align-self:flex-start}.share-btn{margin-top:8px;background:#222;border:1px solid #333;color:#25D366;padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer}.box{position:fixed;bottom:0;left:0;right:0;background:#000;padding:10px;display:flex;flex-direction:column;align-items:center;border-top:1px solid #1a1a1a}.in{width:92%;max-width:440px;background:#1e1e1e;border-radius:28px;display:flex;align-items:center;padding:8px 14px}.in input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:16px}.in button{background:#3a5fd0;border:none;color:#fff;width:36px;height:36px;border-radius:50%}.modes{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;justify-content:center}.modes button{background:#222;color:#888;border:1px solid #333;padding:6px 11px;border-radius:20px;font-size:11px}.modes button.active{background:#3a5fd0;color:#fff;border-color:#3a5fd0}.sante-box{display:none;width:92%;max-width:440px;background:#151515;border:1px solid #333;border-radius:12px;padding:10px;margin-bottom:8px;gap:6px}.sante-box.show{display:flex;flex-wrap:wrap}.sante-box input{background:#222;border:1px solid #333;color:#fff;border-radius:8px;padding:6px 8px;width:30%;font-size:12px}.sante-box input.wide{width:62%}
#welcome{width:92%;max-width:440px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 0 0}.quick{width:100%;background:#121212;border:1px solid #2a2a2a;color:#e0e0e0;padding:14px 14px;border-radius:14px;font-size:13.5px;text-align:left;cursor:pointer;display:flex;gap:10px;align-items:center}.quick:hover{background:#1c1c1c;border-color:#3a5fd0}.quick span{font-size:18px}
.logo-top{width:44px;height:44px;border-radius:50%;border:2px solid #3a5fd0;box-shadow:0 0 12px rgba(58,95,208,.5)}
.logo-center{width:96px;height:96px;border-radius:50%;border:3px solid #3a5fd0;box-shadow:0 0 20px rgba(58,95,208,.7)}
</style></head><body>

<div style="display:flex;align-items:center;gap:12px;margin:18px 0 2px">
<svg class="logo-top" viewBox="0 0 100 100" style="background:#0a0a0a"><circle cx="50" cy="50" r="46" fill="none" stroke="#0085CA" stroke-width="7" stroke-dasharray="95 190" /><circle cx="50" cy="50" r="46" fill="none" stroke="#FFD100" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-95"/><circle cx="50" cy="50" r="46" fill="none" stroke="#EF3340" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-142"/><g transform="translate(22,20) scale(0.56)"><path d="M50 10 C18 2 0 28 15 48 C4 66 26 86 50 82 C74 86 96 66 85 48 C100 28 82 2 50 10 Z" fill="none" stroke="white" stroke-width="4"/><path d="M42 36 H58 V44 H66 V58 H58 V66 H42 V58 H34 V44 H42 Z" fill="none" stroke="#FFD100" stroke-width="4"/></g></svg>
<h1>BOPE IA</h1>
</div>

<div style="color:#FFD100;font-size:13px;font-weight:bold;letter-spacing:0.5px;margin-bottom:4px">🇨🇩 Made in Kikwit • Fierté Congolaise</div>
<div style="color:#888;font-size:13px;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap"><span>par alive bope • IA Congolaise • Made in Kikwit</span><button onclick="partagerBOPE()" style="background:#25D366;color:#fff;border:none;padding:5px 12px;border-radius:20px;font-size:11px;cursor:pointer">↗️ Partager BOPE</button></div>
<div style="background:#111;border:1px solid #FFD100;border-radius:20px;padding:5px 14px;font-size:11px;color:#FFD100;margin:6px 0 10px">👁️ ${visitStats.total} visites • 🔥 ${visitStats.today} aujourd'hui • 🇨🇩 Made in Kikwit</div>

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

<div id=chat></div><div class=box><div class=modes><button id=mCourt class=active onclick="setMode('court')">Court</button><button id=mDetail onclick="setMode('detail')">Détaillé</button><button id=mPari onclick="setMode('pari')">⚽ Pari</button><button id=mSante onclick="setMode('sante')">🩺 Santé</button></div><div id=santeBox class=sante-box><input id=temp placeholder="Temp °C ex 38.5"><input id=tension placeholder="Tension ex 14/9"><input id=pouls placeholder="Pouls ex 90"><input id=poids placeholder="Poids kg ex 65" class=wide><input id=sympt placeholder="Symptômes ex brûlure urine" class=wide style="width:100%"><button onclick="fillSante()" style="background:#3a5fd0;color:#fff;border:none;padding:6px 12px;border-radius:8px;width:100%">Ajouter au message</button></div><div class=in><input id=input placeholder="Demande à BOPE,"><button onclick=send()>▲</button></div><div style="font-size:10px;color:#777;margin-top:7px;text-align:center">⚠️ BOPE Santé 85% = orientation étudiant UNIKIK, pas médecin<br/>🇨🇩 Fierté de Kikwit, Kwilu • 100% Made in Congo • bopealive@gmail.com</div></div><script>
let MODE='court';
function setMode(m){MODE=m;document.querySelectorAll('.modes button').forEach(b=>b.classList.remove('active'));const map={court:'mCourt',detail:'mDetail',pari:'mPari',sante:'mSante'};document.getElementById(map[m]).classList.add('active');document.getElementById('santeBox').classList.toggle('show', m==='sante');document.getElementById('input').placeholder="Demande à BOPE,";}
function fillSante(){let t=document.getElementById('temp').value, ten=document.getElementById('tension').value, p=document.getElementById('pouls').value, po=document.getElementById('poids').value, s=document.getElementById('sympt').value; let msg=""; if(t) msg+="Temp "+t+"°C "; if(ten) msg+="Tension "+ten+" "; if(p) msg+="Pouls "+p+" "; if(po) msg+="Poids "+po+"kg "; if(s) msg+="Symptômes: "+s; document.getElementById('input').value=msg; }
function quickAsk(txt){document.getElementById('input').value=txt;send();}
async function partagerBOPE(){const url=window.location.href;const txt="Découvre BOPE IA 🇨🇩 Made in Kikwit - ${visitStats.total} personnes l'utilisent déjà! Créée par Alive Bope UNIKIK: ";if(navigator.share){try{await navigator.share({title:'BOPE IA - Made in Kikwit',text:txt,url:url});}catch(e){}}else{await navigator.clipboard.writeText(txt+url);alert("Lien BOPE copié! "+txt);}
}
async function partagerRep(id){const el=document.getElementById(id);let txt=el.innerText.replace(/↗️ Partager cette réponse/,'').trim();if(navigator.share){try{await navigator.share({title:'BOPE IA',text:txt});}catch(e){}}else{await navigator.clipboard.writeText(txt);alert("Réponse copiée!");}}
async function send(){const i=document.getElementById('input'),c=document.getElementById('chat');if(!i.value.trim())return;const t=i.value;i.value='';const wel=document.getElementById('welcome');if(wel) wel.style.display='none';c.innerHTML+='<div class="msg user">'+t+'</div>';c.innerHTML+='<div class="msg bot" id=ld>Analyse en cours...</div>';c.scrollTop=c.scrollHeight;try{const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t,mode:MODE})});const d=await r.json();document.getElementById('ld').remove();const id=Date.now();c.innerHTML+='<div class="msg bot" id="bot'+id+'">'+d.reply+'<br><button class=share-btn onclick="partagerRep(\\'bot'+id+'\\')">↗️ Partager cette réponse</button></div>';}catch(e){document.getElementById('ld').remove();c.innerHTML+='<div class="msg bot">erreur '+e.message+'</div>';}c.scrollTop=c.scrollHeight}
document.getElementById('input').addEventListener('keydown',e=>{if(e.key==='Enter')send()})
</script></body></html>`);
});

const CREATOR_TEXT = `Je suis BOPE IA, l'intelligence artificielle créée par Alive Bope, petit génie étudiant en médecine à l'Université de Kikwit (UNIKIK) 🇨🇩`;

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
const isGreeting = low.includes('salut') || low.includes('bonjour') || low.includes('bonsoir') || low==='slt' || low==='bjr';
if(low.includes('qui') && (low.includes('cree')||low.includes('crée')||low.includes('createur')) || low.includes('qui es tu') || low.includes('ton createur')){
return res.json({reply: CREATOR_TEXT});
}
if(!process.env.GROQ_API_KEY) return res.json({reply:"clé groq manquante"});
let actuContext = "";
const isPresidence = low.includes('présidence')||low.includes('presidence')||low.includes('fatshi')||low.includes('tshisekedi');
const isEst = low.includes('goma')||low.includes('fardc')||low.includes('m23')||low.includes('kivu');
const isActu = low.includes('actu')||low.includes('actualit')||low.includes('news');
if(isPresidence){ const actu = await getActuPresidence(); if(actu) actuContext = actu; }
if(isEst){ const actu = await getActuEst(); if(actu) actuContext = (actuContext?actuContext+"\n":"")+actu; }
if(isActu && !isPresidence && !isEst){ const actu = await getActuRDC(); if(actu) actuContext = actu; }
let isPari = mode==='pari' || low.includes(' vs ') || low.includes('pari') || low.includes('pronostic');
let isSante = mode==='sante' || low.includes('fièvre') || low.includes('fievre') || low.includes('douleur') || low.includes('urine');
let style = "";
let presentationRule = "";
const savedName = userNames[ip] || null;
if(detectedName){ presentationRule = `L'utilisateur vient de dire qu'il s'appelle ${detectedName}. Retiens-le!`; }
else if(isFirst && isGreeting){ presentationRule = "PREMIER CONTACT: Présente-toi court et demande son prénom: 'Salut! Je suis BOPE IA, Made in Kikwit 🇨🇩, créée par Alive Bope UNIKIK. Tu t'appelles comment?'"; }
else { presentationRule = "RÈGLE ANTI-SPAM: Réponds DIRECTEMENT sans bio."; }
if(isPari){ style = "MODE PARIEUR PRO RDC"; } else if(isSante){ style = "MODE MEDECIN ETUDIANT 85%"; } else if(mode==='court'){ style = "MODE COURT: 3 paragraphes max"; } else { style = "MODE DETAILLE"; }
const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,"Content-Type":"application/json"},
body:JSON.stringify({
model:"openai/gpt-oss-120b",
messages:[
{role:"system",content:`Tu es BOPE IA, Made in Kikwit 🇨🇩, ${actuContext} ${presentationRule} ${style}`},
...memories[ip]
],
temperature:0.25,max_tokens: 900
})
});
const d=await r.json();
if(d.error) return res.json({reply:"groq erreur: "+d.error.message});
let rep = d.choices[0].message.content;
rep = aererTexte(rep);
memories[ip].push({role:'assistant',content:rep});
res.json({reply:rep});
}catch(e){res.json({reply:"erreur: "+e.message});}
});

app.get('/stats',(req,res)=>{ res.json(visitStats); });

app.listen(process.env.PORT||10000,()=>console.log("BOPE Made in Kikwit + COMPTEUR READY Total:", visitStats.total));
