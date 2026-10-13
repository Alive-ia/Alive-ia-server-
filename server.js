const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BOPE IA</title>
<style>
body{margin:0;font-family:sans-serif;background:#0a0a0a;color:white;display:flex;flex-direction:column;align-items:center;min-height:100vh;padding:20px}
.logo{width:100px;height:100px;border-radius:50%;background:conic-gradient(from 0deg,#3b82f6,#10b981,#facc15,#f97316,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:50px;font-weight:bold;margin-top:40px;box-shadow:0 0 30px rgba(59,130,246,0.5)}
h1{margin:15px 0 5px}
.sub{color:#aaa;text-align:center;font-size:14px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:360px}
.btn{background:#1e1e1e;border:1px solid #2e2e2e;border-radius:16px;padding:18px 10px;text-align:center;cursor:pointer}
.btn span{font-size:22px;display:block}
#chat{width:100%;max-width:360px;height:250px;overflow-y:auto;margin:15px 0}
.msg{margin:6px 0;padding:8px 10px;border-radius:10px;font-size:14px}.user{background:#128C7E;text-align:right}.bot{background:#1e1e1e}
.inputBox{display:flex;width:100%;max-width:360px;background:#1e1e1e;border-radius:25px;padding:5px;border:1px solid #2e2e2e}
.inputBox input{flex:1;background:transparent;border:none;color:white;padding:10px;outline:none}
.inputBox button{background:#128C7E;border:none;color:white;border-radius:20px;padding:8px 15px}
</style></head><body>
<div class="logo">B</div>
<h1>BOPE IA 🇨🇩</h1>
<div class="sub">IA Générale Kinshasa - Video • Apprendre •<br>Emploi • Sante • Admin RDC</div>
<div class="grid">
<div class="btn" onclick="ask('Create video')"><span>🎬</span>Create video</div>
<div class="btn" onclick="ask('Apprendre')"><span>📚</span>Apprendre</div>
<div class="btn" onclick="ask('Emploi')"><span>💼</span>Emploi</div>
<div class="btn" onclick="ask('Sante')"><span>🏥</span>Sante</div>
<div class="btn" onclick="ask('Admin RDC')"><span>📄</span>Admin RDC</div>
<div class="btn" onclick="ask('General')"><span>🌍</span>General</div>
</div>
<div id="chat"></div>
<div class="inputBox"><input id="input" placeholder="Parle à BOPE..."><button onclick="send()">↑</button></div>
<script>
function ask(t){document.getElementById('input').value=t; send();}
async function send(){
  const input=document.getElementById('input'); const txt=input.value.trim(); if(!txt) return;
  const chat=document.getElementById('chat');
  chat.innerHTML+='<div class=msg user>'+txt+'</div>'; input.value='';
  chat.innerHTML+='<div class=msg bot id=loading>BOPE écrit...</div>'; chat.scrollTop=chat.scrollHeight;
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt})});
    const d=await r.json();
    document.getElementById('loading').remove();
    chat.innerHTML+='<div class=msg bot>'+d.reply+'</div>';
  }catch(e){ document.getElementById('loading').remove(); chat.innerHTML+='<div class=msg bot>Erreur</div>';}
  chat.scrollTop=chat.scrollHeight;
}
</script></body></html>`);
});

app.post('/chat', async (req, res) => {
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + process.env.GROQ_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: "Tu es BOPE IA, assistant congolais pour Kinshasa. Aide en video, emploi, santé, admin RDC." },{ role: "user", content: req.body.message }]
      })
    });
    const data = await r.json();
    res.json({ reply: data.choices?.[0]?.message?.content || "Erreur: " + JSON.stringify(data).slice(0,300) });
  } catch (e) { res.json({ reply: "Erreur: " + e.message }); }
});
app.listen(process.env.PORT || 10000, () => console.log("OK"));
