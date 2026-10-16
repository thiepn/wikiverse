/** Missions derive from locally saved source records, never artificial mastery. */
import {dateKey,hashSeed} from './game.mjs';
export const MISSION_RULES=Object.freeze([
 {id:'article-trail',name:'Complete a proven article trail',mode:'arena',detail:'Finish a pinned Wikipedia hyperlink challenge'},
 {id:'article-race',name:'Navigate a verified WikiRace',mode:'race',detail:'Complete a real article-link route'},
 {id:'source-mystery',name:'Identify a Wikidata mystery',mode:'mystery',detail:'Solve a source-backed entity mystery'},
 {id:'map-source',name:'Locate a sourced place',mode:'geo',detail:'Complete a Wikidata coordinate challenge'},
 {id:'learn-word',name:'Capture source vocabulary',mode:'polyglot',detail:'Save an expression with its source revision'},
 {id:'investigate',name:'Record a citation assessment',mode:'detective',detail:'Save an ungraded explanation after reviewing a reference'},
 {id:'source-change',name:'Solve an archive or attention puzzle',mode:'capsule',detail:'Complete a revision or pageview challenge'},
 {id:'relationship',name:'Identify a Wikidata relation',mode:'galaxy',detail:'Check a verifiable Wikidata statement'},
 {id:'link-audit',name:'Audit original article links',mode:'linklab',detail:'Identify a genuine outgoing Wikipedia link'}
]);
export function utcDateOf(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))return null;return new Date(value).toISOString().slice(0,10);}
export function missionEvidence(progress,id,date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid UTC mission date');
 const onDay=(r,key)=>utcDateOf(r?.[key])===date;
 switch(id){
 case 'article-trail':return (progress.arenaAttempts||[]).filter(x=>onDay(x,'completedAt')&&x.ranked===false&&x.score===null&&x.sourceIds?.length===3);
 case 'article-race':return (progress.races||[]).filter(x=>onDay(x,'finishedAt')&&x.sourceProof?.length>=3&&x.clicks>=2);
 case 'source-mystery':return (progress.mysteries||[]).filter(x=>onDay(x,'finishedAt')&&x.score>0&&x.source?.startsWith('https://www.wikidata.org/wiki/Q'));
 case 'map-source':return (progress.exploration||[]).filter(x=>onDay(x,'at')&&x.mode==='geo'&&x.score===100&&x.source?.includes('wikidata.org/wiki/Q'));
 case 'learn-word':return (progress.vocabulary||[]).filter(x=>onDay(x,'savedAt')&&x.article?.pageId>0&&x.article?.revisionId>0);
 case 'investigate':return (progress.evidenceReviews||[]).filter(x=>onDay(x,'at')&&x.graded===false&&x.source?.includes('wikipedia.org/w/index.php?oldid='));
 case 'source-change':return (progress.historyChallenges||[]).filter(x=>onDay(x,'at')&&x.correct===true&&x.sourceIds?.length&&['capsule','pulse'].includes(x.mode));
 case 'link-audit':return (progress.linkLab||[]).filter(x=>onDay(x,'at')&&x.correct===true&&x.sourceIds?.length===2&&x.scoringAuthority==='pinned-article-links');
 case 'relationship':return (progress.knowledgeAttempts||[]).filter(x=>onDay(x,'at')&&x.kind==='wikidata-relationship'&&x.correct===true&&/^https:\/\/www\.wikidata\.org\/wiki\/Q/.test(x.source||''));
 default:throw new Error('Unknown mission');
 }
}
export function dailyMissionBoard(progress,date=dateKey()){
 const start=hashSeed('missions:v1:'+date)%MISSION_RULES.length;
 const selected=Array.from({length:5},(_,i)=>MISSION_RULES[(start+i)%MISSION_RULES.length]);
 const missions=selected.map(rule=>{const evidence=missionEvidence(progress,rule.id,date);return {...rule,complete:evidence.length>0,count:evidence.length};});
 return {date,missions,completed:missions.filter(x=>x.complete).length,total:missions.length,authority:'device-records-only'};
}
export function milestoneBoard(progress){
 const unique=new Set(), achievements=[
  {id:'first-race',name:'First confirmed route',detail:'Recorded your first sourced WikiRace',count:(progress.races||[]).filter(x=>x.sourceProof?.length>=3).length,target:1},
  {id:'three-trails',name:'Trail explorer',detail:'Completed three pinned-revision trails',count:(progress.arenaAttempts||[]).filter(x=>x.sourceIds?.length===3).length,target:3},
  {id:'five-topics',name:'Topic collector',detail:'Saved five distinct Wikipedia page identities',count:Object.keys(progress.saved||{}).length,target:5},
  {id:'source-linguist',name:'Phrase collector',detail:'Saved three original-source expressions',count:(progress.vocabulary||[]).filter(x=>x.article?.revisionId>0).length,target:3},
  {id:'citation-journal',name:'Evidence journal',detail:'Saved two ungraded citation assessments',count:(progress.evidenceReviews||[]).filter(x=>x.graded===false).length,target:2},
  {id:'three-domains',name:'Cross-mode explorer',detail:'Participated in three distinct sourced modes',count:0,target:3},
  {id:'wikidata-curious',name:'Statement investigator',detail:'Identified three recorded Wikidata relations',count:(progress.knowledgeAttempts||[]).filter(x=>x.correct&&x.kind==='wikidata-relationship').length,target:3}
 ];
 for(const x of progress.races||[])if(x.sourceProof?.length>=3)unique.add('race');
 for(const x of progress.mysteries||[])if(x.score>0&&x.source)unique.add('mystery');
 for(const x of progress.exploration||[])if(x.score>0&&x.source)unique.add(x.mode);
 for(const x of progress.learning||[])if(x.correct&&x.source)unique.add(x.mode);
 for(const x of progress.historyChallenges||[])if(x.correct&&x.sourceIds?.length)unique.add(x.mode);
 for(const x of progress.arenaAttempts||[])if(x.sourceIds?.length===3)unique.add('arena');
 for(const x of progress.knowledgeAttempts||[])if(x.correct&&x.source)unique.add('galaxy');
 for(const x of progress.linkLab||[])if(x.correct&&x.sourceIds?.length===2)unique.add('linklab');
 achievements.find(x=>x.id==='three-domains').count=unique.size;
 return achievements.map(x=>({...x,count:Math.min(x.count,x.target),earned:x.count>=x.target,kind:'local-participation',scoreAuthority:false}));
}
export function recentWeek(progress,date=dateKey()){
 const day=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(day))throw new Error('Invalid UTC date');
 return Array.from({length:7},(_,i)=>{const current=new Date(day-(6-i)*86400000).toISOString().slice(0,10);let count=0;for(const r of MISSION_RULES)count+=missionEvidence(progress,r.id,current).length;return {date:current,activity:count};});
}
