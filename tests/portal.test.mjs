import test from 'node:test';
import assert from 'node:assert/strict';
import {navigationSections,sectionForScreen,resumeSource} from '../src/domain/portal.mjs';
import {initialProgress} from '../src/services/storage.mjs';

test('Five primary sections preserve every original mode exactly once',()=>{
 assert.deepEqual(navigationSections.map(x=>x.title),['Explore','Play','Learn','Discover','My Universe']);
 const ids=navigationSections.flatMap(x=>[x.id,...x.children]);
 assert.equal(new Set(ids).size,ids.length);
 assert.deepEqual(ids.slice().sort(),['home','play','learn','discover','library','race','mystery','linklab','arena','missions','galaxy','geo','chronicle','pulse','capsule','polyglot','detective','study','backup'].sort());
 for(const group of navigationSections)for(const id of [group.id,...group.children])assert.equal(sectionForScreen(id),group.id);
 assert.equal(sectionForScreen('unrecognized'),'home');
});
test('Resume uses real original Wikipedia language/page/revision, never a synthetic record',()=>{
 const empty=initialProgress();
 assert.equal(resumeSource(empty),null);
 const original={language:'fr',pageId:736,revisionId:98765,title:'Mathématiques'};
 const withReading={...empty,readingHistory:[{article:original,at:'2026-10-17T12:00:00.000Z'}]};
 assert.deepEqual(resumeSource(withReading),original);
 const altered={...empty,readingHistory:[{article:{...original,pageId:0},at:'2026-10-18T12:00:00.000Z'},...withReading.readingHistory]};
 assert.deepEqual(resumeSource(altered),original);
});
