import {normalizeTitle,hashSeed} from './game.mjs';
export const LEARNING_LANGUAGES=Object.freeze([{code:'en',name:'English'},{code:'fr',name:'Français'},{code:'de',name:'Deutsch'},{code:'ko',name:'한국어'},{code:'tr',name:'Türkçe'}]);
export const supportedLanguage=code=>LEARNING_LANGUAGES.some(x=>x.code===code);
export function pairedSitelinks(entity,secondary){
 if(!/^Q[1-9]\d*$/.test(entity?.id||'')||!supportedLanguage(secondary)||secondary==='en')throw new Error('Unsupported language pair');
 const site=entity.sitelinks||{};
 const en=site.enwiki, other=site[secondary+'wiki'];
 if(!en?.title||!other?.title||!normalizeTitle(en.title)||!normalizeTitle(other.title))throw new Error('This topic lacks articles in both selected languages');
 return {qid:entity.id,left:{language:'en',title:normalizeTitle(en.title)},right:{language:secondary,title:normalizeTitle(other.title)}};
}
/** Available Wikimedia sitelinks are actual language editions, never translated labels. */
export function originalEditionOptions(entity){
 if(!/^Q[1-9]\d*$/.test(entity?.id||''))return [];
 return LEARNING_LANGUAGES.flatMap(({code,name})=>{
  const title=entity.sitelinks?.[code+'wiki']?.title;
  return typeof title==='string'&&normalizeTitle(title)?[{language:code,name,title:normalizeTitle(title)}]:[];
 });
}
/** Literal Unicode-aware matching within independently authored source paragraphs.
 * Returns source excerpts only. A match in another edition means no translation equivalence. */
export function originalPassageMatches(paragraphs,query='',limit=8){
 if(!Number.isInteger(limit)||limit<1||limit>24)throw new Error('Unsupported source passage limit');
 const text=String(query||'').trim().normalize('NFC').slice(0,100).toLocaleLowerCase();
 return (Array.isArray(paragraphs)?paragraphs:[]).flatMap((value,index)=>{
  const paragraph=String(value||'').replace(/\s+/g,' ').trim().normalize('NFC');
  if(paragraph.length<12||paragraph.length>3000||text&&!paragraph.toLocaleLowerCase().includes(text))return [];
  return [{index,text:paragraph}];
 }).slice(0,limit);
}
export function vocabularyEntry(input) {
 const {language,term,meaning,article,qid}=input||{};
 const word=String(term||'').trim().replace(/\s+/g,' ');
 const translation=String(meaning||'').trim();
 if(!supportedLanguage(language)||word.length<2||word.length>90||/\n/.test(word)||translation.length<2||translation.length>250||!article||article.language!==language||!Number.isSafeInteger(article.pageId)||!Number.isSafeInteger(article.revisionId))throw new Error('Choose a short expression and provide a meaning');
 return {id:language+':'+article.pageId+':'+word.toLocaleLowerCase(language),term:word,meaning:translation,language,article:{language:article.language,pageId:article.pageId,revisionId:article.revisionId,title:article.title},qid:/^Q[1-9]\d*$/.test(qid||'')?qid:null,savedAt:new Date().toISOString()};
}
export function clozeFromParagraphs(paragraphs, identity, seed='1'){
 if(!identity?.pageId||!identity?.revisionId)return null;
 const candidates=[];
 for(const p of paragraphs){
   const s=String(p||'').replace(/\s+/g,' ').trim();
   if(s.length<45||s.length>360)continue;
   const words=[...s.matchAll(/[\p{L}][\p{L}\p{M}-]{4,}/gu)].map(x=>({term:x[0],index:x.index}));
   if(words.length<6)continue;
   const unique=[...new Set(words.map(x=>x.term.toLocaleLowerCase(identity.language)))];
   if(unique.length<6)continue;
   candidates.push({sentence:s,words,unique});
 }
 if(!candidates.length)return null;
 const sample=candidates[hashSeed(String(seed)+':'+identity.revisionId)%candidates.length];
 const chosen=sample.words[hashSeed(String(seed)+':word')%sample.words.length];
 const lower=chosen.term.toLocaleLowerCase(identity.language);
 const distractions=sample.unique.filter(x=>x!==lower&&Math.abs(x.length-lower.length)<=5&&x.length>=4).slice(0,18);
 if(distractions.length<3)return null;
 const choices=[chosen.term,...distractions.slice(0,3)];
 for(let i=choices.length-1;i>0;i--){const j=hashSeed(seed+':'+i)% (i+1);[choices[i],choices[j]]=[choices[j],choices[i]];}
 const prompt=sample.sentence.slice(0,chosen.index)+'_____'+sample.sentence.slice(chosen.index+chosen.term.length);
 return {id:identity.language+':'+identity.pageId+':'+identity.revisionId+':'+lower,language:identity.language,article:identity,prompt,answer:chosen.term,choices,sourceText:sample.sentence,kind:'source-cloze',rulesVersion:1};
}
export function gradeCloze(question,choice){
 return !!question?.choices?.includes(choice)&&String(choice).normalize('NFC')===String(question.answer).normalize('NFC');
}
export function normalizeCitationRecord(record,source){
 if(!Number.isSafeInteger(source?.pageId)||!Number.isSafeInteger(source?.revisionId))return null;
 const id=String(record?.id||'');
 const label=String(record?.label||'').replace(/\s+/g,' ').trim();
 const context=String(record?.context||'').replace(/\s+/g,' ').trim();
 const links=[...new Set((record?.links||[]).filter(x=>{try{let u=new URL(x);return u.protocol==='https:'&&u.hostname.length>3;}catch{return false;}}))].slice(0,4);
 if(!/^cite_note[-\w:.]{1,90}$/.test(id)||label.length<12||context.length<25||links.length===0)return null;
 return {id,label:label.slice(0,250),context:context.slice(0,500),links,article:source,sourceRevision:'https://'+source.language+'.wikipedia.org/w/index.php?oldid='+source.revisionId+'#'+encodeURIComponent(id)};
}
export function citationQuestion(records,index=0){
 const selected=records.filter(x=>x&&x.links?.length&&x.context);
 const unique=selected.filter((r,i)=>selected.findIndex(t=>t.id===r.id)===i);
 if(unique.length<3)return null;
 const target=unique[index%unique.length];
 const incorrect=unique.filter(x=>x.id!==target.id&&x.label!==target.label).slice(0,3);
 if(incorrect.length<2)return null;
 const opts=[target,...incorrect].sort((a,b)=>hashSeed(a.id+':'+index)-hashSeed(b.id+':'+index));
 return {id:target.article.language+':'+target.article.pageId+':'+target.article.revisionId+':'+target.id,source:target.sourceRevision,kind:'citation-identity',prompt:target.context,choices:opts.map(r=>({id:r.id,label:r.label,links:r.links})),answerId:target.id,article:target.article};
}
export function gradeCitation(question,choiceId){return question?.kind==='citation-identity'&&question.choices.some(c=>c.id===choiceId)&&question.answerId===choiceId;}
/** W08 original bibliographic records only: search title, citation ID, passage and linked URLs.
 * This is a literal index over records from the existing Wikipedia citation parser,
 * not a claim of external-source support or a new storage/index authority. */
