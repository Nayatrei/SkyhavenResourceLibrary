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
export function ownedRow(a,data){
  const labels=new Map(data.styles.map(s=>[s.id,s.label]));
  const details=[...(a.styleEvidence.sources||[]),...(a.contents.sources||[])];
  const links=[...new Map(details.map(s=>[s.url,s])).values()];
  const method={'asset-origin':'Asset Store 제품 ID','exact-folder':'고유 폴더명 일치','package-manifest':'패키지 manifest','reviewed-path':'파일 근거 대조'}[a.rpgLab?.method];
  const local=a.localLibrary?`<span class="owned-installed">로컬 라이브러리 연결됨</span><a href="#environments/pack/${encodeURIComponent(a.localLibrary.packId)}">팩 열기 ↗</a>`:'<small class="owned-file-state">'+(a.rpgLab?'프로젝트 파일 확인':'다운로드·설치 미확인')+'</small>';
  const installed=a.rpgLab?`<span class="owned-installed" title="${esc(method)} · 프로젝트 파일 존재 확인">RPG_Lab · ${a.rpgLab.fileCount.toLocaleString()}개 파일</span>`:'';
  const installationEvidence=a.rpgLab?`<p>RPG_Lab: ${esc(method)} · ${a.rpgLab.fileCount.toLocaleString()}개 파일 확인. 전체 패키지 반입·실행 검증과 구분합니다.</p><ul class="owned-install-paths">${a.rpgLab.paths.map(path=>`<li><code>${esc(path)}</code></li>`).join('')}</ul>`:'';
  return `<tr><td data-label="에셋"><div class="owned-asset-title"><a class="owned-thumb" href="${esc(a.storeUrl)}" target="_blank" rel="noreferrer" aria-label="${esc(a.name)} 제품 보기">${a.thumbnailUrl?`<img src="${esc(a.thumbnailUrl)}" alt="" width="112" height="72" loading="lazy" decoding="async" referrerpolicy="no-referrer">`:""}<span class="owned-thumb-missing" ${a.thumbnailUrl?"hidden":""}>이미지 없음</span></a><div><strong>${esc(a.name)}</strong><small>${esc(a.publisher)} · ${esc(a.source||'Unity My Assets')} · #${esc(a.id)}${a.hidden?' · 숨김':''}</small>${installed}${local}</div></div></td><td data-label="스타일"><span>${a.styles.map(s=>esc(labels.get(s)||s)).join(' · ')}</span><small>${esc(data.styleEvidenceLabels[a.styleEvidence.level]||'미분류')}</small></td><td data-label="포함 내용"><ul>${(a.contents.items.length?a.contents.items:['상세 구성 미확인']).map(item=>`<li>${esc(item)}</li>`).join('')}</ul><small>${esc(data.contentsEvidenceLabels[a.contents.level]||'상세 구성 미확인')}</small><details><summary>근거</summary><p>${esc(a.contents.reason)}</p><p>스타일: ${esc(a.styleEvidence.reason)}</p>${installationEvidence}${links.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noreferrer">출처 ↗</a>`).join(' ')}</details></td><td data-label="분류">${esc(a.category)}${a.productCategory?`<small>${esc(a.productCategory)}</small>`:''}</td><td data-label="제품"><a class="owned-download" href="${esc(a.downloadUrl||a.storeUrl)}" target="_blank" rel="noreferrer">Download · 받기 ↗</a><small>공식 제품 페이지에서 다운로드</small><a href="${esc(a.storeUrl)}" target="_blank" rel="noreferrer">${a.source==='Fab'?'Fab 제품':'스토어 검색'} ↗</a></td></tr>`;
}

export function createOwnedAssetList({host,fetchJSON,isActive,onLoad=()=>{},getURL=()=>location.href,replaceURL=url=>history.replaceState(null,'',url)}){
  let data,pending,query='',page=0,revision=0;
  const pageSize=50;
  function setFilter(key,value){
    const u=new URL(getURL());value?u.searchParams.set(key,value):u.searchParams.delete(key);replaceURL(u);page=0;draw();
  }
  function draw(){
    if(!isActive())return;
    if(!data?.available){host.innerHTML='<div class="empty"><h1>보유 에셋 목록</h1><p>등록된 보유 에셋 목록이 아직 없습니다.</p></div>';return;}
    const filters=ownedFilters(getURL()),rows=filterOwned(data,{query,...filters});
    const styleCounts=ownedStyleCounts(data,{query,...filters});
    const typeCounts=ownedTypeCounts(data,{query,...filters});
    const installedCount=filterOwned(data,{query,...filters,project:''}).filter(a=>a.rpgLab).length;
    const projectPill=`<div class="owned-project-filter"><button type="button" id="owned-project" class="owned-style-pill" aria-pressed="${filters.project==='rpg-lab'}" ${data.installation?'':'disabled'}>RPG_Lab <span>${data.installation?installedCount.toLocaleString():'—'}</span></button><small>${data.installation?`${esc(data.installation.checkedAt.slice(0,10))} 파일 확인 · 제품 ID / 고유 폴더명 기준. 표시 없는 항목은 설치 미확인.`:'RPG_Lab 설치 목록 미등록'}</small></div>`;
    const typeTabs=`<div class="owned-type-heading"><span>에셋 분야</span><button type="button" id="owned-type-all" aria-pressed="${!filters.type}">전체 보기</button></div><div class="owned-types" role="group" aria-label="에셋 분야 필터">${typeCounts.map(t=>`<button type="button" class="owned-type-tab" data-owned-type="${t.id}" aria-pressed="${t.id===filters.type}"><strong>${t.label} <span>${t.count.toLocaleString()}</span></strong><small>${t.detail}</small></button>`).join('')}</div><p class="owned-type-note">제품명·분류·포함 내용 기준 · 복합 팩은 여러 분야에 표시됩니다. 음향·UI·미분류는 전체 보기에서 확인하세요.</p>`;
    page=Math.max(0,Math.min(page,Math.ceil(rows.length/pageSize)-1));
    const options=(items,value)=>items.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
    host.innerHTML=`<section class="owned-assets"><div class="library-heading"><h1>소유 에셋 · Download</h1><p>다운로드 여부와 관계없이 모든 보유 에셋을 탐색하고 공식 페이지에서 받을 수 있습니다.</p></div><p class="owned-summary">${Object.entries(data.sourceCounts||{'Unity My Assets':data.counts.total}).map(([name,count])=>`${esc(name)} ${count.toLocaleString()}개 (${esc(data.sourceSnapshots?.[name]||data.snapshotDate)})`).join(' · ')} · 일반 ${data.counts.visible.toLocaleString()}개 + 숨김 ${data.counts.hidden}개. 제품명 기준 요약은 세부 파일 검사와 구분합니다.</p>${typeTabs}${projectPill}<div class="owned-styles" role="group" aria-label="스타일 필터">${styleCounts.filter(s=>s.count||s.id===filters.style||!s.id).map(s=>`<button type="button" class="owned-style-pill" data-owned-style="${esc(s.id)}" aria-pressed="${s.id===filters.style}">${esc(s.label)} <span>${s.count.toLocaleString()}</span></button>`).join('')}</div><div class="owned-filters"><label>파일 상태<select id="owned-availability">${options([['','전체 소유 에셋'],['local','로컬 파일 확인'],['download','다운로드·설치 미확인']],filters.availability)}</select></label><label>분류<select id="owned-category">${options([['','모든 분류'],...Object.keys(data.categories||{}).sort().map(s=>[s,s])],filters.category)}</select></label><label class="owned-checkbox"><input id="owned-hidden" type="checkbox" ${filters.hidden?'checked':''}>숨긴 에셋 포함</label><button id="owned-reset" class="button ghost">필터 초기화</button></div><p class="owned-count" role="status">${rows.length.toLocaleString()}개 결과 <span>보유 ≠ 설치·실행 검증</span></p><div class="owned-table-wrap"><table class="owned-table"><thead><tr><th>에셋 / 제작사</th><th>스타일</th><th>포함 모델·소품·기능</th><th>분류</th><th>제품</th></tr></thead><tbody>${rows.slice(page*pageSize,(page+1)*pageSize).map(a=>ownedRow(a,data)).join('')}</tbody></table></div>${rows.length?`<div class="owned-paging"><button id="owned-prev" class="button ghost" ${page?'':'disabled'}>이전</button><span>${page+1} / ${Math.ceil(rows.length/pageSize)}</span><button id="owned-next" class="button ghost" ${(page+1)*pageSize>=rows.length?'disabled':''}>다음</button></div>`:'<p class="empty">조건에 맞는 에셋이 없습니다.</p>'}</section>`;
    host.querySelectorAll('[data-owned-style]').forEach(button=>button.onclick=()=>setFilter('ownedStyle',button.dataset.ownedStyle===filters.style?'':button.dataset.ownedStyle));
    host.querySelector('#owned-project').onclick=()=>setFilter('ownedProject',filters.project?'':'rpg-lab');
    function selectType(type){
      const u=new URL(getURL());for(const key of ['ownedType','ownedStyle','ownedCategory'])u.searchParams.delete(key);
      if(type)u.searchParams.set('ownedType',type);replaceURL(u);page=0;draw();
    }
    host.querySelectorAll('[data-owned-type]').forEach(button=>button.onclick=()=>selectType(button.dataset.ownedType===filters.type?'':button.dataset.ownedType));
    host.querySelector('#owned-type-all').onclick=()=>selectType('');
    host.querySelectorAll('.owned-thumb img').forEach(img=>img.onerror=()=>{img.hidden=true;img.nextElementSibling.hidden=false;});
    host.querySelector('#owned-availability').onchange=e=>setFilter('ownedAvailability',e.target.value);
    host.querySelector('#owned-category').onchange=e=>setFilter('ownedCategory',e.target.value);
    host.querySelector('#owned-hidden').onchange=e=>setFilter('ownedHidden',e.target.checked?'1':'');
    host.querySelector('#owned-reset').onclick=()=>{const u=new URL(getURL());for(const k of ['ownedType','ownedProject','ownedStyle','ownedCategory','ownedHidden','ownedAvailability'])u.searchParams.delete(k);replaceURL(u);page=0;draw();};
    const prev=host.querySelector('#owned-prev'),next=host.querySelector('#owned-next');
    if(prev)prev.onclick=()=>{page--;draw();};if(next)next.onclick=()=>{page++;draw();};
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
  return {render,search(value){query=value;page=0;if(data)draw();else void render({search:value});},get count(){return data?.counts.visible;}};
}
