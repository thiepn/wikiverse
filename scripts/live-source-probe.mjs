/** Four bounded GET requests, no credentials, no writes, no persistent traffic. Node network only; CORS not verified. */
const TIMEOUT_MS=5500;
const UA='THIEPN-WikiVerse-CI/0.1 (https://github.com/thiepn/wikiverse; noncommercial source compatibility probe)';
const result=[];
async function get(label,url,check){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),TIMEOUT_MS);
 try{
  const r=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json','Api-User-Agent':UA}});
  if(!r.ok){const state=[401,403,429,500,502,503,504].includes(r.status)?'NOT_TESTED':'FAIL';console.log('LIVE '+label+' '+state+' HTTP '+r.status);result.push(state);return null;}
  const content=await r.json();
  if(!check(content)){console.log('LIVE '+label+' FAIL unexpected public API response shape');result.push('FAIL');return null;}
  console.log('LIVE '+label+' PASS (read-only original API response)');result.push('PASS');return content;
 }catch(error){console.log('LIVE '+label+' NOT_TESTED '+String(error?.message||error).slice(0,100));result.push('NOT_TESTED');return null;}
 finally{clearTimeout(timeout);}
}
const params=(base,entries)=>{const u=new URL(base);for(const [k,v] of Object.entries(entries))u.searchParams.set(k,String(v));return u.toString();};
const wiki='https://en.wikipedia.org/w/api.php';
const revisions=await get('Wikipedia revision metadata',params(wiki,{action:'query',prop:'revisions',titles:'Mathematics',rvlimit:1,rvprop:'ids|timestamp',format:'json',formatversion:2}),x=>x?.query?.pages?.[0]?.pageid>0&&x.query.pages[0].revisions?.[0]?.revid>0);
const revisionId=revisions?.query?.pages?.[0]?.revisions?.[0]?.revid;
if(revisionId){
 await get('Wikipedia pinned revision parse',params(wiki,{action:'parse',oldid:revisionId,prop:'text|links|revid',format:'json',formatversion:2}),x=>x?.parse?.revid===revisionId&&x.parse.pageid===revisions.query.pages[0].pageid&&typeof x.parse.text==='string'&&Array.isArray(x.parse.links));
}else{result.push('NOT_TESTED');console.log('LIVE Wikipedia pinned revision parse NOT_TESTED (metadata prerequisite unavailable)');}
const wikidata=await get('Wikidata canonical Q42 entity identity',params('https://www.wikidata.org/w/api.php',{action:'wbgetentities',ids:'Q42',props:'labels',languages:'en',format:'json',formatversion:2}),x=>x?.entities?.Q42?.id==='Q42');
if(wikidata){
 const labels=wikidata.entities.Q42.labels||{};
 if(labels.en?.value)console.log('LIVE Wikidata English label PASS (source provided)');
 else{
  console.log('LIVE Wikidata English label NOT_TESTED (valid canonical entity returned without localized label; no label or grade invented)');
  result.push('NOT_TESTED');
  const fallback=await get('Wikidata fallback entity identity',params('https://www.wikidata.org/w/api.php',{action:'wbgetentities',ids:'Q42',props:'labels',languages:'en',languagefallback:1,format:'json',formatversion:1}),x=>x?.entities?.Q42?.id==='Q42');
  if(fallback){
   const fallbackLabel=fallback.entities.Q42.labels?.en?.value;
   console.log('LIVE Wikidata fallback English label '+(fallbackLabel?'PASS':'NOT_TESTED')+(fallbackLabel?'':' (no localized label provided)'));
   result.push(fallbackLabel?'PASS':'NOT_TESTED');
  }
 }
}
await get('Wikimedia daily pageviews','https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Mathematics/daily/20261001/20261002',x=>Array.isArray(x?.items)&&x.items.length>=1&&x.items.every(y=>y.project==='en.wikipedia'&&y.granularity==='daily'&&Number.isSafeInteger(y.views)));
console.log('LIVE API PROBE SUMMARY',JSON.stringify({pass:result.filter(x=>x==='PASS').length,not_tested:result.filter(x=>x==='NOT_TESTED').length,fail:result.filter(x=>x==='FAIL').length,transport:'Node GET only; client browser CORS remains NOT_TESTED'}));
if(result.includes('FAIL'))process.exitCode=1;
