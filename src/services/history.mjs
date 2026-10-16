import {apiRequest,wikipediaApi,loadArticle} from './wikimedia.mjs';
import {pulseWindow,pulsePath,normalizePageviews,normalizeRevisions,paragraphChanges,historicalWindow,normalizeRevisionPage,safeRevisionCursor} from '../domain/history.mjs';
const cache=new Map();const pending=new Map();const LIMIT=24;let nextAllowed=0;let chain=Promise.resolve();
import {isArticleTitle} from '../domain/game.mjs';
const API='https://wikimedia.org';
export function clearPulseCache(){cache.clear();pending.clear();}
export function analyticsRequest(path,{fetcher=fetch,ttl=6*3600000}={}){
 if(typeof path!=='string'||!/^\/api\/rest_v1\/metrics\/pageviews\/per-article\/(en|de|fr|ko|tr)\.wikipedia\.org\/all-access\/user\//.test(path))throw new Error('Unsupported analytics endpoint');
 const url=API+path;const v=cache.get(url);if(v&&v.until>Date.now())return Promise.resolve(v.payload);
 if(pending.has(url))return pending.get(url);
 const job=chain=chain.catch(()=>{}).then(async()=>{
  const delay=Math.max(0,250-(Date.now()-nextAllowed));if(delay)await new Promise(ok=>setTimeout(ok,delay));nextAllowed=Date.now();
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),14000);
  try{
   const response=await fetcher(url,{signal:controller.signal,headers:{Accept:'application/json'}});
   if(response.status===429)throw new Error('Wikimedia Analytics rate limit reached. Retry later.');
   if(!response.ok)throw new Error('Wikimedia Analytics unavailable ('+response.status+').');
   const payload=await response.json();
   cache.set(url,{payload,until:Date.now()+ttl});if(cache.size>LIMIT)cache.delete(cache.keys().next().value);
   return payload;
  }finally{clearTimeout(timer);}
 });
 pending.set(url,job);return job.finally(()=>pending.delete(url));
}
export async function loadPageviews(title,{language='en',days=30,now=new Date(),fetcher=fetch}={}){
 const window=pulseWindow(days,now);const path=pulsePath(language,title,window);
 const data=await analyticsRequest(path,{fetcher});return {...normalizePageviews(data,{language,title,start:window.start,end:window.end}),source:API+path};
}
export async function loadRevisionList(title,{language='en',limit=20}={}){
 if(!Number.isInteger(limit)||limit<2||limit>30)throw new Error('Invalid revision limit');
 const data=await apiRequest(wikipediaApi(language),{action:'query',prop:'revisions',titles:title,redirects:'1',rvprop:'ids|timestamp|size|comment',rvlimit:limit,rvdir:'older'},{ttl:10*60000});
 return normalizeRevisions(data,{language,title});
}
export async function compareRevisions(history,olderId,newerId){
 if(!history?.identity?.pageId||!history.revisions?.length)throw new Error('Invalid revision history');
 const old=history.revisions.find(x=>x.revisionId===Number(olderId));
 const current=history.revisions.find(x=>x.revisionId===Number(newerId));
 if(!old||!current||old.timestamp>=current.timestamp)throw new Error('Choose an earlier revision and a later revision');
 const [before,after]=await Promise.all([loadArticle(history.identity.title,old.revisionId,old.language),loadArticle(history.identity.title,current.revisionId,current.language)]);
 if(before.identity.pageId!==history.identity.pageId||after.identity.pageId!==history.identity.pageId)throw new Error('Revisions no longer match original article');
 const paragraphs=page=>{
  const doc=new DOMParser().parseFromString(page.html,'text/html');
  doc.querySelectorAll('script,style,table,nav,.references,.reflist,.navbox,.hatnote').forEach(x=>x.remove());
  return [...doc.querySelectorAll('p')].map(p=>p.textContent?.trim()||'');
 };
 return {...paragraphChanges({...before,paragraphs:paragraphs(before)},{...after,paragraphs:paragraphs(after)}),earlier:old,later:current};
}

/** Date-scoped revision browsing. The cursor is opaque, used only for the same bounded query. */
export async function loadRevisionWindow(title,{language='en',endDate,days=30,limit=20,cursor=null,pageId=null}={}){
 const window=historicalWindow(endDate,days);
 if(!isArticleTitle(title)||!Number.isInteger(limit)||limit<2||limit>30)throw new Error('Invalid date-scoped revision request');
 if(cursor&&!safeRevisionCursor(cursor))throw new Error('Invalid continuation token');
 if(cursor&&(!Number.isSafeInteger(pageId)||pageId<=0))throw new Error('Continuation requires verified page identity');
 const args={action:'query',prop:'revisions',rvprop:'ids|timestamp|size|comment',rvlimit:limit,rvdir:'older',rvstart:window.rvstart,rvend:window.rvend};
 if(cursor){args.pageids=String(pageId);args.rvcontinue=cursor;}else{args.titles=title;args.redirects='1';}
 const payload=await apiRequest(wikipediaApi(language),args,{ttl:10*60000});
 const result=normalizeRevisionPage(payload,{language,title,expectedPageId:cursor?pageId:null});
 return {...result,window};
}
