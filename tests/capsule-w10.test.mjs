import test from 'node:test';import assert from 'node:assert/strict';
import {revisionEvidence,selectArchiveRevisions,paragraphChanges,changeChallenge,gradeChange} from '../src/domain/history.mjs';
const identity=(rev)=>({language:'en',pageId:900,title:'Marie Curie',revisionId:rev});
const prior={identity:identity(5002),paragraphs:[
 'Original research describes laboratory observations in scientific history and primary published records.',
 'This common article paragraph documents the original history and its scientific interpretation.',
 'An early paragraph concerning research sources existed only in the earlier Wikipedia revision.'
]};
const subsequent={identity:identity(5008),paragraphs:[
 'This common article paragraph documents the original history and its scientific interpretation.',
 'A later paragraph records additional sources and details about the original documented experiments.',
 'Another paragraph in this revision discusses the chronology of original scholarly publications.'
]};
test('W10 parallel source paragraphs preserve exact original revision identities and literal categories',()=>{
 const x=revisionEvidence(prior,subsequent);
 assert.deepEqual([x.identity.pageId,x.identity.earlierId,x.identity.laterId],[900,5002,5008]);
 assert.equal(x.before[1].status,'present-in-both');assert.equal(x.after[0].status,'present-in-both');
 assert.equal(x.before[2].status,'only-in-this-revision');assert.equal(x.after[1].status,'only-in-this-revision');
 assert.equal(x.graded,false);assert.equal(x.method,'exact-normalized-paragraph-presence');
 assert.ok(x.sourceUrls.every(u=>u.startsWith('https://en.wikipedia.org/w/index.php?oldid=')));
});
test('W10 bounded original side-by-side evidence reports omitted records rather than hiding truncation',()=>{
 const a=revisionEvidence(prior,subsequent,1);
 assert.deepEqual([a.beforeShown,a.beforeTotal,a.afterShown,a.afterTotal],[1,3,1,3]);
 assert.throws(()=>revisionEvidence(prior,subsequent,0),/limit/);
 assert.throws(()=>revisionEvidence(prior,{...subsequent,identity:{...subsequent.identity,pageId:901}}),/same Wikipedia page/);
 assert.throws(()=>revisionEvidence(prior,{...subsequent,identity:identity(5002)}),/distinct/);
 assert.throws(()=>revisionEvidence(prior,{identity:subsequent.identity,paragraphs:null}),/Missing/);
});
test('W10 original graded changed-paragraph engine remains separate from inspectable source evidence',()=>{
 const oldDiff=paragraphChanges(prior,subsequent);const q=changeChallenge(oldDiff,'w10');
 assert.ok(q);assert.equal(gradeChange(q,q.answer),true);
 assert.equal(revisionEvidence(prior,subsequent).graded,false);
});
test('W10 archive navigation filters only authentic page-owned revision entries and UTC metadata',()=>{
 const records=[{revisionId:5008,pageId:900,language:'en',timestamp:'2026-10-15T12:00:00Z',comment:'Source bibliography'},
 {revisionId:5005,pageId:900,language:'en',timestamp:'2026-10-12T12:00:00Z',comment:'Wording'},
 {revisionId:5002,pageId:900,language:'en',timestamp:'2026-10-08T12:00:00Z',comment:'Reference maintenance'},
 {revisionId:999,pageId:901,language:'en',timestamp:'2026-10-15T12:00:00Z',comment:'Other page'}];
 const archive={identity:{language:'en',pageId:900},revisions:records};
 assert.deepEqual(selectArchiveRevisions(archive).map(x=>x.revisionId),[5008,5005,5002]);
 assert.deepEqual(selectArchiveRevisions(archive,{query:'reference'}).map(x=>x.revisionId),[5002]);
 assert.deepEqual(selectArchiveRevisions(archive,{fromDate:'2026-10-10',toDate:'2026-10-12'}).map(x=>x.revisionId),[5005]);
 assert.throws(()=>selectArchiveRevisions(archive,{fromDate:'2026-1-10'}),/Invalid/);
});
