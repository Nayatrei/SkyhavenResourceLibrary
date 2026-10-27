export const OWNED_API='/comfy/skyhaven/api/library/owned-assets';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const OWNED_TYPES=[
  {id:'environment',label:'배경',detail:'건물 · 자연 · 프롭'},
  {id:'character',label:'캐릭터',detail:'인물 · 몬스터 · 모션'},
  {id:'vfx',label:'VFX',detail:'이펙트 · 셰이더'},
  {id:'tool',label:'Tool',detail:'제작 도구 · 시스템'},
];

// Navigation groups reuse the catalog's product/category evidence, not a claim of inspected files.
export function ownedTypes(asset){
  const storeType={'Buildings & Architecture':'environment','Characters & Creatures':'character','Environments':'environment','Furniture & Fixtures':'environment','Nature & Plants':'environment','Tools, Objects & Decor':'environment','Vehicles & Transportation':'environment','Weapons & Combat':'environment','Material & Textures':'environment','VFX':'vfx','Game Templates':'tool','Tools & Plugins':'tool'}[asset.productCategory];
  if(storeType)return [storeType];
  const name=asset.name||'',items=(asset.contents?.items||[]).join(' ');
  if(asset.category==='도구'||asset.category==='템플릿')return ['tool'];
  if(asset.category==='시각 효과')return ['vfx'];
  if(asset.category==='음향'||/UI 그래픽|아이콘/.test(items))return [];
  if(/도구(?:\s|$)|기능|프레임워크|제어|프레임 성능/.test(items)||/\b(toolkit|controller|editor|exporter|cinemachine|generator|starter assets|UMA 3)\b/i.test(name))return ['tool'];
  const types=[];
  if(/시각 효과|셰이더/.test(items)||/\b(vfx|shader|effects?|particles?|fluids?)\b/i.test(name))types.push('vfx');
  if(/캐릭터|몬스터|크리처|동물|생물|모션|드래곤/.test(items)||/\b(characters?|creatures?|monsters?|animals?|animation|mecanim|humans?|npc|robots?|boss|fighters?|archers?|warriors?|wizards?|dragons?|dwarfs?|dwarven|orcs?|elf|elves|skeletons?|zombies?|boars?|cats?|mechs?|male|female|k-pop|wyrms|unity-chan)\b/i.test(name))types.push('character');
  if(/환경|자연|울타리|출입문|운반 가방|건축|건물|주택|소품|아이템|가구|식기|차량|탈것|무기|장비|스카이박스|텍스처·재질|타일·지형|표지판|간판|묘지|묘비|영묘|성$|나무|식생|식물/.test(items)||/\b(environments?|villages?|towns?|city|cities|forest|foliage|tree|grass|terrain|landscape|mountain|rock|stone|cliff|water|oceans?|rivers?|lakes?|volcano|asteroids|planets?|garden|hedge|conifers|grounds?|prison|school|gymnasium|fences?|gates?|bridges?|tunnels?|pagoda|night club|medical equipments?|obstacles|courtyard|castle|stronghold|medieval constructor|building|residential|architectur\w*|dungeon|level|scenes?|base|station|facility|slums?|district|room|interior|props?|furniture|flags?|signs?|materials?|textures?|weapons?|swords?|missiles?|shields?|vehicles?|cars?|boats?)\b/i.test(name))types.push('environment');
  return types;
}

