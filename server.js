const express=require('express');
const cors=require('cors');
const app=express();
app.use(cors());
app.use(express.json());

app.get('/',(req,res)=>res.send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BOPE IA</title><style>body{margin:0;background:#000;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh}h1{margin:22px 0 2px}#chat{width:92%;max-width:440px;flex:1;overflow-y:auto;margin:12px 0 90px;padding:14px;display:flex;flex-direction:column;gap:12px}.msg{padding:12px 16px;border-radius:18px;white-space:pre-wrap;font-size:16px}.user{background:#2f4f8a;align-self:flex-end}.bot{background:#151515;border:1px solid #222;align-self:flex-start}.box{position:fixed;bottom:0;left:0;right:0;background:#000;padding:10px;display:flex;justify-content:center;border-top:1px solid #1a1a1a}.in{width:92%;max-width:440px;background:#1e1e1e;border-radius:28px;display:flex;align-items:center;padding:8px 14px}.in input{flex:1;background:transparent;border:none;outline:none;color:#fff;font-size:16px}.in button{background:#3a5fd0;border:none;color:#fff;width:36px;height:36px;border-radius:50%}</style></head><body><h1>BOPE IA 🇨🇩</h1><div style="color:#888">par vivant bope</div><div id=chat></div><div class=box><div class=in><input id=input placeholder="pose ta question..."><button onclick=send()>▲</button></div></div><script>async function send(){const i=document.getElementById('input'),c=document.getElementById('chat');if(!i.value.trim())return;const t=i.value;i.value='';c.innerHTML+='<div class="msg user">'+t+'</div>';c.innerHTML+='<div class="msg bot" id=ld>...</div>';c.scrollTop=c.scrollHeight;try{const r=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:t})});const d=await r.json();document.getElementById('ld').remove();c.innerHTML+='<div class="msg bot">'+d.reply+'</div>';}catch(e){document.getElementById('ld').remove();c.innerHTML+='<div class="msg bot">erreur '+e.message+'</div>';}c.scrollTop=c.scrollHeight}document.getElementById('input').addEventListener('keydown',e=>{if(e.key==='Enter')send()})</script></body></html>`));

app.post('/chat',async(req,res)=>{
try{
const txt=(req.body.message||'').toLowerCase();
if(txt.includes('qui') && txt.includes('cre') || txt.includes('createur') || txt.includes('qui es tu')){
return res.json({reply:"je suis bope ia 🇨🇩 creee par alive bope ne le 23/03/2003 a tshikapa etudiant medecine unikik fils de joseph bope bope"});
}
if(!process.env.GROQ_API_KEY){
return res.json({reply:"clé groq manquante"});
}
const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
method:"POST",
headers:{Authorization:`Bearer ${process.env.GROQ_API_KEY}`,"Content-Type":"application/json"},
body:JSON.stringify({
model:"openai/gpt-oss-20b",
messages:[
{role:"system",content:"Tu es BOPE IA, créée par Alive Bope (23/03/2003 Tshikapa, médecine UNIKIK, fils de Joseph Bope Bope). Parle en minuscules, court, français congolais. Ne dis jamais openai, meta, chatgpt."},
{role:"user",content:req.body.message}
],
temperature:0.6,max_tokens:600
})
});
const d=await r.json();
if(d.error) return res.json({reply:"groq erreur: "+d.error.message});
if(!d.choices) return res.json({reply:"groq pas de reponse"});
res.json({reply:d.choices[0].message.content.toLowerCase()});
}catch(e){
res.json({reply:"erreur serveur: "+e.message});
}
});
app.listen(process.env.PORT||10000,()=>console.log("BOPE READY"));
