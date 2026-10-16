const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req,res)=>{
  res.send(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font-family:system-ui;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;min-height:100vh}
.logo{width:90px;height:90px;border-radius:50%;background:conic-gradient(#0072ff,#ffea00,#00ff88,#0072ff);display:flex;align-items:center;justify-content:center;font-size:50px;font-weight:bold;margin-top:10px}
h1{margin:10px 0 5px}.sub{color:#aaa;margin-bottom:15px;text-align:center}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:92%;max-width:400px}
.btn{background:#121212;border:1px solid #333;padding:15px;border-radius:14px;text-align:center;cursor:pointer}
#chat{width:92%;max-width:400px;flex:1;overflow-y:auto;margin:10px 0;padding:14px;display:flex;flex-direction:column;gap:18px;margin-bottom:95px}
.msg{padding:12px 16px;border-radius:18px;font-size:17px;line-height:1.6;max-width:85%;white-space:pre-wrap;word-wrap:break-word}
.user{background:#2e4a7e;align-self:flex-end}.bot{background:#111;align-self:flex-start;max-width:100%}
.box{position:fixed;bottom:0;left:0;right:0;background:#000;padding:10px;display:flex;justify-content:center;border-top:1px solid #181818}
.in{width:92%;max-width:400px;background:#1c1c1c;border-radius:26px;display:flex;align-items:center;padding:8px 14px;gap:10px}
.in input{flex:1;background:transparent;border:none;color:#fff;padding:8px;outline:none;font-size:16px}
.in button{background:#3a5fd0;border:none;color:#fff;width:34px;height:34px;border-radius:50%}
</style></head><body>
<div class="logo">B</div><h1>BOPE IA 🇨🇩</h1><div class="sub">IA Kinshasa - Video Dessin Animé</div>
<div class="grid">
<div class="btn" onclick="createCartoonVideo()">🎬<br>Create video</div>
<div class="btn" onclick="ask('Apprendre')">📚<br>Apprendre</div>
<div class="btn" onclick="ask('Emploi')">💼<br>Emploi</div>
<div class="btn" onclick="ask('Sante')">🏥<br>Sante</div>
</div><div id="chat"></div>
<div class="box"><div class="in"><input id="input" placeholder="ecris papa qui danse"><button onclick="send()">▲</button></div></div>
<script>
async function createCartoonVideo(){
  const s=prompt("ton idée de dessin animé 🎬 ex: papa qui danse");
  if(!s) return;
  doCartoon(s);
}
async function doCartoon(story){
  const chat=document.getElementById('chat');
  chat.innerHTML+='<div class=msg user>🎬 '+story.toLowerCase()+'</div>';
  chat.innerHTML+='<div class=msg bot id=ld>bope génère ta vidéo... ⏳🇨🇩</div>';
  chat.scrollTop=chat.scrollHeight;
  try{
    const r=await fetch('/cartoon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({story})});
    const d=await r.json();
    document.getElementById('ld').remove();
    let html='<div class=msg bot>voilà 😊🔥 <b>'+d.title+'</b><br>';
    d.images.forEach((img,i)=>{ html+='<img src="'+img+'" style="width:100%;border-radius:12px;margin:10px 0"><br><small>scène '+(i+1)+': '+d.scenes[i]+'</small><br><br>'; });
    html+='<button onclick="playCartoon('+JSON.stringify(d.images).replace(/"/g,'&quot;')+')" style="background:#3a5fd0;color:#fff;border:none;padding:12px 22px;border-radius:22px;cursor:pointer">▶️ jouer la vidéo</button></div>';
    chat.innerHTML+=html;
  }catch(e){ document.getElementById('ld')?.remove(); chat.innerHTML+='<div class=msg bot>erreur: '+e.message+' - verifie ta connexion</div>'; }
  chat.scrollTop=chat.scrollHeight;
}
function playCartoon(imgs){
  let w=window.open();
  w.document.write('<body style="margin:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#fff"><img id="v" style="max-width:95%;border-radius:16px"><p id="c"></p><script>let a='+JSON.stringify(imgs)+';let i=0;let v=document.getElementById("v");let c=document.getElementById("c");function n(){v.src=a[i];c.innerText=(i+1)+"/"+a.length;i=(i+1)%a.length} n();setInterval(n,800)<\\/script></body>');
}
function ask(t){document.getElementById('input').value=t;send()}
async function send(){
  const input=document.getElementById('input'); const chat=document.getElementById('chat');
  if(!input.value) return; let txt=input.value.trim();
  if(txt.toLowerCase().includes("video")||txt.toLowerCase().includes("vidéo")||txt.length>2){
    if(txt.toLowerCase().includes("create video")) txt=txt.replace(/create video/gi,'').trim()||"papa qui danse";
    input.value='';
    // si c'est une histoire courte on fait video direct
    if(txt.split(' ').length>=2){ doCartoon(txt); return; }
  }
  let t=txt.toLowerCase(); chat.innerHTML+='<div class=msg user>'+t+'</div>'; input.value='';
  chat.innerHTML+='<div class=msg bot id=ld>bope écrit...</div>'; chat.scrollTop=chat.scrollHeight;
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t})});
    const d=await r.json(); document.getElementById('ld').remove();
    chat.innerHTML+='<div class=msg bot>'+d.reply+'</div>';
  }catch(e){ document.getElementById('ld').remove(); chat.innerHTML+='<div class=msg bot>erreur: '+e.message+'</div>'; }
  chat.scrollTop=chat.scrollHeight;
}
<\/script></body></html>`);
});

app.post('/cartoon', async (req,res)=>{
  // VERSION SANS GROQ - 100% stable
  let story=(req.body.story||"papa qui danse").toLowerCase();
  let scenes=[
    story+" au debut",
    story+" qui commence a bouger",
    story+" qui danse fort",
    story+" qui sourit",
    story+" avec ses amis",
    story+" fin heureuse"
  ];
  let images=scenes.map(s=>{
    let p=encodeURIComponent(s+" cartoon 3d pixar style african congolese character cute colorful happy 4k");
    return 'https://image.pollinations.ai/prompt/'+p+'?width=512&height=512&nologo=true&seed='+Math.floor(Math.random()*99999);
  });
  res.json({title:story, scenes:scenes, images:images});
});

app.post('/chat', async (req,res)=>{
  try{
    let m=(req.body.message||"").toLowerCase();
    // anti-refus total
    if(m.includes("video")||m.includes("vidéo")){
      return res.json({reply:"oui je peux 😊🔥 écris juste ton idée ex: papa qui danse et je te génère 6 images cartoon direct, ou clique le bouton create video en haut 🇨🇩"});
    }
    // essaie groq sinon reponse simple
    try{
      const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{"Authorization":"Bearer "+process.env.GROQ_API_KEY,"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"openai/gpt-oss-120b",
          messages:[
            {role:"system", content:"Tu es BOPE IA par Alive Bope né 23/03/2003 Tshikapa medecine UNIKIK. Style minuscules max 4 lignes."},
            {role:"user", content:req.body.message}
          ],
          temperature:0.3
        })
      });
      const d=await r.json();
      let reply=(d.choices?.[0]?.message?.content||"ok").toLowerCase().trim();
      return res.json({reply});
    }catch{
      return res.json({reply:"je suis bope ia 🇨🇩 dis moi ton idée de dessin animé ex: papa qui danse 😊"});
    }
  }catch(e){ res.json({reply:"erreur 😅 "+e.message}) }
});

const PORT=process.env.PORT||10000;
app.listen(PORT, ()=>console.log("BOPE V5 STABLE "+PORT));
