import test from 'node:test';
import assert from 'node:assert/strict';
import {GALAXY_FACETS,RELATIONS,galaxyVisibleEdges,galaxyPropertyCounts,galaxyTrailAppend,linkStatements} from '../src/domain/exploration.mjs';
import {verifiedGalaxyWikipedia} from '../src/services/exploration.mjs';
import {clearApiCache} from '../src/services/wikimedia.mjs';
const claim=(id,rank='normal')=>({rank,mainsnak:{snaktype:'value',datavalue:{value:{id}}},id:'Q100$statement'});
const source={id:'Q100',claims:{P31:[claim('Q200')],P106:[claim('Q300')],P50:[claim('Q400')],P17:[claim('Q500')],P361:[claim('Q999','deprecated')]}};
const edges=linkStatements(source),graph={root:{id:'Q100',title:'Real original item'},edges:edges.map((e,i)=>({...e,title:['Research topic','Physicist','Author','Germany'][i]}))};
test('W04 faceted search only selects existing non-deprecated Wikidata statements',()=>{
 assert.equal(edges.length,4);assert.equal(galaxyVisibleEdges(graph).length,4);
 assert.deepEqual(galaxyVisibleEdges(graph,{facet:'work'}).map(x=>x.to),['Q400']);
 assert.deepEqual(galaxyVisibleEdges(graph,{facet:'people',query:'physicist'}).map(x=>x.property),['P106']);
 assert.deepEqual(galaxyVisibleEdges(graph,{facet:'places',query:'q500'}).map(x=>x.to),['Q500']);
 assert.deepEqual(galaxyVisibleEdges(graph,{facet:'invalid'}),[]);
 assert.deepEqual(galaxyVisibleEdges(graph,{facet:'all',property:'P31'}).map(x=>x.to),['Q200']);
 assert.deepEqual(galaxyPropertyCounts(graph,'people').map(x=>x.property),['P106']);
 assert.deepEqual(new Set(GALAXY_FACETS.flatMap(x=>x.properties)).size,Object.keys(RELATIONS).length);
});
test('W04 source trail preserves exact prior QID/property/statement and forbids invented hops or cycles',()=>{
 const path=galaxyTrailAppend([],graph,graph.edges[0]);
 assert.deepEqual(path,[{id:'Q100',title:'Real original item',via:'instance of',property:'P31',statement:'https://www.wikidata.org/wiki/Q100#P31'}]);
 assert.throws(()=>galaxyTrailAppend([],graph,{...graph.edges[0],to:'Q666'}),/original source-linked/);
 const next={root:{id:'Q200',title:'Second'},edges:[{from:'Q200',to:'Q100',property:'P31',label:'instance of',sourceUrl:'https://www.wikidata.org/wiki/Q200#P31'}]};
 assert.throws(()=>galaxyTrailAppend(path,next,next.edges[0]),/already on the current source trail/);
});
test('W04 Wikipedia handoff verifies source QID/sitelink and canonical original article identity',async()=>{
 const old=globalThis.fetch;
 const calls=[];
 const fake=(relinked=false)=>async uri=>{
  const u=new URL(uri),a=u.searchParams.get('action'),prop=u.searchParams.get('prop');calls.push([a,prop,u.searchParams.get('ids')]);
  if(a==='wbgetentities')return {ok:true,status:200,json:async()=>({entities:{Q100:{id:'Q100',sitelinks:{enwiki:{title:'Real original item'}}}}})};
  if(a==='query')return {ok:true,status:200,json:async()=>({query:{pages:[{pageprops:{wikibase_item:relinked?'Q999':'Q100'}}]}})};
  if(a==='parse')return {ok:true,status:200,json:async()=>({parse:{title:'Real original item',pageid:1000,revid:1001,text:'<p>Verified original</p>',links:[]}})};
  throw Error('Unexpected API action '+a);
 };
 try{
  clearApiCache();globalThis.fetch=fake();
  const match=await verifiedGalaxyWikipedia('Q100');
  assert.deepEqual([match.qid,match.article.language,match.article.pageId,match.article.revisionId],['Q100','en',1000,1001]);
  assert.equal(calls.some(c=>c[0]==='parse'),true);
  clearApiCache();globalThis.fetch=fake(true);
  await assert.rejects(()=>verifiedGalaxyWikipedia('Q100'),/no longer confirms/);
  await assert.rejects(()=>verifiedGalaxyWikipedia('unsafe-QID'),/Invalid Wikidata/);
 }finally{globalThis.fetch=old;clearApiCache();}
});
