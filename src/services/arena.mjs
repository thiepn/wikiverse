import {STARTERS,choose,generateVerifiedRace,normalizeTitle} from '../domain/game.mjs';
import {buildArenaManifest,validateArenaManifest,sourceLinkChoices} from '../domain/arena.mjs';
import {loadArticle} from './wikimedia.mjs';
/** @param {{seed?: string, starter?: string, dailyKey?: string|null}} [options] */
export async function createArenaTrail({seed,starter,dailyKey=null}={}){
 if(!/^[A-Za-z0-9:_-]{3,90}$/.test(seed||''))throw new Error('Provide a valid challenge seed');
 const start=starter||choose(STARTERS,seed);
 const route=await generateVerifiedRace(start,seed,title=>loadArticle(title),2);
 const manifest=buildArenaManifest(route,{dailyKey});
 await verifyArenaTrail(manifest);
 return manifest;
}
export async function createDailyTrail(key){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key||''))throw new Error('Invalid UTC date');
 let failure;
 const index=STARTERS.indexOf(choose(STARTERS,key));
 for(let i=0;i<Math.min(3,STARTERS.length);i++){
  try{return await createArenaTrail({seed:'day_'+key+'_'+i,starter:STARTERS[(index+i)%STARTERS.length],dailyKey:key});}
  catch(error){failure=error;}
 }
 throw new Error('No playable daily route could be validated from current Wikipedia revisions: '+(failure?.message||'source unavailable'));
}
export async function verifyArenaTrail(input){
 const manifest=validateArenaManifest(input),pages=[];
 // The source route must remain valid at the *pinned* historical revisions, not latest live edits.
 for(const item of manifest.proof){
  const page=await loadArticle(item.title,item.revisionId,item.language);
  if(page.identity.language!==item.language||page.identity.pageId!==item.pageId||page.identity.revisionId!==item.revisionId||normalizeTitle(page.identity.title)!==item.title)throw new Error('Challenge article identity or revision did not match its source');
  pages.push(page);
 }
 const choices=[];
 for(let i=0;i<pages.length-1;i++)choices.push(sourceLinkChoices(pages[i],manifest.proof[i+1],manifest.seed+':'+i));
 return {manifest,pages,choices,verifiedAt:new Date().toISOString()};
}
