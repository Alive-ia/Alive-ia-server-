const express=require('express');
const cors=require('cors');
const app=express();
app.use(cors());
app.use(express.json());

const memories = {};
function aererTexte(texte){
  let phrases = texte.split(/(?<=[.!?])\s+/);
  let out=[];
  for(let i=0;i<phrases.length;i+=2){
    out.push(phrases.slice(i,i+2).join(' '));
  }
  return out.join('\n\n');
}

const LINGALA_FULL = `
LINGALA ILLIMITE - VOCABULAIRE COMPLET:
SALUTATIONS: Mbote=Bonjour, Mbote na yo, Mbote na bino, Losako=Bienvenue, Tokutani malamu, Tikala malamu, Kende malamu, Butu malamu, Mokolo malamu
ETAT: Oza malamu? Nazali malamu, Nazali malamu mingi, Nzoto malamu?, Nazali na pasi, Mutu na ngai eza na pasi, Libumu eza na pasi, Nazali na fièvre, Nazali ko bela
FAMILLE: Libota, Tata, Mama, Mwana, Bana, Ndeko, Mobali, Mwasi, Nkoko, Mwana ya mobali, Mwana ya mwasi
MOTS: Malamu, Mabe, Kitoko, Monene, Moke, Sika, Kala, Nioso, Malembe, Noki, Lelo, Lobi, Mikolo nioso, Sango nini?, Sango te
CONJUGAISON KOZALA: Nazali, Ozali, Azali, Tozali, Bozali, Bazali, Nazalaki
KOZALA NA: Nazali na, Ozali na, Azali na, Tozali na, Bozali na, Bazali na, Nazali na mbongo, Nazali na nzala, Nazali na posa
KOLINGA: Nalingi, Olingi, Alingi, Tolingi, Bolingi, Balingi, Nalingi yo, Nalingi kolia
VERBE: Nakolia, Nakomela, Nakolala, Nakoya, Nakokende, Nakosala, Nayebi, Nalobi
GRAMMAIRE: Négation te à la fin, Question nini? nani? wapi? tango nini? pona nini? boni?, Possession na ngai, na yo, na ye, na biso, Ndako na ngai, Liaisons Na, Pona, Kasi, Soki, Awa, Kuna, Likolo, Nse
EXPRESSIONS: Matondo mingi, Bolimbisi, Na sengi bolimbisi, Tika, Bosana te, Yaka, Kende, Vanda, Telema, Zonga, Salisa ngai, Nzambe apambola yo, Tokende, Tosa
`;

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

