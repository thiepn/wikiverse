import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
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
for(let i=0;i<sourceStarters.length;i++)articles[sourceStarters[i]]={pageid:900+i,revid:909+i,links:['Physics','Biology','Economics','Literature']};
// Controlled original-source fixture: one genuine alternative link and three independently sourced contrast decoys.
articles['Albert Einstein'].links=['Physics','Theory of relativity'];
articles['Theory of relativity']={pageid:820,revid:1820,links:['History']};
// Every pinned source must have a unique page/revision identity, including rotated daily-date candidates.
for(const [name,pageid,revid] of [['Biology',811,1811],['Economics',812,1812],['Literature',813,1813]])articles[name]={pageid,revid,links:['Physics','History']};

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
   if(title==='Physics')html+='<p>Original physics research compares scientific observations and source material across several historical studies and documented experiments.</p><p>Published scientific articles document measurements and original evidence so readers can check the source and understand later interpretation.</p>';
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
   await page.getByRole('heading',{name:'Follow what connects.'}).waitFor();
   async function nav(name){if(mode==='mobile')await page.getByRole('button',{name:'Toggle navigation'}).click();await page.locator('nav button').filter({hasText:name}).click();}
   // W01 real navigation: all five destinations are accessible before individual game modes.
   await page.getByRole('heading',{name:'Follow what connects.'}).waitFor();
   await page.locator('.universe-primary-tabs').getByRole('button',{name:'Play'}).click();
   await page.getByRole('heading',{name:'Play with real sources.'}).waitFor();
   await page.locator('.universe-primary-tabs').getByRole('button',{name:'Learn'}).click();
   await page.getByRole('heading',{name:'Turn curiosity into knowledge.'}).waitFor();
   await page.locator('.universe-primary-tabs').getByRole('button',{name:'Discover'}).click();
   await page.getByRole('heading',{name:/Discover/}).waitFor();
   await page.locator('.universe-primary-tabs').getByRole('button',{name:'My Universe'}).click();
   await page.getByRole('heading',{name:/My Universe/}).waitFor();
   await page.locator('.universe-primary-tabs').getByRole('button',{name:'Explore'}).click();
   await page.getByRole('heading',{name:'Follow what connects.'}).waitFor();
   await nav('WikiRace');
   await page.locator('#start').selectOption({label:'Mathematics'});
   await page.getByRole('button',{name:/Generate verified route/}).click();
   await page.locator('.article-body a[data-article-title="Physics"]').click();
   await page.locator('.article-body a[data-article-title="History"]').click();
   await page.getByText('You found the path.').waitFor();
   await nav('Link Lab');
   await page.getByRole('button',{name:/Generate sourced question/}).click();
   await page.locator('.linklab-choices button').first().waitFor();
   assert.equal(await page.locator('.linklab-choices button').count(),4,'All link choices from real revisions');
   await page.locator('.linklab-choices button').filter({hasText:'Biology'}).click();
   await page.locator('.linklab-result').waitFor();
   await page.getByText(/Not linked from this revision/).waitFor();
   await page.getByRole('button',{name:/Another source question/}).click();
   await page.locator('.linklab-choices button').first().waitFor();
   await page.getByRole('button',{name:/What do both link to/}).click();
   await page.locator('.linklab-choices button').first().click();
   await page.locator('.linklab-result').waitFor();

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
   await page.locator('.learn-pane.shown .learn-article p').first().evaluate(el=>{
     const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
   });
   await page.getByRole('button',{name:/Save selected source excerpt/}).click();
   await page.locator('#exercise-language').selectOption('en');
   await page.locator('.learn-question[lang="en"]').waitFor();
   await page.locator('.learn-choices button').first().click();
   await page.locator('.learn-feedback').first().waitFor();
   await page.locator('#exercise-language').selectOption('fr');
   await page.locator('.learn-question[lang="fr"]').waitFor();
   await page.locator('.learn-choices button').first().click();
   await page.locator('.learn-feedback').first().waitFor();
   await page.getByRole('combobox',{name:'Compare language'}).selectOption('de');
   await page.getByRole('button',{name:/Compare articles/}).click();
   await page.locator('.learn-pane[lang="de"]').waitFor();
   await page.locator('.learn-source-bar').getByText(/Q10001/).waitFor();
   await page.locator('.learn-question[lang="de"]').waitFor();
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
   await nav('Discover');
   await page.locator('.topics button').filter({hasText:'Mathematics'}).click();
   // A source-specific handoff selects the original article rather than stale notes.
   await page.getByRole('button',{name:'Study this article →'}).click();
   await page.locator('.study-panel').getByRole('heading',{name:'Mathematics'}).waitFor();
   await nav('Discover');

   await page.locator('.reader-toolbar h2').getByText('Mathematics').waitFor();
   await page.getByRole('button',{name:/Save compact offline reading/}).click();
   await page.locator('.article-body a[data-article-title="Physics"]').click();
   await page.locator('.reader-toolbar h2').getByText('Physics').waitFor();
   await page.locator('.article-body p').first().evaluate(el=>{
     const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));
   });
   await page.getByRole('button',{name:/Save selected excerpt/}).click();
   await page.getByRole('button',{name:/Save compact offline reading/}).click();
   await nav('Study Desk');
   await page.getByRole('button',{name:/Offline reading/}).click();
   await page.locator('.study-offline-reader').waitFor();
   assert.match(await page.locator('.study-offline-reader').innerText(),/Physics/);
   await page.locator('.offline-compare').waitFor();
   assert.equal(await page.locator('.offline-compare-source').count(),2);
   await page.locator('#compare-search').fill('scientific observations');
   await page.locator('.offline-compare-results button').first().click();
   await page.locator('.offline-compare-quiz .offline-compare-actions button').first().click();
   assert.match(await page.locator('.offline-compare-message').innerText(),/saved revision/);
   await page.locator('.offline-compare-quiz>button').click();
   assert.match(await page.locator('.study-offline-reader a').first().getAttribute('href')||'',/oldid=222/);
   await page.getByRole('textbox',{name:'Search this saved text'}).fill('scientific observations');
   await page.locator('.offline-match-list button').first().click();
   assert.match(await page.locator('.offline-workbench-paragraph').innerText(),/scientific observations/);
   await page.getByRole('button',{name:'Locate a quotation'}).click();
   await page.locator('.offline-workbench-options button').first().click();
   await page.locator('.offline-workbench-feedback').waitFor();
   await page.getByRole('button',{name:'Restore passage order'}).click();
   await page.getByRole('button',{name:'Move card 3 down'}).click();
   await page.getByRole('button',{name:'Move card 3 down'}).click();
   await page.getByRole('button',{name:'Check saved source order'}).click();
   assert.match(await page.locator('.offline-workbench-feedback').innerText(),/Matches the original saved passage order/);
   await page.locator('.offline-workbench-paragraph p').evaluate(el=>{
     const selection=window.getSelection(),range=document.createRange();range.selectNodeContents(el);selection.removeAllRanges();selection.addRange(range);
   });
   await page.getByRole('button',{name:'Keep selected text as source excerpt'}).click();
   assert.match(await page.locator('.offline-workbench-hint[role="status"]').last().innerText(),/existing local collection/);
   await page.getByRole('button',{name:'Self-recall (ungraded)'}).click();
   await page.getByRole('button',{name:'Reveal original text'}).click();
   await page.locator('.study-offline-recall blockquote').getByText(/Source text from Physics/).waitFor();
   await page.reload({waitUntil:'domcontentloaded'});
   await nav('Study Desk');
   await page.getByRole('button',{name:/Offline reading/}).click();
   await page.locator('.study-offline-text p').getByText(/Source text from Physics/).waitFor();
   await page.getByRole('button',{name:/Saved topics & notes/}).click();
   await page.getByRole('heading',{name:/Study Desk/}).waitFor();
   await page.locator('.study-topic-list button').filter({hasText:'Physics'}).click();
   await page.locator('.study-clip-list article').first().waitFor();
   await page.locator('.study-clip-list a').first().getAttribute('href').then(href=>assert.match(href||'',/oldid=222/));
   await page.locator('.study-topic-list button').filter({hasText:'Mathematics'}).click();
   await page.locator('.study-path .study-step').first().waitFor();
   assert.equal(await page.locator('.study-path .study-step').count(),5,'Five source-specific study steps');
   await page.locator('.study-step').filter({hasText:'Keep the article in My Universe'}).getByRole('button').click();
   await page.locator('.study-step.complete').filter({hasText:'Keep the article in My Universe'}).waitFor();
   await page.locator('#study-note').fill('Compare mathematics definitions and citation provenance before the next review.');
   await page.locator('#study-status').selectOption('revisit');
   await page.getByRole('button',{name:/Save private note/}).click();
   await page.getByRole('button',{name:/Review queue/}).click();
   await page.locator('.study-review').first().waitFor();
   await page.locator('.study-review').filter({hasText:'Recheck original article links'}).getByRole('button',{name:/Practice source again/}).first().click();
   await page.getByRole('button',{name:/Revisit original pinned link evidence/}).click();
   await page.getByText(/ARCHIVED SOURCE REVIEW/).waitFor();
   await page.locator('.linklab-choices button').first().click();
   await page.locator('.linklab-result').waitFor();
   await nav('Study Desk');
   await page.getByRole('button',{name:/Reading journey/}).click();
   await page.getByText(/From Mathematics → Physics/).waitFor();
   await nav('My Universe');await page.getByText(/Located Berlin/).waitFor();
   await page.getByText(/radioactivité/).waitFor();
   await page.getByText(/not been independently inspected/).waitFor();
   await nav('Backup & Recovery');
   await page.getByRole('heading',{name:/Backup & Recovery/}).waitFor();
   const downloadEvent=page.waitForEvent('download');
   await page.getByRole('button',{name:/Download full JSON backup/}).click();
   const backupDownload=await downloadEvent;
   const backupBytes=await readFile(await backupDownload.path());
   const backupObject=JSON.parse(backupBytes.toString('utf8'));
   assert.equal(backupObject.kind,'wikiverse-local-backup');
   assert.equal(backupObject.progress.studyNotes.length,1,'Private study note retained in export');
   assert.ok(backupObject.progress.sourceClips.length>=2,'English and multilingual selected source excerpts exported');
   assert.ok(backupObject.progress.linkLab.length>=1,'Original source link activity exported');
   await page.locator('#backup-file').setInputFiles({name:'wikiverse-local.json',mimeType:'application/json',buffer:backupBytes});
   await page.getByText(/Verified file format and checksum/).waitFor();
   await page.locator('.backup-preview table').waitFor();
   assert.ok(await page.locator('.backup-preview tr').count()>=10,'Preview all original source record categories');
   await page.getByRole('checkbox',{name:/I reviewed the changes and want to merge/}).check();
   await page.getByRole('button',{name:/Confirm merge/}).click();
   await page.getByText(/Verified backup merged with this device/).waitFor();
   await page.locator('#backup-file').setInputFiles({name:'wikiverse-local.json',mimeType:'application/json',buffer:backupBytes});
   await page.getByRole('radio',{name:/Replace all local WikiVerse progress/}).check();
   await page.getByRole('checkbox',{name:/I reviewed the changes and want to replace/}).check();
   await page.getByRole('button',{name:/Confirm replacement/}).click();
   await page.getByText(/Verified backup replaced this device/).waitFor();
   await page.reload({waitUntil:'domcontentloaded'});
   await page.getByRole('heading',{name:'Follow what connects.'}).waitFor();
   await nav('Study Desk');
   await page.getByRole('heading',{name:/Study Desk/}).waitFor();
   await page.locator('.study-topic-list button').filter({hasText:'Mathematics'}).click();
   await page.locator('#study-note').waitFor();
   assert.equal(await page.locator('#study-note').inputValue(),'Compare mathematics definitions and citation provenance before the next review.','Restored private research note after reload');
   await nav('Study Desk');
   await page.locator('.study-topic-list button').filter({hasText:'Physics'}).click();
   await page.locator('.study-clip-list article').first().waitFor();
   await nav('My Universe');await page.getByText(/radioactivité/).waitFor();

   // Recovery + cross-mode learning: source-reviewed misses remain local and navigate to original graders.
   await page.evaluate(()=>{
     const p=JSON.parse(localStorage.getItem('wikiverse:progress:v1'));
     const at=new Date(Date.now()-3600000).toISOString();
     p.learning.push({id:'fr:125:456:mot',mode:'polyglot',kind:'source-cloze',correct:false,score:0,source:'https://fr.wikipedia.org/w/index.php?oldid=456',at});
     p.historyChallenges.push({id:'old-revision-change',mode:'capsule',kind:'revision-change',source:'https://en.wikipedia.org/w/index.php?oldid=222',sourceIds:['111','222'],correct:false,score:0,at});
     p.knowledgeAttempts.push({id:'Q42:Q5:P106',mode:'galaxy',kind:'wikidata-relationship',qids:['Q42','Q5'],propertyId:'P106',source:'https://www.wikidata.org/wiki/Q42#P106',correct:false,score:0,scoringAuthority:'wikidata-property-identity-only',at});
     localStorage.setItem('wikiverse:progress:v1',JSON.stringify(p));
   });
   await page.reload({waitUntil:'domcontentloaded'});
   await nav('Study Desk');
   await page.getByRole('button',{name:/Review queue/}).click();
   await page.locator('.study-review').filter({hasText:'original-language passage'}).first().waitFor();
   await page.locator('.study-review').filter({hasText:'original article change'}).first().waitFor();
   await page.locator('.study-review').filter({hasText:'recorded Wikidata relation'}).first().waitFor();
   await page.locator('.study-review').filter({hasText:'original-language passage'}).first().getByRole('button',{name:/Open original game/}).click();
   await page.getByRole('heading',{name:/WikiPolyglot/}).waitFor();
   assert.deepEqual(issues,[],mode+' browser JavaScript exceptions');

   // W02: source-specific, cross-mode journey from actual Wikipedia revision to original engines.
   await nav('Discover');
   await page.locator('#wiki-search').fill('Albert Einstein');
   await page.locator('.search-results button').filter({hasText:'Albert Einstein'}).first().click();
   await page.locator('.topic-journey h2').getByText('Albert Einstein').waitFor();
   await page.locator('.topic-journey-actions').getByRole('button',{name:/Knowledge Galaxy/}).click();
   await page.locator('.exp-source-focus').getByText(/page 901/).waitFor();
   await page.getByText('WIKIDATA ENTITY Q10002').waitFor();
   await page.locator('.topic-journey-actions').getByRole('button',{name:/GeoWiki/}).click();
   await page.locator('.exp-source-focus').getByText(/No qualifying P625 coordinate/).waitFor();
   await page.locator('.topic-journey-actions').getByRole('button',{name:/WikiChronicle/}).click();
   await page.locator('.exp-source-focus').getByText(/Recorded born year/).waitFor();
   await page.locator('.topic-journey-actions').getByRole('button',{name:/WikiPolyglot/}).click();
   await page.locator('.learn-source-bar').getByText(/Q10002/).waitFor();
   await page.locator('.topic-journey-actions').getByRole('button',{name:/Link Lab/}).click();
   await page.locator('.linklab-panel').getByText(/pinned English revision 910/).waitFor();
   await page.getByRole('button',{name:/Generate sourced question/}).click();
   await page.locator('.linklab-sources').getByText(/PAGE 901/).waitFor();
   await page.locator('.topic-journey-actions').getByRole('button',{name:/WikiRace/}).click();
   await page.locator('.scoreboard').getByText('Albert Einstein').waitFor();
   await page.locator('.topic-journey-actions').getByRole('button',{name:/Study Desk/}).click();
   await page.locator('.study-panel').getByRole('heading',{name:'Albert Einstein'}).waitFor();
   await page.locator('.topic-journey-links').getByRole('button',{name:/Reopen exact revision/}).click();
   await page.locator('.reader-toolbar').getByRole('heading',{name:'Albert Einstein'}).waitFor();
   assert.deepEqual(issues,[],mode+' W02 browser JavaScript exceptions');
   console.log('PASS Chromium '+mode+': race→Link Lab→mystery→Galaxy→GeoWiki→Chronicle→Polyglot→Detective→Pulse→Capsule window→Trail Arena share/room/daily→Galaxy statements→missions→Study Desk source journal/review→local backup merge/replace/reload→source history');
   await context.close();
 }
}finally{await browser?.close();server.kill('SIGTERM');}
