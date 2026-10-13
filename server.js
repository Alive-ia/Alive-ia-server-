const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req,res)=> res.send('BOPE Kinshasa est Live'));

app.post('/chat', async (req, res) => {
  try {
    const message = req.body.message;
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Tu es BOPE IA, Kinshasa RDC." },
          { role: "user", content: message }
        ]
      })
    });
    const data = await r.json();
    if (!data.choices ||!data.choices[0]) {
      return res.json({ reply: "Erreur Groq: " + JSON.stringify(data).substring(0,200) });
    }
    res.json({ reply: data.choices[0].message.content });
  } catch (e) {
    res.json({ reply: "Erreur: " + e.message });
  }
});
app.listen(process.env.PORT || 10000, ()=>console.log("OK"));
