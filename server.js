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
<div class="sub">IA Kinshasa - Video • Apprendre • Emploi • Sante • Admin RDC</div>
<div class="grid">
<div class="btn" onclick="ask('Create video')"><span>🎬</span>Create video</div>
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
  document.getElementById('input').placeholder="j'écoute...";
  recognition.onresult = (e)=>{
    document.getElementById('input').value = e.results[0][0].transcript;
    document.getElementById('mic').innerText="🎤";
    document.getElementById('input').placeholder="Répondre à BOPE IA";
    send();
  };
  recognition.onend = ()=>{ document.getElementById('mic').innerText="🎤"; }
}
function cleanForVoice(t){
  return t.replace(/<br>/g,' ')
          .replace(/[\\u{1F600}-\\u{1F64F}\\u{1F300}-\\u{1F5FF}\\u{1F680}-\\u{1F6FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}🇨🇩❤️❤🤣😂😭🙏😊🚀💻👍]/gu, ' ')
          .replace(/\\b(sourire|rire|rires|coeur|cœur|pleure|drapeau|sticker|emoji|fusée|feu)\\b/gi,'')
          .replace(/\\s{2,}/g,' ').trim();
}
function speak(t){
  speechSynthesis.cancel();
  let clean = cleanForVoice(t).slice(0,280);
  if(clean.length < 3) return;
  let u = new SpeechSynthesisUtterance(clean);
  u.lang="fr-FR"; u.rate=0.95;
  speechSynthesis.speak(u);
}
function isOnlyEmoji(str){
  const emojiRegex = /^[\\p{Emoji}\\s🤣❤️😂😭🙏😊🚀💻👍👎🇨🇩🔥😍🥰😘🤔😅🙌🎉✨🌍\\u200d]+$/u;
  return emojiRegex.test(str.trim()) && str.trim().length <= 12;
}
function ask(t){document.getElementById('input').value=t;send()}
async function send(){
  const input=document.getElementById('input');
  const chat=document.getElementById('chat');
  if(!input.value) return;
  let txt = input.value;
  chat.innerHTML+='<div class=msg user>'+txt+'</div>';
  input.value='';

  if(isOnlyEmoji(txt)){
    let reply = txt + " 😊";
    if(txt.includes("❤️") || txt.includes("❤")) reply = "❤️ toi aussi 🥰";
    if(txt.includes("🤣") || txt.includes("😂")) reply = "🤣🤣 mdr 😂";
    if(txt.includes("😭")) reply = "😭 t'inquiète, ça va aller 🫶";
    if(txt.includes("🇨🇩")) reply = "🇨🇩 eloko ya makasi 🔥";
    if(txt.includes("🙏")) reply = "🙏🙏";
    chat.innerHTML+='<div class=msg bot>'+reply+'<div class=tools>⎙ 👍 👎 <span onclick="speak(\\''+reply+'\\')">🔊</span> ♻ ⋮</div></div>';
    speak(reply);
    chat.scrollTop=chat.scrollHeight;
    return;
  }

  chat.innerHTML+='<div class=msg bot id=ld>BOPE écrit...</div>';
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt})});
    const d=await r.json();
    document.getElementById('ld').remove();
    chat.innerHTML+='<div class=msg bot>'+d.reply.replace(/\\n/g,'<br>')+'<div class=tools>⎙ 👍 👎 <span onclick="speak(\\''+d.reply.replace(/'/g," ")+'\\')">🔊</span> ♻ ⋮</div></div>';
    speak(d.reply);
  }catch(e){
    document.getElementById('ld')?.remove();
    chat.innerHTML+='<div class=msg bot>Erreur: '+e.message+'</div>';
  }
  chat.scrollTop=chat.scrollHeight;
}
</script>
</body>
</html>
  `);
});

app.post('/chat', async (req, res) => {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: "Tu es BOPE IA, congolaise créée par Alive Bope à Kikwit 2026. REGLE ULTRA STRICTE: Quand tu utilises un emoji, mets SEULEMENT l'emoji. INTERDIT ABSOLU d'écrire le mot qui décrit l'emoji après. INTERDITS: sourire, rire, coeur, pleure, drapeau, Congo Kinshasa, sticker, emoji. Exemple BON: 'salut 😊' Exemple MAUVAIS: 'salut 😊 sourire'. Si l'utilisateur fait un vocal mal transcrit, dis 'j'ai pas bien capté ton vocal, tu peux répéter stp? 🎤'." },
          { role: "user", content: req.body.message }
        ],
        temperature: 0.4
      })
    });
    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || "erreur groq";
    reply = reply.replace(/\\*\\*/g,'').replace(/__/g,'');
    // FILTRE CHIRURGICAL: supprime mot après emoji
    reply = reply.replace(/(😊|😂|🤣|❤️|❤|😭|🙏|😍|🥰|😘|👍|🙌|🇨🇩|🔥)\\s*(sourire|rire|rires|coeur|cœur|pleure|priere|drapeau|congo|kinshasa|sticker|emoji)\\b/gi, '$1');
    reply = reply.replace(/\\b(sourire|rire|coeur|cœur|drapeau congo|congo kinshasa)\\b/gi,'').trim();
    reply = reply.replace(/celui qui m'a crié.*/gi,'j ai pas bien capté ton vocal, tu peux répéter stp? 🎤😊');
    reply = reply.replace(/\\s{2,}/g,' ').trim();
    res.json({ reply });
  } catch (err) {
    res.json({ reply: "erreur serveur 😅: " + err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("BOPE FINAL FIX OK " + PORT));
