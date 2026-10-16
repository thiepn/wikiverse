const KEY='wikiverse:progress:v1';
export const initialProgress=()=>({version:1,races:[],mysteries:[],exploration:[],saved:{},daily:{race:null,mystery:null}});
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
export function toggleSaved(progress,article) {
  const saved={...progress.saved};const key=`${article.language}:${article.pageId}`;
  if(saved[key]) delete saved[key]; else saved[key]={...article,savedAt:new Date().toISOString()};
  return {...progress,saved};
}
