import test from 'node:test';import assert from 'node:assert/strict';
import {originalEditionOptions,originalPassageMatches,gradeCloze} from '../src/domain/learning.mjs';
import {loadLanguagePairByQid,sourcePassageCloze} from '../src/services/learning.mjs';
import {clearApiCache} from '../src/services/wikimedia.mjs';
const entity={id:'Q7186',sitelinks:{enwiki:{title:'Marie Curie'},frwiki:{title:'Marie Curie'},dewiki:{title:'Marie Curie'},kowiki:{title:'마리 퀴리'}}};
test('W07 edition navigation lists only actual supported original sitelinks',()=>{
 assert.deepEqual(originalEditionOptions(entity).map(e=>e.language),['en','fr','de','ko']);
 assert.equal(originalEditionOptions({...entity,id:'not-a-QID'}).length,0);
 assert.equal(originalEditionOptions({id:'Q7186',sitelinks:{enwiki:{title:''}}}).length,0);
});
test('W07 passage selection remains literal, Unicode NFC-compatible and unaligned across editions',()=>{
 const original=['Texte sur la radioactivité et expériences scientifiques.', 'La chercheuse étudiait les phénomènes scientifiques et les résultats publiés.'];
 assert.deepEqual(originalPassageMatches(original,'SCIENTIFIQUES').map(p=>p.index),[0,1]);
 assert.equal(originalPassageMatches(['Cafe\u0301 scientifique.'],'Café').length,1);
 assert.deepEqual(originalPassageMatches(original,'unobserved'),[]);
 assert.deepEqual(originalPassageMatches(original).map(p=>p.index),[0,1]);
 assert.throws(()=>originalPassageMatches(original,'',25),/Unsupported/);
});
test('W07 source-focused cloze takes only an authentic original paragraph and preserves the original grader',()=>{
 const para='Cette chercheuse étudiait les phénomènes scientifiques et leur influence sur la société européenne contemporaine.';
 const page={identity:{language:'fr',pageId:123,revisionId:456,title:'Marie Curie'},html:'',links:[]};
 const previous=globalThis.DOMParser;
 class FakeParser{parseFromString(){return {querySelectorAll(s){if(s==='p')return [{textContent:para}];return []}};}}
 globalThis.DOMParser=FakeParser;
 try{
  const q=sourcePassageCloze(page,para,'w07');
  assert.ok(q);assert.equal(q.article.revisionId,456);assert.equal(gradeCloze(q,q.answer),true);
  assert.equal(sourcePassageCloze(page,'Fabricated unrelated sentence for a fake grading attempt.','w07'),null);
 }finally{globalThis.DOMParser=previous;}
});
test('W07 verified original QID edition switches keep a pinned source revision without equating other editions',async()=>{
 const old=globalThis.fetch;clearApiCache();
 const calls=[];
 globalThis.fetch=async url=>{
  const u=new URL(url),action=u.searchParams.get('action'),lang=u.hostname.split('.')[0];calls.push([action,lang,u.searchParams.get('oldid')]);
  let data;
  if(action==='wbgetentities')data={entities:{Q7186:entity}};
  else if(action==='query')data={query:{pages:[{pageprops:{wikibase_item:'Q7186'}}]}};
  else if(action==='parse'){const pinned=u.searchParams.get('oldid');data={parse:{title:lang==='ko'?'마리 퀴리':'Marie Curie',pageid:lang==='en'?100:lang==='fr'?125:lang==='de'?200:300,revid:pinned?Number(pinned):lang==='en'?300:lang==='fr'?456:lang==='de'?789:555,text:'<p>Original independently written source article paragraph.</p>',links:[]}};}
  else throw Error('Unexpected original API operation '+action);
  return {ok:true,status:200,json:async()=>data};
 };
 try{
  const pinned={language:'fr',pageId:125,revisionId:88,title:'Marie Curie'};
  const a=await loadLanguagePairByQid('Q7186','fr',pinned);
  assert.equal(a.articles.fr.identity.revisionId,88);
  assert.equal(a.articles.en.identity.revisionId,300);
  assert.deepEqual(a.availableEditions.map(e=>e.language),['en','fr','de','ko']);
  const b=await loadLanguagePairByQid('Q7186','de',pinned);
  assert.equal(b.articles.de.identity.revisionId,789);
  assert.equal(b.articles.en.identity.revisionId,300);
  assert.ok(calls.some(c=>c[0]==='parse'&&c[1]==='fr'&&c[2]==='88'));
  await assert.rejects(()=>loadLanguagePairByQid('Q999','fr',pinned),/lacks|disagrees|Unsupported/);
 }finally{globalThis.fetch=old;clearApiCache();}
});
