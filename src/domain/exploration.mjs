/** Wikidata-source-only exploration projections. No inferred relationships or fabricated locations. */
export const RELATIONS = Object.freeze({
 P31:'instance of',P279:'subclass of',P106:'occupation',P19:'place of birth',P20:'place of death',
 P17:'country',P131:'located in',P361:'part of',P101:'field of work',P69:'educated at',
 P108:'employer',P166:'award received',P800:'notable work',P50:'author',P170:'creator',
 P61:'discoverer',P84:'architect',P176:'manufacturer',P138:'named after',P527:'has part',P22:'father',P25:'mother'
});
/** Filters group *existing* Wikidata P-statements; they never generate edges. */
export const GALAXY_FACETS=Object.freeze([
 {id:'identity',label:'Type & identity',properties:['P31','P279']},
 {id:'people',label:'People & organizations',properties:['P106','P19','P20','P69','P108','P22','P25','P166']},
 {id:'places',label:'Places & geography',properties:['P17','P131']},
 {id:'work',label:'Research & creative work',properties:['P101','P800','P50','P170','P61','P84','P176']},
 {id:'structure',label:'Parts & names',properties:['P361','P527','P138']}
]);
/** Deliberately bounded to original graph edges; no inferred path or fabricated label. */
export function galaxyVisibleEdges(graph,{facet='all',property='all',query=''}={}){
 const valid=Array.isArray(graph?.edges)?graph.edges.filter(e=>validQid(e.from)&&validQid(e.to)&&RELATIONS[e.property]&&e.from===graph.root?.id):[];
 const chosen=facet==='all'?null:GALAXY_FACETS.find(x=>x.id===facet);
 if(facet!=='all'&&!chosen)return [];
 const term=String(query||'').trim().normalize('NFC').toLocaleLowerCase('en').slice(0,100);
 return valid.filter(e=>(!chosen||chosen.properties.includes(e.property))&&(property==='all'||e.property===property)&&(!term||[e.title,e.label,e.property,e.to].some(x=>String(x||'').toLocaleLowerCase('en').includes(term))));
}
export function galaxyPropertyCounts(graph,facet='all'){
 const edges=galaxyVisibleEdges(graph,{facet}),counts=new Map();
 for(const edge of edges)counts.set(edge.property,(counts.get(edge.property)||0)+1);
 return [...counts].map(([property,count])=>({property,label:RELATIONS[property],count}));
}
export function galaxyTrailAppend(trail,graph,edge){
 if(!validQid(graph?.root?.id)||!validQid(edge?.to)||edge.from!==graph.root.id||!graph.edges?.some(e=>e.to===edge.to&&e.property===edge.property&&e.sourceUrl===edge.sourceUrl))throw new Error('Selected entity is not an original source-linked neighbor');
 const visited=new Set([...trail.map(x=>x.id),graph.root.id]);
 if(visited.has(edge.to))throw new Error('This item is already on the current source trail; use an earlier step to revisit it');
 return [...trail,{id:graph.root.id,title:graph.root.title,via:edge.label,property:edge.property,statement:edge.sourceUrl}];
}
export const GEO_TOPICS=Object.freeze(['Berlin','Paris','Tokyo','Cairo','Nairobi','Sydney','Rio de Janeiro','Reykjavík','Seoul','Cape Town']);
export const CHRONICLE_TOPICS=Object.freeze(['Marie Curie','Albert Einstein','Ada Lovelace','Isaac Newton','Charles Darwin','Florence Nightingale','Alan Turing','Katherine Johnson','Rosalind Franklin','Galileo Galilei','Grace Hopper','Apollo 11','World War I','French Revolution']);
export const CHRONICLE_PROPERTIES=Object.freeze({P569:'Born',P571:'Inception',P577:'Published',P580:'Started',P585:'Event date'});
export function validQid(id){return typeof id==='string' && /^Q[1-9]\d*$/.test(id);}
export function englishLabel(entity){return entity?.labels?.en?.value || (validQid(entity?.id)?entity.id:'Unnamed entity');}
export function linkStatements(entity, max=24){
 if(!validQid(entity?.id)||!entity.claims)return [];
 const result=[],seen=new Set();
 for(const [property, label] of Object.entries(RELATIONS)){
   for(const claim of entity.claims[property]||[]){
     if(claim.rank==='deprecated'||claim.mainsnak?.snaktype!=='value')continue;
     const qid=claim.mainsnak?.datavalue?.value?.id;
     if(!validQid(qid)||qid===entity.id)continue;
     const key=property+':'+qid;
     if(seen.has(key))continue;
     seen.add(key);result.push({from:entity.id,to:qid,property,label,claimId:claim.id||null,
       sourceUrl:`https://www.wikidata.org/wiki/${entity.id}#${property}`});
     if(result.length>=max)return result;
   }
 }
 return result;
}
export function coordinate(entity){
 if(!validQid(entity?.id))return null;
 for(const claim of entity.claims?.P625||[]){
   if(claim.rank==='deprecated'||claim.mainsnak?.snaktype!=='value')continue;
   const v=claim.mainsnak?.datavalue?.value;
   if(!v||v.globe!=='http://www.wikidata.org/entity/Q2'||!Number.isFinite(v.latitude)||!Number.isFinite(v.longitude))continue;
   if(Math.abs(v.latitude)>90||Math.abs(v.longitude)>180)continue;
   return {qid:entity.id,latitude:v.latitude,longitude:v.longitude,precision:v.precision??null,sourceUrl:`https://www.wikidata.org/wiki/${entity.id}#P625`};
 }
 return null;
}
export function mapPoint({latitude,longitude}){return {x:((longitude+180)/360)*900,y:((90-latitude)/180)*450};}
/** W05 geographical regions are mathematical coordinate windows, NOT continent or country claims. */
export const GEO_VIEWS=Object.freeze([
 {id:'world',label:'Whole Earth',minLat:-90,maxLat:90,minLon:-180,maxLon:180},
 {id:'north',label:'Northern hemisphere',minLat:0,maxLat:90,minLon:-180,maxLon:180},
 {id:'south',label:'Southern hemisphere',minLat:-90,maxLat:0,minLon:-180,maxLon:180},
 {id:'east',label:'Eastern hemisphere',minLat:-90,maxLat:90,minLon:0,maxLon:180},
 {id:'west',label:'Western hemisphere',minLat:-90,maxLat:90,minLon:-180,maxLon:0}
]);
export function geoView(viewId){
 const view=GEO_VIEWS.find(x=>x.id===viewId);
 if(!view)throw new Error('Unsupported geographic coordinate window');
 return view;
}
/** Only already verified W05 P625 records from the original adapter are eligible. */
export function isGeoPlace(place){
 return validQid(place?.qid)&&Number.isFinite(place.latitude)&&Number.isFinite(place.longitude)&&Math.abs(place.latitude)<=90&&Math.abs(place.longitude)<=180&&place.sourceUrl==='https://www.wikidata.org/wiki/'+place.qid+'#P625';
}
export function geoPlacesInView(places,viewId='world',search=''){
 const view=geoView(viewId),term=String(search||'').trim().toLocaleLowerCase('en').slice(0,120),seen=new Set();
 return (Array.isArray(places)?places:[]).filter(p=>{
  if(!isGeoPlace(p)||seen.has(p.qid))return false;
  seen.add(p.qid);
  return p.latitude>=view.minLat&&p.latitude<=view.maxLat&&p.longitude>=view.minLon&&p.longitude<=view.maxLon&&(!term||[p.title,p.qid,p.articleTitle].some(s=>String(s||'').toLocaleLowerCase('en').includes(term)));
 });
}
export function geoProject(place,viewId='world'){
 if(!isGeoPlace(place))throw new Error('GeoWiki cannot project unverified P625 coordinates');
 const view=geoView(viewId);
 if(place.latitude<view.minLat||place.latitude>view.maxLat||place.longitude<view.minLon||place.longitude>view.maxLon)throw new Error('Coordinate lies outside this mathematical view');
 return {x:((place.longitude-view.minLon)/(view.maxLon-view.minLon))*900,y:((view.maxLat-place.latitude)/(view.maxLat-view.minLat))*450};
}
/** Spherical great-circle estimate in kilometres, not a Wikidata statement or travel route. */
export function geoDistanceKm(origin,destination){
 if(!isGeoPlace(origin)||!isGeoPlace(destination))throw new Error('Distance requires two verified Earth P625 locations');
 const rad=Math.PI/180,dLat=(destination.latitude-origin.latitude)*rad,dLon=(destination.longitude-origin.longitude)*rad;
 const a=Math.sin(dLat/2)**2+Math.cos(origin.latitude*rad)*Math.cos(destination.latitude*rad)*Math.sin(dLon/2)**2;
 return Math.round(6371*2*Math.atan2(Math.sqrt(Math.min(1,a)),Math.sqrt(Math.max(0,1-a))));
}
export function geoNearPlaces(origin,places,limit=3){
 if(!isGeoPlace(origin)||!Number.isInteger(limit)||limit<1||limit>10)throw new Error('Invalid verified coordinate comparison');
 return (Array.isArray(places)?places:[]).filter(p=>isGeoPlace(p)&&p.qid!==origin.qid)
  .map(p=>({...p,distanceKm:geoDistanceKm(origin,p)})).sort((a,b)=>a.distanceKm-b.distanceKm||a.qid.localeCompare(b.qid)).slice(0,limit);
}
/** Pick a deterministic subset of actual non-deprecated Earth coordinate records.
 * "Northernmost" and "southernmost" apply only to the displayed original subset. */
