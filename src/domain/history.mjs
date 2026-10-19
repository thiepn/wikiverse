/** Deterministic data processing: Wikimedia pageview observations and MediaWiki revisions. */
import {isArticleTitle,normalizeTitle,hashSeed} from './game.mjs';
export const PULSE_RANGES=Object.freeze([14,30,60,90]);
const UTC_DAY=86400000;
export function pulseWindow(days,now=new Date()){
 if(!PULSE_RANGES.includes(days)||!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new Error('Unsupported pageview interval');
 // Exclude today's incomplete UTC data and allow Wikimedia daily aggregation time.
 const end=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate())-2*UTC_DAY);
 const start=new Date(end.getTime()-(days-1)*UTC_DAY);
 const date=x=>x.toISOString().slice(0,10).replaceAll('-','');
 return {start:date(start),end:date(end),days,timezone:'UTC',lastCompleteDay:end.toISOString().slice(0,10)};
}
export function pulsePath(language,title,window){
 if(!['en','de','fr','ko','tr'].includes(language)||!isArticleTitle(title)||!window||!/^\d{8}$/.test(window.start)||!/^\d{8}$/.test(window.end)||window.end<window.start)throw new Error('Invalid Wikimedia pageview request');
 return '/api/rest_v1/metrics/pageviews/per-article/'+language+'.wikipedia.org/all-access/user/'+encodeURIComponent(normalizeTitle(title).replaceAll(' ','_'))+'/daily/'+window.start+'/'+window.end;
}
export function normalizePageviews(payload,{language,title,start,end}){
 if(!['en','de','fr','ko','tr'].includes(language)||!isArticleTitle(title))throw new Error('Invalid pageview identity');
 if(!Array.isArray(payload?.items))throw new Error('Unrecognized Wikimedia Analytics response');
 const seen=new Map();
 for(const item of payload.items){
  const timestamp=String(item?.timestamp||'');const stamp=timestamp.slice(0,8);
  if(!/^\d{8}$/.test(stamp)||stamp<start||stamp>end)continue;
  if(item.project!==language+'.wikipedia'||item.granularity!=='daily'||item.agent!=='user'||item.access!=='all-access')continue;
  if(!Number.isSafeInteger(item.views)||item.views<0)continue;
  const date=stamp.slice(0,4)+'-'+stamp.slice(4,6)+'-'+stamp.slice(6,8);
  if(!Number.isFinite(Date.parse(date+'T00:00:00Z'))||seen.has(stamp))continue;
  seen.set(stamp,{date,views:item.views});
 }
 const points=[...seen].sort(([a],[b])=>a.localeCompare(b)).map(([,value])=>value);
 if(!points.length)throw new Error('No valid Wikimedia pageviews for the requested period');
 return {language,title:normalizeTitle(title),start,end,points,total:points.reduce((s,x)=>s+x.views,0),observedDays:points.length,source:'https://wikimedia.org/api/rest_v1/metrics/pageviews',metric:'pageviews',agent:'user',access:'all-access'};
}
export function pulseSummary(series){
 const points=series?.points||[];
 if(!points.length)throw new Error('No observations');
 const total=points.reduce((s,x)=>s+x.views,0);
 const max=points.reduce((a,b)=>b.views>a.views?b:a,points[0]);
 const midpoint=Math.floor(points.length/2);const first=points.slice(0,midpoint).reduce((s,x)=>s+x.views,0);const last=points.slice(midpoint).reduce((s,x)=>s+x.views,0);
 // A balanced per-day comparison when odd-sized windows or gaps occur.
 const firstMean=midpoint?first/midpoint:null;const lastMean=points.length-midpoint?last/(points.length-midpoint):null;
 const changePct=firstMean>0&&lastMean!==null?Math.round(1000*(lastMean-firstMean)/firstMean)/10:null;
 return {total,max,mean:Math.round(total/points.length),changePct,observedDays:points.length};
}
/** W09 complete UTC window grid. Null denotes a missing original observation, never zero. */
export function pulseCalendar(series){
 if(!Array.isArray(series)||!series.length)return [];
 const stamps=series.flatMap(s=>[s.start,s.end]);
 if(stamps.some(x=>typeof x!=='string'||!/^\d{8}$/.test(x)))throw new Error('Missing original Wikimedia pageview window');
 const start=stamps.sort()[0],end=stamps.at(-1),iso=x=>x.slice(0,4)+'-'+x.slice(4,6)+'-'+x.slice(6,8);
 const from=Date.parse(iso(start)+'T00:00:00Z'),to=Date.parse(iso(end)+'T00:00:00Z');
 if(!Number.isFinite(from)||!Number.isFinite(to)||to<from||(to-from)/UTC_DAY>100)throw new Error('Unsupported source day range');
 return Array.from({length:Math.round((to-from)/UTC_DAY)+1},(_,i)=>{
  const date=new Date(from+i*UTC_DAY).toISOString().slice(0,10);
  return {date,values:series.map(s=>{
   const exact=(s.points||[]).find(p=>p.date===date);
   return {id:s.language+':'+s.title,title:s.title,language:s.language,views:exact?.views??null,source:s.source};
  })};
 });
}
/** Never connect line segments across absent UTC observations. */
export function pulseObservedSegments(series,calendar=pulseCalendar([series])){
 const lookup=new Map((series?.points||[]).map(p=>[p.date,p.views]));
 const segments=[];let current=[];
 for(const row of calendar){
  const n=lookup.get(row.date);
  if(!Number.isSafeInteger(n)||n<0){if(current.length)segments.push(current);current=[];continue;}
  current.push({date:row.date,views:n});
 }
 if(current.length)segments.push(current);
 return segments;
}
/** Equal-duration windows: source totals and observed-day means remain visible;
 * percentages only when BOTH windows contain every expected original observation. */
