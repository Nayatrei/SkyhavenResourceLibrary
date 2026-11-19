import {escapeHTML as esc,commandIcon as icon,commandImage} from './skyhaven-command.mjs?v=20261119-navigation-v1';
import {formatBytes,filterPackItems,sortPackItems,filterPacks} from './skyhaven-library-state.mjs?v=20261119-navigation-v1';
export const packTitle=name=>String(name||'Environment Library').replace(/^(?:DETAILED|POLYGON)\s*[·—-]\s*/i,'');
export function environmentCollection(entity){
  return {...entity,isEntity:true,root:entity.resourcePath,count:entity.related?.length??entity.relatedCount,gallery:entity.previews?.length?entity.previews:entity.cover?[entity.cover]:[]};
}
export function environmentSnapshot(entity){
  const files=entity.related||[];
  return {pack:environmentCollection(entity),items:files.filter(f=>['fbx','glb','gltf','obj','blend','usdz'].includes(f.extension?.toLowerCase())).map(f=>({...f,id:f.path,assetType:'model',kind:'static',category:'Source exports',sourceBytes:f.size})),scenes:(entity.sceneEntries||[]).filter(s=>s.sourceScene).map(s=>({name:s.name,path:s.sourceScene,guid:s.sourceSceneGuid}))};
}
export function environmentPacks(data,state){
  const entries=[...data.packs,...data.entities.filter(e=>e.category==='environments').map(environmentCollection)];
  return filterPacks(entries,state,'environments').sort((a,b)=>(a.group==='DETAILED'?0:1)-(b.group==='DETAILED'?0:1));
}
export function defaultEnvironmentPack(packs){
  return packs.find(p=>p.id==='DETAILED-MedievalCastle'&&p.availability==='local')||packs.find(p=>p.availability==='local'&&p.cover?.url)||packs[0];
}
export function packSummaryRows(pack,items=[]){
  const stats=pack.sourceStats||{},models=new Set(items.flatMap(i=>[...(i.models||[]),...(i.assetType==='model'&&i.path?[i.path]:[])]));
  const formats=[...new Set(items.flatMap(i=>[i.path||i.prefab,...(i.models||[])]).filter(Boolean).map(p=>p.split('.').at(-1).toUpperCase()))].sort();
  return [
    ['cube','Pack',pack.group||'—'],['user','Author',pack.publisher||pack.author||'Not indexed'],
    ['folder','Total Size',formatBytes(stats.folderBytes??stats.sourceBytes)],
    ['cube','Models',stats.models!=null?stats.models.toLocaleString():models.size?models.size.toLocaleString():'Not measured'],
    ['image','Textures',stats.maxTextureEdge?`${stats.maxTextureEdge.toLocaleString()} px max`:'Not measured'],
    ['layers','Formats',formats.length?formats.join(', '):'See related files'],
    ['link','License',pack.license||'See source terms'],
  ];
}
const image=(url,hosted,alt='',extra='')=>url?`<img ${hosted?'data-live-src':'src'}="${esc(url)}" alt="${esc(alt)}" ${extra}>`:'';
const readable=value=>String(value??'').replace(/^(?:SM_|SK_)/,'').replaceAll('_',' ');

