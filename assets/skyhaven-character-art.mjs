export const ART_API='/comfy/skyhaven/api/library/art-archive';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const media=(file,alt,hosted,original=false)=>`<span class="character-art-image"><span class="character-art-placeholder" aria-hidden="true">◇</span><img ${hosted?'data-live-src':'src'}="${esc(file.url)}" alt="${esc(alt)}" loading="${original?'eager':'lazy'}" decoding="async"></span>`;
const href=(url,hosted)=>`${hosted?'data-live-href':'href'}="${esc(url)}"`;
export const characterTabs=(active='3d')=>`<nav class="character-view-tabs" aria-label="캐릭터 보기"><a href="#characters" ${active==='3d'?'aria-current="page"':''}>3D 캐릭터</a><a href="#characters/art" ${active==='art'?'aria-current="page"':''}>원화</a></nav>`;
export function filterArt(catalog,{query='',pack=''}={}){
  const words=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return (catalog.items||[]).filter(item=>(!pack||item.pack===pack)&&words.every(word=>[item.id,item.name,item.package,item.role,item.status,item.version].join(' ').toLocaleLowerCase().includes(word)));
}
export function artCard(item,{hosted=false}={}){
  return `<article class="character-art-card"><button type="button" data-art-open="${esc(item.id)}" aria-label="${esc(item.name)} 원화 확대">${media(item.preview,item.name+' · '+item.package,hosted)}<span class="character-art-copy"><small>${esc(item.package)}</small><strong>${esc(item.name)}</strong><span>${esc(item.role)}</span><span class="character-art-status" data-approval="${esc(item.approvalKind||'curated')}">${esc(item.status||'기존 비교 자료')}</span></span></button></article>`;
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
  let catalog,pending,version=0,loadVersion=0,query='',pack='',dialog;
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
    dialog.innerHTML=`<header><div><small>${esc(item.package)}</small><h2 id="character-art-title">${esc(item.name)}</h2></div><button type="button" data-art-close aria-label="원화 미리보기 닫기">×</button></header><div class="character-art-dialog-scroll">${media(item.original,item.name+' 선정 원화',hosted,true)}<div class="character-art-inspector"><p>${esc(item.role)} · ${item.width} × ${item.height}</p><strong class="character-art-status" data-approval="${esc(item.approvalKind)}">${esc(item.status)}</strong><p>${esc(item.reason)}</p><small>버전: ${esc(item.version)} · 원화 선정과 3D·리그 검증은 별개입니다.</small><p class="character-art-source-note" data-source-message>${sourceOnline()?'':'원본 서버가 연결되면 이미지를 볼 수 있습니다.'}</p><div class="character-art-actions"><a ${href(item.original.url,hosted)} download>원본 이미지 ↓</a>${item.assetId?`<a href="#characters/${encodeURIComponent(item.assetId)}">3D 캐릭터 보기 ↗</a>`:'<span>연결된 3D 모델 없음</span>'}</div></div>${comparisons.map(caseData=>artComparison(caseData,{hosted})).join('')}</div>`;
    dialog.querySelector('[data-art-close]').onclick=()=>{dialog.close();};
    dialog.addEventListener('close',()=>{if(isActive()&&new URL(getURL()).hash.split('/').length>2)replaceURL(new URL(getURL()).pathname+new URL(getURL()).search+'#characters/art');});
    host.append(dialog);dialog.showModal();
  }
  async function render({search='',selectedId='',refresh=false}={}){
    const current=++version,nextPack=new URL(getURL()).searchParams.get('artPack')||'';
    // Opening another art image keeps the roster DOM and its scroll position.
    if(catalog&&!refresh&&host.querySelector('.character-art-archive')&&search===query&&nextPack===pack){
      const selected=catalog.items.find(item=>item.id===selectedId);if(selected)open(selected);return;
    }
    query=search;pack=nextPack;
    host.innerHTML=`<div class="library-heading"><h1>Character Library</h1>${characterTabs('art')}</div><p role="status">원화 목록을 연결하고 있습니다…</p>`;
    try{
      await load({refresh});if(current!==version||!isActive())return;
      if(!catalog.available){host.insertAdjacentHTML('beforeend','<p>아직 연결된 Character Art Archive가 없습니다.</p>');return;}
      if(!(pack in catalog.packs))pack='';
      draw();
      const selected=(catalog.items||[]).find(item=>item.id===selectedId);
      if(selected)open(selected);
    }catch(error){if(current===version&&isActive())host.innerHTML=`<div class="library-heading"><h1>Character Library</h1>${characterTabs('art')}</div><div class="empty"><p>원화 목록을 연결하지 못했습니다.</p><p>${esc(error.message)}</p><button type="button" data-art-retry>다시 연결</button></div>`;}
  }
  function draw(){
    dialog?.remove();dialog=null;
    const rows=filterArt(catalog,{query,pack});
    host.innerHTML=`<div class="library-heading"><h1>Character Library</h1>${characterTabs('art')}</div><section class="character-art-archive"><header class="character-art-intro"><p class="eyebrow">CHARACTER ART ARCHIVE</p><h2>캐릭터의 시작을 한곳에서.</h2><p>선정 원화와 기존 비교 결과 · ${catalog.counts?.characters??0}개 인물 디자인 · ${catalog.counts?.equipment??0}개 장비</p><small>원본 보관함 갱신 ${esc(catalog.date)} · 기존 사용자 평가와 선별 상태를 보존합니다.</small></header><nav class="character-art-filters" aria-label="원화 그룹"><button type="button" data-art-pack="" aria-pressed="${!pack}">전체 ${catalog.items.length}</button>${Object.entries(catalog.packs).map(([id,group])=>`<button type="button" data-art-pack="${esc(id)}" aria-pressed="${pack===id}">${esc(group.name)} <small>${catalog.items.filter(item=>item.pack===id).length}</small></button>`).join('')}</nav><p class="character-art-results" role="status">${rows.length}개 원화 · 이미지를 누르면 크게 보기와 전후 비교를 엽니다.</p><p class="character-art-source-note" data-source-message>${sourceOnline()?'':'원본 서버가 연결되면 이미지가 표시됩니다. 목록과 선정 상태는 계속 볼 수 있습니다.'}</p><div class="character-art-grid">${rows.map(item=>artCard(item,{hosted})).join('')||'<p class="empty">이 조건에 맞는 원화가 없습니다.</p>'}</div></section>`;
  }
  host.addEventListener('click',event=>{
    const button=event.target.closest('[data-art-pack],[data-art-retry]');if(!button||!isActive())return;
    if(button.hasAttribute('data-art-retry')){void render({search:query,refresh:true});return;}
    pack=button.dataset.artPack;const url=new URL(getURL());pack?url.searchParams.set('artPack',pack):url.searchParams.delete('artPack');replaceURL(url);draw();
  });
  return {load,render,hide,search(value){query=value;if(catalog&&isActive())draw();}};
}
