/** Source identity for session-only journeys. No QIDs, grades or new progress records. */
import {checkedArticle,sourceRevisionUrl} from './study.mjs';
export function topicSource(article){return checkedArticle(article);}
export function sourceHandoff(mode,input){
 const article=topicSource(input);
 if(!['galaxy','geo','chronicle','polyglot','race','linklab','study','detective','discover','pulse'].includes(mode))throw new Error('Unsupported source destination');
 if(['race','linklab','detective'].includes(mode)&&article.language!=='en')throw new Error('This original game requires an English Wikipedia source. Choose another mode or open the original edition.');
 return {mode,article,sourceUrl:sourceRevisionUrl(article),scoringAuthority:'original-mode-only'};
}
export function exactSource(actual,expected){
 const x=topicSource(expected),y=topicSource(actual);
 if(x.language!==y.language||x.pageId!==y.pageId||x.revisionId!==y.revisionId)throw new Error('Original Wikipedia language/page/revision changed; topic transfer refused');
 return x;
}