export function pulsePeriodComparison(series,kind='halves'){
 if(!Array.isArray(series)||!series.length||!['halves','week'].includes(kind))throw new Error('Unsupported pageview comparison window');
 const calendar=pulseCalendar(series);
 if(calendar.length<14)throw new Error('Insufficient source date window');
 const length=kind==='week'?7:Math.floor(calendar.length/2);
 const earlier=calendar.slice(0,length),later=calendar.slice(-length);
 return {kind,days:length,earlier:{start:earlier[0].date,end:earlier.at(-1).date},later:{start:later[0].date,end:later.at(-1).date},
  articles:series.map(s=>{
   const id=s.language+':'+s.title;
   const measure=rows=>{
    const found=rows.map(r=>r.values.find(v=>v.id===id)?.views).filter(v=>Number.isSafeInteger(v)&&v>=0);
    const total=found.reduce((a,b)=>a+b,0);
    return {total,observedDays:found.length,expectedDays:rows.length,mean:found.length?Math.round(100*total/found.length)/100:null,complete:found.length===rows.length};
   };
   const a=measure(earlier),b=measure(later);
   const comparable=a.complete&&b.complete&&a.mean>0;
   return {id,title:s.title,language:s.language,source:s.source,earlier:a,later:b,
    changePct:comparable?Math.round(10*100*(b.mean-a.mean)/a.mean)/10:null,
    reason:!a.complete||!b.complete?'Missing API observations prevent a complete-window percentage':a.mean===0?'Zero baseline prevents a percentage':null};
  })};
}
/** One selected day, with missing data visibly unknown and no invented winner. */
export function pulseDayEvidence(series,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw new Error('Select a valid UTC source date');
 const row=pulseCalendar(series).find(x=>x.date===date);
 if(!row)throw new Error('Date is outside the retrieved original window');
 const observed=row.values.filter(v=>v.views!==null);
 const top=Math.max(...observed.map(v=>v.views));
 const leaders=observed.filter(v=>v.views===top);
 return {...row,observed:observed.length,missing:row.values.length-observed.length,
  uniqueLeader:observed.length===row.values.length&&leaders.length===1?leaders[0]:null};
}
export function pulseLeaders(series){return [...series].sort((a,b)=>pulseSummary(b).total-pulseSummary(a).total||a.title.localeCompare(b.title));}
export function pulseQuiz(series,index=0){
 if(!Array.isArray(series)||series.length<2)return null;
 const common=series.reduce((a,s)=>a.filter(d=>s.points.some(p=>p.date===d)),series[0].points.map(p=>p.date));
 if(!common.length)return null;
 const day=common[hashSeed(index+':pulse')%common.length];
 const records=series.map(s=>({language:s.language,title:s.title,views:s.points.find(p=>p.date===day)?.views,id:s.language+':'+s.title}));
 const max=Math.max(...records.map(x=>x.views));const winner=records.filter(x=>x.views===max);
 // Ties cannot be an unambiguous single-answer challenge.
 if(winner.length!==1)return null;
 return {id:'pulse:'+day+':'+records.map(x=>x.id).join('|'),date:day,choices:records,answerId:winner[0].id,source:'https://wikimedia.org/api/rest_v1/metrics/pageviews',kind:'pageviews-comparison'};
}
export function gradePulse(q,answer){return !!q&&q.kind==='pageviews-comparison'&&q.choices.some(c=>c.id===answer)&&q.answerId===answer;}
export function normalizeRevisions(payload,{language,title}){
 const page=payload?.query?.pages?.find(p=>Number.isSafeInteger(p.pageid)&&p.pageid>0&&!p.missing);
 if(!page||!Array.isArray(page.revisions)||!isArticleTitle(page.title))throw new Error('Revision history is unavailable');
 const unique=new Map();
 for(const r of page.revisions){
  if(!Number.isSafeInteger(r.revid)||r.revid<=0||!Number.isFinite(Date.parse(r.timestamp))||unique.has(r.revid))continue;
  unique.set(r.revid,{pageId:page.pageid,language,title:normalizeTitle(page.title),revisionId:r.revid,timestamp:r.timestamp,size:Number.isSafeInteger(r.size)?r.size:null,comment:typeof r.comment==='string'?r.comment.slice(0,220):'',sourceUrl:'https://'+language+'.wikipedia.org/w/index.php?oldid='+r.revid});
 }
 const revisions=[...unique.values()].sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
 if(revisions.length<2)throw new Error('At least two readable revisions are needed');
 return {identity:{language,pageId:page.pageid,title:normalizeTitle(page.title)},revisions,historyUrl:'https://'+language+'.wikipedia.org/w/index.php?title='+encodeURIComponent(page.title.replaceAll(' ','_'))+'&action=history'};
}
export function paragraphChanges(earlier,later,limit=15){
 if(!earlier?.identity||!later?.identity||earlier.identity.language!==later.identity.language||earlier.identity.pageId!==later.identity.pageId||earlier.identity.revisionId===later.identity.revisionId)throw new Error('Comparison requires two different revisions of the same article');
 if(!Array.isArray(earlier.paragraphs)||!Array.isArray(later.paragraphs))throw new Error('Missing revision text');
 const clean=x=>String(x).replace(/\s+/g,' ').trim();
 const old=[...new Set(earlier.paragraphs.map(clean).filter(s=>s.length>=22&&s.length<=1500))];
 const now=[...new Set(later.paragraphs.map(clean).filter(s=>s.length>=22&&s.length<=1500))];
 const oldSet=new Set(old),nowSet=new Set(now);
 const removed=old.filter(x=>!nowSet.has(x)),added=now.filter(x=>!oldSet.has(x));
 return {from:earlier.identity,to:later.identity,added:added.slice(0,limit),removed:removed.slice(0,limit),addedCount:added.length,removedCount:removed.length,method:'exact-paragraph-presence',truncated:added.length>limit||removed.length>limit};
}
/** Original revision text is evidence of literal paragraph presence, not intent, truth or edit causation.
 * Both original revisions are required; source IDs must match the history's identity. */
