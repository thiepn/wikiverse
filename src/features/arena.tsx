import React,{useEffect,useMemo,useRef,useState} from 'react';
import {STARTERS,dateKey,revisionUrl} from '../domain/game.mjs';
import {buildArenaManifest,encodeArenaCode,decodeArenaCode,gradeTrailChoice,arenaAttempt} from '../domain/arena.mjs';
import {createArenaTrail,createDailyTrail,verifyArenaTrail} from '../services/arena.mjs';
import {createRoomInvite,encodeRoomInvite,decodeRoomInvite,localJoinIntent} from '../domain/rooms.mjs';
import './arena.css';
type Trail=Awaited<ReturnType<typeof verifyArenaTrail>>;
const date=dateKey();
function excerpt(html:string){
 const doc=new DOMParser().parseFromString(html,'text/html');
 const p=[...doc.querySelectorAll('p')].map(x=>x.textContent?.replace(/\[[^\]]{1,12}\]/g,'').trim()||'').find(x=>x.length>60);
 return p?.slice(0,600)||'Read the original pinned article to investigate its outgoing links.';
}
export default function Arena({onComplete,attempts,dailyManifest,onDailyManifest}:{onComplete:(x:any)=>void;attempts:any[];dailyManifest?:{date:string;manifest:any}|null;onDailyManifest:(x:{date:string;manifest:any})=>void}){
 const [starter,setStarter]=useState(STARTERS[0]),[input,setInput]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const [challenge,setChallenge]=useState<Trail|null>(null),[step,setStep]=useState(0),[mistakes,setMistakes]=useState(0),[feedback,setFeedback]=useState(''),[done,setDone]=useState(false),[copied,setCopied]=useState(false),[started,setStarted]=useState(0);
 const [roomName,setRoomName]=useState('Knowledge Trail'),[hostAlias,setHostAlias]=useState('Host'),[guestAlias,setGuestAlias]=useState('Guest');
 const [roomCode,setRoomCode]=useState(''),[roomInput,setRoomInput]=useState(''),[roomInvite,setRoomInvite]=useState<any>(null),[guestIntent,setGuestIntent]=useState<any>(null);
 const op=useRef(0);
 const code=useMemo(()=>challenge?encodeArenaCode(challenge.manifest):'', [challenge]);
 const completedToday=attempts.filter(x=>x.dailyKey===date);
 useEffect(()=>()=>{op.current++;},[]);
 async function prepare(action:'daily'|'practice'|'import'|'room'){
  const tick=++op.current;setBusy(action==='import'?'Validating source revisions from shared challenge…':'Constructing and verifying a pinned Wikipedia route…');setError('');setChallenge(null);setFeedback('');setDone(false);setCopied(false);setRoomInvite(null);setRoomCode('');setGuestIntent(null);
  try{
   let verified:Trail;
   if(action==='import'){const manifest=decodeArenaCode(input);verified=await verifyArenaTrail(manifest);}
   else if(action==='room'){const invite=decodeRoomInvite(roomInput);const intent=localJoinIntent(invite,{alias:guestAlias});verified=await verifyArenaTrail(invite.manifest);if(tick===op.current){setRoomInvite(invite);setGuestIntent(intent);setRoomCode(roomInput);}}
   else if(action==='daily'){
     const cached=dailyManifest?.date===date?dailyManifest.manifest:null;
     const manifest=cached||await createDailyTrail(date);
     verified=await verifyArenaTrail(manifest);
     if(tick===op.current&&!cached)onDailyManifest({date,manifest:verified.manifest});
    }
   else{const manifest=await createArenaTrail({seed:'practice_'+Date.now(),starter});verified=await verifyArenaTrail(manifest);}
   if(tick!==op.current)return;
   setChallenge(verified);setStep(0);setMistakes(0);setStarted(Date.now());
  }catch(e:any){if(tick===op.current)setError(e.message||'The source could not be verified.');}
  finally{if(tick===op.current)setBusy('');}
 }
 function choose(title:string){
  if(!challenge||done)return;
  const correct=gradeTrailChoice(challenge.manifest,step,title);
  if(!correct){setMistakes(x=>x+1);setFeedback('Not the next link on this proven route. Other routes may also exist; this drill checks the pinned proof.');return;}
  setFeedback('');
  if(step===challenge.manifest.proof.length-2){
   setDone(true);
   onComplete(arenaAttempt(challenge.manifest,{mistakes,elapsedMs:Math.max(0,Date.now()-started)}));
  }else setStep(x=>x+1);
 }
 function createInvite(){if(!challenge)return;setError('');try{
   const invite=createRoomInvite(challenge.manifest,{name:roomName,hostAlias,nonce:crypto.randomUUID(),capacity:4});
   const code=encodeRoomInvite(invite);setRoomInvite(invite);setGuestIntent(null);setRoomCode(code);
  }catch(e:any){setError(e.message||'Cannot create invitation');}
 }
 async function copyRoom(){try{await navigator.clipboard.writeText(roomCode);setCopied(true);}catch{setError('Clipboard access denied; select and copy the invitation code manually.');}}
 async function copy(){
  try{await navigator.clipboard.writeText(code);setCopied(true);}
  catch{setCopied(false);setError('Clipboard unavailable. Select and copy the challenge code shown below.');}
 }
 const current=challenge?.pages[step];
 return <section className="arena">
  <div className="mode-head"><div className="eyebrow">12 / LOCAL CHALLENGE LAB</div><h1>Trail Arena<span className="accent">.</span></h1><p>Build, replay and share verified Wikipedia hyperlink routes. Train a known source-backed path; compare guest results manually with friends.</p></div>
  {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>Dismiss</button></div>}
  {busy&&<div className="loading" role="status">{busy}</div>}
  {!challenge?<div className="arena-grid">
   <section className="arena-panel"><div className="eyebrow">DAILY / UTC {date}</div><h2>Today's route</h2><p>A dated local challenge generated from original Wikipedia links. After verification its pinned revision manifest is saved on this device and reused throughout the UTC day, but it is not globally signed or synchronized.</p><p>Daily attempts on this device: <strong>{completedToday.length}</strong></p><button className="primary" disabled={!!busy} onClick={()=>void prepare('daily')}>Create today’s verified challenge →</button></section>
   <section className="arena-panel"><div className="eyebrow">UNLIMITED PRACTICE</div><h2>Custom starting point</h2><p>Generate a proven two-hop article-link puzzle with real revision identities.</p><label htmlFor="arena-starter">STARTING ARTICLE</label><select id="arena-starter" value={starter} onChange={e=>setStarter(e.target.value)}>{STARTERS.map(t=><option key={t}>{t}</option>)}</select><button disabled={!!busy} onClick={()=>void prepare('practice')}>Generate practice trail →</button></section>
   <section className="arena-panel arena-wide"><div className="eyebrow">ASYNCHRONOUS FRIEND CHALLENGE</div><h2>Import a WikiVerse challenge code</h2><p>Codes contain article page IDs and revision IDs—not external server state. Imported routes are checked against the pinned Wikipedia links before becoming playable. They are not secure multiplayer results.</p><label htmlFor="arena-import">CHALLENGE CODE</label><textarea id="arena-import" rows={3} maxLength={4005} value={input} onChange={e=>setInput(e.target.value)} placeholder="WV1.…"/><button disabled={!!busy||!input.trim()} onClick={()=>void prepare('import')}>Verify and play this route →</button></section>
   <section className="arena-panel arena-wide"><div className="eyebrow">MULTIPLAYER-READY PRIVATE INVITATION · OFFLINE</div><h2>Open a private invitation</h2>
    <p>Import an expiring invitation to a verified pinned trail. There is no shared presence, synchronized score or remote room authority.</p>
    <label htmlFor="room-import">PRIVATE INVITE CODE</label><textarea id="room-import" rows={3} value={roomInput} onChange={e=>setRoomInput(e.target.value)} placeholder="WVROOM1.…" maxLength={6410}/>
    <label htmlFor="room-guest">YOUR DISPLAY ALIAS (LOCAL)</label><input id="room-guest" value={guestAlias} maxLength={36} onChange={e=>setGuestAlias(e.target.value)}/>
    <button disabled={!!busy||!roomInput.trim()} onClick={()=>void prepare('room')}>Verify private room and open trail →</button>
   </section>
  </div>:<>
   <div className="arena-summary"><div><small>START ARTICLE</small><strong>{challenge.manifest.proof[0].title}</strong></div><div><small>GOAL ARTICLE</small><strong>{challenge.manifest.proof.at(-1)?.title}</strong></div><div><small>PROOF STEP</small><strong>{Math.min(step+1,2)} / 2</strong></div><div><small>NON-PROOF ANSWERS</small><strong>{mistakes}</strong></div></div>
   <div className="arena-panel"><div className="eyebrow">PINNED SOURCE ARTICLE · REVISION {current?.identity.revisionId}</div><h2>{current?.identity.title}</h2><blockquote>{current?excerpt(current.html):''}</blockquote><div className="arena-buttons"><a href={current?revisionUrl(current.identity):'#'} target="_blank" rel="noreferrer">Read exact Wikipedia revision ↗</a><a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">Wikipedia text CC BY-SA 4.0 ↗</a></div>
    {done?<div className="arena-success"><h3>Proven path completed</h3><p>{challenge.manifest.proof.map((x:{title:string})=>x.title).join(' → ')}</p><p>Your unranked result was saved locally. You can share the same immutable article snapshots for friends to replay.</p></div>:<><h3>Which source link follows the verified route?</h3><p>Select the next article among genuine outgoing Wikipedia links. Only the specified proven route is graded; alternative possible routes are not ruled out.</p><div className="arena-options">{challenge.choices[step].map(t=><button key={t} disabled={!!busy} onClick={()=>choose(t)}>{t} ↗</button>)}</div>{feedback&&<p className="arena-feedback" role="status">{feedback}</p>}</>}
   </div>
   <div className="arena-panel"><div className="eyebrow">PRIVATE ROOM / PREPARATION ONLY</div><h2>Host an asynchronous challenge invitation</h2>
     {guestIntent?<div role="status" className="arena-room-intent"><strong>Local invite preview · {roomInvite?.name}</strong><p>Alias {guestIntent.participantAlias} is a local guest candidate; presence: NOT CONNECTED. There is no remote join or shared room authority.</p></div>:<p>Choose public-safe aliases. Room invitations are portable codes: anyone holding the code can see the aliases and replay the challenge.</p>}
     <div className="arena-room-fields"><div><label htmlFor="room-name">ROOM NAME</label><input id="room-name" maxLength={70} value={roomName} onChange={e=>setRoomName(e.target.value)}/></div><div><label htmlFor="room-host">HOST ALIAS</label><input id="room-host" maxLength={36} value={hostAlias} onChange={e=>setHostAlias(e.target.value)}/></div></div>
     <button onClick={createInvite}>Create private room invitation →</button>
     {roomCode&&<><div className="arena-room-intent"><strong>{roomInvite?.name}</strong><p>Host alias: {roomInvite?.hostAlias} · Advisory capacity: {roomInvite?.capacity} · Expires {roomInvite?.expiresAt?.slice(0,16).replace('T',' ')} UTC · No live participants</p></div>
       <label htmlFor="room-invite-code">SHAREABLE PRIVATE INVITATION CODE</label><textarea readOnly id="room-invite-code" rows={4} value={roomCode} onFocus={e=>e.target.select()}/>
       <button onClick={()=>void copyRoom()}>{copied?'Copied':'Copy private invitation'}</button></>}
   </div>
   <div className="arena-panel"><div className="eyebrow">PORTABLE / UNRANKED / SOURCE VERIFIED</div><h2>Share challenge</h2><p>This portable code contains the exact Wikipedia page/revision identities, not a user score or trusted authorization.</p><label htmlFor="arena-code">IMMUTABLE SOURCE REVISIONS · WV1</label><textarea id="arena-code" readOnly value={code} rows={3} onFocus={e=>e.target.select()}/><div className="arena-buttons"><button onClick={()=>void copy()}>{copied?'Copied':'Copy challenge code'}</button><button onClick={()=>{op.current++;setChallenge(null);setError('');}}>Try another challenge →</button></div></div>
  </>}
  <div className="arena-panel arena-notice"><h3>What this mode does not claim</h3><p>These are real, verified Wikipedia hyperlink transitions, but not a proof of the shortest possible path. Scores are local and editable by the device owner; challenge codes are reusable invitations, not signed official leaderboards or server-hosted multiplayer rooms.</p></div>
 </section>;
}
