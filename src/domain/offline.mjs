/** Owner-chosen, bounded, TEXT-ONLY reading copy. Neither an upstream cache nor grading evidence. */
import {checkedArticle,sourceRevisionUrl} from './study.mjs';
export const MAX_OFFLINE_ARTICLES=8;
export const MAX_OFFLINE_SECTIONS=24;
export const MAX_OFFLINE_CHARS=10000;
export const MAX_OFFLINE_TOTAL_CHARS=78000;
const plain=x=>typeof x==='string' ? x.replace(/\s+/g,' ').trim() : '';
const counts=items=>items.reduce((sum,item)=>sum+item.sections.reduce((n,text)=>n+text.length,0),0);
export function offlineSnapshot({article,sections,at=new Date().toISOString(),truncated=false}){
 const identity=checkedArticle(article);
 if(!Array.isArray(sections)||!sections.length||sections.length>MAX_OFFLINE_SECTIONS||typeof truncated!=='boolean'||typeof at!=='string'||!Number.isFinite(Date.parse(at)))throw new Error('Offline reading requires bounded original text and a valid timestamp');
 const clean=sections.map(plain);
 if(clean.some((s,i)=>s.length<30||s.length>1100||s!==sections[i])||clean.reduce((n,s)=>n+s.length,0)>MAX_OFFLINE_CHARS)throw new Error('Offline reading text exceeds the safe excerpt bounds');
 return {key:identity.language+':'+identity.pageId,article:identity,sections:clean,source:sourceRevisionUrl(identity),capturedAt:at,kind:'owner-selected-offline-reading-v1',graded:false,truncated};
}
export function checkedOfflineSnapshot(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid offline reading record');
 const keys=['article','capturedAt','graded','key','kind','sections','source','truncated'];
 if(Object.keys(value).sort().join('|')!==keys.sort().join('|')||value.kind!=='owner-selected-offline-reading-v1'||value.graded!==false)throw new Error('Invalid offline reading authority or fields');
 const validated=offlineSnapshot({article:value.article,sections:value.sections,at:value.capturedAt,truncated:value.truncated});
 if(value.key!==validated.key||value.source!==validated.source)throw new Error('Offline reading source identity mismatch');
 return validated;
}
export function saveOfflineSnapshot(progress,value){
 const copy=checkedOfflineSnapshot(value),before=progress.offlineArticles||[];
 const all=[copy,...before.filter(x=>x.key!==copy.key)];
 if(all.length>MAX_OFFLINE_ARTICLES||counts(all)>MAX_OFFLINE_TOTAL_CHARS)throw new Error('Offline shelf is full. Remove an old reading copy first; existing data was not changed.');
 return {...progress,offlineArticles:all};
}
export function removeOfflineSnapshot(progress,key){
 if(typeof key!=='string'||! /^(en|fr|de|ko|tr):[1-9]\d*$/.test(key))throw new Error('Invalid offline article identity');
 return {...progress,offlineArticles:(progress.offlineArticles||[]).filter(x=>x.key!==key)};
}
export function offlineSnapshotFor(progress,article){
 const id=checkedArticle(article);
 return (progress.offlineArticles||[]).find(x=>x.key===id.language+':'+id.pageId)||null;
}
export function verifyOfflineCollection(items){
 if(!Array.isArray(items)||items.length>MAX_OFFLINE_ARTICLES)throw new Error('Invalid offline reading collection');
 const checked=items.map(checkedOfflineSnapshot),ids=new Set(checked.map(x=>x.key));
 if(ids.size!==checked.length||counts(checked)>MAX_OFFLINE_TOTAL_CHARS)throw new Error('Offline reading collection exceeds capacity or has duplicate article identities');
 return checked;
}
