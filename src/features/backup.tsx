import React,{useMemo,useState} from 'react';
import {exportProgressBackup,inspectProgressBackup,prepareProgressRestore,progressCounts} from '../domain/backup.mjs';
import './backup.css';
const rows=['saved','races','mysteries','readingHistory','studyNotes','offlineArticles','sourceClips','reviewMarkers','linkLab','vocabulary','evidenceReviews','arenaAttempts','historyChallenges','learning','knowledgeAttempts','exploration'];
export default function BackupCenter({progress,onCommit}:{progress:any;onCommit:(inspection:any,mode:'merge'|'replace')=>void}){
 const [inspection,setInspection]=useState<any>(null),[mode,setMode]=useState<'merge'|'replace'>('merge'),[armed,setArmed]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(false);
 const prepared=useMemo(()=>{if(!inspection)return null;try{return prepareProgressRestore(progress,inspection,mode);}catch(e:any){return {error:e.message};}},[progress,inspection,mode]);
 async function download(){
  setLoading(true);setError('');setNotice('');
  try{
   const json=await exportProgressBackup(progress),blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='wikiverse-local-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Backup prepared locally. Store the file securely: it contains your private notes and study history.');
  }catch(e:any){setError(e.message||'Unable to export local data');}finally{setLoading(false);}
 }
 async function loadFile(e:React.ChangeEvent<HTMLInputElement>){
  const file=e.target.files?.[0];setInspection(null);setArmed(false);setNotice('');setError('');e.target.value='';
  if(!file)return;
  if(file.size>1_150_000){setError('File exceeds the maximum backup size (1.15 MB).');return;}
  setLoading(true);
  try{setInspection(await inspectProgressBackup(await file.text()));}
  catch(e:any){setError(e.message||'Backup validation failed. Existing data was not modified.');}
  finally{setLoading(false);}
 }
 function importNow(){
  if(!armed||!prepared||'error'in prepared||!inspection)return;
  try{onCommit(inspection,mode);setInspection(null);setArmed(false);setError('');setNotice(mode==='merge'?'Verified backup merged with this device.':'Verified backup replaced this device’s local WikiVerse progress.');}
  catch(e:any){setError(e.message||'Unable to commit backup. Original local data was preserved.');}
 }
 const counts=progressCounts(progress);
 return <section className="backup">
  <div className="mode-head"><div className="eyebrow">16 / PRIVATE DATA OWNERSHIP</div><h1>Backup & Recovery<span className="accent">.</span></h1><p>Export or restore your personal WikiVerse progress without an account or server. Review exactly what is in a file before committing it to this browser.</p></div>
  {error&&<div className="error" role="alert">{error} <button onClick={()=>setError('')}>Dismiss</button></div>}
  {notice&&<p className="backup-notice" role="status">{notice}</p>}
  <div className="backup-columns"><section className="backup-panel"><div className="eyebrow">YOUR CURRENT DEVICE</div><h2>Download a private backup</h2><p>Includes local races, sourced game records, saved pages, compact offline reading copies, vocabulary, private evidence notes, study journeys, daily manifests and review dates.</p>
   <div className="backup-counts"><span>Saved articles <b>{counts.saved}</b></span><span>Reading visits <b>{counts.readingHistory}</b></span><span>Study notes <b>{counts.studyNotes}</b></span><span>Link Lab attempts <b>{counts.linkLab}</b></span></div>
   <button disabled={loading} className="primary" onClick={()=>void download()}>Download full JSON backup →</button><p className="backup-caution">No data is uploaded. A backup file contains private information, so protect it like a personal document. Its SHA-256 checksum checks accidental changes, not the identity or trustworthiness of its author.</p>
  </section>
  <section className="backup-panel"><div className="eyebrow">RESTORE / VERIFICATION FIRST</div><h2>Inspect an existing backup</h2><p>Choose a WikiVerse JSON file. Invalid or incompatible data is rejected. Nothing changes on this device until you confirm below.</p>
    <label htmlFor="backup-file">SELECT BACKUP FILE</label><input id="backup-file" type="file" accept=".json,application/json" disabled={loading} onChange={e=>void loadFile(e)}/>
    {!inspection&&<p className="backup-placeholder">No verified file loaded.</p>}
    {inspection&&<><p className="backup-notice">Verified file format and checksum · Exported {new Date(inspection.exportedAt).toLocaleString()}.</p>
     <fieldset><legend>Restore method</legend><label><input type="radio" name="restore-mode" checked={mode==='merge'} onChange={()=>{setMode('merge');setArmed(false);}}/> Merge while keeping this device’s existing personal notes on collisions</label><label><input type="radio" name="restore-mode" checked={mode==='replace'} onChange={()=>{setMode('replace');setArmed(false);}}/> Replace all local WikiVerse progress with this backup</label></fieldset>
     {prepared&&'error'in prepared?<p role="alert" className="backup-error">{prepared.error}</p>:<><h3>Preview changes</h3><div className="backup-preview"><table><thead><tr><th scope="col">Record type</th><th scope="col">Device</th><th scope="col">Backup</th><th scope="col">After</th></tr></thead><tbody>{rows.map(key=><tr key={key}><th scope="row">{key.replace(/([A-Z])/g,' $1')}</th><td>{prepared?.currentCounts[key]||0}</td><td>{inspection.counts[key]||0}</td><td>{prepared?.resultCounts[key]||0}</td></tr>)}</tbody></table></div>
       <p className="backup-caution">{mode==='merge'?'Existing device notes, saves, and schedule decisions take precedence on identity conflicts. Conflicting source records remain distinct unless identical. If merged data exceeds storage limits, import is refused.':'Replacement will remove existing local records not present in the verified backup. Export your current device data first.'}</p>
       <label className="backup-armed"><input type="checkbox" checked={armed} onChange={e=>setArmed(e.target.checked)}/> I reviewed the changes and want to {mode} this device’s local progress.</label>
       <button className="primary" disabled={!armed||loading} onClick={importNow}>Confirm {mode==='merge'?'merge':'replacement'} →</button>
     </>}
     <button className="backup-cancel" onClick={()=>{setInspection(null);setArmed(false);setNotice('');}}>Cancel restore</button>
    </>}
  </section></div>
  <p className="backup-footer">All imported achievements and answers remain <b>device-owned, unranked records</b>. An imported file never grants accounts, server membership, official proficiency, competitive authority or trusted Wikimedia facts.</p>
 </section>;
}