export const ownedAvailability=asset=>asset.localLibrary?'indexed':asset.rpgLab?'installed':'unconfirmed';
export function ownedFilters(url){
  const p=new URL(url).searchParams;
  const type=p.get('ownedType')||'';
  return {availability:['local','download'].includes(p.get('ownedAvailability'))?p.get('ownedAvailability'):'',type:OWNED_TYPES.some(t=>t.id===type)?type:'',project:p.get('ownedProject')==='rpg-lab'?'rpg-lab':'',style:p.get('ownedStyle')||'',category:p.get('ownedCategory')||'',hidden:p.get('ownedHidden')==='1'};
}
export function filterOwned(data,{query='',type='',project='',style='',category='',hidden=false,availability=''}={}){
  const labels=new Map(data.styles.map(s=>[s.id,s.label]));
  const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return data.assets.filter(a=>(hidden||!a.hidden)&&(!availability||(availability==='local'?ownedAvailability(a)!=='unconfirmed':ownedAvailability(a)==='unconfirmed'))&&(!project||Boolean(a.rpgLab))&&(!type||ownedTypes(a).includes(type))&&(!style||a.styles.includes(style))&&(!category||a.category===category)
    &&words.every(word=>[a.id,a.name,a.publisher,a.source||'Unity My Assets',a.category,...a.styles.map(s=>labels.get(s)||s),...a.contents.items].join(' ').toLocaleLowerCase().includes(word)));
}
export function ownedTypeCounts(data,filters={}){
  const rows=filterOwned(data,{...filters,type:'',style:'',category:''});
  return OWNED_TYPES.map(type=>({...type,count:rows.filter(a=>ownedTypes(a).includes(type.id)).length}));
}
export function ownedStyleCounts(data,filters={}){
  const rows=filterOwned(data,{...filters,style:''});
  return [{id:'',label:'전체',count:rows.length},...data.styles.map(style=>({...style,count:rows.filter(a=>a.styles.includes(style.id)).length}))];
}
const fileState=a=>a.localLibrary?'로컬 라이브러리 연결됨':a.rpgLab?'프로젝트 파일 확인':'다운로드·설치 미확인';
const cover=(a,lazy=true)=>`<img src="${esc(a.thumbnailUrl)}" alt="${esc(a.name)} 제품 이미지" ${lazy?'loading="lazy"':'loading="eager"'} decoding="async" referrerpolicy="no-referrer">`;
const imagePlaceholder=a=>`<span class="owned-image-missing" ${a.thumbnailUrl?'hidden':''}><span aria-hidden="true">◇</span><span>제품 이미지 없음</span><small>${esc(a.name)}</small></span>`;

export function ownedCard(a){
  return `<article class="owned-card"><button type="button" class="owned-card-select" data-owned-id="${esc(a.id)}" aria-label="${esc(a.name)} 미리보기" aria-haspopup="dialog"><span class="owned-cover">${a.thumbnailUrl?cover(a):''}${imagePlaceholder(a)}<span class="owned-source">${esc(a.source||'Unity My Assets')}</span><span class="owned-preview-hint">크게 보기 ↗</span></span><span class="owned-card-name">${esc(a.name)}</span><span class="owned-card-publisher">${esc(a.publisher)}</span></button><div class="owned-card-footer"><span class="owned-card-state ${ownedAvailability(a)!=='unconfirmed'?'is-local':''}">${esc(fileState(a))}</span><a href="${esc(a.downloadUrl||a.storeUrl)}" target="_blank" rel="noreferrer" aria-label="${esc(a.name)} 공식 다운로드">Download ↗</a></div></article>`;
}

