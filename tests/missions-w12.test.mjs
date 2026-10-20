import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyMissionBoard,missionRecordDetails,missionDayHistory,missionEvidence,recentWeek} from '../src/domain/missions.mjs';
import {initialProgress,readProgress,saveProgress} from '../src/services/storage.mjs';
import {exportProgressBackup,inspectProgressBackup} from '../src/domain/backup.mjs';
const DAY='2026-10-20',BEFORE='2026-10-19';
const article={language:'en',pageId:101,revisionId:1111,title:'Marie Curie'};
const contrast={language:'en',pageId:102,revisionId:2222,title:'Physics'};
const p={...initialProgress(),
 vocabulary:[{savedAt:DAY+'T09:00:00Z',article,term:'laboratory',meaning:'user-authored original term'}],
 evidenceReviews:[{at:DAY+'T10:00:00Z',graded:false,source:'https://en.wikipedia.org/w/index.php?oldid=1111',note:'Original historical source checked'}],
 linkLab:[{at:DAY+'T12:00:00Z',kind:'wikipedia-link-origin',correct:true,scoringAuthority:'pinned-article-links',ranked:false,
  primary:article,contrast,sourceIds:['en:101:1111','en:102:2222'],sourceUrls:['https://en.wikipedia.org/w/index.php?oldid=1111','https://en.wikipedia.org/w/index.php?oldid=2222']}],
 historyChallenges:[{at:DAY+'T13:00:00Z',mode:'pulse',correct:true,sourceIds:['en:101:1111'],source:'https://wikimedia.org/api/rest_v1/metrics/pageviews'}],
 arenaAttempts:[{completedAt:DAY+'T13:00:00Z',score:null,ranked:false,sourceIds:['en:101:1111','en:102:2222','en:103:3333']}],
 mysteries:[{finishedAt:BEFORE+'T23:20:00Z',score:85,source:'https://www.wikidata.org/wiki/Q7186'}]
};
test('W12 original mission evidence preserves exact UTC date and source IDs without a new scheduler',()=>{
 const x=missionRecordDetails(p,'link-audit',DAY);
 assert.equal(x.total,1);assert.equal(x.records[0].article.revisionId,1111);
 assert.deepEqual(x.records[0].sourceUrls.map(v=>v.url),[
  'https://en.wikipedia.org/w/index.php?oldid=1111','https://en.wikipedia.org/w/index.php?oldid=2222']);
 assert.equal(x.records[0].authority,'original-local-source-record');
 assert.equal(missionRecordDetails(p,'link-audit',BEFORE).total,0);
 assert.equal(missionRecordDetails(p,'source-change',DAY).records[0].mode,'pulse');
 assert.equal(missionRecordDetails(p,'investigate',DAY).records[0].authority,'ungraded-original-review');
 assert.equal(missionRecordDetails(p,'source-mystery',BEFORE).records[0].sourceUrls[0].url,'https://www.wikidata.org/wiki/Q7186');
});
test('W12 directly saved original source revisions, private observations and unsafe urls remain correctly separated',()=>{
 const clone={...p,evidenceReviews:[...p.evidenceReviews,{at:DAY+'T13:00:00Z',graded:false,source:'javascript:alert(1)',note:'not valid source'}]};
 const e=missionRecordDetails(clone,'investigate',DAY);
 assert.equal(e.total,2);
 assert.equal(e.records[0].sourceUrls[0].url,'https://en.wikipedia.org/w/index.php?oldid=1111');
 assert.deepEqual(e.records[1].sourceUrls,[]);
 assert.equal(missionRecordDetails(p,'learn-word',DAY).records[0].article.language,'en');
 assert.deepEqual(missionRecordDetails(p,'article-trail',DAY).records[0].sourceUrls.map(x=>x.url),[
  'https://en.wikipedia.org/w/index.php?oldid=1111','https://en.wikipedia.org/w/index.php?oldid=2222','https://en.wikipedia.org/w/index.php?oldid=3333']);
});
test('W12 selected historical day is reconstructed only from the existing actual mission rule and saved events',()=>{
 for(const date of [DAY,BEFORE]){
  const history=missionDayHistory(p,date);
  assert.deepEqual(history.missions,dailyMissionBoard(p,date).missions);
  assert.equal(history.missions.length,5);assert.equal(history.evidence.length,5);
  assert.equal(history.completed,history.evidence.filter(r=>r.total>0).length);
  for(const detail of history.evidence)assert.equal(detail.total,missionEvidence(p,detail.id,date).length);
 }
 assert.deepEqual(recentWeek(p,DAY).map(x=>x.date).at(-1),DAY);
});
test('W12 large original mission records have explicit truncation without losing the actual record count',()=>{
 const large={...p,vocabulary:Array.from({length:23},(_,i)=>({...p.vocabulary[0],term:'term '+i}))};
 const evidence=missionRecordDetails(large,'learn-word',DAY,4);
 assert.deepEqual([evidence.total,evidence.shown,evidence.records.length,evidence.truncated],[23,4,4,true]);
 assert.throws(()=>missionRecordDetails(p,'learn-word',DAY,0),/limit/);
 assert.throws(()=>missionRecordDetails(p,'invented',DAY),/Unknown mission/);
});
test('W12 evidence projection does not introduce a new persistent store or change original v1 backup records',async()=>{
 const memory=new Map(),store={getItem:key=>memory.get(key),setItem:(key,value)=>memory.set(key,value)};
 const baseline=JSON.stringify(p),before=missionDayHistory(p,DAY);
 saveProgress(p,store);
 const restored=readProgress(store);
 const after=missionDayHistory(restored,DAY);
 assert.deepEqual(after,before);assert.equal(JSON.stringify(p),baseline);
 assert.equal(restored.version,1);
 // Original backup remains responsible for accepting or rejecting owner records.
 const canonical=initialProgress();
 const backup=await exportProgressBackup(canonical,new Date('2026-10-20T00:00:00Z'));
 const inspection=await inspectProgressBackup(backup);
 assert.equal(inspection.progress.version,1);
});
