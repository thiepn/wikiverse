import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {makeReaderHtml} from './components/reader';
import {STARTERS,MYSTERY_PEOPLE,choose,dateKey,hashSeed,applyRaceClick,acceptedEntityAnswer,mysteryScore,generateVerifiedRace,progressSummary,revisionUrl,mysteryCluePlan,mysteryCandidateOrder} from './domain/game.mjs';
import {loadArticle,loadMystery,searchArticles,apiStats} from './services/wikimedia.mjs';
import {readProgress,saveProgress,recordRace,recordMystery,recordExploration,recordLearning,saveVocabulary,recordEvidenceReview,recordHistoryChallenge,recordArenaAttempt,recordKnowledgeAttempt,recordLinkLab,toggleSaved,initialProgress} from './services/storage.mjs';
import './style.css';
import Portal from './features/portal';
import {navigationSections,sectionForScreen,resumeSource} from './domain/portal.mjs';
import {topicSource,sourceHandoff,exactSource} from './domain/journey.mjs';
import TopicJourney from './features/topic-journey';
import Exploration from './features/exploration';
import Learning from './features/learning';
import HistoryExplorer from './features/history';
import Arena from './features/arena';
import Missions from './features/missions';
import LinkLab from './features/linklab';
import StudyDesk from './features/study';
import BackupCenter from './features/backup';
import {commitInspectedRestore} from './domain/backup.mjs';
import {recordReadingVisit,saveStudyNote,removeStudyNote,saveSourceClip,removeSourceClip,deferReview,journeyStats} from './domain/study.mjs';
import {dailyMissionBoard} from './domain/missions.mjs';
import {captureOfflineReading} from './services/offline.mjs';
import {saveOfflineSnapshot,removeOfflineSnapshot} from './domain/offline.mjs';

