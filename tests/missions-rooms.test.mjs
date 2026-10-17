import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyMissionBoard,missionEvidence,milestoneBoard,recentWeek,utcDateOf,MISSION_RULES} from '../src/domain/missions.mjs';
import {sourceRelationQuestion,gradeRelationQuestion,knowledgeResult} from '../src/domain/knowledge.mjs';
import {createRoomInvite,encodeRoomInvite,decodeRoomInvite,localJoinIntent,validateRoomInvite} from '../src/domain/rooms.mjs';
import {buildArenaManifest} from '../src/domain/arena.mjs';
import {initialProgress,recordKnowledgeAttempt,readProgress,saveProgress} from '../src/services/storage.mjs';
const DAY='2026-10-16',NOW=new Date('2026-10-16T12:00:00Z');
const proof=[{language:'en',pageId:1,revisionId:111,title:'Mathematics'},{language:'en',pageId:2,revisionId:222,title:'Physics'},{language:'en',pageId:3,revisionId:333,title:'History'}];
const manifest=buildArenaManifest({seed:'practice_123',proof});
const graph={root:{id:'Q100',title:'Marie Curie'},edges:[
 {to:'Q200',title:'scientist',property:'P106',label:'occupation',sourceUrl:'https://www.wikidata.org/wiki/Q100#P106'},
 {to:'Q300',title:'Warsaw',property:'P19',label:'place of birth',sourceUrl:'https://www.wikidata.org/wiki/Q100#P19'},
 {to:'Q400',title:'research award',property:'P166',label:'award received',sourceUrl:'https://www.wikidata.org/wiki/Q100#P166'}
]};
test('Daily missions are stable by UTC day, bounded and never automatically completed',()=>{
 const a=dailyMissionBoard(initialProgress(),DAY),b=dailyMissionBoard(initialProgress(),DAY);
 assert.deepEqual(a,b);assert.equal(a.missions.length,5);assert.equal(a.completed,0);assert.equal(a.total,5);
 assert.ok(a.missions.every(x=>MISSION_RULES.some(r=>r.id===x.id)));
});
test('Daily evidence counts only original-record activities with matching UTC timestamps and source identities',()=>{
 const p={...initialProgress(),arenaAttempts:[{completedAt:DAY+'T16:10:00Z',sourceIds:['en:1:111','en:2:222','en:3:333'],ranked:false,score:null}],vocabulary:[{savedAt:DAY+'T09:10:00Z',article:{pageId:12,revisionId:14}}],mysteries:[{finishedAt:DAY+'T16:00:00Z',score:80,source:'https://www.wikidata.org/wiki/Q100'}]};
 assert.equal(missionEvidence(p,'article-trail',DAY).length,1);
 assert.equal(missionEvidence(p,'learn-word',DAY).length,1);
 assert.equal(missionEvidence(p,'source-mystery',DAY).length,1);
 assert.equal(missionEvidence(p,'article-trail','2026-10-15').length,0);
 assert.throws(()=>missionEvidence(p,'unsupported',DAY));
});
test('Missions do not convert private ungraded citation reasoning into factual scoring',()=>{
 const p={...initialProgress(),evidenceReviews:[{graded:false,at:DAY+'T10:00:00Z',source:'https://en.wikipedia.org/w/index.php?oldid=42'}]};
 assert.equal(missionEvidence(p,'investigate',DAY).length,1);
 const badges=milestoneBoard(p);assert.ok(badges.every(x=>x.scoreAuthority===false&&x.kind==='local-participation'));
});
test('Activity week uses actual past seven UTC dates and remains empty without records',()=>{
 const week=recentWeek(initialProgress(),DAY);
 assert.deepEqual(week.map(x=>x.date),['2026-10-10','2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16']);
 assert.ok(week.every(x=>x.activity===0));assert.equal(utcDateOf('not a date'),null);
});
test('Achievements are retroactive, source-record driven and remain local-participation labels',()=>{
 const p={...initialProgress(),races:[{sourceProof:[111,222,333]}],saved:{'en:1':{},'en:2':{},'en:3':{},'en:4':{},'en:5':{}},arenaAttempts:[{sourceIds:[1,2,3]},{sourceIds:[1,2,3]},{sourceIds:[1,2,3]}]};
 const board=milestoneBoard(p);assert.equal(board.find(x=>x.id==='first-race').earned,true);assert.equal(board.find(x=>x.id==='three-trails').earned,true);assert.equal(board.find(x=>x.id==='five-topics').earned,true);
});
test('Galaxy question options refer to observed P-statements, not invented properties',()=>{
 const q=sourceRelationQuestion(graph,0);
 assert.ok(q&&q.choices.length>=2);assert.ok(graph.edges.some(x=>x.property===q.answer&&x.to===q.target));
 assert.equal(gradeRelationQuestion(q,q.answer),true);
 const wrong=q.choices.find(x=>x.property!==q.answer).property;assert.equal(gradeRelationQuestion(q,wrong),false);
 assert.equal(q.kind,'wikidata-relationship');
});
test('Galaxy suppresses ambiguous relation targets and insufficient claims',()=>{
 assert.equal(sourceRelationQuestion({...graph,edges:graph.edges.slice(0,1)}),null);
 const duplicate={...graph,edges:[graph.edges[0],{...graph.edges[1],to:graph.edges[0].to}]};
 assert.equal(sourceRelationQuestion(duplicate),null);
});
test('Knowledge attempts preserve original QIDs/PID and grade only recorded statement identity',()=>{
 const q=sourceRelationQuestion(graph,0);
 const record=knowledgeResult(q,q.answer);assert.equal(record.correct,true);assert.equal(record.propertyId,q.answer);assert.equal(record.score,100);
 let p=recordKnowledgeAttempt(initialProgress(),record);
 assert.equal(p.knowledgeAttempts.length,1);
 const storage=new Map(),mock={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
 saveProgress(p,mock);p=readProgress(mock);assert.equal(p.knowledgeAttempts[0].source,q.source);
 assert.throws(()=>recordKnowledgeAttempt(p,{...record,scoringAuthority:'official-mastery'}));
});
test('Private invitation encodes identical canonical verified route without creating network authority',()=>{
 // encodeRoomInvite checks real current expiry; use a fresh fixture rather than weakening expiry enforcement.
 const clock=new Date();
 const invite=createRoomInvite(manifest,{name:'Friday Wiki Club',hostAlias:'Host',nonce:'123e4567-e89b-42d3-a456-426614174000',capacity:4,now:clock});
 const encoded=encodeRoomInvite(invite);assert.ok(encoded.startsWith('WVROOM1.'));
 const decoded=decodeRoomInvite(encoded,new Date(clock.getTime()+3*3600000));
 assert.deepEqual(decoded,invite);assert.equal(decoded.authoritative,false);assert.equal(decoded.transport,'portable-code-only');
 assert.deepEqual(decoded.manifest.proof,proof);
});
test('Private invitation refuses expired, bad metadata and ranked authority claims',()=>{
 const clock=new Date();
 const args={name:'Friday Wiki Club',hostAlias:'Host',nonce:'123e4567-e89b-42d3-a456-426614174000',capacity:4,now:clock};
 const invite=createRoomInvite(manifest,args);
 const encoded=encodeRoomInvite(invite);
 assert.throws(()=>decodeRoomInvite(encoded,new Date(clock.getTime()+2*86400000)),/expired/);
 assert.throws(()=>validateRoomInvite({...invite,capacity:100},clock));
 assert.throws(()=>validateRoomInvite({...invite,manifest:{...manifest,ranked:true}},clock));
 assert.throws(()=>decodeRoomInvite('WVROOM1.%%%'),/Invalid/);
});
test('Joining is an unconfirmed local intent, never registered participant presence',()=>{
 const invite=createRoomInvite(manifest,{name:'Friday Wiki Club',hostAlias:'Host',nonce:'123e4567-e89b-42d3-a456-426614174000',now:NOW});
 const intent=localJoinIntent(invite,{alias:'Guest',now:NOW});
 assert.equal(intent.presence,'NOT_CONNECTED');assert.equal(intent.membershipVerified,false);assert.equal(intent.ranked,false);assert.equal(intent.challengeId,invite.manifest.id);
 assert.throws(()=>localJoinIntent(invite,{alias:'Host',now:NOW}));
});
