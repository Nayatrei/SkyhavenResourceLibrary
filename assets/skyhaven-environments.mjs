import {escapeHTML as esc,commandIcon as icon,commandImage} from './skyhaven-command.mjs?v=20261026-access-v2';
import {formatBytes,filterPackItems,sortPackItems,matchesPack,packInSection} from './skyhaven-library-state.mjs?v=20261023-library-v15';
export const packTitle=name=>String(name||'Environment Library').replace(/^(?:DETAILED|POLYGON)\s*[·—-]\s*/i,'');
export function environmentCollection(entity){
  return {...entity,isEntity:true,root:entity.resourcePath,count:entity.related?.length??entity.relatedCount,gallery:entity.previews?.length?entity.previews:entity.cover?[entity.cover]:[]};
}
export function environmentSnapshot(entity){
  const files=entity.related||[];
  return {pack:environmentCollection(entity),items:files.filter(f=>['fbx','glb','gltf','obj','blend','usdz'].includes(f.extension?.toLowerCase())).map(f=>({...f,id:f.path,assetType:'model',kind:'static',category:'Source exports',sourceBytes:f.size})),scenes:(entity.sceneEntries||[]).filter(s=>s.sourceScene).map(s=>({name:s.name,path:s.sourceScene,guid:s.sourceSceneGuid}))};
}
export function environmentPacks(data,state){
  return [...data.packs,...data.entities.filter(e=>e.category==='environments').map(environmentCollection)].filter(p=>packInSection(p,'environments')&&(state.game==='all'||p.game===state.game)&&(!state.group||p.group===state.group)&&matchesPack(p,state.query,'environments')).sort((a,b)=>(a.group==='DETAILED'?0:1)-(b.group==='DETAILED'?0:1));
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

export function createEnvironmentView({host,navigatorHost,getCatalog,getState,hosted=false,onPack,onQuery,onOwned,itemImage}){
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
    const tabs=[['overview','Overview'],['scene','Scene'],['models','Models'],['textures','Textures']];
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
    return `<header class="rts-inspector-title"><h2>${esc(item?readable(item.name):packTitle(p.name))}</h2><button class="rts-favorite ${favorites.has(item?.id||p.id)?'active':''}" data-rts-favorite aria-label="Favorite ${esc(item?.name||p.name)}" aria-pressed="${favorites.has(item?.id||p.id)}">${icon('star')}</button></header><nav class="rts-inspector-tabs" aria-label="Asset details">${tabs.map(([id,title])=>`<button data-rts-tab="${id}" aria-pressed="${activeTab===id}">${title}</button>`).join('')}</nav><div class="rts-inspector-content">${content}</div><button class="rts-copy-path" data-copy="${esc(path||'')}" ${!path?'disabled':''}>${icon('folder')}<span>COPY PATH</span>${icon('copy')}</button><details class="rts-related"><summary>${icon('link')}<span>Related files</span><b>›</b></summary>${path?`<div><small>Project relative path</small><code>${esc(path)}</code></div>`:''}${item?.guid?`<div><small>Unity GUID</small><code>${esc(item.guid)}</code><button data-copy="${esc(item.guid)}">Copy GUID</button></div>`:''}${item?.sourceUrl?`<a ${hosted?'data-live-href':'href'}="${esc(item.sourceUrl)}">Original file ↓</a><button data-copy="${esc(item.sourceUrl)}">Copy source link</button>`:''}${item?.models?.map(m=>`<button data-copy="${esc(m)}">${esc(m)}</button>`).join('')||''}${p.related?.map(f=>`<a href="#file/${encodeURIComponent(f.path)}">${esc(f.name)} ↗</a>`).join('')||''}${p.storeUrl?`<a href="${esc(p.storeUrl)}" target="_blank" rel="noopener">Original store / license terms ↗</a>`:''}${item?.variants?.map(v=>`<button data-copy="${esc(v.path)}">${esc(v.name)} · ${esc(v.path)}</button>`).join('')||''}${item?.unityLoad?`<p>Unity file record: ${item.unityLoad.loaded?'loaded':'load pending'} · Runtime verification is separate.</p>`:''}${p.cover?.source?`<p>${esc(p.cover.source)}</p>`:''}</details>`;
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
    }).join('')+(entries.length>dockLimit?'<button class="rts-more-items" data-rts-more>More assets →</button>':'')||`<div class="rts-dock-empty">No matching ${mode}. ${getState().group==='Dekogon'?'<button data-rts-owned>Dekogon owned products ↗</button>':'Try another pack family or search.'}</div>`;
  }
  function toolbar(){
    const s=getState(),groups=[...new Set(environmentPacks(getCatalog(),{game:s.game,group:'',query:''}).map(p=>p.group))];
    const kinds=[...new Set(typeItems(mode).map(i=>i.category).filter(Boolean))];
    return `<header class="rts-toolbar"><h1>Environment Library</h1><div class="rts-toolbar-controls"><details class="rts-toolbar-menu"><summary>${icon('layers')}<span>Packs</span>${icon('chevron')}</summary><div><button data-group="">All packs</button>${groups.map(g=>`<button data-group="${esc(g)}" aria-pressed="${s.group===g}">${esc(g)}</button>`).join('')}</div></details><details class="rts-toolbar-menu"><summary>${icon('cube')}<span>${mode==='models'?'Models':mode==='textures'?'Textures':'Props'}</span>${icon('chevron')}</summary><div>${[['packs','Pack collections'],['props','Props / prefabs'],['models','Models'],['textures','Textures']].map(([id,name])=>`<button data-rts-mode="${id}" aria-pressed="${mode===id}">${name}</button>`).join('')}</div></details><label class="rts-context-search">${icon('search')}<input id="rts-search" type="search" value="${esc(s.query)}" placeholder="Search environments..." aria-label="Search environments"></label><details class="rts-toolbar-menu rts-filter-menu"><summary aria-label="Filter and sort">${icon('sliders')}</summary><div><label>Asset category<select id="rts-kind"><option value="">All categories</option>${kinds.map(k=>`<option ${kind===k?'selected':''}>${esc(k)}</option>`).join('')}</select></label><label>Sort<select id="rts-sort">${[['name','Name'],['triangles','Triangle count'],['bytes','File size'],['resolution','Texture size']].map(([id,name])=>`<option value="${id}" ${sort===id?'selected':''}>${name}</option>`).join('')}</select></label><small>${mode==='packs'?'Choose Props or Models to filter individual files.':'Filters apply to the selected pack.'}</small></div></details></div></header>`;
  }
  function updateTransform(){
    const art=host.querySelector('.rts-scene-art');if(art)art.style.transform=`scale(${zoom})`;
  }
  function renderNavigator(){
    if(!navigatorHost)return;
    navigatorHost.hidden=false;
    const map=new URL('./skyhaven-ui/library-map.png',import.meta.url).href;
    navigatorHost.innerHTML=`<div class="rts-navigator-image rts-library-map" aria-label="Library pack map, decorative application artwork"><img src="${esc(map)}" alt=""><span class="rts-map-label">LIBRARY MAP</span>${[['POLYGON',27,24],['DETAILED',62,48],['Dekogon',25,75]].map(([family,x,y])=>`<button class="rts-map-marker ${currentPack()?.group===family?'active':''}" ${family==='Dekogon'&&!getCatalog().packs.some(p=>p.group===family)?'data-rts-owned':'data-group="'+esc(family)+'"'} style="left:${x}%;top:${y}%" title="${esc(family)} library packs" aria-label="Browse ${esc(family)} packs">${icon(family==='POLYGON'?'cube':'castle')}</button>`).join('')}<span class="rts-navigator-north">N<br>▲</span></div><div class="rts-navigator-tools"><button data-rts-zoom="reset" aria-label="Reset source preview view">${icon('reset')}</button><button data-rts-scenes aria-label="Source scenes and previews" aria-pressed="${activeTab==='scene'}">${icon('layers')}</button><div><button data-rts-zoom="in" aria-label="Zoom source preview in">+</button><button data-rts-zoom="out" aria-label="Zoom source preview out">−</button></div></div>`;
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
    const searchFocused=host.querySelector('#rts-search')===host.ownerDocument.activeElement,searchPosition=host.querySelector('#rts-search')?.selectionStart;
    const p=currentPack(),hasArt=!!currentPicture()?.url||!!item?.thumbnailSprite;
    host.innerHTML=`<section class="rts-environment">${toolbar()}<section class="rts-scene-stage" id="rts-stage" aria-label="${esc(p?packTitle(p.name)+' source preview':'Environment preview')}"><div class="rts-scene-art">${sourcePicture()}</div><div class="rts-stage-message"><strong>${!p?'Choose a collection':hasArt?'Source preview':'No individual preview indexed'}</strong><p data-source-message>${!p?'Use the pack families or owned library.':!hasArt?'The original file path remains available in the inspector.':'Original images appear when the source service is ONLINE.'}</p></div>${p&&!hasArt&&p.cover?`<div class="rts-missing-preview">${commandImage(p,{hosted,alt:p.name})}<span>Pack overview · no individual preview</span></div>`:''}</section><aside class="rts-inspector" aria-label="Selected asset inspector">${inspector()}</aside><section id="rts-dock" class="rts-dock" aria-label="${mode==='packs'?'Environment pack collections':'Individual '+mode}">${dock()}</section></section>`;
    host.querySelector('#rts-dock').scrollLeft=dockScroll;
    host.querySelector('#rts-search').oninput=event=>onQuery(event.target.value);
    host.querySelector('#rts-kind').onchange=event=>{kind=event.target.value;dockLimit=80;render();};
    host.querySelector('#rts-sort').onchange=event=>{sort=event.target.value;render();};
    if(searchFocused){host.querySelector('#rts-search').focus({preventScroll:true});if(searchPosition!=null)host.querySelector('#rts-search').setSelectionRange(searchPosition,searchPosition);}
    host.querySelector('.rts-scene-stage').classList.toggle('has-source-art',hasArt);
    renderNavigator();updateTransform();
  }
  host.addEventListener('click',event=>{
    if(!host.querySelector('.rts-environment'))return;
    const el=event.target.closest('button');if(!el)return;
    if(el.dataset.rtsPack)onPack(el.dataset.rtsPack);
    if(el.dataset.rtsItem){item=snapshot?.items.find(i=>i.id===el.dataset.rtsItem);activeTab='overview';galleryIndex=0;zoom=1;render();}
    if(el.dataset.rtsMode){mode=el.dataset.rtsMode;kind='';dockLimit=80;render();}
    if(el.hasAttribute('data-rts-more')){dockLimit+=80;render();}
    if(el.dataset.rtsTab){activeTab=el.dataset.rtsTab;if(['models','textures'].includes(activeTab)){mode=activeTab;kind='';}render();}
    if(el.hasAttribute('data-rts-gallery')){galleryIndex=Number(el.dataset.rtsGallery);item=null;zoom=1;render();}
    if(el.hasAttribute('data-rts-favorite')){const id=item?.id||currentPack()?.id;if(!id)return;favorites.has(id)?favorites.delete(id):favorites.add(id);try{localStorage.setItem('skyhaven.libraryFavorites',JSON.stringify([...favorites]));}catch{}render();}
    if(el.hasAttribute('data-rts-owned'))onOwned('Dekogon');
  });
  return {render,refresh:()=>render(),showCollections(){mode='packs';activeTab='overview';item=null;dockLimit=80;},get mode(){return mode;}};
}