export function revisionEvidence(earlier,later,limit=40){
 if(!Number.isInteger(limit)||limit<1||limit>80)throw new Error('Unsupported original revision evidence limit');
 const a=earlier?.identity,b=later?.identity;
 if(!a||!b||a.language!==b.language||a.pageId!==b.pageId||a.revisionId===b.revisionId||
    !Number.isSafeInteger(a.revisionId)||a.revisionId<=0||!Number.isSafeInteger(b.revisionId)||b.revisionId<=0)
  throw new Error('Original revision evidence requires distinct revisions of the same Wikipedia page');
 if(!Array.isArray(earlier.paragraphs)||!Array.isArray(later.paragraphs))throw new Error('Missing original source paragraph evidence');
 const clean=x=>String(x||'').replace(/\s+/g,' ').trim();
 const from=earlier.paragraphs.map(clean).filter(x=>x.length>=22&&x.length<=1500);
 const to=later.paragraphs.map(clean).filter(x=>x.length>=22&&x.length<=1500);
 const fromSet=new Set(from),toSet=new Set(to);
 const make=(rows,other)=>rows.map((text,index)=>({id:String(index)+':'+a.pageId,position:index+1,text,status:other.has(text)?'present-in-both':'only-in-this-revision'}));
 return {identity:{language:a.language,pageId:a.pageId,title:a.title||b.title||'',earlierId:a.revisionId,laterId:b.revisionId},
  before:make(from,toSet).slice(0,limit),after:make(to,fromSet).slice(0,limit),
  beforeTotal:from.length,afterTotal:to.length,beforeShown:Math.min(from.length,limit),afterShown:Math.min(to.length,limit),
  method:'exact-normalized-paragraph-presence',graded:false,
  sourceUrls:['https://'+a.language+'.wikipedia.org/w/index.php?oldid='+a.revisionId,'https://'+b.language+'.wikipedia.org/w/index.php?oldid='+b.revisionId]};
}
/** An archive's visible filter keeps retrieved original metadata only, never replaces pagination ownership. */
export function selectArchiveRevisions(history,{query='',fromDate='',toDate=''}={}){
 if(!history?.identity?.pageId||!Array.isArray(history.revisions))return [];
 const search=String(query).trim().toLocaleLowerCase().slice(0,100);
 for(const date of [fromDate,toDate])if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid UTC archive date');
 return history.revisions.filter(r=>
  Number.isSafeInteger(r.revisionId)&&r.revisionId>0&&r.pageId===history.identity.pageId&&r.language===history.identity.language&&
  (!fromDate||r.timestamp.slice(0,10)>=fromDate)&&(!toDate||r.timestamp.slice(0,10)<=toDate)&&
  (!search||[String(r.revisionId),r.comment,r.timestamp].some(t=>String(t||'').toLocaleLowerCase().includes(search)))
 ).sort((a,b)=>b.timestamp.localeCompare(a.timestamp));
}
export function changeChallenge(comparison,seed='1'){
 const choices=[...comparison.added.map(text=>({text,kind:'added'})),...comparison.removed.map(text=>({text,kind:'removed'}))];
 if(!choices.length)return null;
 const selected=choices[hashSeed(String(seed)+':'+comparison.to.revisionId)%choices.length];
 return {id:'change:'+comparison.from.revisionId+':'+comparison.to.revisionId+':'+hashSeed(selected.text),prompt:selected.text,answer:selected.kind,source:[comparison.from,comparison.to],kind:'revision-change'};
}
export function gradeChange(q,answer){return q?.kind==='revision-change'&&['added','removed'].includes(answer)&&q.answer===answer;}

