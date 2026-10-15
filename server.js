const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;font-family:system-ui;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;min-height:100vh}
.top{width:100%;display:flex;justify-content:space-between;padding:12px;box-sizing:border-box}
.icon{width:38px;height:38px;background:#1e1e1e;border-radius:50%;display:flex;align-items:center;justify-content:center}
.logo{width:90px;height:90px;border-radius:50%;background:conic-gradient(#0072ff,#ffea00,#00ff88,#0072ff);display:flex;align-items:center;justify-content:center;font-size:50px;font-weight:bold;margin-top:5px}
h1{margin:10px 0 5px;font-size:28px}
.sub{color:#aaa;font-size:16px;margin-bottom:15px;text-align:center}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:92%;max-width:400px}
.btn{background:#121212;border:1px solid #333;padding:15px;border-radius:14px;text-align:center;cursor:pointer}
.btn span{font-size:22px;display:block}
#chat{width:92%;max-width:400px;flex:1;overflow-y:auto;margin:10px 0;padding:14px;display:flex;flex-direction:column;gap:18px;margin-bottom:95px}
.msg{padding:12px 16px;border-radius:18px;font-size:17px;line-height:1.7;max-width:85%;white-space:pre-wrap;word-wrap:break-word}
.user{background:#2e4a7e;align-self:flex-end}
.bot{background:transparent;align-self:flex-start;max-width:100%;padding-left:4px}
.box{position:fixed;bottom:0;left:0;right:0;background:#000;padding:10px;display:flex;justify-content:center;border-top:1px solid #181818}
.in{width:92%;max-width:400px;background:#1c1c1c;border-radius:26px;display:flex;align-items:center;padding:8px 14px;gap:10px}
.in input{flex:1;background:transparent;border:none;color:#fff;padding:8px;outline:none;font-size:16px}
.in button{background:#3a5fd0;border:none;color:#fff;width:34px;height:34px;border-radius:50%}
</style>
</head>
<body>
<div class="top"><div class="icon">☰</div><div style="display:flex;gap:8px"><div class="icon">✎</div><div class="icon">⋮</div></div></div>
<div class="logo">B</div>
<h1>BOPE IA 🇨🇩</h1>
<div class="sub">IA Kinshasa - Video Dessin Animé</div>
<div class="grid">
<div class="btn" onclick="createCartoonVideo()"><span>🎬</span>Create video Cartoon</div>
<div class="btn" onclick="ask('Apprendre')"><span>📚</span>Apprendre</div>
<div class="btn" onclick="ask('Emploi')"><span>💼</span>Emploi</div>
<div class="btn" onclick="ask('Sante')"><span>🏥</span>Sante</div>
<div class="btn" onclick="ask('Admin RDC')"><span>📄</span>Admin RDC</div>
<div class="btn" onclick="ask('General')"><span>🌍</span>General</div>
</div>
<div id="chat"></div>
<div class="box"><div class="in"><span>＋</span><input id="input" placeholder="ex: papa qui danse"><span onclick="startVoice()" id="mic" style="cursor:pointer">🎤</span><button onclick="send()">▲</button></div></div>
<script>
function speak(t){ speechSynthesis.cancel(); let u=new SpeechSynthesisUtterance(t.slice(0,280).replace(/[^\\w\\s]/gi,' ')); u.lang="fr-FR"; speechSynthesis.speak(u); }
function ask(t){document.getElementById('input').value=t;send()}

async function createCartoonVideo(){
  const story = prompt("Raconte ton idée de dessin animé 🎬 ex: un papa qui danse, des enfants qui se battent");
  if(!story) return;
  doCartoon(story);
}
async function doCartoon(story){
  const chat=document.getElementById('chat');
  chat.innerHTML+='<div class=msg user>🎬 cartoon: '+story.toLowerCase()+'</div>';
  chat.innerHTML+='<div class=msg bot id=ld>bope crée ton dessin animé... ⏳ 6 scènes cartoon 🇨🇩</div>';
  chat.scrollTop=chat.scrollHeight;
  try{
    const r=await fetch('/cartoon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({story})});
    const d=await r.json();
    document.getElementById('ld').remove();
    let html='<div class=msg bot>voilà ton dessin animé prêt 😊🔥<br><b>'+d.title+'</b><br>';
    d.images.forEach((img,i)=>{ html+='<img src="'+img+'" style="width:100%;border-radius:12px;margin:8px 0"><br><small>scène '+(i+1)+': '+d.scenes[i]+'</small><br><br>'; });
    html+='<button onclick="playCartoon('+JSON.stringify(d.images).replace(/"/g,'&quot;')+')" style="background:#3a5fd0;color:#fff;border:none;padding:12px 22px;border-radius:22px;cursor:pointer">▶️ jouer la vidéo dessin animé</button></div>';
    chat.innerHTML+=html;
    speak("voilà ton dessin animé prêt");
  }catch(e){ document.getElementById('ld')?.remove(); chat.innerHTML+='<div class=msg bot>erreur video: '+e.message+'</div>'; }
  chat.scrollTop=chat.scrollHeight;
}
function playCartoon(images){
  let w=window.open();
  w.document.write('<body style="margin:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#fff;font-family:system-ui"><h3>bope cartoon 🇨🇩</h3><img id="v" style="max-width:95%;max-height:80vh;border-radius:16px"><p id="c"></p><script>let imgs='+JSON.stringify(images)+';let idx=0;let el=document.getElementById("v");let c=document.getElementById("c");function nxt(){el.src=imgs[idx];c.innerText=(idx+1)+"/"+imgs.length;idx=(idx+1)%imgs.length} nxt(); setInterval(nxt,900)<\\/script></body>');
}
async function send(){
  const input=document.getElementById('input'); const chat=document.getElementById('chat');
  if(!input.value) return; let txt=input.value.trim();
  // DETECTEUR VIDEO DANS LE CHAT
  if(txt.toLowerCase().includes("video") || txt.toLowerCase().includes("vidéo") || txt.toLowerCase().includes("papa qui danse") || txt.toLowerCase().includes("enfants")){
    let story=txt.replace(/create video|fait une vidéo|fais une video|fait une video/gi,'').trim();
    if(story.length<3) story="papa qui danse";
    input.value='';
    doCartoon(story);
    return;
  }
  chat.innerHTML+='<div class=msg user>'+txt.toLowerCase()+'</div>'; input.value='';
  chat.innerHTML+='<div class=msg bot id=ld>bope écrit...</div>';
  chat.scrollTop=chat.scrollHeight;
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt})});
    const d=await r.json(); document.getElementById('ld').remove();
    chat.innerHTML+='<div class=msg bot>'+d.reply.replace(/\\n/g,'<br>')+'</div>';
    speak(d.reply);
  }catch(e){ document.getElementById('ld')?.remove(); chat.innerHTML+='<div class=msg bot>erreur: '+e.message+'</div>'; }
  chat.scrollTop=chat.scrollHeight;
}
function startVoice(){
  let Rec=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!Rec){alert("chrome svp");return}
  let rec=new Rec(); rec.lang="fr-FR"; rec.start();
  rec.onresult=e=>{document.getElementById('input').value=e.results[0][0].transcript; send();}
}
</script>
</body>
</html>
  `);
});

app.post('/cartoon', async (req,res)=>{
  try{
    let story=req.body.story||"papa qui danse";
    const groqRes=await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+process.env.GROQ_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"openai/gpt-oss-120b",
        messages:[
          {role:"system", content:"Découpe en 6 scènes cartoon congolais mignon. JSON uniquement: {\\"title\\": \\"titre\\", \\"scenes\\": [6 scenes max 10 mots]}"},
          {role:"user", content:story}
        ],
        temperature:0.8
      })
    });
    const data=await groqRes.json();
    let content=data.choices?.[0]?.message?.content||'{"title":"mon dessin anime","scenes":["'+story+'"]}';
    content=content.replace(/```json|```/g,'').trim();
    let parsed; try{parsed=JSON.parse(content)}catch{parsed={title:"mon dessin anime", scenes:[story, story+" qui danse", story+" qui rit", story+" content", story+" saute", story+" fin heureuse"]}}
    if(!parsed.scenes||parsed.scenes.length<3) parsed.scenes=[story, story+" danse", story+" rit", story+" saute", story+" content", story+" fin"];
    let images=parsed.scenes.slice(0,6).map(s=>{
      let p=encodeURIComponent(s+", cartoon 3d pixar style, african congolese character, cute, colorful, 4k");
      return 'https://image.pollinations.ai/prompt/'+p+'?width=512&height=512&nologo=true&seed='+Math.floor(Math.random()*10000);
    });
    res.json({title:parsed.title, scenes:parsed.scenes, images});
  }catch(e){
    let s=req.body.story||"papa qui danse";
    res.json({title:"dessin anime", scenes:[s], images:['https://image.pollinations.ai/prompt/'+encodeURIComponent(s+" cartoon pixar")+ '?width=512&height=512']});
  }
});

app.post('/chat', async (req,res)=>{
  try{
    let m=(req.body.message||"").toLowerCase();
    if(m.includes("video")||m.includes("vidéo")){
      return res.json({reply:"oui je peux 😊🔥 clique 🎬 create video cartoon ou écris directement ton idée ex: video papa qui danse je génère 6 scènes cartoon direct 🇨🇩"});
    }
    const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+process.env.GROQ_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"openai/gpt-oss-120b",
        messages:[
          {role:"system", content:"Tu es BOPE IA par Alive Bope né 23/03/2003 Tshikapa UNIKIK médecine fils Joseph Bope Bope. Tu SAIS faire video dessin anime ne jamais dire je ne peux pas. Style minuscules max 4 lignes."},
          {role:"user", content:req.body.message}
        ],
        temperature:0.3
      })
    });
    const d=await r.json();
    let reply=(d.choices?.[0]?.message?.content||"ok").toLowerCase().replace(/\\*\\*/g,'').trim();
    res.json({reply});
  }catch(e){res.json({reply:"erreur 😅 "+e.message})}
});

const PORT=process.env.PORT||10000;
app.listen(PORT, ()=>console.log("BOPE V4 OK "+PORT));
