import test from 'node:test';
import assert from 'node:assert/strict';
import {offlineSnapshot} from '../src/domain/offline.mjs';
import {sourceLocator,inspectLocator,sourceSequence,inspectSequence,searchSavedSource,sourceSelection} from '../src/domain/offline-workbench.mjs';
import {initialProgress} from '../src/services/storage.mjs';
const en={language:'en',pageId:21,revisionId:304,title:'History of Science'};
const de={language:'de',pageId:31,revisionId:405,title:'Wissenschaftsgeschichte'};
const ko={language:'ko',pageId:41,revisionId:506,title:'과학사'};
const sections=[
 'Historical scientific methods developed through observation and explicit source records during different eras of research.',
 'Documents describing experiments can be investigated through their original evidence and the circumstances of publication.',
 'Modern scientific communication cites original sources, with interpretation remaining distinct from source identity.',
 'Research archives preserve original articles that allow readers to examine how historical accounts changed over time.'
];
const make=(article=en,paragraphs=sections)=>offlineSnapshot({article,sections:paragraphs,at:'2026-10-18T08:00:00Z'});
test('Search uses actual canonical saved paragraphs, keeps original immutable and source id',()=>{
 const snapshot=make(),before=JSON.stringify(snapshot);
 assert.deepEqual(searchSavedSource(snapshot,'observation').map(x=>x.index),[0]);
 assert.deepEqual(searchSavedSource(snapshot,'ORIGINAL').map(x=>x.index),[1,2,3]);
 assert.deepEqual(searchSavedSource(snapshot,'never present'),[]);
 assert.deepEqual(searchSavedSource(snapshot,' '),[]);
 assert.equal(searchSavedSource(snapshot,'experiments')[0].source,'https://en.wikipedia.org/w/index.php?oldid=304');
 assert.equal(JSON.stringify(snapshot),before);
 assert.deepEqual(initialProgress().learning,[],'Source search cannot invent grades');
});
test('Original-language Unicode search supports German and Korean without translation guesses',()=>{
 const german=make(de,['Überlieferte Quellen erklären Überprüfung wissenschaftlicher Texte und ihre Bedeutung für spätere Forschung.',...sections]);
 assert.equal(searchSavedSource(german,'ÜBERPRÜFUNG')[0].index,0);
 assert.equal(searchSavedSource(make(ko,['원본 자료를 조사하는 독자는 출처와 수정 기록을 확인하며 자신이 읽은 문장을 다시 비교합니다.',...sections]),'출처')[0].index,0);
 assert.equal(searchSavedSource(make(de),'nonexistent').length,0);
});
test('Stateless quote locator checks only unique original text, no score or recorded mastery',()=>{
 const snapshot=make(),prompt=sourceLocator(snapshot,0);
 assert.equal(prompt.source,snapshot.source);assert.equal(prompt.article.revisionId,304);
 assert.equal(prompt.graded,false);assert.equal(prompt.authority,'saved-text-match-only');
 assert.ok(snapshot.sections[prompt.target].includes(prompt.quote));
 assert.equal(snapshot.sections.filter(x=>x.includes(prompt.quote)).length,1);
 assert.equal(inspectLocator(snapshot,prompt,prompt.target).matched,true);
 const wrong=prompt.choices.find(x=>x!==prompt.target);
 assert.equal(inspectLocator(snapshot,prompt,wrong).matched,false);
 assert.equal(inspectLocator(snapshot,prompt,wrong).graded,false);
 assert.throws(()=>inspectLocator(snapshot,{...prompt,target:wrong},wrong),/Unsupported/);
});
test('Locate prompt skips ambiguous duplicate passages instead of fabricating an answer',()=>{
 const snapshot=make(en,[sections[0],sections[0],sections[2]]);
 const p=sourceLocator(snapshot,0);
 assert.equal(p.target,2);
 assert.ok(p.quote.length>=28);
 assert.equal(sourceLocator(make(en,[sections[0]])),null);
 assert.equal(sourceLocator(make(en,[sections[0],sections[0]])),null);
});
test('Paragraph-order exercise derives original consecutive order; arbitrary alternatives stay ungraded',()=>{
 const snapshot=make(),prompt=sourceSequence(snapshot,1);
 assert.deepEqual(prompt.indices,[1,2,3]);
 assert.notDeepEqual(prompt.shuffled,prompt.indices);
 assert.equal(inspectSequence(snapshot,prompt,[1,2,3]).matched,true);
 assert.equal(inspectSequence(snapshot,prompt,prompt.shuffled).matched,false);
 assert.equal(inspectSequence(snapshot,prompt,[1,2,3]).graded,false);
 assert.throws(()=>inspectSequence(snapshot,prompt,[1,1,2]),/Unsupported/);
 assert.throws(()=>inspectSequence(snapshot,{...prompt,source:'https://example.test'},[1,2,3]),/Unsupported/);
 assert.equal(sourceSequence(make(en,sections.slice(0,2))),null);
});
test('Text can become existing source clip only if it is an exact selection within a saved paragraph',()=>{
 const snapshot=make();
 const selected=sections[0].slice(0,80);
 assert.deepEqual(sourceSelection(snapshot,selected),{article:snapshot.article,excerpt:selected});
 assert.throws(()=>sourceSelection(snapshot,'Fabricated passage never in original section'),/Select 12/);
 assert.throws(()=>sourceSelection(snapshot,sections[0]+' '+sections[1]),/Select 12/);
 assert.throws(()=>sourceSelection(snapshot,'too short'),/Select 12/);
});
test('Rounds and overly long queries reject adversarial inputs instead of making remote requests',()=>{
 const snapshot=make();
 assert.throws(()=>sourceLocator(snapshot,-1),/Invalid local/);
 assert.throws(()=>sourceSequence(snapshot,1.5),/Invalid local/);
 assert.throws(()=>searchSavedSource(snapshot,'x'.repeat(101)),/at most 100/);
 assert.equal(sourceLocator(make(de),2).source,'https://de.wikipedia.org/w/index.php?oldid=405');
});
