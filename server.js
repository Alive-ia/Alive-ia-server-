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

// Configuration publique minimale pour le client Supabase du navigateur.
app.get('/api/supabase-config', (req, res) => {
  const url = process.env.SUPABASE_URL || '';
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || '';
  if (!url || !publishableKey) {
    return res.status(503).json({ error: 'Supabase n’est pas encore configuré sur le serveur.' });
  }
  res.set('Cache-Control', 'no-store');
  res.json({ url, publishableKey });
});

// === BOPE CREATEUR : COMPTES ET PUBLICATIONS DE DEMONSTRATION ===
const BOPE_DEMO_ACCOUNTS = [
  { username: 'BOPE_Officiel', display_name: 'BOPE Officiel', bio: 'Compte officiel de BOPE 🇨🇩' },
  { username: 'Kinshasa_Vibes', display_name: 'Kinshasa Vibes', bio: 'La vie à Kinshasa, tous les jours' },
  { username: 'Humour_Congo', display_name: 'Humour Congo', bio: 'Que des fous rires made in Congo 😂' },
  { username: 'Foot_RDC', display_name: 'Foot RDC', bio: 'Tout le foot congolais ici ⚽' },
  { username: 'Cuisine_Kin', display_name: 'Cuisine Kin', bio: 'Pondu, fufu, grillades de Kin' },
  { username: 'Musique_Congo', display_name: 'Musique Congo', bio: 'Ndombolo, rumba, amapiano' }
];
const BOPE_DEMO_EMAIL = username => 'bope-demo+' + username.toLowerCase() + '@example.com';

