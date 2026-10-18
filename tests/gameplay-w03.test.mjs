import test from 'node:test';import assert from 'node:assert/strict';
import {generateVerifiedRace,mysteryCluePlan,mysteryCandidateOrder} from '../src/domain/game.mjs';
import {buildLinkAudit,buildCommonLinkAudit} from '../src/domain/linklab.mjs';
const ids=['Start','Second','Third','Fourth'].map((title,i)=>({title,pageId:i+1,revisionId:i+101,language:'en'}));
const graph=Object.fromEntries(ids.map((v,i)=>[v.title,{identity:v,links:i<ids.length-1?[ids[i+1].title]:[]}]));
test('W03 source-backed WikiRace supports actual 1, 2 and 3-hop paths',async()=>{
 for(const hops of [1,2,3]){const m=await generateVerifiedRace('Start','w03',async title=>graph[title],hops);assert.equal(m.proof.length,hops+1);assert.equal(m.target.title,ids[hops].title);assert.equal(m.ranked,false);}
 await assert.rejects(()=>generateVerifiedRace('Start','w03',async title=>graph[title],4),/one, two or three/);
 await assert.rejects(()=>generateVerifiedRace('Second','w03',async title=>graph[title],3),/Unable to prove/);
});
test('W03 sourced clue tiers use existing Wikidata claims',()=>{
 assert.deepEqual(mysteryCluePlan('guided',3),{level:'guided',initial:2,maxReveal:3});
 assert.deepEqual(mysteryCluePlan('standard',3),{level:'standard',initial:1,maxReveal:3});
 assert.deepEqual(mysteryCluePlan('expert',4),{level:'expert',initial:1,maxReveal:1});
 assert.throws(()=>mysteryCluePlan('guided',2),/at least three/);
});
test('W03 replay picks other original people before recent repeats',()=>{const x=mysteryCandidateOrder(['A','B','C'],'seed',['B','C']);assert.deepEqual(new Set(x),new Set(['A','B','C']));assert.equal(x[0],'A');});
const page=(title,pageId,links)=>({identity:{title,pageId,revisionId:pageId+100,language:'en'},links});
const a=page('A',1,['Shared','A1','A2']),b=page('B',2,['Shared','B1','B2','B3','B4']);
test('W03 three Link Lab choice densities draw only real links',()=>{
 for(const limit of [3,4,5]){
 const q=buildLinkAudit(a,b,{seed:'density',limit});assert.equal(q.choices.length,limit);
 assert.ok(q.choices.filter(x=>x!==q.answer).every(x=>b.links.includes(x)&&!a.links.includes(x)));
 const c=buildCommonLinkAudit(a,b,{seed:'density',limit});assert.ok(c.choices.includes('Shared'));assert.equal(c.choices.length,limit);
 }
 assert.throws(()=>buildLinkAudit(a,page('Sparse',3,['Z1','Z2']),{limit:5}),/Not enough/);
 assert.throws(()=>buildCommonLinkAudit(a,page('Sparse',3,['Shared','Z1','Z2']),{limit:5}),/Insufficient/);
});
