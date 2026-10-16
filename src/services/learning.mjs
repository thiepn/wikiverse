import {apiRequest,loadArticle,pageEntityId} from './wikimedia.mjs';
import {pairedSitelinks,normalizeCitationRecord,citationQuestion,clozeFromParagraphs,supportedLanguage} from '../domain/learning.mjs';
const DATA='https://www.wikidata.org/w/api.php';
export async function loadLanguagePair(title,secondary='fr',origin='en'){
 if(!supportedLanguage(origin))throw new Error('Unsupported origin language');
 const qid=await pageEntityId(title,origin);
 if(!qid)throw new Error('No Wikidata identity exists for the selected topic');
 const response=await apiRequest(DATA,{action:'wbgetentities',ids:qid,props:'sitelinks',sitefilter:'enwiki|'+secondary+'wiki'},{ttl:24*60*60_000});
 const entity=response.entities?.[qid];const sitelinks=pairedSitelinks(entity,secondary);
 const [left,right]=await Promise.all([
   loadArticle(sitelinks.left.title,null,'en'),
   loadArticle(sitelinks.right.title,null,secondary)
 ]);
 return {qid,articles:{en:left,[secondary]:right},selectedLanguage:secondary,
   sourceUrl:'https://www.wikidata.org/wiki/'+qid,retrievedAt:new Date().toISOString()};
}
export function articleParagraphs(page){
 const d=new DOMParser().parseFromString(page.html,'text/html');
 for(const x of d.querySelectorAll('script,style,table,nav,.references,.reflist,.hatnote,.navbox'))x.remove();
 return [...d.querySelectorAll('p')].map(p=>p.textContent?.replace(/\[[^\]]{1,12}\]/g,'').trim()||'').filter(x=>x.length>45).slice(0,30);
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
