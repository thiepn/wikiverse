/** Personal, local-only reading continuity; no invented source history or proficiency. */
import {normalizeTitle,isArticleTitle,articleKey} from './game.mjs';
const LANGUAGES=new Set(['en','fr','de','ko','tr']);
export function checkedArticle(input){
 if(!input||!LANGUAGES.has(input.language)||!Number.isSafeInteger(input.pageId)||input.pageId<=0||!Number.isSafeInteger(input.revisionId)||input.revisionId<=0||!isArticleTitle(input.title))throw new Error('A real Wikipedia page and revision identity are required');
 return {language:input.language,pageId:input.pageId,revisionId:input.revisionId,title:normalizeTitle(input.title)};
}
export function sourceRevisionUrl(id){const x=checkedArticle(id);return 'https://'+x.language+'.wikipedia.org/w/index.php?oldid='+x.revisionId;}
/** @param {any} progress @param {{article:any, from?:any, at?:string}} event */
export function recordReadingVisit(progress,{article,from=null,at=new Date().toISOString()}){
 const identity=checkedArticle(article),prior=from?checkedArticle(from):null;
 if(!Number.isFinite(Date.parse(at)))throw new Error('Invalid reading timestamp');
 if(prior&&prior.language!==identity.language)throw new Error('Source-link transitions must remain within the same Wikipedia edition');
 const x={id:articleKey(identity)+':'+at,article:identity,from:prior,at,kind:prior?'source-link':'opened-article',source:sourceRevisionUrl(identity)};
 const existing=(progress.readingHistory||[]);
 // Avoid double counting accidental immediate same-article render while retaining deliberate returns.
 const latest=existing[0];
 if(latest?.article?.language===identity.language&&latest?.article?.pageId===identity.pageId&&Math.abs(Date.parse(at)-Date.parse(latest.at))<30000)return progress;
 return {...progress,readingHistory:[x,...existing].slice(0,140)};
}
export function saveStudyNote(progress,{article,note,status='open',at=new Date().toISOString()}){
 const identity=checkedArticle(article),text=String(note||'').trim();
 if(text.length<3||text.length>1600||!['open','revisit','archived'].includes(status)||!Number.isFinite(Date.parse(at)))throw new Error('Enter a 3–1600 character note and valid reading status');
 const key=identity.language+':'+identity.pageId;
 const entry={key,article:identity,note:text,status,updatedAt:at,source:sourceRevisionUrl(identity)};
 return {...progress,studyNotes:[entry,...(progress.studyNotes||[]).filter(x=>x.key!==key)].slice(0,120)};
}
export function removeStudyNote(progress,key){if(typeof key!=='string'||!/^([a-z]{2}):\d+$/.test(key))throw new Error('Invalid note identity');return {...progress,studyNotes:(progress.studyNotes||[]).filter(x=>x.key!==key)};}
export function studyTopics(progress){
 const topics=new Map();
 const add=(id,origin,at)=>{try{const article=checkedArticle(id),key=article.language+':'+article.pageId;if(!topics.has(key))topics.set(key,{key,article,origin,at:at||''});}catch{}};
 for(const n of progress.studyNotes||[])add(n.article,'note',n.updatedAt);
 for(const x of progress.readingHistory||[])add(x.article,'reading',x.at);
 for(const x of Object.values(progress.saved||{}))add(x,'saved',x.savedAt);
 return [...topics.values()].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,75);
}
export function readingJourney(progress,limit=18){
 const list=(progress.readingHistory||[]).filter(x=>{try{return !!checkedArticle(x.article);}catch{return false;}});
 return list.slice(0,Math.max(1,Math.min(75,limit)));
}
export function reviewQueue(progress,now=new Date()){
 const keys=new Map(),today=now.getTime();
 const add=(entry)=>{const previous=keys.get(entry.key);if(!previous||entry.originAt>previous.originAt)keys.set(entry.key,entry);};
 for(const result of progress.linkLab||[]){
  if(result.correct!==false||!result.primary||!result.contrast||!['wikipedia-outgoing-link','wikipedia-common-link'].includes(result.kind))continue;
  try{
   const article=checkedArticle(result.primary),contrast=checkedArticle(result.contrast),key='link:'+articleKey(article)+':'+articleKey(contrast);
   add({key,kind:'linklab',article,contrast,headline:'Recheck original article links',detail:'Previously missed a pinned-revision link question',originAt:result.at||'',source:sourceRevisionUrl(article)});
  }catch{}
 }

 // Other engines remain the only graders. These are review pointers, not replayed or rescored attempts.
 const allowedRevision=url=>typeof url==='string'&&/^https:\/\/(?:en|fr|de|ko|tr)\.wikipedia\.org\/w\/index\.php\?oldid=[1-9]\d*(?:#[a-zA-Z0-9%_.:-]+)?$/.test(url);
 const allowedData=url=>typeof url==='string'&&(url==='https://wikimedia.org/api/rest_v1/metrics/pageviews'||/^https:\/\/www\.wikidata\.org\/wiki\/Q[1-9]\d*(?:#P[1-9]\d*)?$/.test(url));
 const addSource=(r,mode,kind,title)=>{
  if(r?.correct!==false||!Number.isFinite(Date.parse(r.at))||!(allowedRevision(r.source)||allowedData(r.source)))return;
  const id=String(r.id||r.sourceIds?.join(':')||r.source).slice(0,180);
  if(!id||/[<>]/.test(id))return;
  const key='review:'+mode+':'+id;
  add({key,kind,mode,article:null,headline:title,detail:'Revisit the original recorded evidence; a fresh challenge uses its own source and grader',originAt:r.at,source:r.source});
 };
 for(const r of progress.learning||[])if((r.mode==='polyglot'&&r.kind==='source-cloze')||(r.mode==='detective'&&r.kind==='citation-identity'))addSource(r,r.mode,'source-exercise',r.mode==='polyglot'?'Revisit an original-language passage':'Inspect the cited original reference');
 for(const r of progress.historyChallenges||[])if((r.mode==='pulse'&&r.kind==='pageviews-comparison')||(r.mode==='capsule'&&r.kind==='revision-change'))addSource(r,r.mode,'source-exercise',r.mode==='pulse'?'Recheck the actual pageview comparison':'Reinspect an original article change');
 for(const r of progress.knowledgeAttempts||[])if(r.mode==='galaxy'&&r.kind==='wikidata-relationship'&&r.scoringAuthority==='wikidata-property-identity-only')addSource(r,'galaxy','source-exercise','Review a recorded Wikidata relation');

 for(const n of progress.studyNotes||[])if(n.status==='revisit'){
  try{const article=checkedArticle(n.article),key='note:'+article.language+':'+article.pageId;
   add({key,kind:'note',article,headline:'Review your research note',detail:n.note.slice(0,130),originAt:n.updatedAt,source:sourceRevisionUrl(article)});
  }catch{}
 }
 return [...keys.values()].map(x=>{
  const mark=progress.reviewMarkers?.[x.key];
  const dueAt=mark?.nextAt&&Number.isFinite(Date.parse(mark.nextAt))?mark.nextAt:x.originAt;
  return {...x,dueAt,due:Date.parse(dueAt)<=today,manuallyDeferred:!!mark?.nextAt};
 }).sort((a,b)=>Number(b.due)-Number(a.due)||a.dueAt.localeCompare(b.dueAt)).slice(0,60);
}
export function deferReview(progress,key,days=1,now=new Date()){
 if(typeof key!=='string'||key.length>300||![1,3,7,14].includes(days)||!Number.isFinite(now.getTime()))throw new Error('Invalid review schedule');
 const exists=reviewQueue(progress,now).some(x=>x.key===key);
 if(!exists)throw new Error('Review is no longer available');
 return {...progress,reviewMarkers:{...(progress.reviewMarkers||{}),[key]:{lastReviewedAt:now.toISOString(),nextAt:new Date(now.getTime()+days*86400000).toISOString(),type:'manual-revisit-reminder'}}};
}
export function journeyStats(progress,now=new Date()){
 const topics=studyTopics(progress),queue=reviewQueue(progress,now),visits=readingJourney(progress,75);
 const visitedKeys=new Set(visits.map(x=>x.article.language+':'+x.article.pageId));
 return {topics:topics.length,visits:visits.length,uniqueRead:visitedKeys.size,notes:(progress.studyNotes||[]).length,reviewDue:queue.filter(x=>x.due).length,progressAuthority:'local-actions-not-mastery'};
}

/** A guided, source-specific cross-mode journey derived from original records. No separate canonical plan store or mastery. */
export function topicStudyJourney(progress,source){
 const identity=checkedArticle(source),key=identity.language+':'+identity.pageId;
 const recordedRead=(progress.readingHistory||[]).filter(x=>x.article?.language===identity.language&&x.article?.pageId===identity.pageId);
 const outbound=(progress.readingHistory||[]).filter(x=>x.from?.language===identity.language&&x.from?.pageId===identity.pageId&&x.article?.pageId!==identity.pageId);
 const links=(progress.linkLab||[]).filter(x=>x.primary?.language===identity.language&&x.primary?.pageId===identity.pageId&&x.correct===true&&x.scoringAuthority==='pinned-article-links');
 const note=(progress.studyNotes||[]).find(x=>x.key===key);
 const bookmarked=Boolean(progress.saved?.[key]);
 const steps=[
  {id:'read',title:'Open the original article',detail:'Inspect the source text and its revision identity',done:recordedRead.length>0,action:'read',count:recordedRead.length},
  {id:'navigate',title:'Follow a genuine article link',detail:'Continue from this page into a related Wikipedia article',done:outbound.length>0,action:'read',count:outbound.length},
  {id:'bookmark',title:'Keep the article in My Universe',detail:'Save the canonical Wikipedia article identity',done:bookmarked,action:'save',count:Number(bookmarked)},
  {id:'practice',title:'Answer a verified source-link question',detail:'Only correct answers from the original Link Lab grader count',done:links.length>0,action:'practice',count:links.length},
  {id:'reflect',title:'Write your personal research note',detail:'Save a private explanation or question linked to a source revision',done:!!note,action:'note',count:Number(!!note)}
 ];
 return {article:identity,steps,done:steps.filter(x=>x.done).length,total:steps.length,authority:'source-actions-only-not-mastery',next:steps.find(x=>!x.done)||null};
}
