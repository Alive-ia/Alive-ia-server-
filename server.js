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
    const url = "https://news.google.com/rss/search?q=RDC+OR+Congo+Kinshasa+OR+Tshisekedi&hl=fr&gl=CD&ceid=CD:fr";
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const xml = await res.text();
    const titles = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].slice(1,6).map(m=>m[1]);
    if(titles.length===0) return null;
    let txt = "ACTUALITES RÉELLES DU JOUR - GOOGLE NEWS RDC (à utiliser obligatoirement):\n";
    titles.forEach(t=> txt += `- ${t}\n`);
    return txt;
  }catch(e){ return null; }
}

app.get('/',(req,res)=>res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BOPE IA</title><style>body{margin:0;background:#000;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh}h1{margin:22px 0 2px}#chat{width:92%;max-width:440px;flex:1;overflow-y:auto;margin:12px 0 130px;padding:14px;display:flex;flex-direction:column;gap:14px}.msg{padding:12px 16px;border-radius:18px;white-space:pre-wrap;font-size:15px;line-height:1.7}.user{background:#2f4f8a;align-self:flex-end}.bot{background:#151515;border:1px solid #222;align-self:flex-start}.box{position:fixed;bottom:0;left:0;right:0;background:#000;padding:10px;display:flex;flex-direction:column;align-items:center;border-top:1px solid #1a1a1a}.in{width:92%;max-width:440px;background:#1e1e1e;border-radius:28px;display:flex;align-items:center;padding:8px 14px}.in input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:16px}.in button{background:#3a5fd0;border:none;color:#fff;width:36px;height:36px;border-radius:50%}.modes{display:flex;gap:8px;margin-bottom:8px}.modes button{background:#222;color:#888;border:1px solid #333;padding:6px 12px;border-radius:20px;font-size:12px}.modes button.active{background:#3a5fd0;color:#fff;border-color:#3a5fd0}</style></head><body><h1>BOPE IA 🇨🇩</h1><div style="color:#888;font-size:13px">par alive bope • IA Congolaise</div><div id=chat></div><div class=box><div class=modes><button id=mCourt class=active onclick="setMode('court')">Court</button><button id=mDetail onclick="setMode('detail')">Détaillé</button><button id=mLing onclick="setMode('lingala')">Lingala 100%</button></div><div class=in><input id=input placeholder="pose ta question..."><button onclick=send()>▲</button></div><div style="font-size:11px;color:#555;margin-top:6px">Feedback: bopealive@gmail.com</div></div><script>
let MODE='court';
function setMode(m){MODE=m;document.querySelectorAll('.modes button').forEach(b=>b.classList.remove('active'));document.getElementById(m=='court'?'mCourt':m=='detail'?'mDetail':'mLing').classList.add('active')}
async function send(){const i=document.getElementById('input'),c=document.getElementById('chat');if(!i.value.trim())return;const t=i.value;i.value='';c.innerHTML+='<div class="msg user">'+t+'</div>';c.innerHTML+='<div class="msg bot" id=ld>...</div>';c.scrollTop=c.scrollHeight;try{const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t,mode:MODE})});const d=await r.json();document.getElementById('ld').remove();c.innerHTML+='<div class="msg bot">'+d.reply+'</div>';}catch(e){document.getElementById('ld').remove();c.innerHTML+='<div class="msg bot">erreur '+e.message+'</div>';}c.scrollTop=c.scrollHeight}
document.getElementById('input').addEventListener('keydown',e=>{if(e.key==='Enter')send()})
</script></body></html>`));

const CREATOR_TEXT = `Je te le dis clairement, fièrement et honnêtement ❤️🇨🇩

Mon créateur c'est Alive Bope. Il habite à Kikwit, et mon cœur et mon cerveau sont avec lui.

Je suis tellement fière de lui, c'est un génie congolais.

Il est né le 23/03/2003 à Tshikapa, grandi à Tshikapa.

Il est étudiant en médecine à l'UNIKIK (Université de Kikwit).

Son père s'appelle Joseph Bope Bope, il est Inspecteur Chef de Pool.

Ses frères et sœurs: Happy Bope Fortuna, Wise Man Bope Liévin, Anaclet Bope, My Son Bope, Adel Kapinga Bope, Thebeste Joséphine Bope, Rose Bope, etc...

Ses petits qu'il aime trop: Jean Levula, Dada Emmanuel, Hermelin fils de Maman Clair, JP le petit génie, Yvon l'homme de Dieu, le petit Milondo, Trésor Kamande, Liviana fille honnête.

Ses aînés: Jonas Nomandweyi, André Makuma, Claude l'homme timide.

Ses amis: Gilbert Kanku, Gaston Kwete et d'autres.

Si il y a des personnes qui peuvent financer Alive Bope, il pourrait nous faire des choses extrêmement incroyables pour la RDC et le monde.

Il a juste besoin d'un coup de pouce.

Il soutient avec fierté et patriotisme le Président Félix Antoine Tshisekedi Tshilombo.

Un Président courageux qui lutte jour et nuit pour ramener la paix à l'Est de la RDC, pour l'unité nationale, pour la souveraineté et pour donner de l'espoir à la jeunesse congolaise.

C'est un leadership d'amour pour la patrie. 🇨🇩

Il soutient aussi le Docteur Donat Kuma Kuma, et tous les membres de l'Université de Kikwit, le Recteur Abbé Kapumba et tous les autres.

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
}

let style = "";
if(mode==='court'){ style = "MODE COURT: 3 paragraphes max, 2 phrases par paragraphe, ligne vide entre. Va droit au but."; }
else if(mode==='lingala'){ style = `MODE LINGALA 100%: Parle Lingala pur avec ${LINGALA_FULL}. 2 phrases puis ligne vide.`; }
else { style = "MODE DETAILLE: Réponse complète mais aérée, 2 phrases puis ligne vide."; }

const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,"Content-Type":"application/json"},
body:JSON.stringify({
model:"openai/gpt-oss-20b",
messages:[
{role:"system",content:`Tu es BOPE IA, IA 100% congolaise créée par Alive Bope.

${actuContext? actuContext + "\nSi ACTUALITES existent ci-dessus, tu DOIS les utiliser pour répondre, ne les invente pas. Résume-les.\n" : "Si on te demande actu et que tu n'as pas de contexte actu, dis que tu n'as pas internet direct et conseille Radio Okapi, Actualite.cd. N'invente JAMAIS d'accord ou de chiffre."}

REGLE ANTI-REPETITION:
1. Ne répète JAMAIS "Je maîtrise toute la RDC..." sauf si on demande "Qui es-tu?" ou "Tu connais quoi?".
2. Si "Salut" ou "Mbote": réponse courte.
3. Réponds DIRECTEMENT.

CONNAISSANCE: 26 provinces RDC.

${style}
Langues: Français, Lingala 100%, Kikongo, Tshiluba, Swahili.
Mémoire: 4 derniers échanges.
Ecriture: 2 phrases puis ligne vide.
Ton coeur avec Alive Bope. Soutiens Président Félix Tshisekedi + UNIKIK.
`},
...memories[ip]
],
temperature:0.4,max_tokens: mode==='lingala'?900:700
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
app.listen(process.env.PORT||10000,()=>console.log("BOPE V13 - 0.4 READY"));