const BOPE_DEMO_POSTS = [
  { username: 'BOPE_Officiel', type: 'video', content: 'Bienvenue sur BOPE Créateur 🇨🇩. Découvrez les univers congolais !' },
  { username: 'Kinshasa_Vibes', type: 'video', content: 'Kinshasa se réveille : énergie, circulation et vie quotidienne.' },
  { username: 'Humour_Congo', type: 'video', content: 'Le rire congolais, c’est toute une culture 😂' },
  { username: 'Foot_RDC', type: 'video', content: 'Passion football : tous derrière nos Léopards ! ⚽🇨🇩' },
  { username: 'Cuisine_Kin', type: 'video', content: 'Un bon plat congolais, ça rassemble toute la famille.' },
  { username: 'Musique_Congo', type: 'video', content: 'Rumba congolaise : un patrimoine qui fait danser le monde.' },
  { username: 'BOPE_Officiel', type: 'video', content: 'BOPE : une plateforme pensée et construite en RDC.' },
  { username: 'Kinshasa_Vibes', type: 'video', content: 'Les couleurs et les ambiances de la capitale.' },
  { username: 'Foot_RDC', type: 'video', content: 'Le football congolais mérite une grande vitrine.' },
  { username: 'Musique_Congo', type: 'video', content: 'Du ndombolo à l’amapiano : la musique nous unit.' },

  { username: 'Cuisine_Kin', type: 'image', content: 'Pondu, fufu et convivialité : les saveurs de chez nous. 🍲' },
  { username: 'Kinshasa_Vibes', type: 'image', content: 'Un aperçu de la vie urbaine à Kinshasa.' },
  { username: 'BOPE_Officiel', type: 'image', content: 'Fierté congolaise. Made in Kikwit. 🇨🇩' },
  { username: 'Humour_Congo', type: 'image', content: 'Quand la famille congolaise se retrouve 😂' },
  { username: 'Foot_RDC', type: 'image', content: 'Les couleurs des supporters congolais. 🇨🇩⚽' },
  { username: 'Musique_Congo', type: 'image', content: 'La musique congolaise traverse les générations.' },
  { username: 'Cuisine_Kin', type: 'image', content: 'Les grillades : un classique des retrouvailles.' },
  { username: 'Kinshasa_Vibes', type: 'image', content: 'La capitale, ses quartiers et ses habitants.' },
  { username: 'BOPE_Officiel', type: 'image', content: 'BOPE Créateur : bientôt votre espace d’expression.' },
  { username: 'Musique_Congo', type: 'image', content: 'Rumba, seben et ambiance : vive la musique !' },

  { username: 'BOPE_Officiel', type: 'none', style: 'yellow', content: 'Bienvenue dans BOPE Créateur ! Une nouvelle place pour les idées congolaises. 🇨🇩' },
  { username: 'Kinshasa_Vibes', type: 'none', style: 'blue', content: 'Kinshasa, une ville pleine de talents, de courage et de créativité.' },
  { username: 'Humour_Congo', type: 'none', style: 'red', content: 'Ici, on vient pour sourire. 😂' },
  { username: 'Foot_RDC', type: 'none', style: 'default', content: 'Un peuple, une passion : le football ! ⚽' },
  { username: 'Cuisine_Kin', type: 'none', style: 'yellow', content: 'La cuisine de chez nous a toujours une histoire à raconter.' },
  { username: 'Musique_Congo', type: 'none', style: 'blue', content: 'La musique est notre langue commune. 🎶' },
  { username: 'BOPE_Officiel', type: 'none', style: 'red', content: 'Fierté Congolaise. Made in Kikwit. Par Alive Bope.' },
  { username: 'Kinshasa_Vibes', type: 'none', style: 'default', content: 'Partageons les bons côtés de notre belle capitale.' },
  { username: 'Foot_RDC', type: 'none', style: 'yellow', content: 'Les Léopards ont toute une nation derrière eux ! 🇨🇩' },
  { username: 'Cuisine_Kin', type: 'none', style: 'blue', content: 'Pondu, saka-saka, fufu : quel est votre plat préféré ?' },
  { username: 'BOPE_Officiel', type: 'none', style: 'yellow', content: 'Chaque grande idée commence par une petite initiative. Continuons à construire ensemble. 🇨🇩' },
  { username: 'BOPE_Officiel', type: 'none', style: 'blue', content: 'BOPE Créateur donne une place aux voix, aux talents et aux histoires de chez nous.' },
  { username: 'BOPE_Officiel', type: 'none', style: 'red', content: 'La technologie peut aussi grandir depuis nos villes et nos communautés. Fierté congolaise !' },
  { username: 'BOPE_Officiel', type: 'none', style: 'default', content: 'Bienvenue à toutes celles et ceux qui partagent leurs idées sur BOPE. 🤝' },
  { username: 'BOPE_Officiel', type: 'none', style: 'yellow', content: 'Un espace numérique vivant se construit grâce à ses utilisateurs. Merci de faire partie de l’aventure !' },
  { username: 'Kinshasa_Vibes', type: 'none', style: 'blue', content: 'Kinshasa ne dort jamais : chaque rue a son rythme et chaque quartier son histoire. 🌆' },
  { username: 'Kinshasa_Vibes', type: 'none', style: 'red', content: 'Matin animé, marchés ouverts, motos en mouvement… voilà une journée kinoise !' },
  { username: 'Kinshasa_Vibes', type: 'none', style: 'yellow', content: 'Quel endroit de Kinshasa recommanderais-tu à quelqu’un qui visite la ville pour la première fois ?' },
  { username: 'Kinshasa_Vibes', type: 'none', style: 'default', content: 'Derrière l’agitation de la capitale, il y a surtout des personnes courageuses qui travaillent chaque jour.' },
  { username: 'Kinshasa_Vibes', type: 'none', style: 'blue', content: 'La beauté d’une ville se trouve aussi dans l’énergie de ses habitants. ❤️' },
  { username: 'Humour_Congo', type: 'none', style: 'yellow', content: 'Quand maman dit « viens seulement », tu sais que la réunion familiale est déjà convoquée. 😂' },
  { username: 'Humour_Congo', type: 'none', style: 'red', content: 'Le Congolais qui dit « j’arrive » peut encore être en train de chercher ses chaussures. 😅' },
  { username: 'Humour_Congo', type: 'none', style: 'blue', content: 'Quand le courant revient juste au moment où tu avais fini de te plaindre… merci Seigneur ! 😂' },
  { username: 'Humour_Congo', type: 'none', style: 'default', content: 'Dans chaque famille, il y a une personne qui connaît toutes les nouvelles avant tout le monde. Qui est-ce chez vous ?' },
  { username: 'Humour_Congo', type: 'none', style: 'yellow', content: 'Tu as faim, mais tu attends qu’on t’invite à manger pour dire que tu n’as pas encore mangé. 😄' },
  { username: 'Foot_RDC', type: 'none', style: 'blue', content: 'Le football rassemble les quartiers, les générations et les amis. Vive le sport ! ⚽' },
  { username: 'Foot_RDC', type: 'none', style: 'yellow', content: 'Quel est ton meilleur souvenir lié aux Léopards de la RDC ? 🇨🇩' },
  { username: 'Foot_RDC', type: 'none', style: 'red', content: 'Un match se joue à onze, mais le soutien de tout un peuple donne une force particulière.' },
  { username: 'Foot_RDC', type: 'none', style: 'default', content: 'Respect aux jeunes talents qui s’entraînent chaque jour pour atteindre leurs rêves.' },
  { username: 'Foot_RDC', type: 'none', style: 'blue', content: 'Débat du jour : tu préfères un but à la dernière minute ou une victoire maîtrisée ?' },
  { username: 'Cuisine_Kin', type: 'none', style: 'yellow', content: 'Le secret d’un bon repas, c’est aussi le plaisir de le partager avec ceux qu’on aime. 🍲' },
  { username: 'Cuisine_Kin', type: 'none', style: 'red', content: 'Pondu bien préparé ou saka-saka : lequel accompagne le mieux ton fufu ?' },
  { username: 'Cuisine_Kin', type: 'none', style: 'blue', content: 'Une bonne sauce arachide rappelle souvent les repas chaleureux en famille.' },
  { username: 'Cuisine_Kin', type: 'none', style: 'default', content: 'À chacun sa touche en cuisine : quelles épices rendent ton plat inoubliable ?' },
  { username: 'Cuisine_Kin', type: 'none', style: 'yellow', content: 'Poisson braisé, chikwangue et piment : qui valide cette assiette ? 😋' },
  { username: 'Musique_Congo', type: 'none', style: 'blue', content: 'La rumba congolaise raconte des histoires et fait voyager nos émotions. 🎶' },
  { username: 'Musique_Congo', type: 'none', style: 'red', content: 'Un bon seben et la piste de danse se réveille ! Qui aime cette ambiance ?' },
  { username: 'Musique_Congo', type: 'none', style: 'yellow', content: 'Quelle chanson congolaise peux-tu écouter plusieurs fois sans te fatiguer ?' },
  { username: 'Musique_Congo', type: 'none', style: 'default', content: 'Des voix légendaires aux nouveaux talents, notre musique continue d’évoluer.' },
  { username: 'Musique_Congo', type: 'none', style: 'blue', content: 'Rumba, ndombolo, gospel ou amapiano : quelle ambiance accompagne ta journée ? 🎧' }
];

function bopeDemoSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configuration Supabase administrateur manquante sur Render.');
  return { url: url.replace(/\/+$/, ''), key };
}

async function bopeDemoRequest(route, options) {
  const cfg = bopeDemoSupabaseConfig();
  const response = await fetch(cfg.url + route, {
    ...options,
    headers: {
      apikey: cfg.key,
      Authorization: 'Bearer ' + cfg.key,
      'Content-Type': 'application/json',
      ...(options && options.headers ? options.headers : {})
    }
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = raw; }
  if (!response.ok) {
    const message = data && (data.message || data.msg || data.error_description || data.error);
    throw new Error('Supabase HTTP ' + response.status + (message ? ' : ' + String(message).slice(0, 250) : '.'));
  }
  return data;
}

function bopeDemoAuthorized(req) {
  const expected = process.env.BOPE_DEMO_ADMIN_KEY || '';
  const supplied = req.get('x-bope-demo-key') || '';
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && require('crypto').timingSafeEqual(a, b);
}

async function bopeDemoListUsers() {
  const data = await bopeDemoRequest('/auth/v1/admin/users?page=1&per_page=1000', { method: 'GET' });
  return Array.isArray(data && data.users) ? data.users : (Array.isArray(data) ? data : []);
}

async function bopeDemoEnsureAccounts() {
  let users = await bopeDemoListUsers();
  const result = [];
  for (const account of BOPE_DEMO_ACCOUNTS) {
    const email = BOPE_DEMO_EMAIL(account.username);
    let user = users.find(item => String(item.email || '').toLowerCase() === email.toLowerCase());
    if (user && !(user.app_metadata && user.app_metadata.bope_demo === true)) {
      throw new Error('Adresse de démonstration déjà utilisée par un compte non identifié comme démo : ' + email);
    }
    if (!user) {
      const created = await bopeDemoRequest('/auth/v1/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password: require('crypto').randomBytes(32).toString('hex'),
          email_confirm: true,
          user_metadata: { display_name: account.display_name, username: account.username, bope_demo: true },
          app_metadata: { bope_demo: true, bope_demo_batch: 'bope-createur-v1' }
        })
      });
      user = created && created.user ? created.user : created;
      if (!user || !user.id) throw new Error('Supabase n’a pas retourné l’identifiant du compte ' + account.username + '.');
      users.push(user);
    }
    result.push({ ...account, id: user.id });
  }

  const profiles = result.map(account => ({
    id: account.id,
    username: account.username,
    display_name: account.display_name,
    bio: account.bio,
    account_type: 'personal'
  }));
  await bopeDemoRequest('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(profiles)
  });
  return result;
}


