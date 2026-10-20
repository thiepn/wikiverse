import {canonicalArticle,normalizeTitle,isArticleTitle,entityId,wikidataClaimQid,makeMysteryClues} from '../domain/game.mjs';

const api = 'https://en.wikipedia.org/w/api.php';
const wikidata = 'https://www.wikidata.org/w/api.php';
const LANGUAGES = new Set(['en','fr','de','ko','tr']);
export function wikipediaApi(language='en') {
  if(!LANGUAGES.has(language)) throw new Error('Unsupported Wikipedia language');
  return 'https://'+language+'.wikipedia.org/w/api.php';
}
const inFlight = new Map();
const cache = new Map();
const MAX_CACHE = 48;
const MAX_UPSTREAM_ATTEMPTS=2;
const TRANSIENT_STATUSES=new Set([429,502,503,504]);
export function retryDelayMs(response,attempt){
 const raw=response?.headers?.get?.('retry-after');
 const seconds=raw==null?NaN:Number(raw);
 if(Number.isFinite(seconds)&&seconds>=0)return Math.min(1500,Math.round(seconds*1000));
 return Math.min(1200,300+attempt*400);
}
/** Actionable source failures without treating missing data as false facts. */
export function sourceFailureAdvice(error){
 const raw=String(error?.message||error||'Source unavailable');
 if(/rate limit|429/i.test(raw))return {kind:'rate-limited',retryable:true,hint:'Wikimedia is rate limiting requests. Leave the source unchanged and try later.'};
 if(/timed out|abort|network|failed to fetch|fetch failed|502|503|504/i.test(raw))return {kind:'temporarily-unavailable',retryable:true,hint:'The original source could not be reached. Check connectivity, then retry; no placeholder answers are generated.'};
 if(/revision ID|identity changed|canonical|mismatch|unsupported/i.test(raw))return {kind:'source-integrity',retryable:false,hint:'Original source IDs did not match. Use a fresh article search; an unverified result will not be scored.'};
 return {kind:'source-data',retryable:false,hint:'The source did not contain enough verified information for this activity. Choose a different article.'};
}
function boundedPause(ms,signal){
 return new Promise((resolve,reject)=>{
  if(signal.aborted)return reject(new Error('Wikimedia request timed out'));
  const cancel=()=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);reject(new Error('Wikimedia request timed out'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',cancel);resolve();},ms);
  signal.addEventListener('abort',cancel,{once:true});
 });
}
export function validateApiPayload(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Invalid Wikimedia JSON response');
 if(payload.error)throw new Error(String(payload.error.info||'Wikimedia returned an API error').slice(0,240));
 return payload;
}
let lastRequest = 0;
let queue = Promise.resolve();

export function clearApiCache() {cache.clear();inFlight.clear();}
export function apiStats() {return {cached:cache.size,pending:inFlight.size};}
/** Calls the official Action APIs, identifying this client via Api-User-Agent when possible.
 * Browsers cannot set User-Agent; a production gateway should provide identifying User-Agent.
 */
export function apiRequest(endpoint, params, {ttl=3600000,fetcher=fetch}={}) {
  if (![...([...LANGUAGES].map(wikipediaApi)),wikidata].includes(endpoint)) throw new Error('Only Wikimedia Action APIs are permitted');
  const u = new URL(endpoint);
  for (const [k,v] of Object.entries({...params,action:params.action,format:'json',formatversion:endpoint===wikidata?'1':'2',origin:'*'})) u.searchParams.set(k,String(v));
  const key=u.toString();
  const hit=cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value);
  if (inFlight.has(key)) return inFlight.get(key);
  const job = queue = queue.catch(()=>{}).then(async()=>{
    // Gentle single-flight pacing; no background polling or burst fetching.
    const delay=Math.max(0,175-(Date.now()-lastRequest));
    if (delay) await new Promise(resolve=>setTimeout(resolve,delay));
    lastRequest=Date.now();
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),15000);
    try {
      let response;
      for(let attempt=0;attempt<MAX_UPSTREAM_ATTEMPTS;attempt++){
        response=await fetcher(key,{signal:controller.signal,headers:{Accept:'application/json'}});
        if(response.ok)break;
        if(!TRANSIENT_STATUSES.has(response.status)||attempt===MAX_UPSTREAM_ATTEMPTS-1)break;
        const ms=retryDelayMs(response,attempt);
        await boundedPause(ms,controller.signal);
      }
      if (response.status===429) throw new Error('Wikimedia rate limit reached. Try again later.');
      if (!response.ok) throw new Error('Wikimedia request failed ('+response.status+')');
      const payload=validateApiPayload(await response.json());
      cache.set(key,{value:payload,expires:Date.now()+ttl});
      if (cache.size>MAX_CACHE) cache.delete(cache.keys().next().value);
      return payload;
    } finally {clearTimeout(timer);}
  });
  inFlight.set(key,job);
  return job.finally(()=>inFlight.delete(key));
}
export async function searchArticles(term) {
  const q=String(term||'').trim();
  if (q.length<2) return [];
  const data=await apiRequest(api,{action:'query',list:'search',srsearch:q,srlimit:8,srnamespace:0},{ttl:5*60_000});
  return (data.query?.search||[]).filter(p=>isArticleTitle(p.title)).map(p=>({title:normalizeTitle(p.title),pageId:p.pageid,snippet:p.snippet?.replace(/<[^>]+>/g,'')||''}));
}
/** @param {string} title @param {number|null} [revisionId] */
export async function loadArticle(title, revisionId = null, language = 'en') {
  if (!isArticleTitle(title)) throw new Error('Invalid article title');
  const endpoint=wikipediaApi(language);
  const pinned = Number.isSafeInteger(revisionId) && revisionId > 0;
  const source = pinned ? {oldid:String(revisionId)} : {page:normalizeTitle(title),redirects:'1'};
  const data=await apiRequest(endpoint,{action:'parse',...source,prop:'text|links|revid',disableeditsection:'1',disabletoc:'1'}, {ttl:pinned ? 30*24*60*60_000 : 6*60*60_000});
  const page=data.parse;
  if (!page || typeof page.text!=='string' || !page.text || !page.revid || !page.pageid || !isArticleTitle(page.title)) throw new Error('Article unavailable or unsupported');
  if(pinned&&page.revid!==revisionId)throw new Error('Pinned Wikipedia revision ID did not match source response');
  if (page.text.length > 1_600_000) throw new Error('This Wikipedia page is too large for the current lightweight reader.');
  // Links from parse are not themselves navigable until they appear in the sanitized reader.
  // Kept for verified route construction only; reader UI further restricts clicks to displayed anchors.
  const links=(page.links||[]).filter(l=>l.ns===0 && isArticleTitle(l['*']||l.title)).map(l=>normalizeTitle(l['*']||l.title));
  const identity=canonicalArticle({title:page.title,pageid:page.pageid,revid:page.revid},language);
  return {identity,html:page.text,links:[...new Set(links)],retrievedAt:new Date().toISOString()};
}
export async function pageEntityId(title, language = 'en') {
  const data=await apiRequest(wikipediaApi(language),{action:'query',prop:'pageprops',titles:normalizeTitle(title),redirects:'1',ppprop:'wikibase_item'},{ttl:24*60*60_000});
  return entityId(data.query?.pages?.[0]?.pageprops?.wikibase_item);
}

