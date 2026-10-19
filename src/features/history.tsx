import React,{useEffect,useMemo,useRef,useState} from 'react';
import {loadPageviews,loadRevisionList,loadRevisionWindow,compareRevisions} from '../services/history.mjs';
import {pulseSummary,pulseLeaders,pulseQuiz,gradePulse,pulseCalendar,pulseObservedSegments,pulsePeriodComparison,pulseDayEvidence,changeChallenge,gradeChange,mergeRevisionPages} from '../domain/history.mjs';
import './history.css';
type Mode='pulse'|'capsule';
type Point={date:string;views:number};
type Series={title:string;language:string;points:Point[];start:string;end:string;source:string;total:number;observedDays:number};
type Revision={revisionId:number;timestamp:string;size:number|null;comment:string;sourceUrl:string};
type History={identity:{language:string;pageId:number;title:string};revisions:Revision[];historyUrl:string;nextCursor?:string|null;window?:{start:string;end:string;days:number}};
type Comparison={from:{revisionId:number};to:{revisionId:number};earlier:Revision;later:Revision;added:string[];removed:string[];addedCount:number;removedCount:number;method:string;truncated:boolean};
type Result={mode:Mode;kind:string;title:string;correct:boolean;score:number;at:string;source:string;sourceIds:string[]};
type SourceArticle={language:string;pageId:number;revisionId:number;title:string};
const initialTitles=['Marie Curie','Albert Einstein'];
const integer=new Intl.NumberFormat('en');
function PulseChart({series,selectedDate,onSelectDate}:{series:Series[];selectedDate:string;onSelectDate:(date:string)=>void}){
 const calendar=pulseCalendar(series),dates=calendar.map(row=>row.date);
 const maximum=Math.max(1,...series.flatMap(s=>s.points.map(p=>p.views)));
 const colors=['#8bdcd7','#e7be85','#aeb7f0'];
 const coords=(p:Point)=>({x:40+dates.indexOf(p.date)/Math.max(1,dates.length-1)*780,y:260-p.views/maximum*220});
 return <div className="history-plot"><svg viewBox="0 0 860 310" role="group" aria-label={'Interactive recorded Wikimedia pageview observations, UTC; missing dates are unconnected. '+series.map(s=>s.title).join(', ')}>
  <g stroke="#395362" strokeWidth="1">{[0,1,2,3,4].map(i=><line key={i} x1="40" y1={40+i*55} x2="820" y2={40+i*55}/>)}</g>
  <g fill="#b4c7d1" fontSize="14"><text x="3" y="45">{integer.format(maximum)}</text><text x="12" y="263">0</text><text x="40" y="292">{dates[0]}</text><text x="690" y="292">{dates.at(-1)}</text></g>
  {series.map((s,i)=><g key={s.language+':'+s.title}>
   {pulseObservedSegments(s,calendar).map((segment,j)=><polyline key={j} points={segment.map(pt=>{const point=coords(pt);return point.x+','+point.y;}).join(' ')} fill="none" stroke={colors[i%3]} strokeWidth="2.8" strokeLinejoin="round"><title>{s.title} · {segment.length} consecutive observed days</title></polyline>)}
   {s.points.map(point=>{const loc=coords(point);return <g key={point.date} role="button" tabIndex={0} aria-label={s.title+': '+point.date+', '+integer.format(point.views)+' recorded pageviews'} onClick={()=>onSelectDate(point.date)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelectDate(point.date);}}}>
    <circle cx={loc.x} cy={loc.y} r={selectedDate===point.date?7:4} fill={colors[i%3]} stroke={selectedDate===point.date?'#fff':'#142c37'} strokeWidth="2"/><title>{point.date} · {s.title}: {integer.format(point.views)}</title></g>;})}
  </g>)}
 </svg><div className="history-legend">{series.map((s,i)=><span key={s.language+':'+s.title}><i style={{background:colors[i%3]}}/>{s.title}</span>)}</div></div>;
}
export default function HistoryExplorer({mode,focusArticle,onRead,onReadSource,onStudySource,onComplete}:{mode:Mode;focusArticle?:SourceArticle|null;onRead:(title:string,language?:string)=>void;onReadSource?:(article:SourceArticle)=>void;onStudySource?:(article:SourceArticle)=>void;onComplete:(r:Result)=>void}){
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 const [language,setLanguage]=useState(focusArticle?.language||'en'),[days,setDays]=useState(30),[titles,setTitles]=useState<string[]>(focusArticle?[focusArticle.title]:initialTitles),[newTitle,setNewTitle]=useState('');
 const [series,setSeries]=useState<Series[]>([]),[pulseAnswer,setPulseAnswer]=useState<string|null>(null),[pulseRound,setPulseRound]=useState(0),[tableOpen,setTableOpen]=useState(false);
 const [selectedDay,setSelectedDay]=useState(''),[comparePeriod,setComparePeriod]=useState<'halves'|'week'>('halves');
 const [pulseRevision,setPulseRevision]=useState<{sourceId:string;history:History}|null>(null),[pulseRevisionBusy,setPulseRevisionBusy]=useState(false),[pulseRevisionError,setPulseRevisionError]=useState('');
 const revisionOperation=useRef(0);
 const [topic,setTopic]=useState('Marie Curie'),[history,setHistory]=useState<History|null>(null),[older,setOlder]=useState<number|null>(null),[newer,setNewer]=useState<number|null>(null),[diff,setDiff]=useState<Comparison|null>(null),[revisionAnswer,setRevisionAnswer]=useState<string|null>(null),[revisionRound,setRevisionRound]=useState(0);
 const [historyScope,setHistoryScope]=useState<'recent'|'window'>('recent');
 const [anchorDate,setAnchorDate]=useState(new Date().toISOString().slice(0,10)),[windowDays,setWindowDays]=useState(30);
 const operation=useRef(0);
 const quiz=useMemo(()=>pulseQuiz(series,pulseRound),[series,pulseRound]);
 const daily=useMemo(()=>series.length?pulseCalendar(series):[],[series]);
 const inspectedDay=useMemo(()=>daily.length?pulseDayEvidence(series,daily.some(row=>row.date===selectedDay)?selectedDay:daily.at(-1).date):null,[series,daily,selectedDay]);
 const periodReport=useMemo(()=>daily.length>=14?pulsePeriodComparison(series,comparePeriod):null,[series,comparePeriod,daily]);
 const change=useMemo(()=>diff?changeChallenge(diff,String(revisionRound)):null,[diff,revisionRound]);
 async function loadPulse(updatedTitles=titles,nextDays=days,nextLanguage=language){
  const stamp=++operation.current;++revisionOperation.current;setPulseRevision(null);setPulseRevisionError('');setBusy('Retrieving actual Wikimedia pageviews…');setError('');setPulseAnswer(null);
  try{
   const loaded=await Promise.allSettled(updatedTitles.map(title=>loadPageviews(title,{language:nextLanguage,days:nextDays})));
   if(operation.current!==stamp)return;
   const good:Series[]=loaded.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
   if(!good.length)throw new Error(loaded.find(r=>r.status==='rejected')?.reason?.message||'No pageview series are currently available');
   setSeries(good);setPulseRound(0);setSelectedDay(pulseCalendar(good).at(-1)?.date||'');
   if(good.length<updatedTitles.length)setError('Some articles had no available pageview data. Only verified series are displayed.');
  }catch(e:any){if(operation.current===stamp){setSeries([]);setError(e.message||'Wikimedia Analytics unavailable');}}
  finally{if(operation.current===stamp)setBusy('');}
 }
 async function fetchHistory(selected=topic,scope=historyScope,day=anchorDate,span=windowDays){
  const stamp=++operation.current;setBusy('Loading historical revisions…');setError('');setDiff(null);setRevisionAnswer(null);
  try{
   const data:History=scope==='window'?await loadRevisionWindow(selected,{endDate:day,days:span,limit:20}):await loadRevisionList(selected);
   if(operation.current!==stamp)return;
   if(data.revisions.length<2)throw new Error('Only one revision was found in this window. Broaden the date range.');
   setHistory(data);setTopic(data.identity.title);setNewer(data.revisions[0].revisionId);
   setOlder(data.revisions[Math.min(5,data.revisions.length-1)].revisionId);
  }catch(e:any){if(operation.current===stamp){setHistory(null);setError(e.message||'Revision history unavailable');}}
  finally{if(operation.current===stamp)setBusy('');}
 }
 useEffect(()=>{if(mode==='pulse')void loadPulse();else void fetchHistory();return()=>{operation.current++;revisionOperation.current++;};},[mode,focusArticle?.pageId,focusArticle?.revisionId,focusArticle?.language]);
 async function moreRevisions(){
  if(!history?.nextCursor||!history.window||busy)return;
  const stamp=++operation.current;setBusy('Loading more revisions within the selected historical window…');setError('');
  try{
   const next=await loadRevisionWindow(history.identity.title,{endDate:history.window.end,days:history.window.days,limit:20,cursor:history.nextCursor,pageId:history.identity.pageId});
   if(stamp!==operation.current)return;setHistory(mergeRevisionPages(history,next));
  }catch(e:any){if(stamp===operation.current)setError(e.message||'Could not continue this historical window.');}
  finally{if(stamp===operation.current)setBusy('');}
 }
 function addTopic(e:React.FormEvent){
  e.preventDefault();const next=newTitle.trim().replace(/\s+/g,' ');
  if(!next)return;if(titles.length>=3){setError('Compare up to three articles at a time.');return;}
  if(titles.some(t=>t.toLocaleLowerCase()===next.toLocaleLowerCase())){setError('This article is already selected.');return;}
  const list=[...titles,next];setTitles(list);setNewTitle('');void loadPulse(list);
 }
 function removeTopic(title:string){const next=titles.filter(t=>t!==title);if(!next.length){setError('Keep at least one article selected.');return;}setTitles(next);void loadPulse(next);}
 async function inspectPulseRevisions(s:Series){
  const n=++revisionOperation.current;setPulseRevisionBusy(true);setPulseRevisionError('');setPulseRevision(null);
  try{
   const end=pulseCalendar([s]).at(-1)?.date;
   if(!end)throw new Error('No verified pageview end date available');
   const span=days<=30?30:90;
   const found=await loadRevisionWindow(s.title,{language:s.language,endDate:end,days:span,limit:20});
   if(revisionOperation.current!==n)return;
   setPulseRevision({sourceId:s.language+':'+s.title,history:found});
  }catch(err:any){if(revisionOperation.current===n)setPulseRevisionError(err.message||'Original revision metadata unavailable');}
  finally{if(revisionOperation.current===n)setPulseRevisionBusy(false);}
 }
 async function continuePulseRevisions(){
  if(!pulseRevision?.history.nextCursor||!pulseRevision.history.window||pulseRevisionBusy)return;
  const n=++revisionOperation.current;setPulseRevisionBusy(true);setPulseRevisionError('');
  try{
   const h=pulseRevision.history;
   const next=await loadRevisionWindow(h.identity.title,{language:h.identity.language,endDate:h.window.end,days:h.window.days,limit:20,cursor:h.nextCursor,pageId:h.identity.pageId});
   if(revisionOperation.current===n)setPulseRevision({sourceId:pulseRevision.sourceId,history:mergeRevisionPages(h,next)});
  }catch(err:any){if(revisionOperation.current===n)setPulseRevisionError(err.message||'Cannot load additional original revisions');}
  finally{if(revisionOperation.current===n)setPulseRevisionBusy(false);}
 }
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
  <div className="mode-head"><h1>{mode==='pulse'?'WikiPulse':'Time Capsule'}</h1></div>
  {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
  {busy&&<div className="loading" role="status">{busy}</div>}
  {mode==='pulse'?<>
   <div className="hist-panel"><div className="hist-controls"><div><label htmlFor="pulse-lang">WIKIPEDIA EDITION</label><select id="pulse-lang" value={language} onChange={e=>{setLanguage(e.target.value);void loadPulse(titles,days,e.target.value);}}><option value="en">English</option><option value="fr">French</option><option value="de">German</option><option value="ko">Korean</option><option value="tr">Turkish</option></select></div><div><label htmlFor="pulse-range">DAILY VIEW WINDOW</label><select id="pulse-range" value={days} onChange={e=>{const n=Number(e.target.value);setDays(n);void loadPulse(titles,n);}}>{[14,30,60,90].map(x=><option key={x} value={x}>{x} days</option>)}</select></div><button disabled={!!busy} onClick={()=>void loadPulse()}>Refresh actual counts ↻</button></div>
    <div className="hist-chips">{titles.map(t=><span key={t}>{t}<button aria-label={'Remove '+t} onClick={()=>removeTopic(t)} disabled={!!busy||titles.length===1}>×</button></span>)}</div>
    <form className="hist-add" onSubmit={addTopic}><label htmlFor="pulse-add">COMPARE ANOTHER ARTICLE</label><div><input id="pulse-add" value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="Wikipedia article title" maxLength={190}/><button disabled={!!busy||titles.length>=3} type="submit">Add article →</button></div></form>
   </div>
   {series.length>0&&<><div className="hist-source"><span>WIKIMEDIA ANALYTICS · {series[0].points[0]?.date} — {series[0].points.at(-1)?.date} · UTC · USER TRAFFIC</span><a href={series[0].source} target="_blank" rel="noreferrer">Original metrics API ↗</a></div>
    <div className="hist-metrics">{pulseLeaders(series).map((s,i)=>{const x=pulseSummary(s);return <div key={s.language+':'+s.title} className="hist-metric"><span className="eyebrow">ARTICLE {i+1} · {x.observedDays} OBSERVED DAYS</span><h3>{s.title}</h3><strong>{integer.format(x.total)}</strong><small>Observed pageviews · {integer.format(x.mean)} / observed day</small><p>Highest day: {x.max.date} ({integer.format(x.max.views)} views)</p><p>{x.changePct===null?'Insufficient first-half baseline':(x.changePct>=0?'+':'')+x.changePct+'% second-half vs first-half daily average'}</p><div><button onClick={()=>onRead(s.title,s.language)}>Read current {s.language.toUpperCase()} article →</button><button disabled={pulseRevisionBusy} onClick={()=>void inspectPulseRevisions(s)}>Inspect revisions →</button><a href={s.source} target="_blank" rel="noreferrer">Metrics source ↗</a></div></div>})}</div>
    <div className="hist-panel"><h2>Observed daily attention</h2><p>Wikipedia pageviews exclude automated traffic; they are not searches. Missing dates are not counted as zero.</p><PulseChart series={series} selectedDate={inspectedDay?.date||''} onSelectDate={setSelectedDay}/><div className="hist-pulse-day" aria-label="Exact UTC date evidence"><label htmlFor="pulse-date">Inspect UTC day</label><select id="pulse-date" value={inspectedDay?.date||''} onChange={e=>setSelectedDay(e.target.value)}>{daily.map(row=><option key={row.date} value={row.date}>{row.date}</option>)}</select>
     {inspectedDay&&<div className="hist-pulse-day-records">{inspectedDay.values.map(item=><div key={item.id}><strong>{item.title}</strong><span>{item.views===null?'No API observation':integer.format(item.views)+' recorded views'}</span><a href={item.source} target="_blank" rel="noreferrer">Original daily source ↗</a></div>)}</div>}
     {inspectedDay&&inspectedDay.missing>0&&<p role="status">{inspectedDay.missing} selected article{inspectedDay.missing===1?' has':'s have'} no returned observation on {inspectedDay.date}. Missing data are not zero pageviews.</p>}
     </div>
     <section className="hist-pulse-period" aria-label="Observed period comparison"><div className="hist-pulse-period-head"><h3>Compare observed windows</h3><label htmlFor="pulse-period">Equal-length windows</label><select id="pulse-period" value={comparePeriod} onChange={e=>setComparePeriod(e.target.value as 'halves'|'week')}><option value="halves">First half / last half</option><option value="week">First 7 days / last 7 days</option></select></div>
      {periodReport&&<><p>{periodReport.earlier.start} to {periodReport.earlier.end} versus {periodReport.later.start} to {periodReport.later.end} (UTC). Percentages require every observation in both windows.</p>
       <div className="hist-pulse-period-grid">{periodReport.articles.map(record=><div key={record.id}><h4>{record.title}</h4>
        <div><span>Earlier: {record.earlier.observedDays}/{record.earlier.expectedDays} days</span><strong>{record.earlier.mean===null?'No observations':integer.format(record.earlier.total)+' total · '+record.earlier.mean.toLocaleString('en')+'/observed day'}</strong></div>
        <div><span>Later: {record.later.observedDays}/{record.later.expectedDays} days</span><strong>{record.later.mean===null?'No observations':integer.format(record.later.total)+' total · '+record.later.mean.toLocaleString('en')+'/observed day'}</strong></div>
        <p>{record.changePct===null?record.reason:(record.changePct>=0?'+':'')+record.changePct+'% daily mean change'}</p><a href={record.source} target="_blank" rel="noreferrer">Original metrics ↗</a>
       </div>)}</div></>}
     </section>
     <button onClick={()=>setTableOpen(x=>!x)}>{tableOpen?'Hide':'Show'} accessible daily data table</button>
     {tableOpen&&<div className="hist-table-wrap"><table><thead><tr><th>Date (UTC)</th>{series.map(s=><th key={s.title}>{s.title}</th>)}</tr></thead><tbody>{daily.map(row=><tr key={row.date}><td>{row.date}</td>{row.values.map(item=><td key={item.id}>{item.views===null?'No observation':integer.format(item.views)}</td>)}</tr>)}</tbody></table></div>}
    </div>
    {(pulseRevision||pulseRevisionBusy||pulseRevisionError)&&<section className="hist-panel hist-pulse-revisions" aria-label="Independent source revision activity"><h2>Original revision activity</h2>
     {pulseRevisionBusy&&<p role="status">Retrieving original MediaWiki revision metadata…</p>}
     {pulseRevisionError&&<p role="status">{pulseRevisionError}</p>}
     {pulseRevision&&<><p>{pulseRevision.history.identity.title} · {pulseRevision.history.identity.language.toUpperCase()} page {pulseRevision.history.identity.pageId} · {pulseRevision.history.window?.start} to {pulseRevision.history.window?.end} UTC · {pulseRevision.history.revisions.length} retrieved revision entries{pulseRevision.history.nextCursor?' (additional pages available)':''}. This is not a complete edit count or evidence of why traffic changed.</p>
       <div className="hist-pulse-revision-list">{pulseRevision.history.revisions.map(entry=><div key={entry.revisionId}><time dateTime={entry.timestamp}>{new Date(entry.timestamp).toLocaleString('en',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})}</time><span>{entry.comment||'No edit summary supplied'}</span><a href={entry.sourceUrl} target="_blank" rel="noreferrer">Revision {entry.revisionId} ↗</a></div>)}</div>
       {pulseRevision.history.nextCursor&&<button disabled={pulseRevisionBusy} onClick={()=>void continuePulseRevisions()}>Load more recorded revisions →</button>}
       <a href={pulseRevision.history.historyUrl} target="_blank" rel="noreferrer">Original full edit history ↗</a>
      </>}
     </section>}
    {focusArticle&&<div className="hist-panel hist-pulse-focus"><h2>Selected original article</h2><p>{focusArticle.title} · {focusArticle.language.toUpperCase()} page {focusArticle.pageId} · revision {focusArticle.revisionId}</p><div className="hist-pulse-focus-actions">{onReadSource&&<button onClick={()=>onReadSource(focusArticle)}>Open selected revision in Discover →</button>}{onStudySource&&<button onClick={()=>onStudySource(focusArticle)}>Continue in Study Desk →</button>}</div><p>The pinned article revision is independent of subsequent pageview and revision observations.</p></div>}
    <div className="hist-panel"><div className="eyebrow">SOURCE-DERIVED CHALLENGE</div><h2>Which article received more pageviews?</h2>{quiz?<><p>Which article had the highest recorded user pageviews on <b>{quiz.date}</b>?</p><div className="hist-options">{quiz.choices.map(c=><button className={pulseAnswer===c.id?'selected':''} disabled={pulseAnswer!==null} key={c.id} onClick={()=>submitPulse(c.id)}>{c.title}</button>)}</div>{pulseAnswer!==null&&<div className="hist-result"><strong>{gradePulse(quiz,pulseAnswer)?'Correct observation.':'Different from the actual observation.'}</strong>{quiz.choices.map(c=><p key={c.id}>{c.title}: <b>{integer.format(c.views)}</b> pageviews</p>)}<button onClick={()=>{setPulseRound(r=>r+1);setPulseAnswer(null);}}>Another observation →</button></div>}</>:<p>At least two articles with a common date and a single highest count are required.</p>}</div>
   </>}
  </>:<>
   <div className="hist-panel hist-date-browser">
    <h2>Browse historical snapshots</h2><p>Choose a UTC date and a 7–365-day lookback.</p>
    <div className="hist-date-tabs"><button aria-pressed={historyScope==='recent'} onClick={()=>{setHistoryScope('recent');void fetchHistory(topic,'recent');}}>Recent revisions</button><button aria-pressed={historyScope==='window'} onClick={()=>{setHistoryScope('window');void fetchHistory(topic,'window',anchorDate,windowDays);}}>Date-scoped archive</button></div>
    {historyScope==='window'&&<div className="hist-date-fields"><div><label htmlFor="capsule-anchor">LAST DAY IN WINDOW (UTC)</label><input id="capsule-anchor" type="date" value={anchorDate} max={new Date().toISOString().slice(0,10)} min="2001-01-01" onChange={e=>setAnchorDate(e.target.value)}/></div><div><label htmlFor="capsule-days">LOOKBACK</label><select id="capsule-days" value={windowDays} onChange={e=>setWindowDays(Number(e.target.value))}>{[7,30,90,365].map(d=><option key={d} value={d}>{d} days</option>)}</select></div></div>}
   </div>
   <form className="hist-panel hist-capsule-search" onSubmit={e=>{e.preventDefault();void fetchHistory();}}><label htmlFor="capsule-article">ENGLISH WIKIPEDIA ARTICLE</label><div><input id="capsule-article" value={topic} onChange={e=>setTopic(e.target.value)} maxLength={190}/><button disabled={!!busy} type="submit">{historyScope==='window'?'Search selected date window →':'Find recent revisions →'}</button></div></form>
   {history&&<><div className="hist-source"><span>{history.identity.title} · PAGE ID {history.identity.pageId} · {history.revisions.length} {history.window?'SCOPED':'RECENT'} REVISIONS {history.window?'· '+history.window.start+' — '+history.window.end:''}</span><a href={history.historyUrl} target="_blank" rel="noreferrer">Full Wikipedia edit history ↗</a></div>
    <div className="hist-panel"><h2>Choose two historical snapshots</h2><p>Compare two revisions of the same article.</p><div className="hist-compare-controls"><div><label htmlFor="capsule-old">EARLIER REVISION</label><select id="capsule-old" value={older??''} onChange={e=>setOlder(Number(e.target.value))}>{history.revisions.map(r=><option key={r.revisionId} value={r.revisionId}>{new Date(r.timestamp).toLocaleString('en',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})} · {r.revisionId}</option>)}</select></div><div><label htmlFor="capsule-new">LATER REVISION</label><select id="capsule-new" value={newer??''} onChange={e=>setNewer(Number(e.target.value))}>{history.revisions.map(r=><option key={r.revisionId} value={r.revisionId}>{new Date(r.timestamp).toLocaleString('en',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})} · {r.revisionId}</option>)}</select></div><button disabled={!!busy} onClick={()=>void compare()}>Compare article text →</button></div></div>
    {diff&&<><div className="hist-revisions"><div><span className="eyebrow">BEFORE</span><h3>{new Date(diff.earlier.timestamp).toLocaleString('en',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})}</h3><p>Revision {diff.earlier.revisionId}</p><a href={diff.earlier.sourceUrl} target="_blank" rel="noreferrer">Original text and contributors ↗</a></div><div><span className="eyebrow">AFTER</span><h3>{new Date(diff.later.timestamp).toLocaleString('en',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})}</h3><p>Revision {diff.later.revisionId}</p><a href={diff.later.sourceUrl} target="_blank" rel="noreferrer">Original text and contributors ↗</a></div></div>
      <div className="hist-panel"><h2>Paragraph presence comparison</h2><p>Whitespace-normalized text comparison. Edited or moved paragraphs may appear as removed and added.</p><div className="hist-diff"><section><h3>Added in later revision ({diff.addedCount})</h3>{diff.added.map((p,i)=><p key={i}>{p}</p>)}{!diff.added.length&&<p>No added paragraphs detected.</p>}</section><section><h3>Absent from later revision ({diff.removedCount})</h3>{diff.removed.map((p,i)=><p key={i}>{p}</p>)}{!diff.removed.length&&<p>No removed paragraphs detected.</p>}</section></div>{diff.truncated&&<small>Long changes are truncated for performance. Open original revisions for the complete text.</small>}<p className="hist-attrib">Adapted Wikipedia text · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · Revision authors and source links above</p></div>
      <div className="hist-panel"><div className="eyebrow">VERIFIED TEXT-DIFFERENCE CHALLENGE</div><h2>Was this paragraph added or removed?</h2>{change?<><blockquote className="hist-passage">{change.prompt}</blockquote><div className="hist-options"><button disabled={revisionAnswer!==null} onClick={()=>guessChange('added')}>Added in later revision</button><button disabled={revisionAnswer!==null} onClick={()=>guessChange('removed')}>Present only in earlier revision</button></div>{revisionAnswer!==null&&<div className="hist-result"><strong>{gradeChange(change,revisionAnswer)?'Correct revision classification.':'Incorrect classification.'}</strong><p>Recorded category: {change.answer}</p><button onClick={()=>{setRevisionRound(i=>i+1);setRevisionAnswer(null);}}>Another source excerpt →</button></div>}</>:<p>No changed paragraphs were detected between these revisions. Choose a different pair.</p>}</div>
    </>}
    <div className="hist-panel"><h2>Revision archive</h2><div className="hist-archive">{history.revisions.map(r=><div key={r.revisionId}><time dateTime={r.timestamp}>{new Date(r.timestamp).toLocaleString('en',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})}</time><span>{r.comment||'No edit summary supplied'}</span><a href={r.sourceUrl} target="_blank" rel="noreferrer">Revision {r.revisionId} ↗</a></div>)}</div>{history.nextCursor&&<div className="hist-more"><button disabled={!!busy} onClick={()=>void moreRevisions()}>Load more revisions from this date window →</button><span>Continuation is locked to page ID {history.identity.pageId}</span></div>}</div>
   </>}
  </>}
 </section>;
}
