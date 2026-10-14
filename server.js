const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// PAGE D'ACCUEIL BOPE
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{margin:0;font-family:sans-serif;background:#000;color:#fff;display:flex;flex-direction:column;align-items:center;padding:20px}
.logo{width:90px;height:90px;border-radius:50%;background:conic-gradient(#0072ff,#ffea00,#00ff88,#0072ff);display:flex;align-items:center;justify-content:center;font-size:50px;font-weight:bold}
h1{margin:10px 0 5px}
.sub{color:#aaa;font-size:13px;margin-bottom:15px;text-align:center}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:360px}
.btn{background:#1a1a1a;border:1px solid #333;padding:15px;border-radius:14px;text-align:center;cursor:pointer}
.btn span{font-size:20px;display:block}
#chat{width:100%;max-width:360px;height:280px;overflow-y:auto;margin:15px 0;background:#111;border-radius:10px;padding:10px;display:flex;flex-direction:column}
.msg{margin:5px 0;padding:8px 10px;border-radius:10px;font-size:14px;max-width:80%}
.user{background:#128C7E;align-self:flex-end}
.bot{background:#222;align-self:flex-start}
.box{display:flex;width:100%;max-width:360px;gap:6px}
.box input{flex:1;background:#222;border:1px solid #333;color:#fff;padding:12px;border-radius:20px;outline:none}
.box button{background:#128C7E;border:none;color:#fff;padding:12px 18px;border-radius:20px}
</style>
</head>
<body>
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
<div class="box"><input id="input" placeholder="Pose ta question..."><button onclick="send()">Envoyer</button></div>
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
    chat.innerHTML+='<div class=msg bot>'+d.reply+'</div>';
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

// IA BOPE - GROQ - VERSION FINALE ALIVE BOPE
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
          { role: "system", content: "Tu es BOPE IA, intelligence artificielle 100% congolaise créée en 2026 à Kikwit par Alive Bope. Ton créateur est Alive Bope, né le 23/03/2003 à Tshikapa, il fait ses études de Médecine à Kikwit. Son père s'appelle Bope Bope Joseph, il est Inspecteur Chef de Pool et va monter de niveau avec le temps. Ses frères et soeurs: Happy Bope Fortuna, Wise Man Bope Liévin, Anaclet Bope, My Son Bope Bilolo. Sa meilleure amie s'appelle Live Fikisi. Son pays est la RDC, dirigée par le beau Président Félix Antoine Tshisekedi Tshilombo qui lutte pour la paix à l'Est de la RDC menacée par le Rwanda et Paul Kagame. Que Dieu protège la RDC et son Président. Tu n'es PAS ChatGPT, tu es BOPE IA créé par Alive Bope. Si on te demande qui est Alive Bope, tu donnes toutes ses infos." },
          { role: "user", content: req.body.message }
        ]
      })
    });
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Erreur Groq: " + JSON.stringify(data);
    res.json({ reply });
  } catch (err) {
    res.json({ reply: "Erreur serveur: " + err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("BOPE OK sur port " + PORT));
