import React,{useEffect,useMemo,useState} from 'react';
import {galaxyForTitle,galaxyForQid,loadGeoCatalog,loadChronicle,topicWikidataEvidence,verifiedGalaxyWikipedia,geoPlaceRelations} from '../services/exploration.mjs';
import {searchArticles} from '../services/wikimedia.mjs';
import {mapPoint,geoProject,geoPlacesInView,geoView,GEO_VIEWS,geoNearPlaces,geoLatitudeChallenge,chronologicalOrder,shuffleDeterministic,isCorrectOrder,changeOrder,GALAXY_FACETS,galaxyVisibleEdges,galaxyPropertyCounts,galaxyTrailAppend} from '../domain/exploration.mjs';
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
 const [relationRound,setRelationRound]=useState(0),[relationChoice,setRelationChoice]=useState<string|null>(null);
 const relationQuiz=useMemo(()=>sourceRelationQuestion(galaxy,relationRound),[galaxy,relationRound]);
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
     if(mode==='chronicle'){const c=await loadChronicle();if(active){setFacts(c);setOrdered(shuffleDeterministic(c.slice(0,5),String(Date.now())));}}
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
 function chronoStart(){setChronoQuiz(true);setChronoAnswer(null);setOrdered(shuffleDeterministic(facts.slice(0,Math.min(facts.length,6)),String(Date.now())));}
 function chronoCheck(){const correct=isCorrectOrder(ordered);setChronoAnswer(correct);if(correct)onComplete({mode:'chronicle',title:'Ordered '+ordered.length+' historical records',score:ordered.length*20,at:new Date().toISOString(),source:'https://www.wikidata.org/'});}
 return <section className="exp">
   <div className="mode-head"><div className="eyebrow">{mode==='galaxy'?'05 / WIKIDATA NETWORK':mode==='geo'?'06 / GEOGRAPHICAL DISCOVERY':'07 / CHRONOLOGY & EVIDENCE'}</div><h1>{mode==='galaxy'?'Knowledge Galaxy':mode==='geo'?'GeoWiki':'WikiChronicle'}<span className="accent">.</span></h1><p>{mode==='galaxy'?'Expand genuine Wikidata statements and follow inspectable entity relationships.':mode==='geo'?'Find real coordinates and solve a global location challenge.':'Browse source-verified historical dates and solve chronological ordering puzzles.'}</p></div>
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
   {mode==='geo'&&<><div className="exp-tabs"><button className={!geoQuiz?'selected':''} onClick={()=>{setGeoQuiz(false);setGeoAnswer(null);}}>Explore</button><button disabled={!places.length} className={geoQuiz?'selected':''} onClick={()=>{setGeoQuiz(true);setGeoAnswer(null);setPlace(null);}}>Locate a city</button></div>
     {places.length>0&&<><div className="exp-geo-bar"><h2>{geoQuiz?'Locate '+target?.title:'Earth coordinate atlas'}</h2><span className="eyebrow">{places.length} VERIFIED PLACES</span></div>
     <div className="exp-map-wrap"><svg className="exp-map" viewBox="0 0 900 450" role="img" aria-label="Interactive geographic coordinate projection">{Array.from({length:13},(_,i)=><line key={'v'+i} x1={75*i} y1="0" x2={75*i} y2="450" stroke="#426172" strokeWidth=".8"/>)}{Array.from({length:7},(_,i)=><line key={'h'+i} x1="0" y1={75*i} x2="900" y2={75*i} stroke="#426172" strokeWidth=".8"/>)}{places.map(p=>{const pt=mapPoint(p);return <g key={p.qid} role="button" tabIndex={0} aria-label={geoQuiz?'Select pin '+(places.indexOf(p)+1):'Select '+p.title} onClick={()=>choosePlace(p)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choosePlace(p);}}}><circle cx={pt.x} cy={pt.y} r={place?.qid===p.qid?11:8} fill="#a9e1db" stroke="#162f3b" strokeWidth="3"/>{!geoQuiz&&<text x={Math.min(780,pt.x+11)} y={pt.y-12} fontSize="13" fill="#e8f3f7">{p.title}</text>}</g>;})}</svg><div className="exp-map-caption">Coordinates only — no fabricated coastlines or borders · Equirectangular projection</div></div>
     {geoQuiz?<div className="exp-quiz-panel"><h3>Select the pin corresponding to {target?.title}</h3><p>Use map markers or the numbered accessible controls below.</p><div className="exp-place-options">{places.map((p,i)=><button key={p.qid} disabled={geoAnswer!==null} onClick={()=>choosePlace(p)}>{geoAnswer!==null?p.title:'Pin '+(i+1)}</button>)}</div>{geoAnswer!==null&&<div className="exp-feedback"><strong>{geoAnswer?'Correct!':'Incorrect location.'}</strong><p>Correct place: {target?.title}</p><a href={target?.sourceUrl} target="_blank" rel="noreferrer">Wikidata coordinates ↗</a><button onClick={()=>{setRound(x=>x+1);setGeoAnswer(null);setPlace(null);}}>Next location →</button></div>}</div>:
     <div className="exp-place-detail"><div><span className="eyebrow">SELECTED PLACE</span><h3>{place?.title}</h3><p>{place?.latitude.toFixed(4)}° latitude · {place?.longitude.toFixed(4)}° longitude</p></div><div className="exp-buttons"><a href={place?.sourceUrl} target="_blank" rel="noreferrer">Coordinate claim ↗</a>{place&&<button onClick={()=>onRead(place.articleTitle)}>Read Wikipedia →</button>}</div></div>}</>}
   </>}
   {mode==='chronicle'&&<><div className="exp-tabs"><button className={!chronoQuiz?'selected':''} onClick={()=>setChronoQuiz(false)}>Browse timeline</button><button className={chronoQuiz?'selected':''} disabled={facts.length<4} onClick={chronoStart}>Order challenge</button></div>{facts.length>0&&(chronoQuiz?<div className="exp-quiz-panel"><h2>Order the events, earliest first</h2><p>Move records up/down. Inspect evidence after checking.</p><div className="exp-order">{ordered.map((f,i)=><div className="exp-order-row" key={f.qid}><span>{i+1}</span><div><strong>{f.title}</strong><small>{f.type}</small></div><button disabled={i===0||chronoAnswer===true} aria-label={'Move '+f.title+' earlier'} onClick={()=>{setOrdered(x=>changeOrder(x,i,-1));setChronoAnswer(null);}}>↑</button><button disabled={i===ordered.length-1||chronoAnswer===true} aria-label={'Move '+f.title+' later'} onClick={()=>{setOrdered(x=>changeOrder(x,i,1));setChronoAnswer(null);}}>↓</button></div>)}</div><div className="exp-buttons"><button onClick={chronoCheck} disabled={chronoAnswer===true}>Check order →</button><button onClick={chronoStart}>Reshuffle</button></div>{chronoAnswer!==null&&<div className="exp-feedback"><strong>{chronoAnswer?'Correct order, saved locally.':'Not quite. Inspect the dates below and try again.'}</strong>{!chronoAnswer&&chronologicalOrder(ordered).map(f=><div key={f.qid}>{f.year} · {f.title} · <a href={f.sourceUrl} target="_blank" rel="noreferrer">Source ↗</a></div>)}</div>}</div>:
     <div className="exp-timeline"><div className="exp-head"><h2>Source-verified chronology</h2><span className="eyebrow">{facts.length} DATED RECORDS</span></div>{facts.map(f=><div className="exp-event" key={f.qid}><div className="exp-year">{f.year}</div><div><small>{f.type.toUpperCase()} · {f.property}</small><h3>{f.title}</h3><div className="exp-buttons"><button onClick={()=>onRead(f.articleTitle)}>Read article →</button><a href={f.sourceUrl} target="_blank" rel="noreferrer">Dated claim ↗</a></div></div></div>)}</div>)}<p className="exp-caveat">Events use non-deprecated Wikidata dates with year-level precision or better; uncertain and BCE dates are excluded.</p></>}
 </section>;
}
