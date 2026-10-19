import {pageEntityId,loadEntities,loadArticle,apiRequest,normalizeWikidataEntities} from './wikimedia.mjs';
import {checkedArticle} from '../domain/study.mjs';
import {exactSource} from '../domain/journey.mjs';
import {RELATIONS,GEO_TOPICS,CHRONICLE_TOPICS,linkStatements,englishLabel,coordinate,chronologicalFact,chronologicalOrder,chronicleStatements,chronicleVisible} from '../domain/exploration.mjs';
const DATA='https://www.wikidata.org/w/api.php';
/** Wikidata is today’s associated item, not the pinned Wikipedia page ID or historical claim. */
export async function topicWikidataEvidence(input){
 const source=checkedArticle(input);
 const [pinned,current]=await Promise.all([loadArticle(source.title,source.revisionId,source.language),loadArticle(source.title,null,source.language)]);
 exactSource(pinned.identity,source);
 if(current.identity.pageId!==source.pageId)throw new Error('Article title now points to a different Wikipedia page');
 const qid=await pageEntityId(current.identity.title,source.language);
 if(!qid)throw new Error('No current Wikidata sitelink for the selected article');
 const entity=(await loadEntities([qid]))[qid];
 if(!entity||entity.missing||entity.id!==qid)throw new Error('Linked Wikidata item unavailable');
 return {article:source,qid,entityUrl:`https://www.wikidata.org/wiki/${qid}`,coordinate:coordinate(entity),dated:chronologicalFact(entity)};
}

async function resolveTopic(title){const id=await pageEntityId(title);return id ? {title,id} : null;}
export async function galaxyForTitle(title){
 const resolved=await resolveTopic(title);
 if(!resolved)throw new Error('This Wikipedia article does not have a Wikidata entity.');
 return galaxyForQid(resolved.id);
}
export async function galaxyForQid(qid){
 if(!/^Q[1-9]\d*$/.test(qid||''))throw new Error('Invalid Wikidata entity ID.');
 const root=(await loadEntities([qid]))[qid];
 if(!root || root.missing)throw new Error('Entity unavailable.');
 const links=linkStatements(root,24);
 const related=links.length?await loadEntities(links.map(x=>x.to)):{};
 const edges=links.filter(x=>related[x.to]&&!related[x.to].missing).map(x=>({...x,title:englishLabel(related[x.to])}));
 return {root:{id:qid,title:englishLabel(root),description:root.descriptions?.en?.value||'',sourceUrl:`https://www.wikidata.org/wiki/${qid}`},edges,groups:[...new Set(edges.map(x=>x.property))].map(p=>({property:p,label:RELATIONS[p],count:edges.filter(x=>x.property===p).length}))};
}
/** QID -> English Wikipedia requires a real Wikidata sitelink, Wikipedia pageprops
 * confirming that exact QID, and a loaded canonical article before in-app navigation. */
export async function verifiedGalaxyWikipedia(qid){
 if(!/^Q[1-9]\d*$/.test(qid||''))throw new Error('Invalid Wikidata item for Wikipedia reading');
 const response=await apiRequest(DATA,{action:'wbgetentities',ids:qid,props:'sitelinks',sitefilter:'enwiki'},{ttl:24*60*60_000});
 const linked=normalizeWikidataEntities(response.entities)?.[qid];
 const title=linked?.sitelinks?.enwiki?.title;
 if(!title||typeof title!=='string')throw new Error('This Wikidata item has no verified English Wikipedia article');
 const confirmed=await pageEntityId(title,'en');
 if(confirmed!==qid)throw new Error('Wikipedia article no longer confirms this Wikidata item; source handoff refused');
 const page=await loadArticle(title,null,'en');
 if(page.identity.language!=='en'||page.identity.pageId<1||page.identity.revisionId<1)throw new Error('Linked Wikipedia article has no verifiable identity');
 const again=await pageEntityId(page.identity.title,'en');
 if(again!==qid)throw new Error('Resolved Wikipedia article is no longer linked to the same Wikidata item');
 return {qid,article:page.identity,sourceUrl:'https://www.wikidata.org/wiki/'+qid};
}
export async function sourceCatalog(topics, project){
 const resolved=await Promise.allSettled(topics.map(resolveTopic));
 const candidates=resolved.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value);
 if(!candidates.length)throw new Error('Wikidata is unavailable for the selected topics.');
 const entities=await loadEntities(candidates.map(x=>x.id));
 return candidates.map(({id,title})=>{const entity=entities[id];if(!entity||entity.missing)return null;return project(entity,title);}).filter(Boolean);
}
/** Inspect only real P17/P131 current Wikidata statements on a source location.
 * Not a coordinate calculation or a guessed national/administrative boundary. */
export async function geoPlaceRelations(qid){
 if(!/^Q[1-9]\d*$/.test(qid||''))throw new Error('Invalid Wikidata place QID');
 const root=(await loadEntities([qid]))[qid];
 if(!root||root.missing)throw new Error('Selected Wikidata place unavailable');
 const refs=linkStatements(root,24).filter(item=>item.property==='P17'||item.property==='P131').slice(0,6);
 if(!refs.length)return [];
 const targets=await loadEntities(refs.map(item=>item.to));
 return refs.filter(item=>targets[item.to]&&!targets[item.to].missing).map(item=>({...item,title:englishLabel(targets[item.to])}));
}
export async function loadGeoCatalog(){
 const records=await sourceCatalog(GEO_TOPICS,(entity,articleTitle)=>{
   const position=coordinate(entity);if(!position)return null;
   return {...position,title:englishLabel(entity),articleTitle,entityUrl:`https://www.wikidata.org/wiki/${entity.id}`};
 });
 if(records.length<3)throw new Error('Not enough source-verified places are available.');
 return records;
}
/** Original W06 date timeline; no de-duplication by year or guessed precision.
 * Each record keeps its Wikidata QID, P-property, claim ID, and source article title. */
export async function loadChronicleStatements(){
 const records=await sourceCatalog(CHRONICLE_TOPICS,(entity,articleTitle)=>chronicleStatements(entity).map(row=>({...row,articleTitle})));
 const flat=records.flat();
 if(flat.length<4)throw new Error('Not enough original date statements are available for a timeline');
 return chronicleVisible(flat);
}
/** Only the currently resolved W02 topic entity is eligible; not a historical inference
 * about a pinned old Wikipedia revision, and not automatically graded as a catalog event. */
export async function chronicleTopicStatements(qid){
 if(!/^Q[1-9]\d*$/.test(qid||''))throw new Error('Invalid original Wikidata topic QID');
 const entity=(await loadEntities([qid]))[qid];
 if(!entity||entity.missing)throw new Error('Current source entity unavailable');
 return chronicleStatements(entity);
}
export async function loadChronicle(){
 const records=await sourceCatalog(CHRONICLE_TOPICS,(entity,articleTitle)=>{
   const fact=chronologicalFact(entity);return fact?{...fact,articleTitle}:null;
 });
 const unique=new Map();for(const record of chronologicalOrder(records))if(!unique.has(record.year))unique.set(record.year,record);
 if(unique.size<4)throw new Error('Not enough reliably dated events are available.');
 return chronologicalOrder([...unique.values()]);
}
