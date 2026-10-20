import test from 'node:test';import assert from 'node:assert/strict';
import {sourceClip,saveSourceClip,removeSourceClip,clipsForArticle} from '../src/domain/study.mjs';
import {initialProgress,readProgress,saveProgress} from '../src/services/storage.mjs';
import {exportProgressBackup,inspectProgressBackup,mergeProgress,commitInspectedRestore} from '../src/domain/backup.mjs';
import {loadLanguagePair} from '../src/services/learning.mjs';
import {clearApiCache} from '../src/services/wikimedia.mjs';
const fr={language:'fr',pageId:125,revisionId:456,title:'Marie Curie'},en={language:'en',pageId:100,revisionId:300,title:'Marie Curie'};
const sample='Cette chercheuse utilisait des méthodes expérimentales rigoureuses pour analyser les matériaux.';
const store=()=>{const memory=new Map();return {getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};};
test('User-selected French source excerpt stays explicitly ungraded and bound to original revision URL',()=>{
 const result=sourceClip({article:fr,excerpt:sample,at:'2026-10-17T07:00:00Z'});
 assert.equal(result.kind,'user-selected-source-excerpt');assert.equal(result.graded,false);
 assert.equal(result.source,'https://fr.wikipedia.org/w/index.php?oldid=456');
 assert.equal(result.article.pageId,125);
 assert.match(result.id,/^clip:fr:125:456:/);
});
test('Two language editions never collapse into one stored excerpt; identical selections deduplicate',()=>{
 let p=initialProgress();
 p=saveSourceClip(p,{article:fr,excerpt:sample});
 p=saveSourceClip(p,{article:fr,excerpt:sample});
 assert.equal(p.sourceClips.length,1);
 p=saveSourceClip(p,{article:en,excerpt:sample});
 assert.equal(p.sourceClips.length,2);
 assert.equal(clipsForArticle(p,fr).length,1);
 assert.equal(clipsForArticle(p,en).length,1);
 assert.equal(removeSourceClip(p,p.sourceClips[0].id).sourceClips.length,1);
});
test('Source clips reject unverified identity, oversized excerpt and invented upstream authority',()=>{
 assert.throws(()=>sourceClip({article:{...fr,revisionId:0},excerpt:sample}),/real Wikipedia/);
 assert.throws(()=>sourceClip({article:fr,excerpt:'short'}),/12–360/);
 assert.throws(()=>sourceClip({article:fr,excerpt:'A'.repeat(361)}),/12–360/);
});
test('Source excerpt survives original guest store and user-owned backup export/import without new engine',async()=>{
 let p=saveSourceClip(initialProgress(),{article:fr,excerpt:sample});
 const local=store();saveProgress(p,local);assert.equal(readProgress(local).sourceClips.length,1);
 const archive=await exportProgressBackup(p,new Date('2026-10-17T09:00:00Z'));
 const restored=await inspectProgressBackup(archive);
 assert.equal(restored.progress.sourceClips[0].source,'https://fr.wikipedia.org/w/index.php?oldid=456');
 const other=saveSourceClip(initialProgress(),{article:en,excerpt:sample});
 const combined=mergeProgress(other,restored.progress);
 assert.equal(combined.progress.sourceClips.length,2);
 commitInspectedRestore(other,restored,'merge',local);
 assert.equal(readProgress(local).sourceClips.length,2);
});
test('Legacy v1 progress backups without the new excerpts collection still restore unchanged',async()=>{
 const previous=initialProgress();delete previous.sourceClips;
 // Construct an authentic previous-epoch payload and recompute its unkeyed checksum.
 const payload={kind:'wikiverse-local-backup',format:1,exportedAt:'2026-10-17T09:00:00.000Z',progress:previous};
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)));
 const sha256=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const checked=await inspectProgressBackup(JSON.stringify({...payload,sha256}));
 assert.deepEqual(checked.progress.sourceClips,[]);
});
test('Backup refuses tampered source excerpt identities and source URLs even with correctly recomputed checksum on export',async()=>{
 const p=saveSourceClip(initialProgress(),{article:fr,excerpt:sample});
 for(const tamper of [clip=>({...clip,source:'https://external.test/fake'}),clip=>({...clip,graded:true}),clip=>({...clip,excerpt:'Modified quotation not in same note.'})]){
  await assert.rejects(()=>exportProgressBackup({...p,sourceClips:[tamper(p.sourceClips[0])]}),/canonical source excerpt/);
 }
});
const record=(language='fr',qid='Q7186')=>({action:'query',query:{pages:[{pageprops:{wikibase_item:qid}}]}});
function pairFetch({badSecondary=false,missingSecondary=false}={}){
 const requested=[];
 async function fetcher(input){
  const u=new URL(input),action=u.searchParams.get('action'),language=u.hostname.split('.')[0];requested.push([action,language]);
  let body;
  if(action==='query')body={query:{pages:[{pageprops:{wikibase_item:language==='de'&&badSecondary?'Q999':language==='de'&&missingSecondary?undefined:'Q7186'}}]}};
  else if(action==='wbgetentities')body={entities:{Q7186:{id:'Q7186',sitelinks:{enwiki:{title:'Marie Curie'},dewiki:{title:'Marie Curie'}}}}};
  else if(action==='parse')body={parse:{title:'Marie Curie',pageid:language==='de'?122:100,revid:language==='de'?880:300,text:'<p>Original sourced article content</p>',links:[]}};
  else throw Error('Unexpected action '+action);
  return {ok:true,status:200,json:async()=>body};
 }
 return {fetcher,requested};
}
test('WikiPolyglot independently revalidates original English and German Wikipedia article QIDs',async()=>{
 clearApiCache();const previous=globalThis.fetch,fixture=pairFetch();globalThis.fetch=fixture.fetcher;
 try{const r=await loadLanguagePair('Marie Curie','de');assert.equal(r.qid,'Q7186');assert.equal(r.verifiedSitelinks,true);assert.equal(r.articles.de.identity.revisionId,880);assert.ok(fixture.requested.some(x=>x[0]==='query'&&x[1]==='de'));}finally{globalThis.fetch=previous;}
});
test('WikiPolyglot refuses unrelated German page after redirect, never grades a QID mismatch',async()=>{
 clearApiCache();const previous=globalThis.fetch;globalThis.fetch=pairFetch({badSecondary:true}).fetcher;
 try{await assert.rejects(()=>loadLanguagePair('Marie Curie','de'),/entities disagree/);}finally{globalThis.fetch=previous;}
});
test('WikiPolyglot refuses missing secondary language QID instead of assuming a translation',async()=>{
 clearApiCache();const previous=globalThis.fetch;globalThis.fetch=pairFetch({missingSecondary:true}).fetcher;
 try{await assert.rejects(()=>loadLanguagePair('Marie Curie','de'),/entities disagree/);}finally{globalThis.fetch=previous;}
});
