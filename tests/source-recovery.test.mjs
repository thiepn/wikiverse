import test from 'node:test';import assert from 'node:assert/strict';
import {apiRequest,clearApiCache,retryDelayMs,sourceFailureAdvice} from '../src/services/wikimedia.mjs';
import {createLinkAudit} from '../src/services/linklab.mjs';
test('Retry delay is nonzero without Retry-After, bounded when Wikimedia supplies it',()=>{
 assert.equal(retryDelayMs({headers:{get:()=>null}},0),300);
 assert.equal(retryDelayMs({headers:{get:()=>null}},1),700);
 assert.equal(retryDelayMs({headers:{get:()=> '10'}},0),1500);
 assert.equal(retryDelayMs({headers:{get:()=> '0'}},0),0);
});
test('Source errors distinguish genuine source-integrity failure from recoverable outages',()=>{
 assert.deepEqual(sourceFailureAdvice(new Error('Wikimedia rate limit reached. Try again later.')).kind,'rate-limited');
 assert.equal(sourceFailureAdvice(new Error('Wikimedia request timed out')).retryable,true);
 assert.equal(sourceFailureAdvice(new Error('Pinned Wikipedia revision ID did not match source response')).retryable,false);
 assert.match(sourceFailureAdvice(new Error('Article unavailable')).hint,/source/);
});
test('Wikimedia transient 502 recovers with exactly one bounded retry; cached follow-up incurs no fetches',async()=>{
 clearApiCache();let count=0;
 const fetcher=async()=>{count++;return count===1?{ok:false,status:502,headers:{get:()=>null}}:{ok:true,status:200,json:async()=>({query:{pages:[]}})};};
 const url='https://en.wikipedia.org/w/api.php',args={action:'query',titles:'BoundedSourceTest'};
 const r=await apiRequest(url,args,{fetcher});assert.deepEqual(r,{query:{pages:[]}});assert.equal(count,2);
 await apiRequest(url,args,{fetcher});assert.equal(count,2);
});
test('Link Lab stops trying additional contrast pages during API rate limiting rather than multiplying upstream requests',async()=>{
 clearApiCache();let calls=0;
 const original=globalThis.fetch;
 globalThis.fetch=async url=>{calls++;const u=new URL(url);
  if(u.searchParams.get('page')==='Mathematics')return {ok:true,status:200,json:async()=>({parse:{title:'Mathematics',pageid:1,revid:111,text:'<p>Verified</p>',links:[{ns:0,'*':'Physics'}]}})};
  return {ok:false,status:429,headers:{get:()=>null}};
 };
 try{await assert.rejects(()=>createLinkAudit({start:'Mathematics',seed:'source_test_limited'}),/rate limit/);assert.equal(calls,3);}finally{globalThis.fetch=original;}
});
