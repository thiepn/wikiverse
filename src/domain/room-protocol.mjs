/** Transport-neutral future multiplayer contract. No network transport is implemented here.
 * Validation of message shapes is NOT authentication. Only a trusted backend may set the verified context.
 */
export const ROOM_PROTOCOL_VERSION=1;
const ID=/^[a-f0-9-]{24,64}$/i;
const PARTICIPANT=/^[a-zA-Z0-9_-]{8,64}$/;
export function parseRoomClientCommand(input,{now=new Date()}={}){
 if(input?.version!==1||!ID.test(input.roomNonce||'')||!PARTICIPANT.test(input.participantId||''))throw new Error('Invalid room protocol identifiers');
 if(!['request_join','request_leave','submit_trail_attempt'].includes(input.kind))throw new Error('Unsupported room command');
 if(!Number.isSafeInteger(input.clientSequence)||input.clientSequence<1)throw new Error('Invalid client sequence');
 if(!Number.isFinite(Date.parse(input.at))||Math.abs(Date.parse(input.at)-now.getTime())>300000)throw new Error('Stale room command');
 if(input.kind==='submit_trail_attempt'&&(!Array.isArray(input.sourceProof)||input.sourceProof.length!==3||input.sourceProof.some(x=>typeof x!=='string'||!/^en:\d+:\d+$/.test(x))))throw new Error('Trail submissions require canonical source proof');
 return {version:1,kind:input.kind,roomNonce:input.roomNonce,participantId:input.participantId,clientSequence:input.clientSequence,at:new Date(Date.parse(input.at)).toISOString(),...(input.kind==='submit_trail_attempt'?{sourceProof:[...input.sourceProof]}:{})};
}
export function parseServerRoomEvent(input,{roomNonce,verifiedByAuthorizedTransport=false,previousSequence=0}={}){
 if(!verifiedByAuthorizedTransport)throw new Error('Room events require an authenticated server transport');
 if(input?.version!==1||!ID.test(roomNonce||'')||input.roomNonce!==roomNonce||!['member_joined','member_left','trail_result_accepted','room_closed'].includes(input.kind))throw new Error('Unexpected server room event');
 if(!Number.isSafeInteger(input.serverSequence)||input.serverSequence<=previousSequence)throw new Error('Duplicate or out-of-order server event');
 if(!Number.isFinite(Date.parse(input.at)))throw new Error('Invalid server timestamp');
 if(input.kind==='trail_result_accepted'&&(!PARTICIPANT.test(input.participantId||'')||typeof input.authoritativeScore!=='number'||!Number.isFinite(input.authoritativeScore)))throw new Error('Server result lacks authoritative score');
 if(['member_joined','member_left'].includes(input.kind)&&!PARTICIPANT.test(input.participantId||''))throw new Error('Server membership event lacks a valid actor');
 return {version:1,kind:input.kind,roomNonce,serverSequence:input.serverSequence,at:input.at,participantId:input.participantId??null,authoritativeScore:input.kind==='trail_result_accepted'?input.authoritativeScore:null};
}
export function reduceTrustedRoomState(state,event){
 if(event.roomNonce!==state.roomNonce||!Number.isInteger(event.serverSequence)||event.serverSequence<=state.serverSequence)throw new Error('Room event replay or identity mismatch');
 const members={...state.members};
 if(state.closed)throw new Error('Closed rooms cannot accept new events');
 if(event.kind==='member_joined')members[event.participantId]={status:'connected',lastServerSequence:event.serverSequence};
 if(event.kind==='member_left')delete members[event.participantId];
 const results=event.kind==='trail_result_accepted'?[...state.results,{participantId:event.participantId,score:event.authoritativeScore,serverSequence:event.serverSequence}]:state.results;
 return {...state,members,results,serverSequence:event.serverSequence,closed:event.kind==='room_closed'};
}
export function initialRemoteRoomState(roomNonce){if(!ID.test(roomNonce||''))throw new Error('Invalid room identity');return {roomNonce,members:{},results:[],serverSequence:0,closed:false,source:'server-verified-only'};}
