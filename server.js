const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/chat', async (req, res) => {
  try {
    const message = req.body.message;
    const apiKey = process.env.GROQ_API_KEY;

    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Tu es BOPE IA, Kinshasa RDC. Aide utile." },
          { role: "user", content: message }
        ],
        temperature: 0.7
      })
    });

    const data = await r.json();
    
    if (!data.choices || !data.choices[0]) {
      console.log("Erreur Groq:", data);
      return res.json({ reply: "Erreur Groq: " + (data.error?.message || "vide") });
    }
    
    res.json({ reply: data.choices[0].message.content });
  } catch (e) {
    res.json({ reply: "Erreur serveur: " + e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("BOPE OK " + PORT));
