import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import http from 'node:http';
const {chromium}=await import('playwright-core');
const chrome=process.env.CHROME_BIN||['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium'].find(existsSync);
if(!chrome)throw new Error('No Chromium executable found for browser acceptance');
const people=['Marie Curie','Albert Einstein','Ada Lovelace','Isaac Newton','Charles Darwin','Florence Nightingale','Alan Turing','Katherine Johnson','Rosalind Franklin','Galileo Galilei','Grace Hopper'];
const geo=['Berlin','Paris','Tokyo','Cairo','Nairobi','Sydney','Rio de Janeiro','Reykjavík','Seoul','Cape Town'];
const events=['Apollo 11','World War I','French Revolution'];
const titles=[...new Set([...people,...geo,...events])];
const titleToId=Object.fromEntries(titles.map((name,i)=>[name,'Q'+(10001+i)]));
const idToTitle=Object.fromEntries(Object.entries(titleToId).map(([title,id])=>[id,title]));
const claim=v=>({rank:'normal',mainsnak:{snaktype:'value',datavalue:{value:v}}});
const birth=Object.fromEntries([...people,...events].map((name,i)=>[name,1760+i*11]));
const position=Object.fromEntries(geo.map((name,i)=>[name,{latitude:70-i*13,longitude:-140+i*30,globe:'http://www.wikidata.org/entity/Q2',precision:0.001}]));
function entity(qid){
 if(qid==='Q90001')return {id:qid,labels:{en:{value:'scientist'}},claims:{}};
 if(qid==='Q90002')return {id:qid,labels:{en:{value:'Warsaw'}},claims:{}};
 if(qid==='Q90003')return {id:qid,labels:{en:{value:'scientific award'}},claims:{}};
 const title=idToTitle[qid];if(!title)return {id:qid,missing:''};
 const claims={};
 if(people.includes(title)){claims.P106=[claim({id:'Q90001'})];claims.P19=[claim({id:'Q90002'})];claims.P166=[claim({id:'Q90003'})];}
 if(position[title])claims.P625=[claim(position[title])];
 if(birth[title])claims[events.includes(title)?'P571':'P569']=[claim({time:'+'+String(birth[title]).padStart(4,'0')+'-01-01T00:00:00Z',precision:11})];
 return {id:qid,labels:{en:{value:title}},aliases:{en:[]},claims};
}
const articles={Mathematics:{pageid:1,revid:111,links:['Physics']},Physics:{pageid:2,revid:222,links:['History']},History:{pageid:3,revid:333,links:['Mathematics']}};
function respond(url){
 const p=url.searchParams,action=p.get('action');
 if(action==='query'&&p.get('prop')==='pageprops')return {query:{pages:[{pageprops:{wikibase_item:titleToId[p.get('titles')]||null}}]}};
 if(action==='query'&&p.get('list')==='search')return {query:{search:[{title:'Mathematics',pageid:1,snippet:'Mathematics'},...titles.slice(0,3).map((title,i)=>({title,pageid:10+i,snippet:title}))]}};
 if(action==='wbgetentities')return {entities:Object.fromEntries((p.get('ids')||'').split('|').map(id=>[id,entity(id)]))};
 if(action==='parse'){
   const id=Number(p.get('oldid'));const title=id?Object.keys(articles).find(x=>articles[x].revid===id):p.get('page');
   const a=articles[title]||{pageid:900,revid:909,links:['Physics']};
   return {parse:{title,pageid:a.pageid,revid:a.revid,text:'<p>Source text from '+title+'. '+a.links.map(x=>'<a href="/wiki/'+x+'">'+x+'</a>').join(' ')+'</p>',links:a.links.map(x=>({ns:0,'*':x}))}};
 }
 return {error:{info:'Unmocked API operation: '+action}};
}
async function ready(url){for(let i=0;i<80;i++){try{const code=await new Promise((resolve,reject)=>{http.get(url,res=>{res.resume();resolve(res.statusCode);}).on('error',reject);});if(code===200)return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error('Vite server did not become ready');}
const server=spawn(process.execPath,['./node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4173','--strictPort'],{stdio:['ignore','pipe','pipe']});
let logs='';server.stderr.on('data',d=>{logs+=d.toString();});
let browser;
try{
 await ready('http://127.0.0.1:4173');
 browser=await chromium.launch({executablePath:chrome,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 for(const mode of ['desktop','mobile']){
   const context=await browser.newContext({viewport:mode==='desktop'?{width:1440,height:900}:{width:412,height:915},isMobile:mode==='mobile',hasTouch:mode==='mobile',deviceScaleFactor:mode==='mobile'?2:1});
   await context.route('**/w/api.php?**',route=>route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(respond(new URL(route.request().url())))}));
   const page=await context.newPage();page.setDefaultTimeout(12000);const issues=[];
   page.on('pageerror',e=>issues.push(e.message));
   await page.goto('http://127.0.0.1:4173',{waitUntil:'domcontentloaded'});
   await page.getByRole('heading',{name:/Everything is/i}).waitFor();
   async function nav(name){if(mode==='mobile')await page.getByRole('button',{name:'Toggle navigation'}).click();await page.locator('nav button').filter({hasText:name}).click();}
   await nav('WikiRace');
   await page.locator('#start').selectOption({label:'Mathematics'});
   await page.getByRole('button',{name:/Generate verified route/}).click();
   await page.locator('.article-body a[data-article-title="Physics"]').click();
   await page.locator('.article-body a[data-article-title="History"]').click();
   await page.getByText('You found the path.').waitFor();
   await nav('WikiMystery');await page.getByRole('button',{name:/Start mystery/}).click();
   const qid=await page.locator('.mystery-grid .eyebrow').first().textContent();
   const answer=idToTitle[(qid||'').match(/Q\d+/)?.[0]];
   assert.ok(answer,'Mystery must have a canonical answer identity');
   await page.locator('#answer').fill(answer);await page.getByRole('button',{name:/Submit/}).click();
   await page.getByText('CORRECT',{exact:true}).waitFor();
   await nav('Knowledge Galaxy');await page.getByText('Source relationships').waitFor();
   await page.locator('.exp-connection button').first().click();await page.getByText('WIKIDATA ENTITY Q90001').waitFor();
   await nav('GeoWiki');await page.getByRole('button',{name:'Locate a city'}).click();
   await page.locator('.exp-place-options button').first().click();await page.getByText('Correct!',{exact:true}).waitFor();
   await nav('WikiChronicle');await page.getByText('Source-verified chronology').waitFor();
   await page.getByRole('button',{name:'Order challenge'}).click();
   await page.getByRole('button',{name:/Check order/}).click();await page.getByText(/Not quite/).waitFor();
   await page.getByRole('button',{name:/Reshuffle/}).click();
   await nav('My Universe');await page.getByText(/Located Berlin/).waitFor();
   assert.deepEqual(issues,[],mode+' browser JavaScript exceptions');
   console.log('PASS Chromium '+mode+': race→mystery→Galaxy→GeoWiki→Chronicle→local history');
   await context.close();
 }
}finally{await browser?.close();server.kill('SIGTERM');}
