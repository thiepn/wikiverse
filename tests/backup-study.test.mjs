import test from 'node:test';import assert from 'node:assert/strict';
import {initialProgress,readProgress,saveProgress,recordLinkLab} from '../src/services/storage.mjs';
import {recordReadingVisit,saveStudyNote,topicStudyJourney,reviewQueue} from '../src/domain/study.mjs';
import {exportProgressBackup,inspectProgressBackup,mergeProgress,prepareProgressRestore,commitPreparedRestore,progressCounts} from '../src/domain/backup.mjs';
import {buildLinkAudit,recordLinkAudit} from '../src/domain/linklab.mjs';
const maths={language:'en',pageId:1,revisionId:111,title:'Mathematics'};
const physics={language:'en',pageId:2,revisionId:222,title:'Physics'};
const now=new Date('2026-10-16T18:00:00.000Z');
const first={identity:maths,links:['Physics','Mathematics','Biology'],html:'<p>Verified</p>'},second={identity:physics,links:['Physics','Geography','Literature'],html:'<p>Physics</p>'};
function personal(){
 let p=initialProgress();
 p=recordReadingVisit(p,{article:maths,at:'2026-10-16T12:00:00Z'});
 p=recordReadingVisit(p,{article:physics,from:maths,at:'2026-10-16T12:01:00Z'});
 p=saveStudyNote(p,{article:maths,note:'Read the original source and compare the linked article.',status:'revisit',at:'2026-10-16T12:05:00Z'});
 p={...p,saved:{'en:1':{...maths,savedAt:'2026-10-16T12:02:00Z'}},races:[{id:'old-route',sourceProof:[111,222,333]}]};
 const q=buildLinkAudit(first,second,{seed:'backup-test'});
 p=recordLinkLab(p,recordLinkAudit(q,q.choices.find(x=>x!==q.answer)));
 return p;
}
const mock=()=>{const data=new Map();return {data,getItem:k=>data.get(k),setItem:(k,value)=>data.set(k,value)};};
test('User-owned backup roundtrip preserves canonical sources, private notes, histories and one canonical progress engine',async()=>{
 const p=personal(),file=await exportProgressBackup(p,now),result=await inspectProgressBackup(file);
 assert.equal(result.exportedAt,now.toISOString());assert.equal(result.counts.studyNotes,1);
 assert.equal(result.progress.readingHistory[0].from.pageId,1);assert.equal(result.progress.saved['en:1'].revisionId,111);
 assert.equal(result.progress.races[0].id,'old-route');
 assert.equal(result.kind,'wikiverse-local-backup');assert.match(result.integrity,/not authentication/);
 assert.equal(JSON.parse(file).format,1);
});
test('Backup is rejected after any mutation of embedded progress without matching SHA256',async()=>{
 const file=await exportProgressBackup(personal(),now);
 const altered=JSON.parse(file);altered.progress.studyNotes[0].note='A modified note';
 await assert.rejects(()=>inspectProgressBackup(JSON.stringify(altered)),/checksum mismatch/);
});
test('Unsupported file kinds, missing metadata, oversized files and malformed JSON cannot mutate device state',async()=>{
 for(const s of ['{oops',JSON.stringify({kind:'unknown'}),'X'.repeat(1_151_000)]){
  await assert.rejects(()=>inspectProgressBackup(s));
 }
 const state=mock(),p=personal();saveProgress(p,state);
 assert.equal(readProgress(state).studyNotes[0].note,p.studyNotes[0].note);
});
test('Export requires valid canonical bookmarked identity and note source, rejects conflicting local authority claims',async()=>{
 const p=personal();
 await assert.rejects(()=>exportProgressBackup({...p,saved:{'en:9':p.saved['en:1']}},now),/identity mismatch/);
 await assert.rejects(()=>exportProgressBackup({...p,studyNotes:[{...p.studyNotes[0],source:'https://example.org/fake'}]},now),/source-linked/);
 await assert.rejects(()=>exportProgressBackup({...p,arenaAttempts:[{ranked:true,score:300,sourceIds:['a','b','c']}]},now),/arena/);
});
test('Local backup export/import refuses prototype-polluted root keys instead of using them',async()=>{
 const p=personal(),tmp={...p};
 Object.defineProperty(tmp,'__proto__',{value:{isAdmin:true},enumerable:true});
 await assert.rejects(()=>exportProgressBackup(tmp,now),/Unsupported progress schema/);
});
test('Merge combines independent local records and keeps existing private notes and decisions on collisions',()=>{
 const local=personal(),incoming=personal();
 incoming.studyNotes=[{...incoming.studyNotes[0],note:'Conflicting note from another device.'}];
 incoming.readingHistory=[{...incoming.readingHistory[0],id:'en:2:222:new',at:'2026-10-16T14:00:00Z'},...incoming.readingHistory];
 const {progress,conflicts}=mergeProgress(local,incoming);
 assert.equal(progress.studyNotes[0].note,local.studyNotes[0].note);
 assert.equal(progress.races.length,1);
 assert.equal(progress.readingHistory.length,3);
 assert.ok(conflicts.studyNotes>=1);
 assert.equal(progress.daily.race,null);
});
test('Merge refuses over-capacity lists atomically instead of truncating source history',()=>{
 const local=initialProgress(),other=initialProgress();
 local.races=Array.from({length:100},(_,i)=>({id:'local-'+i}));
 other.races=[{id:'incoming'}];
 assert.throws(()=>mergeProgress(local,other),/exceeds 100/);
 const storage=mock();saveProgress(local,storage);
 assert.equal(readProgress(storage).races.length,100);
});
test('Restore preview is explicit; merge/replacement preserve version one and quota failures cannot overwrite original data',async()=>{
 const local=personal(),incoming={...initialProgress(),studyNotes:[],races:[{id:'other-race'}]};
 const inspection=await inspectProgressBackup(await exportProgressBackup(incoming,now));
 const preview=prepareProgressRestore(local,inspection,'merge');
 assert.equal(preview.resultCounts.races,2);assert.equal(preview.resultCounts.studyNotes,1);
 const replacement=prepareProgressRestore(local,inspection,'replace');
 assert.equal(replacement.resultCounts.studyNotes,0);assert.equal(replacement.resultCounts.races,1);
 const storage=mock();saveProgress(local,storage);
 const failing={...storage,setItem(){throw new Error('Quota exceeded');}};
 assert.throws(()=>commitPreparedRestore(preview,failing),/Quota exceeded/);
 assert.equal(readProgress(storage).studyNotes.length,1);
 commitPreparedRestore(replacement,storage);
 assert.equal(readProgress(storage).races[0].id,'other-race');assert.equal(readProgress(storage).studyNotes.length,0);
});
test('Existing local app v1 progress roundtrips without schema migration or duplicate stores',async()=>{
 const storage=mock();saveProgress(personal(),storage);
 const original=readProgress(storage);const file=await exportProgressBackup(original,now);
 const checked=await inspectProgressBackup(file);
 const preview=prepareProgressRestore(original,checked,'merge');
 commitPreparedRestore(preview,storage);
 assert.equal(readProgress(storage).races[0].id,'old-route');
 assert.equal(readProgress(storage).studyNotes.length,1);
});
test('Article-specific study path is derived from genuine read, inline link, bookmark, correct Link Lab grade and private note',()=>{
 let p=personal();let plan=topicStudyJourney(p,maths);
 assert.equal(plan.total,5);assert.equal(plan.done,4);
 assert.equal(plan.steps.find(x=>x.id==='practice').done,false);
 const q=buildLinkAudit(first,second,{seed:'verified'});
 p=recordLinkLab(p,recordLinkAudit(q,q.answer));
 plan=topicStudyJourney(p,maths);
 assert.equal(plan.done,5);assert.equal(plan.authority,'source-actions-only-not-mastery');
 assert.equal(topicStudyJourney(p,physics).done,1);
});
test('Wrong answer is not counted as completed topic exercise or source mastery',()=>{
 let p=personal();const plan=topicStudyJourney(p,maths);
 assert.equal(plan.steps.find(x=>x.id==='practice').count,0);
 assert.equal(plan.steps.find(x=>x.id==='practice').done,false);
 assert.ok(reviewQueue(p,now).some(x=>x.kind==='linklab'));
});
