const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.send('BOPE Live'));

app.post('/chat', async (req, res) => {
  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.GROQ_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: req.body.message }]
      })
    });
    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content || "Erreur: " + JSON.stringify(data).slice(0,300);
    res.json({ reply });
  } catch (e) {
    res.json({ reply: "Erreur: " + e.message });
  }
});

app.listen(process.env.PORT || 10000, () => console.log("BOPE OK"));
