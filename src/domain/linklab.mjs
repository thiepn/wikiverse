/** Two Wikipedia revision snapshots supply every answer and distractor. */
import {hashSeed,normalizeTitle,isArticleTitle,articleKey} from './game.mjs';
export function buildLinkAudit(primary,contrast,{seed='article-lab',limit=4}={}){
 if(![3,4,5].includes(limit))throw new Error('Link question supports 3, 4 or 5 choices');
 const p=primary?.identity,c=contrast?.identity;
 if(!p||!c||p.language!==c.language||p.pageId===c.pageId||!Number.isSafeInteger(p.revisionId)||!Number.isSafeInteger(c.revisionId))throw new Error('Two different pinned Wikipedia pages required');
 if(!Array.isArray(primary.links)||!Array.isArray(contrast.links))throw new Error('Original article links unavailable');
 const normalize=x=>[...new Set(x.map(normalizeTitle).filter(isArticleTitle))];
 const yes=normalize(primary.links),no=normalize(contrast.links).filter(x=>!yes.includes(x)&&x!==normalizeTitle(p.title));
 if(yes.length<1||no.length<(limit===5?4:2))throw new Error('Not enough distinct source-verified links for a fair question');
 const answer=[...yes].sort((a,b)=>a.localeCompare(b,'en'))[hashSeed(seed+':answer')%yes.length];
 const decoys=[...no].sort((a,b)=>hashSeed(seed+':'+a)-hashSeed(seed+':'+b)).slice(0,Math.min(limit-1,no.length));
 const choices=[answer,...decoys].sort((a,b)=>hashSeed(seed+':choice:'+a)-hashSeed(seed+':choice:'+b));
 return {kind:'wikipedia-outgoing-link',id:'link:'+articleKey(p)+':'+articleKey(c)+':'+hashSeed(seed+':'+answer),seed,primary:p,contrast:c,answer,choices,sourceUrls:['https://'+p.language+'.wikipedia.org/w/index.php?oldid='+p.revisionId,'https://'+c.language+'.wikipedia.org/w/index.php?oldid='+c.revisionId],scoreAuthority:'pinned-article-links',ranked:false};
}
export function gradeLinkAudit(question,value){return ['wikipedia-outgoing-link','wikipedia-common-link','wikipedia-link-origin'].includes(question?.kind)&&question.choices.includes(value)&&question.answer===value;}
export function recordLinkAudit(question,value){
 if(!question?.sourceUrls?.length||!question.choices?.includes(value)||question.scoreAuthority!=='pinned-article-links')throw new Error('Invalid sourced link audit');
 const correct=gradeLinkAudit(question,value);
 return {id:question.id+':'+Date.now(),kind:question.kind,mode:'linklab',primary:question.primary,contrast:question.contrast,selected:value,correct,score:correct?100:0,ranked:false,at:new Date().toISOString(),sourceUrls:[...question.sourceUrls],sourceIds:[articleKey(question.primary),articleKey(question.contrast)],scoringAuthority:'pinned-article-links'};
}
export function linkAuditNextHint(question){if(question?.kind==='wikipedia-link-origin')return 'Inspect both original source link lists.';return question?.kind==='wikipedia-outgoing-link'?'Inspect the original links of '+question.primary.title+'.':question?.kind==='wikipedia-common-link'?'Inspect the outgoing links of both source revisions.':null;}

/** Another distinct challenge: recognize a title that BOTH historical article revisions link to. */
export function buildCommonLinkAudit(primary,contrast,{seed='common-links',limit=4}={}){
 if(![3,4,5].includes(limit))throw new Error('Common link question supports 3, 4 or 5 choices');
 const p=primary?.identity,c=contrast?.identity;
 if(!p||!c||p.language!==c.language||p.pageId===c.pageId||!Number.isSafeInteger(p.revisionId)||!Number.isSafeInteger(c.revisionId))throw new Error('Two distinct canonical revision identities required');
 const unique=x=>[...new Set((x||[]).map(normalizeTitle).filter(isArticleTitle))];
 const first=unique(primary.links),second=unique(contrast.links);
 const common=first.filter(x=>second.includes(x)),oneOnly=[...new Set([...first.filter(x=>!second.includes(x)),...second.filter(x=>!first.includes(x))])];
 if(!common.length||oneOnly.length<(limit===5?4:2))throw new Error('Insufficient overlapping and exclusive source links');
 const answer=[...common].sort((a,b)=>a.localeCompare(b,'en'))[hashSeed(seed+':common')%common.length];
 const wrong=oneOnly.sort((a,b)=>hashSeed(seed+':false:'+a)-hashSeed(seed+':false:'+b)).slice(0,Math.min(limit-1,oneOnly.length));
 return {kind:'wikipedia-common-link',id:'shared:'+articleKey(p)+':'+articleKey(c)+':'+hashSeed(seed+':'+answer),seed,primary:p,contrast:c,answer,choices:[answer,...wrong].sort((a,b)=>hashSeed(seed+':sort:'+a)-hashSeed(seed+':sort:'+b)),sourceUrls:['https://'+p.language+'.wikipedia.org/w/index.php?oldid='+p.revisionId,'https://'+c.language+'.wikipedia.org/w/index.php?oldid='+c.revisionId],scoreAuthority:'pinned-article-links',ranked:false};
}

