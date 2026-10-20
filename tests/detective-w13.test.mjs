import test from 'node:test';import assert from 'node:assert/strict';
import {originalReferenceUsage,normalizeCitationRecord,evidenceReflection} from '../src/domain/learning.mjs';
import {savedCitationReviews} from '../src/domain/study.mjs';
import {initialProgress,recordEvidenceReview,readProgress,saveProgress} from '../src/services/storage.mjs';
import {exportProgressBackup,inspectProgressBackup} from '../src/domain/backup.mjs';
const article={language:'en',pageId:900,revisionId:909,title:'Marie Curie'};
const c=(n,links,context='Original Wikipedia paragraph describes scientific research and cited publications.')=>
 normalizeCitationRecord({id:'cite_note-ref'+n,label:'Original bibliography record '+n+' about scientific research',context,links},article);
const records=[c(1,['https://example.org/shared','https://example.org/one']),c(2,['https://example.org/shared','https://example.org/two']),
 c(3,['https://example.org/three'])];
test('W13 article-wide external URL usage retains exact anchored citation contexts and shared instances',()=>{
 const result=originalReferenceUsage(records);
 assert.equal(result.total,4);assert.equal(result.groups[0].url,'https://example.org/shared');
 assert.equal(result.groups[0].occurrences,2);
 assert.deepEqual(result.groups[0].citations.map(c=>c.id),['cite_note-ref1','cite_note-ref2']);
 assert.ok(result.groups[0].citations.every(c=>c.sourceRevision.includes('oldid=909#cite_note')));
 assert.equal(result.authority,'literal-external-url-occurrence');
 assert.deepEqual(originalReferenceUsage(records,{reusedOnly:true}).groups.map(g=>g.url),['https://example.org/shared']);
 assert.equal(originalReferenceUsage(records,{query:'publication',limit:1}).shown,1);
 assert.equal(originalReferenceUsage(records,{limit:1}).truncated,true);
});
test('W13 source-reuse index fails closed on mixed revisions, unobserved URLs and invalid bounds',()=>{
 assert.throws(()=>originalReferenceUsage([...records,{...c(4,['https://example.org/changed']),article:{...article,revisionId:910}}]),/one pinned/);
 assert.equal(originalReferenceUsage(records,{query:'totally unavailable'}).total,0);
 assert.throws(()=>originalReferenceUsage(records,{limit:0}),/limit/);
});
test('W13 original private judgment is pinned, ungraded and distinct across reused citation IDs on different revisions',()=>{
 const one=evidenceReflection({citation:records[0],verdict:'unreviewed',note:'The original linked source was not available to evaluate.'});
 const other=evidenceReflection({citation:{...records[0],article:{...article,revisionId:910},sourceRevision:'https://en.wikipedia.org/w/index.php?oldid=910#cite_note-ref1'},verdict:'insufficient',note:'The other article revision needs separate review.'});
 assert.deepEqual(one.article,article);assert.equal(one.graded,false);
 let p=recordEvidenceReview(initialProgress(),one);p=recordEvidenceReview(p,other);
 assert.equal(p.evidenceReviews.length,2);
 p=recordEvidenceReview(p,evidenceReflection({citation:records[0],verdict:'supports',note:'My own checked source document agrees with the article wording.'}));
 assert.equal(p.evidenceReviews.length,2);assert.equal(savedCitationReviews(p).records.length,2);
 const journal=savedCitationReviews(p,{query:'original',verdict:'unreviewed'});
 assert.equal(journal.total,0); // original verdict was replaced, not the other revision.
});
test('W13 older reviews without article identity remain readable without invented source page',()=>{
 const old={id:'cite_note-ref1',source:'https://en.wikipedia.org/w/index.php?oldid=777#cite_note-ref1',note:'Legacy reviewer note requiring human source inspection.',verdict:'unreviewed',at:'2026-10-20T12:00:00Z',graded:false,links:['https://example.org/legacy']};
 const data=savedCitationReviews({...initialProgress(),evidenceReviews:[old]});
 assert.equal(data.records.length,1);assert.equal(data.records[0].article,null);
 assert.equal(data.records[0].source,old.source);
 assert.equal(savedCitationReviews({...initialProgress(),evidenceReviews:[old]},{verdict:'supports'}).total,0);
});
test('W13 original v1 persistence and backup preserve optional verified page source without changing schema',async()=>{
 const e=evidenceReflection({citation:records[1],verdict:'insufficient',note:'Cannot yet verify the original published scientific evidence.'});
 const data=recordEvidenceReview(initialProgress(),e);
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 saveProgress(data,storage);assert.deepEqual(readProgress(storage).evidenceReviews[0].article,article);
 const backup=await exportProgressBackup(data,new Date('2026-10-20T12:00:00Z'));
 const inspected=await inspectProgressBackup(backup);
 assert.equal(inspected.progress.evidenceReviews[0].source,e.source);
 assert.deepEqual({...inspected.progress.evidenceReviews[0].article},article);
});
