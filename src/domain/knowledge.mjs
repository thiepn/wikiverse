import {hashSeed} from './game.mjs';
/** Grade what Wikidata records, not whether a statement is universally true. */
export function sourceRelationQuestion(graph,index=0){
 if(!/^Q[1-9]\d*$/.test(graph?.root?.id||'')||!Array.isArray(graph.edges))return null;
 const valid=graph.edges.filter(e=>/^Q[1-9]\d*$/.test(e.to||'')&&/^P[1-9]\d*$/.test(e.property||'')&&typeof e.title==='string'&&e.title.trim().length&&typeof e.label==='string'&&e.label.trim().length&&e.sourceUrl==='https://www.wikidata.org/wiki/'+graph.root.id+'#'+e.property);
 const labels=new Map(valid.map(e=>[e.property,e.label]));
 if(labels.size<2)return null;
 const candidates=valid.filter(e=>valid.filter(other=>other.to===e.to&&other.property!==e.property).length===0);
 if(!candidates.length)return null;
 const target=candidates[hashSeed(graph.root.id+':'+index)%candidates.length];
 const choices=[target.property,...[...labels.keys()].filter(x=>x!==target.property)].slice(0,4);
 const reordered=choices.sort((a,b)=>hashSeed(a+':'+index)-hashSeed(b+':'+index));
 return {kind:'wikidata-relationship',id:graph.root.id+':'+target.to+':'+target.property,root:graph.root.id,rootTitle:graph.root.title,target:target.to,targetTitle:target.title,answer:target.property,choices:reordered.map(property=>({property,label:labels.get(property)})),source:target.sourceUrl};
}
export function gradeRelationQuestion(question,choice){return !!question&&question.kind==='wikidata-relationship'&&question.choices.some(c=>c.property===choice)&&question.answer===choice;}
export function knowledgeResult(question,choice){
 if(!question?.source||!question.root||!question.target||!question.choices?.some(c=>c.property===choice))throw new Error('Invalid sourced knowledge response');
 const correct=gradeRelationQuestion(question,choice);
 return {mode:'galaxy',kind:'wikidata-relationship',id:question.id,propertyId:question.answer,qids:[question.root,question.target],choice,correct,score:correct?100:0,source:question.source,at:new Date().toISOString(),scoringAuthority:'wikidata-property-identity-only'};
}
