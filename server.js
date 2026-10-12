const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;
app.use(express.json());
app.use(express.static(__dirname));
app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'bope-final.html')));
app.post('/api/chat', async (req,res)=>{
  const msg = req.body.message || '';
  try{
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:"POST",
      headers:{
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type":"application/json"
      },
      body: JSON.stringify({
        model:"llama-3.3-70b-versatile",
        messages:[
          {role:"system", content:"Tu es BOPE IA, IA generale du Congo a Kinshasa. Tu fais tout: video, apprendre, emploi, sante, admin RDC. Reponds en francais simple."},
          {role:"user", content: msg}
        ]
      })
    });
    const data = await r.json();
    res.json({reply:data.choices[0].message.content});
  }catch(e){ res.json({reply:"Erreur: "+e.message}); }
});
app.listen(PORT, ()=> console.log("BOPE en ligne"));
