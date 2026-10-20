import test from 'node:test';import assert from 'node:assert/strict';
import {CHRONICLE_PROPERTIES,chronicleStatements,chronicleVisible,chroniclePropertyCounts,chronicleExtremeChallenge} from '../src/domain/exploration.mjs';
const claim=(time,precision,opts={})=>({rank:opts.rank||'normal',id:opts.id||'Q42$source',mainsnak:{snaktype:'value',datavalue:{value:{time,precision,before:opts.before||0,after:opts.after||0,calendarmodel:opts.calendar||'http://www.wikidata.org/entity/Q1985727'}}}});
const source={id:'Q42',labels:{en:{value:'Original topic'}},claims:{
 P569:[claim('+1879-00-00T00:00:00Z',9),claim('+1880-01-01T00:00:00Z',11,{rank:'deprecated'}),claim('-0044-03-15T00:00:00Z',11),claim('+1879-01-01T00:00:00Z',11,{before:1})],
 P571:[claim('+1905-03-00T00:00:00Z',10)],P577:[claim('+1915-12-02T00:00:00Z',11)],P580:[claim('+1800-00-00T00:00:00Z',9)],P585:[claim('+1930-00-00T00:00:00Z',8)]
}};
test('W06 retains separate original P-date claims with explicit year/month/day precision and claim identity',()=>{
 const rows=chronicleStatements(source);assert.deepEqual(rows.map(x=>x.property),['P569','P571','P577','P580']);
 assert.deepEqual(rows.map(x=>x.year),[1879,1905,1915,1800]);
 assert.deepEqual([rows[0].precision,rows[0].month,rows[0].day],[9,null,null]);
 assert.deepEqual([rows[1].precision,rows[1].month,rows[1].day],[10,3,null]);
 assert.deepEqual([rows[2].precision,rows[2].month,rows[2].day],[11,12,2]);
 assert.ok(rows.every(x=>x.qid==='Q42'&&x.sourceUrl==='https://www.wikidata.org/wiki/Q42#'+x.property&&x.claimId==='Q42$source'));
});
test('W06 rejects deprecated, BCE, subyear precision, ambiguous and unsupported time statements',()=>{
 const rows=chronicleStatements(source);
 assert.equal(rows.length,4);
 const invalid=[claim('+1880-00-00T00:00:00Z',8),claim('+1880-00-00T00:00:00Z',9,{after:2}),claim('+1880-15-00T00:00:00Z',10),claim('+1880-03-00T00:00:00Z',11)];
 assert.deepEqual(chronicleStatements({id:'Q7',claims:{P569:invalid}}),[]);
 assert.deepEqual(chronicleStatements({id:'not-QID',claims:source.claims}),[]);
});
test('W06 timeline filters never manufacture a source property/year or discard coincident year records',()=>{
 const rows=chronicleStatements(source);
 assert.equal(chronicleVisible(rows).length,4);
 assert.deepEqual(chronicleVisible(rows,{property:'P571'}).map(x=>x.year),[1905]);
 assert.deepEqual(chronicleVisible(rows,{fromYear:1900,toYear:1920}).map(x=>x.property),['P571','P577']);
 assert.deepEqual(chronicleVisible(rows,{query:'q42'}).map(x=>x.year),[1800,1879,1905,1915]);
 assert.deepEqual(chroniclePropertyCounts(rows).map(x=>x.property),['P580','P569','P571','P577']);
 assert.equal(chronicleVisible([...rows,{...rows[0],id:'another-verified',property:'P569'}]).length,5);
});
test('W06 a new earliest/latest challenge uses only original distinct dated years and remains unranked',()=>{
 const rows=chronicleStatements(source);
 for(const count of [3,4])for(const direction of ['earliest','latest']){
  const q=chronicleExtremeChallenge(rows,'w06:'+direction,{direction,count});
  assert.equal(q.options.length,count);assert.equal(q.ranked,false);
  assert.equal(q.answer.year,direction==='earliest'?Math.min(...q.options.map(x=>x.year)):Math.max(...q.options.map(x=>x.year)));
  assert.equal(chronicleExtremeChallenge(rows,'w06:'+direction,{direction,count}).answer.id,q.answer.id);
 }
 assert.throws(()=>chronicleExtremeChallenge(rows.slice(0,2),'short',{count:3}),/Not enough/);
 assert.throws(()=>chronicleExtremeChallenge(rows,'seed',{direction:'sort'}),/Unsupported/);
});
