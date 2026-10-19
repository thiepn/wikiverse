import test from 'node:test';import assert from 'node:assert/strict';
import {GEO_VIEWS,isGeoPlace,geoPlacesInView,geoProject,geoDistanceKm,geoNearPlaces,geoLatitudeChallenge,coordinate} from '../src/domain/exploration.mjs';
const p=(qid,title,latitude,longitude,precision=0.001)=>({qid,title,articleTitle:title,latitude,longitude,precision,sourceUrl:'https://www.wikidata.org/wiki/'+qid+'#P625'});
const source=[p('Q64','Berlin',52.52,13.405),p('Q90','Paris',48.86,2.35),p('Q1490','Tokyo',35.68,139.69),p('Q1748','Sydney',-33.87,151.21),p('Q8660','Rio de Janeiro',-22.91,-43.2),p('Q10690','Seoul',37.56,126.98)];
test('W05 mathematical geographical views retain only real P625 records',()=>{
 assert.equal(GEO_VIEWS.length,5);
 assert.deepEqual(geoPlacesInView(source,'north').map(x=>x.qid),['Q64','Q90','Q1490','Q10690']);
 assert.deepEqual(geoPlacesInView(source,'south').map(x=>x.qid),['Q1748','Q8660']);
 assert.deepEqual(geoPlacesInView(source,'west').map(x=>x.qid),['Q8660']);
 assert.deepEqual(geoPlacesInView(source,'world','Tokyo').map(x=>x.qid),['Q1490']);
 assert.equal(isGeoPlace({...source[0],sourceUrl:'https://example.org/'}),false);
 assert.throws(()=>geoPlacesInView(source,'fake'),/Unsupported/);
});
test('W05 coordinate projections use only documented equirectangular mathematical bounds',()=>{
 const north=p('Q1','Equator',0,0);
 assert.deepEqual(geoProject(north,'world'),{x:450,y:225});
 assert.deepEqual(geoProject(north,'north'),{x:450,y:450});
 assert.throws(()=>geoProject(source[3],'north'),/outside/);
 assert.throws(()=>geoProject({...north,latitude:180},'world'),/unverified/);
});
test('W05 distances are bounded source-derived great-circle approximations, not routes',()=>{
 assert.equal(geoDistanceKm(source[0],source[0]),0);
 assert.equal(geoDistanceKm(source[0],source[1]),geoDistanceKm(source[1],source[0]));
 assert.ok(geoDistanceKm(source[0],source[1])>500);
 const nearby=geoNearPlaces(source[0],source,3);
 assert.equal(nearby[0].qid,'Q90');assert.equal(nearby.length,3);
 assert.ok(nearby.every(x=>x.distanceKm>=0&&x.sourceUrl.endsWith('#P625')));
});
test('W05 northern/southern comparison never creates facts or declares world rankings',()=>{
 for(const count of [3,4]){
  for(const direction of ['north','south']){
   const q=geoLatitudeChallenge(source,'w05:test',{direction,count});
   assert.equal(q.options.length,count);assert.ok(q.options.some(x=>x.qid===q.answer.qid));assert.equal(q.ranked,false);
   assert.equal(q.answer.latitude,direction==='north'?Math.max(...q.options.map(x=>x.latitude)):Math.min(...q.options.map(x=>x.latitude)));
  }
 }
 assert.deepEqual(geoLatitudeChallenge(source,'seed'),geoLatitudeChallenge(source,'seed'));
 assert.throws(()=>geoLatitudeChallenge(source.slice(0,2),'seed'),/Not enough/);
 const tied=[p('Q1','A',20,1),p('Q2','B',20,2),p('Q3','C',19,3)];
 assert.throws(()=>geoLatitudeChallenge(tied,'x',{direction:'north'}),/ambiguous/);
});
test('W05 original Earth-only and nondeprecated P625 source constraints remain authoritative',()=>{
 const claim=(latitude,longitude,rank='normal',globe='http://www.wikidata.org/entity/Q2')=>({rank,mainsnak:{snaktype:'value',datavalue:{value:{latitude,longitude,globe,precision:0.0001}}}});
 const entity={id:'Q64',claims:{P625:[claim(52.52,13.405,'deprecated'),claim(52.5,13.4),claim(-4,60,'normal','http://www.wikidata.org/entity/Q111')]}};
 const selected=coordinate(entity);assert.equal(selected.latitude,52.5);
 assert.equal(isGeoPlace({...selected,title:'Berlin'}),true);
 assert.equal(coordinate({id:'Q11',claims:{P625:[claim(1,2,'normal','http://www.wikidata.org/entity/Q111')]}}),null);
});

test('W05 P17 geographic relationships come from current nondeprecated Wikidata statements only',async()=>{
 const {geoPlaceRelations}=await import('../src/services/exploration.mjs');
 const {clearApiCache}=await import('../src/services/wikimedia.mjs');
 const old=globalThis.fetch;clearApiCache();
 globalThis.fetch=async uri=>{
  const u=new URL(uri);
  if(u.searchParams.get('action')!=='wbgetentities')throw Error('Unexpected original API operation');
  const ids=(u.searchParams.get('ids')||'').split('|');
  const claim=(id,rank='normal')=>({rank,mainsnak:{snaktype:'value',datavalue:{value:{id}}}});
  return {ok:true,status:200,json:async()=>({entities:Object.fromEntries(ids.map(id=>[id,id==='Q64'?{id,claims:{P17:[claim('Q183')],P131:[claim('Q999','deprecated')]}}:{id,labels:{en:{value:'Germany'}},claims:{}}]))})};
 };
 try{
  const relations=await geoPlaceRelations('Q64');
  assert.equal(relations.length,1);assert.deepEqual([relations[0].property,relations[0].to,relations[0].title],['P17','Q183','Germany']);
  assert.equal(relations[0].sourceUrl,'https://www.wikidata.org/wiki/Q64#P17');
  await assert.rejects(()=>geoPlaceRelations('Q64;evil'),/Invalid/);
 }finally{globalThis.fetch=old;clearApiCache();}
});
