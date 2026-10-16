/** Two Wikipedia revision snapshots supply every answer and distractor. */
import {hashSeed,normalizeTitle,isArticleTitle,articleKey} from './game.mjs';
export function buildLinkAudit(primary,contrast,{seed='article-lab',limit=4}={}){
 const p=primary?.identity,c=contrast?.identity;
 if(!p||!c||p.language!==c.language||p.pageId===c.pageId||!Number.isSafeInteger(p.revisionId)||!Number.isSafeInteger(c.revisionId))throw new Error('Two different pinned Wikipedia pages required');
 if(!Array.isArray(primary.links)||!Array.isArray(contrast.links))throw new Error('Original article links unavailable');
 const normalize=x=>[...new Set(x.map(normalizeTitle).filter(isArticleTitle))];
 const yes=normalize(primary.links),no=normalize(contrast.links).filter(x=>!yes.includes(x)&&x!==normalizeTitle(p.title));
 if(yes.length<1||no.length<2)throw new Error('Not enough distinct source-verified links for a fair question');
 const answer=[...yes].sort((a,b)=>a.localeCompare(b,'en'))[hashSeed(seed+':answer')%yes.length];
 const decoys=[...no].sort((a,b)=>hashSeed(seed+':'+a)-hashSeed(seed+':'+b)).slice(0,Math.min(limit-1,no.length));
 const choices=[answer,...decoys].sort((a,b)=>hashSeed(seed+':choice:'+a)-hashSeed(seed+':choice:'+b));
 return {kind:'wikipedia-outgoing-link',id:'link:'+articleKey(p)+':'+articleKey(c)+':'+hashSeed(seed+':'+answer),seed,primary:p,contrast:c,answer,choices,sourceUrls:['https://'+p.language+'.wikipedia.org/w/index.php?oldid='+p.revisionId,'https://'+c.language+'.wikipedia.org/w/index.php?oldid='+c.revisionId],scoreAuthority:'pinned-article-links',ranked:false};
}
export function gradeLinkAudit(question,value){return question?.kind==='wikipedia-outgoing-link'&&question.choices.includes(value)&&question.answer===value;}
export function recordLinkAudit(question,value){
 if(!question?.sourceUrls?.length||!question.choices?.includes(value)||question.scoreAuthority!=='pinned-article-links')throw new Error('Invalid sourced link audit');
 const correct=gradeLinkAudit(question,value);
 return {id:question.id+':'+Date.now(),kind:'wikipedia-outgoing-link',mode:'linklab',primary:question.primary,contrast:question.contrast,selected:value,correct,score:correct?100:0,ranked:false,at:new Date().toISOString(),sourceUrls:[...question.sourceUrls],sourceIds:[articleKey(question.primary),articleKey(question.contrast)],scoringAuthority:'pinned-article-links'};
}
export function linkAuditNextHint(question){return question?.kind==='wikipedia-outgoing-link'?'Inspect the original links of '+question.primary.title+'.':null;}
