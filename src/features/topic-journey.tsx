import React from 'react';
import {sourceRevisionUrl} from '../domain/study.mjs';
type Article={language:string;pageId:number;revisionId:number;title:string};
const modes=[['galaxy','Knowledge Galaxy'],['geo','GeoWiki'],['chronicle','WikiChronicle'],['polyglot','WikiPolyglot'],['race','WikiRace'],['linklab','Link Lab'],['study','Study Desk']];
export default function TopicJourney({source,onGo,onClear}:{source:Article;onGo:(mode:string)=>void;onClear:()=>void}){
 const englishOnly=new Set(['race','linklab']);
 return <section className="topic-journey" aria-label="Connected topic journey">
 <div className="topic-journey-head"><div><span className="eyebrow">SELECTED ORIGINAL SOURCE · LOCAL SESSION</span><h2>{source.title}</h2><p>{source.language.toUpperCase()} Wikipedia · Page {source.pageId} · Revision {source.revisionId}. Follow this source into other modes. New exercises use their own verified material, not inherited grades.</p></div><div className="topic-journey-links"><a href={sourceRevisionUrl(source)} target="_blank" rel="noreferrer">Pinned original & contributors ↗</a><button onClick={()=>onGo('discover')}>Reopen exact revision →</button><button onClick={onClear}>Clear selected topic</button></div></div>
 <div className="topic-journey-actions" role="group" aria-label="Explore selected topic in another mode">{modes.map(([id,title])=><button key={id} disabled={englishOnly.has(id)&&source.language!=='en'} title={englishOnly.has(id)&&source.language!=='en'?'English Wikipedia required':undefined} onClick={()=>onGo(id)}>{title} →</button>)}</div>
 <p className="topic-journey-caveat">GeoWiki and WikiChronicle show the selected item’s coordinate or date only if its current Wikidata item has suitable original statements. Otherwise the independent original catalog remains available.</p>
 </section>;
}