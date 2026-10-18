/** Navigation changes the UI only. It does not create a new progress or scoring authority. */
import {studyTopics} from './study.mjs';
export const navigationSections=[
 {id:'home',title:'Explore',description:'Connections & discoveries',children:['galaxy','geo','chronicle','pulse','capsule']},
 {id:'play',title:'Play',description:'Source-backed challenges',children:['race','mystery','linklab','arena','missions']},
 {id:'learn',title:'Learn',description:'Read, compare & remember',children:['polyglot','detective','study']},
 {id:'discover',title:'Discover',description:'Read real Wikipedia',children:[]},
 {id:'library',title:'My Universe',description:'Your local collection',children:['backup']}
];
export function sectionForScreen(screen){
 return navigationSections.find(group=>group.id===screen||group.children.includes(screen))?.id||'home';
}
/** Reuse the checked original language/page/revision from an existing record. No synthetic topic. */
export function resumeSource(progress){
 return studyTopics(progress)[0]?.article||null;
}
