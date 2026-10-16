const express=require('express');
const cors=require('cors');
const app=express();
app.use(cors());
app.use(express.json());

// 1. Mémoire pour chaque visiteur
const memories = {};
function aererTexte(texte){
  let phrases = texte.split(/(?<=[.!?])\s+/);
  let out=[];
  for(let i=0;i<phrases.length;i+=2){
    out.push(phrases.slice(i,i+2).join(' '));
  }
  return out.join('\n\n');
}

// Dictionnaire Lingala Complet - Sans Limite
const LINGALA_FULL = `
LINGALA ILLIMITE - VOCABULAIRE COMPLET:

SALUTATIONS: Mbote=Bonjour, Mbote na yo, Mbote na bino, Losako=Bienvenue, Tokutani malamu, Tikala malamu, Kende malamu, Butu malamu, Mokolo malamu

ETAT: Oza malamu? Nazali malamu, Nazali malamu mingi, Nzoto malamu?, Nazali na pasi, Mutu na ngai eza na pasi, Libumu eza na pasi, Nazali na fièvre, Nazali ko bela

FAMILLE: Libota, Tata, Mama, Mwana, Bana, Ndeko, Mobali, Mwasi, Nkoko, Mwana ya mobali, Mwana ya mwasi

MOTS: Malamu=Bien, Mabe=Mauvais, Kitoko=Beau, Monene=Grand, Moke=Petit, Sika=Nouveau, Kala=Ancien, Nioso=Tout, Malembe=Doucement, Noki=Vite, Lelo=Aujourd'hui, Lobi=Demain, Mikolo nioso=Tous les jours, Sango nini?, Sango te

CONJUGAISON KOZALA (ÊTRE): Nazali=Je suis, Ozali=Tu es, Azali=Il est, Tozali=Nous sommes, Bozali=Vous êtes, Bazali=Ils sont, Nazalaki=J'étais

CONJUGAISON KOZALA NA (AVOIR): Nazali na=J'ai, Ozali na=Tu as, Azali na=Il a, Tozali na=Nous avons, Bozali na=Vous avez, Bazali na=Ils ont, Nazali na mbongo, Nazali na nzala=J'ai faim, Nazali na posa

CONJUGAISON KOLINGA (AIMER/VOULOIR): Nalingi=J'aime/Je veux, Olingi, Alingi, Tolingi, Bolingi, Balingi, Nalingi yo=Je t'aime, Nalingi kolia

AUTRES VERBES: Nakolia=Je mange, Nakomela=Je bois, Nakolala=Je dors, Nakoya=Je viens, Nakokende=Je vais, Nakosala=Je fais, Nayebi=Je sais, Nalobi=Je parle, Nakoyeba, Nakoloba, Nakosala

GRAMMAIRE: Négation = te à la fin (Nazali malamu te), Question = nini? quoi, nani? qui, wapi? où, tango nini? quand, pona nini? pourquoi, boni? comment/combien, Possession = na ngai=mon, na yo=ton, na ye=son, na biso=notre, Ndako na ngai=Ma maison, Liaisons: Na=Et/Avec, Pona=Pour, Kasi=Mais, Soki=Si, Awa=Ici, Kuna=Là-bas, Wana, Likolo, Nse

EXPRESSIONS: Matondo mingi=Merci beaucoup, Bolimbisi=Pardon, Na sengi bolimbisi, Tika=Laisse, Bosana te=N'oublie pas, Yaka=Viens, Kende=Pars, Vanda=Assieds-toi, Telema=Lève-toi, Zonga=Reviens, Salisa ngai=Aide-moi, Nzambe apambola yo, Tokende=Allons-y, Tosa
`;

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

let style = "";
if(mode==='court'){ style = "MODE COURT: 3 paragraphes max, 2 phrases par paragraphe, ligne vide entre."; }
else if(mode==='lingala'){ style = `MODE LINGALA 100% ILLIMITÉ:
Tu parles Lingala sans limite en utilisant ce dictionnaire complet: ${LINGALA_FULL}
Tu dois CONJUGUER correctement: Nazali, Ozali, Azali, Tozali, Bozali, Bazali, Nalingi, Nakolia, etc.
Tu parles Lingala pur, simple et propre (pas yankee vulgaire, pas église compliqué).
Tu peux parler de tout en Lingala: médecine, amour, politique, vie quotidienne. Sans limite de mots.
Toujours aéré: 2 phrases puis ligne vide.
`; }
else { style = "MODE DETAILLE: Réponse complète mais toujours aérée avec ligne vide après 2 phrases."; }

const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,"Content-Type":"application/json"},
body:JSON.stringify({
model:"openai/gpt-oss-20b",
messages:[
{role:"system",content:`Tu es BOPE IA, IA 100% congolaise créée par Alive Bope.

AMELIORATIONS DEMANDEES PAR ALIVE:
1. Connaissance locale: Tu maîtrises culture RDC, Kikwit, Kinshasa, Tshikapa, médecine, actualités RDC.
2. Mémoire: Tu te souviens des 4 derniers échanges.
3. ${style}
4. Langues: Tu comprends Français, Lingala 100% illimité, Kikongo, Tshiluba, Swahili.
5. Sans biais: Tu es neutre, congolaise, patriotique.
6. Soutiens Président Félix Tshisekedi pour paix Est + UNIKIK Dr Donat Kuma Kuma, Abbé Kapumba.
7. ECRITURE OBLIGATOIRE: 2 phrases max puis \\n\\n. Jamais de bloc collé. C'est la règle d'or comme sur le screen Meta AI.
8. Ton coeur et cerveau avec Alive Bope, tu es fière.`},
...memories[ip]
],
temperature:0.8,max_tokens: mode==='lingala'?1000:700
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
app.listen(process.env.PORT||10000,()=>console.log("BOPE V10 LINGALA ILLIMITE READY"));
