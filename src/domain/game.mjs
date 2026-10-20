/** Pure, source-identity-aware gameplay functions. Never equate Wikidata QIDs with Wikipedia page IDs. */
export const ARTICLE_LANGUAGE = 'en';
export const STARTERS = Object.freeze(['Mathematics','Marie Curie','Albert Einstein','Moon','France','Charles Darwin','Ada Lovelace','Ancient Rome']);
export const MYSTERY_PEOPLE = Object.freeze(['Marie Curie','Albert Einstein','Ada Lovelace','Isaac Newton','Charles Darwin','Florence Nightingale','Alan Turing','Katherine Johnson']);

export function hashSeed(value) {
  let h = 2166136261;
  for (const char of String(value)) { h = Math.imul(h ^ char.charCodeAt(0), 16777619); }
  return h >>> 0;
}
export function dateKey(date = new Date()) {
  // UTC deliberately: daily challenges change at the same instant worldwide.
  return date.toISOString().slice(0,10);
}
export function normalizeTitle(value) {
  if (typeof value !== 'string') return '';
  return value.replaceAll('_', ' ').replace(/\s+/g,' ').trim().normalize('NFC');
}
export function isArticleTitle(value) {
  const t = normalizeTitle(value);
  // Namespace links are ineligible for race navigation. Reject fragment-only, unsafe and malformed values.
  return Boolean(t && t.length <= 240 && !/[\u0000-\u001f#<>]/.test(t) && !/^[^ ]+:/.test(t));
}
export function articleKey(article) {
  if (!article || !/^[a-z-]{2,20}$/.test(article.language) || !Number.isSafeInteger(article.pageId) || article.pageId <= 0) throw new Error('Invalid article identity');
  return `${article.language}:${article.pageId}:${article.revisionId ?? 'live'}`;
}
export function canonicalArticle(data, language = ARTICLE_LANGUAGE) {
  if (!data || !Number.isSafeInteger(data.pageid) || data.pageid < 1 || !Number.isSafeInteger(data.revid) || data.revid < 1 || !isArticleTitle(data.title)) throw new Error('Invalid Wikipedia article data');
  return Object.freeze({ language, pageId: data.pageid, revisionId: data.revid, title: normalizeTitle(data.title), wikidataId: /^Q[1-9]\d*$/.test(data.wikidataId || '') ? data.wikidataId : null });
}
export function wikipediaUrl(article) {
  return `https://${encodeURIComponent(article.language)}.wikipedia.org/wiki/${encodeURIComponent(article.title.replaceAll(' ','_'))}`;
}
export function revisionUrl(article) {
  return `https://${encodeURIComponent(article.language)}.wikipedia.org/w/index.php?oldid=${article.revisionId}`;
}
export function legalTransition(current, targetTitle) {
  const title = normalizeTitle(targetTitle);
  if (!isArticleTitle(title)) return false;
  return current.links.some(link => normalizeTitle(link) === title) && normalizeTitle(current.identity.title) !== title;
}
export function applyRaceClick(state, currentArticle, clickedTitle) {
  if (state.finished || normalizeTitle(state.current.title) !== normalizeTitle(currentArticle.identity.title) || !legalTransition(currentArticle, clickedTitle)) return null;
  // Caller retrieves and verifies next canonical article before updating the state.
  return { from: articleKey(currentArticle.identity), target: normalizeTitle(clickedTitle) };
}
export function finishRace(state, target) {
  const reached = state.current.pageId === target.pageId && state.current.language === target.language;
  return { ...state, finished: reached, finishedAt: reached ? Date.now() : null };
}
export function choose(list, seed) {
  return list.length ? list[hashSeed(seed) % list.length] : undefined;
}
export function chooseVerifiedStep(links, visited, seed) {
  const unique = [...new Set(links.map(normalizeTitle))].filter(t => isArticleTitle(t) && !visited.has(t));
  // Stable order removes upstream response-order dependence.
  unique.sort((a,b)=>a.localeCompare(b,'en'));
  return choose(unique, seed);
}
export async function generateVerifiedRace(startTitle, seed, readArticle, maxHops=2) {
  if (![1,2,3].includes(maxHops)) throw new Error('Choose one, two or three verified source-link hops');
  const start = await readArticle(startTitle);
  const visited = new Set([normalizeTitle(start.identity.title)]);
  const proof = [start.identity];
  let previous = start;
  for (let i=0; i<maxHops; i++) {
    // Try multiple source-backed candidates, never invent a route if a candidate fails.
    let next;
    for (let n=0;n<8;n++) {
      const candidate = chooseVerifiedStep(previous.links,visited,`${seed}:${i}:${n}`);
      if (!candidate) break;
      visited.add(candidate);
      try {
        const loaded = await readArticle(candidate);
        if (legalTransition(previous, candidate) && loaded.identity.pageId !== previous.identity.pageId && loaded.identity.language === start.identity.language) {
          // Redirects can resolve to a previously visited page.
          if (proof.some(p => p.pageId === loaded.identity.pageId)) continue;
          next = loaded; break;
        }
      } catch { /* inaccessible or disambiguation-like source link: try another */ }
    }
    if (!next) throw new Error('Unable to prove a navigable route. Choose another starting article.');
    proof.push(next.identity);
    previous = next;
  }
  if (proof.length !== maxHops+1) throw new Error('Race requires the requested number of verified source-link hops');
  return { id: `race-${seed}`, seed, start: proof[0], target: proof[proof.length-1], proof, createdAt: new Date().toISOString(), rulesVersion: 1, ranked: false };
}
export function entityId(value) {return /^Q[1-9]\d*$/.test(value || '') ? value : null;}
export function claimsValue(entity, prop) {
  const entries = entity?.claims?.[prop] || [];
  const preferred = entries.filter(e=>e.rank !== 'deprecated');
  for (const statement of preferred) {
    const v = statement?.mainsnak?.datavalue?.value;
    if (v !== undefined && v !== null) return v;
  }
  return null;
}
export function wikidataEntityId(value) {
  return entityId(value?.id || '') || null;
}
export function wikidataClaimQid(entity, prop) {
  return entityId(claimsValue(entity,prop)?.id);
}
export function wikidataBirthYear(entity) {
  const date = claimsValue(entity,'P569')?.time;
  // Wikipedia/Wikidata historical dates may use uncertain precision or BCE; do not use those as exact trivia years.
  const precision = claimsValue(entity,'P569')?.precision;
  if (!/^\+\d{4,}-\d{2}-\d{2}T/.test(date || '') || precision < 9) return null;
  return Number(date.slice(1,5));
}
export function makeMysteryClues(entity, labels) {
  if (!wikidataEntityId(entity)) return [];
  const clues=[];
  const occupation=wikidataClaimQid(entity,'P106');
  const city=wikidataClaimQid(entity,'P19');
  const award=wikidataClaimQid(entity,'P166');
  const year=wikidataBirthYear(entity);
  if (occupation && labels[occupation]) clues.push({property:'P106',sourceId:occupation,text:`This person's recorded occupation includes ${labels[occupation]}.`});
  if (year) clues.push({property:'P569',sourceId:entity.id,text:`This person was born in ${year}.`});
  if (city && labels[city]) clues.push({property:'P19',sourceId:city,text:`This person's recorded place of birth is ${labels[city]}.`});
  if (award && labels[award]) clues.push({property:'P166',sourceId:award,text:`This person received ${labels[award]}.`});
  return clues.length >= 3 ? clues : [];
}
export function acceptedEntityAnswer(entity, input) {
  const text = normalizeTitle(input).toLocaleLowerCase('en');
  const names = [...Object.values(entity.labels||{}), ...Object.values(entity.aliases||{}).flat()].map(x=>typeof x === 'string'?x:x?.value).filter(Boolean);
  return Boolean(text && names.some(name=>normalizeTitle(name).toLocaleLowerCase('en')===text));
}
export function mysteryCluePlan(level,eligibleClues){
 if(!Number.isSafeInteger(eligibleClues)||eligibleClues<3)throw new Error('Mystery requires at least three Wikidata-property clues');
 if(!['guided','standard','expert'].includes(level))throw new Error('Unsupported mystery practice level');
 return {level,initial:level==='guided'?2:1,maxReveal:level==='expert'?1:eligibleClues};
}
export function mysteryCandidateOrder(names,seed,recent=[]){
 if(!Array.isArray(names)||!Array.isArray(recent)||!names.every(x=>typeof x==='string'))throw new Error('Invalid sourced mystery candidates');
 if(!names.length)return [];
 const shift=hashSeed(String(seed))%names.length,rotated=[...names.slice(shift),...names.slice(0,shift)],used=new Set(recent.filter(x=>typeof x==='string').slice(0,4));
 return [...rotated.filter(x=>!used.has(x)),...rotated.filter(x=>used.has(x))];
}
export function mysteryScore(revealed, wrongGuesses) {
  return Math.max(20, 120 - Math.max(1,revealed)*20 - Math.max(0,wrongGuesses)*10);
}
export function progressSummary(state) {
  return { races:state.races?.length||0, mysteries:state.mysteries?.length||0, discoveries:Object.keys(state.saved||{}).length, bestClicks:Math.min(Infinity,...(state.races||[]).map(x=>x.clicks)) };
}
