import React,{useMemo,useRef,useState} from 'react';
import {compareSavedRevisions,contrastSavedRevisions,inspectSavedContrast,sourceSelection} from '../domain/offline-compare.mjs';
import './offline-compare.css';
type Article={language:string;pageId:number;revisionId:number;title:string};type Copy={key:string;article:Article;source:string;sections:string[]};
export default function OfflineCompare({sources,onKeepExcerpt,onOpenTopic}:{sources:Copy[];onKeepExcerpt:(v:{article:Article;excerpt:string})=>void;onOpenTopic:(a:Article)=>void}){
 const [first,setFirst]=useState(''),[second,setSecond]=useState(''),[query,setQuery]=useState(''),[round,setRound]=useState(0),[answer,setAnswer]=useState<number|null>(null),[message,setMessage]=useState(''),[positions,setPositions]=useState<[number,number]>([0,0]);
 const a=sources.find(x=>x.key===first)||sources[0],b=sources.find(x=>x.key===second&&x.key!==a.key)||sources.find(x=>x.key!==a.key);
 const refA=useRef<HTMLDivElement>(null),refB=useRef<HTMLDivElement>(null);
 const compare=useMemo(()=>b?compareSavedRevisions(a,b,query):null,[a,b,query]),prompt=useMemo(()=>b?contrastSavedRevisions(a,b,round):null,[a,b,round]);
 if(!b)return null;
 const copies=[a,b] as const;
 function select(side:number,key:string){if(side===0){setFirst(key);if(key===b.key)setSecond(a.key);}else setSecond(key);setPositions([0,0]);setAnswer(null);setRound(0);setMessage('');}
 function position(side:number,index:number){setPositions(old=>side===0?[index,old[1]]:[old[0],index]);}
 function clip(side:number){const selected=window.getSelection(),holder=side===0?refA.current:refB.current;
  if(!selected?.anchorNode||!selected.focusNode||!holder?.contains(selected.anchorNode)||!holder.contains(selected.focusNode)){setMessage('Select a passage inside this source first.');return;}
  try{onKeepExcerpt(sourceSelection(copies[side],selected.toString()));setMessage('Original-source excerpt saved to your existing local collection.');}catch(e:any){setMessage(e.message||'Invalid original-source selection');}}
 function respond(side:number){if(!prompt)return;try{const r=inspectSavedContrast(a,b,prompt,side);setAnswer(side);setMessage(r.matched?'Quotation found in this saved revision.':'Quotation found in the other saved revision.');position(r.source===a.source?0:1,r.section);}catch(e:any){setMessage(e.message||'Source verification failed');}}
 return <section className="offline-compare" aria-label="Compare offline original sources"><div className="eyebrow">SOURCE COMPARISON · NO NETWORK</div><h3>Compare two saved Wikipedia revisions</h3>
 <p>Independent original-language sources, <strong>not verified translations or equivalent topics</strong>. Only literal saved text is compared; no factual truth, mastery or score is inferred.</p>
 <label htmlFor="compare-search">Search both source copies</label><input id="compare-search" value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} placeholder="Exact source word or phrase"/>
 <div className="offline-compare-columns">{copies.map((copy,side)=><section key={side} className="offline-compare-source" aria-label={side===0?'First saved source':'Second saved source'}>
 <label htmlFor={'compare-source-'+side}>{side===0?'First':'Second'} source</label><select id={'compare-source-'+side} value={copy.key} onChange={e=>select(side,e.target.value)}>
 {sources.filter(s=>s.key===copy.key||s.key!==copies[1-side].key).map(s=><option key={s.key} value={s.key}>{s.article.language.toUpperCase()} · {s.article.title} · rev {s.article.revisionId}</option>)}</select>
 <p>{copy.article.language.toUpperCase()} · page {copy.article.pageId} · revision {copy.article.revisionId} · <a href={copy.source} target="_blank" rel="noreferrer">Source and contributors ↗</a></p>
 <p role="status">{query.trim()?(compare?.matches[side].length||0)+' matching passages':copy.sections.length+' saved passages'}</p>
 {!!query.trim()&&!!compare?.matches[side].length&&<div className="offline-compare-results">{compare.matches[side].map(hit=><button key={hit.index} onClick={()=>position(side,hit.index)}>Passage {hit.index+1}: {hit.excerpt}</button>)}</div>}
 <label htmlFor={'compare-passage-'+side}>Passage</label><select id={'compare-passage-'+side} value={Math.min(positions[side],copy.sections.length-1)} onChange={e=>position(side,Number(e.target.value))}>{copy.sections.map((_,i)=><option value={i} key={i}>{i+1} / {copy.sections.length}</option>)}</select>
 <div className="offline-compare-text" ref={side===0?refA:refB} lang={copy.article.language}><p>{copy.sections[Math.min(positions[side],copy.sections.length-1)]}</p></div><div className="offline-compare-actions"><button onClick={()=>clip(side)}>Keep selected excerpt</button><button onClick={()=>onOpenTopic(copy.article)}>Open this topic's notes</button></div></section>)}</div>
 <section className="offline-compare-quiz"><h4>Which source contains this exact quote?</h4><p>Literal evidence only; no grading or translation guesses.</p>{prompt?<><blockquote>{prompt.quote}</blockquote><div className="offline-compare-actions">{copies.map((x,i)=><button key={x.key} aria-pressed={answer===i} onClick={()=>respond(i)}>{x.article.language.toUpperCase()} · {x.article.title}</button>)}</div></>:<p>No uniquely attributable quote exists in the saved text.</p>}
 {message&&<p className="offline-compare-message" role="status">{message}</p>}<button disabled={!prompt||round>=100000} onClick={()=>{setRound(n=>n+1);setAnswer(null);setMessage('');}}>Another quote →</button></section>
 </section>;
}