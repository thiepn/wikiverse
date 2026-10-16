import test from 'node:test';import assert from 'node:assert/strict';
import {historicalWindow,safeRevisionCursor,normalizeRevisionPage,mergeRevisionPages} from '../src/domain/history.mjs';
import {loadRevisionWindow} from '../src/services/history.mjs';
import {validateArenaManifest,buildArenaManifest,encodeArenaCode,decodeArenaCode,sourceLinkChoices,gradeTrailChoice,arenaAttempt} from '../src/domain/arena.mjs';
import {recordArenaAttempt,initialProgress,saveProgress,readProgress} from '../src/services/storage.mjs';
const now=new Date('2026-10-16T12:00:00Z');
test('Historical windows: UTC inclusive range, leap-year arithmetic and supported bounds',()=>{
 assert.deepEqual(historicalWindow('2026-10-12',7,now),{start:'2026-10-06',end:'2026-10-12',rvstart:'2026-10-12T23:59:59Z',rvend:'2026-10-06T00:00:00Z',days:7});
 assert.equal(historicalWindow('2024-03-01',7,now).start,'2024-02-24');
 assert.throws(()=>historicalWindow('2026-02-31',30,now));assert.throws(()=>historicalWindow('2026-10-17',7,now));assert.throws(()=>historicalWindow('2026-10-12',500,now));
});
const rawPage=(ids,cont=null,pid=900)=>({query:{pages:[{pageid:pid,title:'Marie Curie',revisions:ids.map((id,i)=>({revid:id,timestamp:'2026-10-'+String(15-(5008-id)).padStart(2,'0')+'T12:00:00Z',size:500,comment:'Source edit'}))}]},...(cont?{continue:{rvcontinue:cont,continue:'||'}}:{})});
test('History pages preserve canonical page/revision/source and pass safe opaque continuation',()=>{
 const page=normalizeRevisionPage(rawPage([5008,5007,5006],'20261012120000|5006'),{language:'en',title:'Marie Curie'});
 assert.equal(page.identity.pageId,900);assert.equal(page.revisions.length,3);assert.equal(page.nextCursor,'20261012120000|5006');
 assert.equal(page.revisions[0].sourceUrl,'https://en.wikipedia.org/w/index.php?oldid=5008');
});
test('History continuation refuses unsafe cursors and changes in page identity',()=>{
 assert.equal(safeRevisionCursor('20261012120000|5006'),'20261012120000|5006');assert.equal(safeRevisionCursor('https://evil.invalid'),null);
 assert.throws(()=>normalizeRevisionPage(rawPage([5003],null,901),{language:'en',title:'Marie Curie',expectedPageId:900}));
 assert.throws(()=>normalizeRevisionPage(rawPage([5003],'bad?x=1'),{language:'en',title:'Marie Curie'}),/Unsafe/);
});
test('History paging deduplicates and retains sorted revision order within same page',()=>{
 const a=normalizeRevisionPage(rawPage([5008,5007,5006],'20261012120000|5006'),{language:'en',title:'Marie Curie'});
 const b=normalizeRevisionPage(rawPage([5006,5005,5004]),{language:'en',title:'Marie Curie',expectedPageId:900});
 const merged=mergeRevisionPages(a,b);
 assert.deepEqual(merged.revisions.map(r=>r.revisionId),[5008,5007,5006,5005,5004]);assert.equal(merged.nextCursor,null);
 assert.throws(()=>mergeRevisionPages(a,{...b,identity:{...b.identity,pageId:901}}));
});
test('Historical query uses rvstart/rvend and page-ID-locked bounded cursor',async()=>{
 const original=globalThis.fetch,urls=[];
 globalThis.fetch=async url=>{const u=new URL(url);urls.push(u);return {ok:true,status:200,json:async()=>urls.length===1?rawPage([5008,5007],'20261012120000|5007'):rawPage([5006,5005])};};
 try{
  const a=await loadRevisionWindow('Marie Curie',{endDate:'2026-10-12',days:7});
  const b=await loadRevisionWindow(a.identity.title,{endDate:'2026-10-12',days:7,cursor:a.nextCursor,pageId:a.identity.pageId});
  assert.equal(a.revisions.length,2);assert.equal(b.revisions.length,2);
  assert.equal(urls[0].searchParams.get('rvstart'),'2026-10-12T23:59:59Z');assert.equal(urls[0].searchParams.get('rvend'),'2026-10-06T00:00:00Z');
  assert.equal(urls[1].searchParams.get('pageids'),'900');assert.equal(urls[1].searchParams.get('rvcontinue'),'20261012120000|5007');
  assert.equal(urls[1].searchParams.get('titles'),null);
 }finally{globalThis.fetch=original;}
});
const proof=[{language:'en',pageId:1,revisionId:111,title:'Mathematics'},{language:'en',pageId:2,revisionId:222,title:'Physics'},{language:'en',pageId:3,revisionId:333,title:'History'}];
const manifest=buildArenaManifest({proof,seed:'practice_123'});
test('Arena manifests pin all article page/revision IDs; share-code round trip is canonical',()=>{
 const code=encodeArenaCode(manifest);assert.ok(code.startsWith('WV1.'));
 const restored=decodeArenaCode(code);assert.deepEqual(restored,manifest);
 assert.deepEqual(restored.proof.map(x=>x.revisionId),[111,222,333]);assert.equal(restored.ranked,false);
});
test('Arena rejects malformed imports, repeated pages, restricted languages, and ranked claims',()=>{
 assert.throws(()=>decodeArenaCode('WV1.invalid***'));
 assert.throws(()=>validateArenaManifest({...manifest,ranked:true}));
 assert.throws(()=>validateArenaManifest({...manifest,proof:[proof[0],proof[0],proof[2]]}));
 assert.throws(()=>validateArenaManifest({...manifest,proof:[proof[0],{...proof[1],language:'ru'},proof[2]]}));
});
test('Arena distractors come only from actual pinned source links; absence of proof is hard failure',()=>{
 const source={identity:proof[0],links:['Biology','Physics','Chemistry','Geography','Physics']};
 const choices=sourceLinkChoices(source,proof[1],manifest.seed);
 assert.equal(choices.length,4);assert.ok(choices.includes('Physics'));assert.ok(choices.every(x=>source.links.includes(x)));
 assert.throws(()=>sourceLinkChoices({...source,links:['Biology']},proof[1],manifest.seed),/does not link/);
});
test('Arena grades proven next hop only, while preserving other possible links as non-judged routes',()=>{
 assert.equal(gradeTrailChoice(manifest,0,'Physics'),true);assert.equal(gradeTrailChoice(manifest,0,'Chemistry'),false);assert.equal(gradeTrailChoice(manifest,1,'History'),true);assert.throws(()=>gradeTrailChoice(manifest,2,'Physics'));
});
test('Arena records unranked result without invented score or certified competitive outcome',()=>{
 const result=arenaAttempt(manifest,{mistakes:2,elapsedMs:13000});
 assert.equal(result.ranked,false);assert.equal(result.score,null);assert.equal(result.sourceIds.length,3);
 assert.throws(()=>arenaAttempt(manifest,{mistakes:-1}));
 let state=recordArenaAttempt({...initialProgress(),races:[{clicks:2}]},result);
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)};
 saveProgress(state,storage);state=readProgress(storage);
 assert.equal(state.arenaAttempts.length,1);assert.equal(state.races.length,1);
 assert.throws(()=>recordArenaAttempt(state,{...result,ranked:true}));
});