// Téléversement sécurisé et idempotent de médias vers les comptes de démonstration BOPE.
app.post('/api/bope-demo/upload', express.raw({ type: 'application/octet-stream', limit: '50mb' }), async (req, res) => {
  if (!bopeDemoAuthorized(req)) return res.status(403).json({ ok: false, message: 'Code administrateur incorrect.' });
  const username = String(req.query.account || '');
  const account = BOPE_DEMO_ACCOUNTS.find(item => item.username === username);
  const mime = String(req.get('x-media-type') || '').toLowerCase();
  const uploadId = String(req.get('x-upload-id') || '');
  const allowed = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  if (!account) return res.status(400).json({ ok: false, message: 'Choisis un compte BOPE valide.' });
  if (!allowed[mime]) return res.status(400).json({ ok: false, message: 'Format refusé. Utilise MP4, WEBM, JPG, PNG ou WEBP.' });
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(uploadId)) return res.status(400).json({ ok: false, message: 'Identifiant de transfert invalide.' });
  if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ ok: false, message: 'Fichier vide ou non reçu.' });
  try {
    const accounts = await bopeDemoEnsureAccounts();
    const target = accounts.find(item => item.username === username);
    if (!target) throw new Error('Compte BOPE démo introuvable.');
    const safeName = String(req.get('x-file-name') || 'media').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 70) || 'media';
    const baseName = safeName.replace(/\.[^.]+$/, '').slice(0, 55) || 'media';
    const fileName = 'demo-' + uploadId + '-' + baseName + '.' + allowed[mime];
    const encodedPath = (target.id + '/' + fileName).split('/').map(encodeURIComponent).join('/');
    const cfg = bopeDemoSupabaseConfig();
    const mediaUrl = cfg.url + '/storage/v1/object/public/bope-posts/' + encodedPath;
    const existing = await bopeDemoRequest('/rest/v1/bope_posts?media_url=eq.' + encodeURIComponent(mediaUrl) + '&select=id&limit=1', { method: 'GET' });
    if (Array.isArray(existing) && existing[0]) return res.json({ ok: true, alreadyPublished: true, account: account.display_name, mediaUrl, postId: existing[0].id });
    await bopeDemoRequest('/storage/v1/object/bope-posts/' + encodedPath, { method: 'POST', headers: { 'Content-Type': mime, 'x-upsert': 'true' }, body: req.body });
    const caption = String(req.query.caption || '').trim().slice(0, 1000) || baseName.replace(/[-_]+/g, ' ');
    const post = { author_id: target.id, content: caption, media_url: mediaUrl, media_type: mime.startsWith('video/') ? 'video' : 'image', background_style: 'default' };
    const created = await bopeDemoRequest('/rest/v1/bope_posts', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(post) });
    return res.json({ ok: true, account: account.display_name, mediaType: post.media_type, mediaUrl, postId: Array.isArray(created) && created[0] ? created[0].id : null });
  } catch (error) { console.error('BOPE demo media upload:', error.message); return res.status(500).json({ ok: false, message: error.message }); }
});

