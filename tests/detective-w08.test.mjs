import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeCitationRecord,searchableCitations,citationComparison,adjacentCitation,evidenceReflection} from '../src/domain/learning.mjs';
import {initialProgress,recordEvidenceReview,readProgress,saveProgress} from '../src/services/storage.mjs';
const source={language:'en',pageId:100,revisionId:909,title:'Marie Curie'};
const row=(i,label,context,links)=>normalizeCitationRecord({id:'cite_note-ref'+i,label,context,links},source);
const citations=[
 row(1,'Original research publication on radioactivity','An original Wikipedia paragraph reports that studies investigated particular radioactive materials.', ['https://example.org/research','https://example.org/first']),
 row(2,'Historical scientific bibliography discussion','A separate Wikipedia paragraph describes research methods and another documented publication.', ['https://example.org/research','https://example.org/second']),
 row(3,'Documented scholarly methods and archives','A third paragraph summarizes scientific archives and independent historical context.', ['https://example.org/third'])
];
test('W08 literal original citation search keeps source sequence, NFC matching and canonical link identity',()=>{
 assert.deepEqual(searchableCitations(citations,'example.org/research').map(x=>x.id),['cite_note-ref1','cite_note-ref2']);
 assert.deepEqual(searchableCitations(citations,'SCIENTIFIC').map(x=>x.id),['cite_note-ref2','cite_note-ref3']);
 assert.deepEqual(searchableCitations([...citations,citations[0]]).map(x=>x.id),citations.map(x=>x.id));
 assert.deepEqual(searchableCitations(citations,'not observed'),[]);
});
test('W08 side-by-side original comparison reports only exact source evidence and literal shared URLs',()=>{
 const report=citationComparison(citations,['cite_note-ref1','cite_note-ref2']);
 assert.equal(report.graded,false);assert.equal(report.kind,'literal-original-citation-comparison');
 assert.deepEqual(report.sharedUrls,['https://example.org/research']);
 assert.equal(report.identicalPassages,false);
 assert.deepEqual(report.citations.map(x=>x.sourceRevision),citations.slice(0,2).map(x=>x.sourceRevision));
 assert.deepEqual(report.citations.map(x=>x.id),['cite_note-ref1','cite_note-ref2']);
 assert.equal(report.article.revisionId,909);
 const three=citationComparison(citations,citations.map(x=>x.id));
 assert.deepEqual(three.sharedUrls,[]);
});
test('W08 comparison cannot mix mismatched original revisions, fake citations or duplicate references',()=>{
 assert.throws(()=>citationComparison(citations,['cite_note-ref1','cite_note-ref1']),/distinct/);
 assert.throws(()=>citationComparison(citations,['cite_note-ref1','cite_note-fake']),/no longer available/);
 const changed=row(4,'Another documented scientific source','An original article paragraph with distinct historical evidence.', ['https://example.org/other']);
 assert.throws(()=>citationComparison([...citations,{...changed,article:{...source,revisionId:910}}],['cite_note-ref1','cite_note-ref4']),/unrelated revisions/);
});
test('W08 source citation navigation moves within authentic available records only',()=>{
 assert.equal(adjacentCitation(citations,'cite_note-ref1',1).id,'cite_note-ref2');
 assert.equal(adjacentCitation(citations,'cite_note-ref2',-1).id,'cite_note-ref1');
 assert.equal(adjacentCitation(citations,'cite_note-ref3',1),null);
 assert.equal(adjacentCitation(citations,'unknown',1),null);
 assert.throws(()=>adjacentCitation(citations,'cite_note-ref1',0),/Unsupported/);
});
test('W08 private manual evaluation continues through the single original v1 review writer and backup-safe identity',()=>{
 const reflection=evidenceReflection({citation:citations[1],verdict:'unreviewed',note:'The linked source cannot be assessed until reading the external publication.'});
 const saved=recordEvidenceReview(initialProgress(),reflection);
 const memory=new Map(),store={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
 saveProgress(saved,store);
 const restored=readProgress(store);
 assert.equal(restored.evidenceReviews.length,1);
 assert.equal(restored.evidenceReviews[0].source,citations[1].sourceRevision);
 assert.equal(restored.evidenceReviews[0].graded,false);
});
