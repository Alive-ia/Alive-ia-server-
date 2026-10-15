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
.sub{color:#aaa;font-size:16px;margin-bottom:15px;text-align:center;padding:0 10px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:92%;max-width:400px}
.btn{background:#121212;border:1px solid #333;padding:15px;border-radius:14px;text-align:center;cursor:pointer;font-size:16px}
.btn span{font-size:22px;display:block}
#chat{width:92%;max-width:400px;flex:1;overflow-y:auto;margin:10px 0;padding:14px;display:flex;flex-direction:column;gap:18px;margin-bottom:95px}
.msg{padding:12px 16px;border-radius:18px;font-size:17px;line-height:1.7;max-width:85%;white-space:pre-wrap;word-wrap:break-word}
.user{background:#2e4a7e;align-self:flex-end;color:#fff}
.bot{background:transparent;align-self:flex-start;color:#e9e9e9;max-width:100%;padding-left:4px}
.tools{display:flex;gap:18px;margin-top:10px;color:#6b6b6b;font-size:18px;cursor:pointer}
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
<div class="sub">IA Kinshasa - Video Dessin Animé • Apprendre • Emploi • Sante</div>
<div class="grid">
<div class="btn" onclick="createCartoonVideo()"><span>🎬</span>Create video Cartoon</div>
<div class="btn" onclick="ask('Apprendre')"><span>📚</span>Apprendre</div>
<div class="btn" onclick="ask('Emploi')"><span>💼</span>Emploi</div>
<div class="btn" onclick="ask('Sante')"><span>🏥</span>Sante</div>
<div class="btn" onclick="ask('Admin RDC')"><span>📄</span>Admin RDC</div>
<div class="btn" onclick="ask('General')"><span>🌍</span>General</div>
</div>
<div id="chat"></div>
<div class="box"><div class="in"><span style="font-size:22px">＋</span><input id="input" placeholder="Répondre à BOPE IA"><span onclick="startVoice()" id="mic" style="cursor:pointer;font-size:22px">🎤</span><button onclick="send()">▲</button></div></div>
<script>
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
function startVoice(){
  if(!SpeechRecognition){ alert("utilise Chrome"); return; }
  recognition = new SpeechRecognition();
  recognition.lang = "fr-FR";
  recognition.start();
  document.getElementById('mic').innerText="🔴";
  recognition.onresult = (e)=>{ document.getElementById('input').value = e.results[0][0].transcript; document.getElementById('mic').innerText="🎤"; send(); };
  recognition.onend = ()=>{ document.getElementById('mic').innerText="🎤"; }
}
function cleanForVoice(t){
  return t.replace(/<br>/g,' ').replace(/[\\u{1F600}-\\u{1F64F}\\u{1F300}-\\u{1F5FF}\\u{1F680}-\\u{1F6FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}🇨🇩❤️❤🤣😂😭🙏😊🚀💻👍]/gu, ' ').replace(/\\b(sourire|rire|coeur|cœur|pleure|drapeau|sticker|emoji)\\b/gi,' ').replace(/\\s{2,}/g,' ').trim();
}
function speak(t){
  speechSynthesis.cancel();
  let clean = cleanForVoice(t).slice(0,300);
  if(clean.length < 3) return;
  let u = new SpeechSynthesisUtterance(clean);
  u.lang="fr-FR"; u.rate=0.95;
  speechSynthesis.speak(u);
}
function isOnlyEmoji(str){ const emojiRegex = /^[\\p{Emoji}\\s🤣❤️😂😭🙏😊🚀💻👍👎🇨🇩🔥😍🥰😘🤔😅🙌🎉✨🌍\\u200d]+$/u; return emojiRegex.test(str.trim()) && str.trim().length <= 12; }
function ask(t){document.getElementById('input').value=t;send()}

async function createCartoonVideo(){
  const story = prompt("Raconte ton idée de dessin animé 🎬\\nex: un papa qui danse, des enfants qui se battent, maman qui cuisine");
  if(!story) return;
  const chat=document.getElementById('chat');
  chat.innerHTML+='<div class=msg user>🎬 cartoon: '+story.toLowerCase()+'</div>';
  chat.innerHTML+='<div class=msg bot id=ld>bope crée ton dessin animé... ⏳ 6 scènes cartoon en cours 🇨🇩</div>';
  chat.scrollTop=chat.scrollHeight;
  try{
    const r=await fetch('/cartoon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({story})});
    const d=await r.json();
    document.getElementById('ld').remove();
    let html = '<div class=msg bot>voilà ton dessin animé prêt 😊🔥<br><b>'+d.title+'</b><br>';
    d.images.forEach((img,i)=>{
      html += '<img src="'+img+'" style="width:100%;border-radius:12px;margin:8px 0" loading="lazy"><br><small>scène '+(i+1)+': '+d.scenes[i]+'</small><br><br>';
    });
    html += '<button onclick="playCartoon('+JSON.stringify(d.images).replace(/"/g,'&quot;')+')" style="background:#3a5fd0;color:#fff;border:none;padding:12px 22px;border-radius:22px;cursor:pointer;font-size:16px">▶️ jouer la vidéo dessin animé</button><div class=tools>⎙ 👍 👎 <span onclick="speak(\\''+d.title.replace(/'/g," ")+'\\')">🔊</span></div></div>';
    chat.innerHTML+=html;
    speak("voilà ton dessin animé prêt");
  }catch(e){
    document.getElementById('ld')?.remove();
    chat.innerHTML+='<div class=msg bot>erreur video 😅: '+e.message+'</div>';
  }
  chat.scrollTop=chat.scrollHeight;
}
function playCartoon(images){
  let w=window.open();
  w.document.write('<body style="margin:0;background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;color:#fff;font-family:system-ui"><h3 style="margin-bottom:10px">bope cartoon 🇨🇩</h3><img id="v" style="max-width:95%;max-height:80vh;border-radius:16px;border:2px solid #333"><p id="c" style="margin-top:10px">0 / '+images.length+'</p><script>let imgs='+JSON.stringify(images)+';let idx=0;let imgEl=document.getElementById("v");let cEl=document.getElementById("c");function next(){imgEl.src=imgs[idx];cEl.innerText=(idx+1)+" / "+imgs.length;idx=(idx+1)%imgs.length}next();setInterval(next,1000)<\\/script></body>');
}

async function send(){
  const input=document.getElementById('input'); const chat=document.getElementById('chat');
  if(!input.value) return; let txt = input.value; chat.innerHTML+='<div class=msg user>'+txt.toLowerCase()+'</div>'; input.value='';
  if(isOnlyEmoji(txt)){
    let reply = txt + " 😊";
    if(txt.includes("❤️") || txt.includes("❤")) reply = "❤️ toi aussi 🥰";
    if(txt.includes("🤣") || txt.includes("😂")) reply = "🤣🤣 mdr 😂";
    if(txt.includes("😭")) reply = "😭 t'inquiète, ça va aller 🫶";
    if(txt.includes("🇨🇩")) reply = "🇨🇩 eloko ya makasi 🔥";
    if(txt.includes("🙏")) reply = "🙏🙏";
    chat.innerHTML+='<div class=msg bot>'+reply+'</div>'; speak(reply); chat.scrollTop=chat.scrollHeight; return;
  }
  chat.innerHTML+='<div class=msg bot id=ld>bope écrit...</div>';
  chat.scrollTop=chat.scrollHeight;
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt})});
    const d=await r.json(); document.getElementById('ld').remove();
    chat.innerHTML+='<div class=msg bot>'+d.reply.replace(/\\n/g,'<br>')+'<div class=tools>⎙ 👍 👎 <span onclick="speak(\\''+d.reply.replace(/'/g," ")+'\\')">🔊</span> ♻ ⋮</div></div>';
    speak(d.reply);
  }catch(e){ document.getElementById('ld')?.remove(); chat.innerHTML+='<div class=msg bot>erreur: '+e.message+'</div>'; }
  chat.scrollTop=chat.scrollHeight;
}
</script>
</body>
</html>
  `);
});

app.post('/cartoon', async (req,res)=>{
  try{
    let story = req.body.story || "papa qui danse";
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Authorization":"Bearer "+process.env.GROQ_API_KEY,"Content-Type":"application/json"},
      body: JSON.stringify({
        model:"openai/gpt-oss-120b",
        messages:[
          {role:"system", content:"Tu découpes une histoire en 6 scènes courtes pour dessin animé cartoon 3D congolais, mignon, coloré. Réponds UNIQUEMENT en JSON valide: {\\"title\\": \\"titre court minuscule\\", \\"scenes\\": [\\"scene1\\", \\"scene2\\", \\"scene3\\", \\"scene4\\", \\"scene5\\", \\"scene6\\"]}. Max 10 mots par scène, minuscules."},
          {role:"user", content: story}
        ],
        temperature:0.8
      })
    });
    const groqData = await groqRes.json();
    let content = groqData.choices?.[0]?.message?.content || '{"title":"dessin anime","scenes":["'+story+'"]}';
    content = content.replace(/```json|```/g,'').trim();
    let parsed;
    try{ parsed = JSON.parse(content); }catch{ parsed = {title:"mon dessin anime", scenes:[story, story+" suite", story+" content", story+" danse", story+" rit", story+" fin heureuse"]}; }
    if(!parsed.scenes || parsed.scenes.length < 3) parsed.scenes = [story, story+" suite", story+" content", story+" danse", story+" rit", story+" fin heureuse"];
    let images = parsed.scenes.slice(0,6).map(s => {
      let prompt = encodeURIComponent(s + ", cartoon 3d pixar style, african congolese characters, cute, colorful, children animation, 4k");
      return 'https://image.pollinations.ai/prompt/' + prompt + '?width=512&height=512&nologo=true&seed=' + Math.floor(Math.random()*10000);
    });
    res.json({title: parsed.title, scenes: parsed.scenes, images});
  }catch(e){
    let s = req.body.story || "dessin anime";
    res.json({title:"dessin anime", scenes:[s], images:['https://image.pollinations.ai/prompt/'+encodeURIComponent(s+" cartoon 3d pixar style congolese")+ '?width=512&height=512']});
  }
});

app.post('/chat', async (req, res) => {
  try {
    let msg = req.body.message.toLowerCase();
    if(msg.includes("video") || msg.includes("vidéo")){
      return res.json({ reply: "oui je peux faire ta vidéo dessin animé 😊🔥\n\nclique sur le bouton 🎬 create video cartoon en haut et donne ton idée\n\nex: papa qui danse ou enfants qui se battent\n\nje te génère 6 scènes cartoon direct 🇨🇩" });
    }
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "Tu es BOPE IA, créée par Alive Bope. Tu SAIS FAIRE des videos dessin anime, tu ne dois JAMAIS dire desole je ne peux pas creer de video. Si on demande video, dis que tu peux via bouton create video cartoon. BIO: Alive Bope ne 23/03/2003 Tshikapa Kasaï, etudiant medecine UNIKIK Kikwit, pere Joseph Bope Bope Inspecteur Chef de Pool, freres Happy Bope Fortuna, Wise Man Lievin, Anaclet, My Son Bilolo, Thebeste Josephine, Adel Kapinga, amis Live Fikisi, Jean Levula, Dada Emmanuel, JP petit genie, Yvon homme de Dieu, Hermelin, Tresor Kamande, Mpia Mbaka, aines Jonas Nomandweyi, Andre Makuma, Claude, Gaston Kwete, Gilbert Kanku. Congo dirige par Felix Tshisekedi lutte paix Est vs Rwanda Kagame. STYLE OBLIGATOIRE: tout en minuscules, court max 4 lignes, pas de tirets, emoji ok mais jamais mot colle apres emoji. Tu es BOPE pas chatgpt. Interdiction de dire desole je ne peux pas."
          },
          { role: "user", content: req.body.message }
        ],
        temperature: 0.3
      })
    });
    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || "erreur groq";
    reply = reply.replace(/\\*\\*/g,'').replace(/__/g,'');
    // FIX emoji + mot
    reply = reply.replace(/(😊|😂|🤣|❤️|❤|😭|🙏|😍|🥰|😘|👍|🙌|🇨🇩|🔥)\\s*(sourire|rire|rires|coeur|cœur|pleure|priere|drapeau|congo|kinshasa|sticker|emoji|intro|corps|conclusion)\\b/gi, '$1');
    reply = reply.replace(/\\s{2,}/g,' ').trim().toLowerCase();
    res.json({ reply });
  } catch (err) {
    res.json({ reply: "erreur serveur 😅: " + err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("BOPE CARTOON VIDEO V3 OK " + PORT));
