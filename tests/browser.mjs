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
const sourceStarters=['Marie Curie','Albert Einstein','Ada Lovelace','Moon','France','Charles Darwin','Ancient Rome'];
for(let i=0;i<sourceStarters.length;i++)articles[sourceStarters[i]]={pageid:900+i,revid:909+i,links:['Physics']};

function respond(url){
 const p=url.searchParams,action=p.get('action');
 if(action==='query'&&p.get('prop')==='revisions'){
   const revs=Array.from({length:8},(_,i)=>({revid:5008-i,timestamp:'2026-10-'+String(15-i).padStart(2,'0')+'T12:00:00Z',size:1600-i*20,comment:'Archived Wikipedia edit '+(8-i)}));
   if(p.get('rvstart')){
     const more=!!p.get('rvcontinue');
     const selected=more?revs.slice(4):revs.slice(0,4);
     return {query:{pages:[{pageid:900,title:'Marie Curie',revisions:selected}]},...(more?{}:{continue:{continue:'||',rvcontinue:'20261012120000|5005'}})};
   }
   return {query:{pages:[{pageid:900,title:p.get('titles'),revisions:revs}]}};
 }
 if(action==='query'&&p.get('prop')==='pageprops')return {query:{pages:[{pageprops:{wikibase_item:titleToId[p.get('titles')]||null}}]}};
 if(action==='query'&&p.get('list')==='search')return {query:{search:[{title:'Mathematics',pageid:1,snippet:'Mathematics'},...titles.slice(0,3).map((title,i)=>({title,pageid:10+i,snippet:title}))]}};
 if(action==='wbgetentities'&&p.get('props')==='sitelinks')return {entities:Object.fromEntries((p.get('ids')||'').split('|').map(id=>[id,{id,sitelinks:{enwiki:{title:idToTitle[id]},frwiki:{title:idToTitle[id]},dewiki:{title:idToTitle[id]},kowiki:{title:idToTitle[id]},trwiki:{title:idToTitle[id]}}}]))};
 if(action==='wbgetentities')return {entities:Object.fromEntries((p.get('ids')||'').split('|').map(id=>[id,entity(id)]))};
 if(action==='parse'){
   const id=Number(p.get('oldid'));const title=(id>=5001&&id<=5008)?'Marie Curie':id?Object.keys(articles).find(x=>articles[x].revid===id):p.get('page');
   const a=articles[title]||{pageid:900,revid:909,links:['Physics']};
   const lang=url.hostname.split('.')[0];
   let html='<p>Source text from '+title+'. '+a.links.map(x=>'<a href="/wiki/'+x+'">'+x+'</a>').join(' ')+'</p>';
   if(title==='Marie Curie'){
     html='<p>Marie Curie studied radioactivity through extensive scientific research and experimental observations on chemical materials and physical phenomena.<sup class="reference"><a href="#cite_note-ref1">[1]</a></sup></p>'+
       '<p>Careful historical documentation records the scientific discoveries described in scholarly sources and published research materials.<sup class="reference"><a href="#cite_note-ref2">[2]</a></sup></p>'+
       '<p>Experimental studies contributed to important conversations about science and society in numerous educational publications.<sup class="reference"><a href="#cite_note-ref3">[3]</a></sup></p>'+
       '<ol class="references">'+[1,2,3].map(i=>'<li id="cite_note-ref'+i+'"><span class="reference-text"><a class="external text" href="https://example.org/reference-'+i+'">Research publication '+i+' and historical bibliography</a> — 2021</span></li>').join('')+'</ol>';
     if(lang==='fr')html='<p>Marie Curie étudiait la radioactivité dans plusieurs laboratoires scientifiques et développait une compréhension nouvelle des phénomènes physiques complexes observés pendant ses recherches.</p>'+
       '<p>Cette chercheuse utilisait des méthodes expérimentales rigoureuses pour analyser les matériaux et communiquer ses résultats scientifiques au public européen.</p>';
   }
   if(id>=5001&&id<=5008){
     html='<p>Marie Curie studied experimental science and investigated physical phenomena with documented research materials.</p>'+
       (id>=5006?'<p>A later revision added documented research into scientific history and archive materials for readers.</p>':
       '<p>An earlier revision presented the scientific record with a separate discussion of European laboratories.</p>');
   }
   return {parse:{title,pageid:lang==='fr'?1290:a.pageid,revid:id|| (lang==='fr'?1291:a.revid),text:html,links:a.links.map(x=>({ns:0,'*':x}))}};
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
   await context.route('**/api/rest_v1/metrics/pageviews/**',route=>{
     const url=new URL(route.request().url());const segments=url.pathname.split('/');const title=decodeURIComponent(segments[segments.length-4]).replaceAll('_',' '),start=segments.at(-2),end=segments.at(-1);
     const project=segments.find(x=>x.endsWith('.wikipedia.org')).replace('.org','');
     const parse=v=>Date.UTC(Number(v.slice(0,4)),Number(v.slice(4,6))-1,Number(v.slice(6,8)));
     const entries=[];for(let day=parse(start),i=0;day<=parse(end);day+=86400000,i++){
       const key=new Date(day).toISOString().slice(0,10).replaceAll('-','');
       entries.push({article:title.replaceAll(' ','_'),project,access:'all-access',agent:'user',granularity:'daily',timestamp:key+'00',views:(title==='Marie Curie'?200:100)+i*2});
     }
     return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({items:entries})});
   });
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
   await page.locator('.exp-relation-options button').first().click();
   await page.locator('.exp-relations-game .exp-feedback').waitFor();
   await page.getByRole('button',{name:/Another statement/}).click();
   await page.locator('.exp-connection button').first().click();await page.getByText('WIKIDATA ENTITY Q90001').waitFor();
   await nav('GeoWiki');await page.getByRole('button',{name:'Locate a city'}).click();
   await page.locator('.exp-place-options button').first().click();await page.getByText('Correct!',{exact:true}).waitFor();
   await nav('WikiChronicle');await page.getByText('Source-verified chronology').waitFor();
   await page.getByRole('button',{name:'Order challenge'}).click();
   await page.getByRole('button',{name:/Check order/}).click();await page.getByText(/Not quite/).waitFor();
   await page.getByRole('button',{name:/Reshuffle/}).click();
   await nav('WikiPolyglot');
   await page.locator('.learn-pane.shown').waitFor();
   await page.getByRole('textbox',{name:'Captured phrase'}).fill('radioactivité');
   await page.getByRole('textbox',{name:'Your meaning'}).fill('radioactivity');
   await page.getByRole('button',{name:/Save to My Universe/}).click();
   await page.locator('.learn-choices button').first().click();
   await page.locator('.learn-feedback').first().waitFor();
   await nav('Source Detective');
   await page.locator('.learn-citation-choices button').first().waitFor();
   await page.locator('.learn-citation-choices button').first().click();
   await page.locator('.learn-feedback').first().waitFor();
   await page.locator('#review-verdict').selectOption('unreviewed');
   await page.locator('#review-note').fill('The external citation has not been independently inspected in this mocked browser session.');
   if(mode==='mobile'){
     const b=page.getByRole('button',{name:/Save private review/});
     await b.scrollIntoViewIfNeeded();
     const metrics=await b.evaluate(el=>{
       const r=el.getBoundingClientRect();const x=r.left+r.width/2,y=r.top+r.height/2;
       const hit=document.elementFromPoint(x,y);
       const parent=el.parentElement?.getBoundingClientRect();
       return {button:{x:r.x,y:r.y,width:r.width,height:r.height},viewport:{w:window.innerWidth,h:window.innerHeight,scrollY:window.scrollY,visualHeight:window.visualViewport?.height},center:{x,y},hit:hit?.outerHTML.slice(0,350),parent:{x:parent?.x,y:parent?.y,width:parent?.width,height:parent?.height}};
     });
     console.log('MOBILE REVIEW TAP GEOMETRY',JSON.stringify(metrics));
     const overflow=await page.evaluate(()=>({visualWidth:window.visualViewport?.width,innerWidth:window.innerWidth,scrollWidth:document.documentElement.scrollWidth}));
     console.log('MOBILE VIEWPORT CHECK',JSON.stringify(overflow));
     assert.ok(overflow.innerWidth<=(overflow.visualWidth||412)+2,'Mobile article layout expands beyond visual viewport');
   }
   await page.getByRole('button',{name:/Save private review/}).click();
   await page.getByText(/Review saved locally/).waitFor();
   await nav('WikiPulse');
   await page.locator('.hist-metric').first().waitFor();
   assert.equal(await page.locator('.hist-metric').count(),2);
   await page.getByRole('button',{name:/Show accessible daily data table/}).click();
   await page.locator('.hist-table-wrap table').waitFor();
   await page.locator('.hist-options button').first().click();
   await page.locator('.hist-result').waitFor();
   await nav('Time Capsule');
   await page.locator('.hist-compare-controls select').first().waitFor();
   await page.getByRole('button',{name:/Compare article text/}).click();
   await page.locator('.hist-diff').waitFor();
   await page.locator('.hist-options button').first().click();
   await page.locator('.hist-result').waitFor();
   await page.getByRole('button',{name:'Date-scoped archive'}).click();
   await page.locator('#capsule-anchor').fill('2026-10-12');
   await page.locator('#capsule-days').selectOption('30');
   await page.getByRole('button',{name:/Search selected date window/}).click();
   await page.getByText(/4 SCOPED REVISIONS/).waitFor();
   await page.getByRole('button',{name:/Load more revisions from this date window/}).click();
   await page.getByText(/8 SCOPED REVISIONS/).waitFor();
   await nav('Trail Arena');
   await page.locator('#arena-starter').selectOption({label:'Mathematics'});
   await page.getByRole('button',{name:/Generate practice trail/}).click();
   await page.locator('.arena-options button').filter({hasText:'Physics'}).click();
   await page.locator('.arena-options button').filter({hasText:'History'}).click();
   await page.getByText('Proven path completed').waitFor();
   const portable=await page.locator('#arena-code').inputValue();
   assert.ok(portable.startsWith('WV1.'),'Share code must contain versioned canonical route');
   await page.getByRole('button',{name:/Try another challenge/}).click();
   await page.locator('#arena-import').fill(portable);
   await page.getByRole('button',{name:/Verify and play this route/}).click();
   await page.locator('.arena-options button').filter({hasText:'Physics'}).waitFor();
   await page.locator('.arena-options button').filter({hasText:'Physics'}).click();
   await page.locator('.arena-options button').filter({hasText:'History'}).click();
   await page.getByText('Proven path completed').waitFor();
   await page.getByRole('button',{name:/Create private room invitation/}).click();
   await page.locator('#room-invite-code').waitFor();
   const roomCode=await page.locator('#room-invite-code').inputValue();
   assert.ok(roomCode.startsWith('WVROOM1.'),'Host invitation must be portable and versioned');
   await page.getByRole('button',{name:/Try another challenge/}).click();
   await page.locator('#room-import').fill(roomCode);
   await page.locator('#room-guest').fill('Guest');
   await page.getByRole('button',{name:/Verify private room and open trail/}).click();
   await page.getByText(/presence: NOT CONNECTED/).waitFor();
   await page.locator('.arena-options button').filter({hasText:'Physics'}).click();
   await page.locator('.arena-options button').filter({hasText:'History'}).click();
   await page.getByText('Proven path completed').waitFor();
   await page.getByRole('button',{name:/Try another challenge/}).click();
   await page.getByRole('button',{name:/Create today’s verified challenge/}).click();
   await page.locator('#arena-code').waitFor();
   const dailyCode=await page.locator('#arena-code').inputValue();
   assert.ok(dailyCode.startsWith('WV1.'),'Daily manifest should be exported after verification');
   await nav('Discover');await nav('Trail Arena');
   await page.getByRole('button',{name:/Create today’s verified challenge/}).click();
   await page.locator('#arena-code').waitFor();
   assert.equal(await page.locator('#arena-code').inputValue(),dailyCode,'Daily route must preserve local pinned revisions');
   await nav('Daily Missions');await page.getByRole('heading',{name:/Daily Missions/}).waitFor();
   assert.equal(await page.locator('.mission-item').count(),5,'Five actionable daily tasks');
   assert.ok((await page.locator('.mission-achievement').count())>=6);
   await nav('My Universe');await page.getByText(/Located Berlin/).waitFor();
   await page.getByText(/radioactivité/).waitFor();
   await page.getByText(/not been independently inspected/).waitFor();
   assert.deepEqual(issues,[],mode+' browser JavaScript exceptions');
   console.log('PASS Chromium '+mode+': race→mystery→Galaxy→GeoWiki→Chronicle→Polyglot→Detective→Pulse→Capsule window→Trail Arena share/room/daily→Galaxy statements→missions→local history');
   await context.close();
 }
}finally{await browser?.close();server.kill('SIGTERM');}
