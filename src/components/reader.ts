import DOMPurify from 'dompurify';

export interface DisplayArticle {html: string; links: string[]; identity: {title:string, pageId:number, revisionId:number, language:string}}
export function makeReaderHtml(page:DisplayArticle): {html:string,available:Set<string>} {
  const doc = new DOMParser().parseFromString(page.html,'text/html');
  for (const element of Array.from(doc.querySelectorAll('script,style,iframe,object,embed,form,video,audio,img,figure,table,svg,math,button,input,textarea,select,nav,.mw-editsection,.reference,.reflist,.references,.navbox,.metadata,.hatnote,.toc,.mw-empty-elt'))) element.remove();
  const official=new Set(page.links.map(t=>t.replaceAll('_',' ')));
  const available=new Set<string>();
  for (const a of Array.from(doc.querySelectorAll('a'))) {
    const raw=a.getAttribute('href')||'';
    const match=raw.match(/^(?:\.\/|\/wiki\/)([^?#]+)(?:#[^?]*)?$/);
    let title='';
    try {if(match) title=decodeURIComponent(match[1]).replaceAll('_',' ');}catch{}
    if (!official.has(title) || /^[^ ]+:/.test(title) || !title) {
      a.replaceWith(doc.createTextNode(a.textContent||''));
    } else {
      a.setAttribute('href','#');
      a.setAttribute('data-article-title',title);
      a.removeAttribute('title');
      available.add(title);
    }
  }
  // Present actual parsed article paragraphs, not an invented excerpt. Block media, templates and active content.
  const html=DOMPurify.sanitize(doc.body.innerHTML,{
    ALLOWED_TAGS:['p','h2','h3','h4','b','strong','i','em','a','ul','ol','li','blockquote','code','pre','span','div','small','sup','sub','dl','dt','dd','br'],
    ALLOWED_ATTR:['href','data-article-title'],
    ALLOW_DATA_ATTR:true,
    FORBID_TAGS:['script','style','iframe','form','svg','math']
  });
  return {html,available};
}
