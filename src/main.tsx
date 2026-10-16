import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {makeReaderHtml} from './components/reader';
import {STARTERS,MYSTERY_PEOPLE,choose,dateKey,hashSeed,applyRaceClick,acceptedEntityAnswer,mysteryScore,generateVerifiedRace,progressSummary,revisionUrl} from './domain/game.mjs';
import {loadArticle,loadMystery,searchArticles,apiStats} from './services/wikimedia.mjs';
import {readProgress,saveProgress,recordRace,recordMystery,recordExploration,recordLearning,saveVocabulary,recordEvidenceReview,recordHistoryChallenge,recordArenaAttempt,recordKnowledgeAttempt,recordLinkLab,toggleSaved,initialProgress} from './services/storage.mjs';
import './style.css';
import Exploration from './features/exploration';
import Learning from './features/learning';
import HistoryExplorer from './features/history';
import Arena from './features/arena';
import Missions from './features/missions';
import LinkLab from './features/linklab';
import {dailyMissionBoard} from './domain/missions.mjs';

type Screen = 'linklab'|'missions'|'home'|'race'|'mystery'|'discover'|'library'|'galaxy'|'geo'|'chronicle'|'polyglot'|'detective'|'pulse'|'capsule'|'arena';
type Page = {identity:{language:string;pageId:number;revisionId:number;title:string};html:string;links:string[];retrievedAt:string};
const TODAY = dateKey();
const pages: {id:Screen;name:string;symbol:string}[] = [
  {id:'home',name:'Overview',symbol:'◫'},
  {id:'missions',name:'Daily Missions',symbol:'◆'},
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
function Article({page,onTravel}:{page:Page;onTravel:(title:string)=>void}){
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
    <div className="article-header"><span>ENGLISH WIKIPEDIA</span><span>REVISION {i.revisionId} · {page.links.length} OPEN LINKS</span></div>
    <div className="article-body" onClick={handleClick} dangerouslySetInnerHTML={{__html:reader.html}}/>
    <div className="attribution">Adapted from <a href={revisionUrl(i)} target="_blank" rel="noreferrer">Wikipedia revision {i.revisionId}</a> · <a href={history} target="_blank" rel="noreferrer">Authors and history</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></div>
  </div>;
}
function App(){
  const [screen,setScreen]=useState<Screen>('home');
  const [progress,setProgress]=useState<any>(()=>readProgress());
  const currentProgress=useRef(progress);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [race,setRace]=useState<any>(null);
  const [starter,setStarter]=useState(STARTERS[0]);
  const [raceHint,setRaceHint]=useState(false);
  const [mystery,setMystery]=useState<any>(null);
  const [guess,setGuess]=useState('');
  const [discover,setDiscover]=useState<Page|null>(null);
  const [query,setQuery]=useState('');
  const [results,setResults]=useState<any[]>([]);
  const [mobileNav,setMobileNav]=useState(false);
  const op=useRef(0);
  const qOp=useRef(0);
  useEffect(()=>{currentProgress.current=progress;try{saveProgress(progress);}catch{setError('Local storage is unavailable or full. Progress may not persist.');}},[progress]);
  const stats=progressSummary(progress);
  const raceDone=progress.races.some((r:any)=>r.dailyKey===TODAY);
  const mysteryDone=progress.mysteries.some((r:any)=>r.dailyKey===TODAY);
  function move(next:Screen){op.current++;setScreen(next);setMobileNav(false);setError('');setBusy('');}
  function saved(id:Page['identity']){return Boolean(progress.saved[id.language+':'+id.pageId]);}
  function toggle(id:Page['identity']){setProgress((p:any)=>toggleSaved(p,id));}
  async function startRace(daily:boolean){
    const number=++op.current;
    setBusy('Building a verified article-link route…');setError('');setRace(null);setRaceHint(false);setScreen('race');
    try {
      const seed=daily?'daily-'+TODAY:'practice-'+Date.now();
      let manifest=daily&&currentProgress.current.daily?.race?.date===TODAY?currentProgress.current.daily.race.manifest:null;
      if(!manifest){
        manifest=await generateVerifiedRace(daily?choose(STARTERS,TODAY):starter,seed,playable,2);
      }
      const page=await playable(manifest.start.title,manifest.start.revisionId);
      if(page.identity.pageId!==manifest.start.pageId)throw new Error('The starting article has changed. Generate a new route.');
      if(number!==op.current)return;
      if(daily)setProgress((p:any)=>({...p,daily:{...p.daily,race:{date:TODAY,manifest}}}));
      setRace({manifest,page,trail:[page.identity],started:Date.now(),finished:false,daily});
    }catch(e:any){if(number===op.current)setError(e.message||'Race preparation failed');}
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
      for(let j=0;j<MYSTERY_PEOPLE.length;j++){
        try{item=await loadMystery(MYSTERY_PEOPLE[(seed+j)%MYSTERY_PEOPLE.length]);break;}catch{}
      }
      if(!item)throw new Error('No available person has enough sourced clues.');
      if(number!==op.current)return;
      setMystery({item,daily,revealed:1,wrong:0,finished:false,solved:false});
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
  async function read(title:string){
    const number=++op.current;setScreen('discover');setBusy('Reading '+title+'…');setError('');
    try{const page=await loadArticle(title);if(number===op.current)setDiscover(page);}
    catch(e:any){if(number===op.current)setError(e.message||'Article unavailable');}
    finally{if(number===op.current)setBusy('');}
  }
  useEffect(()=>{
    if(screen!=='discover'||query.trim().length<2){setResults([]);return;}
    const number=++qOp.current;
    const timer=window.setTimeout(()=>searchArticles(query).then(items=>{if(number===qOp.current)setResults(items);}).catch(()=>{if(number===qOp.current)setResults([]);}),350);
    return ()=>window.clearTimeout(timer);
  },[screen,query]);
  return <div className="shell">
    <aside className={'sidebar '+(mobileNav?'show':'')}>
      <button className="brand" onClick={()=>move('home')}><b>W</b><span>WIKIVERSE<small>KNOWLEDGE / REIMAGINED</small></span></button>
      <span className="eyebrow">EXPLORE THE UNIVERSE</span>
      <nav aria-label="Main navigation">{pages.map(p=><button key={p.id} aria-current={screen===p.id?'page':undefined} className={screen===p.id?'active':''} onClick={()=>move(p.id)}><span>{p.symbol}</span>{p.name}<span className="nav-tail">›</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="flex between"><span className="eyebrow">DAILY EXPLORATION</span><strong>{Number(raceDone)+Number(mysteryDone)}/2</strong></div><div className="progress"><i style={{width:String((Number(raceDone)+Number(mysteryDone))*50)+'%'}}/></div><small>{TODAY} · UTC</small><p>Independent THIEPN project. Not affiliated with Wikimedia.</p></div>
    </aside>
    <div className="workspace">
      <header><div className="flex"><button className="menu" aria-label="Toggle navigation" aria-expanded={mobileNav} onClick={()=>setMobileNav(!mobileNav)}>☰</button><span className="eyebrow">WIKIVERSE / {pages.find(p=>p.id===screen)?.name.toUpperCase()}</span></div><div className="eyebrow">● WIKIMEDIA DATA <span className="top-saved">· {stats.discoveries} SAVED</span></div></header>
      <main>
        {error&&<div className="error" role="alert">{error} <button onClick={()=>setError('')}>Dismiss</button></div>}
        {busy&&<div className="loading" role="status">{busy}</div>}
        {screen==='home'&&<>
          <section className="hero"><div className="eyebrow">01 / THE KNOWLEDGE UNIVERSE</div><h1>Everything is<br/><em>connected.</em></h1><p>Navigate real Wikipedia articles, solve Wikidata mysteries and build your personal map of discoveries.</p><div className="actions"><button className="primary" disabled={Boolean(busy)} onClick={()=>startRace(true)}>Start today's race ↗</button><button disabled={Boolean(busy)} onClick={()=>startMystery(true)}>Today's mystery →</button></div></section>
          <div className="section-head"><h2>Daily knowledge route</h2><span className="eyebrow">{dailyMissionBoard(progress).date} UTC</span></div>
          <div className="panel"><h3>{dailyMissionBoard(progress).completed} / {dailyMissionBoard(progress).total} source missions completed today</h3><p>Daily missions are derived from your existing WikiVerse activities, with private progress and participation-only milestones.</p><button onClick={()=>move('missions')}>Open daily mission board →</button></div>
          <div className="section-head"><h2>Source recognition training</h2><span className="eyebrow">NEW GAME / ORIGINAL REVISIONS</span></div>
          <div className="cards"><button onClick={()=>move('linklab')}><span className="glyph">⊙</span><span className="eyebrow">SOURCE LINK AUDIT</span><h3>Link Lab</h3><p>Identify an actual outgoing link from a pinned Wikipedia revision, using contrasting source links rather than fabricated decoys.</p><b>PLAY SOURCE AUDIT →</b></button></div>
          <div className="section-head"><h2>Choose an experience</h2><span className="eyebrow">THREE WAYS TO BEGIN</span></div><div className="cards">
            <button onClick={()=>move('race')}><span className="glyph">↗</span><span className="eyebrow">MODE 01</span><h3>WikiRace</h3><p>Travel from article to article using genuine source hyperlinks.</p><b>ENTER RACE →</b></button>
            <button onClick={()=>move('mystery')}><span className="glyph">?</span><span className="eyebrow">MODE 02</span><h3>WikiMystery</h3><p>Deduce a person from clues backed by Wikidata properties.</p><b>SOLVE MYSTERY →</b></button>
            <button onClick={()=>move('discover')}><span className="glyph">◎</span><span className="eyebrow">OPEN KNOWLEDGE</span><h3>Discover</h3><p>Search, read and save millions of connected topics.</p><b>START EXPLORING →</b></button>
          </div><div className="section-head"><h2>Discover more dimensions</h2><span className="eyebrow">EXPLORE / LEARN</span></div><div className="cards">
            <button onClick={()=>move('galaxy')}><span className="glyph">✧</span><span className="eyebrow">KNOWLEDGE NETWORK</span><h3>Knowledge Galaxy</h3><p>Expand real Wikidata relationships between topics.</p><b>EXPLORE CONNECTIONS →</b></button>
            <button onClick={()=>move('geo')}><span className="glyph">⌖</span><span className="eyebrow">COORDINATES & DISCOVERY</span><h3>GeoWiki</h3><p>Explore source coordinates and locate cities by their pins.</p><b>OPEN THE ATLAS →</b></button>
            <button onClick={()=>move('chronicle')}><span className="glyph">◷</span><span className="eyebrow">HISTORY & EVIDENCE</span><h3>WikiChronicle</h3><p>Investigate dated events and order source-backed timelines.</p><b>EXPLORE HISTORY →</b></button>
          </div><div className="section-head"><h2>Daily challenge lab</h2><span className="eyebrow">SHARE / REPLAY / LEARN</span></div>
          <div className="cards"><button onClick={()=>move('arena')}><span className="glyph">◇</span><span className="eyebrow">PINNED ARTICLES</span><h3>Trail Arena</h3><p>Build a proven source route, practice outgoing links and share an unranked verified code with friends.</p><b>OPEN CHALLENGE LAB →</b></button></div>
          <div className="section-head"><h2>Analyze attention and change</h2><span className="eyebrow">WIKIMEDIA DATA / HISTORY</span></div><div className="cards">
            <button onClick={()=>move('pulse')}><span className="glyph">⌁</span><span className="eyebrow">PAGEVIEW INTELLIGENCE</span><h3>WikiPulse</h3><p>Compare real daily article views and solve a numerical challenge.</p><b>EXPLORE DAILY VIEWS →</b></button>
            <button onClick={()=>move('capsule')}><span className="glyph">◴</span><span className="eyebrow">REVISION TIME MACHINE</span><h3>Time Capsule</h3><p>Compare pinned historical article revisions and find actual textual changes.</p><b>EXPLORE ARTICLE HISTORY →</b></button>
          </div>
          <div className="section-head"><h2>Read and investigate</h2><span className="eyebrow">LANGUAGES / EVIDENCE</span></div><div className="cards">
            <button onClick={()=>move('polyglot')}><span className="glyph">文</span><span className="eyebrow">MULTILINGUAL READING</span><h3>WikiPolyglot</h3><p>Compare verified language editions, collect phrases and solve source-text exercises.</p><b>READ ACROSS LANGUAGES →</b></button>
            <button onClick={()=>move('detective')}><span className="glyph">§</span><span className="eyebrow">SOURCE LITERACY</span><h3>Source Detective</h3><p>Trace citation provenance, verify bibliography links and write personal evidence reviews.</p><b>INVESTIGATE REFERENCES →</b></button>
          </div><div className="stats"><div><span>COMPLETED RACES</span><strong>{stats.races}</strong></div><div><span>MYSTERIES ATTEMPTED</span><strong>{stats.mysteries}</strong></div><div><span>SAVED TOPICS</span><strong>{stats.discoveries}</strong></div></div>
        </>}
        {screen==='race'&&<section>
          <div className="mode-head"><div className="eyebrow">01 / REAL ARTICLE NAVIGATION</div><h1>WikiRace<span className="accent">.</span></h1><p>Reach the destination using only actual links in the displayed article.</p></div>
          {!race?<div className="panel"><h2>Generate a race</h2><p>The game checks a complete two-hop path before the challenge begins. Challenges are unranked.</p><label htmlFor="start">Starting article</label><select id="start" value={starter} onChange={e=>setStarter(e.target.value)}>{STARTERS.map(x=><option key={x}>{x}</option>)}</select><div className="actions"><button className="primary" disabled={Boolean(busy)} onClick={()=>startRace(false)}>Generate verified route ↗</button><button disabled={Boolean(busy)} onClick={()=>startRace(true)}>Daily race · {TODAY}</button></div></div>:
          <><div className="scoreboard"><div><span>START</span><strong>{race.manifest.start.title}</strong></div><span className="arrow">→</span><div><span>TARGET</span><strong>{race.manifest.target.title}</strong></div><div><span>CLICKS</span><strong>{race.trail.length-1}</strong></div></div>
            {race.finished?<div className="panel success"><div className="eyebrow">DESTINATION REACHED</div><h2>You found the path.</h2><p>{race.trail.map((x:any)=>x.title).join(' → ')}</p><p>{race.trail.length-1} verified moves, saved locally.</p><button className="primary" onClick={()=>startRace(false)}>Race again →</button></div>:
            <div className="reader-wrap"><div className="reader-toolbar"><div><div className="eyebrow">CURRENT ARTICLE</div><h2>{race.page.identity.title}</h2></div><button onClick={()=>setRaceHint(!raceHint)}>{raceHint?'Hide hint':'Show proof hint'}</button></div>{raceHint&&<div className="hint">One proven (not necessarily shortest) route: {race.manifest.proof.map((x:any)=>x.title).join(' → ')}</div>}<p className="eyebrow">CLICK INLINE SOURCE LINKS TO TRAVEL</p><Article page={race.page} onTravel={travel}/></div>}
            <div className="trail"><span className="eyebrow">YOUR PATH</span><p>{race.trail.map((x:any)=>x.title).join(' → ')}</p></div><button className="text-action" onClick={()=>{op.current++;setRace(null);setBusy('');}}>← Leave race</button>
          </>}
        </section>}
        {screen==='mystery'&&<section>
          <div className="mode-head"><div className="eyebrow">02 / EVIDENCE GAME</div><h1>WikiMystery<span className="accent">.</span></h1><p>Find a person from clues generated from concrete Wikidata claims.</p></div>
          {!mystery?<div className="panel"><h2>Identify the unknown person</h2><p>Each eligible puzzle requires at least three separate sourced Wikidata properties.</p><div className="actions"><button className="primary" disabled={Boolean(busy)} onClick={()=>startMystery(false)}>Start mystery →</button><button disabled={Boolean(busy)} onClick={()=>startMystery(true)}>Daily mystery · {TODAY}</button></div></div>:
          <div className="mystery-grid"><div className="panel"><div className="flex between"><span className="eyebrow">ENTITY {mystery.item.id}</span><span className="eyebrow">CLUE {mystery.revealed} / {mystery.item.clues.length}</span></div><div className="question">?</div><h2>Who is this person?</h2><div className="clues">{mystery.item.clues.slice(0,mystery.revealed).map((c:any,i:number)=><div key={c.property+'-'+i}><span>{String(i+1).padStart(2,'0')}</span><p>{c.text}</p></div>)}</div>
            {!mystery.finished?<><form onSubmit={checkGuess}><label htmlFor="answer">YOUR ANSWER</label><div className="actions"><input id="answer" value={guess} onChange={e=>setGuess(e.target.value)} placeholder="Enter full name" autoComplete="off"/><button className="primary" type="submit">Submit →</button></div></form>{mystery.wrong>0&&<p>Incorrect guesses: {mystery.wrong}</p>}<div className="actions"><button disabled={mystery.revealed===mystery.item.clues.length} onClick={()=>setMystery({...mystery,revealed:mystery.revealed+1})}>Reveal next clue</button><button onClick={()=>finishMystery({...mystery,finished:true,solved:false})}>Give up / reveal answer</button></div></>:<div className="result"><div className="eyebrow">{mystery.solved?'CORRECT':'ANSWER REVEALED'}</div><h2>{mystery.item.title}</h2><p>Score: {mystery.solved?mysteryScore(mystery.revealed,mystery.wrong):0} · Stored locally</p><button className="primary" onClick={()=>startMystery(false)}>Another mystery →</button></div>}
          </div><aside className="panel side"><div className="eyebrow">POTENTIAL POINTS</div><strong>{mystery.finished&&!mystery.solved?0:mysteryScore(mystery.revealed,mystery.wrong)}</strong><p>Reveals and incorrect guesses reduce the score. Full names and documented aliases are accepted.</p><a target="_blank" rel="noreferrer" href={mystery.item.sourceUrl}>View Wikidata entity and claims ↗</a><a target="_blank" rel="noreferrer" href="https://www.wikidata.org/wiki/Wikidata:Licensing">Wikidata CC0 ↗</a></aside></div>}
          {mystery&&<button className="text-action" onClick={()=>{op.current++;setMystery(null);setBusy('');}}>← Leave mystery</button>}
        </section>}
        {screen==='discover'&&<section>
          <div className="mode-head"><div className="eyebrow">03 / OPEN KNOWLEDGE</div><h1>Discover<span className="accent">.</span></h1><p>Read original article content, follow links and save meaningful discoveries.</p></div>
          <div className="search-box"><label htmlFor="wiki-search">SEARCH WIKIPEDIA</label><input id="wiki-search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search articles…" autoComplete="off"/>{results.length>0&&<div className="search-results">{results.map(x=><button key={x.pageId} onClick={()=>{read(x.title);setResults([]);}}>{x.title} <span>READ ↗</span></button>)}</div>}</div>
          {!discover?<><div className="section-head"><h2>Start somewhere</h2></div><div className="topics">{STARTERS.map(x=><button onClick={()=>read(x)} key={x}>{x} ↗</button>)}</div></>:
          <div className="reader-wrap"><div className="reader-toolbar"><div><div className="eyebrow">ARTICLE</div><h2>{discover.identity.title}</h2></div><button onClick={()=>toggle(discover.identity)}>{saved(discover.identity)?'✓ Saved':'＋ Save'}</button></div><Article page={discover} onTravel={read}/><button className="text-action" onClick={()=>setDiscover(null)}>← All topics</button></div>}
        </section>}
        {(screen==='galaxy'||screen==='geo'||screen==='chronicle')&&<Exploration key={screen} mode={screen} onRead={read} onComplete={result=>setProgress((p:any)=>recordExploration(p,result))} onKnowledge={entry=>setProgress((p:any)=>recordKnowledgeAttempt(p,entry))}/>}
        {(screen==='polyglot'||screen==='detective')&&<Learning key={screen} mode={screen} onVocabulary={entry=>setProgress((p:any)=>saveVocabulary(p,entry))} onResult={entry=>setProgress((p:any)=>recordLearning(p,entry))} onReflection={entry=>setProgress((p:any)=>recordEvidenceReview(p,entry))}/>}
        {(screen==='pulse'||screen==='capsule')&&<HistoryExplorer key={screen} mode={screen} onRead={read} onComplete={result=>setProgress((p:any)=>recordHistoryChallenge(p,result))}/>}
        {screen==='linklab'&&<LinkLab onComplete={entry=>setProgress((p:any)=>recordLinkLab(p,entry))}/>}
        {screen==='missions'&&<Missions progress={progress} onNavigate={mode=>move(mode as Screen)}/>}
        {screen==='arena'&&<Arena onComplete={attempt=>setProgress((p:any)=>recordArenaAttempt(p,attempt))} attempts={progress.arenaAttempts||[]} dailyManifest={progress.daily?.arena} onDailyManifest={entry=>setProgress((p:any)=>({...p,daily:{...p.daily,arena:entry}}))}/>}
        {screen==='library'&&<section>
          <div className="mode-head"><div className="eyebrow">04 / LOCAL PROGRESS</div><h1>My Universe<span className="accent">.</span></h1><p>Your reading collection and gameplay history stay on this device.</p></div>
          <div className="stats"><div><span>RACES</span><strong>{stats.races}</strong></div><div><span>MYSTERIES</span><strong>{stats.mysteries}</strong></div><div><span>SAVED ARTICLES</span><strong>{stats.discoveries}</strong></div></div>
          <div className="section-head"><h2>Knowledge investigations and milestones</h2></div>
          <div className="history"><p>{(progress.knowledgeAttempts||[]).length} sourced Wikidata relationship answers and {(progress.linkLab||[]).length} original-source link audits recorded on this device. <button onClick={()=>move('missions')}>View missions & achievements →</button></p></div>
          <div className="section-head"><h2>Saved discoveries</h2></div><div className="topics">{Object.values(progress.saved).length?(Object.values(progress.saved) as Page['identity'][]).map(x=><div key={x.language+':'+x.pageId} className="saved"><button onClick={()=>read(x.title)}>{x.title} ↗</button><button aria-label={'Remove '+x.title} onClick={()=>toggle(x)}>Remove</button></div>):<p>Nothing saved yet. Explore Wikipedia to build your collection.</p>}</div>
          <div className="section-head"><h2>Saved vocabulary</h2></div>
          <div className="history">{(progress.vocabulary||[]).length?(progress.vocabulary||[]).map((v:any)=><div key={v.id}><span>{v.language.toUpperCase()}</span><strong>{v.term} — {v.meaning}</strong><a href={revisionUrl(v.article)} target="_blank" rel="noreferrer">Source ↗</a></div>):<p>No words saved. Select text in WikiPolyglot to build your collection.</p>}</div>
          <div className="section-head"><h2>Personal evidence reviews</h2></div>
          <div className="history">{(progress.evidenceReviews||[]).length?(progress.evidenceReviews||[]).map((x:any)=><div key={x.id}><span>{x.verdict}</span><strong>{x.note}</strong><a href={x.source} target="_blank" rel="noreferrer">Source ↗</a></div>):<p>No evidence reflections yet. Source Detective reviews are private and ungraded.</p>}</div>
          <div className="section-head"><h2>Trail Arena attempts</h2></div>
          <div className="history">{(progress.arenaAttempts||[]).length?(progress.arenaAttempts||[]).slice(0,10).map((x:any)=><div key={x.id}><span>{x.dailyKey||'PRACTICE'}</span><strong>Verified article trail · {x.sourceIds.length} source snapshots</strong><span>{x.mistakes} non-proof attempts</span></div>):<p>No shared or daily trail challenges completed.</p>}</div>
          <div className="section-head"><h2>Attention and revision challenges</h2></div>
          <div className="history">{(progress.historyChallenges||[]).length?(progress.historyChallenges||[]).slice(0,12).map((x:any)=><div key={x.id}><span>{x.mode.toUpperCase()}</span><strong>{x.title}</strong><span>{x.correct?'Correct':'Attempted'} · {x.score} points</span></div>):<p>No pageview or revision challenges completed yet.</p>}</div>
          <div className="section-head"><h2>Recent activity</h2></div><div className="history">{[...progress.races.map((x:any)=>({time:x.finishedAt,label:x.start+' → '+x.target,type:'RACE',value:x.clicks+' clicks'})),...progress.mysteries.map((x:any)=>({time:x.finishedAt,label:x.topic,type:'MYSTERY',value:x.score+' points'})),...(progress.exploration||[]).map((x:any)=>({time:x.at,label:x.title,type:x.mode.toUpperCase(),value:x.score+' points'})),...(progress.learning||[]).map((x:any)=>({time:x.at,label:x.kind,type:x.mode.toUpperCase(),value:(x.correct?'Correct':'Practice')+' · '+x.score+' points'})),...(progress.historyChallenges||[]).map((x:any)=>({time:x.at,label:x.title,type:x.mode.toUpperCase(),value:x.score+' points'})),...(progress.arenaAttempts||[]).map((x:any)=>({time:x.completedAt,label:x.challengeId,type:'TRAIL',value:x.mistakes+' non-proof attempts'})),...(progress.knowledgeAttempts||[]).map((x:any)=>({time:x.at,label:x.id,type:'GALAXY',value:x.correct?'Recorded property':'Practice response'})),...(progress.linkLab||[]).map((x:any)=>({time:x.at,label:x.primary.title,type:'LINK LAB',value:x.correct?'Source match':'Practice response'}))].sort((a,b)=>b.time.localeCompare(a.time)).slice(0,12).map((x,i)=><div key={i}><span>{x.type}</span><strong>{x.label}</strong><span>{x.value}</span></div>)}</div>
          <div className="panel privacy"><h3>Local-first privacy</h3><p>No account, remote profiling, analytics or public leaderboard. Clearing site data removes progress.</p><button className="danger" onClick={()=>{if(window.confirm('Delete all local WikiVerse progress?'))setProgress(initialProgress());}}>Clear local progress</button></div>
        </section>}
      </main><footer><span><b>WIKIVERSE</b> · Independent THIEPN project</span><div><a href="https://www.wikipedia.org/" target="_blank" rel="noreferrer">Wikipedia ↗</a><a href="https://www.wikidata.org/" target="_blank" rel="noreferrer">Wikidata ↗</a><span>{apiStats().cached} cached queries</span></div></footer>
    </div>
  </div>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