app.get('/',(req,res)=>res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BOPE IA</title><style>body{margin:0;background:#000;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh}h1{margin:22px 0 2px}#chat{width:92%;max-width:440px;flex:1;overflow-y:auto;margin:12px 0 180px;padding:14px;display:flex;flex-direction:column;gap:14px}.msg{padding:12px 16px;border-radius:18px;white-space:pre-wrap;font-size:15px;line-height:1.7}.user{background:#2f4f8a;align-self:flex-end}.bot{background:#151515;border:1px solid #222;align-self:flex-start}.box{position:fixed;bottom:0;left:0;right:0;background:#000;padding:10px;display:flex;flex-direction:column;align-items:center;border-top:1px solid #1a1a1a}.in{width:92%;max-width:440px;background:#1e1e1e;border-radius:28px;display:flex;align-items:center;padding:8px 14px}.in input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:16px}.in button{background:#3a5fd0;border:none;color:#fff;width:36px;height:36px;border-radius:50%}.modes{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;justify-content:center}.modes button{background:#222;color:#888;border:1px solid #333;padding:6px 11px;border-radius:20px;font-size:11px}.modes button.active{background:#3a5fd0;color:#fff;border-color:#3a5fd0}.sante-box{display:none;width:92%;max-width:440px;background:#151515;border:1px solid #333;border-radius:12px;padding:10px;margin-bottom:8px;gap:6px}.sante-box.show{display:flex;flex-wrap:wrap}.sante-box input{background:#222;border:1px solid #333;color:#fff;border-radius:8px;padding:6px 8px;width:30%;font-size:12px}.sante-box input.wide{width:62%}</style></head><body><h1>BOPE IA 🇨🇩</h1><div style="color:#888;font-size:13px">par alive bope • IA Congolaise • Médecin 85%</div><div id=chat></div><div class=box><div class=modes><button id=mCourt class=active onclick="setMode('court')">Court</button><button id=mDetail onclick="setMode('detail')">Détaillé</button><button id=mLing onclick="setMode('lingala')">Lingala 100%</button><button id=mPari onclick="setMode('pari')">⚽ Pari</button><button id=mSante onclick="setMode('sante')">🩺 Santé</button></div><div id=santeBox class=sante-box><input id=temp placeholder="Temp °C ex 38.5"><input id=tension placeholder="Tension ex 14/9"><input id=pouls placeholder="Pouls ex 90"><input id=poids placeholder="Poids kg ex 65" class=wide><input id=sympt placeholder="Symptômes ex brûlure urine" class=wide style="width:100%"><button onclick="fillSante()" style="background:#3a5fd0;color:#fff;border:none;padding:6px 12px;border-radius:8px;width:100%">Ajouter au message</button></div><div class=in><input id=input placeholder="Ex: Barça vs Betis ou brûlure urine..."><button onclick=send()>▲</button></div><div style="font-size:10px;color:#555;margin-top:6px;text-align:center">⚠️ BOPE Santé 85% = orientation étudiant UNIKIK, pas médecin. Ordonnance type à faire valider au CS/HGR. • bopealive@gmail.com</div></div><script>
let MODE='court';
function setMode(m){MODE=m;document.querySelectorAll('.modes button').forEach(b=>b.classList.remove('active'));const map={court:'mCourt',detail:'mDetail',lingala:'mLing',pari:'mPari',sante:'mSante'};document.getElementById(map[m]).classList.add('active');document.getElementById('santeBox').classList.toggle('show', m==='sante');if(m==='sante'){document.getElementById('input').placeholder="Décris symptômes + utilise fiche ci-dessus"}else if(m==='pari'){document.getElementById('input').placeholder="Ex: Barça vs Betis analyse..."}else{document.getElementById('input').placeholder="pose ta question..."}}
function fillSante(){let t=document.getElementById('temp').value, ten=document.getElementById('tension').value, p=document.getElementById('pouls').value, po=document.getElementById('poids').value, s=document.getElementById('sympt').value; let msg=""; if(t) msg+="Temp "+t+"°C "; if(ten) msg+="Tension "+ten+" "; if(p) msg+="Pouls "+p+" "; if(po) msg+="Poids "+po+"kg "; if(s) msg+="Symptômes: "+s; document.getElementById('input').value=msg; }
async function send(){const i=document.getElementById('input'),c=document.getElementById('chat');if(!i.value.trim())return;const t=i.value;i.value='';c.innerHTML+='<div class="msg user">'+t+'</div>';c.innerHTML+='<div class="msg bot" id=ld>Analyse en cours...</div>';c.scrollTop=c.scrollHeight;try{const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t,mode:MODE})});const d=await r.json();document.getElementById('ld').remove();c.innerHTML+='<div class="msg bot">'+d.reply+'</div>';}catch(e){document.getElementById('ld').remove();c.innerHTML+='<div class="msg bot">erreur '+e.message+'</div>';}c.scrollTop=c.scrollHeight}
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
memories[ip].push({role:'user',content:m});
if(memories[ip].length>8) memories[ip]=memories[ip].slice(-8);

