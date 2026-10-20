import {apiRequest,loadArticle,pageEntityId,normalizeWikidataEntities} from './wikimedia.mjs';
import {pairedSitelinks,originalEditionOptions,normalizeCitationRecord,citationQuestion,clozeFromParagraphs,supportedLanguage} from '../domain/learning.mjs';
const DATA='https://www.wikidata.org/w/api.php';
/** Keep the original QID and optional exact pinned user article through edition switches.
 * A different current language edition may change, but never inherits the source's revision. */
/** @param {string} title @param {string} [secondary] @param {string} [origin] @param {{language:string,pageId:number,revisionId:number,title:string}|null} [pinnedArticle] */
export async function loadLanguagePair(title,secondary='fr',origin='en',pinnedArticle=null){
 if(!supportedLanguage(origin))throw new Error('Unsupported origin language');
 const qid=await pageEntityId(title,origin);
 if(!qid)throw new Error('No Wikidata identity exists for the selected topic');
 return loadLanguagePairByQid(qid,secondary,pinnedArticle);
}
/** @param {string} qid @param {string} [secondary] @param {{language:string,pageId:number,revisionId:number,title:string}|null} [pinnedArticle] */
export async function loadLanguagePairByQid(qid,secondary='fr',pinnedArticle=null){
 if(!/^Q[1-9]\d*$/.test(qid||'')||!supportedLanguage(secondary)||secondary==='en')throw new Error('Unsupported original Wikipedia edition');
 const sites=['en','fr','de','ko','tr'].map(x=>x+'wiki').join('|');
 const response=await apiRequest(DATA,{action:'wbgetentities',ids:qid,props:'sitelinks',sitefilter:sites},{ttl:24*60*60_000});
 const entity=normalizeWikidataEntities(response.entities)?.[qid];
 const sitelinks=pairedSitelinks(entity,secondary),availableEditions=originalEditionOptions(entity);
 if(pinnedArticle){
  if(!supportedLanguage(pinnedArticle.language)||!Number.isSafeInteger(pinnedArticle.pageId)||pinnedArticle.pageId<=0||!Number.isSafeInteger(pinnedArticle.revisionId)||pinnedArticle.revisionId<=0)throw new Error('Pinned original article identity is invalid');
  if((await pageEntityId(pinnedArticle.title,pinnedArticle.language))!==qid)throw new Error('Pinned article disagrees with the selected Wikidata entity');
 }
 async function verifiedArticle(spec){
  const isPinned=pinnedArticle?.language===spec.language;
  const loaded=await loadArticle(isPinned?pinnedArticle.title:spec.title,isPinned?pinnedArticle.revisionId:null,spec.language);
  if(isPinned&&(loaded.identity.pageId!==pinnedArticle.pageId||loaded.identity.revisionId!==pinnedArticle.revisionId))throw new Error('Pinned source page or revision mismatch');
  return loaded;
 }
 const [left,right]=await Promise.all([verifiedArticle(sitelinks.left),verifiedArticle(sitelinks.right)]);
 const verified=await Promise.all([pageEntityId(left.identity.title,'en'),pageEntityId(right.identity.title,secondary)]);
 if(verified[0]!==qid||verified[1]!==qid)throw new Error('Wikidata sitelinks and loaded article entities disagree; no language practice will be graded');
 return {qid,articles:{en:left,[secondary]:right},selectedLanguage:secondary,availableEditions,verifiedSitelinks:true,
   sourceUrl:'https://www.wikidata.org/wiki/'+qid,retrievedAt:new Date().toISOString()};
}
export function articleParagraphs(page){
 const d=new DOMParser().parseFromString(page.html,'text/html');
 for(const x of d.querySelectorAll('script,style,table,nav,.references,.reflist,.hatnote,.navbox'))x.remove();
 return [...d.querySelectorAll('p')].map(p=>p.textContent?.replace(/\[[^\]]{1,12}\]/g,'').trim()||'').filter(x=>x.length>45).slice(0,30);
}
/** Source-owned passage focus reuses the exact existing cloze engine and grader.
 * No invented sentence or new scoring authority is introduced. */
export function sourcePassageCloze(page,paragraph,seed='practice'){
 if(typeof paragraph!=='string')return null;
 const original=articleParagraphs(page);
 const candidate=original.find(x=>x.normalize('NFC')===paragraph.normalize('NFC'));
 return candidate?clozeFromParagraphs([candidate],page.identity,seed):null;
}
export function sourceCloze(page,seed='practice'){
 return clozeFromParagraphs(articleParagraphs(page),page.identity,seed);
}
export function sourceCitations(page){
 const d=new DOMParser().parseFromString(page.html,'text/html');
 const cited=[];
 for(const sup of d.querySelectorAll('sup.reference')){
   const link=sup.querySelector('a[href^="#cite_note"]');
   const raw=link?.getAttribute('href')?.slice(1);if(!raw)continue;
   const note=d.getElementById(raw);if(!note)continue;
   const context=sup.closest('p,li')?.textContent?.replace(/\[[^\]]{1,12}\]/g,'').trim()||'';
   const clone=note.cloneNode(true);
   for(const n of clone.querySelectorAll('sup,.mw-cite-backlink'))n.remove();
   const label=clone.textContent?.trim()||'';
   const links=[...note.querySelectorAll('a[href]')].map(a=>a.href).filter(u=>{try{const url=new URL(u);return url.protocol==='https:'&&!url.hostname.endsWith('.wikipedia.org');}catch{return false;}});
   const record=normalizeCitationRecord({id:raw,label,context,links},page.identity);
   if(record&&!cited.some(x=>x.id===record.id))cited.push(record);
   if(cited.length>=20)break;
 }
 return cited;
}
export function sourceQuestion(page,index=0){return citationQuestion(sourceCitations(page),index);}
