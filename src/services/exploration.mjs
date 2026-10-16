import {pageEntityId,loadEntities} from './wikimedia.mjs';
import {RELATIONS,GEO_TOPICS,CHRONICLE_TOPICS,linkStatements,englishLabel,coordinate,chronologicalFact,chronologicalOrder} from '../domain/exploration.mjs';
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
export async function sourceCatalog(topics, project){
 const resolved=await Promise.allSettled(topics.map(resolveTopic));
 const candidates=resolved.filter(x=>x.status==='fulfilled'&&x.value).map(x=>x.value);
 if(!candidates.length)throw new Error('Wikidata is unavailable for the selected topics.');
 const entities=await loadEntities(candidates.map(x=>x.id));
 return candidates.map(({id,title})=>{const entity=entities[id];if(!entity||entity.missing)return null;return project(entity,title);}).filter(Boolean);
}
export async function loadGeoCatalog(){
 const records=await sourceCatalog(GEO_TOPICS,(entity,articleTitle)=>{
   const position=coordinate(entity);if(!position)return null;
   return {...position,title:englishLabel(entity),articleTitle,entityUrl:`https://www.wikidata.org/wiki/${entity.id}`};
 });
 if(records.length<3)throw new Error('Not enough source-verified places are available.');
 return records;
}
export async function loadChronicle(){
 const records=await sourceCatalog(CHRONICLE_TOPICS,(entity,articleTitle)=>{
   const fact=chronologicalFact(entity);return fact?{...fact,articleTitle}:null;
 });
 const unique=new Map();for(const record of chronologicalOrder(records))if(!unique.has(record.year))unique.set(record.year,record);
 if(unique.size<4)throw new Error('Not enough reliably dated events are available.');
 return chronologicalOrder([...unique.values()]);
}
