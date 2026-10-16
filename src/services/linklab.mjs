import {loadArticle} from './wikimedia.mjs';
import {STARTERS,hashSeed,normalizeTitle} from '../domain/game.mjs';
import {buildLinkAudit,buildCommonLinkAudit} from '../domain/linklab.mjs';
/** Bounded attempts; only real titles and original page/revision identities. */
export async function createLinkAudit({start='Mathematics',seed='linklab_1'}={}){
 if(typeof seed!=='string'||seed.length<2||seed.length>80||!STARTERS.includes(start))throw new Error('Choose a supported source article and seed');
 const first=await loadArticle(start);
 const candidates=STARTERS.filter(x=>normalizeTitle(x)!==normalizeTitle(first.identity.title));
 const ordered=candidates.map((x,i)=>({title:x,order:hashSeed(seed+':'+x+':'+i)})).sort((a,b)=>a.order-b.order).slice(0,5);
 let error;
 for(const candidate of ordered){
  try{
   const second=await loadArticle(candidate.title);
   const question=buildLinkAudit(first,second,{seed});
   let common=null;try{common=buildCommonLinkAudit(first,second,{seed});}catch{/* shared links genuinely absent */}
   return {question,common,pages:[first,second],retrievedAt:new Date().toISOString()};
  }catch(e){error=e;}
 }
 throw new Error('No fair source-backed question available from these articles: '+(error?.message||'insufficient distinct links'));
}
