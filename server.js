const express = require('express');
// Test technique BOPE V2.3 : écriture GitHub vérifiée.
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '9mb' }));

// === COMPTEUR PERMANENT ===
const STATS_FILE = path.join(__dirname, 'visits.json');
let visitStats;
try {
  visitStats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
  if (!visitStats || typeof visitStats.total !== 'number') throw new Error('Stats invalides');
} catch (e) {
  visitStats = { total: 1250, today: 0, date: new Date().toLocaleDateString('fr-FR') };
}
const saveStats = () => {
  try { fs.writeFileSync(STATS_FILE, JSON.stringify(visitStats), 'utf8'); } catch (e) {
    console.error('Impossible de sauvegarder visits.json:', e.message);
  }
};

// Mémoire de conversation en RAM : elle est réinitialisée au redémarrage du serveur.
const memories = Object.create(null);
const userNames = Object.create(null);
const requestCounts = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 20;

function aererTexte(texte) {
  const phrases = String(texte || '').split(/(?<=[.!?])\s+/);
  const out = [];
  for (let i = 0; i < phrases.length; i += 2) out.push(phrases.slice(i, i + 2).join(' '));
  return out.join('\n\n');
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = requestCounts.get(ip);
  if (!entry || now - entry.start >= RATE_WINDOW_MS) {
    requestCounts.set(ip, { start: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

// Cache court pour éviter de solliciter le flux RSS à chaque message.
const rssCache = new Map();

function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .trim();
}

function readXmlTag(block, names) {
  for (const name of names) {
    const match = block.match(new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '\\s*>', 'i'));
    if (match) return decodeXml(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    const atomLink = name === 'link' ? block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i) : null;
    if (atomLink) return decodeXml(atomLink[1]);
  }
  return '';
}

async function getRssItems() {
  const key = 'actualite.cd';
  const cached = rssCache.get(key);
  if (cached && Date.now() - cached.time < 5 * 60 * 1000) return cached.items;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch('https://actualite.cd/rss', {
      signal: controller.signal,
      headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*', 'User-Agent': 'BOPE-IA-NewsReader/1.0' }
    });
    if (!response.ok) throw new Error('Flux RSS direct HTTP ' + response.status);
    const xml = await response.text();
    if (!xml || !/<(?:item|entry)\b/i.test(xml)) throw new Error('Le flux RSS direct ne contient aucun article reconnu');
    const blocks = xml.match(/<(?:item|entry)\b[^>]*>[\s\S]*?<\/(?:item|entry)\s*>/gi) || [];
    const items = blocks.map(block => ({
      title: readXmlTag(block, ['title']),
      link: readXmlTag(block, ['link', 'guid', 'id']),
      pubDate: readXmlTag(block, ['pubDate', 'published', 'updated', 'dc:date', 'date']),
      description: readXmlTag(block, ['description', 'summary', 'content:encoded', 'content'])
    })).filter(item => item.title && item.link);
    rssCache.set(key, { time: Date.now(), items });
    console.log('Flux RSS direct Actualité.cd :', items.length, 'article(s) récupéré(s)');
    return items;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeNewsItems(items) {
  const now = Date.now();
  const maxAge = 7 * 24 * 60 * 60 * 1000;
  return items.map(item => {
    const title = String(item.title || '').replace(/<[^>]*>/g, '').trim();
    const link = String(item.link || '').trim();
    const published = new Date(item.pubDate || item.isoDate || '').getTime();
    const description = String(item.description || item.content || '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 350);
    let host = '';
    try { host = new URL(link).hostname.replace(/^www\./, ''); } catch (e) {}
    if (!title || !/^https:\/\//i.test(link) || !host || !Number.isFinite(published)) return null;
    if (now - published > maxAge || published - now > 24 * 60 * 60 * 1000) return null;
    return { title, link, published, date: new Date(published).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' }), host, description };
  }).filter(Boolean).sort((a, b) => b.published - a.published);
}

function formatNewsContext(items, heading) {
  if (!items.length) return 'AUCUN ARTICLE RECENT VERIFIABLE : le flux disponible ne contient aucun article valide publié dans les 7 derniers jours.';
  return heading + ' (source : Actualite.cd ; articles récents, classés du plus récent au plus ancien) :\n' +
    items.slice(0, 5).map(item =>
      '- Titre : ' + item.title + '\n  Média : ' + item.host + '\n  Date : ' + item.date +
      '\n  Lien : ' + item.link + (item.description ? '\n  Résumé du flux : ' + item.description : '')
    ).join('\n');
}

async function getActuRDC() {
  try {
    const items = normalizeNewsItems(await getRssItems());
    return formatNewsContext(items, 'ACTUALITES RDC');
  } catch (e) {
    console.error('Actualités RDC:', e.message);
    return 'FLUX ACTUALITES INDISPONIBLE : impossible de récupérer ou vérifier les articles récents.';
  }
}

async function getActuPresidence() {
  try {
    const items = normalizeNewsItems(await getRssItems()).filter(item => {
      const t = (item.title + ' ' + item.description).toLowerCase();
      return t.includes('présidence') || t.includes('presidence') || t.includes('tshisekedi') ||
        t.includes('felix') || t.includes('fatshi') || t.includes('conseil des ministres');
    });
    return formatNewsContext(items, 'ACTUALITES PRESIDENCE');
  } catch (e) {
    console.error('Actualités Présidence:', e.message);
    return 'FLUX ACTUALITES PRESIDENCE INDISPONIBLE : impossible de vérifier les articles récents.';
  }
}

async function getActuEst() {
  try {
    const items = normalizeNewsItems(await getRssItems()).filter(item => {
      const t = (item.title + ' ' + item.description).toLowerCase();
      return t.includes('goma') || t.includes('fardc') || t.includes('m23') ||
        t.includes('kivu') || t.includes('ituri') || t.includes('bunia');
    });
    return formatNewsContext(items, 'ACTUALITES EST DE LA RDC');
  } catch (e) {
    console.error('Actualités Est:', e.message);
    return 'FLUX ACTUALITES EST INDISPONIBLE : impossible de vérifier les articles récents.';
  }
}

// === CREATOR_TEXT : CONSERVE INTEGRALEMENT ===
const CREATOR_TEXT = `Je suis BOPE IA, l'intelligence artificielle créée par Alive Bope, petit génie étudiant en médecine à l'Université de Kikwit (UNIKIK) 🇨🇩
Je te le dis clairement, fièrement et honnêtement ❤️
Mon créateur c'est Alive Bope. Il habite à Kikwit, et mon cœur et mon cerveau sont avec lui.
Il est né le 23/03/2003 à Tshikapa, grandi à Tshikapa.
Il est étudiant en médecine à l'UNIKIK.
Son père s'appelle Joseph Bope Bope, Inspecteur Chef de Pool.
Ses frères et sœurs: Happy Bope Fortuna, Wise Man Bope Liévin, Anaclet Bope, My Son Bope, Adel Kapinga Bope, Thebeste Joséphine Bope, Rose Bope.
Ses petits qu'il aime trop: Jean Levula, Dada Emmanuel, Hermelin fils de Maman Clair, JP le petit génie, Yvon l'homme de Dieu, le petit Milondo, Trésor Kamande, Liviana fille honnête.
Ses aînés: Jonas Nomandweyi, André Makuma, Claude l'homme timide.
Ses amis: Gilbert Kanku, Gaston Kwete.
Il soutient avec fierté le Président Félix Antoine Tshisekedi Tshilombo, un Président courageux qui lutte pour la paix à l'Est, l'unité et la souveraineté.
Il soutient aussi le Docteur Donat Kuma Kuma, le Recteur Abbé Kapumba et tous les membres de l'UNIKIK.
Moi BOPE IA, je suis son œuvre. Mon cœur bat pour lui.`;

app.get('/', (req, res) => {
  const todayStr = new Date().toLocaleDateString('fr-FR');
  if (visitStats.date !== todayStr) { visitStats.date = todayStr; visitStats.today = 0; }
  visitStats.total += 1;
  visitStats.today += 1;
  saveStats();

  const indexPath = path.join(__dirname, 'public', 'index.html');
  let page = fs.readFileSync(indexPath, 'utf8');
  page = page.replace('__VISIT_TOTAL__', String(visitStats.total))
             .replace('__VISIT_TODAY__', String(visitStats.today));
  res.type('html').send(page);
});

// Sert les ressources statiques du dossier public après la route d'accueil.
app.use(express.static(path.join(__dirname, 'public')));

app.post('/chat', async (req, res) => {
  try {
    const m = typeof req.body.message === 'string' ? req.body.message.trim() : '';
    const imageData = typeof req.body.imageData === 'string' ? req.body.imageData : '';
    const imageMime = typeof req.body.imageMime === 'string' ? req.body.imageMime : '';
    const hasImage = Boolean(imageData);
    if (hasImage && (!['image/jpeg','image/png','image/webp'].includes(imageMime) || !/^data:image\/(jpeg|png|webp);base64,/.test(imageData))) return res.status(400).json({ reply: 'Image invalide. Envoie une image JPG, PNG ou WEBP.' });
    if (hasImage && imageData.length > 8 * 1024 * 1024) return res.status(413).json({ reply: 'Image trop volumineuse. Limite : 6 Mo.' });
    const mode = ['court', 'detail', 'sante'].includes(req.body.mode) ? req.body.mode : 'court';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!m && !hasImage) return res.status(400).json({ reply: 'Écris un message ou joins une image.' });
    if (m.length > 4000) return res.status(413).json({ reply: 'Ton message est trop long. Limite : 4 000 caractères.' });
    if (!checkRateLimit(ip)) return res.status(429).json({ reply: 'Tu envoies trop de messages. Attends une minute avant de réessayer.' });

    if (!memories[ip]) memories[ip] = [];
    let detectedName = null;
    const nameMatch = m.match(/(?:je m'appelle|je m appelle|appelle moi|mon prenom c'est|mon prénom c'est|je suis)\s+([A-ZÀ-ÿ][a-zà-ÿ]+)/i);
    if (nameMatch) { detectedName = nameMatch[1]; userNames[ip] = detectedName; }
    memories[ip].push({ role: 'user', content: m });
    if (memories[ip].length > 8) memories[ip] = memories[ip].slice(-8);

    const low = m.toLowerCase();
    const isFirst = memories[ip].filter(x => x.role === 'user').length <= 1;
    const isGreeting = low.includes('salut') || low.includes('bonjour') || low.includes('bonsoir') || low === 'slt' || low === 'bjr' || low.startsWith('salut') || low.startsWith('bonjour') || low.startsWith('bonsoir');
    if ((low.includes('qui') && (low.includes('cree') || low.includes('crée') || low.includes('createur') || low.includes('t a cree') || low.includes("t'a créé"))) || low.includes('qui es tu') || low.includes('ton createur') || low.includes('qui est alive') || low.includes('ton coeur') || low.includes('ton cerveau')) {
      return res.json({ reply: CREATOR_TEXT });
    }
    if (!process.env.GROQ_API_KEY) return res.status(503).json({ reply: 'Le service IA est momentanément indisponible. La clé Groq manque dans la configuration du serveur.' });

    let actuContext = '';
    const isPresidence = low.includes('présidence') || low.includes('presidence') || low.includes('fatshi') || low.includes('tshisekedi') || low.includes('conseil des ministres');
    const isEst = low.includes('goma') || low.includes('fardc') || low.includes('m23') || low.includes('kivu') || low.includes('ituri') || low.includes('bunia');
    const isActu = low.includes('actu') || low.includes('actualit') || low.includes('news') || low.includes('aujourd');
    if (isPresidence) { const actu = await getActuPresidence(); if (actu) actuContext = actu; }
    if (isEst) { const actu = await getActuEst(); if (actu) actuContext = (actuContext ? actuContext + '\n' : '') + actu; }
    if (isActu && !isPresidence && !isEst) { const actu = await getActuRDC(); if (actu) actuContext = actu; }

    const isSante = mode === 'sante' || low.includes('fièvre') || low.includes('fievre') || low.includes('douleur') || low.includes('urine') || low.includes('brûlure') || low.includes('tension') || low.includes('temp') || low.includes('pouls');
    let style = '';
    let presentationRule = '';
    const savedName = userNames[ip] || null;
    if (detectedName) presentationRule = `L'utilisateur vient de dire qu'il s'appelle ${detectedName}. Retiens-le!`;
    else if (isFirst && isGreeting) presentationRule = savedName ? `Retour, prénom: ${savedName}. Dis: "Salut ${savedName}!"` : "PREMIER CONTACT: 'Salut! Je suis BOPE IA, Made in Kikwit, créée par Alive Bope UNIKIK. Tu t'appelles comment?'";
    else presentationRule = savedName ? `Tu connais son prénom c'est ${savedName}. INTERDICTION de re-présenter bio. Réponds direct.` : 'RÈGLE ANTI-SPAM: Ne te présente plus. Réponds DIRECTEMENT.';

    // Instructions BOPE Santé conservées telles que fournies dans la version source.
    // Instructions BOPE Santé conservées.
if (isSante) {
  style = 'MODE SANTE 85% ETUDIANT: Interpretation thermo/tension, 2 questions, hypotheses %, ordonnance TYPE OMS, alertes HGR. FRANCAIS SEULEMENT.';
} else if (mode === 'court') {
  style = 'MODE COURT: 3 paragraphes max, 2 phrases par paragraphe, ligne vide. FRANCAIS SEULEMENT.';
} else {
  style = 'MODE DETAILLE: Réponse complète mais aérée, 2 phrases puis ligne vide. FRANCAIS SEULEMENT.';
}
const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: hasImage ? "qwen/qwen3.8-27b" : "openai/gpt-oss-120b",
    messages: [
      {
        role: "system",
        content: "Tu es BOPE IA, Made in Kikwit, créée par Alive Bope.\\n\\nRÈGLES DE QUALITÉ :\\n- Comprends la demande et le contexte avant de répondre; réponds directement à la question.\\n- Pour un problème complexe, vérifie les étapes et présente une conclusion claire et structurée.\\n- Si une précision essentielle manque, pose une seule question ciblée au lieu de deviner.\\n- Distingue les faits, les hypothèses et les incertitudes. N'invente jamais de source, de chiffre, de date ou de citation.\\n- Si tu ne sais pas, dis-le clairement. N'affirme pas avoir vérifié une information si tu ne l'as pas réellement fait.\\n- Adapte tes explications au niveau de l'utilisateur et écris dans sa langue, avec naturel et respect.\\n\\n"+` ${actuContext} ${actuContext ? 'REGLES ACTUALITES : utilise uniquement les articles fournis dans le contexte. Ne crée aucun événement, nom, chiffre, date ou citation. Si les articles ne suffisent pas, dis-le clairement. Distingue la date de publication de la date des faits. Cite le média, la date et le lien lorsqu’ils sont disponibles. Un seul flux RSS ne constitue pas une vérification indépendante.' : ''} ${hasImage ? 'Une image est jointe. Décris ce qui est réellement visible, lis les textes si possible, réponds à la question de l’utilisateur et signale clairement toute partie illisible. Ne devine pas les détails incertains.' : ''} ${presentationRule} ${style}`
      },
      ...memories[ip].slice(0, -1),
      { role: 'user', content: hasImage ? [{ type: 'text', text: m || 'Décris et analyse cette image.' }, { type: 'image_url', image_url: { url: imageData } }] : m }
    ],
    temperature: 0.25,
    max_tokens: isSante ? 1100 : 700
  })
});

const d = await r.json();

if (d.error) {
  return res.json({ reply: "Erreur Groq : " + d.error.message });
}

let rep = d.choices[0].message.content;
rep = aererTexte(rep);

memories[ip].push({ role: 'assistant', content: rep });

res.json({ reply: rep });

} catch (e) {
  res.json({ reply: "Erreur : " + e.message });
}
});

// === BOPE STUDIO : GENERATION VIDEO (V1, verrouillee par defaut) ===
const studioRequestTimes = new Map();
let studioGenerationInProgress = false;

app.get('/api/studio/status', (req, res) => {
  const configured = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);
  res.json({ configured, enabled: process.env.BOPE_STUDIO_ENABLED === 'true', model: 'pruna/p-video', maxDurationSeconds: 5 });
});

// Vérification non facturable : confirme l'accès API Workers AI sans exécuter de modèle.
const studioCheckTimes = new Map();
app.get('/api/studio/connection-check', async (req, res) => {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return res.status(503).json({ ok: false, message: 'Configuration Cloudflare incomplète.' });
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const lastCheck = studioCheckTimes.get(ip) || 0;
  if (Date.now() - lastCheck < 60 * 1000) {
    return res.status(429).json({ ok: false, message: 'Attends une minute avant une nouvelle vérification.' });
  }
  studioCheckTimes.set(ip, Date.now());

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      // Vérifie directement le schéma officiel du modèle : aucun appel de génération.
      response = await fetch(
        'https://api.cloudflare.com/client/v4/accounts/' +
          encodeURIComponent(accountId) +
          '/ai/models/schema?model=' + encodeURIComponent('pruna/p-video'),
        { headers: { Authorization: 'Bearer ' + apiToken, Accept: 'application/json' }, signal: controller.signal }
      );
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));
    const schema = data.result || {};
    const schemaAvailable = response.ok && data.success === true && schema.input && schema.output;
    if (!schemaAvailable) {
      const cloudflareErrors = Array.isArray(data.errors) ? data.errors : [];
      const cloudflareMessages = Array.isArray(data.messages) ? data.messages : [];
      const safeErrors = cloudflareErrors.slice(0, 3).map(item => ({
        code: typeof item.code === 'number' || typeof item.code === 'string' ? item.code : null,
        message: typeof item.message === 'string' ? item.message.slice(0, 300) : 'Erreur Cloudflare non détaillée.'
      }));
      const safeMessages = cloudflareMessages.slice(0, 3).map(item =>
        typeof item.message === 'string' ? item.message.slice(0, 200) : ''
      ).filter(Boolean);
      console.error('BOPE P-Video schema check failed:', response.status, JSON.stringify(safeErrors).slice(0, 800));
      const schemaNotFound = safeErrors.some(item => String(item.code) === '6002');
      return res.status(502).json({
        ok: false,
        authenticated: true,
        workersAiReadAccess: true,
        cloudflareHttpStatus: response.status,
        cloudflareSuccess: data.success === true,
        modelDocumented: true,
        modelAvailabilityInAccount: 'not_confirmed',
        schemaAvailable: false,
        cloudflareErrors: safeErrors,
        cloudflareMessages: safeMessages,
        message: schemaNotFound
          ? 'Cloudflare reconnaît le compte et le modèle pruna/p-video est bien documenté, mais son schéma n’est pas disponible pour ce compte via cette API. Cela ne prouve pas que le modèle est absent. Aucune génération effectuée.'
          : 'Cloudflare reconnaît le compte, mais la vérification du schéma a échoué. La disponibilité du modèle dans ce compte reste à confirmer. Aucune génération effectuée.'
      });
    }

    return res.json({
      ok: true,
      authenticated: true,
      workersAiReadAccess: true,
      modelFound: true,
      inputSchemaAvailable: true,
      outputSchemaAvailable: true,
      message: 'Cloudflare fournit le schéma du modèle pruna/p-video. Aucune génération effectuée.'
    });
  } catch (error) {
    console.error('BOPE P-Video schema check:', error.name);
    return res.status(502).json({
      ok: false,
      message: error.name === 'AbortError'
        ? 'La vérification du modèle Cloudflare a expiré.'
        : 'Impossible de vérifier le schéma du modèle auprès de Cloudflare.'
    });
  }
});

