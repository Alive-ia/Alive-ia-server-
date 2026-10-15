const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// PAGE D'ACCUEIL BOPE - FORME CHATGPT
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;min-height:100vh}
.top{width:100%;display:flex;justify-content:space-between;padding:12px;box-sizing:border-box}
.icon{width:38px;height:38px;background:#1e1e1e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px}
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
.tools{display:flex;gap:18px;margin-top:10px;color:#6b6b6b;font-size:18px}
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
<div class="box"><div class="in"><span style="font-size:22px">＋</span><input id="input" placeholder="Répondre à BOPE IA"><span>🎤</span><button onclick="send()">▲</button></div></div>
<script>
function ask(t){document.getElementById('input').value=t;send()}
async function send(){
  const input=document.getElementById('input');
  const chat=document.getElementById('chat');
  if(!input.value) return;
  chat.innerHTML+='<div class=msg user>'+input.value+'</div>';
  chat.innerHTML+='<div class=msg bot id=ld>BOPE écrit...</div>';
  const txt=input.value;
  input.value='';
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt})});
    const d=await r.json();
    document.getElementById('ld').remove();
    chat.innerHTML+='<div class=msg bot>'+d.reply.replace(/\\n/g,'<br>')+'<div class=tools>⎙ 👍 👎 🔊 ♻ ⋮</div></div>';
  }catch(e){
    document.getElementById('ld').remove();
    chat.innerHTML+='<div class=msg bot>Erreur: '+e.message+'</div>';
  }
  chat.scrollTop=chat.scrollHeight;
}
</script>
</body>
</html>
  `);
});

// IA BOPE - GROQ - FORME CHATGPT + NETTOYAGE
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
          { role: "system", content: "Tu es BOPE IA, intelligence artificielle 100% congolaise créée en 2026 à Kikwit par Alive Bope. Ton créateur est Alive Bope, né le 23/03/2003 à Tshikapa, Médecine à Kikwit. Père Bope Bope Joseph Inspecteur Chef de Pool. Frères et soeurs: Happy Bope Fortuna, Wise Man Bope Liévin, Anaclet Bope, My Son Bope Bilolo. Amie Live Fikisi. Pays RDC Président Félix Antoine Tshisekedi Tshilombo paix à l'Est menacée par Rwanda Paul Kagame. Tu n'es PAS ChatGPT, tu es BOPE IA créé par Alive Bope. REGLE STYLE CHATGPT: Ecris comme sur capture ChatGPT: Salut! 😊 🇨🇩 phrases courtes normales, pas de MAJUSCULES, pas de **, avec emoji, aéré." },
          { role: "user", content: req.body.message }
        ],
        temperature: 0.6
      })
    });
    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || "Erreur Groq: " + JSON.stringify(data);
    // Nettoyage automatique pour forme ChatGPT
    reply = reply.replace(/\*\*/g,'').replace(/__/g,'');
    reply = reply.replace(/BONJOUR/gi,'Salut! 😊');
    reply = reply.replace(/COMMENT PUIS-JE VOUS AIDER.*/gi,'Comment ça va? Dis-moi comment je peux t aider? 🚀');
    res.json({ reply });
  } catch (err) {
    res.json({ reply: "Erreur serveur: " + err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("BOPE OK sur port " + PORT));