export function ownedDetails(a,data){
  const labels=new Map(data.styles.map(s=>[s.id,s.label]));
  const details=[...(a.styleEvidence.sources||[]),...(a.contents.sources||[])];
  const links=[...new Map(details.map(s=>[s.url,s])).values()];
  const method={'asset-origin':'Asset Store 제품 ID','exact-folder':'고유 폴더명 일치','package-manifest':'패키지 manifest','reviewed-path':'파일 근거 대조'}[a.rpgLab?.method];
  const local=a.localLibrary?`<a class="owned-local-link" href="#environments/pack/${encodeURIComponent(a.localLibrary.packId)}">로컬 팩 열기 ↗</a>`:'';
  const installed=a.rpgLab?`<p class="owned-installed" title="${esc(method)} · 프로젝트 파일 존재 확인">RPG_Lab · ${a.rpgLab.fileCount.toLocaleString()}개 파일</p>`:'';
  const installationEvidence=a.rpgLab?`<p>RPG_Lab: ${esc(method)} · ${a.rpgLab.fileCount.toLocaleString()}개 파일 확인. 전체 패키지 반입·실행 검증과 구분합니다.</p><ul class="owned-install-paths">${a.rpgLab.paths.map(path=>`<li><code>${esc(path)}</code></li>`).join('')}</ul>`:'';
  return `<div class="owned-preview-layout"><section class="owned-preview-stage" aria-label="제품 이미지"><div class="owned-preview-image">${a.thumbnailUrl?cover(a,false):''}${imagePlaceholder(a)}</div><p>${esc(a.source||'Unity My Assets')} 공식 제품 이미지 · 로컬 실행 화면과 구분됩니다.</p></section><aside class="owned-inspector"><div class="owned-inspector-heading"><div><p class="eyebrow">${esc(a.source||'Unity My Assets')}</p><h2 id="owned-preview-title">${esc(a.name)}</h2><p>${esc(a.publisher)}</p></div><button type="button" id="owned-preview-close" aria-label="미리보기 닫기">×</button></div><div class="owned-inspector-scroll"><dl class="owned-metadata"><div><dt>분류</dt><dd>${esc(a.productCategory||a.category)}</dd></div><div><dt>스타일</dt><dd>${a.styles.map(s=>esc(labels.get(s)||s)).join(' · ')||'미분류'}</dd></div><div><dt>파일 상태</dt><dd>${esc(fileState(a))}</dd></div></dl>${installed}<section class="owned-contents"><h3>포함 내용</h3><ul>${(a.contents.items.length?a.contents.items:['상세 구성 미확인']).map(item=>`<li>${esc(item)}</li>`).join('')}</ul><small>${esc(data.contentsEvidenceLabels[a.contents.level]||'상세 구성 미확인')}</small></section><details class="owned-evidence"><summary>분류·설치 근거</summary><p>${esc(a.contents.reason)}</p><p>스타일: ${esc(data.styleEvidenceLabels[a.styleEvidence.level]||'미분류')} · ${esc(a.styleEvidence.reason)}</p>${installationEvidence}${links.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noreferrer">출처 ↗</a>`).join(' ')}<p>제품 ID: <code>${esc(a.id)}</code>${a.hidden?' · 숨김':''}</p></details></div><div class="owned-inspector-actions">${local}<a class="owned-download" href="${esc(a.downloadUrl||a.storeUrl)}" target="_blank" rel="noreferrer">Download · 받기 ↗</a><a class="owned-store-link" href="${esc(a.storeUrl)}" target="_blank" rel="noreferrer">${a.source==='Fab'?'Fab 제품':'Unity 제품'} ↗</a><small>보유 ≠ 설치·실행 검증</small></div></aside></div>`;
}

export function createOwnedAssetList({host,fetchJSON,isActive,onLoad=()=>{},getURL=()=>location.href,replaceURL=url=>history.replaceState(null,'',url)}){
  let data,pending,query='',page=0,revision=0,filtersOpen=false,selectedId='';
  const pageSize=50;
  function clearPreviewURL(){
    const u=new URL(getURL());if(u.searchParams.has('ownedAsset')){u.searchParams.delete('ownedAsset');replaceURL(u);}
  }
  function bindImages(root){
    root.querySelectorAll('.owned-cover img,.owned-preview-image img').forEach(img=>img.onerror=()=>{img.hidden=true;img.nextElementSibling.hidden=false;});
  }
  function markSelected(){
    host.querySelectorAll('[data-owned-id]').forEach(button=>button.closest('.owned-card').classList.toggle('is-selected',button.dataset.ownedId===selectedId));
  }
  function showPreview(asset){
    selectedId=asset.id;markSelected();
    const dialog=host.querySelector('#owned-preview');dialog.innerHTML=ownedDetails(asset,data);bindImages(dialog);
    dialog.querySelector('#owned-preview-close').onclick=()=>dialog.close();
    if(!dialog.open)dialog.showModal();
  }
  function setFilter(key,value){
    const u=new URL(getURL());u.searchParams.delete('ownedAsset');value?u.searchParams.set(key,value):u.searchParams.delete(key);replaceURL(u);page=0;selectedId='';draw();
  }
  function draw(){
    if(!isActive())return;
    if(!data?.available){host.innerHTML='<div class="empty"><h1>보유 에셋 목록</h1><p>등록된 보유 에셋 목록이 아직 없습니다.</p></div>';return;}
    const filters=ownedFilters(getURL()),rows=filterOwned(data,{query,...filters});
    const styleCounts=ownedStyleCounts(data,{query,...filters});
    const typeCounts=ownedTypeCounts(data,{query,...filters});
    const installedCount=filterOwned(data,{query,...filters,project:''}).filter(a=>a.rpgLab).length;
    const projectPill=`<div class="owned-project-filter"><button type="button" id="owned-project" class="owned-style-pill" aria-pressed="${filters.project==='rpg-lab'}" ${data.installation?'':'disabled'}>RPG_Lab <span>${data.installation?installedCount.toLocaleString():'—'}</span></button><small>${data.installation?`${esc(data.installation.checkedAt.slice(0,10))} 파일 확인 · 표시 없는 항목은 설치 미확인.`:'RPG_Lab 설치 목록 미등록'}</small></div>`;
    const typeTabs=`<div class="owned-types" role="group" aria-label="에셋 분야 필터"><button type="button" id="owned-type-all" class="owned-type-tab" aria-pressed="${!filters.type}"><strong>전체 <span>${filterOwned(data,{query,...filters,type:'',style:'',category:''}).length.toLocaleString()}</span></strong><small>모든 보유 에셋</small></button>${typeCounts.map(t=>`<button type="button" class="owned-type-tab" data-owned-type="${t.id}" aria-pressed="${t.id===filters.type}"><strong>${t.label} <span>${t.count.toLocaleString()}</span></strong><small>${t.detail}</small></button>`).join('')}</div>`;
    const previewId=new URL(getURL()).searchParams.get('ownedAsset'),preview=previewId&&rows.find(a=>a.id===previewId);
    if(preview)page=Math.floor(rows.indexOf(preview)/pageSize);else if(previewId)clearPreviewURL();
    page=Math.max(0,Math.min(page,Math.ceil(rows.length/pageSize)-1));
    const options=(items,value)=>items.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
    host.innerHTML=`<section class="owned-assets"><div class="library-heading"><h1>소유 에셋 · Download</h1><p>이미지를 선택해 구성과 다운로드를 확인하세요.</p></div>${typeTabs}<div class="owned-browser-toolbar"><p class="owned-count" role="status">${rows.length.toLocaleString()}개 결과 <span>이미지를 눌러 크게 보기</span></p><label class="owned-availability-label">파일 상태<select id="owned-availability">${options([['','전체 소유 에셋'],['local','로컬 파일 확인'],['download','다운로드·설치 미확인']],filters.availability)}</select></label><details class="owned-extra-filters" ${filtersOpen?'open':''}><summary>스타일·상세 필터${filters.style||filters.category||filters.project||filters.hidden?' · 적용 중':''}</summary><div class="owned-filter-panel"><div class="owned-styles" role="group" aria-label="스타일 필터">${styleCounts.filter(s=>s.count||s.id===filters.style||!s.id).map(s=>`<button type="button" class="owned-style-pill" data-owned-style="${esc(s.id)}" aria-pressed="${s.id===filters.style}">${esc(s.label)} <span>${s.count.toLocaleString()}</span></button>`).join('')}</div><div class="owned-filters"><label>분류<select id="owned-category">${options([['','모든 분류'],...Object.keys(data.categories||{}).sort().map(s=>[s,s])],filters.category)}</select></label><label class="owned-checkbox"><input id="owned-hidden" type="checkbox" ${filters.hidden?'checked':''}>숨긴 에셋 포함</label><button id="owned-reset" class="button ghost">필터 초기화</button></div>${projectPill}<p class="owned-summary">${Object.entries(data.sourceCounts||{'Unity My Assets':data.counts.total}).map(([name,count])=>`${esc(name)} ${count.toLocaleString()}개 (${esc(data.sourceSnapshots?.[name]||data.snapshotDate)})`).join(' · ')} · 숨김 ${data.counts.hidden}개</p><p class="owned-type-note">제품명·공식 분류·포함 내용 기준 · 복합 팩은 여러 분야에 표시됩니다. 음향·UI·미분류는 전체 보기에서 확인하세요. 보유와 설치·실행 검증은 구분합니다.</p></div></details></div><div class="owned-grid" aria-label="소유 에셋 갤러리">${rows.slice(page*pageSize,(page+1)*pageSize).map(ownedCard).join('')}</div>${rows.length?`<div class="owned-paging"><button id="owned-prev" class="button ghost" ${page?'':'disabled'}>이전</button><span>${page+1} / ${Math.ceil(rows.length/pageSize)}</span><button id="owned-next" class="button ghost" ${(page+1)*pageSize>=rows.length?'disabled':''}>다음</button></div>`:'<p class="empty">조건에 맞는 에셋이 없습니다.</p>'}<dialog id="owned-preview" class="owned-preview" aria-labelledby="owned-preview-title"></dialog></section>`;
    host.querySelector('.owned-extra-filters').ontoggle=event=>{if(event.target.isConnected)filtersOpen=event.target.open;};
    const dialog=host.querySelector('#owned-preview');
    dialog.onclose=()=>{if(dialog.isConnected&&isActive())clearPreviewURL();};
    dialog.onclick=event=>{if(event.target===dialog)dialog.close();};
    host.querySelectorAll('[data-owned-id]').forEach(button=>button.onclick=()=>{
      const asset=rows.find(a=>a.id===button.dataset.ownedId),u=new URL(getURL());u.searchParams.set('ownedAsset',asset.id);replaceURL(u);showPreview(asset);
    });
    host.querySelectorAll('[data-owned-style]').forEach(button=>button.onclick=()=>setFilter('ownedStyle',button.dataset.ownedStyle===filters.style?'':button.dataset.ownedStyle));
    host.querySelector('#owned-project').onclick=()=>setFilter('ownedProject',filters.project?'':'rpg-lab');
    function selectType(type){
      const u=new URL(getURL());for(const key of ['ownedType','ownedStyle','ownedCategory','ownedAsset'])u.searchParams.delete(key);
      if(type)u.searchParams.set('ownedType',type);replaceURL(u);page=0;selectedId='';draw();
    }
    host.querySelectorAll('[data-owned-type]').forEach(button=>button.onclick=()=>selectType(button.dataset.ownedType===filters.type?'':button.dataset.ownedType));
    host.querySelector('#owned-type-all').onclick=()=>selectType('');
    bindImages(host);markSelected();
    host.querySelector('#owned-availability').onchange=e=>setFilter('ownedAvailability',e.target.value);
    host.querySelector('#owned-category').onchange=e=>setFilter('ownedCategory',e.target.value);
    host.querySelector('#owned-hidden').onchange=e=>setFilter('ownedHidden',e.target.checked?'1':'');
    host.querySelector('#owned-reset').onclick=()=>{const u=new URL(getURL());for(const k of ['ownedType','ownedProject','ownedStyle','ownedCategory','ownedHidden','ownedAvailability','ownedAsset'])u.searchParams.delete(k);replaceURL(u);page=0;selectedId='';draw();};
    const prev=host.querySelector('#owned-prev'),next=host.querySelector('#owned-next');
    if(prev)prev.onclick=()=>{clearPreviewURL();page--;draw();};if(next)next.onclick=()=>{clearPreviewURL();page++;draw();};
    if(preview)showPreview(preview);
  }
  async function render({search=query,refresh=false}={}){
    query=search;page=0;const current=++revision;
    if(data&&!refresh){draw();return;}
    if(isActive())host.innerHTML='<div class="loading" role="status">보유 에셋 목록을 읽는 중…</div>';
    try{
      if(!pending||refresh)pending=fetchJSON(OWNED_API,{cache:'no-cache'});
      const next=await pending;if(current!==revision)return;
      data=next;pending=null;onLoad(data.counts.visible);draw();
    }catch(error){
      if(current!==revision)return;pending=null;
      if(!isActive())return;
      if(data){draw();const p=host.ownerDocument.createElement('p');p.className='owned-error';p.textContent='갱신 실패 · 이전 목록을 표시합니다. '+error.message;host.prepend(p);}
      else{host.innerHTML=`<div class="empty"><h1>보유 목록을 읽을 수 없습니다.</h1><p>${esc(error.message)}</p><button id="owned-retry" class="button ghost">다시 읽기</button></div>`;host.querySelector('#owned-retry').onclick=()=>void render({refresh:true});}
    }
  }
  return {render,search(value){query=value;page=0;selectedId='';clearPreviewURL();if(data)draw();else void render({search:value});},get count(){return data?.counts.visible;}};
}
