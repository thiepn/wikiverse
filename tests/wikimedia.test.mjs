import test from 'node:test';import assert from 'node:assert/strict';
import {apiRequest,clearApiCache,apiStats} from '../src/services/wikimedia.mjs';
const base='https://en.wikipedia.org/w/api.php';
test('Wikimedia API adapter deduplicates identical concurrent requests and caches responses',async()=>{
  clearApiCache();let calls=0;
  const fetcher=async url=>{calls++;const u=new URL(url);assert.equal(u.searchParams.get('origin'),'*');assert.equal(u.searchParams.get('formatversion'),'2');return {ok:true,json:async()=>({result:'ok'}),status:200};};
  const requests=Array.from({length:5},()=>apiRequest(base,{action:'query',list:'search',srsearch:'mathematics'},{fetcher}));
  const res=await Promise.all(requests);
  assert.equal(calls,1);assert.deepEqual(res.map(x=>x.result),Array(5).fill('ok'));
  await apiRequest(base,{action:'query',list:'search',srsearch:'mathematics'},{fetcher});assert.equal(calls,1);assert.equal(apiStats().cached,1);
});
test('adapter does not cache upstream errors',async()=>{
  clearApiCache();const fetcher=async()=>({ok:false,status:429});
  await assert.rejects(()=>apiRequest(base,{action:'query',list:'search',srsearch:'limits'},{fetcher}),/rate limit/);
  assert.equal(apiStats().cached,0);
});
test('adapter rejects non-Wikimedia endpoints',async()=>{assert.throws(()=>apiRequest('https://example.com/api',{action:'query'}),/Only Wikimedia/);});
test('a pinned Wikipedia revision is requested by oldid and retains page/revision identity',async()=>{
  clearApiCache();const original=globalThis.fetch;
  let url='';
  globalThis.fetch=async u=>{url=String(u);return {ok:true,json:async()=>({parse:{title:'Mathematics',pageid:186,revid:3434,text:'<p>Real article</p>',links:[{ns:0,'*':'Physics'},{ns:6,'*':'File:Example.jpg'}]}})};};
  try{
    const {loadArticle}=await import('../src/services/wikimedia.mjs');
    const article=await loadArticle('Mathematics',3434);
    assert.equal(article.identity.pageId,186);assert.equal(article.identity.revisionId,3434);
    assert.deepEqual(article.links,['Physics']);
    assert.equal(new URL(url).searchParams.get('oldid'),'3434');
    assert.equal(new URL(url).searchParams.has('page'),false);
  }finally{globalThis.fetch=original;}
});
test('mystery pipeline resolves a canonical Wikipedia QID and only renders provided Wikidata statements',async()=>{
  clearApiCache();const original=globalThis.fetch;
  const data={
    Q100:{id:'Q100',labels:{en:{value:'Example Researcher'}},aliases:{en:[{value:'E. Researcher'}]},claims:{P106:[{mainsnak:{datavalue:{value:{id:'Q1'}}}}],P19:[{mainsnak:{datavalue:{value:{id:'Q2'}}}}],P569:[{mainsnak:{datavalue:{value:{time:'+1900-01-01T00:00:00Z',precision:11}}}}]}},
    Q1:{id:'Q1',labels:{en:{value:'scientist'}}},Q2:{id:'Q2',labels:{en:{value:'Example City'}}}
  };
  globalThis.fetch=async u=>{
    const url=new URL(u);const ids=url.searchParams.get('ids');
    if(url.searchParams.get('prop')==='pageprops')return {ok:true,json:async()=>({query:{pages:[{pageprops:{wikibase_item:'Q100'}}]}})};
    return {ok:true,json:async()=>({entities:Object.fromEntries(ids.split('|').map(id=>[id,data[id]]))})};
  };
  try{const {loadMystery}=await import('../src/services/wikimedia.mjs');const result=await loadMystery('Example Researcher');assert.equal(result.id,'Q100');assert.equal(result.clues.length,3);assert.equal(result.title,'Example Researcher');}
  finally{globalThis.fetch=original;}
});
