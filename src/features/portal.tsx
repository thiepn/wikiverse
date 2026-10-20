import React from 'react';
import {dailyMissionBoard} from '../domain/missions.mjs';
import {journeyStats} from '../domain/study.mjs';
import {resumeSource} from '../domain/portal.mjs';
import './portal.css';

type Article={language:string;pageId:number;revisionId:number;title:string};
type Props={
 section:'home'|'play'|'learn';progress:any;
 onNavigate:(screen:string)=>void;onStudySource:(article:Article)=>void;onReadSource:(article:Article)=>void;
 onReadStarter:(title:string)=>void;onDailyRace:()=>void;onDailyMystery:()=>void;
};
const explore=[
 {id:'galaxy',tag:'01 / RELATIONSHIPS',name:'Knowledge Galaxy',detail:'Follow canonical Wikidata QIDs and sourced property connections.'},
 {id:'geo',tag:'02 / PLACES',name:'GeoWiki',detail:'Trace source coordinates and explore places.'},
 {id:'chronicle',tag:'03 / TIME',name:'WikiChronicle',detail:'Investigate dated historical statements.'},
 {id:'pulse',tag:'04 / ATTENTION',name:'WikiPulse',detail:'Compare observed Wikimedia daily pageviews.'},
 {id:'capsule',tag:'05 / REVISIONS',name:'Time Capsule',detail:'Compare original Wikipedia article revisions.'}
];
const play=[
 {id:'race',tag:'ARTICLE LINKS',name:'WikiRace',detail:'Reach a destination through proven article links.'},
 {id:'mystery',tag:'ENTITY CLUES',name:'WikiMystery',detail:'Identify people using original Wikidata claims.'},
 {id:'linklab',tag:'LINK RECOGNITION',name:'Link Lab',detail:'Check real links from pinned article revisions.'},
 {id:'arena',tag:'SHAREABLE / UNRANKED',name:'Trail Arena',detail:'Build, share and solve locally verified source trails.'},
 {id:'missions',tag:'DAILY ROUTINE',name:'Daily Missions',detail:'Track your own source activities without mastery claims.'}
];
const learn=[
 {id:'polyglot',tag:'LANGUAGE EDITIONS',name:'WikiPolyglot',detail:'Read separately authored editions and practice literal text.'},
 {id:'detective',tag:'EVIDENCE LITERACY',name:'Source Detective',detail:'Inspect original citations and write ungraded evidence notes.'},
 {id:'study',tag:'YOUR RESEARCH',name:'Study Desk',detail:'Continue original-source notes, review pointers and offline reading.'}
];
export default function Portal({section,progress,onNavigate,onStudySource,onReadSource,onReadStarter,onDailyRace,onDailyMystery}:Props){
 const resume=resumeSource(progress),journey=journeyStats(progress),today=dailyMissionBoard(progress);
 const choices=section==='home'?explore:section==='play'?play:learn;
 return <section className="universe-portal" aria-label={section==='home'?'Explore WikiVerse':section==='play'?'Play WikiVerse':'Learn WikiVerse'}>
  <header className="universe-hero">
   <h1>{section==='home'?'Explore':section==='play'?'Play':'Learn'}</h1>
   <div className="universe-hero-actions">
    {section==='home'?<><button className="primary" onClick={()=>resume?onReadSource(resume):onReadStarter('Mathematics')}>{resume?'Continue '+resume.title+' →':'Read an original article →'}</button><button onClick={()=>onNavigate('play')}>Choose a game →</button></>:
    section==='play'?<><button className="primary" onClick={onDailyRace}>Start today’s WikiRace →</button><button onClick={onDailyMystery}>Today’s WikiMystery →</button></>:
    <><button className="primary" onClick={()=>onNavigate('study')}>Open Study Desk →</button>{resume&&<button onClick={()=>onReadSource(resume)}>Revisit {resume.title} →</button>}</>}
   </div>
  </header>
  <div className="universe-facts" aria-label="Your actual local activity">
   <div><span>ORIGINAL TOPICS READ</span><strong>{journey.uniqueRead}</strong></div>
   <div><span>REVIEWS DUE</span><strong>{journey.reviewDue}</strong></div>
   <div><span>DAILY SOURCE ACTIVITIES</span><strong>{today.completed} / {today.total}</strong></div>
  </div>
  {resume&&<section className="universe-resume" aria-label="Resume original source">
    <div><h2>{resume.title}</h2><p>{resume.language.toUpperCase()} Wikipedia · page {resume.pageId} · revision {resume.revisionId}.</p></div>
    <div className="universe-resume-actions"><button onClick={()=>onReadSource(resume)}>Read pinned revision →</button><button onClick={()=>onStudySource(resume)}>Study notes & reviews →</button></div>
   </section>}
  <div className="universe-section-heading"><h2>{section==='home'?'Exploration modes':section==='play'?'Games':'Learning tools'}</h2></div>
  <div className="universe-mode-grid">{choices.map(mode=><button key={mode.id} onClick={()=>onNavigate(mode.id)} className="universe-mode"><strong>{mode.name}</strong><span className="universe-mode-desc">{mode.detail}</span></button>)}</div>
 </section>;
}