/** Normalize Wikibase API formatversion=2 array fields into stable canonical language/site maps. */
export function normalizeWikidataEntity(entity){
 if(!entity||typeof entity!=='object')return entity;
 const languages=x=>Array.isArray(x)?Object.fromEntries(x.filter(v=>v&&typeof v.language==='string'&&v.language.length<=20).map(v=>[v.language,v])):x||{};
 const aliases=x=>{
  if(!Array.isArray(x))return x||{};
  const grouped={};for(const v of x)if(v&&typeof v.language==='string'&&typeof v.value==='string')(grouped[v.language]??=[]).push(v);return grouped;
 };
 const sitelinks=x=>Array.isArray(x)?Object.fromEntries(x.filter(v=>v&&typeof v.site==='string').map(v=>[v.site,v])):x||{};
 return {...entity,labels:languages(entity.labels),descriptions:languages(entity.descriptions),aliases:aliases(entity.aliases),sitelinks:sitelinks(entity.sitelinks)};
}
export function normalizeWikidataEntities(entities){
 if(!entities||typeof entities!=='object')return {};
 const items=Array.isArray(entities)?entities.map(x=>[x?.id,x]):Object.entries(entities);
 return Object.fromEntries(items.filter(([id,x])=>/^Q[1-9]\d*$/.test(id||'')&&x&&x.id===id).map(([id,x])=>[id,normalizeWikidataEntity(x)]));
}

export async function loadEntities(ids) {
  const safe=[...new Set(ids)].filter(entityId).slice(0,40);
  if (!safe.length) return {};
  const data=await apiRequest(wikidata,{action:'wbgetentities',ids:safe.join('|'),props:'labels|aliases|claims',languages:'en',languagefallback:'1'},{ttl:24*60*60_000});
  return normalizeWikidataEntities(data.entities);
}
export async function loadMystery(title) {
  const qid=await pageEntityId(title);
  if (!qid) throw new Error('No Wikidata identity for this subject');
  const entities=await loadEntities([qid]);
  const entity=entities[qid];
  if (!entity || entity.missing) throw new Error('Unknown Wikidata subject');
  const related=['P106','P19','P166'].map(p=>wikidataClaimQid(entity,p)).filter(Boolean);
  const labelEntities=await loadEntities(related);
  const labels=Object.fromEntries(Object.entries(labelEntities).map(([k,v])=>[k,v.labels?.en?.value || '']));
  const clues=makeMysteryClues(entity,labels);
  if (!clues.length) throw new Error('Insufficient independently sourced clues for this topic');
  const names=Object.fromEntries(Object.entries(entity.labels||{}).map(([k,v])=>[k,v.value]));
  const aliases=Object.fromEntries(Object.entries(entity.aliases||{}).map(([k,v])=>[k,v.map(x=>x.value)]));
  const answer=names.en || title;
  return {id:qid,title:answer,clues,identity:{qid,articleTitle:title},accepted:{labels:names,aliases},sourceUrl:`https://www.wikidata.org/wiki/${qid}`, retrievedAt:new Date().toISOString()};
}
