/** Extract actual *visible, sanitized* Wikipedia paragraph text in the browser; never save HTML or active content. */
import {offlineSnapshot,MAX_OFFLINE_CHARS,MAX_OFFLINE_SECTIONS} from '../domain/offline.mjs';
export function captureOfflineReading(page,sanitizedReaderHtml){
 if(typeof sanitizedReaderHtml!=='string'||typeof DOMParser==='undefined')throw new Error('Only an already-open original article can be saved for offline reading');
 const doc=new DOMParser().parseFromString(sanitizedReaderHtml,'text/html');
 for(const node of doc.querySelectorAll('script,style,nav,table,.mw-editsection,.reference,.hatnote,.navbox'))node.remove();
 const nodes=[...doc.querySelectorAll('p,li')];
 const sections=[];let characters=0,truncated=false;
 for(const node of nodes){
  const content=(node.textContent||'').replace(/\s+/g,' ').trim();
  if(content.length<30)continue;
  const text=content.slice(0,1100);
  if(characters+text.length>MAX_OFFLINE_CHARS||sections.length>=MAX_OFFLINE_SECTIONS){truncated=true;break;}
  sections.push(text);characters+=text.length;
  if(content.length>1100)truncated=true;
 }
 if(!sections.length)throw new Error('This article has no suitable visible text for a compact offline copy');
 if(sections.length<nodes.length)truncated=true;
 return offlineSnapshot({article:page.identity,sections,truncated});
}
