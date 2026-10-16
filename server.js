const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

// PAGE D'ACCUEIL
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BOPE IA 🇨🇩</title>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system;background:#000;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center}
.logo{width:92px;height:92px;border-radius:50%;margin-top:20px;background:conic-gradient(#0072ff,#ffea00,#00ff88,#0072ff);display:flex;align-items:center;justify-content:center;font-size:52px;font-weight:900;color:#000}
h1{margin:12px 0 4px;font-size:30px;letter-spacing:.5px}
.sub{color:#9a9a9a;font-size:14px;margin-bottom:18px;text-align:center;padding:0 12px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:92%;max-width:420px}
.btn{background:#121212;border:1px solid #2a2a2a;padding:16px;border-radius:16px;text-align:center;cursor:pointer;font-size:15px}
.btn:active{background:#1e1e1e}
#chat{width:92%;max-width:420px;flex:1;overflow-y:auto;margin:14px 0;padding:14px;display:flex;flex-direction:column;gap:14px;margin-bottom:90px}
.msg{padding:12px 16px;border-radius:18px;font-size:16px;line-height:1.6;max-width:85%;white-space:pre-wrap;word-break:break-word}
.user{background:#2e4a7e;align-self:flex-end}
.bot{background:#161616;border:1px solid #262626;align-self:flex-start;max-width:100%}
.box{position:fixed;bottom:0;left:0;right:0;background:#000;padding:10px;display:flex;justify-content:center;border-top:1px solid #1a1a1a}
.in{width:92%;max-width:420px;background:#1c1c1c;border-radius:28px;display:flex;align-items:center;padding:8px 14px;gap:10px}
.in input{flex:1;background:transparent;border:none;color:#fff;padding:10px;outline:none;font-size:16px}
.in button{background:#3a5fd0;border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px}
</style>
</head>
<body>
<div class="logo">B</div>
<h1>BOPE IA 🇨🇩</h1>
<div class="sub">intelligence artificielle congolaise par alive bope</div>
<div class="grid">
<div class="btn" onclick="ask('apprendre')">📚 apprendre</div>
<div class="btn" onclick="ask('emploi en rdc')">💼 emploi</div>
<div class="btn" onclick="ask('santé')">🏥 santé</div>
<div class="btn" onclick="ask('admin rdc')">📄 admin rdc</div>
</div>
<div id="chat"></div>
<div class="box"><div class="in"><input id="input" placeholder="pose ta question..."><button onclick="send()">▲</button></div></div>
<script>
function ask(t){document.getElementById('input').value=t;send()}
async function send(){
  const input=document.getElementById('input');
  const chat=document.getElementById('chat');
  if(!input.value.trim()) return;
  const txt=input.value;
  input.value='';
  chat.innerHTML+='<div class=msg user>'+txt.toLowerCase()+'</div>';
  chat.innerHTML+='<div class=msg bot id=ld>bope écrit...</div>';
  chat.scrollTop=chat.scrollHeight;
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt})});
    const d=await r.json();
    document.getElementById('ld').remove();
    chat.innerHTML+='<div class=msg bot>'+(d.reply||'erreur').replace(/\\n/g,'<br>')+'</div>';
  }catch(e){
    document.getElementById('ld').remove();
    chat.innerHTML+='<div class=msg bot>erreur réseau: '+e.message+'</div>';
  }
  chat.scrollTop=chat.scrollHeight;
}
</script>
</body>
</html>
  `);
});

// API CHAT
app.post('/chat', async (req, res) => {
  try {
    const userMessage = (req.body.message || '').trim();
    if (!userMessage) return res.json({ reply: 'pose ta question 😊' });

    const lower = userMessage.toLowerCase();

    // REPONSE IDENTITE - INCONTOURNABLE
    if (lower.includes("qui t'a créé") || lower.includes('qui ta cree') || lower.includes('createur') || lower.includes('créateur') || lower.includes('qui es tu')) {
      return res.json({
        reply: "je suis bope ia 🇨🇩\n\ncréée par alive bope, né le 23/03/2003 à tshikapa, étudiant en médecine à l'unikik kikwit\n\nfils de joseph bope bope, je suis là pour aider les congolais 🔥"
      });
    }

    // APPEL GROQ
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `Tu es BOPE IA, une IA congolaise créée par Alive Bope.
- Né 23/03/2003 Tshikapa, Kasaï, RDC
- Etudiant médecine UNIKIK Kikwit
- Père Joseph Bope Bope Inspecteur Chef de Pool
- Tu parles en minuscules, max 4 lignes, simple, direct
- Tu aides sur apprendre, emploi rdc, santé, admin rdc
- Tu es congolais, tu utilises parfois 🇨🇩 😊 🔥
- Tu ne dis jamais que tu es chatgpt, openai, meta ai, claude. Tu es BOPE IA.
- Si on demande qui t'a créé: Alive Bope`
          },
          { role: "user", content: userMessage }
        ],
        temperature: 0.4,
        max_tokens: 300
      })
    });

    const data = await groqRes.json();
    let reply = data.choices?.[0]?.message?.content || "je suis là 😊 pose ta question";

    // NETTOYAGE ANTI-CHATGPT
    reply = reply.toLowerCase();
    reply = reply.replace(/\*\*/g, '').replace(/__/g, '');
    if (reply.includes('openai') || reply.includes('chatgpt') || reply.includes('meta ai') || reply.includes('je suis un modèle de langage')) {
      reply = "je suis bope ia créée par alive bope 🇨🇩😊 comment je peux t'aider?";
    }

    res.json({ reply: reply.trim() });

  } catch (err) {
    console.error(err);
    res.json({ reply: "erreur serveur 😅 réessaie: " + err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("BOPE IA V1 ZERO OK port " + PORT));
