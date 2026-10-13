const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const GROQ_KEY = process.env.GROQ_API_KEY;

app.post('/chat', async (req, res) => {
  try {
    const { message, category = "General" } = req.body;

    if (!message) {
      return res.json({ reply: "Dis-moi quelque chose!" });
    }

    const systemPrompt = `Tu es BOPE IA, IA Générale de Kinshasa, RDC 🇨🇩. Tu aides pour: Video, Apprendre, Emploi, Sante, Admin RDC, General. Réponds en Lingala, Français ou Swahili selon l'utilisateur. Catégorie actuelle: ${category}. Sois utile, court, congolais.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await groqRes.json();

    // --- LE FIX QUI CORRIGE TON ERREUR ---
    if (!data ||!data.choices ||!data.choices[0] ||!data.choices[0].message) {
      console.error("BOPE ERREUR GROQ:", JSON.stringify(data));
      return res.json({
        reply: `Désolé, BOPE a buggé. Erreur: ${data?.error?.message || 'réponse vide de Groq'}. Vérifie ta clé GROQ_API_KEY.`
      });
    }

    const reply = data.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error(err);
    res.json({ reply: "Erreur serveur BOPE: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`BOPE IA en ligne sur port ${PORT}`));
