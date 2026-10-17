/** Stateless, offline study against user-saved original Wikipedia text; never an original-game grader. */
import {checkedOfflineSnapshot} from './offline.mjs';
const fold=(value,language)=>String(value).normalize('NFC').toLocaleLowerCase(language);
function source(snapshot){return checkedOfflineSnapshot(snapshot);}
function roundNumber(value){
 if(!Number.isSafeInteger(value)||value<0||value>100000)throw new Error('Invalid local practice round');
 return value;
}
export function searchSavedSource(snapshot,query){
 const copy=source(snapshot);
 if(typeof query!=='string'||query.length>100)throw new Error('Search must be at most 100 characters');
 const term=query.trim();
 if(!term)return [];
 const needle=fold(term,copy.article.language);
 return copy.sections.flatMap((paragraph,index)=>{
  const content=fold(paragraph,copy.article.language),at=content.indexOf(needle);
  if(at<0)return [];
  const start=Math.max(0,at-48),end=Math.min(paragraph.length,at+term.length+64);
  return [{index,excerpt:(start?'…':'')+paragraph.slice(start,end)+(end<paragraph.length?'…':''),source:copy.source}];
 }).slice(0,24);
}
/** A traceable quote is only eligible when it uniquely occurs in one saved passage. */
export function sourceLocator(snapshot,round=0){
 const copy=source(snapshot),n=copy.sections.length,seed=roundNumber(round);
 if(n<2)return null;
 for(let offset=0;offset<n;offset++){
  const target=(seed+offset)%n,paragraph=copy.sections[target];
  for(const fraction of [.25,.5,0,.7]){
   const pos=Math.max(0,Math.min(paragraph.length-35,Math.floor((paragraph.length-55)*fraction)));
   const quote=paragraph.slice(pos,pos+Math.min(55,paragraph.length-pos)).trim();
   if(quote.length<28)continue;
   if(copy.sections.filter(s=>fold(s,copy.article.language).includes(fold(quote,copy.article.language))).length!==1)continue;
   const choices=[target];
   for(let step=1;step<n&&choices.length<3;step++)choices.push((target+step)%n);
   choices.sort((a,b)=>a-b);
   return {kind:'local-source-locator',source:copy.source,article:copy.article,round:seed,target,quote,choices,graded:false,authority:'saved-text-match-only'};
  }
 }
 return null;
}
export function inspectLocator(snapshot,challenge,choice){
 const copy=source(snapshot),expected=sourceLocator(copy,challenge?.round);
 if(!expected||JSON.stringify(challenge)!==JSON.stringify(expected)||!Number.isSafeInteger(choice)||!expected.choices.includes(choice))throw new Error('Unsupported source-locator response');
 return {matched:choice===expected.target,section:expected.target,source:copy.source,graded:false,authority:'saved-text-match-only'};
}
/** Original paragraph order is verifiable; the exercise makes no claims about truth or mastery. */
export function sourceSequence(snapshot,round=0){
 const copy=source(snapshot),seed=roundNumber(round);
 if(copy.sections.length<3)return null;
 const first=seed%(copy.sections.length-2);
 const indices=[first,first+1,first+2];
 const shuffled=seed%2?[indices[1],indices[2],indices[0]]:[indices[2],indices[0],indices[1]];
 return {kind:'local-source-order',source:copy.source,article:copy.article,round:seed,indices,shuffled,graded:false,authority:'saved-paragraph-order-only'};
}
export function inspectSequence(snapshot,challenge,submitted){
 const copy=source(snapshot),expected=sourceSequence(copy,challenge?.round);
 if(!expected||JSON.stringify(challenge)!==JSON.stringify(expected)||!Array.isArray(submitted)||submitted.length!==3||new Set(submitted).size!==3||!submitted.every(x=>expected.indices.includes(x)))throw new Error('Unsupported source-order response');
 return {matched:submitted.every((x,i)=>x===expected.indices[i]),source:copy.source,expected:expected.indices,graded:false,authority:'saved-paragraph-order-only'};
}
export function sourceSelection(snapshot,selection){
 const copy=source(snapshot),excerpt=String(selection||'').replace(/\s+/g,' ').trim();
 if(excerpt.length<12||excerpt.length>360||!copy.sections.some(section=>section.includes(excerpt)))throw new Error('Select 12–360 characters within one saved source paragraph');
 return {article:copy.article,excerpt};
}
