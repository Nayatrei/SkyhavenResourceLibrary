import {inLibraryScope} from './skyhaven-library-state.mjs?v=20261119-navigation-v1';

export const ART_API='/comfy/skyhaven/api/library/art-archive';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const media=(file,alt,hosted,original=false)=>`<span class="character-art-image"><span class="character-art-placeholder" aria-hidden="true">◇</span><img ${hosted&&file.storage!=='site'?'data-live-src':'src'}="${esc(file.url)}" alt="${esc(alt)}" loading="${original?'eager':'lazy'}" decoding="async"></span>`;
const href=(file,hosted)=>`${hosted&&file.storage!=='site'?'data-live-href':'href'}="${esc(file.url)}"`;
export function filterArt(catalog,{query='',pack='',scope='all'}={}){
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (catalog.items||[]).filter(item=>inLibraryScope(item,scope)&&(!pack||item.pack===pack)&&words.every(word=>[item.id,item.name,item.package,item.role,item.status,item.version].join(' ').toLocaleLowerCase().includes(word)));
}
export function artCard(item,{hosted=false}={}){
  return `<article class="character-art-card" data-pack="${esc(item.pack)}"><button type="button" data-art-open="${esc(item.id)}" aria-label="${esc(item.name)} 원화 확대">${media(item.preview,item.name+' · '+item.package,hosted)}<span class="character-art-copy"><small>${esc(item.package)}</small><strong>${esc(item.name)}</strong><span>${esc(item.role)}</span><span class="character-art-status" data-approval="${esc(item.approvalKind||'curated')}">${esc(item.status||'기존 비교 자료')}</span></span></button></article>`;
}
export function artComparison(caseData,{hosted=false}={}){
  const side=(key,title)=>`<figure>${media(caseData[key].preview,caseData.name+' '+title,hosted)}<figcaption>${title} · ${esc(caseData[key].version)}</figcaption></figure>`;
  return `<section class="character-art-comparison"><h3>${esc(caseData.caption)}</h3><div class="character-art-pair">${side('before','원본 원화')}${side('after','비교 결과')}</div><p>${esc(caseData.note)}</p>${caseData.prompt?`<details class="character-art-prompt"><summary>사용한 프롬프트</summary><pre>${esc(caseData.prompt.prompt)}</pre><button type="button" data-copy="${esc(caseData.prompt.prompt)}">프롬프트 복사</button>${caseData.prompt.model?`<small>${esc(caseData.prompt.model)}</small>`:''}</details>`:''}</section>`;
}
export function linkedArt(catalog,identity,{hosted=false}={}){
  const items=(catalog.items||[]).filter(item=>item.assetId===identity);
  if(!items.length)return '';
  return `<section class="character-art-linked"><div class="character-art-section-title"><h3>Character Art Archive</h3><a href="#characters/art">원화 전체 보기 ↗</a></div><div class="character-art-grid">${items.map(item=>artCard(item,{hosted})).join('')}</div></section>`;
}
export function createCharacterArtArchive({host,fetchJSON,isActive,hosted=false,sourceOnline=()=>true,getURL=()=>location.href,replaceURL=url=>history.replaceState(null,'',url)}){
  let catalog,pending,version=0,loadVersion=0,query='',pack='',scope='all',dialog;
  const heading='<div class="library-heading"><h1>캐릭터 원화</h1></div>';
  const sourceNote=()=>catalog?.mediaStorage==='site'?'<p class="character-art-source-note">원화 이미지는 사이트에 보관되어 원본 서비스 연결 없이 볼 수 있습니다.</p>':`<p class="character-art-source-note" data-source-message>${sourceOnline()?'':'원본 서버가 연결되면 이미지가 표시됩니다. 목록과 선정 상태는 계속 볼 수 있습니다.'}</p>`;
  async function load({refresh=false,signal}={}){
    if(refresh){catalog=null;pending=null;loadVersion++;}
    if(!catalog){
      const current=loadVersion;
      if(!pending)pending=fetchJSON(ART_API,{signal,refresh}).then(value=>{if(current===loadVersion)catalog=value;return value;}).finally(()=>{if(current===loadVersion)pending=null;});
      return pending;
    }
    return catalog;
  }
  function hide(){version++;if(dialog?.open)dialog.close();dialog?.remove();dialog=null;}
  function open(item){
    if(dialog?.open&&dialog.dataset.artId===item.id)return;
    dialog?.remove();dialog=host.ownerDocument.createElement('dialog');dialog.className='character-art-dialog';dialog.setAttribute('aria-labelledby','character-art-title');
    dialog.dataset.artId=item.id;
    const comparisons=(catalog.comparisons||[]).filter(caseData=>caseData.id===item.id);
    dialog.innerHTML=`<header><div><small>${esc(item.package)}</small><h2 id="character-art-title">${esc(item.name)}</h2></div><button type="button" data-art-close aria-label="원화 미리보기 닫기">×</button></header><div class="character-art-dialog-scroll">${media(item.original,item.name+' 선정 원화',hosted,true)}<div class="character-art-inspector"><p>${esc(item.role)} · ${item.width} × ${item.height}</p><strong class="character-art-status" data-approval="${esc(item.approvalKind)}">${esc(item.status)}</strong><p>${esc(item.reason)}</p><small>버전: ${esc(item.version)} · 원화 선정과 3D·리그 검증은 별개입니다.</small>${sourceNote()}<div class="character-art-actions"><a ${href(item.original,hosted)} download="${esc(item.original.path.split('/').at(-1))}">원본 이미지 ↓</a>${item.assetId?`<a href="#characters/${encodeURIComponent(item.assetId)}">3D 캐릭터 보기 ↗</a>`:'<span>연결된 3D 모델 없음</span>'}</div></div>${comparisons.map(caseData=>artComparison(caseData,{hosted})).join('')}</div>`;
    dialog.querySelector('[data-art-close]').onclick=()=>{dialog.close();};
    dialog.addEventListener('close',()=>{if(isActive()&&new URL(getURL()).hash.split('/').length>2)replaceURL(new URL(getURL()).pathname+new URL(getURL()).search+'#characters/art');});
    host.append(dialog);dialog.showModal();
  }
  async function render({search='',selectedId='',refresh=false,scope:nextScope=scope}={}){
    const current=++version,nextPack=new URL(getURL()).searchParams.get('artPack')||'';
    // Opening another art image keeps the roster DOM and its scroll position.
    if(catalog&&!refresh&&host.querySelector('.character-art-archive')&&search===query&&nextPack===pack&&nextScope===scope){
      const selected=catalog.items.find(item=>item.id===selectedId);if(selected)open(selected);else if(dialog?.open)dialog.close();return;
    }
    query=search;pack=nextPack;scope=nextScope;
    host.innerHTML=`${heading}<p role="status">원화 목록을 연결하고 있습니다…</p>`;
    try{
      await load({refresh});if(current!==version||!isActive())return;
      if(!catalog.available){host.insertAdjacentHTML('beforeend','<p>아직 연결된 Character Art Archive가 없습니다.</p>');return;}
      if(pack&&!filterArt(catalog,{pack,scope}).length)pack='';
      draw();
      const selected=(catalog.items||[]).find(item=>item.id===selectedId);
      if(selected)open(selected);
    }catch(error){if(current===version&&isActive())host.innerHTML=`${heading}<div class="empty"><p>원화 목록을 연결하지 못했습니다.</p><p>${esc(error.message)}</p><button type="button" data-art-retry>다시 연결</button></div>`;}
  }
  function draw(){
    dialog?.remove();dialog=null;
    const scoped=filterArt(catalog,{scope}),rows=filterArt(catalog,{query,pack,scope});
    const packs=Object.entries(catalog.packs).filter(([id])=>scoped.some(item=>item.pack===id));
    const filter=packs.length?`<label class="catalog-field">컬렉션<select id="art-pack-choice"><option value="">전체 컬렉션</option>${packs.map(([id,group])=>`<option value="${esc(id)}" ${id===pack?'selected':''}>${esc(group.name)}</option>`).join('')}</select></label>`:'';
    host.innerHTML=`${heading}<section class="character-art-archive"><div class="catalog-results">${filter}<p class="character-art-results" role="status">${rows.length}개 원화</p></div>${sourceNote()}<div class="character-art-grid">${rows.map(item=>artCard(item,{hosted})).join('')||'<p class="empty">이 조건에 맞는 원화가 없습니다.</p>'}</div></section>`;
  }
  host.addEventListener('click',event=>{
    if(isActive()&&event.target.closest('[data-art-retry]'))void render({search:query,refresh:true});
  });
  host.addEventListener('change',event=>{
    if(!isActive()||event.target.id!=='art-pack-choice')return;
    pack=event.target.value;
    const url=new URL(getURL());
    if(pack)url.searchParams.set('artPack',pack);else url.searchParams.delete('artPack');
    replaceURL(url);draw();host.querySelector('#art-pack-choice')?.focus({preventScroll:true});
  });
  return {load,render,hide,search(value){query=value;if(catalog&&isActive())draw();}};
}
