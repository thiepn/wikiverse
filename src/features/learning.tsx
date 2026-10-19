import React,{useEffect,useMemo,useRef,useState} from 'react';
import {loadLanguagePair,loadLanguagePairByQid,articleParagraphs,sourcePassageCloze,sourceCloze,sourceCitations,sourceQuestion} from '../services/learning.mjs';
import {loadArticle,searchArticles} from '../services/wikimedia.mjs';
import {LEARNING_LANGUAGES,originalPassageMatches,vocabularyEntry,gradeCloze,gradeCitation,evidenceReflection} from '../domain/learning.mjs';
import {revisionUrl} from '../domain/game.mjs';
import {makeReaderHtml} from '../components/reader';
import './learning.css';
type Mode='polyglot'|'detective';
type Article={language:string;pageId:number;revisionId:number;title:string};
type Page={html:string;identity:{language:string;pageId:number;revisionId:number;title:string};links:string[]};
type LearningResult={mode:Mode;kind:string;id:string;correct:boolean;score:number;source:string;at:string};
function SourcePane({page,selected,onSelect}:{page:Page;selected?:boolean;onSelect:()=>void}){
 const clean=useMemo(()=>makeReaderHtml(page),[page]);
 const html=clean.html.replaceAll(/<a\b([^>]*)>(.*?)<\/a>/g,'<span>$2</span>');
 const source=revisionUrl(page.identity);
 return <section className={'learn-pane '+(selected?'shown':'')} lang={page.identity.language}>
  <div className="learn-pane-head"><div><span className="eyebrow">{page.identity.language.toUpperCase()} WIKIPEDIA</span><h3>{page.identity.title}</h3></div><a href={source} target="_blank" rel="noreferrer">Original revision ↗</a></div>
  <div className="learn-article" onMouseUp={onSelect} onTouchEnd={onSelect} dangerouslySetInnerHTML={{__html:html}}/>
  <footer>Adapted from Wikipedia revision {page.identity.revisionId} · <a href={source} target="_blank" rel="noreferrer">Article and contributors</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a></footer>
 </section>;
}
export default function Learning({mode,focusArticle,onSelectSource,onVocabulary,onResult,onReflection,onClip,onOffline}:{mode:Mode;focusArticle?:Article|null;onSelectSource?:(article:Article)=>void;onVocabulary:(x:any)=>void;onResult:(x:LearningResult)=>void;onReflection:(x:any)=>void;onClip:(x:any)=>void;onOffline:(page:Page)=>void}){
 const [busy,setBusy]=useState('');const [error,setError]=useState('');
 const [topic,setTopic]=useState('Marie Curie');const [language,setLanguage]=useState('fr');
 const [pair,setPair]=useState<any>(null);const [active,setActive]=useState('fr');
 const [exerciseLanguage,setExerciseLanguage]=useState('fr');const [selectedClip,setSelectedClip]=useState<any>(null);
 const [passageQuery,setPassageQuery]=useState('');const [passageFocus,setPassageFocus]=useState<{language:string;index:number}|null>(null);const [passageNotice,setPassageNotice]=useState('');
 const [word,setWord]=useState('');const [meaning,setMeaning]=useState('');const [captureLanguage,setCaptureLanguage]=useState('fr');
 const [item,setItem]=useState<any>(null);const [choice,setChoice]=useState<string|null>(null);const [round,setRound]=useState(0);
 const [evidencePage,setEvidencePage]=useState<Page|null>(null);const [citations,setCitations]=useState<any[]>([]);const [question,setQuestion]=useState<any>(null);const [citationChoice,setCitationChoice]=useState<string|null>(null);const [index,setIndex]=useState(0);const [reviewId,setReviewId]=useState('');
 const [verdict,setVerdict]=useState('insufficient');const [note,setNote]=useState('');const [reviewSaved,setReviewSaved]=useState(false);
 const operation=useRef(0);
 const selectedRecord=citations.find(x=>x.id===reviewId)||citations[0];
 const pairedLanguage=pair?.selectedLanguage||language;
 const readPage=(pair:any,lang:string)=>pair?.articles?.[lang];
 const passageViews=useMemo(()=>{
  if(mode!=='polyglot'||!pair)return [];
  return ['en',pair.selectedLanguage].map(lang=>{
   const page=readPage(pair,lang),paragraphs=page?articleParagraphs(page):[];
   return {language:lang,page,paragraphs,matches:originalPassageMatches(paragraphs,passageQuery,10)};
  });
 },[pair,mode,passageQuery]);
 const chosenPassage=passageViews.find(x=>x.language===passageFocus?.language)?.matches.find(x=>x.index===passageFocus?.index)||null;
 function nextCloze(pairValue:any,lang:string,n:number){const page=readPage(pairValue,lang);setItem(page?sourceCloze(page,String(n)):null);setChoice(null);}
 async function fetchPair(name:string,lang:string,origin='en'){
  const n=++operation.current;setBusy('Finding Wikidata-linked language editions…');setError('');
  try{const loaded=await loadLanguagePair(name,lang,origin,focusArticle&&name===focusArticle.title?focusArticle:null);
   if(focusArticle&&name===focusArticle.title){const linked=loaded.articles?.[focusArticle.language];if(!linked||linked.identity.pageId!==focusArticle.pageId)throw new Error('Loaded language edition does not match selected original Wikipedia page');}
   if(n!==operation.current)return;
   setPair(loaded);setActive(lang);setCaptureLanguage(lang);setWord('');setMeaning('');setLanguage(lang);setRound(0);setExerciseLanguage(lang);setSelectedClip(null);setPassageQuery('');setPassageFocus(null);setPassageNotice('');nextCloze(loaded,lang,0);
  }catch(e:any){if(n===operation.current)setError(e.message||'Language pair unavailable');}
  finally{if(n===operation.current)setBusy('');}
 }
 async function switchEdition(lang:string){
  if(!pair||lang==='en'||lang===pair.selectedLanguage||!pair.availableEditions?.some((x:any)=>x.language===lang))return;
  const n=++operation.current;setBusy('Verifying '+lang.toUpperCase()+' original Wikipedia edition…');setError('');
  try{const next=await loadLanguagePairByQid(pair.qid,lang,focusArticle||null);
   if(n!==operation.current)return;
   setPair(next);setLanguage(lang);setActive(lang);setCaptureLanguage(lang);setExerciseLanguage(lang);setRound(0);setWord('');setMeaning('');setSelectedClip(null);setPassageFocus(null);setPassageQuery('');setPassageNotice('');nextCloze(next,lang,0);
  }catch(e:any){if(n===operation.current)setError(e.message||'Original language edition unavailable');}finally{if(n===operation.current)setBusy('');}
 }
 function inspectPassage(lang:string,index:number){setPassageFocus({language:lang,index});setActive(lang);setCaptureLanguage(lang);setPassageNotice('');}
 function practiceOriginalPassage(lang:string,text:string){
  const page=readPage(pair,lang);
  const q=page?sourcePassageCloze(page,text,'w07:passage:'+lang+':'+round):null;
  if(!q){setPassageNotice('This original passage cannot produce a fair source-word question. Select another.');return;}
  setItem(q);setChoice(null);setExerciseLanguage(lang);setRound(n=>n+1);setPassageNotice('Original sentence practice loaded below.');
 }
 async function fetchEvidence(name:string,source?:Article|null){
  const n=++operation.current;setBusy('Retrieving Wikipedia article and citations…');setError('');setEvidencePage(null);
  try{const page=await loadArticle(name,source?.revisionId||null,'en');
   if(source&&(page.identity.pageId!==source.pageId||page.identity.revisionId!==source.revisionId))throw new Error('Pinned citation source identity changed');
   if(n!==operation.current)return;
   const citations=sourceCitations(page);setEvidencePage(page);setCitations(citations);setIndex(0);setQuestion(sourceQuestion(page,0));setCitationChoice(null);setReviewId(citations[0]?.id||'');setReviewSaved(false);
  }catch(e:any){if(n===operation.current)setError(e.message||'Article citations unavailable');}
  finally{if(n===operation.current)setBusy('');}
 }
 useEffect(()=>{const title=focusArticle?.title||'Marie Curie';setTopic(title);if(mode==='polyglot'){const lang=focusArticle?.language!=='en'&&focusArticle?.language?focusArticle.language:'fr';void fetchPair(title,lang,focusArticle?.language||'en');}else void fetchEvidence(title,focusArticle);return()=>{operation.current++;};},[mode,focusArticle?.pageId,focusArticle?.revisionId,focusArticle?.language]);
 function selectionOf(lang:string){
  const s=window.getSelection()?.toString().trim().replace(/\s+/g,' ')||'';
  if(s.length>=2&&s.length<=90){setWord(s);setCaptureLanguage(lang);}
  const article=readPage(pair,lang)?.identity;
  setSelectedClip(article&&s.length>=12&&s.length<=360?{article,excerpt:s}:null);
 }
 function saveWord(e:React.FormEvent){e.preventDefault();
  try{const article=readPage(pair,captureLanguage)?.identity;if(!article)throw new Error('Select a loaded article');
   const value=vocabularyEntry({term:word,meaning,language:captureLanguage,article,qid:pair.qid});
   onVocabulary(value);setWord('');setMeaning('');setError('');
  }catch(e:any){setError(e.message);}
 }
 function answerCloze(answer:string){
  if(!item||choice!==null)return;
  setChoice(answer);
  const correct=gradeCloze(item,answer);
  onResult({mode:'polyglot',kind:'source-cloze',id:item.id,correct,score:correct?100:0,source:revisionUrl(item.article),at:new Date().toISOString()});
 }
 function answerCitation(id:string){
  if(!question||citationChoice!==null)return;
  setCitationChoice(id);
  const correct=gradeCitation(question,id);
  onResult({mode:'detective',kind:'citation-identity',id:question.id,correct,score:correct?100:0,source:question.source,at:new Date().toISOString()});
 }
 function nextCitation(){const next=index+1;setIndex(next);setQuestion(evidencePage?sourceQuestion(evidencePage,next):null);setCitationChoice(null);}
 function saveReview(e:React.FormEvent){e.preventDefault();try{
   if(!selectedRecord)throw new Error('Select a citation');
   onReflection(evidenceReflection({citation:selectedRecord,verdict,note}));
   setReviewSaved(true);setError('');
 }catch(e:any){setError(e.message||'Review not saved');}}
 return <section className="learn">
   <div className="mode-head"><h1>{mode==='polyglot'?'WikiPolyglot':'Source Detective'}</h1></div>
   {busy&&<div className="loading" role="status">{busy}</div>}
   {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
   <form className="learn-controls" onSubmit={e=>{e.preventDefault();if(mode==='polyglot')void fetchPair(topic,language);else void fetchEvidence(topic);}}>
     <label htmlFor="learn-topic">WIKIPEDIA TOPIC</label><div className="learn-row"><input id="learn-topic" value={topic} onChange={e=>setTopic(e.target.value)} placeholder="Enter an English article title" required/>
     {mode==='polyglot'&&<select aria-label="Compare language" value={language} onChange={e=>setLanguage(e.target.value)}>{LEARNING_LANGUAGES.filter(x=>x.code!=='en').map(x=><option key={x.code} value={x.code}>{x.name}</option>)}</select>}
     <button className="primary" disabled={!!busy} type="submit">{mode==='polyglot'?'Compare articles →':'Investigate references →'}</button></div>
   </form>
   {mode==='polyglot'&&pair&&<>
     <div className="learn-source-bar"><span><b>{pair.qid}</b> · Independently verified Wikidata-linked topic</span><a href={pair.sourceUrl} target="_blank" rel="noreferrer">Inspect article pairing ↗</a>{onSelectSource&&<button onClick={()=>onSelectSource(pair.articles[active].identity)}>Use this {active.toUpperCase()} source across WikiVerse →</button>}</div>
     <div className="learn-edition-navigation" aria-label="Verified Wikipedia editions"><label>Original language edition</label><div className="learn-edition-options">{(pair.availableEditions||[]).filter((x:any)=>x.language!=='en').map((edition:any)=><button key={edition.language} disabled={!!busy} aria-pressed={pairedLanguage===edition.language} onClick={()=>void switchEdition(edition.language)}>{edition.name}</button>)}</div><span>EN revision {pair.articles.en.identity.revisionId} · {pairedLanguage.toUpperCase()} revision {pair.articles[pairedLanguage].identity.revisionId}</span></div>
     <p className="learn-honesty">Same Wikidata entity; independently written articles, not translations or aligned paragraphs.</p>
     <div className="learn-mobile-tabs"><button className={active==='en'?'active':''} onClick={()=>setActive('en')}>EN · {pair.articles.en.identity.title}</button><button className={active===pairedLanguage?'active':''} onClick={()=>setActive(pairedLanguage)}>{pairedLanguage.toUpperCase()} · {pair.articles[pairedLanguage].identity.title}</button></div>
     <div className="learn-panes"><SourcePane page={pair.articles.en} selected={active==='en'} onSelect={()=>selectionOf('en')}/><SourcePane page={pair.articles[pairedLanguage]} selected={active===pairedLanguage} onSelect={()=>selectionOf(pairedLanguage)}/></div>
     <section className="learn-passage-explorer" aria-label="Original passage comparison">
      <div className="learn-passage-bar"><h2>Compare original passages</h2><div><label htmlFor="learn-passage-query">Find exact source text</label><input id="learn-passage-query" type="search" maxLength={100} value={passageQuery} onChange={ev=>{setPassageQuery(ev.target.value);setPassageFocus(null);setPassageNotice('');}} placeholder="Original word or phrase"/></div></div>
      <div className="learn-passage-columns">{passageViews.map(view=><div key={view.language} className="learn-passage-edition" lang={view.language}>
       <div className="learn-passage-heading"><h3>{view.language.toUpperCase()} · {view.page.identity.title}</h3><a href={revisionUrl(view.page.identity)} target="_blank" rel="noreferrer">Revision {view.page.identity.revisionId} ↗</a></div>
       <div className="learn-passage-list">{view.matches.length?view.matches.map(match=><article key={match.index} className={passageFocus?.language===view.language&&passageFocus?.index===match.index?'selected':''}><div className="learn-passage-source">Source paragraph {match.index+1}</div><p>{match.text}</p><div className="learn-passage-actions">
         <button aria-pressed={passageFocus?.language===view.language&&passageFocus?.index===match.index} onClick={()=>inspectPassage(view.language,match.index)}>Inspect</button>
         <button onClick={()=>practiceOriginalPassage(view.language,match.text)}>Practice exact words →</button>
         <button disabled={match.text.length<12||match.text.length>360} onClick={()=>{onClip({article:view.page.identity,excerpt:match.text});setPassageNotice('Original '+view.language.toUpperCase()+' excerpt saved locally.');}}>Save excerpt</button>
       </div></article>):<p>No matching original passage in this edition.</p>}</div></div>)}</div>
      {chosenPassage&&<p className="learn-passage-selected" role="status">Selected {passageFocus?.language.toUpperCase()} source paragraph {chosenPassage.index+1}; not a translation of another paragraph.</p>}
      {passageNotice&&<p className="learn-passage-selected" role="status">{passageNotice}</p>}
     </section>
     <div className="learn-exercises">
       <section className="learn-panel">
        <div className="eyebrow">VOCABULARY COLLECTION</div><h2>Capture a phrase</h2><p>Enter your own meaning; no translation is generated.</p>
        <form onSubmit={saveWord}><div className="learn-row"><select aria-label="Vocabulary language" value={captureLanguage} onChange={e=>setCaptureLanguage(e.target.value)}><option value="en">EN</option><option value={pairedLanguage}>{pairedLanguage.toUpperCase()}</option></select><input aria-label="Captured phrase" value={word} onChange={e=>setWord(e.target.value)} placeholder="Selected phrase"/><input aria-label="Your meaning" value={meaning} onChange={e=>setMeaning(e.target.value)} placeholder="Your translation / meaning"/></div><button type="submit">Save to My Universe →</button></form>
        <div className="learn-clip-action"><button disabled={!selectedClip} onClick={()=>{onClip(selectedClip);setSelectedClip(null);}}>Save selected source excerpt →</button><button onClick={()=>{const page=readPage(pair,active);if(page)onOffline(page);}}>Save {active.toUpperCase()} compact offline reading →</button><span className="learn-clip-limit">Select 12–360 characters.</span></div>
       </section>
       <section className="learn-panel">
        <div className="eyebrow">SOURCE-TEXT RETRIEVAL · {exerciseLanguage.toUpperCase()}</div><h2>Complete the original sentence</h2><label htmlFor="exercise-language">Practice original edition</label><select id="exercise-language" aria-label="Exercise language" value={exerciseLanguage} onChange={e=>{setExerciseLanguage(e.target.value);setRound(0);nextCloze(pair,e.target.value,0);}}><option value="en">English original</option><option value={pairedLanguage}>{LEARNING_LANGUAGES.find(x=>x.code===pairedLanguage)?.name} original</option></select>
        {item?<><p className="learn-question" lang={exerciseLanguage}>{item.prompt}</p><div className="learn-choices">{item.choices.map((v:string)=><button className={choice===v?'chosen':''} disabled={choice!==null} key={v} lang={exerciseLanguage} onClick={()=>answerCloze(v)}>{v}</button>)}</div>{choice!==null&&<div className="learn-feedback"><strong>{gradeCloze(item,choice)?'Correct source word.':'Not the original word.'}</strong><p lang={exerciseLanguage}>{item.sourceText}</p><a href={revisionUrl(item.article)} target="_blank" rel="noreferrer">Read source revision ↗</a><button onClick={()=>{const n=round+1;setRound(n);nextCloze(pair,exerciseLanguage,n);}}>Another excerpt →</button></div>}</>:<p>No reliable fill-in excerpt is available in this article. You can still read and capture vocabulary.</p>}
        <p className="learn-fine">Grades represent exact-text retrieval, not language proficiency or semantic understanding.</p>
       </section>
     </div>
   </>}
   {mode==='detective'&&evidencePage&&<>
    <div className="learn-source-bar"><span><b>{evidencePage.identity.title}</b> · Revision {evidencePage.identity.revisionId}</span><a href={revisionUrl(evidencePage.identity)} target="_blank" rel="noreferrer">Open original article and references ↗</a>{onSelectSource&&<button onClick={()=>onSelectSource(evidencePage.identity)}>Use original source across WikiVerse →</button>}</div>
    <div className="learn-exercises">
     <section className="learn-panel">
      <div className="eyebrow">CHECKABLE EXERCISE / BIBLIOGRAPHIC LINKAGE</div><h2>Which citation is attached to this passage?</h2>
      {question?<><blockquote className="learn-question">{question.prompt}</blockquote><div className="learn-citation-choices">{question.choices.map((c:any)=><button disabled={citationChoice!==null} className={citationChoice===c.id?'chosen':''} key={c.id} onClick={()=>answerCitation(c.id)}><span className="eyebrow">{c.id}</span><span>{c.label}</span></button>)}</div>
       {citationChoice!==null&&<div className="learn-feedback"><strong>{gradeCitation(question,citationChoice)?'Correct bibliography link.':'Incorrect bibliography link.'}</strong><p>Correct citation: {question.choices.find((x:any)=>x.id===question.answerId)?.label}</p><a href={question.source} target="_blank" rel="noreferrer">Inspect the cited article revision ↗</a><button onClick={nextCitation}>Next citation →</button></div>}
      </>:<p>This article has insufficient usable external references for a fair multiple-choice question. Choose another article or use the manual investigation section below.</p>}
      <p className="learn-fine">This task grades the reference-to-passage linkage visible in the Wikipedia revision. It does not certify that the cited document supports the claim.</p>
     </section>
     <section className="learn-panel">
      <div className="eyebrow">MANUAL EVIDENCE INVESTIGATION · UNSCORED</div><h2>Evaluate a cited reference</h2>
      {citations.length?<>
       <label htmlFor="citation-select">Choose one citation</label><select id="citation-select" value={selectedRecord?.id||''} onChange={e=>{setReviewId(e.target.value);setReviewSaved(false);}}>{citations.map(x=><option key={x.id} value={x.id}>{x.label.slice(0,95)}</option>)}</select>
       {selectedRecord&&<><blockquote className="learn-question">{selectedRecord.context}</blockquote><p>{selectedRecord.label}</p><div className="learn-links">{selectedRecord.links.map((u:string)=><a key={u} href={u} target="_blank" rel="noreferrer">Open external reference ↗</a>)}<a href={selectedRecord.sourceRevision} target="_blank" rel="noreferrer">Original Wikipedia reference ↗</a></div>
       <form onSubmit={saveReview}><label htmlFor="review-verdict">Your assessment after reading the external source</label><select id="review-verdict" value={verdict} onChange={e=>{setVerdict(e.target.value);setReviewSaved(false);}}><option value="supports">Supports the claim</option><option value="contradicts">Contradicts the claim</option><option value="insufficient">Insufficient evidence</option><option value="unreviewed">Source inaccessible / not reviewed</option></select><label htmlFor="review-note">Your evidence and reasoning</label><textarea id="review-note" value={note} onChange={e=>{setNote(e.target.value);setReviewSaved(false);}} minLength={10} maxLength={2000} rows={5} placeholder="Quote or paraphrase the source passage and explain your judgment…" required/><button type="submit">Save private review →</button>{reviewSaved&&<p role="status">Review saved locally — your assessment is not machine graded.</p>}</form></>}
      </>:<p>No usable external citation records were found in this revision. No evidence judgment has been fabricated.</p>}
     </section>
    </div>
   </>}
 </section>;
}
