import React,{useEffect,useMemo,useState} from 'react';
import {searchSavedSource,sourceLocator,inspectLocator,sourceSequence,inspectSequence,sourceSelection} from '../domain/offline-workbench.mjs';
import './offline-workbench.css';
type Saved={key:string;article:{language:string;pageId:number;revisionId:number;title:string};source:string;sections:string[]};
type Props={snapshot:Saved;onKeepExcerpt:(x:{article:Saved['article'];excerpt:string})=>void;onOpenTopic:(article:Saved['article'])=>void};
export default function OfflineWorkbench({snapshot,onKeepExcerpt,onOpenTopic}:Props){
 const [query,setQuery]=useState(''),[section,setSection]=useState(0),[activity,setActivity]=useState<'locate'|'sequence'>('locate'),[round,setRound]=useState(0),[chosen,setChosen]=useState<number|null>(null),[order,setOrder]=useState<number[]>([]),[answer,setAnswer]=useState(''),[notice,setNotice]=useState('');
 const matches=useMemo(()=>searchSavedSource(snapshot,query),[snapshot,query]);
 const locator=useMemo(()=>sourceLocator(snapshot,round),[snapshot,round]);
 const sequence=useMemo(()=>sourceSequence(snapshot,round),[snapshot,round]);
 useEffect(()=>{setOrder(sequence?.shuffled||[]);setAnswer('');setChosen(null);},[snapshot.source,round,activity]);
 const current=Math.max(0,Math.min(section,snapshot.sections.length-1)),paragraph=snapshot.sections[current];
 function openSection(index:number){setSection(index);setNotice('');}
 function next(){setRound(r=>r+1);setAnswer('');setChosen(null);}
 function inspectChoice(index:number){if(!locator)return;try{const x=inspectLocator(snapshot,locator,index);setChosen(index);setAnswer(x.matched?'The quotation belongs to passage '+(x.section+1)+'.':'Not this passage. The saved quotation belongs to passage '+(x.section+1)+'.');setSection(x.section);}catch(e:any){setAnswer(e.message||'Cannot check original source');}}
 function inspectOrder(){if(!sequence)return;try{const x=inspectSequence(snapshot,sequence,order);setAnswer(x.matched?'Matches the original saved passage order.':'This is not the original saved passage order. Use the numbered original passages to check.');}catch(e:any){setAnswer(e.message||'Cannot check paragraph order');}}
 function move(index:number,direction:number){const target=index+direction;if(target<0||target>=order.length)return;setOrder(x=>{const result=[...x];[result[index],result[target]]=[result[target],result[index]];return result;});setAnswer('');}
 function keepSelection(){try{const selection=window.getSelection()?.toString()||'';onKeepExcerpt(sourceSelection(snapshot,selection));setNotice('Sent selected original-source excerpt to the existing local collection. Open its topic to review it.');}catch(e:any){setNotice(e.message||'Select text within one saved paragraph');}}
 const highlight=(value:string)=>{
  const term=query.trim(),at=term?value.toLocaleLowerCase(snapshot.article.language).indexOf(term.toLocaleLowerCase(snapshot.article.language)):-1;
  return at<0?value:<>{value.slice(0,at)}<mark>{value.slice(at,at+term.length)}</mark>{value.slice(at+term.length)}</>;
 };
 return <section className="offline-workbench" aria-label="Original-source study workbench" lang={snapshot.article.language}>
  <header><div className="eyebrow">ORIGINAL-SOURCE WORKBENCH · {snapshot.article.language.toUpperCase()} · REV {snapshot.article.revisionId}</div><h4>Find evidence and restore reading order</h4><p>Practice checks saved text only; it does not assess factual truth or proficiency.</p></header>
  <div className="offline-workbench-grid">
   <div className="offline-workbench-search"><label htmlFor="saved-source-search">Search this saved text</label><input id="saved-source-search" value={query} onChange={e=>setQuery(e.target.value.slice(0,100))} placeholder="Word or exact phrase" autoComplete="off"/>
    <p className="offline-workbench-hint" role="status">{query.trim()?matches.length+' matching saved passages':'Search within the saved '+snapshot.sections.length+' passages'}</p>
    {matches.length>0&&<div className="offline-match-list">{matches.map(x=><button key={x.index} onClick={()=>openSection(x.index)}>Passage {x.index+1}: {x.excerpt}</button>)}</div>}
    <div className="offline-workbench-nav"><button disabled={current===0} onClick={()=>openSection(current-1)}>← Previous</button><label htmlFor="saved-source-section">Passage</label><select id="saved-source-section" value={current} onChange={e=>openSection(Number(e.target.value))}>{snapshot.sections.map((_,i)=><option key={i} value={i}>{i+1} / {snapshot.sections.length}</option>)}</select><button disabled={current===snapshot.sections.length-1} onClick={()=>openSection(current+1)}>Next →</button></div>
    <div className="offline-workbench-paragraph" aria-live="polite"><strong>Saved passage {current+1} of {snapshot.sections.length}</strong><p>{highlight(paragraph)}</p></div>
    <div className="offline-workbench-keep"><button onClick={keepSelection}>Keep selected text as source excerpt</button><button onClick={()=>onOpenTopic(snapshot.article)}>Open article notes →</button></div>
    {notice&&<p className="offline-workbench-hint" role="status">{notice}</p>}
   </div>
   <div className="offline-workbench-practice"><div className="offline-workbench-mode" role="group" aria-label="Original-source practice"><button aria-pressed={activity==='locate'} onClick={()=>{setActivity('locate');setAnswer('');}}>Locate a quotation</button><button aria-pressed={activity==='sequence'} onClick={()=>{setActivity('sequence');setAnswer('');}}>Restore passage order</button></div>
    {activity==='locate'&&(locator?<><h5>Where does this exact quote appear?</h5><blockquote>{locator.quote}</blockquote><div className="offline-workbench-options">{locator.choices.map((index:number)=><button key={index} aria-pressed={chosen===index} onClick={()=>inspectChoice(index)}>Passage {index+1}</button>)}</div></>:<p>Save at least two distinct, text-rich passages from an original article to use quote-location practice.</p>)}
    {activity==='sequence'&&(sequence?<><h5>Put these original passages in source order</h5><p>Reorder these shortened excerpts to match the source.</p><ol className="offline-workbench-order">{order.map((idx,i)=><li key={idx}><span><strong>Card {idx+1}</strong> · {snapshot.sections[idx].slice(0,105)}…</span><div><button disabled={i===0} aria-label={'Move card '+(idx+1)+' up'} onClick={()=>move(i,-1)}>↑</button><button disabled={i===order.length-1} aria-label={'Move card '+(idx+1)+' down'} onClick={()=>move(i,1)}>↓</button></div></li>)}</ol><button onClick={inspectOrder}>Check saved source order</button></>:<p>Save three original paragraphs to use source-order practice.</p>)}
    {answer&&<div className="offline-workbench-feedback" role="status"><p>{answer}</p><button onClick={()=>{if(locator&&activity==='locate')openSection(locator.target);else if(sequence)openSection(sequence.indices[0]);}}>Inspect original passages</button></div>}
    <div className="offline-workbench-footer"><button onClick={next}>Another source prompt →</button><a href={snapshot.source} target="_blank" rel="noreferrer">Open original revision and authors ↗</a></div>
   </div>
  </div>
 </section>;
}
