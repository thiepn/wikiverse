import {loadArticle,sourceFailureAdvice} from './wikimedia.mjs';
import {STARTERS,hashSeed,normalizeTitle,isArticleTitle} from '../domain/game.mjs';
import {buildLinkAudit,buildCommonLinkAudit,buildLinkOriginAudit} from '../domain/linklab.mjs';
import {checkedArticle} from '../domain/study.mjs';
/** Bounded attempts; only real titles and original page/revision identities. */
/** @param {{start?:string,seed?:string,sourceArticle?:any,choices?:3|4|5}} [options] */
export async function createLinkAudit({start='Mathematics',seed='linklab_1',sourceArticle=null,choices=4}={}){
 if(![3,4,5].includes(choices))throw new Error('Unsupported original-source choice density');
 if(typeof seed!=='string'||seed.length<2||seed.length>80||!isArticleTitle(start)||start.trim().length>190)throw new Error('Choose a valid Wikipedia article title and seed');
 const pinned=sourceArticle?checkedArticle(sourceArticle):null;
 if(pinned&&(pinned.language!=='en'||pinned.title!==normalizeTitle(start)))throw new Error('Focused Link Lab requires the same English original title');
 const first=await loadArticle(normalizeTitle(start),pinned?.revisionId||null);
 if(pinned&&(first.identity.pageId!==pinned.pageId||first.identity.revisionId!==pinned.revisionId))throw new Error('Focused Link Lab source identity changed');
 const candidates=STARTERS.filter(x=>normalizeTitle(x)!==normalizeTitle(first.identity.title));
 const ordered=candidates.map((x,i)=>({title:x,order:hashSeed(seed+':'+x+':'+i)})).sort((a,b)=>a.order-b.order).slice(0,5);
 let error;
 for(const candidate of ordered){
  try{
   const second=await loadArticle(candidate.title);
   const question=buildLinkAudit(first,second,{seed,limit:choices});
   let common=null;try{common=buildCommonLinkAudit(first,second,{seed,limit:choices});}catch{/* shared links genuinely absent */}
   const origin=buildLinkOriginAudit(first,second,{seed});
   return {question,common,origin,pages:[first,second],retrievedAt:new Date().toISOString()};
  }catch(e){if(sourceFailureAdvice(e).retryable)throw e;error=e;}
 }
 throw new Error('No fair source-backed question available from these articles: '+(error?.message||'insufficient distinct links'));
}

/** Re-check the exact source revisions from a missed Link Lab attempt. No stale-answer shortcuts. */
export async function replayLinkAudit(item){
 const p=checkedArticle(item?.article),c=checkedArticle(item?.contrast);
 if(p.language!=='en'||c.language!=='en'||p.pageId===c.pageId)throw new Error('Archived practice requires two distinct English source articles');
 const [first,second]=await Promise.all([loadArticle(p.title,p.revisionId,p.language),loadArticle(c.title,c.revisionId,c.language)]);
 if(first.identity.pageId!==p.pageId||first.identity.revisionId!==p.revisionId||second.identity.pageId!==c.pageId||second.identity.revisionId!==c.revisionId)throw new Error('Archived Wikipedia source identity changed');
 const seed='review_'+p.pageId+'_'+c.pageId;
 const question=buildLinkAudit(first,second,{seed});
 let common=null;try{common=buildCommonLinkAudit(first,second,{seed});}catch{}
 const origin=buildLinkOriginAudit(first,second,{seed});
 return {question,common,origin,pages:[first,second],retrievedAt:new Date().toISOString(),reviewOf:'local-missed-source'};
}