/** UTC history windows use complete calendar days, no local-clock/DST ambiguity. */
export function historicalWindow(endDate, days=30, today=new Date()){
 if(![7,30,90,365].includes(days)||!/^\d{4}-\d{2}-\d{2}$/.test(endDate||''))throw new Error('Choose a valid historical window');
 const end=Date.parse(endDate+'T00:00:00Z');
 const max=Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate());
 if(!Number.isFinite(end)||new Date(end).toISOString().slice(0,10)!==endDate||end>max||end<Date.UTC(2001,0,1))throw new Error('Historical date is outside the supported range');
 const first=end-(days-1)*UTC_DAY;
 const iso=millis=>new Date(millis).toISOString().slice(0,10);
 return {start:iso(first),end:iso(end),rvstart:iso(end)+'T23:59:59Z',rvend:iso(first)+'T00:00:00Z',days};
}
export function safeRevisionCursor(value){
 return typeof value==='string'&&value.length>=3&&value.length<=180&&/^[0-9A-Za-z:|.+-]+$/.test(value)?value:null;
}
export function normalizeRevisionPage(payload,{language,title,expectedPageId=null}){
 if(!['en','fr','de','ko','tr'].includes(language))throw new Error('Unsupported Wikipedia edition');
 const page=payload?.query?.pages?.find(p=>Number.isSafeInteger(p.pageid)&&p.pageid>0&&!p.missing);
 if(!page||!isArticleTitle(page.title)||!Array.isArray(page.revisions))throw new Error('No readable revisions found for that window');
 if(expectedPageId!==null&&page.pageid!==expectedPageId)throw new Error('Historical continuation changed article identity');
 const existing=new Set(),revisions=[];
 for(const r of page.revisions){
  if(!Number.isSafeInteger(r.revid)||r.revid<=0||existing.has(r.revid)||!Number.isFinite(Date.parse(r.timestamp)))continue;
  existing.add(r.revid);
  revisions.push({pageId:page.pageid,language,title:normalizeTitle(page.title),revisionId:r.revid,timestamp:r.timestamp,size:Number.isSafeInteger(r.size)?r.size:null,comment:typeof r.comment==='string'?r.comment.slice(0,220):'',sourceUrl:'https://'+language+'.wikipedia.org/w/index.php?oldid='+r.revid});
 }
 const cursor=safeRevisionCursor(payload?.continue?.rvcontinue);
 if(payload?.continue?.rvcontinue&&!cursor)throw new Error('Unsafe revision continuation token');
 return {identity:{language,pageId:page.pageid,title:normalizeTitle(page.title)},revisions:revisions.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)),nextCursor:cursor,historyUrl:'https://'+language+'.wikipedia.org/w/index.php?title='+encodeURIComponent(page.title.replaceAll(' ','_'))+'&action=history'};
}
export function mergeRevisionPages(current,incoming,max=150){
 if(current?.identity?.pageId!==incoming?.identity?.pageId||current?.identity?.language!==incoming?.identity?.language)throw new Error('Cannot merge history from different articles');
 const revisions=[...current.revisions,...incoming.revisions];
 return {...current,revisions:[...new Map(revisions.map(r=>[r.revisionId,r])).values()].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).slice(0,max),nextCursor:incoming.nextCursor};
}
