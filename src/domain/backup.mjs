/** Explicit, owner-controlled, browser-local backup. SHA256 detects accidental changes, NOT authenticates an author. */
import {initialProgress,saveProgress} from '../services/storage.mjs';
import {checkedArticle,sourceRevisionUrl} from './study.mjs';
export const BACKUP_KIND='wikiverse-local-backup';
export const BACKUP_FORMAT=1;
const MAX_BYTES=1_150_000;
const CATEGORIES={races:100,mysteries:100,exploration:100,learning:150,vocabulary:120,evidenceReviews:100,historyChallenges:120,arenaAttempts:120,knowledgeAttempts:120,linkLab:120,readingHistory:140,studyNotes:120};
const SENSITIVE_KEYS=new Set(['__proto__','prototype','constructor']);
const KEYS=new Set([...Object.keys(CATEGORIES),'saved','reviewMarkers','daily','version']);
const isObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const encode=x=>new TextEncoder().encode(x);
const hex=bytes=>[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');
const utfLength=x=>encode(x).length;
async function checksum(x){return hex(await crypto.subtle.digest('SHA-256',encode(JSON.stringify(x))));}
function boundedClone(value,depth=0){
 if(depth>15)throw new Error('Backup structure is too deeply nested');
 if(value===null||typeof value==='boolean')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('Non-finite number in backup');return value;}
 if(typeof value==='string'){if(value.length>15000)throw new Error('Oversized value in backup');return value;}
 if(Array.isArray(value)){if(value.length>350)throw new Error('Oversized list in backup');return value.map(x=>boundedClone(x,depth+1));}
 if(!isObject(value))throw new Error('Unexpected backup value');
 if(Object.keys(value).length>350)throw new Error('Oversized object in backup');
 const object=Object.create(null);
 for(const [key,val] of Object.entries(value)){
  if(SENSITIVE_KEYS.has(key)||key.length>180)throw new Error('Unsafe backup property');
  object[key]=boundedClone(val,depth+1);
 }
 return object;
}
function checkedProgress(value){
 if(!isObject(value)||value.version!==1||Object.keys(value).some(k=>!KEYS.has(k)))throw new Error('Unsupported progress schema; original local data is unchanged');
 const clean=boundedClone(value);
 for(const [name,limit] of Object.entries(CATEGORIES)){
  if(!Array.isArray(clean[name])||clean[name].length>limit)throw new Error('Unsupported or oversized '+name+' history');
  for(const entry of clean[name])if(!isObject(entry))throw new Error('Invalid '+name+' history entry');
 }
 for(const key of ['saved','daily','reviewMarkers'])if(!isObject(clean[key]))throw new Error('Invalid '+key+' records');
 if(Object.keys(clean.saved).length>180||Object.keys(clean.reviewMarkers).length>180)throw new Error('Oversized local records');
 for(const [key,entry] of Object.entries(clean.saved)){
  const id=checkedArticle(entry);
  if(key!==id.language+':'+id.pageId)throw new Error('Saved page identity mismatch');
 }
 for(const note of clean.studyNotes){const id=checkedArticle(note.article);if(note.key!==id.language+':'+id.pageId||note.source!==sourceRevisionUrl(id)||typeof note.note!=='string'||note.note.length<3||note.note.length>1600||!['open','revisit','archived'].includes(note.status))throw new Error('Invalid source-linked research note');}
 for(const item of clean.readingHistory){const id=checkedArticle(item.article);if(item.source!==sourceRevisionUrl(id)||!validDate(item.at)||item.from&&checkedArticle(item.from).language!==id.language)throw new Error('Invalid reading source identity');}
 for(const entry of clean.linkLab){const a=checkedArticle(entry.primary),b=checkedArticle(entry.contrast);if(a.language!==b.language||a.pageId===b.pageId||entry.scoringAuthority!=='pinned-article-links'||entry.ranked!==false||typeof entry.correct!=='boolean'||!['wikipedia-outgoing-link','wikipedia-common-link'].includes(entry.kind)||!Array.isArray(entry.sourceUrls)||entry.sourceUrls[0]!==sourceRevisionUrl(a)||entry.sourceUrls[1]!==sourceRevisionUrl(b))throw new Error('Invalid pinned Link Lab result');}
 for(const entry of clean.vocabulary){checkedArticle(entry.article);if(typeof entry.term!=='string'||!entry.term||typeof entry.meaning!=='string')throw new Error('Invalid vocabulary source identity');}
 for(const entry of clean.arenaAttempts){if(entry.ranked!==false||entry.score!==null||!Array.isArray(entry.sourceIds)||entry.sourceIds.length!==3)throw new Error('Invalid local-only arena result');}
 if(Object.keys(clean.daily).some(k=>!['race','mystery','arena'].includes(k)))throw new Error('Invalid daily manifest field');
 const output={...initialProgress(),...clean,daily:{...initialProgress().daily,...clean.daily}};
 if(utfLength(JSON.stringify(output))>1_000_000)throw new Error('Progress exceeds existing local storage limit');
 return output;
}
export function progressCounts(progress){return Object.fromEntries([...Object.keys(CATEGORIES),'saved','reviewMarkers'].map(k=>[k,k==='saved'||k==='reviewMarkers'?Object.keys(progress[k]||{}).length:(progress[k]||[]).length]));}
export async function exportProgressBackup(progress,now=new Date()){
 const safe=checkedProgress(progress);
 if(!Number.isFinite(now.getTime()))throw new Error('Invalid backup timestamp');
 const payload={kind:BACKUP_KIND,format:BACKUP_FORMAT,exportedAt:now.toISOString(),progress:safe};
 return JSON.stringify({...payload,sha256:await checksum(payload)},null,2);
}
export async function inspectProgressBackup(text){
 if(typeof text!=='string'||utfLength(text)>MAX_BYTES)throw new Error('Backup file is too large (maximum 1.15 MB)');
 let envelope;try{envelope=JSON.parse(text);}catch{throw new Error('Invalid backup JSON');}
 if(!isObject(envelope)||envelope.kind!==BACKUP_KIND||envelope.format!==BACKUP_FORMAT||!validDate(envelope.exportedAt)||!/^[0-9a-f]{64}$/.test(envelope.sha256||'')||Object.keys(envelope).sort().join(',')!=='exportedAt,format,kind,progress,sha256')throw new Error('Unsupported WikiVerse backup file');
 const expected=await checksum({kind:envelope.kind,format:envelope.format,exportedAt:envelope.exportedAt,progress:envelope.progress});
 if(expected!==envelope.sha256)throw new Error('Backup checksum mismatch. Nothing has been imported');
 const progress=checkedProgress(envelope.progress);
 return {progress,exportedAt:envelope.exportedAt,counts:progressCounts(progress),kind:BACKUP_KIND,integrity:'SHA-256 integrity only; not authentication'};
}
function newestTimestamp(entry){return String(entry?.updatedAt||entry?.savedAt||entry?.finishedAt||entry?.completedAt||entry?.at||'');}
export function mergeProgress(current,incoming){
 const local=checkedProgress(current),imported=checkedProgress(incoming),next={...local};
 const conflicts={};
 for(const [key,limit] of Object.entries(CATEGORIES)){
  const first=local[key],other=imported[key],byKey=new Map(),valueKey=(v)=>JSON.stringify(v);
  // Canonical saved/user-note identities are unique; event histories may contain multiple attempts with the same id.
  const distinct=key==='studyNotes'||key==='vocabulary';
  const identity=v=>distinct?String(v.key||v.id):valueKey(v);
  for(const row of [...first,...other]){
   const id=identity(row),existing=byKey.get(id);
   if(existing){
    conflicts[key]=(conflicts[key]||0)+1;
    // Preserve current, locally edited notes and vocabulary on an identity collision.
    continue;
   }
   byKey.set(id,row);
  }
  if(byKey.size>limit)throw new Error('Merged '+key+' exceeds '+limit+' records. Export both devices and choose Replace, or reduce history first.');
  next[key]=[...byKey.values()].sort((a,b)=>newestTimestamp(b).localeCompare(newestTimestamp(a)));
 }
 next.saved={...imported.saved,...local.saved};
 next.reviewMarkers={...imported.reviewMarkers,...local.reviewMarkers};
 for(const k of ['saved','reviewMarkers'])if(Object.keys(next[k]).length>180)throw new Error('Merged '+k+' exceeds capacity');
 next.daily={...imported.daily,...local.daily};
 if(JSON.stringify(next).length>1_000_000)throw new Error('Merged progress does not fit local storage. Existing data is unchanged.');
 return {progress:checkedProgress(next),conflicts};
}
export function prepareProgressRestore(current,inspection,mode='merge'){
 if(!['merge','replace'].includes(mode)||inspection?.kind!==BACKUP_KIND)throw new Error('Unsupported restore mode');
 const imported=checkedProgress(inspection.progress),local=checkedProgress(current);
 const result=mode==='replace'?{progress:imported,conflicts:{}}:mergeProgress(local,imported);
 return {...result,mode,currentCounts:progressCounts(local),incomingCounts:progressCounts(imported),resultCounts:progressCounts(result.progress)};
}
/** Revalidate the exact inspected payload at commit time, never trust an editable preview object. */
export function commitInspectedRestore(current,inspection,mode,storage){
 const prepared=prepareProgressRestore(current,inspection,mode);
 saveProgress(checkedProgress(prepared.progress),storage);
 return prepared.progress;
}
export function commitPreparedRestore(prepared,storage){
 if(!prepared?.progress||!['merge','replace'].includes(prepared.mode))throw new Error('No verified restore to commit');
 // localStorage.setItem is atomic for a single key; if quota fails caller leaves original state untouched.
 saveProgress(checkedProgress(prepared.progress),storage);
 return prepared.progress;
}
