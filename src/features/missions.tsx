import React,{useState} from 'react';
import {dailyMissionBoard,missionRecordDetails,milestoneBoard,recentWeek} from '../domain/missions.mjs';
import './missions.css';
type SourceArticle={language:string;pageId:number;revisionId:number;title:string};
type MissionRecord={index:number;at:string;label:string;mode:string;article:SourceArticle|null;other:SourceArticle|null;sourceUrls:{url:string;label:string}[];sourceIds:string[];authority:string};
type Progress={races?:any[];mysteries?:any[];saved?:Record<string,unknown>};
export default function Missions({progress,onNavigate,onStartMission,onReadSource,onStudySource,onContinueSource}:{
 progress:Progress;onNavigate:(mode:string)=>void;onStartMission:(id:string,mode:string)=>void;
 onReadSource:(article:SourceArticle)=>void;onStudySource:(article:SourceArticle)=>void;
 onContinueSource:(mode:string,article:SourceArticle)=>void;
}){
 const today=dailyMissionBoard(progress),week=recentWeek(progress);
 const [requestedDay,setRequestedDay]=useState(''),[requestedId,setRequestedId]=useState('');
 const selectedDay=week.some(d=>d.date===requestedDay)?requestedDay:today.date;
 const board=selectedDay===today.date?today:dailyMissionBoard(progress,selectedDay);
 const selected=board.missions.find(m=>m.id===requestedId)||board.missions[0];
 const evidence=missionRecordDetails(progress,selected.id,selectedDay,16);
 const maximum=Math.max(1,...week.map(day=>day.activity));
 const milestones=milestoneBoard(progress),earned=milestones.filter(m=>m.earned).length;
 const upcoming=board.missions.find(m=>!m.complete);
 const isToday=selectedDay===today.date;
 return <section className="missions">
  <div className="mode-head"><h1>Daily Missions</h1></div>
  <div className="missions-intro"><div><small>UTC DAY · {selectedDay}</small><strong>{board.completed} / {board.total}</strong><span>{isToday?'Today’s completed tasks':'Completed tasks on this day'}</span></div><div><small>PERSONAL MILESTONES</small><strong>{earned} / {milestones.length}</strong></div></div>
  <div className="missions-grid">
   <section className="missions-panel"><div className="missions-route-head"><h2>{isToday?'Today’s route':'Route on '+selectedDay}</h2>{upcoming&&<button className="missions-next" onClick={()=>onStartMission(upcoming.id,upcoming.mode)}>{isToday?'Continue next task':'Practice next task now'} →</button>}</div>
     {board.missions.map((task,i)=><div className={'mission-item '+(task.complete?'completed':'')+(selected.id===task.id?' active':'')} key={task.id}>
      <span className="mission-marker" aria-label={task.complete?'Completed':'Not completed'}>{task.complete?'✓':String(i+1).padStart(2,'0')}</span>
      <div><strong>{task.name}</strong><small>{task.detail}</small><span className="mission-record-count">{task.count} original {task.count===1?'record':'records'} · {task.complete?'completed':'not completed'}</span></div>
      <div className="mission-controls"><button aria-pressed={selected.id===task.id} onClick={()=>setRequestedId(task.id)}>Evidence</button><button onClick={()=>onStartMission(task.id,task.mode)}>{isToday?(task.complete?'Replay':'Start'):'Practice now'} →</button></div>
     </div>)}
   </section>
   <section className="missions-panel"><div className="missions-week-head"><h2>Past seven UTC days</h2>{!isToday&&<button onClick={()=>{setRequestedDay(today.date);setRequestedId('');}}>Today →</button>}</div>
    <div className="mission-week" role="group" aria-label="Select UTC date to inspect mission records">{week.map(d=><button className="mission-day" aria-pressed={selectedDay===d.date} key={d.date} onClick={()=>{setRequestedDay(d.date);setRequestedId('');}}>
     <div className="mission-bar-slot"><div className="mission-bar" style={{height:(d.activity?Math.max(6,Math.round(d.activity/maximum*100)):0)+'%'}}/></div>
     <strong>{d.activity}</strong><span>{d.date.slice(5)}</span>
    </button>)}</div>
    <p className="missions-caveat">Recorded local activities by UTC day. Missing days carry no penalty; clearing site data removes these records.</p>
   </section>
  </div>
  <section className="missions-panel missions-evidence" aria-label="Original daily mission evidence">
   <div className="missions-evidence-head"><div><h2>{selected.name}</h2><p>{selectedDay} UTC · {evidence.total} qualifying source {evidence.total===1?'record':'records'}{evidence.truncated?' · first '+evidence.shown+' shown':''}</p></div>
    <button onClick={()=>onStartMission(selected.id,selected.mode)}>{isToday?'Practice this task':'Practice now'} →</button>
   </div>
   {evidence.records.length?<div className="missions-evidence-list">{(evidence.records as MissionRecord[]).map(item=><article key={item.index} className="missions-evidence-record">
     <div className="missions-evidence-title"><h3>{item.label}</h3><time dateTime={item.at}>{item.at?new Date(item.at).toLocaleString('en',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' UTC':'UTC time unavailable'}</time></div>
     <div className="missions-evidence-links">{item.sourceUrls.length?item.sourceUrls.map(ref=><a key={ref.url} href={ref.url} target="_blank" rel="noreferrer">{ref.label} ↗</a>):<span>No directly openable original URL stored in this record.</span>}</div>
     {item.sourceIds.length>0&&<div className="missions-source-ids"><strong>Recorded source IDs</strong><span>{item.sourceIds.join(' · ')}</span></div>}
     <div className="missions-evidence-actions">
      {item.article&&<><button onClick={()=>onReadSource(item.article!)}>Read exact revision →</button><button onClick={()=>onStudySource(item.article!)}>Study this source →</button><button onClick={()=>onContinueSource(item.mode,item.article!)}>Continue from source →</button></>}
      {item.other&&<button onClick={()=>onReadSource(item.other!)}>Read second revision →</button>}
      {!item.article&&<button onClick={()=>onNavigate(item.mode)}>Practice this mode →</button>}
     </div>
    </article>)}</div>:<p>No qualifying original record was saved for this task on {selectedDay}.</p>}
   <p className="missions-caveat">Historical records remain assigned to their original UTC date. Practice now only records new actions on the current day. Citation assessments are ungraded.</p>
  </section>
  <section className="missions-panel"><h2>Personal achievements</h2><p>Local participation records; not proficiency credentials.</p>
   <div className="mission-achievements">{milestones.map(m=><div key={m.id} className={'mission-achievement '+(m.earned?'earned':'')}><div className="eyebrow">{m.earned?'LOCALLY RECORDED':'IN PROGRESS'}</div><strong>{m.name}</strong><p>{m.detail}</p><span>{m.count} / {m.target}</span><div className="mission-track" role="progressbar" aria-label={m.name} aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={m.count}><div style={{width:(100*m.count/m.target)+'%'}}/></div></div>)}</div>
  </section>
 </section>;
}
