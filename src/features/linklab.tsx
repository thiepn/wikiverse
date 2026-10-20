import React,{useEffect,useState,useRef,useMemo} from 'react';
import {STARTERS,revisionUrl} from '../domain/game.mjs';
import {sourceFailureAdvice} from '../services/wikimedia.mjs';
import {createLinkAudit,replayLinkAudit} from '../services/linklab.mjs';
import {gradeLinkAudit,recordLinkAudit,linkAuditNextHint,linkSetEvidence,buildLinkOriginAudit} from '../domain/linklab.mjs';
import './linklab.css';
type SourceArticle={language:string;pageId:number;revisionId:number;title:string};
export default function LinkLab({onComplete,onReadSource,onStudySource,onChooseSource,onReadCurrentLink,initialTopic='Mathematics',initialReview=null,focusArticle=null}:{onComplete:(entry:any)=>void;onReadSource?:(article:SourceArticle)=>void;onStudySource?:(article:SourceArticle)=>void;onChooseSource?:(article:SourceArticle)=>void;onReadCurrentLink?:(title:string,language:string)=>void;initialTopic?:string;initialReview?:any;focusArticle?:SourceArticle|null}){
 const [starter,setStarter]=useState(initialTopic),[round,setRound]=useState(0),[challenge,setChallenge]=useState<any>(null),[selected,setSelected]=useState<string|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[hint,setHint]=useState(false);
 const [exercise,setExercise]=useState<'outgoing'|'common'|'origin'>('outgoing');
 const [linkQuery,setLinkQuery]=useState(''),[linkFilter,setLinkFilter]=useState<'all'|'shared'|'primary'|'contrast'>('all'),[inspected,setInspected]=useState('');
 const [choiceCount,setChoiceCount]=useState<3|4|5>(4);
 const [replayed,setReplayed]=useState(false);
 const op=useRef(0);
 const evidence=useMemo(()=>challenge?.pages?.length===2?linkSetEvidence(challenge.pages[0],challenge.pages[1],{query:linkQuery,filter:linkFilter,limit:80}):null,[challenge,linkQuery,linkFilter]);
 const exactMembership=(title:string)=>challenge?.pages?.length===2?linkSetEvidence(challenge.pages[0],challenge.pages[1],{query:title,limit:120}).records.find(x=>x.title===title):null;
 const originChoiceLabel=(kind:string)=>kind==='shared'?'Both original revisions':kind==='primary'?'Only '+challenge?.question?.primary.title:kind==='contrast'?'Only '+challenge?.question?.contrast.title:kind;
 useEffect(()=>()=>{op.current++;},[]);
 useEffect(()=>{setStarter(initialTopic);setChallenge(null);setSelected(null);setInspected('');setLinkQuery('');},[initialTopic]);
 async function generate(n=round,title=starter){
  const id=++op.current;setBusy('Verifying both article revisions and their actual hyperlinks…');setError('');setSelected(null);setHint(false);
  try{const data=await createLinkAudit({start:title,seed:'source_link_'+title+'_'+n+'_choices_'+choiceCount,choices:choiceCount,sourceArticle:focusArticle?.title===title?focusArticle:null});if(op.current===id){setChallenge(data);setRound(n);setInspected('');setReplayed(false);setLinkQuery('');setLinkFilter('all');}}
  catch(e:any){if(op.current===id){setError(e.message||'No source-backed link challenge available');setChallenge(null);}}
  finally{if(op.current===id)setBusy('');}
 }
 function choose(value:string){
  if(!challenge||selected!==null)return;
  const active=exercise==='common'?challenge.common:exercise==='origin'?challenge.origin:challenge.question;
  if(!active)return;
  setSelected(value);onComplete(recordLinkAudit(active,value));
 }
 async function retryPinnedPair(){
  if(!challenge?.question)return;
  const n=++op.current;setBusy('Rechecking the same two original revisions…');setError('');setSelected(null);setHint(false);
  try{const data=await replayLinkAudit({article:challenge.question.primary,contrast:challenge.question.contrast});
   if(n===op.current){setChallenge(data);setReplayed(true);setExercise('outgoing');setInspected('');setLinkQuery('');setLinkFilter('all');}}
  catch(e:any){if(n===op.current)setError(e.message||'Pinned source comparison unavailable');}
  finally{if(n===op.current)setBusy('');}
 }
 async function replayReview(){
  if(!initialReview)return;
  const n=++op.current;setBusy('Reopening original pinned article revisions…');setError('');setSelected(null);setHint(false);
  try{
   const data=await replayLinkAudit(initialReview);
   if(op.current===n){setChallenge(data);setExercise(initialReview.questionKind==='wikipedia-link-origin'&&initialReview.subject&&data.origin?'origin':initialReview.questionKind==='wikipedia-outgoing-link'?'outgoing':initialReview.questionKind==='wikipedia-common-link'&&data.common?'common':initialReview.kind==='linklab'&&data.common?'common':'outgoing');setStarter(data.question.primary.title);setRound(0);setReplayed(true);setInspected('');setLinkQuery('');setLinkFilter('all');}
  }catch(e:any){if(op.current===n)setError(e.message||'Archived source could not be revalidated');}
  finally{if(op.current===n)setBusy('');}
 }
 function practiceInspectedLink(title:string){
  if(challenge?.pages?.length!==2)return;
  try{
   const seed='inspect:'+challenge.question.seed+':'+title;
   const origin=buildLinkOriginAudit(challenge.pages[0],challenge.pages[1],{seed,target:title});
   setChallenge((previous:any)=>({...previous,origin}));setExercise('origin');setSelected(null);setHint(false);setInspected(title);
  }catch(err:any){setError(err.message||'This original link cannot be used in a challenge');}
 }
 const q=exercise==='common'?challenge?.common:exercise==='origin'?challenge?.origin:challenge?.question;
 return <section className="linklab">
  <div className="mode-head"><h1>Link Lab</h1></div>
  {busy&&<div className="loading" role="status">{busy}</div>}
  {error&&<div className="error" role="alert">{error}<p>{sourceFailureAdvice(error).hint}</p><button onClick={()=>setError('')}>Dismiss</button></div>}
  {initialReview&&<div className="linklab-panel"><button disabled={!!busy} onClick={()=>void replayReview()}>Revisit original pinned link evidence →</button></div>}
  {focusArticle&&<div className="linklab-panel"><p>{focusArticle.title} · pinned English revision {focusArticle.revisionId}. Original questions reload this exact revision when the title is unchanged.</p></div>}
  <div className="linklab-panel"><label htmlFor="linklab-density">SOURCE-BASED CHOICE DENSITY</label><select id="linklab-density" value={choiceCount} onChange={e=>{setChoiceCount(Number(e.target.value) as 3|4|5);setChallenge(null);setSelected(null);}}><option value={3}>Guided · 3 source choices</option><option value={4}>Standard · 4 source choices</option><option value={5}>Dense · 5 source choices, if verified</option></select><p>Five-choice questions require enough distinct source links.</p></div>
  <div className="linklab-panel"><label htmlFor="linklab-start">STARTING ARTICLE</label><div className="linklab-tools"><input id="linklab-start" list="linklab-source-starters" maxLength={190} value={starter} onChange={e=>{setStarter(e.target.value);setChallenge(null);}} placeholder="Wikipedia article title"/><datalist id="linklab-source-starters">{STARTERS.map(x=><option key={x} value={x}/>)}</datalist><button className="primary" onClick={()=>void generate(0,starter)} disabled={!!busy}>Generate sourced question →</button></div></div>
  {challenge&&<div className="linklab-modes" role="group" aria-label="Question style"><button aria-pressed={exercise==='outgoing'} onClick={()=>{setExercise('outgoing');setSelected(null);setHint(false);}}>Which link belongs?</button><button aria-pressed={exercise==='common'} disabled={!challenge.common} onClick={()=>{setExercise('common');setSelected(null);setHint(false);}}>What do both link to?</button><button aria-pressed={exercise==='origin'} disabled={!challenge.origin} onClick={()=>{setExercise('origin');setSelected(null);setHint(false);}}>Which source links to it?</button>{!challenge.common&&<span>No source-backed common-link question for this pair.</span>}</div>}
  {q&&<><div className="linklab-sources"><div><span className="eyebrow">QUESTION ARTICLE · PAGE {q.primary.pageId}</span><h2>{q.primary.title}</h2><a target="_blank" rel="noreferrer" href={revisionUrl(q.primary)}>Read exact source revision {q.primary.revisionId} ↗</a><div className="linklab-source-actions">{onReadSource&&<button onClick={()=>onReadSource(q.primary)}>Read pinned revision →</button>}{onStudySource&&<button onClick={()=>onStudySource(q.primary)}>Study source →</button>}{onChooseSource&&<button onClick={()=>onChooseSource(q.primary)}>Connect topic →</button>}</div></div><div><span className="eyebrow">DISTRACTOR ARTICLE · PAGE {q.contrast.pageId}</span><h2>{q.contrast.title}</h2><a target="_blank" rel="noreferrer" href={revisionUrl(q.contrast)}>Inspect alternate revision {q.contrast.revisionId} ↗</a><div className="linklab-source-actions">{onReadSource&&<button onClick={()=>onReadSource(q.contrast)}>Read pinned revision →</button>}{onStudySource&&<button onClick={()=>onStudySource(q.contrast)}>Study source →</button>}{onChooseSource&&<button onClick={()=>onChooseSource(q.contrast)}>Connect topic →</button>}</div></div></div>
   <div className="linklab-panel"><div className="eyebrow">ROUND {round+1} · {replayed?'ARCHIVED SOURCE REVIEW':exercise==='origin'?'SOURCE MEMBERSHIP':'ORIGINAL SOURCE LINKS'}</div><h2>{q.kind==='wikipedia-link-origin'?'Which pinned source links to '+q.subject+'?':q.kind==='wikipedia-common-link'?'Which topic is linked by both articles?':'Which topic is linked from '+q.primary.title+'?'}</h2>
    <div className="linklab-choices">{q.choices.map((value:string)=><button disabled={selected!==null} className={selected===value?'selected':''} key={value} onClick={()=>choose(value)}>{q.kind==='wikipedia-link-origin'?originChoiceLabel(value):value}</button>)}</div>
    {selected===null?<button className="linklab-hint" onClick={()=>setHint(v=>!v)}>{hint?'Hide source hint':'Show source hint'}</button>:<div className="linklab-result" role="status"><strong>{gradeLinkAudit(q,selected)?'Correct source classification.':'Incorrect source classification.'}</strong><p>{q.kind==='wikipedia-link-origin'?'Original link: '+q.subject+' · '+originChoiceLabel(q.answer):(q.kind==='wikipedia-common-link'?'Shared source title: ':'Original outgoing link: ')+q.answer}</p>
     <div className="linklab-answer-evidence"><h3>Original hyperlink evidence</h3>{(q.kind==='wikipedia-link-origin'?[q.subject]:q.choices).map((title:string)=>{
       const record=exactMembership(title);return <div key={title}><strong>{title}</strong><span>{record?.primaryHasLink?'In '+q.primary.title:'Not in '+q.primary.title}</span><span>{record?.contrastHasLink?'In '+q.contrast.title:'Not in '+q.contrast.title}</span></div>;
      })}<div className="linklab-original-links"><a href={revisionUrl(q.primary)} target="_blank" rel="noreferrer">First pinned revision ↗</a><a href={revisionUrl(q.contrast)} target="_blank" rel="noreferrer">Second pinned revision ↗</a></div></div><button onClick={()=>void generate(round+1)} disabled={!!busy}>Another source question →</button><button disabled={!!busy} onClick={()=>void retryPinnedPair()}>Replay pinned source pair →</button></div>}
    {hint&&selected===null&&<p className="linklab-hint-text">{linkAuditNextHint(q)} Use the old-revision source link above.</p>}
   </div>
   {evidence&&<section className="linklab-panel linklab-inspector" aria-label="Pinned original hyperlink investigation"><div className="linklab-inspector-head"><h2>Inspect original article links</h2><span>{evidence.counts.all} distinct recorded titles</span></div>
     <div className="linklab-linkcounts"><button aria-pressed={linkFilter==='all'} onClick={()=>setLinkFilter('all')}>All ({evidence.counts.all})</button><button aria-pressed={linkFilter==='shared'} onClick={()=>setLinkFilter('shared')}>Both ({evidence.counts.shared})</button><button aria-pressed={linkFilter==='primary'} onClick={()=>setLinkFilter('primary')}>{q.primary.title} only ({evidence.counts.primary})</button><button aria-pressed={linkFilter==='contrast'} onClick={()=>setLinkFilter('contrast')}>{q.contrast.title} only ({evidence.counts.contrast})</button></div>
     <label htmlFor="linklab-find">Find original hyperlink title</label><input type="search" id="linklab-find" maxLength={100} value={linkQuery} onChange={event=>{setLinkQuery(event.target.value);setInspected('');}} placeholder="Search source links"/>
     <p>{evidence.shown} of {evidence.matching} matching titles shown{evidence.truncated?' (remaining results not displayed)':''}</p>
     <div className="linklab-link-set">{evidence.records.length?evidence.records.map(record=><div key={record.title} className={inspected===record.title?'active':''}><button className="linklab-inspect-title" aria-pressed={inspected===record.title} onClick={()=>setInspected(record.title)}>{record.title}</button><span>{record.category==='shared'?'In both original revisions':record.category==='primary'?'Only '+q.primary.title:'Only '+q.contrast.title}</span><button disabled={!!busy} onClick={()=>practiceInspectedLink(record.title)}>Practice this link →</button></div>):<p>No source hyperlinks match these filters.</p>}</div>
     {inspected&&(()=>{const row=exactMembership(inspected);return row?<div className="linklab-inspected" role="status"><h3>{row.title}</h3><p>{row.primaryHasLink?'Linked':'Not linked'} in {q.primary.title} · {row.contrastHasLink?'Linked':'Not linked'} in {q.contrast.title}.</p>
       <div className="linklab-source-actions"><a href={revisionUrl(q.primary)} target="_blank" rel="noreferrer">First original evidence ↗</a><a href={revisionUrl(q.contrast)} target="_blank" rel="noreferrer">Second original evidence ↗</a>{onReadCurrentLink&&<button onClick={()=>onReadCurrentLink(row.title,q.primary.language)}>Read current linked article →</button>}</div></div>:null;})()}
   </section>}
   <p className="linklab-fine">Wikipedia text and links: original revisions and contributors · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · device-only unranked practice.</p>
  </>}
 </section>;
}