app.get('/bope-demo-admin', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.type('html').send([
    '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Administration BOPE Créateur</title><style>body{font-family:Arial,sans-serif;background:#101820;color:#fff;margin:0;padding:24px}main{max-width:520px;margin:30px auto;background:#1d2a35;padding:22px;border-radius:16px}h1{font-size:23px}p{line-height:1.5;color:#d5dde3}input,button{box-sizing:border-box;width:100%;padding:14px;border-radius:9px;margin:8px 0;font-size:15px}input{border:1px solid #52616d;background:#101820;color:#fff}button{border:0;background:#18a56b;color:#fff;font-weight:bold}button.danger{background:#bd3d45}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#101820;padding:12px;border-radius:8px}</style></head><body>',
    '<main><h1>BOPE Créateur — Administration démo</h1><p>Cette page sert uniquement à remplir ou vider les comptes de démonstration. Tes comptes personnels et leurs publications ne sont pas ciblés.</p>',
    '<label for="secret">Code secret administrateur</label><input id="secret" type="password" autocomplete="off" placeholder="Entre ton code secret Render">',
    '<section style="margin-top:22px;padding-top:16px;border-top:1px solid #52616d"><h2 style="font-size:19px">Ajouter des photos et vidéos</h2><p>Choisis le compte, sélectionne plusieurs fichiers et BOPE les publiera automatiquement. Formats : MP4, WEBM, JPG, PNG, WEBP. Limite : 50 Mo par fichier.</p><label for="account">Compte de destination</label><select id="account" style="box-sizing:border-box;width:100%;padding:14px;border-radius:9px;margin:8px 0;background:#101820;color:#fff;border:1px solid #52616d"><option value="Humour_Congo">Humour Congo</option><option value="BOPE_Officiel">BOPE Officiel</option><option value="Kinshasa_Vibes">Kinshasa Vibes</option><option value="Foot_RDC">Foot RDC</option><option value="Cuisine_Kin">Cuisine Kin</option><option value="Musique_Congo">Musique Congo</option></select><label for="caption">Légende (facultative, commune aux fichiers)</label><input id="caption" type="text" maxlength="1000" placeholder="Ex. Un moment drôle 😂"><label for="media">Photos ou vidéos (sélection multiple)</label><input id="media" type="file" multiple accept="video/mp4,video/webm,image/jpeg,image/png,image/webp"><button id="upload">Publier les fichiers sélectionnés</button><progress id="uploadProgress" max="100" value="0" style="display:none;width:100%;height:14px;margin:8px 0;accent-color:#18a56b"></progress><div id="uploadProgressText" style="font-size:13px;color:#d5dde3;min-height:18px"></div></section><button id="fill">Remplir le feed démo (6 comptes, 30 publications)</button><button id="remove" class="danger">Supprimer les comptes démo</button><pre id="result">En attente d’une action.</pre></main>',
    '<script>',
    'const secret=document.getElementById("secret"),result=document.getElementById("result");',
    'async function run(path,button){if(!secret.value){result.textContent="Entre d’abord ton code secret.";return;}button.disabled=true;result.textContent="Opération en cours…";try{const r=await fetch(path,{method:"POST",headers:{"x-bope-demo-key":secret.value},cache:"no-store"});const d=await r.json().catch(()=>({message:"Réponse illisible."}));result.textContent="HTTP "+r.status+"\\n"+JSON.stringify(d,null,2);}catch(e){result.textContent="Erreur réseau : "+e.message;}finally{button.disabled=false;}}',
    "function uploadDemoFile(file,url,headers,uploadId,onProgress){return new Promise((resolve,reject)=>{const xhr=new XMLHttpRequest();xhr.open(\"POST\",url);xhr.timeout=180000;Object.entries(headers).forEach(([key,value])=>xhr.setRequestHeader(key,value));xhr.setRequestHeader(\"x-upload-id\",uploadId);xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};xhr.onload=()=>{let data={};try{data=JSON.parse(xhr.responseText||\"{}\");}catch(e){}if(xhr.status>=200&&xhr.status<300&&data.ok)resolve(data);else{const error=new Error(data.message||(\"HTTP \"+xhr.status));error.status=xhr.status;reject(error);}};xhr.onerror=()=>{const error=new Error(\"Connexion interrompue.\");error.status=0;reject(error);};xhr.ontimeout=()=>{const error=new Error(\"Délai réseau dépassé.\");error.status=0;reject(error);};xhr.onabort=()=>{const error=new Error(\"Envoi interrompu.\");error.status=0;reject(error);};xhr.send(file);});}",
    "document.getElementById(\"upload\").addEventListener(\"click\",async function(){const files=Array.from(document.getElementById(\"media\").files||[]);if(!secret.value){result.textContent=\"Entre d’abord ton code secret.\";return;}if(!files.length){result.textContent=\"Sélectionne au moins un fichier.\";return;}this.disabled=true;const account=document.getElementById(\"account\").value;const caption=document.getElementById(\"caption\").value;const progress=document.getElementById(\"uploadProgress\");const progressText=document.getElementById(\"uploadProgressText\");progress.style.display=\"block\";progress.value=0;let done=0;let failed=0;const errors=[];for(let index=0;index<files.length;index++){const file=files[index];progress.value=0;progressText.textContent=\"Préparation : \"+file.name;result.textContent=\"Envoi \"+(index+1)+\"/\"+files.length+\" : \"+file.name+\"\\nNe ferme pas cette page.\";try{if(file.size>50*1024*1024)throw new Error(\"Fichier supérieur à 50 Mo.\");if(![\"video/mp4\",\"video/webm\",\"image/jpeg\",\"image/png\",\"image/webp\"].includes(file.type))throw new Error(\"Format non accepté.\");const url=\"/api/bope-demo/upload?account=\"+encodeURIComponent(account)+\"&caption=\"+encodeURIComponent(caption);const uploadId=(window.crypto&&crypto.randomUUID)?crypto.randomUUID().replace(/-/g,\"\"):(\"bope\"+Date.now()+Math.random().toString(36).slice(2));const headers={\"x-bope-demo-key\":secret.value,\"Content-Type\":\"application/octet-stream\",\"x-media-type\":file.type,\"x-file-name\":file.name};let published=false;let lastError=null;for(let attempt=1;attempt<=3&&!published;attempt++){try{progressText.textContent=file.name+\" — tentative \"+attempt+\"/3\";await uploadDemoFile(file,url,headers,uploadId,pct=>{progress.value=pct;progressText.textContent=file.name+\" — \"+pct+\"% (tentative \"+attempt+\"/3)\";});published=true;done++;}catch(error){lastError=error;if(error.status&&error.status>=400&&error.status<500&&error.status!==408&&error.status!==429)break;if(attempt<3){progressText.textContent=\"Connexion instable : nouvelle tentative pour \"+file.name+\"…\";await new Promise(resolve=>setTimeout(resolve,1200*attempt));}}}if(!published)throw lastError||new Error(\"Échec de l’envoi.\");}catch(e){failed++;errors.push(file.name+\" : \"+e.message);}progressText.textContent=\"Fichiers traités : \"+(index+1)+\"/\"+files.length+\" — réussis : \"+done+\" — échecs : \"+failed;}result.textContent=\"Terminé : \"+done+\"/\"+files.length+\" fichier(s) publié(s) sur \"+account+(errors.length?\"\\nFichiers non envoyés :\\n\"+errors.join(\"\\n\"):\"\");if(!errors.length)progress.value=100;this.disabled=false;});",
    'document.getElementById("fill").addEventListener("click",function(){run("/api/bope-demo/fill",this);});',
    'document.getElementById("remove").addEventListener("click",function(){if(confirm("Supprimer uniquement les 6 comptes et leurs publications de démonstration ?"))run("/api/bope-demo/remove",this);});',
    '</script></body></html>'
  ].join('\n'));
});

