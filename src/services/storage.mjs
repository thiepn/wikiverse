import {isArticleTitle} from '../domain/game.mjs';
const KEY='wikiverse:progress:v1';
export const initialProgress=()=>({version:1,races:[],mysteries:[],exploration:[],learning:[],vocabulary:[],evidenceReviews:[],historyChallenges:[],arenaAttempts:[],knowledgeAttempts:[],linkLab:[],readingHistory:[],studyNotes:[],sourceClips:[],offlineArticles:[],reviewMarkers:{},saved:{},daily:{race:null,mystery:null,arena:null}});
export function readProgress(storage=globalThis.localStorage) {
  try {
    const x=JSON.parse(storage.getItem(KEY));
    if (x?.version!==1 || !Array.isArray(x.races) || !Array.isArray(x.mysteries) || !x.saved || typeof x.saved!=='object') return initialProgress();
    return {...initialProgress(),...x,daily:{...initialProgress().daily,...x.daily}};
  } catch {return initialProgress();}
}
export function saveProgress(value,storage=globalThis.localStorage) {
  const serialized=JSON.stringify({...value,version:1});
  if (serialized.length>1_000_000) throw new Error('Local progress storage is full');
  storage.setItem(KEY,serialized);
}
export function recordRace(progress,entry) {return {...progress,races:[entry,...progress.races].slice(0,100)};}
export function recordMystery(progress,entry) {return {...progress,mysteries:[entry,...progress.mysteries].slice(0,100)};}
export function recordExploration(progress,entry) {return {...progress,exploration:[entry,...(progress.exploration||[])].slice(0,100)};}

export function recordLearning(progress,entry) {
 if(!['polyglot','detective'].includes(entry?.mode)||!['source-cloze','citation-identity'].includes(entry?.kind))throw new Error('Invalid learning result');
 return {...progress,learning:[{...entry},...(progress.learning||[])].slice(0,150)};
}
export function saveVocabulary(progress,entry) {
 if(!entry?.id||!entry?.article?.revisionId)throw new Error('Vocabulary requires source identity');
 return {...progress,vocabulary:[entry,...(progress.vocabulary||[]).filter(v=>v.id!==entry.id)].slice(0,120)};
}
export function recordEvidenceReview(progress,entry) {
 if(entry?.graded!==false||!entry?.source)throw new Error('Evidence reflections cannot receive machine grades');
 return {...progress,evidenceReviews:[entry,...(progress.evidenceReviews||[]).filter(v=>!(v.id===entry.id&&v.source===entry.source))].slice(0,100)};
}

export function recordHistoryChallenge(progress,entry){
 if(!['pulse','capsule'].includes(entry?.mode)||!['pageviews-comparison','revision-change'].includes(entry?.kind)||!Array.isArray(entry.sourceIds)||!entry.sourceIds.length||typeof entry.correct!=='boolean'||!Number.isFinite(entry.score))throw new Error('Invalid source-backed historical result');
 const record={...entry,id:entry.mode+':'+entry.at+':'+entry.sourceIds.join('|')};
 return {...progress,historyChallenges:[record,...(progress.historyChallenges||[])].slice(0,120)};
}


export function recordArenaAttempt(progress,attempt){
 if(attempt?.ranked!==false||attempt?.score!==null||!Array.isArray(attempt?.sourceIds)||attempt.sourceIds.length!==3||!attempt.challengeId||!Number.isSafeInteger(attempt.mistakes)||attempt.mistakes<0)throw new Error('Invalid unranked trail attempt');
 return {...progress,arenaAttempts:[attempt,...(progress.arenaAttempts||[])].slice(0,120)};
}


export function recordKnowledgeAttempt(progress,entry){
 if(entry?.kind!=='wikidata-relationship'||entry?.mode!=='galaxy'||!Array.isArray(entry.qids)||entry.qids.length!==2||!entry.qids.every(x=>/^Q[1-9]\d*$/.test(x))||!/^https:\/\/www\.wikidata\.org\/wiki\/Q\d+#P\d+$/.test(entry.source||'')||typeof entry.correct!=='boolean'||entry.scoringAuthority!=='wikidata-property-identity-only')throw new Error('Invalid Wikidata identity practice result');
 return {...progress,knowledgeAttempts:[entry,...(progress.knowledgeAttempts||[])].slice(0,120)};
}


export function recordLinkLab(progress,entry){
 if(!['wikipedia-outgoing-link','wikipedia-common-link','wikipedia-link-origin'].includes(entry?.kind)||entry?.mode!=='linklab'||entry?.scoringAuthority!=='pinned-article-links'||entry?.ranked!==false||!Array.isArray(entry.sourceIds)||entry.sourceIds.length!==2||entry?.primary?.pageId===entry?.contrast?.pageId||!Array.isArray(entry.sourceUrls)||entry.sourceUrls.length!==2||typeof entry.correct!=='boolean')throw new Error('Invalid original-source link practice result');
 if(entry.subject!==undefined&&(entry.kind!=='wikipedia-link-origin'||!isArticleTitle(entry.subject)||entry.subject.length>190))throw new Error('Invalid original target-link identity');
 return {...progress,linkLab:[entry,...(progress.linkLab||[])].slice(0,120)};
}

export function toggleSaved(progress,article) {
  const saved={...progress.saved};const key=`${article.language}:${article.pageId}`;
  if(saved[key]) delete saved[key]; else saved[key]={...article,savedAt:new Date().toISOString()};
  return {...progress,saved};
}
