import {checkedOfflineSnapshot} from './offline.mjs';
import {searchSavedSource,sourceSelection} from './offline-workbench.mjs';
function originals(a,b){const x=checkedOfflineSnapshot(a),y=checkedOfflineSnapshot(b);if(x.key===y.key)throw Error('Choose distinct original sources');return [x,y];}
const fold=(s,lang)=>s.normalize('NFC').toLocaleLowerCase(lang);
export function compareSavedRevisions(a,b,q=''){const [x,y]=originals(a,b);if(typeof q!=='string'||q.length>100)throw Error('Search must be at most 100 characters');return {sources:[x.source,y.source],matches:[searchSavedSource(x,q),searchSavedSource(y,q)],graded:false,authority:'independent-originals-not-translation'};}
export function contrastSavedRevisions(a,b,round=0){
 const copies=originals(a,b);if(!Number.isSafeInteger(round)||round<0||round>100000)throw Error('Invalid comparison round');
 for(let step=0;step<2;step++){const target=(step+round)%2,one=copies[target],other=copies[1-target];
 for(let i=0;i<one.sections.length;i++){const section=(i+round)%one.sections.length,txt=one.sections[section];
 for(const part of [0,.4,.7]){const start=Math.max(0,Math.floor((txt.length-58)*part)),quote=txt.slice(start,start+Math.min(72,txt.length-start)).trim();
 if(quote.length<30||one.sections.filter(x=>fold(x,one.article.language).includes(fold(quote,one.article.language))).length!==1||other.sections.some(x=>fold(x,other.article.language).includes(fold(quote,other.article.language))))continue;
 return {kind:'two-originals-literal-quote',sources:copies.map(x=>x.source),keys:copies.map(x=>x.key),target,section,quote,round,graded:false,authority:'saved-literal-presence-only'};}}}
 return null;
}
export function inspectSavedContrast(a,b,prompt,choice){const correct=contrastSavedRevisions(a,b,prompt?.round);if(!correct||JSON.stringify(correct)!==JSON.stringify(prompt)||!Number.isInteger(choice)||choice<0||choice>1)throw Error('Unsupported source response');return {matched:choice===correct.target,section:correct.section,source:correct.sources[correct.target],graded:false,authority:correct.authority};}
export {sourceSelection};