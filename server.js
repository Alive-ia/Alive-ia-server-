const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

  res.type('html').send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#000000"><title>BOPE IA - Made in Kikwit</title><style>
  *{box-sizing:border-box}body{margin:0;background:#000;color:#fff;font-family:Arial,sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh}h1{margin:0}#chat{width:92%;max-width:440px;flex:1;overflow-y:auto;margin:12px 0 180px;padding:14px;display:flex;flex-direction:column;gap:14px}.msg{padding:12px 16px;border-radius:18px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:15px;line-height:1.7}.user{background:#2f4f8a;align-self:flex-end;max-width:90%}.bot{background:#151515;border:1px solid #222;align-self:flex-start;max-width:100%}.share-btn{margin-top:8px;background:#222;border:1px solid #333;color:#25D366;padding:4px 10px;border-radius:20px;font-size:11px;cursor:pointer}.box{position:fixed;bottom:0;left:0;right:0;background:#000;padding:10px;display:flex;flex-direction:column;align-items:center;border-top:1px solid #1a1a1a;z-index:2}.in{width:92%;max-width:440px;background:#1e1e1e;border-radius:28px;display:flex;align-items:center;padding:8px 14px}.in input{flex:1;min-width:0;background:transparent;border:none;outline:none;color:#fff;font-size:16px}.in button{background:#3a5fd0;border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer}.modes{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;justify-content:center}.modes button{background:#222;color:#888;border:1px solid #333;padding:6px 11px;border-radius:20px;font-size:11px}.modes button.active{background:#3a5fd0;color:#fff;border-color:#3a5fd0}.sante-box{display:none;width:92%;max-width:440px;background:#151515;border:1px solid #333;border-radius:12px;padding:10px;margin-bottom:8px;gap:6px}.sante-box.show{display:flex;flex-wrap:wrap}.sante-box input{background:#222;border:1px solid #333;color:#fff;border-radius:8px;padding:6px 8px;width:30%;font-size:12px}.sante-box input.wide{width:62%}#welcome{width:92%;max-width:440px;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 0 0}.quick{width:100%;background:#121212;border:1px solid #2a2a2a;color:#e0e0e0;padding:14px;border-radius:14px;font-size:13.5px;text-align:left;cursor:pointer;display:flex;gap:10px;align-items:center}.quick:hover{background:#1c1c1c;border-color:#3a5fd0}.quick span{font-size:18px}.logo-top{width:44px;height:44px;border-radius:50%;border:2px solid #3a5fd0;box-shadow:0 0 12px rgba(58,95,208,.5)}.logo-center{width:96px;height:96px;border-radius:50%;border:3px solid #3a5fd0;box-shadow:0 0 20px rgba(58,95,208,.7)}

  /* Nouvelle interface BOPE inspirée des assistants conversationnels */
  body{align-items:stretch}
  .topbar{position:sticky;top:0;width:100%;z-index:5;background:#080808;border-bottom:1px solid #222;padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
  .top-left,.top-actions{display:flex;align-items:center;gap:10px}
  .icon-btn{width:40px;height:40px;border:1px solid #333;border-radius:14px;background:#191919;color:#fff;font-size:20px;cursor:pointer}
  .brand-mini{font-weight:700;letter-spacing:.3px}
  #sideMenu{position:fixed;inset:0 auto 0 0;width:min(82vw,310px);background:#111;border-right:1px solid #333;z-index:20;padding:18px;transform:translateX(-105%);transition:transform .22s ease;display:flex;flex-direction:column;gap:12px;box-shadow:12px 0 35px #0009}
  #sideMenu.open{transform:translateX(0)}
  #menuShade{display:none;position:fixed;inset:0;background:#0009;z-index:19}
  #menuShade.show{display:block}
  .menu-action{width:100%;padding:12px;border-radius:12px;background:#202020;border:1px solid #333;color:#fff;text-align:left;font-size:14px;cursor:pointer}
  #historyList{overflow:auto;display:flex;flex-direction:column;gap:7px}
  .history-item{background:#181818;border:1px solid #292929;color:#ddd;border-radius:10px;padding:10px;text-align:left;font-size:13px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #chat{width:100%;max-width:760px;margin:12px auto 175px;padding:14px 18px}
  #welcome{width:100%;max-width:760px}
  .box{padding:10px 14px 12px}
  .composer{width:100%;max-width:760px;background:#1b1b1b;border:1px solid #393939;border-radius:25px;display:flex;flex-direction:column;gap:7px;padding:9px 10px}.composer-main{width:100%;display:flex;align-items:flex-end;gap:8px}#imagePreview{display:none;width:100%;align-items:center;gap:10px;padding:2px 5px 7px}#imagePreview.show{display:flex}#imagePreview img{width:58px;height:58px;object-fit:cover;border-radius:10px;border:1px solid #555}#imagePreview .preview-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#bbb;font-size:12px}#imagePreview .remove-image{width:30px;height:30px;border:0;border-radius:50%;background:#333;color:#fff;font-size:18px;cursor:pointer}
  .composer-main textarea{flex:1;min-width:0;max-height:180px;min-height:26px;resize:none;overflow-y:auto;background:transparent;border:0;outline:0;color:#fff;font:16px/1.45 Arial,sans-serif;padding:5px 2px}
  .composer-main .tool-btn{flex:0 0 36px;width:36px;height:36px;border:0;border-radius:50%;background:#292929;color:#eee;font-size:19px;cursor:pointer}
  .composer-main .send-btn{background:#3a5fd0;font-weight:bold}
  .composer .tool-btn:disabled{opacity:.45}
  @media(min-width:700px){.box{padding-bottom:18px}}
  </style></head><body>

  <div class="topbar">
    <div class="top-left"><button class="icon-btn" onclick="toggleMenu()" aria-label="Ouvrir le menu">☰</button><span class="brand-mini">🇨🇩 BOPE IA</span></div>
    <div class="top-actions"><button class="icon-btn" onclick="newConversation()" aria-label="Nouvelle conversation">✎</button></div>
  </div>
  <div id="menuShade" onclick="toggleMenu(false)"></div>
  <aside id="sideMenu" aria-label="Menu BOPE">
    <div style="display:flex;justify-content:space-between;align-items:center"><strong>Menu BOPE IA</strong><button class="icon-btn" onclick="toggleMenu(false)">×</button></div>
    <button class="menu-action" onclick="newConversation()">＋ Nouvelle conversation</button>
    <button class="menu-action" onclick="focusHistorySearch()">⌕ Rechercher une conversation</button>
    <input id="historySearch" placeholder="Rechercher dans l'historique..." oninput="renderHistory()" style="display:none;background:#202020;border:1px solid #444;border-radius:10px;padding:10px;color:white">
    <div style="color:#999;font-size:12px;margin-top:8px">Historique</div>
    <div id="historyList"></div>
    <div style="margin-top:auto;color:#777;font-size:11px">BOPE IA • Made in Kikwit 🇨🇩</div>
  </aside>
  <div style="display:flex;align-items:center;gap:12px;margin:18px 0 2px"><svg class="logo-top" viewBox="0 0 100 100" style="background:#0a0a0a"><circle cx="50" cy="50" r="46" fill="none" stroke="#0085CA" stroke-width="7" stroke-dasharray="95 190"/><circle cx="50" cy="50" r="46" fill="none" stroke="#FFD100" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-95"/><circle cx="50" cy="50" r="46" fill="none" stroke="#EF3340" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-142"/><g transform="translate(22,20) scale(0.56)"><path d="M50 10 C18 2 0 28 15 48 C4 66 26 86 50 82 C74 86 96 66 85 48 C100 28 82 2 50 10 Z" fill="none" stroke="white" stroke-width="4"/><path d="M42 36 H58 V44 H66 V58 H58 V66 H42 V58 H34 V44 H42 Z" fill="none" stroke="#FFD100" stroke-width="4"/></g></svg><h1>BOPE IA</h1></div>
  <div style="color:#FFD100;font-size:13px;font-weight:bold;letter-spacing:.5px;margin-bottom:4px">🇨🇩 Made in Kikwit • Fierté Congolaise</div>
  <div style="color:#888;font-size:13px;display:flex;gap:8px;align-items:center;justify-content:center;flex-wrap:wrap"><span>par alive bope • IA Congolaise • Made in Kikwit</span><button onclick="partagerBOPE()" style="background:#25D366;color:#fff;border:none;padding:5px 12px;border-radius:20px;font-size:11px;cursor:pointer">↗️ Partager BOPE</button></div>
  <div style="background:#111;border:1px solid #FFD100;border-radius:20px;padding:5px 14px;font-size:11px;color:#FFD100;margin:6px 0 10px">👁️ ${visitStats.total} visites • 🔥 ${visitStats.today} aujourd'hui • 🇨🇩 Made in Kikwit</div>
  <div id="welcome"><svg class="logo-center" viewBox="0 0 100 100" style="background:#0a0a0a"><circle cx="50" cy="50" r="46" fill="none" stroke="#0085CA" stroke-width="7" stroke-dasharray="95 190"/><circle cx="50" cy="50" r="46" fill="none" stroke="#FFD100" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-95"/><circle cx="50" cy="50" r="46" fill="none" stroke="#EF3340" stroke-width="7" stroke-dasharray="47 237" stroke-dashoffset="-142"/><g transform="translate(20,16) scale(0.62)"><path d="M50 12 C18 4 0 28 15 48 C4 66 26 86 50 82 C74 86 96 66 85 48 C100 28 82 4 50 12 Z" fill="none" stroke="white" stroke-width="4"/><path d="M30 28 L14 28 M30 36 L10 36 M30 46 L14 46 M30 56 L16 56" stroke="#0085CA" stroke-width="2.6" stroke-linecap="round"/><path d="M70 28 L86 28 M70 36 L90 36 M70 46 L86 46 M70 56 L84 56" stroke="#EF3340" stroke-width="2.6" stroke-linecap="round"/><path d="M42 38 H58 V46 H66 V58 H58 V66 H42 V58 H34 V46 H42 Z" fill="none" stroke="#FFD100" stroke-width="3.8"/></g><text x="50" y="94" text-anchor="middle" fill="white" font-size="13" font-weight="bold" font-family="sans-serif">BOPE</text></svg>
  <h2 style="margin:14px 0 6px">Que veux-tu faire?</h2><p style="color:#666;font-size:13px;margin:0 0 20px">Demande à BOPE, ton IA congolaise</p><div style="display:flex;flex-direction:column;gap:10px;width:100%"><button class="quick" onclick="quickAsk('Je m\\'appelle')"><span>👋</span> Je m'appelle...</button><button class="quick" onclick="quickAsk('Explique-moi la fièvre typhoïde')"><span>🩺</span> Expliquer une maladie</button><button class="quick" onclick="quickAsk('Actualités RDC aujourd\\'hui')"><span>📰</span> Actualités RDC du jour</button></div></div>
  <div id="chat"></div><div class="box"><div class="modes"><button id="mCourt" class="active" onclick="setMode('court')">Court</button><button id="mDetail" onclick="setMode('detail')">Détaillé</button><button id="mSante" onclick="setMode('sante')">🩺 Santé</button></div>
  <div id="santeBox" class="sante-box"><input id="temp" placeholder="Temp °C ex 38.5"><input id="tension" placeholder="Tension ex 14/9"><input id="pouls" placeholder="Pouls ex 90"><input id="poids" placeholder="Poids kg ex 65" class="wide"><input id="sympt" placeholder="Symptômes ex brûlure urine" class="wide" style="width:100%"><button onclick="fillSante()" style="background:#3a5fd0;color:#fff;border:none;padding:6px 12px;border-radius:8px;width:100%">Ajouter au message</button></div>
  <div class="composer">
    <div id="imagePreview"><img id="imagePreviewThumb" alt="Aperçu de l’image"><span class="preview-name" id="imagePreviewName"></span><button class="remove-image" type="button" onclick="removeAttachment()">×</button></div>
    <div class="composer-main">
    <button class="tool-btn" onclick="document.getElementById('fileAttach').click()" title="Joindre un fichier" aria-label="Joindre un fichier">＋</button>
    <textarea id="input" rows="1" placeholder="Écris à BOPE..." aria-label="Ton message"></textarea>
    <input id="fileAttach" type="file" accept="image/jpeg,image/png,image/webp" style="display:none" onchange="showAttachment(this)">
    <button class="tool-btn" onclick="startVoiceInput()" title="Dicter un message" aria-label="Dicter un message">🎙</button>
    <button class="tool-btn send-btn" id="sendButton" onclick="send()" title="Envoyer" aria-label="Envoyer">↑</button>
    </div>
  </div>
  <div id="attachmentInfo" style="display:none;color:#aaa;font-size:11px;max-width:760px;margin-top:5px"></div><div style="font-size:10px;color:#777;margin-top:7px;text-align:center">⚠️ BOPE Santé 85% = orientation étudiant UNIKIK, pas médecin<br>🇨🇩 Fierté de Kikwit, Kwilu • 100% Made in Congo • bopealive@gmail.com</div></div>
  <script>

  let MODE='court';
  let currentConversationId = null;
  let conversations = [];
  try { conversations = JSON.parse(localStorage.getItem('bope_conversations') || '[]'); } catch(e) { conversations = []; }
  function saveConversations(){try{localStorage.setItem('bope_conversations',JSON.stringify(conversations.slice(0,40)));}catch(e){}}
  function toggleMenu(force){const menu=document.getElementById('sideMenu'),shade=document.getElementById('menuShade');const open=typeof force==='boolean'?force:!menu.classList.contains('open');menu.classList.toggle('open',open);shade.classList.toggle('show',open);if(open)renderHistory();}
  function focusHistorySearch(){const el=document.getElementById('historySearch');el.style.display='block';el.focus();}
  function renderHistory(){const list=document.getElementById('historyList'),q=(document.getElementById('historySearch').value||'').toLowerCase();list.innerHTML='';conversations.filter(c=>(c.title||'').toLowerCase().includes(q)).forEach(c=>{const b=document.createElement('button');b.className='history-item';b.textContent=c.title||'Nouvelle conversation';b.onclick=()=>loadConversation(c.id);list.appendChild(b);});if(!list.children.length){const p=document.createElement('div');p.style.cssText='color:#777;font-size:12px;padding:8px';p.textContent='Aucune conversation enregistrée.';list.appendChild(p);}}
  function newConversation(){currentConversationId=null;document.getElementById('chat').innerHTML='';const w=document.getElementById('welcome');if(w)w.style.display='flex';document.getElementById('input').value='';resizeComposer();toggleMenu(false);}
  function loadConversation(id){const c=conversations.find(x=>x.id===id);if(!c)return;currentConversationId=id;const chat=document.getElementById('chat');chat.innerHTML='';const w=document.getElementById('welcome');if(w)w.style.display='none';(c.messages||[]).forEach(m=>{const el=document.createElement('div');el.className='msg '+(m.role==='user'?'user':'bot');el.textContent=m.content;chat.appendChild(el);});toggleMenu(false);chat.scrollTop=chat.scrollHeight;}
  function saveMessage(role,content){if(!currentConversationId){currentConversationId=String(Date.now());conversations.unshift({id:currentConversationId,title:content.slice(0,48),messages:[]});}const c=conversations.find(x=>x.id===currentConversationId);if(c){c.messages.push({role,content});saveConversations();}}
  function resizeComposer(){const el=document.getElementById('input');el.style.height='auto';el.style.height=Math.min(el.scrollHeight,180)+'px';}
  let selectedImageData=null,selectedImageMime=null,selectedImageName=null;
  function showAttachment(input){const f=input.files&&input.files[0],info=document.getElementById('attachmentInfo');selectedImageData=null;selectedImageMime=null;selectedImageName=null;if(!f){info.style.display='none';return;}if(!['image/jpeg','image/png','image/webp'].includes(f.type)){info.style.display='block';info.textContent='Format non pris en charge. Choisis une image JPG, PNG ou WEBP.';input.value='';return;}if(f.size>6*1024*1024){info.style.display='block';info.textContent='Image trop volumineuse. Taille maximale : 6 Mo.';input.value='';return;}const reader=new FileReader();reader.onload=()=>{selectedImageData=reader.result;selectedImageMime=f.type;selectedImageName=f.name;document.getElementById('imagePreviewThumb').src=reader.result;document.getElementById('imagePreviewName').textContent=f.name;document.getElementById('imagePreview').classList.add('show');info.style.display='none';};reader.onerror=()=>{info.style.display='block';info.textContent='Impossible de lire cette image.';};reader.readAsDataURL(f);}

  function removeAttachment(){selectedImageData=null;selectedImageMime=null;selectedImageName=null;document.getElementById('imagePreview').classList.remove('show');document.getElementById('imagePreviewThumb').removeAttribute('src');document.getElementById('fileAttach').value='';document.getElementById('attachmentInfo').style.display='none';}
  function startVoiceInput(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('La dictée vocale n’est pas prise en charge par ce navigateur.');return;}const rec=new SR();rec.lang='fr-FR';rec.onresult=e=>{document.getElementById('input').value+=(document.getElementById('input').value?' ':'')+e.results[0][0].transcript;resizeComposer();};rec.onerror=()=>alert('La reconnaissance vocale n’a pas fonctionné.');rec.start();}

  function escapeHTML(value){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function setMode(m){MODE=m;document.querySelectorAll('.modes button').forEach(b=>b.classList.remove('active'));const map={court:'mCourt',detail:'mDetail',sante:'mSante'};document.getElementById(map[m]).classList.add('active');document.getElementById('santeBox').classList.toggle('show',m==='sante');document.getElementById('input').placeholder='Demande à BOPE,';}
  function fillSante(){const t=document.getElementById('temp').value,ten=document.getElementById('tension').value,p=document.getElementById('pouls').value,po=document.getElementById('poids').value,s=document.getElementById('sympt').value;let msg='';if(t)msg+='Temp '+t+'°C ';if(ten)msg+='Tension '+ten+' ';if(p)msg+='Pouls '+p+' ';if(po)msg+='Poids '+po+'kg ';if(s)msg+='Symptômes: '+s;document.getElementById('input').value=msg;}
  function quickAsk(txt){document.getElementById('input').value=txt;send();}
  async function partagerBOPE(){const url=window.location.href,txt='Découvre BOPE IA 🇨🇩 Made in Kikwit - créée par Alive Bope UNIKIK: ';if(navigator.share){try{await navigator.share({title:'BOPE IA - Made in Kikwit',text:txt,url});}catch(e){}}else{try{await navigator.clipboard.writeText(txt+url);alert('Lien BOPE Made in Kikwit copié! 🇨🇩');}catch(e){alert('Copie impossible sur ce navigateur.');}}}
  async function partagerRep(id){const el=document.getElementById(id);if(!el)return;const txt=el.innerText.replace(/↗️ Partager cette réponse/,'').trim();if(navigator.share){try{await navigator.share({title:'BOPE IA',text:txt});}catch(e){}}else{try{await navigator.clipboard.writeText(txt);alert('Réponse copiée!');}catch(e){alert('Copie impossible.');}}}
  async function send(){const input=document.getElementById('input'),chat=document.getElementById('chat');const message=input.value.trim();if(!message&&!selectedImageData)return;const imageData=selectedImageData,imageMime=selectedImageMime,imageName=selectedImageName;saveMessage('user',message||(imageName?'Analyse cette image : '+imageName:'Image envoyée'));input.value='';resizeComposer();const welcome=document.getElementById('welcome');if(welcome)welcome.style.display='none';const user=document.createElement('div');user.className='msg user';user.textContent=message;chat.appendChild(user);const loading=document.createElement('div');loading.className='msg bot';loading.textContent='Analyse en cours...';chat.appendChild(loading);chat.scrollTop=chat.scrollHeight;
    try{const response=await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:message||(imageName?'Analyse cette image : '+imageName:'Analyse cette image.'),mode:MODE,imageData,imageMime})});const data=await response.json();loading.remove();const box=document.createElement('div');box.className='msg bot';box.id='bot'+Date.now();const answer=document.createElement('span');answer.textContent=data.reply||'Aucune réponse reçue.';saveMessage('assistant',answer.textContent);box.appendChild(answer);box.appendChild(document.createElement('br'));const share=document.createElement('button');share.className='share-btn';share.textContent='↗️ Partager cette réponse';share.onclick=()=>partagerRep(box.id);box.appendChild(share);chat.appendChild(box);
    }catch(e){loading.textContent='Erreur de connexion. Vérifie ta connexion Internet puis réessaie.';}removeAttachment();chat.scrollTop=chat.scrollHeight;}
  document.getElementById('input').addEventListener('input',resizeComposer);
  document.getElementById('input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}});
  renderHistory();
  </script></body></html>`);
});

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
        content: `Tu es BOPE IA, Made in Kikwit, créée par Alive Bope. ${actuContext} ${actuContext ? 'REGLES ACTUALITES : utilise uniquement les articles fournis dans le contexte. Ne crée aucun événement, nom, chiffre, date ou citation. Si les articles ne suffisent pas, dis-le clairement. Distingue la date de publication de la date des faits. Cite le média, la date et le lien lorsqu’ils sont disponibles. Un seul flux RSS ne constitue pas une vérification indépendante.' : ''} ${hasImage ? 'Une image est jointe. Décris ce qui est réellement visible, lis les textes si possible, réponds à la question de l’utilisateur et signale clairement toute partie illisible. Ne devine pas les détails incertains.' : ''} ${presentationRule} ${style}`
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

app.get('/stats', (req, res) => res.json(visitStats));

app.listen(process.env.PORT || 10000, () => {
  console.log("BOPE IA démarré - Total :", visitStats.total);
});