/** Literal outward-link membership across two separately pinned Wikipedia revisions.
 * No target page revision, semantic relationship or citation authenticity is inferred. */
export function linkSetEvidence(primary,contrast,{query='',filter='all',limit=80}={}){
 const a=primary?.identity,b=contrast?.identity;
 if(!a||!b||a.language!==b.language||a.pageId===b.pageId||
   !Number.isSafeInteger(a.pageId)||a.pageId<=0||!Number.isSafeInteger(b.pageId)||b.pageId<=0||
   !Number.isSafeInteger(a.revisionId)||a.revisionId<=0||!Number.isSafeInteger(b.revisionId)||b.revisionId<=0||
   !Array.isArray(primary.links)||!Array.isArray(contrast.links))throw new Error('Two distinct original Wikipedia link sets are required');
 if(!['all','shared','primary','contrast'].includes(filter))throw new Error('Unsupported original link category');
 if(!Number.isSafeInteger(limit)||limit<1||limit>120)throw new Error('Unsupported original link inspection limit');
 const cleaned=links=>[...new Set(links.map(normalizeTitle).filter(isArticleTitle))];
 const first=cleaned(primary.links),second=cleaned(contrast.links),seen=new Set([...first,...second]);
 const firstSet=new Set(first),secondSet=new Set(second);
 const all=[...seen].map(title=>({title,category:firstSet.has(title)?(secondSet.has(title)?'shared':'primary'):'contrast',
   primaryHasLink:firstSet.has(title),contrastHasLink:secondSet.has(title)}))
   .sort((x,y)=>x.title.localeCompare(y.title,'en'));
 const counts={all:all.length,shared:all.filter(x=>x.category==='shared').length,
   primary:all.filter(x=>x.category==='primary').length,contrast:all.filter(x=>x.category==='contrast').length};
 const term=String(query||'').trim().normalize('NFC').toLocaleLowerCase('en').slice(0,100);
 const visible=all.filter(x=>(filter==='all'||x.category===filter)&&(!term||x.title.normalize('NFC').toLocaleLowerCase('en').includes(term)));
 return {primary:a,contrast:b,counts,shown:Math.min(limit,visible.length),matching:visible.length,
   truncated:visible.length>limit,records:visible.slice(0,limit),sourceUrls:[
   'https://'+a.language+'.wikipedia.org/w/index.php?oldid='+a.revisionId,
   'https://'+b.language+'.wikipedia.org/w/index.php?oldid='+b.revisionId]};
}
/** Third independent Link Lab task: classify a real outgoing title by source membership.
 * The original q.answer/choices contract and single grader remain authoritative. */
/** @param {any} primary @param {any} contrast @param {{seed?:string,target?:string|null}} [options] */
export function buildLinkOriginAudit(primary,contrast,{seed='link-origin',target=null}={}){
 const evidence=linkSetEvidence(primary,contrast,{limit:120});
 // Target must be in original evidence; never synthesize a title or target revision.
 const original=target?evidence.records.find(x=>x.title===normalizeTitle(target)):null;
 if(target&&!original)throw new Error('Selected link is absent from these original revisions');
 const groups=['shared','primary','contrast'].filter(k=>evidence.counts[k]>0);
 if(!groups.length)throw new Error('No original outbound links available to classify');
 const available=groups.filter(k=>evidence.records.some(x=>x.category===k));
 const category=available[hashSeed(seed+':category')%available.length];
 const eligible=target?[original]:evidence.records.filter(x=>x.category===category);
 // The bounded explorer should not cause missing eligible categories on larger real articles.
 if(!eligible.length)throw new Error('No inspected original link is available for this challenge');
 const row=eligible[hashSeed(seed+':target')%eligible.length];
 const p=evidence.primary,c=evidence.contrast;
 return {kind:'wikipedia-link-origin',id:'origin:'+articleKey(p)+':'+articleKey(c)+':'+hashSeed(seed+':'+row.title),
   seed,primary:p,contrast:c,subject:row.title,answer:row.category,choices:['primary','contrast','shared'],
   sourceUrls:evidence.sourceUrls,scoreAuthority:'pinned-article-links',ranked:false};
}
