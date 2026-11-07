import {characterTabs} from './skyhaven-character-art.mjs?v=20261106-chat-art-v1';

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
export function createGenesisChatArt({host,fetchJSON,isActive,getURL=()=>location.href,replaceURL=url=>history.replaceState(null,'',url),navigate=hash=>{location.hash=hash;}}){
  let catalog,pending,kind='characters',pack='',query='',page=0,dialog,version=0;
  const route=()=>`#characters/genesis-chat/${kind}`;
  const picture=(item,lazy=true)=>`<span class="character-art-image">${imageURL(item)?`<img src="${esc(imageURL(item))}" alt="${esc(item.name)}" ${lazy?'loading="lazy"':''} decoding="async">`:'<span>이미지 연결 확인 필요</span>'}</span>`;
  function hide(){version++;dialog?.remove();dialog=null;}
  function open(item){
    if(dialog?.open&&dialog.dataset.chatId===item.id)return;
    const trigger=Array.from(host.querySelectorAll('[data-chat-art-id]')).find(button=>button.dataset.chatArtId===item.id);
    dialog?.remove();dialog=host.ownerDocument.createElement('dialog');dialog.className='character-art-dialog genesis-chat-art-dialog';dialog.dataset.chatId=item.id;dialog.setAttribute('aria-labelledby','chat-art-title');
    const source=catalog.packs[item.packId];
    dialog.innerHTML=`<header><div><small>GenesisChat · ${kind==='backgrounds'?'표지·배경':'캐릭터'}</small><h2 id="chat-art-title">${esc(item.name)}</h2></div><button type="button" data-chat-close aria-label="GenesisChat 원화 닫기">×</button></header><div class="character-art-dialog-scroll">${picture(item,false)}<div class="character-art-inspector"><p>${esc(source.name)}</p><p>${item.image.width} × ${item.image.height} · GenesisChat 공개 팩 참조 이미지</p><details><summary>원본 위치·SHA 확인</summary><p>팩: <code>${esc(item.packId)}</code>${item.profileId?` · 캐릭터: <code>${esc(item.profileId)}</code>`:''}</p><p><code>${esc(item.image.path)}</code></p><p><code>${esc(item.image.sourceHash)}</code></p><button type="button" data-copy="${esc(item.image.path)}">원본 경로 복사</button><button type="button" data-copy="${esc(item.image.sourceHash)}">SHA 복사</button></details><div class="character-art-actions">${imageURL(item)?`<a href="${esc(imageURL(item))}" target="_blank" rel="noopener noreferrer">공개 이미지 열기 ↗</a>`:''}</div></div></div>`;
    dialog.querySelector('[data-chat-close]').onclick=()=>dialog.close();
    dialog.addEventListener('close',()=>{if(isActive()){const url=new URL(getURL());url.hash=route();replaceURL(url);(trigger||host.querySelector('select'))?.focus({preventScroll:true});}});
    host.append(dialog);dialog.showModal();dialog.querySelector('[data-chat-close]').focus({preventScroll:true});
  }
  function draw(){
    dialog?.remove();dialog=null;
    const rows=filterChatArt(catalog,{kind,pack,query}),pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));page=Math.min(page,pages-1);
    host.innerHTML=`<div class="library-heading"><h1>GenesisChat 원화</h1>${characterTabs('genesis-chat')}</div><section class="character-art-archive genesis-chat-art" data-kind="${kind}"><header class="character-art-intro"><p class="eyebrow">GENESISCHAT ART LIBRARY</p><h2>캐릭터와 이야기의 배경.</h2><p>${catalog.counts.packs}개 팩 · 캐릭터 ${catalog.counts.characters}개 · 표지·배경 ${catalog.counts.backgrounds}개</p><small>공개 팩 연결 확인 ${esc(catalog.date)} · 원화 미연결 ${catalog.counts.missingPortraits}명</small></header><nav class="character-view-tabs character-art-filters" aria-label="GenesisChat 원화 종류"><a href="#characters/genesis-chat/characters" ${kind==='characters'?'aria-current="page"':''}>캐릭터 ${catalog.counts.characters}</a><a href="#characters/genesis-chat/backgrounds" ${kind==='backgrounds'?'aria-current="page"':''}>표지·배경 ${catalog.counts.backgrounds}</a></nav><label class="genesis-chat-pack-filter">팩 <select aria-label="GenesisChat 팩"><option value="">전체 팩</option>${Object.entries(catalog.packs).map(([id,p])=>`<option value="${esc(id)}" ${id===pack?'selected':''}>${esc(p.name)}</option>`).join('')}</select></label><p class="character-art-results" role="status">${rows.length}개 원화 · ${page+1} / ${pages} 페이지</p><p class="character-art-source-note">이미지는 GenesisChat 공개 원본에 연결됩니다.</p><div class="character-art-grid">${rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE).map(item=>`<article class="character-art-card"><button type="button" data-chat-art-id="${esc(item.id)}" aria-label="${esc(item.name)} 확대">${picture(item)}<span class="character-art-copy"><small>${kind==='backgrounds'?'표지·배경':esc(catalog.packs[item.packId].name)}</small><strong>${esc(item.name)}</strong><span>${esc(item.nameEn)}</span></span></button></article>`).join('')||'<p>이 조건에 맞는 원화가 없습니다.</p>'}</div><nav class="genesis-chat-pagination" aria-label="원화 페이지"><button type="button" class="button ghost" data-chat-page="previous" ${page===0?'disabled':''}>이전</button><span>${page+1} / ${pages}</span><button type="button" class="button ghost" data-chat-page="next" ${page===pages-1?'disabled':''}>다음</button></nav></section>`;
    host.querySelector('select').onchange=event=>{const url=new URL(getURL());pack=event.target.value;pack?url.searchParams.set('chatPack',pack):url.searchParams.delete('chatPack');url.hash=route();replaceURL(url);page=0;draw();host.querySelector('select').focus({preventScroll:true});};
  }
  async function render({search='',view='characters',selectedId='',refresh=false}={}){
    const current=++version,nextKind=view==='backgrounds'?'backgrounds':'characters',nextPack=new URL(getURL()).searchParams.get('chatPack')||'';
    const unchanged=catalog&&!refresh&&host.querySelector('.genesis-chat-art')&&query===search&&kind===nextKind&&pack===nextPack;
    if(!unchanged){page=0;query=search;kind=nextKind;pack=nextPack;host.innerHTML=`<div class="library-heading"><h1>GenesisChat 원화</h1>${characterTabs('genesis-chat')}</div><p role="status">원화 목록을 읽고 있습니다…</p>`;}
    try{
      if(refresh){catalog=null;pending=null;}
      if(!catalog){pending??=fetchJSON(CHAT_ART_API,{refresh});const result=await pending;if(current!==version||!isActive())return;catalog=result;pending=null;}
      if(current!==version||!isActive())return;
      if(!(pack in catalog.packs))pack='';
      if(!unchanged)draw();
      const selected=catalog.items.find(item=>item.id===selectedId&&item.kind===(kind==='backgrounds'?'background':'character'));
      if(selected)open(selected);
    }catch(error){pending=null;if(current===version&&isActive())host.innerHTML=`<div class="library-heading"><h1>GenesisChat 원화</h1>${characterTabs('genesis-chat')}</div><p role="alert">원화 목록을 읽지 못했습니다. ${esc(error.message)}</p><button type="button" data-chat-retry>다시 읽기</button>`;}
  }
  host.addEventListener('click',event=>{
    if(!isActive())return;
    const button=event.target.closest('[data-chat-art-id],[data-chat-page],[data-chat-retry]');if(!button)return;
    if(button.hasAttribute('data-chat-art-id'))navigate(route()+'/'+encodeURIComponent(button.dataset.chatArtId));
    else if(button.hasAttribute('data-chat-retry'))void render({search:query,view:kind,refresh:true});
    else {const direction=button.dataset.chatPage;page+=direction==='next'?1:-1;draw();const target=host.querySelector(`[data-chat-page="${direction}"]`);(target.disabled?host.querySelector(`[data-chat-page="${direction==='next'?'previous':'next'}"]`):target)?.focus({preventScroll:true});}
  });
  return {render,hide,search(value){query=value;page=0;if(catalog&&isActive())draw();}};
}
