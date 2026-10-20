import React,{useEffect,useMemo,useState} from 'react';
import {galaxyForTitle,galaxyForQid,loadGeoCatalog,loadChronicle,loadChronicleStatements,topicWikidataEvidence,verifiedGalaxyWikipedia,geoPlaceRelations} from '../services/exploration.mjs';
import {searchArticles} from '../services/wikimedia.mjs';
import {mapPoint,geoProject,geoPlacesInView,geoView,GEO_VIEWS,geoNearPlaces,geoLatitudeChallenge,chronologicalOrder,shuffleDeterministic,isCorrectOrder,changeOrder,CHRONICLE_PROPERTIES,chronicleVisible,chroniclePropertyCounts,chronicleExtremeChallenge,GALAXY_FACETS,galaxyVisibleEdges,galaxyPropertyCounts,galaxyTrailAppend} from '../domain/exploration.mjs';
import {sourceRelationQuestion,gradeRelationQuestion,knowledgeResult} from '../domain/knowledge.mjs';
import './exploration.css';
type Mode='galaxy'|'geo'|'chronicle';
type Article={language:string;pageId:number;revisionId:number;title:string};
type Edge={from:string;to:string;title:string;property:string;label:string;sourceUrl:string;claimId?:string|null};
type Crumb={id:string;title:string;via:string;property:string;statement:string};
type Galaxy={root:{id:string;title:string;description:string;sourceUrl:string};edges:Edge[];groups:{property:string;label:string;count:number}[]};
type Place={qid:string;title:string;articleTitle:string;latitude:number;longitude:number;sourceUrl:string;precision?:number|null;entityUrl?:string};
type GeoRelation={from:string;to:string;label:string;property:string;sourceUrl:string;title:string};
type Fact={qid:string;title:string;articleTitle:string;year:number;type:string;sourceUrl:string;property:string};
type ChronoRecord={id:string;qid:string;title:string;articleTitle?:string;year:number;type:string;property:string;sourceUrl:string;precision:number;month:number|null;day:number|null;claimId:string|null;calendar:string};
type Result={mode:Mode;title:string;score:number;at:string;source:string};
export default function Exploration({mode,focusArticle,initialQid,onExploreQid,onRead,onReadSource,onComplete,onKnowledge}:{mode:Mode;focusArticle?:Article|null;initialQid?:string|null;onExploreQid?:(qid:string)=>void;onRead:(title:string)=>void;onReadSource:(article:Article)=>void;onComplete:(result:Result)=>void;onKnowledge:(result:any)=>void}){
 const [busy,setBusy]=useState('');const [error,setError]=useState('');
 const [focusEvidence,setFocusEvidence]=useState<any>(null);const [focusError,setFocusError]=useState('');
 const [galaxy,setGalaxy]=useState<Galaxy|null>(null);const [trail,setTrail]=useState<Crumb[]>([]);const [topic,setTopic]=useState('Marie Curie');const [matches,setMatches]=useState<{title:string;pageId:number}[]>([]);const [filter,setFilter]=useState('all');
 const [facet,setFacet]=useState('all'),[edgeQuery,setEdgeQuery]=useState(''),[selectedKey,setSelectedKey]=useState(''),[nodePage,setNodePage]=useState(0);
 const [places,setPlaces]=useState<Place[]>([]);const [place,setPlace]=useState<Place|null>(null);const [geoQuiz,setGeoQuiz]=useState(false);const [round,setRound]=useState(0);const [geoAnswer,setGeoAnswer]=useState<boolean|null>(null);
 const [geoViewId,setGeoViewId]=useState('world'),[geoSearch,setGeoSearch]=useState(''),[geoKind,setGeoKind]=useState<'locate'|'latitude'>('locate'),[geoDirection,setGeoDirection]=useState<'north'|'south'>('north'),[geoDensity,setGeoDensity]=useState<3|4>(3);
 const [geoRelations,setGeoRelations]=useState<GeoRelation[]>([]),[geoRelationError,setGeoRelationError]=useState(''),[geoRelationBusy,setGeoRelationBusy]=useState(false);
 const [facts,setFacts]=useState<Fact[]>([]);const [ordered,setOrdered]=useState<Fact[]>([]);const [chronoQuiz,setChronoQuiz]=useState(false);const [chronoAnswer,setChronoAnswer]=useState<boolean|null>(null);
 const [chronoRecords,setChronoRecords]=useState<ChronoRecord[]>([]),[chronoProperty,setChronoProperty]=useState('all'),[chronoSearch,setChronoSearch]=useState(''),[chronoFrom,setChronoFrom]=useState(''),[chronoTo,setChronoTo]=useState(''),[chronoSelected,setChronoSelected]=useState<string|null>(null);
 const [chronoExtreme,setChronoExtreme]=useState(false),[chronoDirection,setChronoDirection]=useState<'earliest'|'latest'>('earliest'),[chronoCount,setChronoCount]=useState<3|4>(3),[chronoRound,setChronoRound]=useState(0),[chronoExtremeChoice,setChronoExtremeChoice]=useState<string|null>(null);
 const [relationRound,setRelationRound]=useState(0),[relationChoice,setRelationChoice]=useState<string|null>(null);
 const relationQuiz=useMemo(()=>sourceRelationQuestion(galaxy,relationRound),[galaxy,relationRound]);
 const visibleChrono=useMemo(()=>chronicleVisible(chronoRecords,{property:chronoProperty,query:chronoSearch,fromYear:chronoFrom&&Number(chronoFrom)>=1?Number(chronoFrom):null,toYear:chronoTo&&Number(chronoTo)>=1?Number(chronoTo):null}) as ChronoRecord[],[chronoRecords,chronoProperty,chronoSearch,chronoFrom,chronoTo]);
 const sourceTopicDates=useMemo(()=>mode==='chronicle'&&Array.isArray(focusEvidence?.dates)?chronicleVisible(focusEvidence.dates) as ChronoRecord[]:[],[mode,focusEvidence]);
 const chosenChrono=visibleChrono.find(x=>x.id===chronoSelected)||visibleChrono[0]||null;
 const chronoExtremeQuestion=useMemo(()=>{try{return chronicleExtremeChallenge(visibleChrono,'wikiverse-w06:'+chronoRound+':'+chronoDirection+':'+chronoCount,{direction:chronoDirection,count:chronoCount});}catch{return null;}},[visibleChrono,chronoRound,chronoDirection,chronoCount]);
 const extremeOutcome=chronoExtremeQuestion&&chronoExtremeChoice!==null?chronoExtremeChoice===chronoExtremeQuestion.answer.id:null;
 const topicCoordinate=useMemo(()=>mode==='geo'&&focusEvidence?.coordinate&&focusArticle?{...focusEvidence.coordinate,title:focusArticle.title,articleTitle:focusArticle.title}:null,[mode,focusEvidence,focusArticle]);
 const visibleAtlas=useMemo(()=>geoPlacesInView([...places,...(topicCoordinate?[topicCoordinate]:[])],geoViewId,geoSearch) as Place[],[places,topicCoordinate,geoViewId,geoSearch]);
 const visibleGamePlaces=useMemo(()=>geoPlacesInView(places,geoViewId,geoSearch) as Place[],[places,geoViewId,geoSearch]);
 const target=visibleGamePlaces.length?visibleGamePlaces[round%visibleGamePlaces.length]:null;
 const latitudeQuiz=useMemo(()=>{try{return geoLatitudeChallenge(visibleGamePlaces,'geowiki-w05:'+geoViewId+':'+geoDirection+':'+round,{direction:geoDirection,count:geoDensity});}catch{return null;}},[visibleGamePlaces,geoViewId,geoDirection,geoDensity,round]);
 const nearPlaces=useMemo(()=>{try{return place?geoNearPlaces(place,[...places,...(topicCoordinate?[topicCoordinate]:[])],3):[];}catch{return [];}},[place,places,topicCoordinate]);
 const edges=useMemo(()=>galaxyVisibleEdges(galaxy,{facet,property:filter,query:edgeQuery}) as Edge[],[galaxy,facet,filter,edgeQuery]);
 const selectedEdge=edges.find(x=>x.property+':'+x.to===selectedKey)||edges[0]||null;
 const pageEdges=edges.slice(nodePage*8,(nodePage+1)*8);
 const pageCount=Math.max(1,Math.ceil(edges.length/8));
 useEffect(()=>{setNodePage(0);setSelectedKey('');},[galaxy,facet,filter,edgeQuery]);
 useEffect(()=>{
   let active=true;setError('');
   async function load(){setBusy('Retrieving source-backed knowledge…');try{
     if(mode==='galaxy'&&!focusArticle){const g=initialQid?await galaxyForQid(initialQid):await galaxyForTitle('Marie Curie');if(active)setGalaxy(g);}
     if(mode==='geo'){const g=await loadGeoCatalog();if(active){setPlaces(g);setPlace(g[0]);}}
     if(mode==='chronicle'){const [c,records]=await Promise.all([loadChronicle(),loadChronicleStatements()]);if(active){setFacts(c);setChronoRecords(records as ChronoRecord[]);setOrdered(shuffleDeterministic(c.slice(0,5),String(Date.now())));}}
   }catch(e:any){if(active)setError(e.message||'Source unavailable');}finally{if(active)setBusy('');}}
   void load();return()=>{active=false;};
 },[mode,initialQid,focusArticle?.language,focusArticle?.pageId,focusArticle?.revisionId]);
 useEffect(()=>{let active=true;setFocusEvidence(null);setFocusError('');const selectedSource=focusArticle;if(!selectedSource)return;
   async function inspect(source:Article){try{
     const evidence=await topicWikidataEvidence(source);if(!active)return;setFocusEvidence(evidence);
     if(mode==='galaxy'){const graph=await galaxyForQid(evidence.qid);if(active){setGalaxy(graph);setTopic(source.title);setFilter('all');setFacet('all');setEdgeQuery('');setTrail([]);setRelationRound(0);setRelationChoice(null);}}
   }catch(e:any){if(active)setFocusError(e.message||'No evidence for this source');}}
   void inspect(selectedSource);return()=>{active=false;};
 },[mode,focusArticle?.language,focusArticle?.pageId,focusArticle?.revisionId]);
 useEffect(()=>{setGeoAnswer(null);setRound(0);setPlace(null);},[geoViewId,geoSearch,geoDirection,geoDensity]);
 useEffect(()=>{let active=true;setGeoRelations([]);setGeoRelationError('');if(mode!=='geo'||!place)return;
  setGeoRelationBusy(true);
  geoPlaceRelations(place.qid).then(items=>{if(active)setGeoRelations(items as GeoRelation[]);}).catch((err:any)=>{if(active)setGeoRelationError(err.message||'Original relationship evidence unavailable');}).finally(()=>{if(active)setGeoRelationBusy(false);});
  return()=>{active=false;};
 },[mode,place?.qid]);
 useEffect(()=>{if(mode!=='galaxy'||topic.trim().length<3){setMatches([]);return;}let active=true;const timer=setTimeout(()=>searchArticles(topic).then(x=>{if(active)setMatches(x.slice(0,6));}).catch(()=>{if(active)setMatches([]);}),350);return()=>{active=false;clearTimeout(timer);};},[mode,topic]);
 async function loadGalaxy(titleOrId:string,byId=false,via?:Edge){if(busy)return;setBusy('Expanding verified relationships…');setError('');try{
   const nextTrail=byId&&galaxy?galaxyTrailAppend(trail,galaxy,via||galaxy.edges.find(x=>x.to===titleOrId)):[] as Crumb[];
   const x=byId?await galaxyForQid(titleOrId):await galaxyForTitle(titleOrId);
   setTrail(nextTrail);setGalaxy(x);setFilter('all');setFacet('all');setEdgeQuery('');setMatches([]);setRelationRound(0);setRelationChoice(null);
 }catch(e:any){setError(e.message||'Unable to retrieve the source entity');}finally{setBusy('');}}
 async function jumpTo(index:number){if(busy||index<0||index>=trail.length)return;
  setBusy('Reopening original Wikidata trail…');setError('');
  try{const g=await galaxyForQid(trail[index].id);setGalaxy(g);setTrail(t=>t.slice(0,index));setFilter('all');setFacet('all');setEdgeQuery('');setRelationRound(0);setRelationChoice(null);}
  catch(e:any){setError(e.message||'Prior Wikidata item unavailable');}finally{setBusy('');}}
 async function back(){if(trail.length)await jumpTo(trail.length-1);}
 async function openArticle(qid:string){
  if(busy)return;setBusy('Verifying Wikidata sitelink and original Wikipedia identity…');setError('');
  try{const linked=await verifiedGalaxyWikipedia(qid);onReadSource(linked.article);}
  catch(e:any){setError(e.message||'No confirmed Wikipedia article exists for this item');}
  finally{setBusy('');}
 }
 function choosePlace(p:Place){
  if(!geoQuiz){setPlace(p);return;}
  if(geoKind!=='locate'||geoAnswer!==null||!target||!visibleGamePlaces.some(x=>x.qid===p.qid))return;
  const correct=p.qid===target.qid;setGeoAnswer(correct);setPlace(p);
  if(correct)onComplete({mode:'geo',title:'Located '+target.title,score:100,at:new Date().toISOString(),source:target.sourceUrl});
 }
 function chooseLatitude(p:Place){
  if(!geoQuiz||geoKind!=='latitude'||geoAnswer!==null||!latitudeQuiz||!latitudeQuiz.options.some(x=>x.qid===p.qid))return;
  const correct=p.qid===latitudeQuiz.answer.qid;setGeoAnswer(correct);setPlace(p);
  if(correct)onComplete({mode:'geo',title:'Original P625 latitude comparison: '+latitudeQuiz.answer.title,score:100,at:new Date().toISOString(),source:latitudeQuiz.answer.sourceUrl});
 }
 function startGeo(kind:'locate'|'latitude'){setGeoKind(kind);setGeoQuiz(true);setRound(0);setGeoAnswer(null);setPlace(null);}
 function advanceGeo(){setRound(x=>x+1);setGeoAnswer(null);setPlace(null);}
 function chronoStart(){setChronoQuiz(true);setChronoExtreme(false);setChronoAnswer(null);setOrdered(shuffleDeterministic(facts.slice(0,Math.min(facts.length,6)),String(Date.now())));}
 function chronoCheck(){const correct=isCorrectOrder(ordered);setChronoAnswer(correct);if(correct)onComplete({mode:'chronicle',title:'Ordered '+ordered.length+' historical records',score:ordered.length*20,at:new Date().toISOString(),source:'https://www.wikidata.org/'});}
 function startExtreme(){setChronoQuiz(false);setChronoExtreme(true);setChronoExtremeChoice(null);setChronoRound(n=>n+1);}
 function chooseExtreme(row:ChronoRecord){if(!chronoExtremeQuestion||chronoExtremeChoice!==null||!chronoExtremeQuestion.options.some(x=>x.id===row.id))return;setChronoExtremeChoice(row.id);
   if(row.id===chronoExtremeQuestion.answer.id)onComplete({mode:'chronicle',title:'Original Wikidata '+chronoDirection+' year comparison',score:100,at:new Date().toISOString(),source:chronoExtremeQuestion.answer.sourceUrl});
 }
 function nextExtreme(){setChronoExtremeChoice(null);setChronoRound(n=>n+1);}
 function chronoEvidenceDate(record:ChronoRecord){return record.year+(record.precision>=10&&record.month!==null?'-'+String(record.month).padStart(2,'0'):'')+(record.precision>=11&&record.day!==null?'-'+String(record.day).padStart(2,'0'):'');}
 return <section className="exp">
   <div className="mode-head"><h1>{mode==='galaxy'?'Knowledge Galaxy':mode==='geo'?'GeoWiki':'WikiChronicle'}</h1></div>
   {focusArticle&&<aside className="exp-source-focus" aria-label="Original topic evidence">
    <div className="eyebrow">CONNECTED TOPIC · PINNED WIKIPEDIA SOURCE</div><h2>{focusArticle.title}</h2>
    <p>{focusArticle.language.toUpperCase()} page {focusArticle.pageId} · revision {focusArticle.revisionId}. Current Wikidata statements are independently resolved; they are not assumed to appear in the historical revision.</p>
    {focusEvidence?<div className="exp-source-evidence"><a href={focusEvidence.entityUrl} target="_blank" rel="noreferrer">Verified current Wikidata item {focusEvidence.qid} ↗</a>
      {mode==='geo'&&(focusEvidence.coordinate?<p>Recorded P625 coordinate: {focusEvidence.coordinate.latitude.toFixed(4)}°, {focusEvidence.coordinate.longitude.toFixed(4)}°. <a href={focusEvidence.coordinate.sourceUrl} target="_blank" rel="noreferrer">Inspect P625 ↗</a></p>:<p>No qualifying P625 coordinate for this topic. The independent atlas below is not inferred to describe it.</p>)}
      {mode==='chronicle'&&(focusEvidence.dated?<p>Recorded {focusEvidence.dated.type.toLowerCase()} year: {focusEvidence.dated.year}. <a href={focusEvidence.dated.sourceUrl} target="_blank" rel="noreferrer">Inspect {focusEvidence.dated.property} ↗</a></p>:<p>No qualifying date for this topic. The independent timeline below is not a history of the selected article.</p>)}
    </div>:<p role="status">{focusError||'Checking original Wikipedia identity and current Wikidata claims…'}</p>}
   </aside>}
   {error&&<div role="alert" className="error">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
   {busy&&<div role="status" className="loading">{busy}</div>}
   {mode==='galaxy'&&<><div className="exp-find">
     <form onSubmit={e=>{e.preventDefault();void loadGalaxy(topic);}}><label htmlFor="galaxy-topic">WIKIPEDIA TOPIC</label><div className="exp-inline"><input id="galaxy-topic" value={topic} onChange={e=>setTopic(e.target.value)}/><button type="submit" disabled={!!busy}>Explore connections →</button></div></form>
     {matches.length>0&&<div className="exp-matches">{matches.map(x=><button key={x.pageId} onClick={()=>{setTopic(x.title);void loadGalaxy(x.title);}}>{x.title} ↗</button>)}</div>}
   </div>{galaxy&&<>
     <nav className="exp-entity-trail" aria-label="Wikidata relationship trail">{trail.map((item,i)=><React.Fragment key={item.id}><button disabled={!!busy} onClick={()=>void jumpTo(i)} title={'Return to '+item.id}>{item.title} <small>{item.id}</small></button><span aria-hidden="true">›</span></React.Fragment>)}<strong aria-current="step">{galaxy.root.title} · {galaxy.root.id}</strong></nav>
     <div className="exp-head"><div><span className="eyebrow">WIKIDATA ENTITY {galaxy.root.id}</span><h2>{galaxy.root.title}</h2><p>{galaxy.root.description||'Connections represent Wikidata statements, not Wikipedia hyperlinks.'}</p></div><div className="exp-buttons"><button disabled={!trail.length||!!busy} onClick={()=>void back()}>← Back</button><button disabled={!!busy} onClick={()=>void openArticle(galaxy.root.id)}>Read verified English Wikipedia →</button><a href={galaxy.root.sourceUrl} target="_blank" rel="noreferrer">View source ↗</a></div></div>
     <section className="exp-galaxy-tools" aria-label="Explore Wikidata statement groups"><div className="eyebrow">FILTER RELATIONSHIP EVIDENCE</div>
       <div className="exp-facets"><button aria-pressed={facet==='all'} className={facet==='all'?'selected':''} onClick={()=>{setFacet('all');setFilter('all');}}>All types ({galaxy.edges.length})</button>{GALAXY_FACETS.map(group=>{const count=galaxyVisibleEdges(galaxy,{facet:group.id}).length;return count>0?<button key={group.id} aria-pressed={facet===group.id} className={facet===group.id?'selected':''} onClick={()=>{setFacet(group.id);setFilter('all');}}>{group.label} ({count})</button>:null;})}</div>
       <label htmlFor="galaxy-edge-search">FIND A RECORDED ITEM, PROPERTY OR QID</label><input id="galaxy-edge-search" type="search" value={edgeQuery} onChange={event=>setEdgeQuery(event.target.value)} placeholder="Filter loaded source statements…" maxLength={100}/>
       <div className="exp-filters"><button className={filter==='all'?'selected':''} aria-pressed={filter==='all'} onClick={()=>setFilter('all')}>All properties ({galaxyPropertyCounts(galaxy,facet).reduce((n,g)=>n+g.count,0)})</button>{galaxyPropertyCounts(galaxy,facet).map(g=><button key={g.property} className={filter===g.property?'selected':''} aria-pressed={filter===g.property} onClick={()=>setFilter(g.property)}>{g.label} ({g.count})</button>)}</div>
       <p className="exp-caveat">Showing {edges.length} of {galaxy.edges.length} source statements. Filters change visibility only; no relationships are inferred.</p></section>
     <div className="exp-galaxy">
       <div className="exp-graph-column">
         <div className="exp-orbit" aria-label={'Interactive Wikidata network for '+galaxy.root.title}>
           <svg viewBox="0 0 600 420" role="group" aria-label={'Select a Wikidata node to inspect a source statement for '+galaxy.root.title}>
             <g stroke="#527987" strokeWidth="1.5">{pageEdges.map((edge,i)=>{const angle=2*Math.PI*i/Math.max(1,pageEdges.length);return <line key={'line-'+edge.property+edge.to} x1="300" y1="210" x2={300+215*Math.cos(angle)} y2={210+155*Math.sin(angle)}/>;})}</g>
             <circle cx="300" cy="210" r="46" fill="#1e5060" stroke="#a3e8e6" strokeWidth="3"/><text x="300" y="214" fill="#fff" fontSize="14" textAnchor="middle">{galaxy.root.id}</text>
             {pageEdges.map((edge,i)=>{const angle=2*Math.PI*i/Math.max(1,pageEdges.length),x=300+215*Math.cos(angle),y=210+155*Math.sin(angle),active=selectedEdge?.property===edge.property&&selectedEdge?.to===edge.to;
               return <g key={edge.property+edge.to} className={'exp-node '+(active?'active':'')} role="button" tabIndex={0} aria-label={'Inspect '+edge.title+', '+edge.label+', '+edge.to} aria-pressed={active}
                 onClick={()=>setSelectedKey(edge.property+':'+edge.to)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelectedKey(edge.property+':'+edge.to);}}}>
                 <circle cx={x} cy={y} r={active?23:20} fill={active?'#376d76':'#203848'} stroke={active?'#c9f1e8':'#80c4cf'} strokeWidth="2.5"/>
                 <text x={x} y={y+4} fill="#fff" textAnchor="middle" fontSize="11">{edge.to}</text><text x={x} y={y+31} fill="#d5e8eb" textAnchor="middle" fontSize="11">{edge.title.length>17?edge.title.slice(0,16)+'…':edge.title}</text>
                 <title>{edge.label+': '+edge.title+' ('+edge.to+')'}</title>
               </g>;})}</svg>
           {!edges.length&&<p className="exp-empty">No source statements match these filters. Change a property or search.</p>}
         </div>
         <div className="exp-page-controls"><span>Visible graph nodes {edges.length?nodePage*8+1:0}–{Math.min(edges.length,(nodePage+1)*8)} of {edges.length}</span><div className="exp-buttons"><button disabled={nodePage===0} onClick={()=>setNodePage(n=>Math.max(0,n-1))}>← Previous nodes</button><button disabled={nodePage>=pageCount-1} onClick={()=>setNodePage(n=>Math.min(pageCount-1,n+1))}>Next nodes →</button></div></div>
         {selectedEdge&&<section className="exp-inspector" aria-label="Selected original Wikidata statement"><span className="eyebrow">RECORDED STATEMENT · {selectedEdge.property}</span><h3>{galaxy.root.title} <span>→ {selectedEdge.label} →</span> {selectedEdge.title}</h3>
           <p>From <strong>{galaxy.root.id}</strong> to <strong>{selectedEdge.to}</strong>. This is a specific Wikidata claim, not a Wikipedia hyperlink or an inferred connection.</p>
           {selectedEdge.claimId&&<p className="exp-claim-id">Source statement ID: <code>{selectedEdge.claimId}</code></p>}
           <div className="exp-buttons"><button disabled={!!busy||trail.some(x=>x.id===selectedEdge.to)} onClick={()=>void loadGalaxy(selectedEdge.to,true,selectedEdge)}>Follow recorded relationship →</button><button disabled={!!busy} onClick={()=>void openArticle(selectedEdge.to)}>Read verified English article →</button><a href={selectedEdge.sourceUrl} target="_blank" rel="noreferrer">Inspect Wikidata {selectedEdge.property} claim ↗</a></div>
           {trail.some(x=>x.id===selectedEdge.to)&&<p>This item is already in your trail. Use the breadcrumb to revisit it.</p>}
         </section>}
       </div>
       <div className="exp-connections"><h3>Source relationships</h3>{edges.map(edge=><div key={edge.property+edge.to} className={'exp-connection '+(selectedEdge?.to===edge.to&&selectedEdge?.property===edge.property?'selected':'')}>
         <div><span className="eyebrow">{edge.label.toUpperCase()} · {edge.property}</span><strong>{edge.title}</strong><span className="exp-qid">{edge.to}</span><a href={edge.sourceUrl} target="_blank" rel="noreferrer">Inspect claim ↗</a></div>
         <div className="exp-connection-actions"><button disabled={!!busy||trail.some(x=>x.id===edge.to)} onClick={()=>void loadGalaxy(edge.to,true,edge)}>Expand →</button><button aria-pressed={selectedEdge?.to===edge.to&&selectedEdge?.property===edge.property} onClick={()=>{setSelectedKey(edge.property+':'+edge.to);setNodePage(Math.floor(edges.indexOf(edge)/8));}}>Inspect</button></div>
       </div>)}{!edges.length&&<p>No verified relationships in this filter.</p>}</div>
     </div>
     <section className="exp-quiz-panel exp-relations-game"><div className="eyebrow">SOURCE-IDENTITY QUESTION / WIKIDATA P-STATEMENT</div><h3>Which relation is recorded?</h3>
       {relationQuiz?<><p>According to Wikidata, which property connects <strong>{relationQuiz.rootTitle}</strong> to <strong>{relationQuiz.targetTitle}</strong>?</p>
         <div className="exp-relation-options">{relationQuiz.choices.map(o=><button key={o.property} disabled={relationChoice!==null} aria-label={'Choose '+o.label} onClick={()=>{setRelationChoice(o.property);onKnowledge(knowledgeResult(relationQuiz,o.property));}}>{o.label} <small>{o.property}</small></button>)}</div>
         {relationChoice!==null&&<div className="exp-feedback"><strong>{gradeRelationQuestion(relationQuiz,relationChoice)?'Correct recorded property.':'Different from the recorded property.'}</strong><p>Wikidata records {relationQuiz.choices.find(o=>o.property===relationQuiz.answer)?.label} ({relationQuiz.answer}).</p><a href={relationQuiz.source} target="_blank" rel="noreferrer">Inspect original statement ↗</a><button onClick={()=>{setRelationRound(x=>x+1);setRelationChoice(null);}}>Another statement →</button></div>}
         <p className="exp-caveat">Checks original Wikidata statement identity; it is not a certificate that the claim is indisputable.</p></>:<p>More distinct, source-verified Wikidata relations are required for an unambiguous question. Explore another topic.</p>}
     </section>
     <p className="exp-caveat">Only a bounded selection of actual Wikidata relationships is shown; no inferred links are added.</p>
   </>}</>}
   {mode==='geo'&&<>
     <div className="exp-tabs" role="group" aria-label="GeoWiki learning mode">
       <button aria-pressed={!geoQuiz} className={!geoQuiz?'selected':''} onClick={()=>{setGeoQuiz(false);setGeoAnswer(null);}}>Explore coordinates</button>
       <button disabled={visibleGamePlaces.length<3} aria-pressed={geoQuiz&&geoKind==='locate'} className={geoQuiz&&geoKind==='locate'?'selected':''} onClick={()=>startGeo('locate')}>Locate a city</button>
       <button disabled={visibleGamePlaces.length<3} aria-pressed={geoQuiz&&geoKind==='latitude'} className={geoQuiz&&geoKind==='latitude'?'selected':''} onClick={()=>startGeo('latitude')}>Compare latitudes</button>
     </div>
     <section className="exp-geo-tools" aria-label="Mathematical geographical views">
       <div className="eyebrow">ORIGINAL P625 / MATHEMATICAL COORDINATE VIEWS</div>
       <div className="exp-geo-views">{GEO_VIEWS.map(view=><button key={view.id} aria-pressed={geoViewId===view.id} className={geoViewId===view.id?'selected':''} onClick={()=>setGeoViewId(view.id)}>{view.label}<small>{geoPlacesInView(places,view.id).length} original locations</small></button>)}</div>
       <label htmlFor="geo-search">FILTER LOADED PLACE NAMES OR QIDS</label><input id="geo-search" type="search" value={geoSearch} maxLength={120} onChange={event=>setGeoSearch(event.target.value)} placeholder="Search current original coordinate catalog…"/>
       <p>Mathematical hemispheres; not political borders.</p>
     </section>
     <div className="exp-geo-bar"><h2>{geoQuiz?(geoKind==='locate'?'Locate '+(target?.title||'a source location'):'Compare sourced latitudes'):'Earth coordinate atlas'}</h2><span className="eyebrow">{visibleAtlas.length} VISIBLE VERIFIED POSITIONS · {geoView(geoViewId).label.toUpperCase()}</span></div>
     {topicCoordinate&&<div className="exp-geo-focus"><strong>Connected topic · {topicCoordinate.title} · {topicCoordinate.qid}</strong><p>Shown for exploration only; excluded from graded catalog questions.</p><div className="exp-buttons"><button onClick={()=>{setGeoViewId('world');setGeoSearch('');setGeoQuiz(false);setPlace(topicCoordinate);}}>Inspect topic P625 →</button><a href={topicCoordinate.sourceUrl} target="_blank" rel="noreferrer">Original Wikidata coordinate ↗</a></div></div>}
     {visibleAtlas.length>0?<div className="exp-map-wrap">
       <svg className="exp-map" viewBox="0 0 900 450" role="group" aria-label={'Interactive source coordinate projection: '+geoView(geoViewId).label}>
         {Array.from({length:13},(_,i)=><line key={'v'+i} x1={75*i} y1="0" x2={75*i} y2="450" stroke="#426172" strokeWidth=".8"/>)}
         {Array.from({length:7},(_,i)=><line key={'h'+i} x1="0" y1={75*i} x2="900" y2={75*i} stroke="#426172" strokeWidth=".8"/>)}
         {visibleAtlas.map((p,i)=>{const pt=geoProject(p,geoViewId),active=place?.qid===p.qid,locate=geoQuiz&&geoKind==='locate';
           return <g key={p.qid} className="exp-geo-pin" role="button" tabIndex={0} aria-pressed={active} aria-label={locate?'Select pin '+(i+1):'Inspect '+p.title+' source coordinate'}
             onClick={()=>choosePlace(p)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choosePlace(p);}}}>
             <circle cx={pt.x} cy={pt.y} r="23" fill="transparent" stroke="none"/><circle cx={pt.x} cy={pt.y} r={active?12:9} fill={active?'#e5fff8':'#a9e1db'} stroke="#162f3b" strokeWidth="3"/>
             {!geoQuiz&&<text x={Math.min(780,pt.x+14)} y={pt.y-13} fontSize="13" fill="#e8f3f7">{p.title}</text>}
             <title>{locate?'Pin '+(i+1):p.title+' · '+p.qid+' · original P625'}</title>
           </g>;})}</svg>
       <div className="exp-map-caption">{geoView(geoViewId).label}: latitude {geoView(geoViewId).minLat}° to {geoView(geoViewId).maxLat}°, longitude {geoView(geoViewId).minLon}° to {geoView(geoViewId).maxLon}° · Equirectangular coordinates only; no fabricated coastlines or borders</div>
     </div>:<p className="exp-geo-empty">No original P625 places match the selected view and query. Clear the search or change hemisphere.</p>}
     {geoQuiz&&geoKind==='locate'&&target&&<section className="exp-quiz-panel exp-geo-locate"><h3>Select the pin corresponding to {target.title}</h3>
       <p>Use real map pins or numbered touch/keyboard controls. Answers use the original catalog's P625 coordinates.</p>
       <div className="exp-place-options">{visibleGamePlaces.map(p=><button key={p.qid} disabled={geoAnswer!==null} onClick={()=>choosePlace(p)}>{geoAnswer!==null?p.title:'Pin '+(visibleAtlas.findIndex(x=>x.qid===p.qid)+1)}</button>)}</div>
       {geoAnswer!==null&&<div className="exp-feedback"><strong>{geoAnswer?'Correct!':'Incorrect location.'}</strong><p>Verified place: {target.title} · signed latitude {target.latitude.toFixed(4)}°, longitude {target.longitude.toFixed(4)}°.</p><a href={target.sourceUrl} target="_blank" rel="noreferrer">Original coordinate claim ↗</a><button onClick={advanceGeo}>Next location →</button></div>}
     </section>}
     {geoQuiz&&geoKind==='latitude'&&<section className="exp-quiz-panel exp-geo-latitude"><div className="eyebrow">COORDINATE COMPARISON / ORIGINAL P625 EVIDENCE</div>
       <h3>Which shown place is furthest {geoDirection==='north'?'north':'south'}?</h3>
       <div className="exp-geo-difficulty"><label htmlFor="geo-direction">DIRECTION</label><select id="geo-direction" value={geoDirection} onChange={e=>setGeoDirection(e.target.value as 'north'|'south')}><option value="north">Higher latitude (north)</option><option value="south">Lower latitude (south)</option></select>
         <label htmlFor="geo-density">CHALLENGE SIZE</label><select id="geo-density" value={geoDensity} onChange={e=>setGeoDensity(Number(e.target.value) as 3|4)}><option value={3}>3 original places</option><option value={4}>4 original places</option></select></div>
       {latitudeQuiz?<><p>Compare these {latitudeQuiz.options.length} sourced locations.</p>
         <div className="exp-geo-lat-options">{latitudeQuiz.options.map(p=><button key={p.qid} disabled={geoAnswer!==null} onClick={()=>chooseLatitude(p)}>{p.title} <small>{p.qid}</small></button>)}</div>
         {geoAnswer!==null&&<div className="exp-feedback"><strong>{geoAnswer?'Correct!':'Not this latitude.'}</strong><p>{latitudeQuiz.answer.title} has the {geoDirection==='north'?'highest':'lowest'} signed latitude within the selected sources: {latitudeQuiz.answer.latitude.toFixed(4)}°.</p>
           {latitudeQuiz.options.map(p=><p key={p.qid}>{p.title}: {p.latitude.toFixed(4)}° · <a href={p.sourceUrl} target="_blank" rel="noreferrer">Original {p.qid} P625 ↗</a></p>)}<button onClick={advanceGeo}>Another coordinate comparison →</button></div>}</>:<p role="status">Not enough verified P625 places at this view and choice count. Choose a larger hemisphere, remove the search or reduce difficulty.</p>}
     </section>}
     {!geoQuiz&&<div className="exp-geo-browser">
       <section className="exp-geo-place-list"><span className="eyebrow">ACCESSIBLE SOURCE LOCATIONS</span><h3>Select a coordinate</h3><div className="exp-geo-list">{visibleAtlas.map(p=><button key={p.qid} className={place?.qid===p.qid?'selected':''} aria-pressed={place?.qid===p.qid} onClick={()=>setPlace(p)}>{p.title}<small>{p.qid} · {p.latitude.toFixed(2)}°, {p.longitude.toFixed(2)}°</small></button>)}</div></section>
       {place?<section className="exp-place-detail exp-geo-inspector"><div><span className="eyebrow">SELECTED P625 RECORD</span><h3>{place.title} · {place.qid}</h3><p>Signed latitude {place.latitude.toFixed(5)}° · longitude {place.longitude.toFixed(5)}°</p>
         <p>Original coordinate precision: {typeof place.precision==='number'&&Number.isFinite(place.precision)?place.precision+'°':'unspecified'}. Displayed decimals do not assert measurement accuracy.</p>
         <div className="exp-buttons"><a href={place.sourceUrl} target="_blank" rel="noreferrer">Inspect P625 ↗</a><button disabled={!!busy} onClick={()=>void openArticle(place.qid)}>Read verified Wikipedia revision →</button>{onExploreQid&&<button onClick={()=>onExploreQid(place.qid)}>Explore in Knowledge Galaxy →</button>}</div></div>
         <div className="exp-geo-relations"><h4>Recorded place connections</h4>{geoRelationBusy?<p role="status">Loading original P17/P131 statements…</p>:geoRelationError?<p role="status">{geoRelationError}</p>:geoRelations.length?geoRelations.map(rel=><div key={rel.property+rel.to}><strong>{rel.label}: {rel.title}</strong><span>{rel.to} · {rel.property}</span><a href={rel.sourceUrl} target="_blank" rel="noreferrer">Wikidata claim ↗</a>{onExploreQid&&<button onClick={()=>onExploreQid(rel.to)}>Explore linked QID →</button>}</div>):<p>No loaded P17/P131 source statements for this item; nearby coordinates do not imply political relationships.</p>}</div>
         <div className="exp-geo-near"><h4>Other nearby loaded coordinates</h4><p>Approximate calculated great-circle separation from two Earth P625 records, in kilometres. This is not a source distance claim, travel route or journey time.</p>{nearPlaces.map(other=><div key={other.qid}><button onClick={()=>setPlace(other)}>{other.title} · approximately {other.distanceKm} km</button><a href={place.sourceUrl} target="_blank" rel="noreferrer">Start P625 ↗</a><a href={other.sourceUrl} target="_blank" rel="noreferrer">Other P625 ↗</a></div>)}{!nearPlaces.length&&<p>No other verified coordinates are loaded.</p>}</div>
       </section>:<div className="exp-geo-empty">Choose a marker or accessible place name to inspect original coordinate evidence.</div>}
     </div>}
     <p className="exp-caveat">Only non-deprecated Earth P625 statements are used. Hemisphere windows, latitude comparisons and straight-line estimates are computed from those sourced values, not inferred geopolitical boundaries, official rankings or travel times.</p>
   </>}
   {mode==='chronicle'&&<>
     <div className="exp-tabs" role="group" aria-label="WikiChronicle source activities">
       <button aria-pressed={!chronoQuiz&&!chronoExtreme} className={!chronoQuiz&&!chronoExtreme?'selected':''} onClick={()=>{setChronoQuiz(false);setChronoExtreme(false);}}>Browse timeline</button>
       <button aria-pressed={chronoQuiz} className={chronoQuiz?'selected':''} disabled={facts.length<4} onClick={chronoStart}>Order challenge</button>
       <button aria-pressed={chronoExtreme} className={chronoExtreme?'selected':''} disabled={visibleChrono.length<3} onClick={startExtreme}>Compare years</button>
     </div>
     <section className="exp-chrono-tools" aria-label="Filter recorded original Wikidata historical dates">
       <div className="eyebrow">ORIGINAL NON-DEPRECATED WIKIDATA DATES / CE ONLY</div>
       <div className="exp-chrono-properties">
         <button aria-pressed={chronoProperty==='all'} className={chronoProperty==='all'?'selected':''} onClick={()=>setChronoProperty('all')}>All properties ({chronoRecords.length})</button>
         {chroniclePropertyCounts(chronoRecords).map(x=><button key={x.property} aria-pressed={chronoProperty===x.property} className={chronoProperty===x.property?'selected':''} onClick={()=>setChronoProperty(x.property)}>{x.label} · {x.property} ({x.count})</button>)}
       </div>
       <div className="exp-chrono-query"><div><label htmlFor="chrono-search">FIND ORIGINAL PERSON, EVENT, PROPERTY OR QID</label><input id="chrono-search" type="search" value={chronoSearch} onChange={e=>setChronoSearch(e.target.value)} placeholder="Search original statement records…" maxLength={120}/></div>
         <div><label htmlFor="chrono-from">FROM CE YEAR</label><input id="chrono-from" type="number" min="1" max="3000" value={chronoFrom} onChange={e=>setChronoFrom(e.target.value)} placeholder="Earliest"/></div>
         <div><label htmlFor="chrono-to">THROUGH CE YEAR</label><input id="chrono-to" type="number" min="1" max="3000" value={chronoTo} onChange={e=>setChronoTo(e.target.value)} placeholder="Latest"/></div>
       </div>
       <div className="exp-chrono-filter-footer"><p>{visibleChrono.length} of {chronoRecords.length} dated claims · inclusive CE years</p><button onClick={()=>{setChronoProperty('all');setChronoSearch('');setChronoFrom('');setChronoTo('');}}>Reset timeline filters</button></div>
     </section>
     {sourceTopicDates.length>0&&<section className="exp-chrono-focus" aria-label="W02 connected source date statements"><div className="eyebrow">YOUR CONNECTED ARTICLE / INDEPENDENT CURRENT WIKIDATA EVIDENCE</div>
       <h2>{focusArticle?.title}: {sourceTopicDates.length} original dated statement{sourceTopicDates.length!==1?'s':''}</h2>
       <p>Current Wikidata dates; not claims about the pinned Wikipedia revision or part of the graded catalog.</p>
       <div className="exp-chrono-focus-list">{sourceTopicDates.map(row=><div key={row.id}><strong>{chronoEvidenceDate(row)} · {row.type} · {row.property}</strong><span>Original {row.qid} · precision {row.precision}</span><a href={row.sourceUrl} target="_blank" rel="noreferrer">Inspect original date ↗</a>{onExploreQid&&<button onClick={()=>onExploreQid(row.qid)}>Investigate QID in Galaxy →</button>}</div>)}</div>
     </section>}
     {chronoQuiz&&facts.length>0&&<section className="exp-quiz-panel exp-chrono-order"><h2>Order the events, earliest first</h2><p>Move original dated records up or down. Each date can be inspected after checking. The original ordering engine and saved-result authority are unchanged.</p>
       <div className="exp-order">{ordered.map((f,i)=><div className="exp-order-row" key={f.qid}><span>{i+1}</span><div><strong>{f.title}</strong><small>{f.type} · original {f.property}</small></div>
         <button disabled={i===0||chronoAnswer===true} aria-label={'Move '+f.title+' earlier'} onClick={()=>{setOrdered(x=>changeOrder(x,i,-1));setChronoAnswer(null);}}>↑</button>
         <button disabled={i===ordered.length-1||chronoAnswer===true} aria-label={'Move '+f.title+' later'} onClick={()=>{setOrdered(x=>changeOrder(x,i,1));setChronoAnswer(null);}}>↓</button></div>)}</div>
       <div className="exp-buttons"><button onClick={chronoCheck} disabled={chronoAnswer===true}>Check order →</button><button onClick={chronoStart}>Reshuffle</button></div>
       {chronoAnswer!==null&&<div className="exp-feedback"><strong>{chronoAnswer?'Correct order, saved locally.':'Not quite. Inspect the dates below and try again.'}</strong>
         {!chronoAnswer&&chronologicalOrder(ordered).map(f=><div key={f.qid}>{f.year} · {f.title} · <a href={f.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></div>)}</div>}
     </section>}
     {chronoExtreme&&<section className="exp-quiz-panel exp-chrono-extreme"><div className="eyebrow">ADDITIONAL LOCAL PRACTICE / ORIGINAL DATE STATEMENTS</div><h2>Which recorded year is {chronoDirection}?</h2>
       <div className="exp-chrono-challenge-options"><div><label htmlFor="chrono-direction">YEAR COMPARISON</label><select id="chrono-direction" value={chronoDirection} onChange={e=>{setChronoDirection(e.target.value as 'earliest'|'latest');setChronoExtremeChoice(null);}}><option value="earliest">Earliest recorded year</option><option value="latest">Latest recorded year</option></select></div>
         <div><label htmlFor="chrono-count">SOURCED OPTIONS</label><select id="chrono-count" value={chronoCount} onChange={e=>{setChronoCount(Number(e.target.value) as 3|4);setChronoExtremeChoice(null);}}><option value={3}>3 original dated items</option><option value={4}>4 original dated items</option></select></div></div>
       {chronoExtremeQuestion?<><p>Compare the {chronoExtremeQuestion.options.length} recorded CE years, not absolute historical rankings.</p>
         <div className="exp-chrono-choice-grid">{chronoExtremeQuestion.options.map(row=><button key={row.id} disabled={chronoExtremeChoice!==null} onClick={()=>chooseExtreme(row)}>{row.title}<small>{row.type} · {row.property} · {row.qid}</small></button>)}</div>
         {extremeOutcome!==null&&<div className="exp-feedback exp-chrono-answer"><strong>{extremeOutcome?'Correct original-year comparison.':'Not the '+chronoDirection+' observed year.'}</strong>
           <p>{chronoExtremeQuestion.answer.title}, {chronoExtremeQuestion.answer.type.toLowerCase()} in {chronoExtremeQuestion.answer.year} CE, is the {chronoDirection} among only these options.</p>
           {chronoExtremeQuestion.options.map(row=><div key={row.id}>{chronoEvidenceDate(row)} · {row.title} · {row.property} · <a href={row.sourceUrl} target="_blank" rel="noreferrer">Inspect original P-claim ↗</a></div>)}
           <button onClick={nextExtreme}>Compare another original set →</button></div>}
       </>:<p role="status">This filter contains fewer than {chronoCount} distinct, source-supported CE years. Broaden the timeline filters or reduce the choice count; no dates will be invented.</p>}
     </section>}
     {!chronoQuiz&&!chronoExtreme&&<div className="exp-timeline"><div className="exp-head"><div><h2>Source-verified chronology</h2></div><span className="eyebrow">{visibleChrono.length} INDIVIDUAL SOURCE STATEMENTS</span></div>
       {visibleChrono.length?<div className="exp-chrono-browser">
         <div className="exp-chrono-track" role="list" aria-label="Navigable original Wikidata date sequence">{visibleChrono.map(row=><div key={row.id} className={'exp-chrono-row '+(chosenChrono?.id===row.id?'selected':'')} role="listitem">
           <span className="exp-year">{row.year}</span><button aria-pressed={chosenChrono?.id===row.id} onClick={()=>setChronoSelected(row.id)}><strong>{row.title}</strong><small>{row.type} · {row.property} · {row.qid} · {row.precision===9?'year':row.precision===10?'month':'day'} precision</small></button></div>)}</div>
         {chosenChrono&&<section className="exp-chrono-inspector" aria-label="Selected original Wikidata date claim">
           <div className="eyebrow">SELECTED WIKIDATA DATE STATEMENT · {chosenChrono.qid}</div><h3>{chosenChrono.title}</h3>
           <p><strong>{chosenChrono.type} ({chosenChrono.property})</strong> · {chronoEvidenceDate(chosenChrono)} · precision {chosenChrono.precision} ({chosenChrono.precision===9?'year only':chosenChrono.precision===10?'year and month':'year, month and day'})</p>
           <p>Calendar model: {chosenChrono.calendar}. This is an original Wikidata statement, not a date inferred from prose or a conversion of a BCE or uncertain year.</p>
           {chosenChrono.claimId&&<p className="exp-chrono-claim">Original statement ID: <code>{chosenChrono.claimId}</code></p>}
           <div className="exp-buttons"><a href={chosenChrono.sourceUrl} target="_blank" rel="noreferrer">Inspect dated Wikidata claim ↗</a>
             <button disabled={!!busy} onClick={()=>void openArticle(chosenChrono.qid)}>Open confirmed original Wikipedia revision →</button>
             {onExploreQid&&<button onClick={()=>onExploreQid(chosenChrono.qid)}>Investigate QID in Galaxy →</button>}</div>
           <div className="exp-chrono-step"><button disabled={visibleChrono[0]?.id===chosenChrono.id} onClick={()=>setChronoSelected(visibleChrono[Math.max(0,visibleChrono.findIndex(x=>x.id===chosenChrono.id)-1)].id)}>← Previous statement</button>
             <button disabled={visibleChrono[visibleChrono.length-1]?.id===chosenChrono.id} onClick={()=>setChronoSelected(visibleChrono[Math.min(visibleChrono.length-1,visibleChrono.findIndex(x=>x.id===chosenChrono.id)+1)].id)}>Next statement →</button></div>
         </section>}
       </div>:<p className="exp-chrono-empty">No original supported statements match these filters. Clear a property, query or year boundary.</p>}</div>}
     <p className="exp-caveat">W06 displays only non-deprecated, unambiguous CE Wikidata dates with explicit year-or-finer precision. BCE, uncertain and unsupported time statements are excluded; Gregorian/Julian day-level conversions are not inferred. Dates are claims with source links, not official historical certification. All challenges remain local and unranked.</p>
   </>}
 </section>;
}
