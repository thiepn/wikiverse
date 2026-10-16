import React,{useEffect,useMemo,useRef,useState} from 'react';
import {loadPageviews,loadRevisionList,compareRevisions} from '../services/history.mjs';
import {pulseSummary,pulseLeaders,pulseQuiz,gradePulse,changeChallenge,gradeChange} from '../domain/history.mjs';
import './history.css';
type Mode='pulse'|'capsule';
type Point={date:string;views:number};
type Series={title:string;language:string;points:Point[];start:string;end:string;source:string;total:number;observedDays:number};
type Revision={revisionId:number;timestamp:string;size:number|null;comment:string;sourceUrl:string};
type History={identity:{language:string;pageId:number;title:string};revisions:Revision[];historyUrl:string};
type Comparison={from:{revisionId:number};to:{revisionId:number};earlier:Revision;later:Revision;added:string[];removed:string[];addedCount:number;removedCount:number;method:string;truncated:boolean};
type Result={mode:Mode;kind:string;title:string;correct:boolean;score:number;at:string;source:string;sourceIds:string[]};
const initialTitles=['Marie Curie','Albert Einstein'];
const integer=new Intl.NumberFormat('en');
function PulseChart({series}:{series:Series[]}){
 const dates=[...new Set(series.flatMap(s=>s.points.map(p=>p.date)))].sort();
 const maximum=Math.max(1,...series.flatMap(s=>s.points.map(p=>p.views)));
 const paths=series.map((s,i)=>({title:s.title,color:['#8bdcd7','#e7be85','#aeb7f0'][i%3],points:s.points.map(p=>{const ix=dates.indexOf(p.date);return {x:40+ix/Math.max(1,dates.length-1)*780,y:260-p.views/maximum*220,date:p.date,views:p.views};})}));
 return <div className="history-plot"><svg viewBox="0 0 860 310" role="img" aria-label={'Daily Wikipedia pageview series for '+series.map(x=>x.title).join(', ')}>
  <g stroke="#395362" strokeWidth="1">{[0,1,2,3,4].map(i=><line key={i} x1="40" y1={40+i*55} x2="820" y2={40+i*55}/>)}</g>
  <g fill="#a9bdc8" fontSize="12"><text x="3" y="45">{integer.format(maximum)}</text><text x="12" y="263">0</text><text x="40" y="292">{dates[0]}</text><text x="690" y="292">{dates.at(-1)}</text></g>
  {paths.map(p=><polyline key={p.title} points={p.points.map(pt=>pt.x+','+pt.y).join(' ')} fill="none" stroke={p.color} strokeWidth="2.8" strokeLinejoin="round"><title>{p.title}</title></polyline>)}
 </svg><div className="history-legend">{paths.map(p=><span key={p.title}><i style={{background:p.color}}/>{p.title}</span>)}</div></div>;
}
export default function HistoryExplorer({mode,onRead,onComplete}:{mode:Mode;onRead:(title:string)=>void;onComplete:(r:Result)=>void}){
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 const [language,setLanguage]=useState('en'),[days,setDays]=useState(30),[titles,setTitles]=useState<string[]>(initialTitles),[newTitle,setNewTitle]=useState('');
 const [series,setSeries]=useState<Series[]>([]),[pulseAnswer,setPulseAnswer]=useState<string|null>(null),[pulseRound,setPulseRound]=useState(0),[tableOpen,setTableOpen]=useState(false);
 const [topic,setTopic]=useState('Marie Curie'),[history,setHistory]=useState<History|null>(null),[older,setOlder]=useState<number|null>(null),[newer,setNewer]=useState<number|null>(null),[diff,setDiff]=useState<Comparison|null>(null),[revisionAnswer,setRevisionAnswer]=useState<string|null>(null),[revisionRound,setRevisionRound]=useState(0);
 const operation=useRef(0);
 const quiz=useMemo(()=>pulseQuiz(series,pulseRound),[series,pulseRound]);
 const change=useMemo(()=>diff?changeChallenge(diff,String(revisionRound)):null,[diff,revisionRound]);
 async function loadPulse(updatedTitles=titles,nextDays=days,nextLanguage=language){
  const stamp=++operation.current;setBusy('Retrieving actual Wikimedia pageviews…');setError('');setPulseAnswer(null);
  try{
   const loaded=await Promise.allSettled(updatedTitles.map(title=>loadPageviews(title,{language:nextLanguage,days:nextDays})));
   if(operation.current!==stamp)return;
   const good=loaded.filter((r):r is PromiseFulfilledResult<Series>=>r.status==='fulfilled').map(r=>r.value);
   if(!good.length)throw new Error(loaded.find(r=>r.status==='rejected')?.reason?.message||'No pageview series are currently available');
   setSeries(good);setPulseRound(0);
   if(good.length<updatedTitles.length)setError('Some articles had no available pageview data. Only verified series are displayed.');
  }catch(e:any){if(operation.current===stamp){setSeries([]);setError(e.message||'Wikimedia Analytics unavailable');}}
  finally{if(operation.current===stamp)setBusy('');}
 }
 async function fetchHistory(selected=topic){
  const stamp=++operation.current;setBusy('Loading historical revisions…');setError('');setDiff(null);setRevisionAnswer(null);
  try{
   const data=await loadRevisionList(selected);if(operation.current!==stamp)return;
   setHistory(data);setTopic(data.identity.title);setNewer(data.revisions[0].revisionId);
   setOlder(data.revisions[Math.min(5,data.revisions.length-1)].revisionId);
  }catch(e:any){if(operation.current===stamp){setHistory(null);setError(e.message||'Revision history unavailable');}}
  finally{if(operation.current===stamp)setBusy('');}
 }
 useEffect(()=>{if(mode==='pulse')void loadPulse();else void fetchHistory();return()=>{operation.current++;};},[mode]);
 function addTopic(e:React.FormEvent){
  e.preventDefault();const next=newTitle.trim().replace(/\s+/g,' ');
  if(!next)return;if(titles.length>=3){setError('Compare up to three articles at a time.');return;}
  if(titles.some(t=>t.toLocaleLowerCase()===next.toLocaleLowerCase())){setError('This article is already selected.');return;}
  const list=[...titles,next];setTitles(list);setNewTitle('');void loadPulse(list);
 }
 function removeTopic(title:string){const next=titles.filter(t=>t!==title);if(!next.length){setError('Keep at least one article selected.');return;}setTitles(next);void loadPulse(next);}
 function submitPulse(id:string){
  if(!quiz||pulseAnswer!==null)return;setPulseAnswer(id);const correct=gradePulse(quiz,id);
  onComplete({mode:'pulse',kind:'pageviews-comparison',title:quiz.date,correct,score:correct?100:0,at:new Date().toISOString(),source:quiz.source,sourceIds:quiz.choices.map(c=>c.id)});
 }
 async function compare(){
  if(!history||!older||!newer)return;
  const stamp=++operation.current;setBusy('Loading and comparing two pinned article revisions…');setError('');setRevisionAnswer(null);setDiff(null);
  try{const output=await compareRevisions(history,older,newer);if(stamp!==operation.current)return;setDiff(output);setRevisionRound(0);}
  catch(e:any){if(stamp===operation.current)setError(e.message||'Could not compare these revisions');}
  finally{if(stamp===operation.current)setBusy('');}
 }
 function guessChange(answer:'added'|'removed'){
  if(!change||revisionAnswer!==null||!diff)return;
  setRevisionAnswer(answer);const correct=gradeChange(change,answer);
  onComplete({mode:'capsule',kind:'revision-change',title:history?.identity.title||'',correct,score:correct?100:0,at:new Date().toISOString(),source:diff.later.sourceUrl,sourceIds:[String(diff.earlier.revisionId),String(diff.later.revisionId)]});
 }
 return <section className="hist">
  <div className="mode-head"><div className="eyebrow">{mode==='pulse'?'10 / WIKIMEDIA ANALYTICS':'11 / WIKIPEDIA REVISION ARCHIVE'}</div><h1>{mode==='pulse'?'WikiPulse':'Time Capsule'}<span className="accent">.</span></h1><p>{mode==='pulse'?'Compare observed daily Wikipedia pageviews and solve data-based attention challenges.':'Read real historical revisions, inspect changed text, and practice distinguishing additions from removals.'}</p></div>
  {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
  {busy&&<div className="loading" role="status">{busy}</div>}
  {mode==='pulse'?<>
   <div className="hist-panel"><div className="hist-controls"><div><label htmlFor="pulse-lang">WIKIPEDIA EDITION</label><select id="pulse-lang" value={language} onChange={e=>{setLanguage(e.target.value);void loadPulse(titles,days,e.target.value);}}><option value="en">English</option><option value="fr">French</option><option value="de">German</option><option value="ko">Korean</option><option value="tr">Turkish</option></select></div><div><label htmlFor="pulse-range">DAILY VIEW WINDOW</label><select id="pulse-range" value={days} onChange={e=>{const n=Number(e.target.value);setDays(n);void loadPulse(titles,n);}}>{[14,30,60,90].map(x=><option key={x} value={x}>{x} days</option>)}</select></div><button disabled={!!busy} onClick={()=>void loadPulse()}>Refresh actual counts ↻</button></div>
    <div className="hist-chips">{titles.map(t=><span key={t}>{t}<button aria-label={'Remove '+t} onClick={()=>removeTopic(t)} disabled={!!busy||titles.length===1}>×</button></span>)}</div>
    <form className="hist-add" onSubmit={addTopic}><label htmlFor="pulse-add">COMPARE ANOTHER ARTICLE</label><div><input id="pulse-add" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Wikipedia article title" maxLength={190}/><button disabled={!!busy||titles.length>=3} type="submit">Add article →</button></div></form>
   </div>
   {series.length>0&&<><div className="hist-source"><span>WIKIMEDIA ANALYTICS · {series[0].points[0]?.date} — {series[0].points.at(-1)?.date} · UTC · USER TRAFFIC</span><a href={series[0].source} target="_blank" rel="noreferrer">Original metrics API ↗</a></div>
    <div className="hist-metrics">{pulseLeaders(series).map((s,i)=>{const x=pulseSummary(s);return <div key={s.language+':'+s.title} className="hist-metric"><span className="eyebrow">ARTICLE {i+1} · {x.observedDays} OBSERVED DAYS</span><h3>{s.title}</h3><strong>{integer.format(x.total)}</strong><small>Observed pageviews · {integer.format(x.mean)} / observed day</small><p>Highest day: {x.max.date} ({integer.format(x.max.views)} views)</p><p>{x.changePct===null?'Insufficient first-half baseline':(x.changePct>=0?'+':'')+x.changePct+'% second-half vs first-half daily average'}</p><div><button onClick={()=>onRead(s.title)}>Read article →</button><a href={s.source} target="_blank" rel="noreferrer">Metrics source ↗</a></div></div>})}</div>
    <div className="hist-panel"><h2>Observed daily attention</h2><p>These are Wikipedia pageviews by non-automated users, not searches or a measure of worldwide interest. Dates with no response are not imputed as zero.</p><PulseChart series={series}/><button onClick={()=>setTableOpen(x=>!x)}>{tableOpen?'Hide':'Show'} accessible daily data table</button>
     {tableOpen&&<div className="hist-table-wrap"><table><thead><tr><th>Date (UTC)</th>{series.map(s=><th key={s.title}>{s.title}</th>)}</tr></thead><tbody>{[...new Set(series.flatMap(s=>s.points.map(p=>p.date)))].sort().map(date=><tr key={date}><td>{date}</td>{series.map(s=><td key={s.title}>{s.points.find(p=>p.date===date)?.views?.toLocaleString('en')??'No observation'}</td>)}</tr>)}</tbody></table></div>}
    </div>
    <div className="hist-panel"><div className="eyebrow">SOURCE-DERIVED CHALLENGE</div><h2>Which article received more pageviews?</h2>{quiz?<><p>Which article had the highest recorded user pageviews on <b>{quiz.date}</b>?</p><div className="hist-options">{quiz.choices.map(c=><button className={pulseAnswer===c.id?'selected':''} disabled={pulseAnswer!==null} key={c.id} onClick={()=>submitPulse(c.id)}>{c.title}</button>)}</div>{pulseAnswer!==null&&<div className="hist-result"><strong>{gradePulse(quiz,pulseAnswer)?'Correct observation.':'Different from the actual observation.'}</strong>{quiz.choices.map(c=><p key={c.id}>{c.title}: <b>{integer.format(c.views)}</b> pageviews</p>)}<button onClick={()=>{setPulseRound(r=>r+1);setPulseAnswer(null);}}>Another observation →</button></div>}</>:<p>At least two articles with a common date and a single highest count are required.</p>}</div>
   </>}
  </>:<>
   <form className="hist-panel hist-capsule-search" onSubmit={e=>{e.preventDefault();void fetchHistory();}}><label htmlFor="capsule-article">ENGLISH WIKIPEDIA ARTICLE</label><div><input id="capsule-article" value={topic} onChange={e=>setTopic(e.target.value)} maxLength={190}/><button disabled={!!busy} type="submit">Find revisions →</button></div></form>
   {history&&<><div className="hist-source"><span>{history.identity.title} · PAGE ID {history.identity.pageId} · {history.revisions.length} RECENT REVISIONS</span><a href={history.historyUrl} target="_blank" rel="noreferrer">Full Wikipedia edit history ↗</a></div>
    <div className="hist-panel"><h2>Choose two historical snapshots</h2><p>Revision IDs, dates, and descriptions are retrieved from Wikipedia. Only two revisions of the same source page can be compared.</p><div className="hist-compare-controls"><div><label htmlFor="capsule-old">EARLIER REVISION</label><select id="capsule-old" value={older??''} onChange={e=>setOlder(Number(e.target.value))}>{history.revisions.map(r=><option key={r.revisionId} value={r.revisionId}>{new Date(r.timestamp).toLocaleString('en',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})} · {r.revisionId}</option>)}</select></div><div><label htmlFor="capsule-new">LATER REVISION</label><select id="capsule-new" value={newer??''} onChange={e=>setNewer(Number(e.target.value))}>{history.revisions.map(r=><option key={r.revisionId} value={r.revisionId}>{new Date(r.timestamp).toLocaleString('en',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})} · {r.revisionId}</option>)}</select></div><button disabled={!!busy} onClick={()=>void compare()}>Compare article text →</button></div></div>
    {diff&&<><div className="hist-revisions"><div><span className="eyebrow">BEFORE</span><h3>{new Date(diff.earlier.timestamp).toLocaleString('en',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})}</h3><p>Revision {diff.earlier.revisionId}</p><a href={diff.earlier.sourceUrl} target="_blank" rel="noreferrer">Original text and contributors ↗</a></div><div><span className="eyebrow">AFTER</span><h3>{new Date(diff.later.timestamp).toLocaleString('en',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})}</h3><p>Revision {diff.later.revisionId}</p><a href={diff.later.sourceUrl} target="_blank" rel="noreferrer">Original text and contributors ↗</a></div></div>
      <div className="hist-panel"><h2>Paragraph presence comparison</h2><p>Compares text paragraphs exactly after whitespace normalization. Edited or moved paragraphs can appear as both removed and added; this is not a semantic fact checker.</p><div className="hist-diff"><section><h3>Added in later revision ({diff.addedCount})</h3>{diff.added.map((p,i)=><p key={i}>{p}</p>)}{!diff.added.length&&<p>No added paragraphs detected.</p>}</section><section><h3>Absent from later revision ({diff.removedCount})</h3>{diff.removed.map((p,i)=><p key={i}>{p}</p>)}{!diff.removed.length&&<p>No removed paragraphs detected.</p>}</section></div>{diff.truncated&&<small>Long changes are truncated for performance. Open original revisions for the complete text.</small>}<p className="hist-attrib">Adapted Wikipedia text · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · Revision authors and source links above</p></div>
      <div className="hist-panel"><div className="eyebrow">VERIFIED TEXT-DIFFERENCE CHALLENGE</div><h2>Was this paragraph added or removed?</h2>{change?<><blockquote className="hist-passage">{change.prompt}</blockquote><div className="hist-options"><button disabled={revisionAnswer!==null} onClick={()=>guessChange('added')}>Added in later revision</button><button disabled={revisionAnswer!==null} onClick={()=>guessChange('removed')}>Present only in earlier revision</button></div>{revisionAnswer!==null&&<div className="hist-result"><strong>{gradeChange(change,revisionAnswer)?'Correct revision classification.':'Incorrect classification.'}</strong><p>Recorded category: {change.answer}</p><button onClick={()=>{setRevisionRound(i=>i+1);setRevisionAnswer(null);}}>Another source excerpt →</button></div>}</>:<p>No changed paragraphs were detected between these revisions. Choose a different pair.</p>}</div>
    </>}
    <div className="hist-panel"><h2>Revision archive</h2><div className="hist-archive">{history.revisions.map(r=><div key={r.revisionId}><time dateTime={r.timestamp}>{new Date(r.timestamp).toLocaleString('en',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})}</time><span>{r.comment||'No edit summary supplied'}</span><a href={r.sourceUrl} target="_blank" rel="noreferrer">Revision {r.revisionId} ↗</a></div>)}</div></div>
   </>}
  </>}
 </section>;
}