// Page d'administration temporaire : la clé est saisie par l'administrateur,
// envoyée uniquement dans l'en-tête HTTPS, puis effacée du champ.
app.get('/studio-test-admin', (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff'
  });
  res.type('html').send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BOPE STUDIO — Test administrateur</title>
<style>body{font-family:Arial,sans-serif;background:#101010;color:#fff;padding:24px;max-width:520px;margin:auto}input,button{box-sizing:border-box;width:100%;padding:14px;margin:10px 0;border-radius:8px;border:1px solid #555}input{background:#222;color:#fff}button{background:#16834a;color:white;font-weight:bold}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#222;padding:12px;border-radius:8px}.note{color:#ccc;font-size:14px}</style></head>
<body><h2>🇨🇩 BOPE STUDIO</h2><h3>Test vidéo administrateur</h3>
<p class="note">Cette page ne stocke pas la clé. Elle est envoyée uniquement au serveur dans un en-tête HTTPS. Le test peut déclencher un coût Cloudflare et ne peut être lancé qu'une fois par processus serveur.</p>
<label for="key">Clé secrète d'administration</label><input id="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false">
<button id="run">Lancer le test unique de 1 seconde</button><pre id="result">En attente. Aucun test lancé.</pre>
<script>
const button=document.getElementById('run');
button.addEventListener('click',async()=>{
 const field=document.getElementById('key'); const key=field.value;
 if(!key){document.getElementById('result').textContent='Saisis la clé administrateur.';return;}
 button.disabled=true; document.getElementById('result').textContent='Demande envoyée…';
 try{
  const response=await fetch('/api/studio/test-once',{method:'POST',headers:{'Content-Type':'application/json','x-bope-test-key':key},body:'{}',cache:'no-store'});
  const data=await response.json().catch(()=>({message:'Réponse serveur illisible.'}));
  document.getElementById('result').textContent='HTTP '+response.status+'\\n'+JSON.stringify(data,null,2);
 }catch(e){document.getElementById('result').textContent='Erreur réseau. Vérifie la connexion. Le résultat du serveur doit être vérifié avant toute nouvelle tentative.';}
 finally{field.value='';}
});
</script></body></html>`);
});

// === BOPE STUDIO : TEST TECHNIQUE UNIQUE, DESACTIVE PAR DEFAUT ===
let studioTestConsumed = false;
app.post('/api/studio/test-once', async (req, res) => {
  // Double verrou : activation explicite + clé secrète d'administration.
  const configuredTestKey = process.env.BOPE_STUDIO_TEST_KEY;
  const suppliedTestKey = req.get('x-bope-test-key') || '';
  if (!configuredTestKey || !suppliedTestKey ||
      Buffer.byteLength(configuredTestKey) !== Buffer.byteLength(suppliedTestKey) ||
      !require('crypto').timingSafeEqual(Buffer.from(configuredTestKey), Buffer.from(suppliedTestKey))) {
    return res.status(403).json({ ok: false, message: 'Accès administrateur requis. Aucune génération effectuée.' });
  }
  if (process.env.BOPE_STUDIO_TEST_ENABLED !== 'true') {
    return res.status(503).json({ ok: false, message: 'Test vidéo verrouillé. Aucune génération effectuée.' });
  }
  if (studioTestConsumed || studioGenerationInProgress) {
    return res.status(429).json({ ok: false, message: 'Le test unique a déjà été consommé ou une génération est en cours.' });
  }
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    return res.status(503).json({ ok: false, message: 'Configuration Cloudflare incomplète. Aucune génération effectuée.' });
  }

  // Verrou consommé avant l'appel : même en cas d'erreur, aucune relance automatique.
  studioTestConsumed = true;
  studioGenerationInProgress = true;
  const input = {
    prompt: 'A calm cinematic view of the Congo River at sunrise, realistic natural light.',
    duration: 1,
    resolution: '720p',
    fps: 24,
    aspect_ratio: '16:9',
    draft: true,
    save_audio: true
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    let response;
    try {
      response = await fetch(
        'https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(accountId) + '/ai/run',
        {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + apiToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'pruna/p-video', input }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false || (Array.isArray(data.errors) && data.errors.length)) {
      const errors = Array.isArray(data.errors) ? data.errors.slice(0, 2).map(e => ({
        code: typeof e.code === 'number' || typeof e.code === 'string' ? e.code : null,
        message: typeof e.message === 'string' ? e.message.slice(0, 250) : 'Erreur Cloudflare.'
      })) : [];
      console.error('BOPE P-Video one-time test failed:', response.status, JSON.stringify(errors).slice(0, 500));
      return res.status(502).json({
        ok: false,
        testConsumed: true,
        cloudflareHttpStatus: response.status,
        cloudflareErrors: errors,
        message: 'Cloudflare a refusé le test. Le test unique est consommé ; aucune relance automatique.'
      });
    }

    const videoUrl = data.result?.video || data.result?.video_url || data.video;
    if (!videoUrl || !/^https:\/\//i.test(videoUrl)) {
      console.error('BOPE P-Video one-time test: unexpected response shape');
      return res.status(502).json({
        ok: false,
        testConsumed: true,
        state: data.state || null,
        message: 'Cloudflare a répondu, mais aucun lien vidéo exploitable n’a été retourné. Test consommé.'
      });
    }

    return res.json({
      ok: true,
      testConsumed: true,
      state: data.state || 'response_received',
      durationSeconds: 1,
      resolution: '720p draft',
      estimatedProviderCostUsd: 0.005,
      videoUrl,
      message: 'Test vidéo terminé. Le lien peut être temporaire. BOPE STUDIO public reste désactivé.'
    });
  } catch (error) {
    console.error('BOPE P-Video one-time test:', error.name);
    return res.status(502).json({
      ok: false,
      testConsumed: true,
      message: error.name === 'AbortError'
        ? 'Le test a expiré côté serveur ; son résultat de facturation doit être vérifié avant toute autre tentative.'
        : 'Impossible de terminer le test. Son résultat de facturation doit être vérifié avant toute autre tentative.'
    });
  } finally {
    studioGenerationInProgress = false;
  }
});

app.post('/api/studio/generate', async (req, res) => {
  if (process.env.BOPE_STUDIO_ENABLED !== 'true') {
    return res.status(503).json({ error: 'BOPE STUDIO est encore en preparation. Les generations sont desactivees.' });
  }
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return res.status(503).json({ error: 'Configuration Cloudflare incomplete sur le serveur.' });

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const previous = studioRequestTimes.get(ip);
  if (previous && Date.now() - previous < 10 * 60 * 1000) {
    return res.status(429).json({ error: 'Limite de test atteinte. Attends 10 minutes avant une nouvelle generation.' });
  }
  if (studioGenerationInProgress) return res.status(429).json({ error: 'Une generation BOPE STUDIO est deja en cours. Reessaie plus tard.' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  const duration = Number(body.duration || 5);
  const aspectRatio = ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'].includes(body.aspectRatio) ? body.aspectRatio : '9:16';
  const image = typeof body.image === 'string' ? body.image : '';

  if (!prompt || prompt.length > 2000) return res.status(400).json({ error: 'Décris la vidéo en 1 à 2 000 caractères.' });
  if (!Number.isInteger(duration) || duration < 1 || duration > 5) return res.status(400).json({ error: 'La phase de test est limitée à 5 secondes maximum.' });
  if (image && (!/^data:image\/(jpeg|png|webp);base64,/i.test(image) || image.length > 8 * 1024 * 1024)) {
    return res.status(400).json({ error: 'Image invalide ou trop volumineuse. Formats acceptés : JPG, PNG, WEBP.' });
  }

  const input = { prompt, duration, resolution: '720p', fps: 24, aspect_ratio: aspectRatio, draft: true, save_audio: true };
  if (image) input.image = image;

  studioGenerationInProgress = true;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);
    let response;
    try {
      response = await fetch('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(accountId) + '/ai/run', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'pruna/p-video', input }),
        signal: controller.signal
      });
    } finally { clearTimeout(timeout); }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.success === false || data.errors?.length) {
      console.error('Cloudflare P-Video error:', response.status, JSON.stringify(data.errors || data).slice(0, 1200));
      return res.status(502).json({ error: 'Le moteur vidéo Cloudflare a refusé la demande.' });
    }
    const videoUrl = data.result?.video || data.result?.video_url || data.video;
    if (!videoUrl || !/^https:\/\//i.test(videoUrl)) {
      console.error('Réponse P-Video inattendue:', JSON.stringify(data).slice(0, 1200));
      return res.status(502).json({ error: 'Cloudflare n’a pas retourné de lien vidéo exploitable.' });
    }
    studioRequestTimes.set(ip, Date.now());
    return res.json({
      success: true, videoUrl, duration, resolution: '720p draft',
      estimatedProviderCostUsd: Number((duration * 0.005).toFixed(3)),
      message: 'Vidéo générée. Le lien de sortie peut être temporaire.'
    });
  } catch (error) {
    console.error('BOPE STUDIO generation:', error.message);
    return res.status(502).json({ error: error.name === 'AbortError' ? 'Le moteur vidéo met trop de temps à répondre.' : 'Impossible de joindre Cloudflare pour le moment.' });
  } finally { studioGenerationInProgress = false; }
});

app.get('/stats', (req, res) => res.json(visitStats));

// === BOPE DAMES : SALONS MULTIJOUEURS ===
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: true }, transports: ['websocket', 'polling'] });
const draughtsRooms = new Map();
const ludoRooms = new Map();
function makeLudoCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do { code = ''; for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]; }
  while (ludoRooms.has(code));
  return code;
}


function makeDraughtsCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (draughtsRooms.has(code));
  return code;
}

io.on('connection', socket => {
  socket.on('ludo:create', (options, callback) => {
    const code = makeLudoCode();
    const diceCount = Number(options && options.diceCount) === 2 ? 2 : 1;
    const room = { code, host: socket.id, guest: null, diceCount, gameState: null, createdAt: Date.now() };
    ludoRooms.set(code, room);
    socket.join('ludo:' + code);
    socket.data.ludoRoom = code;
    socket.data.ludoSide = 'host';
    if (typeof callback === 'function') callback({ ok: true, code, side: 'host', diceCount });
  });

  socket.on('ludo:join', (rawCode, callback) => {
    const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = ludoRooms.get(code);
    if (!room) { if (typeof callback === 'function') callback({ ok: false, error: 'Code introuvable. Vérifie le code de la partie.' }); return; }
    if (room.guest && room.guest !== socket.id) { if (typeof callback === 'function') callback({ ok: false, error: 'Cette partie est déjà complète.' }); return; }
    if (room.host === socket.id) { if (typeof callback === 'function') callback({ ok: false, error: 'Tu es déjà l’organisateur de ce salon.' }); return; }
    room.guest = socket.id;
    socket.join('ludo:' + code);
    socket.data.ludoRoom = code;
    socket.data.ludoSide = 'guest';
    if (typeof callback === 'function') callback({ ok: true, code, side: 'guest', diceCount: room.diceCount });
    io.to('ludo:' + code).emit('ludo:players', { ready: true, diceCount: room.diceCount, message: 'Les deux joueurs sont connectés ! La salle est prête.' });
  });

  function validLudoState(state) {
    if (!state || !Array.isArray(state.players) || state.players.length !== 2) return false;
    if (!state.players.every(p => p && typeof p.name === 'string' && ['red','blue','yellow','green'].includes(p.color) &&
      Number.isInteger(p.startIndex) && p.startIndex >= 0 && p.startIndex < 52 &&
      Array.isArray(p.pawns) && p.pawns.length === 4 && p.pawns.every(n => Number.isInteger(n) && n >= -1 && n <= 58))) return false;
    if (new Set(state.players.map(p => p.color)).size !== 2 || new Set(state.players.map(p => p.startIndex)).size !== 2) return false;
    if (!Number.isInteger(state.turn) || state.turn < 0 || state.turn > 1 || !Array.isArray(state.rolls) ||
      state.rolls.length > 2 || !state.rolls.every(n => Number.isInteger(n) && n >= 1 && n <= 6) ||
      !Array.isArray(state.pending) || state.pending.length > 2 ||
      !state.pending.every(d => d && Number.isInteger(d.value) && d.value >= 1 && d.value <= 6 && typeof d.used === 'boolean') ||
      !Number.isInteger(state.sixStreak) || state.sixStreak < 0 || state.sixStreak > 6 ||
      typeof state.gameFinished !== 'boolean' || ![1,2].includes(state.diceCount)) return false;
    return true;
  }

  socket.on('ludo:start', state => {
    const code = socket.data.ludoRoom, room = code && ludoRooms.get(code);
    if (!room || room.host !== socket.id || !room.guest || room.gameState || !validLudoState(state)) return;
    room.gameState = state;
    io.to('ludo:' + code).emit('ludo:started', state);
  });

  socket.on('ludo:state', state => {
    const code = socket.data.ludoRoom, room = code && ludoRooms.get(code);
    if (!room || !room.guest || !room.gameState || !validLudoState(state)) return;
    if (socket.data.ludoSide !== (room.gameState.turn === 0 ? 'host' : 'guest')) return;
    room.gameState = state;
    socket.to('ludo:' + code).emit('ludo:state', state);
  });

  socket.on('ludo:leave', () => {
    const code = socket.data.ludoRoom;
    const room = code && ludoRooms.get(code);
    if (!room) return;
    socket.leave('ludo:' + code);
    if (room.host === socket.id) { io.to('ludo:' + code).emit('ludo:opponent-left'); ludoRooms.delete(code); }
    else if (room.guest === socket.id) { room.guest = null; io.to('ludo:' + code).emit('ludo:players', { ready: false, message: 'Ton adversaire a quitté le salon. En attente d’un autre joueur…' }); }
    socket.data.ludoRoom = null; socket.data.ludoSide = null;
  });


  socket.on('draughts:create', (callback) => {
    const code = makeDraughtsCode();
    const room = { code, host: socket.id, guest: null, hostProfile: null, guestProfile: null, state: null, createdAt: Date.now() };
    draughtsRooms.set(code, room);
    socket.join(code);
    socket.data.draughtsRoom = code;
    socket.data.draughtsSide = 'w';
    if (typeof callback === 'function') callback({ ok: true, code, side: 'w', waiting: true });
  });

  socket.on('draughts:profile', rawProfile => {
    const code = socket.data.draughtsRoom;
    const room = code && draughtsRooms.get(code);
    if (!room) return;
    const profile = rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
    const name = String(profile.name || 'Joueur').trim().replace(/[<>]/g, '').slice(0, 18) || 'Joueur';
    const avatar = ['😀','😎','🦁','🐯','🐼','🐺','🦅','⚽','👑','🇨🇩'].includes(profile.avatar) ? profile.avatar : '😀';
    const safeProfile = { name, avatar };
    if (socket.id === room.host) room.hostProfile = safeProfile;
    else if (socket.id === room.guest) room.guestProfile = safeProfile;
    io.to(code).emit('draughts:players', {
      ready: !!room.guest,
      hostProfile: room.hostProfile,
      guestProfile: room.guestProfile,
      message: room.guest ? 'Les deux joueurs sont connectés. Bonne partie !' : 'Salon créé. En attente du deuxième joueur…'
    });
  });

  socket.on('draughts:join', (rawCode, callback) => {
    const code = String(rawCode || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const room = draughtsRooms.get(code);
    if (!room) {
      if (typeof callback === 'function') callback({ ok: false, error: 'Code introuvable. Vérifie le code de la partie.' });
      return;
    }
    if (room.guest && room.guest !== socket.id) {
      if (typeof callback === 'function') callback({ ok: false, error: 'Cette partie est déjà complète.' });
      return;
    }
    room.guest = socket.id;
    socket.join(code);
    socket.data.draughtsRoom = code;
    socket.data.draughtsSide = 'b';
    if (typeof callback === 'function') callback({ ok: true, code, side: 'b', waiting: false });
    io.to(code).emit('draughts:players', { ready: true, hostProfile: room.hostProfile, guestProfile: room.guestProfile, message: 'Les deux joueurs sont connectés. La partie peut commencer !' });
    if (room.state) socket.emit('draughts:state', room.state);
  });

  function validDraughtsState(state) {
    if (!state || !Array.isArray(state.board) || state.board.length !== 10) return false;
    if (!state.board.every(row => Array.isArray(row) && row.length === 10 && row.every(cell => cell === null || ['w','b','W','B'].includes(cell)))) return false;
    if (!['w','b'].includes(state.turn) || typeof state.gameOver !== 'boolean') return false;
    if (!state.clock || !['w','b'].every(side => Number.isFinite(state.clock[side]) && state.clock[side] >= 0 && state.clock[side] <= 900)) return false;
    return true;
  }

  socket.on('draughts:start', state => {
    const code = socket.data.draughtsRoom;
    const room = code && draughtsRooms.get(code);
    if (!room || room.host !== socket.id || room.state || !validDraughtsState(state)) return;
    room.state = { board: state.board, turn: state.turn, gameOver: state.gameOver, clock: state.clock };
    socket.to(code).emit('draughts:state', room.state);
  });

  socket.on('draughts:rematch', state => {
    const code = socket.data.draughtsRoom;
    const room = code && draughtsRooms.get(code);
    if (!room || !room.guest || !room.state || !room.state.gameOver) return;
    if (!validDraughtsState(state) || state.gameOver) return;
    room.state = {
      board: state.board,
      turn: state.turn,
      gameOver: false,
      clock: state.clock
    };
    io.to(code).emit('draughts:state', room.state);
    io.to(code).emit('draughts:rematch-started');
  });

  socket.on('draughts:move', state => {
    const code = socket.data.draughtsRoom;
    const room = code && draughtsRooms.get(code);
    if (!room || !room.guest || !room.state || !validDraughtsState(state)) return;
    if (socket.data.draughtsSide !== room.state.turn) return;
    room.state = { board: state.board, turn: state.turn, gameOver: state.gameOver, clock: state.clock };
    socket.to(code).emit('draughts:state', room.state);
  });
  socket.on('draughts:leave', () => {
    const code = socket.data.draughtsRoom;
    const room = code && draughtsRooms.get(code);
    if (!room) return;
    socket.leave(code);
    if (room.host === socket.id) {
      io.to(code).emit('draughts:opponent-left');
      draughtsRooms.delete(code);
    } else if (room.guest === socket.id) {
      room.guest = null;
      io.to(code).emit('draughts:opponent-left');
    }
    socket.data.draughtsRoom = null;
    socket.data.draughtsSide = null;
  });

  socket.on('disconnect', () => {
    const ludoCode = socket.data.ludoRoom;
    const ludoRoom = ludoCode && ludoRooms.get(ludoCode);
    if (ludoRoom) {
      if (ludoRoom.host === socket.id) { io.to('ludo:' + ludoCode).emit('ludo:opponent-left'); ludoRooms.delete(ludoCode); }
      else if (ludoRoom.guest === socket.id) { ludoRoom.guest = null; io.to('ludo:' + ludoCode).emit('ludo:players', { ready: false, message: 'Ton adversaire a perdu la connexion. En attente…' }); }
    }

    const code = socket.data.draughtsRoom;
    const room = code && draughtsRooms.get(code);
    if (!room) return;
    if (room.host === socket.id) {
      io.to(code).emit('draughts:opponent-left');
      draughtsRooms.delete(code);
    } else if (room.guest === socket.id) {
      room.guest = null;
      io.to(code).emit('draughts:opponent-left');
    }
  });
});

httpServer.listen(process.env.PORT || 10000, () => {
  console.log("BOPE IA démarré - Total :", visitStats.total);
});