export function searchableCitations(records,query=''){
 const term=String(query||'').normalize('NFC').trim().toLocaleLowerCase().slice(0,120);
 const seen=new Set();
 return (Array.isArray(records)?records:[]).filter(record=>{
  const id=record?.id,article=record?.article;
  if(typeof id!=='string'||!/^cite_note[-\w:.]{1,90}$/.test(id)||seen.has(id)||!article?.revisionId||!record.sourceRevision||!Array.isArray(record.links))return false;
  seen.add(id);
  if(!term)return true;
  return [id,record.label,record.context,...record.links].some(value=>String(value||'').normalize('NFC').toLocaleLowerCase().includes(term));
 });
}
/** Compare original excerpts and exact external URL overlap; never infer semantic
 * equivalence, factual corroboration, independence, or evidence quality. */
export function citationComparison(records,ids){
 if(!Array.isArray(ids)||ids.length<2||ids.length>3||new Set(ids).size!==ids.length)throw new Error('Choose two or three distinct original citations');
 const source=searchableCitations(records);
 const chosen=ids.map(id=>source.find(x=>x.id===id));
 if(chosen.some(x=>!x))throw new Error('A selected citation is no longer available in this original revision');
 const first=chosen[0].article;
 if(chosen.some(x=>x.article?.language!==first.language||x.article?.pageId!==first.pageId||x.article?.revisionId!==first.revisionId))throw new Error('Do not compare citations from unrelated revisions');
 const links=chosen.map(x=>new Set(x.links));
 const sharedUrls=[...links[0]].filter(url=>links.every(group=>group.has(url)));
 return {article:{language:first.language,pageId:first.pageId,revisionId:first.revisionId,title:first.title},citations:chosen.map((x,i)=>({
   id:x.id,label:x.label,context:x.context,links:[...x.links],sourceRevision:x.sourceRevision,
   uniqueUrls:x.links.filter(url=>links.every((set,j)=>i===j||!set.has(url)))
  })),
  sharedUrls,identicalPassages:chosen.every(x=>x.context===chosen[0].context),kind:'literal-original-citation-comparison',graded:false};
}
/** Move through the original unique citation order without guessing missing IDs. */
export function adjacentCitation(records,currentId,delta){
 if(delta!==1&&delta!==-1)throw new Error('Unsupported original citation navigation');
 const rows=searchableCitations(records),i=rows.findIndex(x=>x.id===currentId);
 return i<0?null:rows[i+delta]||null;
}
export function evidenceReflection({citation,verdict,note}){
 if(!citation?.sourceRevision||!['supports','contradicts','insufficient','unreviewed'].includes(verdict))throw new Error('Select a valid evidence assessment');
 const content=String(note||'').trim();
 if(content.length<10||content.length>2000)throw new Error('Explain your reasoning in at least 10 characters');
 return {id:citation.id,verdict,note:content,source:citation.sourceRevision,links:[...citation.links],at:new Date().toISOString(),graded:false};
}