export function createEnvironmentView({host,navigatorHost,getCatalog,getState,hosted=false,onPack,onOwned,itemImage}){
  let snapshot=null,mode='packs',activeTab='overview',item=null,kind='',sort='name',zoom=1,galleryIndex=0,dockLimit=80;
  let favorites=new Set();try{favorites=new Set(JSON.parse(localStorage.getItem('skyhaven.libraryFavorites')||'[]'));}catch{}
  const currentPack=()=>snapshot?.pack;
  const pictures=()=>{const p=currentPack();return p?[...(p.gallery?.length?p.gallery:p.cover?[p.cover]:[])]:[];};
  const currentPicture=()=>item?.thumbnailUrl?{url:item.thumbnailUrl,alt:item.name}:pictures()[galleryIndex%Math.max(pictures().length,1)];
  const sourcePicture=(className='')=>item?.thumbnailSprite?`<div class="${className} rts-atlas-view">${itemImage(item)}</div>`:image(currentPicture()?.url,hosted,item?.thumbnailUrl?item.name:currentPack()?.name||'',`class="${className}"`);
  function rowMarkup(rows){return rows.map(([symbol,label,value])=>`<div>${icon(symbol)}<dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('');}
  function inspector(){
    const p=currentPack();if(!p)return `<div class="rts-inspector-empty"><h2>No collection selected</h2><p>Choose a pack from the bottom dock.</p></div>`;
    const path=item?.prefab||item?.path||p.root;
    const views=[['overview','개요'],['scene','씬'],['models','모델'],['textures','텍스처']];
    let content='';
    if(activeTab==='overview'){
      const rows=item?[[iconName(item),'Type',item.assetType||'prefab'],['folder','Category',item.category||'—'],['folder','File Size',formatBytes(item.sourceBytes)],['cube','Triangles',item.tris?.toLocaleString()||'Not measured'],['image','Textures',String(item.textures?.length??0)],['cube','Models',String(item.models?.length??0)],['link','GUID',item.guid||'—']]:packSummaryRows(p,snapshot.items);
      content=`<div class="rts-inspector-image">${sourcePicture()}${!currentPicture()?.url&&!item?.thumbnailSprite?'<span>No source preview</span>':''}</div>${item&&!item.thumbnailUrl&&!item.thumbnailSprite?'<p class="rts-preview-evidence">Pack overview · individual preview not indexed</p>':''}<dl class="rts-metadata">${rowMarkup(rows)}</dl>`;
    }else if(activeTab==='scene'){
      content=`<div class="rts-scene-options">${pictures().map((pic,i)=>`<button data-rts-gallery="${i}" aria-pressed="${galleryIndex===i}">${image(pic.url,hosted,`Source scene ${i+1}`)}<span>Preview ${i+1}</span></button>`).join('')}</div><div class="rts-scene-files">${snapshot.scenes.map(s=>`<button data-copy="${esc(s.path)}">${icon('layers')}<span>${esc(readable(s.name))}<small>Copy Unity scene path</small></span>${icon('copy')}</button>`).join('')||'<p>No local demo scene indexed.</p>'}</div>`;
    }else{
      const entries=typeItems(activeTab==='models'?'models':'textures');
      content=`<div class="rts-inspector-list-heading">${entries.length.toLocaleString()} ${activeTab}<button data-rts-mode="${activeTab}">Browse in dock ↗</button></div><div class="rts-inspector-list">${entries.slice(0,80).map(i=>`<button data-rts-item="${esc(i.id)}">${icon(iconName(i))}<span>${esc(readable(i.name))}<small>${esc(i.category||i.assetType||'')}</small></span></button>`).join('')||'<p>No files of this type indexed.</p>'}</div>`;
    }
    return `<header class="rts-inspector-title"><h2>${esc(item?readable(item.name):packTitle(p.name))}</h2><button class="rts-favorite ${favorites.has(item?.id||p.id)?'active':''}" data-rts-favorite aria-label="Favorite ${esc(item?.name||p.name)}" aria-pressed="${favorites.has(item?.id||p.id)}">${icon('star')}</button></header><label class="catalog-field">상세 보기<select id="rts-detail-view">${views.map(([id,title])=>`<option value="${id}" ${activeTab===id?'selected':''}>${title}</option>`).join('')}</select></label><div class="rts-inspector-content">${content}</div><button class="rts-copy-path" data-copy="${esc(path||'')}" ${!path?'disabled':''}>${icon('folder')}<span>COPY PATH</span>${icon('copy')}</button><details class="rts-related"><summary>${icon('link')}<span>Related files</span><b>›</b></summary>${path?`<div><small>Project relative path</small><code>${esc(path)}</code></div>`:''}${item?.guid?`<div><small>Unity GUID</small><code>${esc(item.guid)}</code><button data-copy="${esc(item.guid)}">Copy GUID</button></div>`:''}${item?.sourceUrl?`<a ${hosted?'data-live-href':'href'}="${esc(item.sourceUrl)}">Original file ↓</a><button data-copy="${esc(item.sourceUrl)}">Copy source link</button>`:''}${item?.models?.map(m=>`<button data-copy="${esc(m)}">${esc(m)}</button>`).join('')||''}${p.related?.map(f=>`<a href="#file/${encodeURIComponent(f.path)}">${esc(f.name)} ↗</a>`).join('')||''}${p.storeUrl?`<a href="${esc(p.storeUrl)}" target="_blank" rel="noopener">Original store / license terms ↗</a>`:''}${item?.variants?.map(v=>`<button data-copy="${esc(v.path)}">${esc(v.name)} · ${esc(v.path)}</button>`).join('')||''}${item?.unityLoad?`<p>Unity file record: ${item.unityLoad.loaded?'loaded':'load pending'} · Runtime verification is separate.</p>`:''}${p.cover?.source?`<p>${esc(p.cover.source)}</p>`:''}</details>`;
  }
  function iconName(entry){return entry.assetType==='texture'?'image':'cube';}
  function typeItems(value){
    if(!snapshot)return [];
    const target=value==='models'?'model':value==='textures'?'texture':'prefab';
    return sortPackItems(filterPackItems(snapshot.items,{query:getState().query,scope:'environment',assetType:target,category:kind}),sort);
  }
  function dock(){
    const p=currentPack(),packs=environmentPacks(getCatalog(),getState());
    const entries=mode==='packs'?packs:typeItems(mode);
    return entries.slice(0,dockLimit).map(entry=>{
      const isPack=mode==='packs',isActive=isPack?p?.id===entry.id:item?.id===entry.id;
      const art=isPack?commandImage(entry,{hosted,alt:entry.name}):itemImage(entry);
      const count=isPack?(entry.environmentCount??entry.count):entry.assetType==='texture'?entry.textureMetrics?.width:entry.tris;
      return `<button class="rts-dock-card ${isActive?'selected':''}" ${isPack?'data-rts-pack':'data-rts-item'}="${esc(entry.id)}" aria-pressed="${isActive}"><div class="rts-dock-image">${art}</div><div class="rts-dock-caption"><strong>${esc(isPack?packTitle(entry.name):readable(entry.name))}</strong><span>${icon(isPack?'cube':iconName(entry))}${count?.toLocaleString()??'—'}</span></div></button>`;
    }).join('')+(entries.length>dockLimit?'<button class="rts-more-items" data-rts-more>More assets →</button>':'')||`<div class="rts-dock-empty">이 조건에 맞는 배경 자료가 없습니다. ${getState().group==='Dekogon'?'<button data-rts-owned>Dekogon owned products ↗</button>':''}</div>`;
  }
  function toolbar(){
    const kinds=[...new Set(typeItems(mode).map(i=>i.category).filter(Boolean))];
    return `<header class="rts-toolbar"><h1>배경·프랍</h1>${currentPack()?`<div class="rts-toolbar-controls"><label class="catalog-field">목록<select id="rts-mode">${[['packs','컬렉션'],['props','프랍·프리팹'],['models','모델'],['textures','텍스처']].map(([id,name])=>`<option value="${id}" ${mode===id?'selected':''}>${name}</option>`).join('')}</select></label>${mode!=='packs'?`<label class="catalog-field">종류<select id="rts-kind"><option value="">전체</option>${kinds.map(k=>`<option ${kind===k?'selected':''}>${esc(k)}</option>`).join('')}</select></label><label class="catalog-field">정렬<select id="rts-sort">${[['name','이름'],['triangles','삼각형 수'],['bytes','파일 용량'],['resolution','텍스처 크기']].map(([id,name])=>`<option value="${id}" ${sort===id?'selected':''}>${name}</option>`).join('')}</select></label>`:''}</div>`:''}</header>`;
  }
  function updateTransform(){
    const art=host.querySelector('.rts-scene-art');if(art)art.style.transform=`scale(${zoom})`;
  }
  function renderNavigator(){
    if(!navigatorHost)return;
    if(!currentPack()){navigatorHost.hidden=true;return;}
    host.querySelector('.rts-environment').append(navigatorHost);
    navigatorHost.hidden=false;
    const groups=new Set(environmentPacks(getCatalog(),{scope:getState().scope}).map(p=>p.group));
    const markers=[['POLYGON',27,24],['DETAILED',62,48],['Dekogon',25,75]].filter(([family])=>groups.has(family)||family==='Dekogon'&&['all','purchased',undefined].includes(getState().scope)&&!getCatalog().packs.some(p=>p.group===family));
    const map=new URL('./skyhaven-ui/library-map.png',import.meta.url).href;
    navigatorHost.innerHTML=`<div class="rts-navigator-image rts-library-map" aria-label="Library pack map, decorative application artwork"><img src="${esc(map)}" alt=""><span class="rts-map-label">LIBRARY MAP</span>${markers.map(([family,x,y])=>`<button class="rts-map-marker ${currentPack()?.group===family?'active':''}" ${family==='Dekogon'&&!getCatalog().packs.some(p=>p.group===family)?'data-rts-owned':'data-group="'+esc(family)+'"'} style="left:${x}%;top:${y}%" title="${esc(family)} library packs" aria-label="Browse ${esc(family)} packs">${icon(family==='POLYGON'?'cube':'castle')}</button>`).join('')}<span class="rts-navigator-north">N<br>▲</span></div><div class="rts-navigator-tools"><button data-rts-zoom="reset" aria-label="Reset source preview view">${icon('reset')}</button><button data-rts-scenes aria-label="Source scenes and previews" aria-pressed="${activeTab==='scene'}">${icon('layers')}</button><div><button data-rts-zoom="in" aria-label="Zoom source preview in">+</button><button data-rts-zoom="out" aria-label="Zoom source preview out">−</button></div></div>`;
    navigatorHost.onclick=event=>{
      const button=event.target.closest('button');if(!button)return;
      if(button.dataset.rtsZoom){const action=button.dataset.rtsZoom;if(action==='reset')zoom=1;else zoom=Math.max(1,Math.min(3,zoom+(action==='in'?.25:-.25)));updateTransform();}
      if(button.hasAttribute('data-rts-scenes')){activeTab=activeTab==='scene'?'overview':'scene';render();}
      if(button.hasAttribute('data-rts-owned'))onOwned('Dekogon');
    };
    updateTransform();
  }
  function render(next){
    if(next!==undefined){if(next?.pack?.id!==snapshot?.pack?.id){item=null;galleryIndex=0;zoom=1;}snapshot=next;}
    const dockScroll=host.querySelector('#rts-dock')?.scrollLeft||0;
    const focused=host.contains(host.ownerDocument.activeElement)?host.ownerDocument.activeElement.id:'';
    const p=currentPack(),hasArt=!!currentPicture()?.url||!!item?.thumbnailSprite;
    host.innerHTML=`<section class="rts-environment" data-pack-open="${!!p}">${toolbar()}<section id="rts-dock" class="rts-dock" aria-label="배경 자료 목록">${dock()}</section>${p?`<section class="rts-scene-stage" id="rts-stage" aria-label="${esc(packTitle(p.name)+' 미리보기')}"><div class="rts-scene-art">${sourcePicture()}</div><div class="rts-stage-message"><strong>${hasArt?'원본 미리보기':'등록된 미리보기 없음'}</strong><p data-source-message>${hasArt?'원본 서비스에 연결되면 이미지가 표시됩니다.':'상세 보기에서 원본 경로를 확인할 수 있습니다.'}</p></div>${!hasArt&&p.cover?`<div class="rts-missing-preview">${commandImage(p,{hosted,alt:p.name})}<span>컬렉션 대표 이미지</span></div>`:''}</section><aside class="rts-inspector" aria-label="선택한 배경 자료">${inspector()}</aside>`:''}</section>`;
    host.querySelector('#rts-dock').scrollLeft=dockScroll;
    if(focused)host.ownerDocument.getElementById(focused)?.focus({preventScroll:true});
    host.querySelector('.rts-scene-stage')?.classList.toggle('has-source-art',hasArt);
    renderNavigator();updateTransform();
  }
  host.addEventListener('click',event=>{
    if(!host.querySelector('.rts-environment'))return;
    const el=event.target.closest('button');if(!el)return;
    if(el.dataset.rtsPack)onPack(el.dataset.rtsPack);
    if(el.dataset.rtsItem){item=snapshot?.items.find(i=>i.id===el.dataset.rtsItem);activeTab='overview';galleryIndex=0;zoom=1;render();}
    if(el.dataset.rtsMode){mode=el.dataset.rtsMode;kind='';dockLimit=80;render();}
    if(el.hasAttribute('data-rts-more')){dockLimit+=80;render();}
    if(el.hasAttribute('data-rts-gallery')){galleryIndex=Number(el.dataset.rtsGallery);item=null;zoom=1;render();}
    if(el.hasAttribute('data-rts-favorite')){const id=item?.id||currentPack()?.id;if(!id)return;favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('skyhaven.libraryFavorites',JSON.stringify([...favorites]));}catch{}render();}
    if(el.hasAttribute('data-rts-owned'))onOwned('Dekogon');
  });
  host.addEventListener('change',event=>{
    if(!host.querySelector('.rts-environment'))return;
    const {id,value}=event.target;
    if(id==='rts-detail-view'){
      activeTab=value;
      if(['models','textures'].includes(value)){mode=value;kind='';}
    }else if(id==='rts-mode'){mode=value;kind='';dockLimit=80;}
    else if(id==='rts-kind'){kind=value;dockLimit=80;}
    else if(id==='rts-sort')sort=value;
    else return;
    render();
  });
  return {render,refresh:()=>render(),showCollections(){mode='packs';activeTab='overview';item=null;dockLimit=80;},get mode(){return mode;}};
}
