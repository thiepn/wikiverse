import React,{useEffect,useState,useRef} from 'react';
import {STARTERS,revisionUrl} from '../domain/game.mjs';
import {createLinkAudit,replayLinkAudit} from '../services/linklab.mjs';
import {gradeLinkAudit,recordLinkAudit,linkAuditNextHint} from '../domain/linklab.mjs';
import './linklab.css';
export default function LinkLab({onComplete,initialTopic='Mathematics',initialReview=null}:{onComplete:(entry:any)=>void;initialTopic?:string;initialReview?:any}){
 const [starter,setStarter]=useState(initialTopic),[round,setRound]=useState(0),[challenge,setChallenge]=useState<any>(null),[selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[hint,setHint]=useState(false);
 const [exercise,setExercise]=useState<'outgoing'|'common'>('outgoing');
 const [replayed,setReplayed]=useState(false);
 const op=useRef(0);
 useEffect(()=>()=>{op.current++;},[]);
 useEffect(()=>{setStarter(initialTopic);setChallenge(null);setSelected(null);},[initialTopic]);
 async function generate(n=round,title=starter){
  const id=++op.current;setBusy('Verifying both article revisions and their actual hyperlinks…');setError('');setSelected(null);setHint(false);
  try{const data=await createLinkAudit({start:title,seed:'source_link_'+title+'_'+n});if(op.current===id){setChallenge(data);setRound(n);}}
  catch(e:any){if(op.current===id){setError(e.message||'No source-backed link challenge available');setChallenge(null);}}
  finally{if(op.current===id)setBusy('');}
 }
 function choose(value:string){
  if(!challenge||selected!==null)return;
  const active=exercise==='common'?challenge.common:challenge.question;
  if(!active)return;
  setSelected(value);onComplete(recordLinkAudit(active,value));
 }
 async function replayReview(){
  if(!initialReview)return;
  const n=++op.current;setBusy('Reopening original pinned article revisions…');setError('');setSelected(null);setHint(false);
  try{
   const data=await replayLinkAudit(initialReview);
   if(op.current===n){setChallenge(data);setExercise(initialReview.kind==='linklab'&&data.common?'common':'outgoing');setStarter(data.question.primary.title);setRound(0);setReplayed(true);}
  }catch(e:any){if(op.current===n)setError(e.message||'Archived source could not be revalidated');}
  finally{if(op.current===n)setBusy('');}
 }
 const q=exercise==='common'?challenge?.common:challenge?.question;
 return <section className="linklab">
  <div className="mode-head"><div className="eyebrow">14 / SOURCE-BASED READING GAME</div><h1>Link Lab<span className="accent">.</span></h1><p>Find an outbound link that actually appears in a pinned Wikipedia article. Incorrect choices are real links from a different Wikipedia article, checked against the question article.</p></div>
  {busy&&<div className="loading" role="status">{busy}</div>}
  {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
  {initialReview&&<div className="linklab-panel"><div className="eyebrow">STUDY DESK / ORIGINAL REVISION REVIEW</div><p>Re-open the previously missed source pair at its pinned revisions. New practice questions are generated only after verifying the archived identities; this does not overwrite the previous grade.</p><button disabled={!!busy} onClick={()=>void replayReview()}>Revisit original pinned link evidence →</button></div>}
  <div className="linklab-panel"><label htmlFor="linklab-start">STARTING ARTICLE</label><div className="linklab-tools"><input id="linklab-start" list="linklab-source-starters" maxLength={190} value={starter} onChange={e=>{setStarter(e.target.value);setChallenge(null);}} placeholder="Wikipedia article title"/><datalist id="linklab-source-starters">{STARTERS.map(x=><option key={x} value={x}/>)}</datalist><button className="primary" onClick={()=>void generate(0,starter)} disabled={!!busy}>Generate sourced question →</button></div></div>
  {challenge&&<div className="linklab-modes" role="group" aria-label="Question style"><button aria-pressed={exercise==='outgoing'} onClick={()=>{setExercise('outgoing');setSelected(null);setHint(false);}}>Which link belongs?</button><button aria-pressed={exercise==='common'} disabled={!challenge.common} onClick={()=>{setExercise('common');setSelected(null);setHint(false);}}>What do both link to?</button>{!challenge.common&&<span>No source-backed common-link question for this pair.</span>}</div>}
  {q&&<><div className="linklab-sources"><div><span className="eyebrow">QUESTION ARTICLE · PAGE {q.primary.pageId}</span><h2>{q.primary.title}</h2><a target="_blank" rel="noreferrer" href={revisionUrl(q.primary)}>Read exact source revision {q.primary.revisionId} ↗</a></div><div><span className="eyebrow">DISTRACTOR ARTICLE · PAGE {q.contrast.pageId}</span><h2>{q.contrast.title}</h2><a target="_blank" rel="noreferrer" href={revisionUrl(q.contrast)}>Inspect alternate revision {q.contrast.revisionId} ↗</a></div></div>
   <div className="linklab-panel"><div className="eyebrow">ROUND {round+1} · {replayed?'ARCHIVED SOURCE REVIEW':'SOURCE OUTGOING LINK'}</div><h2>{q.kind==='wikipedia-common-link'?'Which topic is linked by both articles?':'Which topic is linked from '+q.primary.title+'?'}</h2><p>{q.kind==='wikipedia-common-link'?'One title is in both original link lists. Other choices are real titles linked from only one of the two revisions.':'Only one listed title occurs in the source article’s outgoing links. The distractors come from a separate real revision.'}</p>
    <div className="linklab-choices">{q.choices.map((value:string)=><button disabled={selected!==null} className={selected===value?'selected':''} key={value} onClick={()=>choose(value)}>{value}</button>)}</div>
    {selected===null?<button className="linklab-hint" onClick={()=>setHint(v=>!v)}>{hint?'Hide source hint':'Show source hint'}</button>:<div className="linklab-result" role="status"><strong>{gradeLinkAudit(q,selected)?'Correct recorded hyperlink.':'Not linked from this revision.'}</strong><p>{q.kind==='wikipedia-common-link'?'Verified shared title':'Verified outgoing link'}: <b>{q.answer}</b>. This result checks source link membership, not historical or scientific truth.</p><button onClick={()=>void generate(round+1)} disabled={!!busy}>Another source question →</button></div>}
    {hint&&selected===null&&<p className="linklab-hint-text">{linkAuditNextHint(q)} Use the old-revision source link above.</p>}
   </div>
   <p className="linklab-fine">Wikipedia content attribution: original revision links and contributors on Wikipedia · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>. Answers are unranked and stored only on this device.</p>
  </>}
 </section>;
}
