/** Portable private-room *invitations*, not realtime room state or authentication. */
import {validateArenaManifest} from './arena.mjs';
const VERSION=1;
function alias(value,max=36){return typeof value==='string'&&value.trim().length>=2&&value.trim().length<=max&&!/[\u0000-\u001f<>]/.test(value)?value.trim():null;}
export function validateRoomInvite(input,now=new Date()){
 if(input?.version!==VERSION||input?.kind!=='local-private-trail-invite'||typeof input.nonce!=='string'||! /^[a-f0-9-]{24,64}$/i.test(input.nonce))throw new Error('Invalid room invitation identity');
 if(!alias(input.name,70)||!alias(input.hostAlias)||!Number.isInteger(input.capacity)||input.capacity<2||input.capacity>8)throw new Error('Invalid private room details');
 const manifest=validateArenaManifest(input.manifest);
 const created=Date.parse(input.createdAt),expiry=Date.parse(input.expiresAt);
 if(!Number.isFinite(created)||!Number.isFinite(expiry)||expiry<=created||expiry-created>7*86400000||created>now.getTime()+300000||expiry<=now.getTime())throw new Error('Room invitation has expired or contains invalid dates');
 return {version:1,kind:'local-private-trail-invite',nonce:input.nonce,name:input.name.trim(),hostAlias:input.hostAlias.trim(),capacity:input.capacity,createdAt:new Date(created).toISOString(),expiresAt:new Date(expiry).toISOString(),manifest,transport:'portable-code-only',ranked:false,authoritative:false};
}
export function createRoomInvite(manifest,{name,hostAlias,capacity=4,nonce,now=new Date()}={}){
 const createdAt=now.toISOString(),expiresAt=new Date(now.getTime()+86400000).toISOString();
 return validateRoomInvite({version:1,kind:'local-private-trail-invite',nonce,name,hostAlias,capacity,createdAt,expiresAt,manifest},now);
}
export function encodeRoomInvite(room){
 const valid=validateRoomInvite(room);const data=new TextEncoder().encode(JSON.stringify(valid));
 if(data.length>4500)throw new Error('Invitation too large');
 let binary='';for(const b of data)binary+=String.fromCharCode(b);
 return 'WVROOM1.'+btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function decodeRoomInvite(code,now=new Date()){
 if(typeof code!=='string'||!/^WVROOM1\.[A-Za-z0-9_-]{20,6400}$/.test(code.trim()))throw new Error('Invalid room invitation code');
 try{
  const bytes=Uint8Array.from(atob(code.trim().slice(8).replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
  if(bytes.length>4500)throw Error('oversized');
  return validateRoomInvite(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),now);
 }catch(e){throw new Error('Room invitation could not be verified: '+(e?.message||'invalid payload'));}
}
export function localJoinIntent(room,{alias:participantAlias,now=new Date()}={}){
 const invitation=validateRoomInvite(room,now);
 if(!alias(participantAlias)||participantAlias.trim().toLowerCase()===invitation.hostAlias.toLowerCase())throw new Error('Enter a distinct, valid participant nickname');
 return {roomNonce:invitation.nonce,participantAlias:participantAlias.trim(),role:'guest-local-preview',challengeId:invitation.manifest.id,createdAt:now.toISOString(),presence:'NOT_CONNECTED',membershipVerified:false,ranked:false};
}
