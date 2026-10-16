import React from 'react';
import {dailyMissionBoard,milestoneBoard,recentWeek} from '../domain/missions.mjs';
import './missions.css';
type Progress={races?:any[];mysteries?:any[];saved?:Record<string,unknown>};
export default function Missions({progress,onNavigate}:{progress:Progress;onNavigate:(mode:string)=>void}){
 const board=dailyMissionBoard(progress),milestones=milestoneBoard(progress),week=recentWeek(progress);
 const maximum=Math.max(1,...week.map(day=>day.activity));
 const earned=milestones.filter(m=>m.earned).length;
 return <section className="missions">
  <div className="mode-head"><div className="eyebrow">13 / DAILY KNOWLEDGE ROUTINE</div><h1>Daily Missions<span className="accent">.</span></h1><p>Explore different sources each day. The checklist and milestones reflect saved local participation, not official proficiency or ranked scores.</p></div>
  <div className="missions-intro"><div><small>UTC DAY · {board.date}</small><strong>{board.completed} / {board.total}</strong><span>Today's source activities completed</span></div><div><small>PERSONAL MILESTONES</small><strong>{earned} / {milestones.length}</strong><span>Derived from device-only records</span></div></div>
  <div className="missions-grid">
   <section className="missions-panel"><h2>Today’s route</h2><p>Five varied source-backed tasks rotate by UTC date. Completing an eligible activity marks the matching task automatically.</p>
     {board.missions.map((task,i)=><div className={'mission-item '+(task.complete?'completed':'')} key={task.id}><span className="mission-marker" aria-label={task.complete?'Completed':'Not completed'}>{task.complete?'✓':String(i+1).padStart(2,'0')}</span><div><strong>{task.name}</strong><small>{task.detail}</small>{task.complete&&<small>{task.count} qualifying local {task.count===1?'record':'records'}</small>}</div><button onClick={()=>onNavigate(task.mode)}>{task.complete?'Revisit':'Start'} →</button></div>)}
   </section>
   <section className="missions-panel"><h2>Past seven days</h2><p>Activities are counted from recorded source events, not background timers or simulated achievements.</p><div className="mission-week">{week.map(d=><div className="mission-day" key={d.date}><div className="mission-bar-slot"><div className="mission-bar" style={{height:(d.activity?Math.max(6,Math.round(d.activity/maximum*100)):0)+'%'}}/></div><strong>{d.activity}</strong><span>{d.date.slice(5)}</span></div>)}</div><p className="missions-caveat">No penalty for skipped days. The display is local; tampering or clearing browser data changes the record.</p></section>
  </div>
  <section className="missions-panel"><h2>Personal achievements</h2><p>Participation milestones are observations about your saved history. They are not Wikimedia-issued credentials or educational mastery grades.</p>
   <div className="mission-achievements">{milestones.map(m=><div key={m.id} className={'mission-achievement '+(m.earned?'earned':'')}><div className="eyebrow">{m.earned?'LOCALLY RECORDED':'IN PROGRESS'}</div><strong>{m.name}</strong><p>{m.detail}</p><span>{m.count} / {m.target}</span><div className="mission-track" role="progressbar" aria-label={m.name} aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={m.count}><div style={{width:(100*m.count/m.target)+'%'}}/></div></div>)}</div>
  </section>
 </section>;
}