type Screen = 'play'|'learn'|'backup'|'study'|'linklab'|'missions'|'home'|'race'|'mystery'|'discover'|'library'|'galaxy'|'geo'|'chronicle'|'polyglot'|'detective'|'pulse'|'capsule'|'arena';
type Page = {identity:{language:string;pageId:number;revisionId:number;title:string};html:string;links:string[];retrievedAt:string};
const TODAY = dateKey();
const pages: {id:Screen;name:string;symbol:string}[] = [
  {id:'home',name:'Explore',symbol:'◫'},
  {id:'play',name:'Play',symbol:'◆'},
  {id:'learn',name:'Learn',symbol:'▣'},
  {id:'missions',name:'Daily Missions',symbol:'◆'},
  {id:'study',name:'Study Desk',symbol:'▣'},
  {id:'backup',name:'Backup & Recovery',symbol:'↧'},
  {id:'linklab',name:'Link Lab',symbol:'⊙'},{id:'race',name:'WikiRace',symbol:'↗'},
  {id:'mystery',name:'WikiMystery',symbol:'?'},{id:'discover',name:'Discover',symbol:'◎'},
  {id:'library',name:'My Universe',symbol:'▤'},
  {id:'galaxy',name:'Knowledge Galaxy',symbol:'✧'},
  {id:'geo',name:'GeoWiki',symbol:'⌖'},
  {id:'chronicle',name:'WikiChronicle',symbol:'◷'},
  {id:'polyglot',name:'WikiPolyglot',symbol:'文'},
  {id:'detective',name:'Source Detective',symbol:'§'},
  {id:'pulse',name:'WikiPulse',symbol:'⌁'},
  {id:'capsule',name:'Time Capsule',symbol:'◴'},
  {id:'arena',name:'Trail Arena',symbol:'◇'}
];
async function playable(title:string, revision?:number):Promise<Page>{
  const page=await loadArticle(title,revision);
  const displayed=makeReaderHtml(page).available;
  return {...page,links:page.links.filter((x:string)=>displayed.has(x))};
}
function Article({page,onTravel,onClip,onOffline}:{page:Page;onTravel:(title:string)=>void;onClip:(article:Page['identity'],excerpt:string)=>void;onOffline:(page:Page,renderedHtml:string)=>void}){
  const [excerpt,setExcerpt]=useState('');
  useEffect(()=>setExcerpt(''),[page.identity.language,page.identity.pageId,page.identity.revisionId]);
  function captureSelection(event:React.MouseEvent<HTMLDivElement>|React.TouchEvent<HTMLDivElement>){
    const selected=window.getSelection(),range=selected?.rangeCount?selected.getRangeAt(0):null;
    if(!selected||!range||!event.currentTarget.contains(range.commonAncestorContainer)){setExcerpt('');return;}
    const text=selected.toString().replace(/\s+/g,' ').trim();
    setExcerpt(text.length>=12&&text.length<=360?text:'');
  }
  const reader=useMemo(()=>makeReaderHtml(page),[page]);
  function handleClick(event:React.MouseEvent<HTMLDivElement>){
    const target=event.target;
    if(!(target instanceof Element))return;
    const a=target.closest<HTMLAnchorElement>('a[data-article-title]');
    if(!a)return;
    event.preventDefault();
    const title=a.dataset.articleTitle;
    if(title && reader.available.has(title))onTravel(title);
  }
  const i=page.identity;
  const history='https://'+i.language+'.wikipedia.org/w/index.php?title='+encodeURIComponent(i.title.replaceAll(' ','_'))+'&action=history';
  return <div className="article">
    <div className="article-header"><span>{i.language.toUpperCase()} WIKIPEDIA</span><span>REVISION {i.revisionId} · {page.links.length} OPEN LINKS</span></div>
    <div className="article-body" onMouseUp={captureSelection} onTouchEnd={captureSelection} onClick={handleClick} dangerouslySetInnerHTML={{__html:reader.html}}/>
    <div className="article-clip-action"><span>Highlight 12–360 characters to save a small private excerpt, or explicitly save a bounded text-only offline reading copy.</span><button disabled={!excerpt} onClick={()=>{onClip(page.identity,excerpt);setExcerpt('');}}>Save selected excerpt →</button><button onClick={()=>onOffline(page,reader.html)}>Save compact offline reading →</button></div>
    <div className="attribution">Adapted from <a href={revisionUrl(i)} target="_blank" rel="noreferrer">Wikipedia revision {i.revisionId}</a> · <a href={history} target="_blank" rel="noreferrer">Authors and history</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></div>
  </div>;
}
function App(){
  const [screen,setScreen]=useState<Screen>('home');
  const [progress,setProgress]=useState<any>(()=>readProgress());
  const currentProgress=useRef(progress);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [race,setRace]=useState<any>(null);
  const [starter,setStarter]=useState(STARTERS[0]);
  const [raceHops,setRaceHops]=useState<1|2|3>(2);
  const [mysteryLevel,setMysteryLevel]=useState<'guided'|'standard'|'expert'>('standard');
  const [linkLabTopic,setLinkLabTopic]=useState('Mathematics');
  const [linkLabReview,setLinkLabReview]=useState<any>(null);
  const [raceHint,setRaceHint]=useState(false);
  const [mystery,setMystery]=useState<any>(null);
  const [guess,setGuess]=useState('');
  const [discover,setDiscover]=useState<Page|null>(null);
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<any[]>([]);
  const [mobileNav,setMobileNav]=useState(false);
  const [studyFocus,setStudyFocus]=useState<Page['identity']|null>(null);
  const [galaxyEntryQid,setGalaxyEntryQid]=useState<string|null>(null);
  const [journeySource,setJourneySource]=useState<Page['identity']|null>(null);
  const [modeFocus,setModeFocus]=useState<{mode:Screen;article:Page['identity']}|null>(null);
  const op=useRef(0);
  const qOp=useRef(0);
  useEffect(()=>{currentProgress.current=progress;try{saveProgress(progress);}catch{setError('Local storage is unavailable or full. Progress may not persist.');}},[progress]);
  const stats=progressSummary(progress);
  const raceDone=progress.races.some((r:any)=>r.dailyKey===TODAY);
  const mysteryDone=progress.mysteries.some((r:any)=>r.dailyKey===TODAY);
  function move(next:Screen){op.current++;setScreen(next);setMobileNav(false);setError('');setBusy('');setModeFocus(null);if(next!=='galaxy')setGalaxyEntryQid(null);if(next==='study')setStudyFocus(null);}
  function openSourceStudy(article:Page['identity']){const canonical=topicSource(article);setJourneySource(canonical);move('study');setStudyFocus(canonical);}
  function openJourney(mode:string){
    if(!journeySource)return;
    try{
      const focus=sourceHandoff(mode,journeySource);
      const dest=focus.mode as Screen;
      if(dest==='study'){openSourceStudy(focus.article);return;}
      if(dest==='discover'){void read(focus.article.title,null,focus.article.language,focus.article.revisionId);return;}
      if(dest==='race'){void startRace(false,focus.article);return;}
      if(dest==='linklab'){setLinkLabTopic(focus.article.title);setLinkLabReview(null);}
      move(dest);setModeFocus({mode:dest,article:focus.article});
    }catch(e:any){setError(e.message||'This source handoff is not available');}
  }
  function saveOffline(page:Page,html:string){
    try{
      const next=saveOfflineSnapshot(currentProgress.current,captureOfflineReading(page,html));
      currentProgress.current=next;setProgress(next);setError('');
      setNotice('Compact offline reading saved locally. Open Study Desk → Offline reading; the copy is not authoritative grading evidence.');
    }catch(e:any){setError(e.message||'Unable to save offline reading');}
  }
  function saved(id:Page['identity']){return Boolean(progress.saved[id.language+':'+id.pageId]);}
  function toggle(id:Page['identity']){setProgress((p:any)=>toggleSaved(p,id));}
  async function startRace(daily:boolean,source?:Page['identity']){
    const number=++op.current;
    setBusy('Building a verified article-link route…');setError('');setRace(null);setRaceHint(false);setScreen('race');
    try {
      const seed=daily?'daily-'+TODAY:'practice-'+Date.now();
      let manifest=daily&&currentProgress.current.daily?.race?.date===TODAY?currentProgress.current.daily.race.manifest:null;
      if(!manifest){
        manifest=await generateVerifiedRace(source?.title||(daily?choose(STARTERS,TODAY):starter),seed,source?(title:string)=>playable(title,title===source.title?source.revisionId:undefined):playable,daily?2:raceHops);
      }
      const page=await playable(manifest.start.title,manifest.start.revisionId);
      if(page.identity.pageId!==manifest.start.pageId)throw new Error('The starting article has changed. Generate a new route.');
      if(source)exactSource(page.identity,source);
      if(number!==op.current)return;
      if(daily)setProgress((p:any)=>({...p,daily:{...p.daily,race:{date:TODAY,manifest}}}));
      setRace({manifest,page,trail:[page.identity],started:Date.now(),finished:false,daily});
    }catch(e:any){if(number===op.current)setError(e.message||'Race preparation failed');}
    finally{if(number===op.current)setBusy('');}
  }
  async function replayRace(){
    if(!race?.manifest)return;
    const number=++op.current;setBusy('Reopening original pinned route…');setError('');
    try{const source=race.manifest.start;const page=await playable(source.title,source.revisionId);exactSource(page.identity,source);
      if(number!==op.current)return;setRace({...race,page,trail:[page.identity],finished:false,started:Date.now()});setRaceHint(false);
    }catch(e:any){if(number===op.current)setError(e.message||'Pinned route unavailable');}
    finally{if(number===op.current)setBusy('');}
  }
  async function travel(title:string){
    if(!race||race.finished||busy)return;
    if(!applyRaceClick({current:race.page.identity,finished:false},race.page,title))return;
    const number=++op.current;setBusy('Following '+title+'…');setError('');
    try{
      const pinned=race.manifest.proof.find((x:any)=>x.title===title)?.revisionId;
      const next=await playable(title,pinned);
      if(number!==op.current)return;
      const finished=next.identity.pageId===race.manifest.target.pageId&&next.identity.language===race.manifest.target.language;
      const trail=[...race.trail,next.identity];
      setRace({...race,page:next,trail,finished});
      if(finished){
        const result={id:race.manifest.id,start:race.manifest.start.title,target:race.manifest.target.title,clicks:trail.length-1,finishedAt:new Date().toISOString(),durationMs:Date.now()-race.started,dailyKey:race.daily?TODAY:null,sourceProof:race.manifest.proof.map((x:any)=>x.revisionId)};
        setProgress((p:any)=>race.daily&&p.races.some((r:any)=>r.dailyKey===TODAY)?p:recordRace(p,result));
      }
    }catch(e:any){if(number===op.current)setError(e.message||'Cannot load the linked article');}
    finally{if(number===op.current)setBusy('');}
  }
  async function startMystery(daily:boolean){
    const number=++op.current;setBusy('Retrieving factual Wikidata clues…');setError('');setScreen('mystery');setMystery(null);setGuess('');
    try{
      const seed=hashSeed(daily?TODAY:String(Date.now()));
      let item:any=null;
      const people=daily?MYSTERY_PEOPLE.map((_,i)=>MYSTERY_PEOPLE[(seed+i)%MYSTERY_PEOPLE.length]):mysteryCandidateOrder(MYSTERY_PEOPLE,String(Date.now()),(currentProgress.current.mysteries||[]).map((x:any)=>x.topic));
      for(const title of people){
        try{item=await loadMystery(title);break;}catch{}
      }
      if(!item)throw new Error('No available person has enough sourced clues.');
      if(number!==op.current)return;
      const plan=mysteryCluePlan(daily?'standard':mysteryLevel,item.clues.length);
      setMystery({item,daily,revealed:plan.initial,maxReveal:plan.maxReveal,level:plan.level,wrong:0,finished:false,solved:false});
    }catch(e:any){if(number===op.current)setError(e.message||'Mystery unavailable');}
    finally{if(number===op.current)setBusy('');}
  }
  function finishMystery(next:any){
    setMystery(next);
    const result={id:next.item.id,topic:next.item.title,score:next.solved?mysteryScore(next.revealed,next.wrong):0,clues:next.revealed,wrong:next.wrong,finishedAt:new Date().toISOString(),dailyKey:next.daily?TODAY:null,source:next.item.sourceUrl};
    setProgress((p:any)=>next.daily&&p.mysteries.some((x:any)=>x.dailyKey===TODAY)?p:recordMystery(p,result));
  }
  function checkGuess(e:React.FormEvent){
    e.preventDefault();
    if(!mystery||mystery.finished||!guess.trim())return;
    const correct=acceptedEntityAnswer(mystery.item.accepted,guess)||guess.trim().toLocaleLowerCase('en')===mystery.item.identity.articleTitle.toLocaleLowerCase('en');
    const next={...mystery,wrong:mystery.wrong+(correct?0:1),finished:correct,solved:correct};
    setGuess('');
    if(correct)finishMystery(next);else setMystery(next);
  }
  function practiceLinks(title:string,review:any=null){setLinkLabTopic(title);setLinkLabReview(review);move('linklab');}
  async function read(title:string,from:Page['identity']|null=null,language='en',revisionId:number|null=null){
    const number=++op.current;setScreen('discover');setBusy('Reading '+title+' ('+language+')…');setError('');
    try{const page=await loadArticle(title,revisionId,language);if(number===op.current){setDiscover(page);setJourneySource(topicSource(page.identity));setProgress((p:any)=>recordReadingVisit(p,{article:page.identity,from}));}}
    catch(e:any){if(number===op.current)setError(e.message||'Article unavailable');}
    finally{if(number===op.current)setBusy('');}
  }
  useEffect(()=>{
    if(screen!=='discover'||query.trim().length<2){setResults([]);return;}
    const number=++qOp.current;
    const timer=window.setTimeout(()=>searchArticles(query).then(items=>{if(number===qOp.current)setResults(items);}).catch(()=>{if(number===qOp.current){setResults([]);setError('Wikipedia search could not reach the source. Try again or use a known topic; an empty result is not being treated as proof that the article does not exist.');}}),350);
    return ()=>window.clearTimeout(timer);
  },[screen,query]);
  return <div className="shell">
    <aside className={'sidebar '+(mobileNav?'show':'')}>
      <button className="brand" onClick={()=>move('home')}><b>W</b><span>WIKIVERSE</span></button>
      
      <nav aria-label="Main navigation">{navigationSections.map(group=><section key={group.id} className="nav-group"><button className={'nav-primary '+(sectionForScreen(screen)===group.id?'active':'')} aria-current={screen===group.id?'page':undefined} onClick={()=>move(group.id as Screen)}><strong>{group.title}</strong></button>{group.children.length>0&&<div className="nav-children">{group.children.map(id=>{const item=pages.find(p=>p.id===id)!;return <button key={id} aria-current={screen===id?'page':undefined} className={screen===id?'active':''} onClick={()=>move(id as Screen)}><span>{item.symbol}</span>{item.name}<span className="nav-tail">›</span></button>;})}</div>}</section>)}</nav>
      <div className="sidebar-bottom"><div className="flex between"><span className="eyebrow">DAILY EXPLORATION</span><strong>{Number(raceDone)+Number(mysteryDone)}/2</strong></div><div className="progress"><i style={{width:String((Number(raceDone)+Number(mysteryDone))*50)+'%'}}/></div><small>{TODAY} · UTC</small><p>Independent THIEPN project. Not affiliated with Wikimedia.</p></div>
    </aside>
    <div className="workspace">
      <header><div className="flex"><button className="menu" aria-label="Toggle navigation" aria-expanded={mobileNav} onClick={()=>setMobileNav(!mobileNav)}>☰</button><strong className="current-screen">{pages.find(p=>p.id===screen)?.name}</strong></div><span className="top-saved">{stats.discoveries} saved</span></header>
      <div className="universe-primary-tabs" role="group" aria-label="WikiVerse sections">{navigationSections.map(group=><button key={group.id} className={sectionForScreen(screen)===group.id?'active':''} aria-pressed={sectionForScreen(screen)===group.id} onClick={()=>move(group.id as Screen)}>{group.title}</button>)}</div>
      <main>
        {error&&<div className="error" role="alert">{error} <button onClick={()=>setError('')}>Dismiss</button></div>}
        {notice&&<p role="status" className="study-confirm">{notice} <button onClick={()=>setNotice('')}>Dismiss</button></p>}
        {busy&&<div className="loading" role="status">{busy}</div>}
        {journeySource&&<TopicJourney source={journeySource} onGo={openJourney} onClear={()=>{setJourneySource(null);setModeFocus(null);}}/>}
        {(screen==='home'||screen==='play'||screen==='learn')&&<Portal section={screen} progress={progress} onNavigate={mode=>move(mode as Screen)} onStudySource={openSourceStudy} onReadSource={article=>read(article.title,null,article.language,article.revisionId)} onReadStarter={title=>read(title)} onDailyRace={()=>startRace(true)} onDailyMystery={()=>startMystery(true)}/>}
        {screen==='race'&&<section>
          <div className="mode-head"><h1>WikiRace</h1></div>
          {!race?<div className="panel"><h2>Generate a race</h2><p>Longer routes may be unavailable. Daily routes use two verified links and remain unranked.</p><label htmlFor="race-hops">VERIFIED PATH LENGTH</label><select id="race-hops" value={raceHops} onChange={e=>setRaceHops(Number(e.target.value) as 1|2|3)}><option value={1}>Quick · 1 proven link</option><option value={2}>Classic · 2 proven links</option><option value={3}>Expedition · 3 proven links</option></select><label htmlFor="start">Starting article</label><select id="start" value={starter} onChange={e=>setStarter(e.target.value)}>{STARTERS.map(x=><option key={x}>{x}</option>)}</select><div className="actions"><button className="primary" disabled={Boolean(busy)} onClick={()=>startRace(false)}>Generate verified route ↗</button><button disabled={Boolean(busy)} onClick={()=>startRace(true)}>Daily race · {TODAY}</button></div></div>:
          <><div className="scoreboard"><div><span>START</span><strong>{race.manifest.start.title}</strong></div><span className="arrow">→</span><div><span>TARGET</span><strong>{race.manifest.target.title}</strong></div><div><span>CLICKS</span><strong>{race.trail.length-1}</strong></div><div><span>VERIFIED HOPS</span><strong>{race.manifest.proof.length-1}</strong></div></div>
            {race.finished?<div className="panel success"><h2>Destination reached</h2><p>{race.trail.map((x:any)=>x.title).join(' → ')}</p><p>{race.trail.length-1} verified moves</p><div className="race-proof-sources"><strong>Original proven route</strong>{race.manifest.proof.map((article:any,i:number)=><a key={article.language+':'+article.pageId} href={revisionUrl(article)} target="_blank" rel="noreferrer">{i+1}. {article.title} · revision {article.revisionId} ↗</a>)}</div><div className="actions"><button className="primary" disabled={Boolean(busy)} onClick={()=>void replayRace()}>Replay same pinned route →</button><button onClick={()=>startRace(false)}>Generate another route →</button></div></div>:
            <div className="reader-wrap"><div className="reader-toolbar"><div><div className="eyebrow">CURRENT ARTICLE</div><h2>{race.page.identity.title}</h2></div><button onClick={()=>setRaceHint(!raceHint)}>{raceHint?'Hide hint':'Show proof hint'}</button></div>{raceHint&&<div className="hint">One proven (not necessarily shortest) route: {race.manifest.proof.map((x:any)=>x.title).join(' → ')}</div>}<button className="text-action" onClick={()=>setJourneySource(topicSource(race.page.identity))}>Connect this pinned race article to other modes →</button><Article page={race.page} onTravel={travel} onClip={(article,excerpt)=>setProgress((p:any)=>saveSourceClip(p,{article,excerpt}))} onOffline={saveOffline}/></div>}
            <div className="trail"><span className="eyebrow">YOUR PATH</span><p>{race.trail.map((x:any)=>x.title).join(' → ')}</p></div><button className="text-action" onClick={()=>{op.current++;setRace(null);setBusy('');}}>← Leave race</button>
          </>}
        </section>}
        {screen==='mystery'&&<section>
          <div className="mode-head"><h1>WikiMystery</h1></div>
          {!mystery?<div className="panel"><h2>Identify the unknown person</h2><p>Guided: 2 initial claims. Standard: 1. Expert: 1, with no further reveals.</p><label htmlFor="mystery-level">PRACTICE CLUE LEVEL</label><select id="mystery-level" value={mysteryLevel} onChange={e=>setMysteryLevel(e.target.value as 'guided'|'standard'|'expert')}><option value="guided">Guided · 2 initial claims</option><option value="standard">Standard · 1 initial claim</option><option value="expert">Expert · 1 claim, no extra reveals</option></select><div className="actions"><button className="primary" disabled={Boolean(busy)} onClick={()=>startMystery(false)}>Start mystery →</button><button disabled={Boolean(busy)} onClick={()=>startMystery(true)}>Daily mystery · {TODAY}</button></div></div>:
          <div className="mystery-grid"><div className="panel"><div className="flex between"><span className="eyebrow">ENTITY {mystery.item.id}</span><span className="eyebrow">CLUE {mystery.revealed} / {mystery.item.clues.length} · {mystery.level?.toUpperCase()||'STANDARD'}</span></div><div className="question">?</div><h2>Who is this person?</h2><div className="clues">{mystery.item.clues.slice(0,mystery.revealed).map((c:any,i:number)=><div key={c.property+'-'+i}><span>{String(i+1).padStart(2,'0')}</span><p>{c.text}</p></div>)}</div>
            {!mystery.finished?<><form onSubmit={checkGuess}><label htmlFor="answer">YOUR ANSWER</label><div className="actions"><input id="answer" value={guess} onChange={e=>setGuess(e.target.value)} placeholder="Enter full name" autoComplete="off"/><button className="primary" type="submit">Submit →</button></div></form>{mystery.wrong>0&&<p>Incorrect guesses: {mystery.wrong}</p>}<div className="actions"><button disabled={mystery.revealed>=mystery.maxReveal} onClick={()=>setMystery({...mystery,revealed:Math.min(mystery.maxReveal,mystery.revealed+1)})}>Reveal next clue</button><button onClick={()=>finishMystery({...mystery,finished:true,solved:false})}>Give up / reveal answer</button></div></>:<div className="result"><div className="eyebrow">{mystery.solved?'CORRECT':'ANSWER REVEALED'}</div><h2>{mystery.item.title}</h2><p>Score: {mystery.solved?mysteryScore(mystery.revealed,mystery.wrong):0} · Stored locally</p><button className="primary" onClick={()=>startMystery(false)}>Another sourced mystery →</button><button onClick={()=>{const title=mystery.item?.identity?.articleTitle;if(title){setQuery(title);void read(title);}}}>Read this person's Wikipedia article →</button></div>}
          </div><aside className="panel side"><div className="eyebrow">POTENTIAL POINTS</div><strong>{mystery.finished&&!mystery.solved?0:mysteryScore(mystery.revealed,mystery.wrong)}</strong><p>Reveals and incorrect guesses reduce the score. Full names and documented aliases are accepted.</p><a target="_blank" rel="noreferrer" href={mystery.item.sourceUrl}>View Wikidata entity and claims ↗</a><a target="_blank" rel="noreferrer" href="https://www.wikidata.org/wiki/Wikidata:Licensing">Wikidata CC0 ↗</a></aside></div>}
          {mystery&&<button className="text-action" onClick={()=>{op.current++;setMystery(null);setBusy('');}}>← Leave mystery</button>}
        </section>}
        {screen==='discover'&&<section>
          <div className="mode-head"><h1>Discover</h1></div>
          <div className="search-box"><label htmlFor="wiki-search">SEARCH WIKIPEDIA</label><input id="wiki-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search articles…" autoComplete="off"/>{results.length>0&&<div className="search-results">{results.map(x=><button key={x.pageId} onClick={()=>{read(x.title);setResults([]);}}>{x.title} <span>READ ↗</span></button>)}</div>}</div>
          {!discover?<><div className="section-head"><h2>Start somewhere</h2></div><div className="topics">{STARTERS.map(x=><button onClick={()=>read(x)} key={x}>{x} ↗</button>)}</div></>:
          <div className="reader-wrap"><div className="reader-toolbar"><div><div className="eyebrow">ARTICLE</div><h2>{discover.identity.title}</h2></div><div className="actions"><button onClick={()=>toggle(discover.identity)}>{saved(discover.identity)?'✓ Saved':'＋ Save'}</button>{discover.identity.language==='en'&&<button onClick={()=>practiceLinks(discover.identity.title)}>Practice source links →</button>}<button onClick={()=>openSourceStudy(discover.identity)}>Study this article →</button></div></div><Article page={discover} onTravel={title=>read(title,discover.identity,discover.identity.language)} onClip={(article,excerpt)=>setProgress((p:any)=>saveSourceClip(p,{article,excerpt}))} onOffline={saveOffline}/><button className="text-action" onClick={()=>setDiscover(null)}>← All topics</button></div>}
        </section>}
        {(screen==='galaxy'||screen==='geo'||screen==='chronicle')&&<Exploration key={screen} mode={screen} focusArticle={modeFocus?.mode===screen?modeFocus.article:null} initialQid={screen==='galaxy'?galaxyEntryQid:null} onExploreQid={qid=>{move('galaxy');setGalaxyEntryQid(qid);}} onRead={read} onReadSource={article=>{void read(article.title,null,article.language,article.revisionId);}} onComplete={result=>setProgress((p:any)=>recordExploration(p,result))} onKnowledge={entry=>setProgress((p:any)=>recordKnowledgeAttempt(p,entry))}/>}
        {(screen==='polyglot'||screen==='detective')&&<Learning key={screen} mode={screen} focusArticle={modeFocus?.mode===screen?modeFocus.article:null} onSelectSource={article=>setJourneySource(topicSource(article))} onReadSource={article=>{void read(article.title,null,article.language,article.revisionId);}} onStudySource={openSourceStudy} onVocabulary={entry=>setProgress((p:any)=>saveVocabulary(p,entry))} onResult={entry=>setProgress((p:any)=>recordLearning(p,entry))} onReflection={entry=>setProgress((p:any)=>recordEvidenceReview(p,entry))} onClip={(entry:any)=>setProgress((p:any)=>saveSourceClip(p,entry))} onOffline={(page:any)=>saveOffline(page,makeReaderHtml(page).html)}/>}
        {(screen==='pulse'||screen==='capsule')&&<HistoryExplorer key={screen} mode={screen} onRead={read} onComplete={result=>setProgress((p:any)=>recordHistoryChallenge(p,result))}/>}
        {screen==='backup'&&<BackupCenter progress={progress} onCommit={(inspection,mode)=>{const restored=commitInspectedRestore(currentProgress.current,inspection,mode,window.localStorage);setProgress(restored);}}/>}
        {screen==='study'&&<StudyDesk progress={progress} focusArticle={studyFocus} onRead={(title,language)=>read(title,null,language||'en')} onPractice={practiceLinks} onSaveNote={entry=>setProgress((p:any)=>saveStudyNote(p,entry))} onRemoveNote={key=>setProgress((p:any)=>removeStudyNote(p,key))} onRemoveClip={id=>setProgress((p:any)=>removeSourceClip(p,id))} onSaveClip={input=>setProgress((p:any)=>saveSourceClip(p,input))} onRemoveOffline={key=>setProgress((p:any)=>removeOfflineSnapshot(p,key))} onSaveArticle={identity=>setProgress((p:any)=>p.saved[identity.language+':'+identity.pageId]?p:toggleSaved(p,identity))} onNavigateMode={mode=>move(mode as Screen)} onChooseSource={article=>setJourneySource(topicSource(article))} onDefer={(key,days)=>setProgress((p:any)=>deferReview(p,key,days))}/>}
        {screen==='linklab'&&<LinkLab initialTopic={linkLabTopic} initialReview={linkLabReview} focusArticle={modeFocus?.mode==='linklab'?modeFocus.article:null} onComplete={entry=>setProgress((p:any)=>recordLinkLab(p,entry))}/>}
        {screen==='missions'&&<Missions progress={progress} onNavigate={mode=>move(mode as Screen)}/>}
        {screen==='arena'&&<Arena onChooseSource={article=>setJourneySource(topicSource(article))} onComplete={attempt=>setProgress((p:any)=>recordArenaAttempt(p,attempt))} attempts={progress.arenaAttempts||[]} dailyManifest={progress.daily?.arena} onDailyManifest={entry=>setProgress((p:any)=>({...p,daily:{...p.daily,arena:entry}}))}/>}
        {screen==='library'&&<section>
          <div className="mode-head"><h1>My Universe</h1></div>
          <div className="stats"><div><span>RACES</span><strong>{stats.races}</strong></div><div><span>MYSTERIES</span><strong>{stats.mysteries}</strong></div><div><span>SAVED ARTICLES</span><strong>{stats.discoveries}</strong></div></div>
          <div className="section-head"><h2>Knowledge investigations</h2></div>
          <div className="history"><p>{(progress.knowledgeAttempts||[]).length} Wikidata answers · {(progress.linkLab||[]).length} link audits <button onClick={()=>move('missions')}>Missions →</button></p></div>
          <div className="section-head"><h2>Reading continuity</h2></div><div className="history"><p>{journeyStats(progress).uniqueRead} articles · {(progress.studyNotes||[]).length} notes · {(progress.sourceClips||[]).length} excerpts · {journeyStats(progress).reviewDue} reviews due <button onClick={()=>move('study')}>Study Desk →</button></p></div>
          <div className="section-head"><h2>Saved discoveries</h2></div><div className="topics">{Object.values(progress.saved).length?(Object.values(progress.saved) as Page['identity'][]).map(x=><div key={x.language+':'+x.pageId} className="saved"><button onClick={()=>read(x.title,null,x.language,x.revisionId)}>{x.title} ↗</button><button aria-label={'Remove '+x.title} onClick={()=>toggle(x)}>Remove</button></div>):<p>No saved articles.</p>}</div>
          <div className="section-head"><h2>Saved vocabulary</h2></div>
          <div className="history">{(progress.vocabulary||[]).length?(progress.vocabulary||[]).map((v:any)=><div key={v.id}><span>{v.language.toUpperCase()}</span><strong>{v.term} — {v.meaning}</strong><a href={revisionUrl(v.article)} target="_blank" rel="noreferrer">Source ↗</a></div>):<p>No saved vocabulary.</p>}</div>
          <div className="section-head"><h2>Personal evidence reviews</h2></div>
          <div className="history">{(progress.evidenceReviews||[]).length?(progress.evidenceReviews||[]).map((x:any)=><div key={x.id}><span>{x.verdict}</span><strong>{x.note}</strong><a href={x.source} target="_blank" rel="noreferrer">Source ↗</a></div>):<p>No evidence reviews.</p>}</div>
          <div className="section-head"><h2>Trail Arena attempts</h2></div>
          <div className="history">{(progress.arenaAttempts||[]).length?(progress.arenaAttempts||[]).slice(0,10).map((x:any)=><div key={x.id}><span>{x.dailyKey||'PRACTICE'}</span><strong>Verified article trail · {x.sourceIds.length} source snapshots</strong><span>{x.mistakes} non-proof attempts</span></div>):<p>No Trail Arena attempts.</p>}</div>
          <div className="section-head"><h2>Attention and revision challenges</h2></div>
          <div className="history">{(progress.historyChallenges||[]).length?(progress.historyChallenges||[]).slice(0,12).map((x:any)=><div key={x.id}><span>{x.mode.toUpperCase()}</span><strong>{x.title}</strong><span>{x.correct?'Correct':'Attempted'} · {x.score} points</span></div>):<p>No history challenges.</p>}</div>
          <div className="section-head"><h2>Recent activity</h2></div><div className="history">{[...progress.races.map((x:any)=>({time:x.finishedAt,label:x.start+' → '+x.target,type:'RACE',value:x.clicks+' clicks'})),...progress.mysteries.map((x:any)=>({time:x.finishedAt,label:x.topic,type:'MYSTERY',value:x.score+' points'})),...(progress.exploration||[]).map((x:any)=>({time:x.at,label:x.title,type:x.mode.toUpperCase(),value:x.score+' points'})),...(progress.learning||[]).map((x:any)=>({time:x.at,label:x.kind,type:x.mode.toUpperCase(),value:(x.correct?'Correct':'Practice')+' · '+x.score+' points'})),...(progress.historyChallenges||[]).map((x:any)=>({time:x.at,label:x.title,type:x.mode.toUpperCase(),value:x.score+' points'})),...(progress.arenaAttempts||[]).map((x:any)=>({time:x.completedAt,label:x.challengeId,type:'TRAIL',value:x.mistakes+' non-proof attempts'})),...(progress.knowledgeAttempts||[]).map((x:any)=>({time:x.at,label:x.id,type:'GALAXY',value:x.correct?'Recorded property':'Practice response'})),...(progress.linkLab||[]).map((x:any)=>({time:x.at,label:x.primary.title,type:'LINK LAB',value:x.correct?'Source match':'Practice response'}))].sort((a,b)=>b.time.localeCompare(a.time)).slice(0,12).map((x,i)=><div key={i}><span>{x.type}</span><strong>{x.label}</strong><span>{x.value}</span></div>)}</div>
          <div className="panel privacy"><h3>Local-first privacy</h3><button onClick={()=>move('backup')}>Export or restore your local progress →</button><p>No account, remote profiling, analytics or public leaderboard. Clearing site data removes progress.</p><button className="danger" onClick={()=>{if(window.confirm('Delete all local WikiVerse progress?'))setProgress(initialProgress());}}>Clear local progress</button></div>
        </section>}
      </main><footer><span><b>WIKIVERSE</b> · Independent THIEPN project</span><div><a href="https://www.wikipedia.org/" target="_blank" rel="noreferrer">Wikipedia ↗</a><a href="https://www.wikidata.org/" target="_blank" rel="noreferrer">Wikidata ↗</a><span>{apiStats().cached} cached queries</span></div></footer>
    </div>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
