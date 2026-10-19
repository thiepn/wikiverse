import test from 'node:test';import assert from 'node:assert/strict';
import {pulseCalendar,pulseObservedSegments,pulsePeriodComparison,pulseDayEvidence,normalizePageviews} from '../src/domain/history.mjs';
const start='20261001',end='20261014';
function response(title,seed=40,missing=[]){
 return {items:Array.from({length:14},(_,i)=>i+1).filter(i=>!missing.includes(i)).map(i=>({article:title,project:'en.wikipedia',access:'all-access',agent:'user',granularity:'daily',timestamp:'202610'+String(i).padStart(2,'0')+'00',views:seed+i}))};
}
const load=(title,n=40,gaps=[])=>normalizePageviews(response(title,n,gaps),{language:'en',title,start,end});
test('W09 full source date axis preserves nulls for absent Wikimedia records, not fabricated zeros',()=>{
 const x=load('Marie Curie',40,[2,7]),rows=pulseCalendar([x]);
 assert.equal(rows.length,14);assert.equal(rows[1].date,'2026-10-02');assert.equal(rows[1].values[0].views,null);
 assert.equal(rows[2].values[0].views,43);
 assert.equal(pulseObservedSegments(x,rows).length,3);
 assert.deepEqual(pulseObservedSegments(x,rows).map(a=>a.length),[1,4,7]);
});
test('W09 comparison windows are equal and a missing date refuses derived percent change',()=>{
 const a=load('Marie Curie',40),b=load('Albert Einstein',15,[9]);
 const h=pulsePeriodComparison([a,b],'halves');
 assert.equal(h.days,7);assert.equal(h.earlier.start,'2026-10-01');assert.equal(h.later.start,'2026-10-08');
 assert.equal(h.articles[0].earlier.observedDays,7);
 assert.ok(h.articles[0].changePct>0);assert.equal(h.articles[1].changePct,null);
 assert.equal(h.articles[1].later.observedDays,6);
 const w=pulsePeriodComparison([a,b],'week');assert.equal(w.days,7);
 assert.throws(()=>pulsePeriodComparison([a],'invented'),/Unsupported/);
});
test('W09 exact-date inspection keeps actual source IDs, missingness and tied counts unranked',()=>{
 const a=load('Marie Curie',40),b=load('Albert Einstein',40);
 const tied=pulseDayEvidence([a,b],'2026-10-02');
 assert.equal(tied.uniqueLeader,null);assert.equal(tied.observed,2);
 const partial=pulseDayEvidence([a,load('Albert Einstein',40,[2])],'2026-10-02');
 assert.equal(partial.missing,1);assert.equal(partial.uniqueLeader,null);
 const distinct=pulseDayEvidence([a,load('Albert Einstein',12)],'2026-10-02');
 assert.equal(distinct.uniqueLeader.id,'en:Marie Curie');
 assert.ok(distinct.values.every(x=>x.source.includes('wikimedia.org')));
 assert.throws(()=>pulseDayEvidence([a],'2025-01-01'),/outside/);
});
