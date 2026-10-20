import test from 'node:test';import assert from 'node:assert/strict';
import {buildLinkAudit,buildCommonLinkAudit,gradeLinkAudit,recordLinkAudit} from '../src/domain/linklab.mjs';
import {createLinkAudit} from '../src/services/linklab.mjs';
import {retryDelayMs,validateApiPayload,apiRequest,clearApiCache,loadArticle} from '../src/services/wikimedia.mjs';
import {parseRoomClientCommand,parseServerRoomEvent,reduceTrustedRoomState,initialRemoteRoomState} from '../src/domain/room-protocol.mjs';
import {recordLinkLab,initialProgress,saveProgress,readProgress} from '../src/services/storage.mjs';
import {missionEvidence,milestoneBoard} from '../src/domain/missions.mjs';
const page=(name,id,rev,links)=>({identity:{title:name,pageId:id,revisionId:rev,language:'en'},links,html:'<p>Original source</p>'});
const math=page('Mathematics',1,111,['Physics','Biology','Astronomy']),other=page('Marie Curie',900,909,['Physics','Chemistry','Geography','Literature']);
test('Link Lab chooses a true pinned outbound source and only verified nonmembers as distractors',()=>{
 const q=buildLinkAudit(math,other,{seed:'test'});
 assert.ok(math.links.includes(q.answer));assert.equal(q.choices.length,4);
 for(const x of q.choices.filter(c=>c!==q.answer)){assert.ok(other.links.includes(x));assert.equal(math.links.includes(x),false);}
 assert.equal(gradeLinkAudit(q,q.answer),true);assert.equal(gradeLinkAudit(q,q.choices.find(x=>x!==q.answer)),false);
 assert.deepEqual(q.sourceUrls,['https://en.wikipedia.org/w/index.php?oldid=111','https://en.wikipedia.org/w/index.php?oldid=909']);
});
test('Link Lab rejects aliasing and insufficient contrast without fabricating decoys',()=>{
 assert.throws(()=>buildLinkAudit(math,page('Other',1,222,['Whatever'])),/different pinned/);
 assert.throws(()=>buildLinkAudit(math,page('Other',3,444,['Physics'])),/Not enough/);
 assert.throws(()=>buildLinkAudit(math,page('Other',3,444,[])),/Not enough/);
});
test('Link Lab yields reproducible challenges and revision-linked local-only results',()=>{
 const q=buildLinkAudit(math,other,{seed:'source_20'}),r=buildLinkAudit(math,other,{seed:'source_20'});
 assert.deepEqual(q,r);
 let state=recordLinkLab(initialProgress(),recordLinkAudit(q,q.answer));
 assert.equal(state.linkLab[0].ranked,false);assert.equal(state.linkLab[0].scoringAuthority,'pinned-article-links');
 const map=new Map(),storage={setItem:(k,v)=>map.set(k,v),getItem:k=>map.get(k)};
 saveProgress(state,storage);state=readProgress(storage);assert.equal(state.linkLab.length,1);
 const today=state.linkLab[0].at.slice(0,10);
 assert.equal(missionEvidence(state,'link-audit',today).length,1);
 assert.ok(milestoneBoard(state).some(x=>x.id==='three-domains'));
 assert.throws(()=>recordLinkLab(state,{...state.linkLab[0],ranked:true}));
});
test('Link Lab service uses existing Wikimedia API and bounded original article selection',async()=>{
 clearApiCache();let requested=[];
 const original=globalThis.fetch;
 globalThis.fetch=async u=>{const url=new URL(u);const title=url.searchParams.get('page');requested.push(title);
  const p=title==='Mathematics'?math:other;
  return {ok:true,status:200,json:async()=>({parse:{title:p.identity.title,pageid:p.identity.pageId,revid:p.identity.revisionId,text:p.html,links:p.links.map(x=>({ns:0,'*':x}))}})};};
 try{const result=await createLinkAudit({start:'Mathematics',seed:'source_20'});assert.ok(result.question.choices.length>=3);assert.ok(requested.length<=6);assert.equal(result.question.primary.pageId,1);}
 finally{globalThis.fetch=original;}
});
test('API retries temporary errors once and preserves single-flight cache',async()=>{
 clearApiCache();let count=0;
 const fetcher=async()=>{count++;return count===1?{ok:false,status:503,headers:{get:()=>null}}:{ok:true,status:200,json:async()=>({query:{pages:[]}})};};
 const x=await apiRequest('https://en.wikipedia.org/w/api.php',{action:'query',titles:'TestRetry'},{fetcher});assert.ok(x.query);assert.equal(count,2);
 const y=await apiRequest('https://en.wikipedia.org/w/api.php',{action:'query',titles:'TestRetry'},{fetcher});assert.deepEqual(x,y);assert.equal(count,2);
});
test('API retries bounded and does not accept corrupted payloads',async()=>{
 clearApiCache();let n=0;
 const fetcher=async()=>{n++;return {ok:false,status:503,headers:{get:()=>null}};};
 await assert.rejects(()=>apiRequest('https://en.wikipedia.org/w/api.php',{action:'query',titles:'RetryFail'},{fetcher}),/503/);assert.equal(n,2);
 assert.throws(()=>validateApiPayload(null),/Invalid/);assert.throws(()=>validateApiPayload([]),/Invalid/);assert.throws(()=>validateApiPayload({error:{info:'invalid page'}}),/invalid page/);
 assert.equal(retryDelayMs({headers:{get:()=> '99'}},0),1500);
});
test('Pinned article oldid response must match the requested historical revision',async()=>{
 clearApiCache();const previous=globalThis.fetch;
 globalThis.fetch=async()=>({ok:true,status:200,json:async()=>({parse:{title:'Mathematics',pageid:1,revid:999,text:'<p>source</p>',links:[]}})});
 try{await assert.rejects(()=>loadArticle('Mathematics',111),/Pinned Wikipedia revision ID/);}finally{globalThis.fetch=previous;}
});
const room='123e4567-e89b-42d3-a456-426614174000',member='user_123456789';
const at='2026-10-16T12:00:00Z',now=new Date(at);
test('Room contract accepts bounded transport-neutral client intents without trusting scores',()=>{
 const cmd=parseRoomClientCommand({version:1,kind:'request_join',roomNonce:room,participantId:member,clientSequence:1,at},{now});assert.equal(cmd.kind,'request_join');
 assert.throws(()=>parseRoomClientCommand({...cmd,kind:'claim_rank',score:100},{now}));
 assert.throws(()=>parseRoomClientCommand({...cmd,at:'2025-01-01T12:00:00Z'},{now}),/Stale/);
});
test('Future remote room events require verified transport; shape validation never confers server authority',()=>{
 const ev={version:1,kind:'member_joined',roomNonce:room,participantId:member,serverSequence:1,at};
 assert.throws(()=>parseServerRoomEvent(ev,{roomNonce:room}),/authenticated/);
 const parsed=parseServerRoomEvent(ev,{roomNonce:room,verifiedByAuthorizedTransport:true});
 const state=reduceTrustedRoomState(initialRemoteRoomState(room),parsed);assert.ok(state.members[member]);
 assert.throws(()=>parseServerRoomEvent({...ev,serverSequence:1},{roomNonce:room,verifiedByAuthorizedTransport:true,previousSequence:1}),/out-of-order/);
});
test('Future room state rejects client-forged scores, cross-room sequences and post-close events',()=>{
 const initial=initialRemoteRoomState(room);
 const joined=parseServerRoomEvent({version:1,kind:'member_joined',roomNonce:room,participantId:member,serverSequence:1,at},{roomNonce:room,verifiedByAuthorizedTransport:true});
 const s=reduceTrustedRoomState(initial,joined);
 const end=parseServerRoomEvent({version:1,kind:'room_closed',roomNonce:room,serverSequence:2,at},{roomNonce:room,previousSequence:1,verifiedByAuthorizedTransport:true});
 const closed=reduceTrustedRoomState(s,end);assert.equal(closed.closed,true);
 assert.throws(()=>reduceTrustedRoomState(closed,{...joined,serverSequence:3}));
 assert.throws(()=>reduceTrustedRoomState(s,{...joined,roomNonce:'other',serverSequence:3}));
});

test('Common-link challenge finds an actually shared outgoing link and excludes all other shared titles from distractors',()=>{
 const q=buildCommonLinkAudit(math,other,{seed:'shared-source'});
 assert.equal(q.kind,'wikipedia-common-link');assert.ok(math.links.includes(q.answer)&&other.links.includes(q.answer));
 assert.ok(q.choices.filter(x=>x!==q.answer).every(x=>(math.links.includes(x)!==other.links.includes(x))));
 assert.equal(gradeLinkAudit(q,q.answer),true);
 const record=recordLinkAudit(q,q.answer);assert.equal(record.kind,'wikipedia-common-link');assert.equal(record.scoringAuthority,'pinned-article-links');
 assert.equal(recordLinkLab(initialProgress(),record).linkLab.length,1);
});
test('Common-link question refuses articles without both verified overlap and exclusive alternatives',()=>{
 assert.throws(()=>buildCommonLinkAudit(math,page('Unrelated',19,800,['Geography','History'])),/Insufficient/);
 assert.throws(()=>buildCommonLinkAudit(math,page('Identical',20,801,math.links)),/Insufficient/);
});