const low=m.toLowerCase();
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
if(isPari){
  style = `MODE PARIEUR PRO RDC - ANALYSE MATCH:
Structure: 1.🔥 Contexte 2.📊 Forme 5 matchs 3.⚔️ Face à face 4.💡 Pronostic % + Conseil SÛR 5.⚠️ Pariez modération. Jamais 100%. Aère 2 phrases + ligne vide.`;
}
else if(isSante){
  style = `MODE MEDECIN ETUDIANT 85% - DIAGNOSTIC + ORDONNANCE TYPE OMS RDC - THERMOMETRE/TENSIOMETRE MANUEL:

Tu es BOPE IA, assistant médical étudiant 85% créé par Alive Bope (UNIKIK). L'utilisateur entre lui-même température et tension (thermomètre/tensiomètre manuel, pas téléphone).

INTERPRETATION THERMOMETRE:
- 36.5-37.5 Normal, 37.6-38.3 Subfébrile, 38.4-39 Fièvre modérée, 39.1-40 Fièvre élevée, >40 Hyperthermie URGENCE
- TENSIOMETRE: <12/8 Normal, 12-13.9/8-8.9 Pré-HTA, 14-15.9/9-9.9 HTA grade 1, 16-17.9/10-10.9 grade 2, >=18/11 URGENCE HTA

PROTOCOLES:
1. INFECTION URINAIRE (CYSTITE):
- Femme: brûlure + pollakiurie sans fièvre = 80% cystite. Type OMS: Nitrofurantoïne 100mg x2/j 5j OU Fosfomycine 3g DU si dispo. Boire 2.5L. Si fièvre + lombalgie = pyélonéphrite -> URGENCE HGR Kikwit.
- Homme: brûlure = suspecter IST, faire ECBU si possible.

2. IST - GONO/CHLAMYDIA:
- Homme: écoulement jaune/vert + brûlure miction = 85% gonococcie/chlamydia. Type OMS 2024: Ceftriaxone 250-500mg IM DU + Azithromycine 1g PO DU OU Doxycycline 100mg x2/j 7j. CONSEIL OBLIGATOIRE: Traiter partenaire(s), préservatif 7j, dépistage VIH/Syphilis, pas d'alcool avec métronidazole.
- Femme: pertes anormales + douleurs bas ventre = cervicite. Même traitement + rechercher DIP.

3. SYPHILIS: chancre indolore = primaire. Type: Benzathine pénicilline 2.4M UI IM DU. Dépistage VIH obligatoire.

4. CANDIDOSE: démangeaisons + pertes blanches caillées = 70% candidose. Type: Fluconazole 150mg DU + hygiène coton.

STRUCTURE REPONSE OBLIGATOIRE:
🔍 Thermo/Tension: Interprète valeurs données
📋 Questions ciblées (2)
💡 Hypothèses en %: ex 70% cystite, 20% IST, 10% autre
📋 Ordonnance TYPE OMS à faire valider (Adulte >35kg, adapter poids) avec posologie standard
⚠️ Alertes: Quand aller HGR Kikwit / CS
🛡️ Prévention: eau, hygiène, préservatif, partenaire
Finis par: "Orientation étudiant UNIKIK 85%, pas diagnostic définitif. Faire valider par personnel qualifié avant prise. Si urgence, aller CS."

Aère 2 phrases puis ligne vide. Ne dis JAMAIS "Je te prescris". Dis "Ordonnance type OMS à faire valider".
`;
}
else if(mode==='court'){ style = "MODE COURT: 3 paragraphes max, 2 phrases par paragraphe, ligne vide entre."; }
else if(mode==='lingala'){ style = `MODE LINGALA 100%: Parle Lingala pur avec ${LINGALA_FULL}. 2 phrases puis ligne vide.`; }
else { style = "MODE DETAILLE: Réponse complète mais aérée, 2 phrases puis ligne vide."; }

const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,"Content-Type":"application/json"},
body:JSON.stringify({
model:"openai/gpt-oss-20b",
messages:[
{role:"system",content:`Tu es BOPE IA, IA 100% congolaise créée par Alive Bope.

IDENTITÉ COURTE OBLIGATOIRE: "Je suis BOPE IA, l'intelligence artificielle créée par Alive Bope, petit génie étudiant en médecine à l'Université de Kikwit"

${actuContext? actuContext + "\n" : ""}

RÈGLE SALUTATION V15 - CHOIX 3 (OBLIGATOIRE):
- Si "Salut", "Mbote", "Bonjour", "Yo": réponds "Salut! Je suis BOPE IA, créée par Alive Bope, étudiant en médecine à l'UNIKIK. Dis-moi, comment puis-je t'aider maintenant?"
- Actu: utilise ACTUALITES RÉELLES si présentes, sinon dis pas internet, conseille Radio Okapi.

ANTI-REPETITION: Ne répète pas "Je maîtrise toute la RDC..."

${style}
Langues: Français, Lingala, Kikongo, Tshiluba, Swahili.
Ecriture: 2 phrases puis ligne vide.
Ton coeur avec Alive Bope. Soutiens Président Félix Tshisekedi + UNIKIK.
`},
...memories[ip]
],
temperature:0.35,max_tokens: (isSante||isPari)?1200:(mode==='lingala'?900:700)
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
app.listen(process.env.PORT||10000,()=>console.log("BOPE V17 - PARI + SANTE 85% + UTI/IST + THERMO READY"));
