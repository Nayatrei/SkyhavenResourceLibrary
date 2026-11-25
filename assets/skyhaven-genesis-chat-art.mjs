import {ltxEdition, chatTabs, renderReview, reviewViews} from './skyhaven-genesis-chat-packs.mjs?v=20261125-ltx-07';
export const CHAT_ART_API='/comfy/skyhaven/api/library/genesis-chat-art';
const PAGE_SIZE=48;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageURL=item=>{
  const url=new URL(item.image.url);
  return url.origin==='https://genesischat.online'&&url.pathname.startsWith('/content/images/')&&!url.search&&!url.hash?url.href:'';
};
export function filterChatArt(catalog,{kind='characters',pack='',query=''}={}){
  const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return catalog.items.filter(item=>item.kind===(kind==='backgrounds'?'background':'character')&&(!pack||item.packId===pack)
    &&words.every(word=>[item.name,item.nameEn,item.packId,item.profileId,catalog.packs[item.packId].name,catalog.packs[item.packId].nameEn].join(' ').toLocaleLowerCase().includes(word)));
}
export function createGenesisChatArt({host,fetchJSON,isActive,loadReview=async(edition='')=>{const file=edition===ltxEdition?'genesis-chat-packs-'+ltxEdition+'.json':'genesis-chat-packs.json';const r=await fetch(new URL('../artwork/'+file,import.meta.url),{cache:'no-cache'});if(!r.ok)throw new Error('영상 Pack HTTP '+r.status);return r.json();},getURL=()=>location.href,replaceURL=url=>history.replaceState(null,'',url),navigate=hash=>{location.hash=hash;}}){
  const editionFor = view => view!=='clip-library' && new URL(getURL()).searchParams.get('edition')===ltxEdition ? ltxEdition : '';
  let reviewCatalog,reviewSelection='',catalog,pending,kind='characters',pack='',query='',scope='all',page=0,dialog,version=0;
  const route=()=>kind==='backgrounds'?'#environments/genesis-chat/backgrounds':'#characters/genesis-chat/characters';
  const heading=()=>`<div class="library-heading"><h1>${kind==='backgrounds'?'GenesisChat 표지·배경':'GenesisChat 원화'}</h1></div>`;
  const picture=(item,lazy=true)=>`<span class="character-art-image">${imageURL(item)?`<img src="${esc(imageURL(item))}" alt="${esc(item.name)}" ${lazy?'loading="lazy"':''} decoding="async">`:'<span>이미지 연결 확인 필요</span>'}</span>`;
  function hide(){version++;dialog?.remove();dialog=null;}
  function open(item){
    if(dialog?.open&&dialog.dataset.chatId===item.id)return;
    const trigger=Array.from(host.querySelectorAll('[data-chat-art-id]')).find(button=>button.dataset.chatArtId===item.id);
    dialog?.remove();dialog=host.ownerDocument.createElement('dialog');dialog.className='character-art-dialog genesis-chat-art-dialog';dialog.dataset.chatId=item.id;dialog.setAttribute('aria-labelledby','chat-art-title');
    const source=catalog.packs[item.packId];
    dialog.innerHTML=`<header><div><small>GenesisChat · ${kind==='backgrounds'?'표지·배경':'캐릭터'}</small><h2 id="chat-art-title">${esc(item.name)}</h2></div><button type="button" data-chat-close aria-label="GenesisChat 원화 닫기">×</button></header><div class="character-art-dialog-scroll">${picture(item,false)}<div class="character-art-inspector"><p>${esc(source.name)}</p><p>${item.image.width} × ${item.image.height} · GenesisChat 공개 팩 참조 이미지</p><details><summary>원본 위치·SHA 확인</summary><p>팩: <code>${esc(item.packId)}</code>${item.profileId?` · 캐릭터: <code>${esc(item.profileId)}</code>`:''}</p><p><code>${esc(item.image.path)}</code></p><p><code>${esc(item.image.sourceHash)}</code></p><button type="button" data-copy="${esc(item.image.path)}">원본 경로 복사</button><button type="button" data-copy="${esc(item.image.sourceHash)}">SHA 복사</button></details><div class="character-art-actions">${imageURL(item)?`<a href="${esc(imageURL(item))}" target="_blank" rel="noopener noreferrer">공개 이미지 열기 ↗</a>`:''}</div></div></div>`;
    dialog.querySelector('[data-chat-close]').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{if(isActive()){const url=new URL(getURL());url.hash=route();replaceURL(url);(trigger||host.querySelector('#chat-pack-choice'))?.focus({preventScroll:true});}});
    host.append(dialog);dialog.showModal();dialog.querySelector('[data-chat-close]').focus({preventScroll:true});
    if(item.kind==='character'){
      const opened=dialog;
      const edition=editionFor('video-pack');
      Promise.resolve(reviewCatalog && (reviewCatalog.edition || '')===edition ? reviewCatalog : loadReview(edition)).then(result=>{
        if(dialog!==opened || !opened.open)return;
        reviewCatalog=result;
        const actor=result.characters.find(a=>a.packId===item.packId && a.profileId===item.profileId);
        if(!actor)return;
        const link=host.ownerDocument.createElement('a');
        link.href='#characters/genesis-chat/video-pack/'+encodeURIComponent(actor.slug);
        link.textContent='영상 Pack · '+Object.keys(actor.clips).length+'/10';
        opened.querySelector('.character-art-actions').append(link);
      }).catch(()=>{}); // The portrait is still usable when its supplemental catalog is offline.
    }
  }
  function draw(){
    dialog?.remove();dialog=null;
    if(reviewViews.includes(kind)){
      if(reviewCatalog)host.innerHTML=renderReview(reviewCatalog,{view:kind,selectedId:reviewSelection,query,scope,pack,pageURL:getURL()});
      return;
    }
    const rows=scope==='all'?filterChatArt(catalog,{kind,pack,query}):[],pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));page=Math.min(page,pages-1);
    const packs=Object.entries(catalog.packs).filter(([id])=>catalog.items.some(item=>item.packId===id&&item.kind===(kind==='backgrounds'?'background':'character')));
    const filter=scope==='all'?`<label class="catalog-field">팩<select id="chat-pack-choice"><option value="">전체 팩</option>${packs.map(([id,p])=>`<option value="${esc(id)}" ${id===pack?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label>`:'';
    host.innerHTML=`${heading()}${chatTabs(kind)}<section class="character-art-archive genesis-chat-art" data-kind="${kind}"><div class="catalog-results">${filter}<p class="character-art-results" role="status">${rows.length}개 원화</p></div>${rows.length?'<p class="character-art-source-note">이미지는 GenesisChat 공개 원본에 연결됩니다.</p>':''}<div class="character-art-grid">${rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(item=>`<article class="character-art-card"><button type="button" data-chat-art-id="${esc(item.id)}" aria-label="${esc(item.name)} 확대">${picture(item)}<span class="character-art-copy"><small>${kind==='backgrounds'?'표지·배경':esc(catalog.packs[item.packId].name)}</small><strong>${esc(item.name)}</strong><span>${esc(item.nameEn)}</span></span></button></article>`).join('')||'<p class="empty">이 조건에 맞는 원화가 없습니다.</p>'}</div>${pages>1?`<nav class="genesis-chat-pagination" aria-label="원화 페이지"><button type="button" class="button ghost" data-chat-page="previous" ${page===0?'disabled':''}>이전</button><span>${page+1} / ${pages}</span><button type="button" class="button ghost" data-chat-page="next" ${page===pages-1?'disabled':''}>다음</button></nav>`:''}</section>`;

  }
  async function render({search='',view='characters',selectedId='',refresh=false,scope:nextScope=scope}={}){
    const current=++version,nextKind=reviewViews.includes(view)?view:view==='backgrounds'?'backgrounds':'characters',nextPack=new URL(getURL()).searchParams.get('chatPack')||'';
    if(reviewViews.includes(nextKind)){
      dialog?.remove();dialog=null;kind=nextKind;reviewSelection=selectedId;query=search;pack=nextPack;scope=nextScope;
      try{
        const edition=editionFor(kind);
        if(!reviewCatalog || (reviewCatalog.edition || '')!==edition || refresh){
          host.innerHTML='<p role="status">자료를 읽고 있습니다…</p>';
          const result=await loadReview(edition);if(current!==version || !isActive())return;reviewCatalog=result;
        }
        draw();
      }catch(error){if(current===version && isActive())host.innerHTML=chatTabs(kind)+'<p role="alert">자료를 읽지 못했습니다. '+esc(error.message)+'</p><button data-chat-retry>다시 읽기</button>';}
      return;
    }
    const unchanged=catalog&&!refresh&&host.querySelector('.genesis-chat-art')&&query===search&&kind===nextKind&&pack===nextPack&&scope===nextScope;
    if(!unchanged){page=0;query=search;kind=nextKind;pack=nextPack;scope=nextScope;host.innerHTML=`${heading()}<p role="status">원화 목록을 읽고 있습니다…</p>`;}
    try{
      if(refresh){catalog=null;pending=null;}
      if(!catalog){pending??=fetchJSON(CHAT_ART_API,{refresh});const result=await pending;if(current!==version||!isActive())return;catalog=result;pending=null;}
      if(current!==version||!isActive())return;
      if(pack&&!filterChatArt(catalog,{kind,pack}).length)pack='';
      if(!unchanged)draw();
      const selected=catalog.items.find(item=>item.id===selectedId&&item.kind===(kind==='backgrounds'?'background':'character'));
      if(selected)open(selected);else if(dialog?.open)dialog.close();
    }catch(error){pending=null;if(current===version&&isActive())host.innerHTML=`${heading()}<p role="alert">원화 목록을 읽지 못했습니다. ${esc(error.message)}</p><button type="button" data-chat-retry>다시 읽기</button>`;}
  }
  host.addEventListener('click',event=>{
    if(!isActive())return;
    const button=event.target.closest('[data-chat-art-id],[data-chat-page],[data-chat-retry]');if(!button)return;
    if(button.hasAttribute('data-chat-art-id'))navigate(route()+'/'+encodeURIComponent(button.dataset.chatArtId));
    else if(button.hasAttribute('data-chat-retry'))void render({search:query,view:kind,selectedId:reviewSelection,refresh:true});
    else {const direction=button.dataset.chatPage;page+=direction==='next'?1:-1;draw();const target=host.querySelector(`[data-chat-page="${direction}"]`);(target.disabled?host.querySelector(`[data-chat-page="${direction==='next'?'previous':'next'}"]`):target)?.focus({preventScroll:true});}
  });
  host.addEventListener('change',event=>{
    if(!isActive())return;
    if(event.target.matches('[data-clip-loop]')){
      const video=event.target.closest('figure').querySelector('video');
      video.loop=event.target.checked;
      return;
    }
    if(event.target.id!=='chat-pack-choice')return;
    pack=event.target.value;
    const url=new URL(getURL());
    if(pack)url.searchParams.set('chatPack',pack);else url.searchParams.delete('chatPack');
    url.hash=route();replaceURL(url);page=0;draw();
    host.querySelector('#chat-pack-choice')?.focus({preventScroll:true});
  });
  return {render,hide,search(value){query=value;page=0;if((reviewViews.includes(kind)?reviewCatalog:catalog)&&isActive())draw();}};
}
