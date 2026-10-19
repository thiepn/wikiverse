import test from 'node:test';import assert from 'node:assert/strict';
import {linkSetEvidence,buildLinkOriginAudit,gradeLinkAudit,recordLinkAudit} from '../src/domain/linklab.mjs';
import {recordLinkLab,initialProgress,readProgress,saveProgress} from '../src/services/storage.mjs';
import {exportProgressBackup,inspectProgressBackup,commitInspectedRestore} from '../src/domain/backup.mjs';
const page=(title,pageId,revisionId,links)=>({identity:{title,language:'en',pageId,revisionId},links});
const a=page('Mathematics',11,111,['Physics','Astronomy','Biology','shared test','Physics']);
const b=page('Marie Curie',22,222,['Physics','Biology','Chemistry','History','shared test']);
test('W11 link-set explorer separates only actual shared and exclusive pinned links, without deduping source facts by guess',()=>{
 const e=linkSetEvidence(a,b);
 assert.deepEqual(e.counts,{all:6,shared:3,primary:1,contrast:2});
 assert.deepEqual(linkSetEvidence(a,b,{filter:'primary'}).records.map(x=>x.title),['Astronomy']);
 assert.deepEqual(linkSetEvidence(a,b,{filter:'contrast'}).records.map(x=>x.title),['Chemistry','History']);
 assert.deepEqual(linkSetEvidence(a,b,{query:'BIOLOGY'}).records.map(x=>x.category),['shared']);
 assert.equal(e.records.find(x=>x.title==='Physics').primaryHasLink,true);
 assert.deepEqual(e.sourceUrls,['https://en.wikipedia.org/w/index.php?oldid=111','https://en.wikipedia.org/w/index.php?oldid=222']);
});
test('W11 bounded explorer reports actual matching size, truncation and rejected cross-edition pairing',()=>{
 const e=linkSetEvidence(a,b,{limit:2});assert.equal(e.matching,6);assert.equal(e.shown,2);assert.equal(e.truncated,true);
 assert.throws(()=>linkSetEvidence(a,{...b,identity:{...b.identity,language:'fr'}}),/distinct original/);
 assert.throws(()=>linkSetEvidence(a,b,{filter:'madeup'}),/Unsupported/);
 assert.throws(()=>linkSetEvidence(a,b,{limit:0}),/limit/);
});
test('W11 source-membership question uses three original answer categories and existing grader/record writer',()=>{
 for(const [target,kind] of [['Astronomy','primary'],['History','contrast'],['Physics','shared']]){
  const q=buildLinkOriginAudit(a,b,{seed:'fixed',target});
  assert.equal(q.subject,target);assert.equal(q.kind,'wikipedia-link-origin');assert.equal(q.answer,kind);
  assert.deepEqual(q.choices,['primary','contrast','shared']);
  assert.equal(gradeLinkAudit(q,kind),true);assert.equal(gradeLinkAudit(q,kind==='primary'?'shared':'primary'),false);
  assert.equal(buildLinkOriginAudit(a,b,{seed:'fixed',target}).id,q.id);
  const entry=recordLinkAudit(q,kind);assert.equal(entry.ranked,false);assert.equal(entry.scoringAuthority,'pinned-article-links');
  assert.equal(recordLinkLab(initialProgress(),entry).linkLab.length,1);
 }
 assert.throws(()=>buildLinkOriginAudit(a,b,{target:'Invented article'}),/absent/);
});
test('W11 rotating replay remains deterministic from unchanged original snapshots and progress v1 survives backup round trip',()=>{
 const q=buildLinkOriginAudit(a,b,{seed:'round-7'});
 assert.deepEqual(q,buildLinkOriginAudit(a,b,{seed:'round-7'}));
 let p=recordLinkLab(initialProgress(),recordLinkAudit(q,q.answer));
 const map=new Map(),store={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 saveProgress(p,store);p=readProgress(store);
 assert.equal(p.linkLab[0].kind,'wikipedia-link-origin');assert.equal(p.linkLab[0].sourceIds.length,2);
 assert.equal(p.linkLab[0].ranked,false);
});
test('W11 v1 backup export, verified readback, and owner-controlled restore preserve new unranked original source-classification record',async()=>{
 const q=buildLinkOriginAudit(a,b,{seed:'backup-round',target:'Astronomy'});
 const source=recordLinkLab(initialProgress(),recordLinkAudit(q,q.answer));
 const bytes=await exportProgressBackup(source,new Date('2026-10-19T13:00:00Z'));
 const inspected=await inspectProgressBackup(bytes);
 assert.equal(inspected.progress.linkLab.length,1);
 assert.equal(inspected.progress.linkLab[0].kind,'wikipedia-link-origin');
 assert.equal(inspected.progress.linkLab[0].ranked,false);
 const map=new Map(),store={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};
 const restored=commitInspectedRestore(initialProgress(),inspected,'replace',store);
 assert.equal(restored.version,1);assert.deepEqual(readProgress(store).linkLab,source.linkLab);
});
