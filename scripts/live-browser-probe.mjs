/** Read-only, bounded cross-origin Wikimedia compatibility check in a genuine Chromium page.
 * This checks browser CORS/source shape, not live gameplay accuracy or server authorization.
 */
import {spawn} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';
import {chromium} from 'playwright-core';
const chrome=process.env.CHROME_BIN||'/usr/bin/google-chrome';
const port=4187;
const server=spawn('npm',['run','dev','--','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
let browser;
let fail=0,passed=0,notTested=0;
const grade=(label,status,detail='')=>{
 console.log('LIVE BROWSER '+label+' '+status+(detail?' '+String(detail).slice(0,145):''));
 if(status==='PASS')passed++;else if(status==='FAIL')fail++;else notTested++;
};
try{
 let ready=false;
 for(let i=0;i<30;i++){
  if(server.exitCode!==null)break;
  try{const response=await fetch('http://127.0.0.1:'+port+'/',{signal:AbortSignal.timeout(900)});if(response.ok){ready=true;break;}}catch{}
  await wait(250);
 }
 if(!ready){grade('browser origin','NOT_TESTED','local preview unavailable');}
 else{
  browser=await chromium.launch({headless:true,executablePath:chrome,args:['--no-sandbox']});
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'domcontentloaded',timeout:10000});
  const cases=[
   {label:'Wikipedia Action API CORS',url:'https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=general&format=json&formatversion=2&origin=*',kind:'wiki'},
   {label:'Wikidata Action API CORS',url:'https://www.wikidata.org/w/api.php?action=wbgetentities&ids=Q42&props=labels&languages=en&languagefallback=1&format=json&formatversion=1&origin=*',kind:'wikidata'},
   {label:'Wikimedia Pageviews CORS',url:'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Mathematics/daily/20261001/20261002',kind:'views'}
  ];
  for(const test of cases){
   const result=await page.evaluate(async ({url,kind})=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
    try{
     const response=await fetch(url,{method:'GET',mode:'cors',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal});
     if(!response.ok)return {status:[401,403,429,500,502,503,504].includes(response.status)?'NOT_TESTED':'FAIL',detail:'HTTP '+response.status};
     const body=await response.json();
     const ok=kind==='wiki'?typeof body.query?.general?.sitename==='string':kind==='wikidata'?body.entities?.Q42?.id==='Q42':Array.isArray(body.items)&&body.items.some(x=>x.project==='en.wikipedia');
     return {status:ok?'PASS':'FAIL',detail:ok?'response validated':'source payload missing expected identity'};
    }catch(error){return {status:'NOT_TESTED',detail:String(error?.message||error).slice(0,100)};}
    finally{clearTimeout(timer);}
   },test);
   grade(test.label,result.status,result.detail);
  }
 }
}catch(e){grade('browser setup','NOT_TESTED',e?.message||e);}
finally{await browser?.close();server.kill('SIGTERM');}
console.log('LIVE BROWSER SUMMARY',JSON.stringify({pass:passed,notTested,fail,authority:'public original GET only',credentials:false}));
if(fail)process.exitCode=1;
