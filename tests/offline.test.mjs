import test from 'node:test';
import assert from 'node:assert/strict';
import {offlineSnapshot,checkedOfflineSnapshot,saveOfflineSnapshot,removeOfflineSnapshot,offlineSnapshotFor,verifyOfflineCollection} from '../src/domain/offline.mjs';
import {initialProgress,readProgress,saveProgress} from '../src/services/storage.mjs';
import {exportProgressBackup,inspectProgressBackup,mergeProgress,commitInspectedRestore} from '../src/domain/backup.mjs';
const en={language:'en',pageId:12,revisionId:345,title:'Physics'};
const de={language:'de',pageId:34,revisionId:678,title:'Physik'};
const text='Source paragraphs about physics are preserved as visible source text, never as automatically graded factual claims.';
const capture=(article=en,at='2026-10-18T08:00:00Z')=>offlineSnapshot({article,at,sections:[text,'Original scientific article context remains tied to its own canonical page and immutable revision identifier.'],truncated:true});
const store=()=>{const data=new Map();return {getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};};
test('Bounded offline text belongs to original Wikipedia edition, page and pinned revision, never grades truth',()=>{
 const snapshot=capture();
 assert.equal(snapshot.source,'https://en.wikipedia.org/w/index.php?oldid=345');
 assert.equal(snapshot.key,'en:12');assert.equal(snapshot.graded,false);
 assert.equal(snapshot.kind,'owner-selected-offline-reading-v1');
 assert.equal(snapshot.sections[0],text);
 const other=capture(de);
 assert.equal(other.source,'https://de.wikipedia.org/w/index.php?oldid=678');
 assert.notEqual(snapshot.key,other.key);
});
test('Multiple editions remain distinct, while capturing a newer revision replaces only that article copy',()=>{
 let progress=saveOfflineSnapshot(initialProgress(),capture());
 progress=saveOfflineSnapshot(progress,capture(de));
 assert.equal(progress.offlineArticles.length,2);
 assert.equal(offlineSnapshotFor(progress,en).article.revisionId,345);
 progress=saveOfflineSnapshot(progress,capture({...en,revisionId:777}));
 assert.equal(progress.offlineArticles.length,2);
 assert.equal(offlineSnapshotFor(progress,en).source,'https://en.wikipedia.org/w/index.php?oldid=777');
 assert.equal(offlineSnapshotFor(progress,de).source,'https://de.wikipedia.org/w/index.php?oldid=678');
 progress=removeOfflineSnapshot(progress,'en:12');
 assert.equal(progress.offlineArticles.length,1);
 assert.throws(()=>removeOfflineSnapshot(progress,'__proto__'),/Invalid offline article identity/);
});
test('User-owned offline shelf refuses nine articles, excessive passage, fabricated authority and mismatched URLs',()=>{
 let current=initialProgress();
 for(let i=1;i<=8;i++)current=saveOfflineSnapshot(current,capture({...en,pageId:i}));
 assert.equal(current.offlineArticles.length,8);
 assert.throws(()=>saveOfflineSnapshot(current,capture({...en,pageId:99})),/Offline shelf is full/);
 const sample=capture();
 assert.throws(()=>checkedOfflineSnapshot({...sample,source:'https://example.test/source'}),/source identity mismatch/);
 assert.throws(()=>checkedOfflineSnapshot({...sample,graded:true}),/authority/);
 assert.throws(()=>checkedOfflineSnapshot({...sample,ranked:true}),/authority/);
 assert.throws(()=>offlineSnapshot({article:en,sections:[text.repeat(120)]}),/safe excerpt bounds/);
 assert.throws(()=>offlineSnapshot({article:{...en,revisionId:0},sections:[text]}),/real Wikipedia/);
 assert.throws(()=>verifyOfflineCollection([sample,sample]),/duplicate article identities/);
});
test('Private offline copies survive canonical v1 storage and verified file recovery with original IDs',async()=>{
 let current=saveOfflineSnapshot(initialProgress(),capture(en));
 const storage=store();saveProgress(current,storage);
 assert.equal(readProgress(storage).offlineArticles[0].article.revisionId,345);
 const file=await exportProgressBackup(current,new Date('2026-10-18T09:00:00Z'));
 const inspected=await inspectProgressBackup(file);
 assert.equal(inspected.counts.offlineArticles,1);
 const other=saveOfflineSnapshot(initialProgress(),capture(de));
 const merged=mergeProgress(other,inspected.progress);
 assert.equal(merged.progress.offlineArticles.length,2);
 const committed=commitInspectedRestore(other,inspected,'merge',storage);
 assert.equal(committed.offlineArticles.length,2);
 assert.equal(readProgress(storage).offlineArticles[0].article.language,'de');
});
test('Import refuses source copy with altered source revision or invented grade even when file checksum can be recomputed',async()=>{
 const original=saveOfflineSnapshot(initialProgress(),capture());
 for(const mutate of [s=>({...s,source:'https://de.wikipedia.org/w/index.php?oldid=345'}),s=>({...s,graded:true}),s=>({...s,verified:true})]){
  const copy={...original,offlineArticles:[mutate(original.offlineArticles[0])]};
  await assert.rejects(()=>exportProgressBackup(copy),/Offline reading|offline reading/);
 }
});
test('Previous v1 backup without offlineArticles remains compatible',async()=>{
 const old=initialProgress();delete old.offlineArticles;
 const payload={kind:'wikiverse-local-backup',format:1,exportedAt:'2026-10-18T09:00:00.000Z',progress:old};
 const bytes=new TextEncoder().encode(JSON.stringify(payload));
 const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const result=await inspectProgressBackup(JSON.stringify({...payload,sha256:sha}));
 assert.deepEqual(result.progress.offlineArticles,[]);
});
