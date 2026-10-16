/** Wikidata-source-only exploration projections. No inferred relationships or fabricated locations. */
export const RELATIONS = Object.freeze({
 P31:'instance of',P279:'subclass of',P106:'occupation',P19:'place of birth',P20:'place of death',
 P17:'country',P131:'located in',P361:'part of',P101:'field of work',P69:'educated at',
 P108:'employer',P166:'award received',P800:'notable work',P50:'author',P170:'creator',
 P61:'discoverer',P84:'architect',P176:'manufacturer',P138:'named after',P527:'has part',P22:'father',P25:'mother'
});
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
