const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BOPE Kinshasa</title>
<style>body{font-family:sans-serif;padding:20px;max-width:600px;margin:auto;background:#f5f5f5} #chat{height:300px;overflow-y:auto;background:white;padding:10px;border-radius:10px;margin:10px 0}.msg{margin:8px 0;padding:8px;border-radius:8px}.user{background:#dcf8c6;text-align:right}.bot{background:#eee} input{width:70%;padding:10px;border-radius:20px;border:1px solid #ccc} button{padding:10px 15px;border-radius:20px;border:none;background:#128C7E;color:white}</style>
</head><body>
<h2>🇨🇩 BOPE Kinshasa - IA</h2>
<div id="chat"></div>
<input id="input" placeholder="Pose ta question..."><button onclick="send()">Envoyer</button>
<script>
async function send(){
  const input=document.getElementById('input'); const txt=input.value; if(!txt) return;
  const chat=document.getElementById('chat');
  chat.innerHTML+='<div class=msg user>'+txt+'</div>'; input.value='';
  chat.innerHTML+='<div class=msg bot id=loading>Chargement...</div>'; chat.scrollTop=chat.scrollHeight;
  try{
    const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:txt})});
    const d=await r.json();
    document.getElementById('loading').remove();
    chat.innerHTML+='<div class=msg bot>'+d.reply+'</div>';
  }catch(e){
    document.getElementById('loading').remove();
    chat.innerHTML+='<div class=msg bot>Erreur: '+e.message+'</div>';
  }
  chat.scrollTop=chat.scrollHeight;
}
</script>
</body></html>
  `);
});

app.post('/chat', async (req, res) => {
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": "Bearer " + process.env.GROQ_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama-3.1-8b-instant", messages: [{ role: "user", content: req.body.message }] })
    });
    const data = await r.json();
    res.json({ reply: data.choices?.[0]?.message?.content || "Erreur Groq: " + JSON.stringify(data).slice(0,400) });
  } catch (e) { res.json({ reply: "Erreur: " + e.message }); }
});

app.listen(process.env.PORT || 10000, () => console.log("OK"));