export function geoLatitudeChallenge(places,seed,{direction='north',count=3}={}){
 if(!['north','south'].includes(direction)||![3,4].includes(count))throw new Error('Unsupported original coordinate comparison');
 const valid=geoPlacesInView(places);
 if(valid.length<count)throw new Error('Not enough verified P625 locations in the chosen coordinate view');
 const rotated=[...valid].sort((a,b)=>hashSeed(String(seed)+':'+a.qid)-hashSeed(String(seed)+':'+b.qid)||a.qid.localeCompare(b.qid));
 const options=rotated.slice(0,count);
 const ranked=[...options].sort((a,b)=>direction==='north'?b.latitude-a.latitude:a.latitude-b.latitude);
 if(ranked[0].latitude===ranked[1].latitude)throw new Error('Latitude comparison is ambiguous at the available source precision');
 return {kind:'verified-p625-latitude',direction,options,answer:ranked[0],scope:'selected original coordinate records',ranked:false};
}
export function parseWikidataYear(entity,property){
 for(const claim of entity?.claims?.[property]||[]){
   if(claim.rank==='deprecated'||claim.mainsnak?.snaktype!=='value')continue;
   const value=claim.mainsnak?.datavalue?.value;
   if(!value||typeof value.time!=='string'||value.precision<9)continue;
   const m=value.time.match(/^([+-])(\d{4,})-\d{2}-\d{2}T/);
   if(!m)continue;
   const n=Number(m[2]);
   if(!Number.isSafeInteger(n)||n===0||n>3000)continue;
   // Wikidata's signed year is astronomical notation; BCE interpretation deserves a separate UX.
   if(m[1]==='-')continue;
   return {year:n,precision:value.precision,sourceUrl:`https://www.wikidata.org/wiki/${entity.id}#${property}`};
 }
 return null;
}
export function chronologicalFact(entity){
 if(!validQid(entity?.id))return null;
 for(const [property,type] of Object.entries(CHRONICLE_PROPERTIES)){
   const value=parseWikidataYear(entity,property);
   if(value)return {qid:entity.id,title:englishLabel(entity),type,property,...value};
 }
 return null;
}
export function chronologicalOrder(items){return [...items].sort((a,b)=>a.year-b.year||a.qid.localeCompare(b.qid));}
export function isCorrectOrder(items){const sorted=chronologicalOrder(items);return items.length>=3&&items.every((x,i)=>x.qid===sorted[i].qid);}
export function shuffleDeterministic(items,seed){
 const a=[...items]; let state=0;for(const char of String(seed))state=Math.imul(state^char.charCodeAt(0),16777619)>>>0;
 for(let i=a.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[a[i],a[j]]=[a[j],a[i]];}
 if(a.length>2&&isCorrectOrder(a))[a[0],a[1]]=[a[1],a[0]];
 return a;
}
export function changeOrder(items,from,direction){
 const to=from+direction;if(from<0||from>=items.length||to<0||to>=items.length)return items;
 const next=[...items];[next[from],next[to]]=[next[to],next[from]];return next;
}
