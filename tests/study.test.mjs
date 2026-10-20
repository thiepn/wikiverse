import test from 'node:test';import assert from 'node:assert/strict';
import {recordReadingVisit,checkedArticle,sourceRevisionUrl,saveStudyNote,removeStudyNote,studyTopics,readingJourney,reviewQueue,deferReview,journeyStats} from '../src/domain/study.mjs';
import {replayLinkAudit,createLinkAudit} from '../src/services/linklab.mjs';
import {initialProgress,recordLinkLab,readProgress,saveProgress} from '../src/services/storage.mjs';
import {buildLinkAudit,recordLinkAudit,buildCommonLinkAudit,gradeLinkAudit} from '../src/domain/linklab.mjs';
import {clearApiCache} from '../src/services/wikimedia.mjs';
const t='2026-10-16T09:00:00Z';
const maths={language:'en',pageId:1,revisionId:111,title:'Mathematics'},phys={language:'en',pageId:2,revisionId:222,title:'Physics'};
const first={identity:maths,links:['Physics','Biology','Astronomy'],html:'<p>Mathematics</p>'},second={identity:phys,links:['Physics','Biology','Literature','Geography'],html:'<p>Physics</p>'};
test('Study records actual canonical reading identities and distinguishes source-link transitions',()=>{
 let p=recordReadingVisit(initialProgress(),{article:maths,at:t});
 p=recordReadingVisit(p,{article:phys,from:maths,at:'2026-10-16T09:01:00Z'});
 assert.equal(p.readingHistory.length,2);assert.equal(p.readingHistory[0].from.pageId,1);
 assert.equal(p.readingHistory[0].kind,'source-link');
 assert.equal(p.readingHistory[1].source,sourceRevisionUrl(maths));
 assert.equal(journeyStats(p,new Date(t)).uniqueRead,2);
 assert.throws(()=>recordReadingVisit(p,{article:{...maths,revisionId:0}}));
});
test('Repeat reading within 30 seconds does not inflate journal but deliberate revisit does',()=>{
 let p=recordReadingVisit(initialProgress(),{article:maths,at:t});
 p=recordReadingVisit(p,{article:maths,at:'2026-10-16T09:00:07Z'});assert.equal(p.readingHistory.length,1);
 p=recordReadingVisit(p,{article:maths,at:'2026-10-16T09:02:00Z'});assert.equal(p.readingHistory.length,2);
});
test('Private notes are bounded, replace per canonical page without deleting original progress and can be removed',()=>{
 let p=recordReadingVisit(initialProgress(),{article:maths,at:t});
 p=saveStudyNote(p,{article:maths,note:'Investigate source definitions tomorrow.',status:'revisit',at:t});
 p=saveStudyNote(p,{article:{...maths,revisionId:112},note:'Compare the next article revision.',status:'open',at:'2026-10-16T11:00:00Z'});
 assert.equal(p.studyNotes.length,1);assert.equal(p.studyNotes[0].article.revisionId,112);
 assert.equal(p.readingHistory.length,1);
 assert.throws(()=>saveStudyNote(p,{article:maths,note:'a',status:'open'}));
 assert.throws(()=>saveStudyNote(p,{article:maths,note:'correct',status:'officially mastered'}));
 assert.equal(removeStudyNote(p,'en:1').studyNotes.length,0);
});
test('Study topics deduplicate by article language/pageId across notes, reading and bookmarks',()=>{
 let p=recordReadingVisit(initialProgress(),{article:maths,at:t});
 p={...p,saved:{'en:1':{...maths,savedAt:t},'en:2':{...phys,savedAt:'2026-10-16T10:00:00Z'}}};
 p=saveStudyNote(p,{article:maths,note:'Question for next reading.',at:t});
 const topics=studyTopics(p);assert.equal(topics.length,2);assert.equal(new Set(topics.map(x=>x.key)).size,2);
 assert.equal(readingJourney(p).length,1);
});
test('Missed link practice enters review queue only from original pinned article identities',()=>{
 const q=buildLinkAudit(first,second,{seed:'review-123'});
 let p=recordLinkLab(initialProgress(),recordLinkAudit(q,q.choices.find(x=>x!==q.answer)));
 let queue=reviewQueue(p,new Date('2026-10-17T00:00:00Z'));
 assert.equal(queue.length,1);assert.equal(queue[0].kind,'linklab');assert.equal(queue[0].article.pageId,1);assert.equal(queue[0].contrast.revisionId,222);
 p=deferReview(p,queue[0].key,3,new Date('2026-10-17T00:00:00Z'));
 queue=reviewQueue(p,new Date('2026-10-17T00:00:00Z'));assert.equal(queue[0].due,false);
 assert.equal(queue[0].manuallyDeferred,true);
 assert.equal(journeyStats(p,new Date('2026-10-17T00:00:00Z')).reviewDue,0);
});
test('Flagged notes can be deferred independently; original results and grades remain unchanged',()=>{
 let p=saveStudyNote(initialProgress(),{article:maths,note:'Recheck mathematics references.',status:'revisit',at:t});
 const item=reviewQueue(p,new Date('2026-10-16T12:00:00Z'))[0];
 assert.equal(item.kind,'note');assert.equal(item.due,true);
 p=deferReview(p,item.key,7,new Date('2026-10-16T12:00:00Z'));
 assert.equal(reviewQueue(p,new Date('2026-10-17T12:00:00Z'))[0].due,false);
 assert.equal(reviewQueue(p,new Date('2026-10-24T12:00:00Z'))[0].due,true);
});
test('Study data remains in existing version-one local progress without rewriting old races',()=>{
 const r=[{id:'original-race',sourceProof:[111,222,333]}];let p={...initialProgress(),races:r};
 p=recordReadingVisit(p,{article:maths,at:t});
 p=saveStudyNote(p,{article:maths,note:'Remember why this source mattered.',status:'revisit',at:t});
 const map=new Map(),mock={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 saveProgress(p,mock);const restored=readProgress(mock);
 assert.equal(restored.races[0].id,'original-race');assert.equal(restored.studyNotes[0].note,p.studyNotes[0].note);assert.equal(restored.readingHistory.length,1);
});
test('Pinned Link Lab review rejects wrong page IDs after source hydration',async()=>{
 clearApiCache();const original=globalThis.fetch;
 globalThis.fetch=async url=>{const id=Number(new URL(url).searchParams.get('oldid'));const p=id===111?first:second;
 return {ok:true,status:200,json:async()=>({parse:{title:p.identity.title,pageid:id===111?444:p.identity.pageId,revid:id,text:p.html,links:p.links.map(t=>({ns:0,'*':t}))}})};};
 try{await assert.rejects(()=>replayLinkAudit({article:maths,contrast:phys}),/identity changed/);}finally{globalThis.fetch=original;}
});
test('Pinned Link Lab review regenerates source-only questions for exact validated historic pair',async()=>{
 clearApiCache();const original=globalThis.fetch;
 globalThis.fetch=async url=>{const id=Number(new URL(url).searchParams.get('oldid'));const p=id===111?first:second;
 return {ok:true,status:200,json:async()=>({parse:{title:p.identity.title,pageid:p.identity.pageId,revid:id,text:p.html,links:p.links.map(t=>({ns:0,'*':t}))}})};};
 try{
  const r=await replayLinkAudit({article:maths,contrast:phys});
  assert.equal(r.question.primary.revisionId,111);assert.equal(r.question.contrast.revisionId,222);
  assert.ok(r.question.choices.includes(r.question.answer));assert.ok(r.common);
  assert.equal(gradeLinkAudit(r.common,r.common.answer),true);
 }finally{globalThis.fetch=original;}
});
test('Common-link answer records grade of active question, not an unrelated outgoing question',()=>{
 const a=buildLinkAudit(first,second,{seed:'one'}),b=buildCommonLinkAudit(first,second,{seed:'two'});
 const response=recordLinkAudit(b,b.answer);
 assert.equal(response.kind,'wikipedia-common-link');assert.equal(response.correct,true);assert.equal(response.selected,b.answer);
 assert.equal(recordLinkLab(initialProgress(),response).linkLab.length,1);
 assert.ok(a.kind!==b.kind);
});
