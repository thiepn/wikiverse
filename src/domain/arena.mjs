/** Portable, unranked challenge proofs built from *pinned* Wikipedia article links. */
import {dateKey,normalizeTitle,articleKey,isArticleTitle,hashSeed} from './game.mjs';
export const CHALLENGE_VERSION=1;
export function validateArenaManifest(input){
 if(!input||input.version!==CHALLENGE_VERSION||input.kind!=='pinned-wikilink-trail'||input.ranked!==false||!Array.isArray(input.proof)||input.proof.length!==3)throw new Error('Unsupported or incomplete WikiVerse challenge');
 const ids=new Set();
 const proof=input.proof.map(p=>{
  if(!p||!isArticleTitle(p.title)||!['en','fr','de','ko','tr'].includes(p.language)||!Number.isSafeInteger(p.pageId)||p.pageId<=0||!Number.isSafeInteger(p.revisionId)||p.revisionId<=0)throw new Error('Invalid canonical article or revision identity');
  const article={language:p.language,pageId:p.pageId,revisionId:p.revisionId,title:normalizeTitle(p.title)};
  const id=articleKey(article);
  if(ids.has(id))throw new Error('Challenge route repeats the same source');
  ids.add(id);return article;
 });
 if(proof.some(p=>p.language!==proof[0].language)||proof.some(p=>p.pageId===proof[0].pageId&&p!==proof[0]))throw new Error('Challenge must remain in one language and use distinct pages');
 if(!/^[A-Za-z0-9:_-]{3,90}$/.test(input.seed||''))throw new Error('Invalid challenge seed');
 if(input.dailyKey!==null&&input.dailyKey!==undefined&&!/^\d{4}-\d{2}-\d{2}$/.test(input.dailyKey))throw new Error('Invalid daily challenge key');
 const canonical={version:1,kind:'pinned-wikilink-trail',ranked:false,seed:input.seed,dailyKey:input.dailyKey??null,proof};
 canonical.id='trail:'+hashSeed(JSON.stringify(canonical));
 return canonical;
}
export function buildArenaManifest(route,{dailyKey=null}={}){
 if(!route?.proof?.length)throw new Error('Missing verified Wikipedia route');
 return validateArenaManifest({version:1,kind:'pinned-wikilink-trail',ranked:false,seed:route.seed,dailyKey,proof:route.proof});
}
export function encodeArenaCode(manifest){
 const checked=validateArenaManifest(manifest);
 const raw=JSON.stringify(checked);
 const bytes=new TextEncoder().encode(raw);
 if(bytes.length>2500)throw new Error('Challenge is too large to share');
 let characters='';for(const n of bytes)characters+=String.fromCharCode(n);
 return 'WV1.'+btoa(characters).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeArenaCode(code){
 if(typeof code!=='string'||!/^WV1\.[A-Za-z0-9_-]{20,4000}$/.test(code.trim()))throw new Error('Invalid WikiVerse challenge code');
 const encoded=code.trim().slice(4).replace(/-/g,'+').replace(/_/g,'/');
 let data;
 try{
  const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
  if(bytes.length>2500)throw new Error('Challenge too large');
  data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch{throw new Error('Challenge could not be decoded');}
 return validateArenaManifest(data);
}
export function sourceLinkChoices(current,next,seed,limit=4){
 if(!current?.identity||!Array.isArray(current.links)||!next?.title)throw new Error('Source links are unavailable');
 const links=[...new Set(current.links.map(normalizeTitle).filter(isArticleTitle))];
 if(!links.includes(normalizeTitle(next.title)))throw new Error('The pinned source does not link to the claimed target');
 const distractors=links.filter(x=>x!==normalizeTitle(next.title)).sort((a,b)=>hashSeed(a+seed)-hashSeed(b+seed));
 const options=[normalizeTitle(next.title),...distractors.slice(0,limit-1)];
 return options.sort((a,b)=>hashSeed(a+seed+':choice')-hashSeed(b+seed+':choice'));
}
export function gradeTrailChoice(manifest,step,choice){
 const checked=validateArenaManifest(manifest);
 if(!Number.isInteger(step)||step<0||step>=checked.proof.length-1)throw new Error('Invalid trail step');
 return normalizeTitle(choice)===checked.proof[step+1].title;
}
export function arenaAttempt(manifest,{mistakes=0,elapsedMs=0}={}){
 const challenge=validateArenaManifest(manifest);
 if(!Number.isSafeInteger(mistakes)||mistakes<0||mistakes>999||!Number.isSafeInteger(elapsedMs)||elapsedMs<0)throw new Error('Invalid local attempt');
 return {id:challenge.id+':'+Date.now(),kind:challenge.kind,challengeId:challenge.id,dailyKey:challenge.dailyKey,sourceIds:challenge.proof.map(articleKey),mistakes,elapsedMs,completedAt:new Date().toISOString(),ranked:false,score:null};
}
export function utcArenaDay(value=new Date()){return dateKey(value);}