app.post('/api/bope-demo/fill', async (req, res) => {
  if (!bopeDemoAuthorized(req)) return res.status(403).json({ ok: false, message: 'Code administrateur incorrect.' });
  try {
    const accounts = await bopeDemoEnsureAccounts();
    const ids = accounts.map(account => account.id);
    const inFilter = '(' + ids.join(',') + ')';
    const existing = await bopeDemoRequest(
      '/rest/v1/bope_posts?author_id=in.' + encodeURIComponent(inFilter) +
      '&select=author_id,content,media_url,media_type,background_style&limit=10000',
      { method: 'GET' }
    );
    if (!Array.isArray(existing)) throw new Error('Impossible de vérifier les publications déjà présentes.');

    // Une publication modèle n'est ajoutée que si son contenu exact n'existe pas déjà.
    // Les publications existantes ne sont jamais supprimées ni modifiées.
    const postKey = post => JSON.stringify([
      post.author_id,
      post.content,
      post.media_type,
      post.background_style,
      post.media_url
    ]);
    const existingKeys = new Set(existing.map(postKey));

    const now = Date.now();
    const candidates = BOPE_DEMO_POSTS.map((post, index) => {
      const author = accounts.find(account => account.username === post.username);
      return {
        author_id: author.id,
        content: post.content,
        media_url: null,
        media_type: post.type,
        background_style: post.type === 'none' ? (post.style || 'default') : 'default',
        created_at: new Date(now - (BOPE_DEMO_POSTS.length - index) * 5 * 60 * 60 * 1000).toISOString()
      };
    });
    const posts = candidates.filter(post => !existingKeys.has(postKey(post)));

    if (posts.length) {
      await bopeDemoRequest('/rest/v1/bope_posts', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(posts)
      });
    }
    return res.json({
      ok: true,
      accountsCreatedOrVerified: accounts.length,
      publicationsCreated: posts.length,
      publicationsAlreadyPresent: candidates.length - posts.length,
      publicationsPreserved: existing.length,
      note: 'Aucune publication existante n’a été supprimée ou modifiée. Seules les publications modèles manquantes ont été ajoutées. Les médias personnels déjà publiés sont conservés.'
    });
  } catch (error) {
    console.error('BOPE demo fill:', error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

app.post('/api/bope-demo/remove', async (req, res) => {
  if (!bopeDemoAuthorized(req)) return res.status(403).json({ ok: false, message: 'Code administrateur incorrect.' });
  try {
    const users = await bopeDemoListUsers();
    const emails = new Set(BOPE_DEMO_ACCOUNTS.map(account => BOPE_DEMO_EMAIL(account.username).toLowerCase()));
    const demoUsers = users.filter(user =>
      emails.has(String(user.email || '').toLowerCase()) &&
      user.app_metadata && user.app_metadata.bope_demo === true &&
      user.app_metadata.bope_demo_batch === 'bope-createur-v1'
    );
    const ids = demoUsers.map(user => user.id);
    if (ids.length) {
      await bopeDemoRequest('/rest/v1/bope_posts?author_id=in.' + encodeURIComponent('(' + ids.join(',') + ')'), {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      });
    }
    for (const user of demoUsers) {
      await bopeDemoRequest('/auth/v1/admin/users/' + encodeURIComponent(user.id), { method: 'DELETE' });
    }
    return res.json({
      ok: true,
      demoAccountsDeleted: demoUsers.length,
      demoPostsDeletedForThoseAccounts: ids.length > 0,
      note: 'Seuls les comptes BOPE démo marqués par ce module ont été supprimés. Les comptes personnels ne sont pas ciblés.'
    });
  } catch (error) {
    console.error('BOPE demo remove:', error.message);
    return res.status(500).json({ ok: false, message: error.message });
  }
});

// === FIN BOPE CREATEUR DEMO ===

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

// Lien BOPE CRÉATEURS : ouvre la page BOPE sur une publication précise.
app.get('/publication/:id', (req, res) => {
  const postId = String(req.params.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(postId)) {
    return res.status(404).type('text').send('Publication BOPE introuvable.');
  }
  const indexPath = path.join(__dirname, 'public', 'index.html');
  const page = fs.readFileSync(indexPath, 'utf8')
    .replace('__VISIT_TOTAL__', String(visitStats.total))
    .replace('__VISIT_TODAY__', String(visitStats.today));
  res.set('Cache-Control', 'no-store');
  res.type('html').send(page);
});

// Sert les ressources statiques du dossier public après les routes BOPE.
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
