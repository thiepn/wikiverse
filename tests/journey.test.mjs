import test from 'node:test';
import assert from 'node:assert/strict';
import {topicSource,sourceHandoff,exactSource} from '../src/domain/journey.mjs';
const fr={language:'fr',pageId:1290,revisionId:1291,title:'Marie Curie'};
const en={language:'en',pageId:900,revisionId:909,title:'Marie Curie'};
test('Session source handoff preserves original Wikipedia identity, not a fabricated QID',()=>{
 const routed=sourceHandoff('galaxy',fr);assert.deepEqual(routed.article,fr);
 assert.equal(routed.sourceUrl,'https://fr.wikipedia.org/w/index.php?oldid=1291');
 assert.equal(Object.hasOwn(routed,'qid'),false);
 for(const d of ['geo','chronicle','polyglot','pulse','study','discover'])assert.deepEqual(sourceHandoff(d,fr).article,fr);
});
test('Original English-only source games never reinterpret a different Wikipedia edition',()=>{
 for(const d of ['race','linklab','detective'])assert.throws(()=>sourceHandoff(d,fr),/English/);
 for(const d of ['race','linklab','detective'])assert.deepEqual(sourceHandoff(d,en).article,en);
 assert.throws(()=>sourceHandoff('leaderboard',en),/Unsupported/);
});
test('Pinned original identity compares language, page ID and revision ID',()=>{
 assert.deepEqual(exactSource(en,en),en);
 for(const change of [{pageId:901},{revisionId:910},{language:'de'}])assert.throws(()=>exactSource({...en,...change},en),/changed/);
 for(const bad of [{...fr,pageId:0},{...fr,title:'<bad>'},{...fr,revisionId:0}])assert.throws(()=>topicSource(bad),/required/);
});
