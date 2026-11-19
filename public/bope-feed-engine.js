/* BOPE SOCIAL — moteur local de classement du fil (sans API IA payante).
 * Module volontairement indépendant : il peut être testé avant son branchement à l'interface.
 */
(function (root) {
  'use strict';

  const TOPIC_KEYWORDS = {
    sante: ['santé', 'medecine', 'médecine', 'hopital', 'hôpital', 'maladie', 'soin', 'médecin', 'patient', 'infirmier'],
    education: ['école', 'université', 'etude', 'étude', 'cours', 'examen', 'apprendre', 'formation', 'étudiant'],
    sport: ['football', 'foot', 'léopard', 'leopards', 'match', 'sport', 'basket', 'but', 'joueur'],
    actualite: ['actualité', 'actualite', 'politique', 'rdc', 'congo', 'kinshasa', 'gouvernement', 'élection'],
    humour: ['humour', 'rire', 'blague', 'drôle', 'drole', '😂', '🤣'],
    musique: ['musique', 'chanson', 'rumba', 'ndombolo', 'gospel', 'artiste', 'concert'],
    cuisine: ['cuisine', 'repas', 'pondu', 'fufu', 'saka-saka', 'poisson', 'recette'],
    technologie: ['technologie', 'numérique', 'numerique', 'informatique', 'application', 'intelligence artificielle', 'ia', 'internet'],
    culture: ['culture', 'tradition', 'langue', 'lingala', 'swahili', 'histoire', 'art']
  };

  function asSet(value) {
    return value instanceof Set ? value : new Set(Array.isArray(value) ? value : []);
  }

  function topicMatches(text) {
    const value = String(text || '').toLocaleLowerCase('fr');
    const found = [];
    for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
      if (words.some(word => value.includes(word))) found.push(topic);
    }
    return found;
  }

  function scorePost(post, context, now) {
    const authorId = post.author_id || (post.profiles && post.profiles.id) || '';
    const ageMs = Math.max(0, now - new Date(post.created_at || 0).getTime());
    const ageHours = ageMs / 3600000;
    const text = [post.content, post.media_type].filter(Boolean).join(' ');
    const topics = topicMatches(text);
    const interests = context.interests || {};
    let score = 0;
    const reasons = [];

    if (context.friendIds.has(authorId)) { score += 20; reasons.push('ami'); }

    const interestPoints = topics.reduce((sum, topic) => {
      const raw = interests instanceof Map ? interests.get(topic) : interests[topic];
      const n = Number(raw && typeof raw === 'object' ? raw.interest_score : raw) || 0;
      return sum + Math.min(20, Math.max(0, n) / 5);
    }, 0);
    if (interestPoints > 0) { score += Math.min(20, interestPoints); reasons.push('centres_interet'); }

    if (ageHours <= 24) { score += 15; reasons.push('recent'); }
    if (ageHours <= 3) score += 10;

    if (context.underexposedAuthorIds.has(authorId)) { score += 10; reasons.push('auteur_peu_visible'); }

    const engagement = context.engagementByPost[post.id] || {};
    const engagementPoints =
      Math.min(6, Number(engagement.reactions) || 0) * 0.5 +
      Math.min(4, Number(engagement.comments) || 0) * 1 +
      Math.min(3, Number(engagement.shares) || 0) * 1.5;
    score += Math.min(8, engagementPoints);

    if (context.shownPostIds.has(post.id)) score -= 10;
    if (context.viewedPostIds.has(post.id)) score -= 8;

    return { score, topics, reasons, authorId, ageMs };
  }

  function pickWithAuthorDiversity(items, count, selectedIds, authorCounts) {
    const picked = [];
    let previousAuthor = null;
    let consecutive = 0;

    while (picked.length < count) {
      let bestIndex = -1;
      let bestValue = -Infinity;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (selectedIds.has(item.post.id)) continue;
        const author = item.authorId;
        const samePenalty = author === previousAuthor && consecutive >= 2 ? 100000 : 0;
        const frequencyPenalty = (authorCounts.get(author) || 0) * 3;
        const value = item.score - samePenalty - frequencyPenalty;
        if (value > bestValue) { bestValue = value; bestIndex = i; }
      }

      if (bestIndex < 0 || bestValue <= -99999) break;
      const item = items[bestIndex];
      picked.push(item);
      selectedIds.add(item.post.id);
      authorCounts.set(item.authorId, (authorCounts.get(item.authorId) || 0) + 1);
      if (item.authorId === previousAuthor) consecutive += 1;
      else { previousAuthor = item.authorId; consecutive = 1; }
    }
    return picked;
  }

  function rankFeed(posts, options) {
    const opts = options || {};
    const now = Number(opts.now) || Date.now();
    const limit = Math.max(1, Math.min(100, Number(opts.limit) || 30));
    const discoveryRatio = Math.max(0, Math.min(0.5, Number(opts.discoveryRatio) || 0.2));
    const context = {
      friendIds: asSet(opts.friendIds),
      underexposedAuthorIds: asSet(opts.underexposedAuthorIds),
      shownPostIds: asSet(opts.shownPostIds),
      viewedPostIds: asSet(opts.viewedPostIds),
      excludedPostIds: asSet(opts.excludedPostIds),
      hiddenAuthorIds: asSet(opts.hiddenAuthorIds),
      interests: opts.interests || {},
      engagementByPost: opts.engagementByPost || {}
    };

    const eligible = (Array.isArray(posts) ? posts : []).filter(post => {
      if (!post || !post.id || context.excludedPostIds.has(post.id)) return false;
      const author = post.author_id || (post.profiles && post.profiles.id) || '';
      if (context.hiddenAuthorIds.has(author)) return false;
      return true;
    });

    const ranked = eligible.map(post => {
      const result = scorePost(post, context, now);
      return { post, ...result };
    });

    const sevenDays = 7 * 24 * 3600000;
    const discovery = ranked
      .filter(item => item.ageMs <= sevenDays && !context.shownPostIds.has(item.post.id))
      .sort((a, b) => a.ageMs - b.ageMs || a.score - b.score);

    // Les publications déjà proposées restent disponibles en dernier recours,
    // avec la pénalité de score appliquée plus haut. Cela évite un fil vide.
    const personalized = ranked
      .slice()
      .sort((a, b) => b.score - a.score || new Date(b.post.created_at) - new Date(a.post.created_at));

    const discoveryCount = Math.min(limit, Math.floor(limit * discoveryRatio));
    const selectedIds = new Set();
    const authorCounts = new Map();
    const personalizedSlots = limit - discoveryCount;
    const main = pickWithAuthorDiversity(personalized, personalizedSlots, selectedIds, authorCounts);
    const discoveryPicks = pickWithAuthorDiversity(discovery, discoveryCount, selectedIds, authorCounts);

    // Mélange les découvertes dans le fil au lieu de les regrouper à la fin.
    const output = [];
    let mainIndex = 0;
    let discoveryIndex = 0;
    const discoveryEvery = discoveryRatio > 0 ? Math.max(1, Math.round(1 / discoveryRatio)) : Infinity;
    const discoverySet = new Set(discoveryPicks.map(item => item.post.id));
    const append = item => {
      if (!item || output.some(post => post.id === item.post.id)) return;
      output.push({
        ...item.post,
        _bopeFeed: {
          type: discoverySet.has(item.post.id) ? 'discovery' : 'personalized',
          score: Math.round(item.score * 100) / 100,
          topics: item.topics,
          reasons: item.reasons
        }
      });
    };

    for (let slot = 0; slot < limit; slot++) {
      const isDiscoverySlot = discoveryCount > 0 && (slot + 1) % discoveryEvery === 0;
      let item = isDiscoverySlot ? discoveryPicks[discoveryIndex++] : main[mainIndex++];
      if (!item && isDiscoverySlot) item = main[mainIndex++];
      if (!item) item = discoveryPicks[discoveryIndex++];
      append(item);
    }

    // Remplit les places restantes si l'un des deux compartiments est trop petit.
    const leftovers = [...personalized, ...discovery];
    for (const item of leftovers) {
      if (output.length >= limit) break;
      if (output.some(post => post.id === item.post.id)) continue;
      append(item);
    }
    return output;
  }

  const api = { rankFeed, topicMatches };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BOPEFeedEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
