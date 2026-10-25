import {sections,games,cleanName,matches,matchesPack,packInSection,filterPackItems,formatBytes,sortPackItems,candidateMotions,rankMotions,recommendedMotions,readState,filterEntities,smokeMotions} from './skyhaven-library-state.mjs?v=20261023-library-v15';
import {createCatalogCache} from './skyhaven-library-cache.mjs?v=20261023-library-v15';
import {createOwnedAssetList} from './skyhaven-owned-assets.mjs?v=20261025-owned-v3';
import {loadingMarkup,startLoading} from './skyhaven-loading.mjs';
import {createLibraryTransport} from './skyhaven-data-source.mjs?v=20261023-hosted-v1';
import {installLocalConnections,prepareLocalLibrary,withLocalTimeout} from './skyhaven-local-files.mjs?v=20261023-connect-v5';
import {loadHostedDeployment,installSourceStatus} from './skyhaven-source-status.mjs?v=20261023-hosted-v1';
const deploymentSpec=JSON.parse(document.getElementById('skyhaven-deployment')?.textContent||'null');
const deployment=deploymentSpec?.mode==='hosted-catalog'?await loadHostedDeployment(deploymentSpec):await prepareLocalLibrary(deploymentSpec);
const hosted=deployment?.mode==='hosted-catalog';
const transport=createLibraryTransport({deployment});
const API=transport.api;
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state=readState(location.href);
let data,motions=[],raw,category='',selected,variant,tab='3d',viewer,life,revision=0,packData,limit=70,motionLimit=60,selectedMotion,pendingMotion;
const sourceStatus=installSourceStatus({deployment,onDisconnect:()=>{if(viewer)stop();if(selected&&$('library-detail'))void detail();else{const host=$('raw-media');if(host)host.innerHTML=offlineNotice;}}});
const offlineNotice='<div class="source-offline-note"><h3>원본 서버 연결 필요</h3><p>목록과 경로는 볼 수 있습니다. 이미지·3D·모션은 원본 서버가 ONLINE일 때 표시됩니다.</p><button data-recheck-source>연결 재확인</button></div>';
const sourceAvailable=()=>!hosted||sourceStatus.online;
const mediaSrc=url=>`${hosted?'data-live-src':'src'}="${esc(url)}"`;
const sourceHref=url=>`${hosted?'data-live-href':'href'}="${esc(url)}"`;
const detailCache=new Map(),packCache=new Map();
const owned=createOwnedAssetList({host:$('main'),fetchJSON:json,isActive:()=>category==='owned',onLoad:()=>navigation()});
let rememberedCharacter,rememberedVariant;
try{rememberedCharacter=localStorage.getItem('skyhaven.libraryCharacter');rememberedVariant=localStorage.getItem('skyhaven.libraryVariant');selectedMotion=localStorage.getItem('skyhaven.libraryMotion');}catch{}
async function json(url,options){return deployment?withLocalTimeout(()=>transport.json(url,options),{signal:options?.signal}):transport.json(url,options);}
const catalogCache=createCatalogCache({api:API,fetchJSON:json,...(hosted?{schema:'hosted:'+deployment.revision}:deployment?.libraryId?{schema:'local:'+deployment.libraryId}:{})});
function catalogStatus(snapshot){$('scan-time').textContent=hosted?`마지막 목록 게시 · ${new Date(deployment.publishedAt).toLocaleString()} · 이미지 별도 보관 없음`:`${snapshot.local?'저장된 색인':'최신 색인'} · ${new Date(snapshot.savedAt).toLocaleString()} · ${catalogCache.persistent?'이 브라우저에 저장':'이번 방문에 보관'} · 새로고침으로 갱신`;}
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3500);}
async function copy(value){try{await navigator.clipboard.writeText(value);toast('경로와 참조를 복사했습니다.');}catch{toast('브라우저의 복사 권한을 확인해 주세요.');}}
function saveState(){const u=new URL(location.href);for(const [key,value] of Object.entries({game:state.game,q:state.query,group:state.group,motion:state.motionQuery,pack:state.motionPack,motionCategory:state.motionLabel,variant:state.variant}))value&&value!=='all'?u.searchParams.set(key,value):u.searchParams.delete(key);history.replaceState(null,'',u);}
function stop(){revision++;life?.abort();viewer?.();viewer=null;pendingMotion=null;}
const pathRow=(title,value)=>value?`<div class="asset-path"><span>${esc(title)}</span><code>${esc(value)}</code><button data-copy="${esc(value)}" title="${esc(title)} 복사">복사</button></div>`:'';
const fileRows=files=>files.map(f=>`<div class="asset-file"><span><a class="raw-file-title" href="#file/${encodeURIComponent(f.path)}"><strong>${esc(f.name)}</strong></a><small>${esc(f.resourcePath||f.path)}</small></span><button data-copy="${esc(f.resourcePath||f.path)}">경로</button><a ${sourceHref(f.url)} download aria-label="${esc(f.name)} 다운로드">↓</a></div>`).join('');
const thumb=v=>v?.thumbnail?.ready?`<img ${mediaSrc(v.thumbnail.url)} alt="${esc(v.name)} 정면 모델" loading="lazy">`:'<span class="model-placeholder" aria-label="저장된 원본 미리보기 없음">◇</span>';
function navigation(){
  $('navigation').innerHTML=sections.map(([id,title,num])=>`<a class="nav-item ${category===id?'active':''}" href="#${id}"><span>${num}</span>${title}<small>${id==='animations'?data.motionCount.toLocaleString():data.entities.filter(e=>e.category===id).length+data.packs.filter(p=>packInSection(p,id)).length}</small></a>`).join('')+'<details class="aux-nav"><summary>자료·관리</summary><a href="#files">전체 파일·제작 기록</a><a href="#agents">다른 세션에서 사용</a><a href="#maintenance">연결 상태·목록 관리</a></details>';
  $('game-filters').innerHTML='<span>게임</span>'+games.map(([id,title])=>`<button data-game="${id}" aria-pressed="${state.game===id}">${title}</button>`).join('');
  $('breadcrumb').textContent=games.find(g=>g[0]===state.game)[1]+' / '+(sections.find(s=>s[0]===category)?.[1]||'자료·관리');
  const manual=document.createElement('a');manual.href='#manual';manual.textContent='저장 위치·폴더 관리 매뉴얼';$('navigation').querySelector('.aux-nav').append(manual);
  const ownedLink=document.createElement('a');ownedLink.href='#owned';ownedLink.className='nav-item'+(category==='owned'?' active':'');ownedLink.innerHTML='<span>05</span>보유 에셋<small>'+String(owned.count??'목록')+'</small>';$('navigation').insertBefore(ownedLink,$('navigation').querySelector('.aux-nav'));
  $('game-filters').hidden=category==='owned';
  $('search').placeholder=category==='owned'?'에셋명, 스타일, 포함 내용 검색…':'이름, 모션, 폴더 검색…';
  if(category==='owned')$('breadcrumb').textContent='보유 에셋 / Unity · Fab';
}
function cards(){
  const entities=filterEntities(data.entities,state,category);
  const packs=data.packs.filter(p=>packInSection(p,category)&&(state.game==='all'||state.game===p.game)&&(!state.group||state.group===p.group)&&matchesPack(p,state.query,category));
  const groups=[...new Set(data.entities.filter(e=>e.category===category&&(state.game==='all'||e.game===state.game)).map(e=>e.group).concat(data.packs.filter(p=>packInSection(p,category)&&(state.game==='all'||p.game===state.game)).map(p=>p.group)))];
  $('browse-filters').innerHTML=`<p class="eyebrow">${entities.length+packs.length} COLLECTION ASSETS</p><div class="collection-filters"><button data-group="" aria-pressed="${!state.group}">전체 그룹</button>${groups.map(g=>`<button data-group="${esc(g)}" aria-pressed="${state.group===g}">${esc(g)}</button>`).join('')}</div>`;
  const ordered=[...new Set([...entities,...packs].map(e=>e.group))];
  $('asset-cards').innerHTML=ordered.map(group=>`<section class="collection"><h2>${esc(group)} <small>${entities.filter(e=>e.group===group).length+packs.filter(e=>e.group===group).length}</small></h2><div class="entity-grid">${entities.filter(e=>e.group===group).map(e=>`<button class="entity-card ${selected?.id===e.id?'selected':''}" data-entity="${esc(e.id)}"><div class="entity-image">${e.cover?`<img ${mediaSrc(e.cover.url)} alt="${esc(e.name)}" loading="lazy">`:thumb(e.variants[0])}</div><strong>${esc(cleanName(e.name))}</strong><small>${e.variants.length>1?e.variants.length+'가지 형태':e.variants[0]?.rig==='Humanoid'?'Humanoid · 3D':e.variants[0]?.rig==='Static'?'정적 모델 · 검토 후보':'관련 자료 '+e.relatedCount}</small></button>`).join('')}${packs.filter(p=>p.group===group).map(p=>`<button class="entity-card pack-card" data-pack="${esc(p.id)}"><div class="entity-image">${p.cover?`<img ${mediaSrc(p.cover.url)} alt="${esc(p.name)} 팩" loading="lazy">`:'<span>▧</span>'}</div><strong>${esc(p.name)}</strong><small>${p.availability==='awaiting-install'?'설치 대기':(category==='characters'?(p.characterCount??p.count):(p.environmentCount??p.count)).toLocaleString()+' '+(category==='characters'?'캐릭터':'프리팹')} · 팩 열기 ↗${p.sourceStats?.maxTextureEdge?' · 최대 '+p.sourceStats.maxTextureEdge+'px':''}</small></button>`).join('')}</div></section>`).join('')||'<div class="empty">이 조건에 맞는 에셋이 없습니다.</div>';
}
function shell(){
  $('main').innerHTML=`<div class="library-heading"><p class="eyebrow">YOUR ASSET LIBRARY</p><h1>${sections.find(s=>s[0]===category)?.[1]||'라이브러리'}</h1><p>그룹에서 고르고, 바로 확인하세요.</p></div><div class="library-workbench"><section class="library-browse"><div id="browse-filters"></div><div id="asset-cards"></div></section><section class="library-detail" id="library-detail"><div class="detail-empty"><span>◇</span><h2>에셋을 선택하세요.</h2><p>모델과 관련 자료를 한곳에서 볼 수 있습니다.</p></div></section></div>`;
}
async function asset(id,{signal}={}){if(!detailCache.has(id))detailCache.set(id,await catalogCache.read(API+'/assets/'+encodeURIComponent(id),{signal}));return detailCache.get(id);}
function connectingAsset(host,signal){
  host.innerHTML='<div id="asset-connect-progress">'+loadingMarkup+'</div><button id="cancel-asset-connect" class="button ghost">연결 중단</button>';
  const loading=startLoading($('asset-connect-progress'),signal);loading.update('에셋을 연결하는 중…','대표 모델과 관련 자료를 확인하고 있습니다.');
  $('cancel-asset-connect').onclick=()=>{stop();host.innerHTML='<p>에셋 연결을 중단했습니다. 카드를 다시 선택하면 재개됩니다.</p>';};return loading;
}
async function choose(id,variantId){
  stop();const version=revision;life=new AbortController();const signal=life.signal;
  const connecting=detailCache.has(id)?null:connectingAsset($('library-detail')||$('main'),signal);
  try{
    const entity=await asset(id,{signal});if(version!==revision)return;
    selected=entity;variant=entity.variants.find(v=>v.id===(variantId||state.variant||(id===rememberedCharacter?rememberedVariant:'')))||entity.variants[0];
    if(['characters','companions'].includes(entity.category)&&variant){rememberedCharacter=id;rememberedVariant=variant.id;state.variant=entity.variants.length>1?variant.id:'';saveState();try{localStorage.setItem('skyhaven.libraryCharacter',id);localStorage.setItem('skyhaven.libraryVariant',variant.id);}catch{}}
    if(category==='animations'){animationPage();return;}
    cards();await detail();
  }catch(error){if(version===revision)($('library-detail')||$('main')).textContent=error.message;}
  finally{connecting?.finish();}
}
function detailHeader(){
  return `<header class="asset-heading"><div><p class="eyebrow">${esc(selected.group)} / ${esc(selected.game)}</p><h2>${esc(cleanName(selected.name))}</h2>${selected.status?`<p class="compatibility-note">${selected.status==='review_candidate'?'검토 후보 · 사용자 외형 채택 대기':esc(selected.status)}</p>`:''}</div>${selected.variants.length>1?`<label>형태<select id="variant-choice">${selected.variants.map(v=>`<option value="${esc(v.id)}" ${variant?.id===v.id?'selected':''}>${esc(v.name)}</option>`).join('')}</select></label>`:''}</header><div class="detail-tabs" role="tablist">${[['3d','3D'],['motion','애니메이션'],['art','원화·초상화'],['dialogue','대사'],['sources','버전·원본']].map(([id,name])=>`<button role="tab" data-tab="${id}" aria-selected="${tab===id}">${name}</button>`).join('')}</div>`;
}
function sceneDetail(){
  const image=f=>f?`<figure class="pack-scene"><img class="scene-preview" ${mediaSrc(f.url)} alt="${esc(selected.name)} 배경 미리보기"><figcaption>${esc(f.path)}</figcaption></figure>`:'';
  return `${image(selected.cover)}${pathRow('리소스 폴더',selected.resourcePath)}${(selected.sceneEntries||[]).map(scene=>`<section class="scene-entry"><h3>${esc(scene.name)}</h3>${image(scene.preview)}${pathRow('Unity 씬',scene.sourceScene)}${pathRow('Unity GUID',scene.sourceSceneGuid)}${fileRows(scene.exports)}</section>`).join('')}<p class="compatibility-note">배경은 씬 이미지와 경로로 탐색합니다. 원화와 전체 제작 기록은 상세 탭에서 확인하세요.</p><button class="button ghost" data-tab="sources">버전·원본 보기 ↗</button>`;
}
async function detail(){
  stop();const version=revision;life=new AbortController();const signal=life.signal;
  const host=$('library-detail');host.innerHTML=detailHeader()+'<div id="detail-content"></div>';
  $('variant-choice')?.addEventListener('change',e=>choose(selected.id,e.target.value));
  const content=$('detail-content');
  if(tab==='3d'||tab==='motion'){
    if(!variant){content.innerHTML=selected.category==='environments'?sceneDetail():'<p>대표 모델 연결을 확인해야 합니다. 버전·원본에서 자료를 볼 수 있습니다.</p>';return;}
    content.innerHTML=`<div class="asset-preview-grid"><div class="asset-model-column"><div class="model-preview-host" id="library-viewer">${loadingMarkup}</div><div class="preview-primary-actions"><button data-copy="${esc(variant.model.projectRelativePath||variant.model.path)}">경로 복사</button><button id="copy-asset-reference">참조 복사 ↗</button><a ${sourceHref(variant.model.url)} download>FBX·원본 ↓</a><button id="cancel-preview">로딩·재생 중단</button></div><p class="compatibility-note">${esc(variant.compatibility?.note||'모션별 호환 여부는 재생해서 확인하세요.')}</p><details class="source-locator"><summary>모델 위치·GUID</summary>${pathRow('프로젝트 상대 경로',variant.model.projectRelativePath||variant.model.path)}${pathRow('Unity GUID',variant.model.guid)}${pathRow('이 컴퓨터의 확인된 위치',variant.model.localPath)}</details></div><aside id="inline-motions" class="asset-motion-column"></aside></div>`;
    $('copy-asset-reference').onclick=()=>copy(reference(selected,variant));
    $('cancel-preview').onclick=()=>{stop();toast('미리보기를 중단했습니다. 에셋을 다시 선택하면 재개됩니다.');};
    motionBrowser($('inline-motions'));
    if(!sourceAvailable()){$('library-viewer').innerHTML=offlineNotice;return;}
    try{
      const {createViewer}=await import('./skyhaven-viewer.mjs?v=20261022-library-v6');if(signal.aborted)return;
      const folder={id:'entity',name:selected.name,files:[variant.model,...variant.textures,...(variant.rig==='Humanoid'?motions:[])]};
      const handle=await createViewer({host:$('library-viewer'),file:variant.model,folder,folders:[folder],signal,assignMotions:variant.rig==='Humanoid'});
      if(signal.aborted){handle();return;}viewer=handle;
      variant.embeddedClips=viewer.getEmbeddedClips();if(variant.embeddedClips.length)motionBrowser($('inline-motions'));
      const advanced=$('library-viewer').querySelector('.viewer-tools'),sources=$('library-viewer').querySelector('.animation-pickers');
      if(advanced&&sources){const disclosure=document.createElement('details');disclosure.className='viewer-advanced';disclosure.innerHTML='<summary>화면·클립 상세 설정</summary>';disclosure.append(advanced,sources);$('library-viewer').append(disclosure);}
      const queued=pendingMotion;pendingMotion=null;
      if(queued&&queued.asset===selected.id&&queued.variant===variant.id)await applyMotion(queued.motion);
      else if(selectedMotion&&tab==='motion'){
        const motion=motions.find(m=>m.id===selectedMotion);if(motion&&candidateMotions([motion],variant).length)await applyMotion(motion);
      }
      else if(!selectedMotion&&tab==='motion'){
        const first=recommendedMotions(candidateMotions(motions,variant,{query:state.motionQuery,pack:state.motionPack,label:state.motionLabel}),variant)[0];
        if(first)await applyMotion(first.motion);
      }
    }catch(error){if(!signal.aborted){content.querySelector('.compatibility-note').textContent=error.message;}}
  }else if(tab==='art'){
    const images=selected.related.filter(f=>f.kind==='image');
    if(!sourceAvailable()){content.innerHTML=offlineNotice+fileRows(images);return;}
    content.innerHTML=`<div class="art-grid">${images.map(f=>`<figure><a ${sourceHref(f.url)} target="_blank"><img ${mediaSrc(f.url)} alt="${esc(f.name)}" loading="lazy"></a><figcaption>${esc(f.name)}</figcaption></figure>`).join('')}</div>`||'<p>연결된 이미지가 없습니다.</p>';
  }else if(tab==='dialogue'){
    const files=selected.related.filter(f=>/Dialogue\/.*\.json$/i.test(f.path));content.innerHTML=fileRows(selected.related.filter(f=>/Dialogue\//i.test(f.path)))+'<div id="dialogue-text"></div>';
    if(!sourceAvailable()){$('dialogue-text').innerHTML=offlineNotice;return;}
    for(const file of files){try{const result=await json(file.url,{signal});if(version!==revision)return;const block=document.createElement('section');block.className='dialogue-lines';const labels={greeting:'인사',idle:'일상',offer_help:'도움',warning:'주의',thanks:'감사',farewell:'작별'};block.innerHTML=`<p class="source-note">${result.reviewStatus==='draft'?'대사 초안 · ':''}${esc(result.voice||'')}${result.audioGenerated===false?' · 음성 미생성':''}</p>`+(Array.isArray(result.lines)?result.lines.map(line=>`<article><small>${esc(labels[line.event]||line.event)}</small><p>${esc(line.ko||line.en||line.text||'')}</p><button data-copy="${esc(line.ko||line.en||line.text||'')}">대사 복사</button></article>`).join(''):'<p>대사 형식을 확인하려면 원본 파일을 열어주세요.</p>');$('dialogue-text').append(block);}catch{}}
  }else content.innerHTML=`<p class="source-note">GameSet 연결과 기존 경로를 보존합니다. 구형·V4·제작 기록도 이 캐릭터에 함께 연결됩니다.</p>${fileRows(selected.related)}`;
}
function reference(entity,v){return `${entity.name}\nAsset ID: ${entity.id}\nModel: ${v.model.projectRelativePath||v.model.path}\nGUID: ${v.model.guid||'—'}\nPreview: ${transport.pageURL()}${entity.variants.length>1?'?variant='+encodeURIComponent(v.id):''}#${entity.category}/${encodeURIComponent(entity.id)}\n${hosted?'Source (ONLINE only)':deployment?'Local file (connected browser only)':'Download'}: ${new URL(v.model.url,location.href)}\nCatalog: ${transport.endpoint(API+'/assets/'+encodeURIComponent(entity.id))}`;}
function motionBrowser(host){
  if(!host)return;
  if(variant?.rig==='Static'){
    host.innerHTML='<div class="motion-heading"><h3>정적 모델</h3><p>아직 리그가 없어 모션을 적용할 수 없습니다.</p></div><p class="compatibility-note">원화·초상화와 버전·원본 탭에서 제작 자료와 보정 후보를 함께 확인하세요.</p>';
    return;
  }
  const pool=rankMotions(candidateMotions(motions,variant,{query:state.motionQuery,pack:state.motionPack,label:state.motionLabel}),variant);
  const recommendations=recommendedMotions(pool,variant);
  const packs=[...new Set(candidateMotions(motions,variant).map(m=>m.pack).filter(Boolean))].sort();
  host.innerHTML=`<div class="motion-heading"><div><h3>이 캐릭터에 모션 적용</h3><p>${variant?.rig==='Humanoid'?'Humanoid 호환 후보 · '+pool.length.toLocaleString()+'개 파일':'자체 클립 '+(variant?.embeddedClips?.length||0)+'개 · 추가 호환 후보 '+pool.length.toLocaleString()+'개 파일'}</p></div><span class="evidence-pill">후보 ≠ 웹 재생 ≠ Unity 검증</span></div><div class="inline-motion-filters"><input type="search" id="motion-search" value="${esc(state.motionQuery)}" placeholder="모션 검색 · Idle, Walk, Run…" aria-label="캐릭터 모션 검색"><select id="motion-pack-filter" aria-label="모션 팩"><option value="">모든 모션 팩</option>${packs.map(p=>`<option ${p===state.motionPack?'selected':''}>${esc(p)}</option>`).join('')}</select><select id="motion-label-filter" aria-label="동작 분류"><option value="">모든 동작</option>${(data.taxonomy?.categories||[]).map(c=>`<option value="${c.id}" ${c.id===state.motionLabel?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="quick-motions">${['Idle','Walk','Run'].map(q=>`<button data-motion-query="${q}">${q}</button>`).join('')}<button data-motion-query="">전체</button><button id="embedded-motion">자체 클립</button></div><div class="embedded-clips">${(variant?.embeddedClips||[]).map(c=>`<button data-embedded="${c.index}">▷ ${esc(c.name)} <small>자체 클립 · ${c.duration.toFixed(1)}초</small></button>`).join('')}</div><div class="motion-results">${pool.slice(0,motionLimit).map(m=>`<button class="motion-row ${selectedMotion===m.id?'active':''}" data-motion="${esc(m.id)}"><span class="motion-play">▷</span><span><strong>${esc(m.name.replace(/\.[^.]+$/,''))}</strong><small>${esc(m.pack)} · ${esc(m.extension.toUpperCase())}</small></span><small class="motion-evidence" data-motion-evidence="${esc(m.id)}">${variant?.webVerification?.motions.some(check=>check.motion===m.id)?'웹 재생 기록':'호환 후보'}</small></button>`).join('')||(variant?.embeddedClips?.length?'<p>위의 자체 클립을 바로 재생할 수 있습니다.</p>':'<p>이 조건의 호환 후보가 없습니다. 자체 클립 또는 다른 필터를 확인하세요.</p>')}</div>${pool.length>motionLimit?'<button id="more-motions">모션 더 보기 ↓</button>':''}`;
  let timer;
  if(recommendations.length){
    const block=document.createElement('section');block.className='motion-recommendations';
    block.innerHTML=`<h4>${esc(variant.motionProfile?.name||'Humanoid')} 추천</h4><p>${esc(variant.motionProfile?.reason||'골격 호환 후보에서 기본 동작을 골랐습니다.')}</p><div>${recommendations.map(({intent,motion:m})=>`<button data-motion="${esc(m.id)}" class="${selectedMotion===m.id?'active':''}" title="${esc(m.name)}"><strong>▷ ${intent}</strong><small>${esc(m.pack)}</small><small data-motion-evidence="${esc(m.id)}">${variant.webVerification?.motions?.some(c=>c.motion===m.id)?'웹 재생 기록':'호환 후보 · 시각 확인 필요'}</small></button>`).join('')}</div>`;
    host.querySelector('.quick-motions').before(block);
  }
  $('motion-search').oninput=e=>{state.motionQuery=e.target.value;saveState();clearTimeout(timer);timer=setTimeout(()=>{const focus=document.activeElement?.id==='motion-search',position=e.target.selectionStart;motionLimit=60;motionBrowser(host);if(focus){$('motion-search').focus();$('motion-search').setSelectionRange(position,position);}},220);};
  $('motion-pack-filter').onchange=e=>{state.motionPack=e.target.value;saveState();motionBrowser(host);};
  $('motion-label-filter').onchange=e=>{state.motionLabel=e.target.value;saveState();motionBrowser(host);};
  $('more-motions')?.addEventListener('click',()=>{motionLimit+=60;motionBrowser(host);});
  $('embedded-motion').onclick=()=>viewer?.setMotion(null);
}
async function applyMotion(motion){
  if(!sourceAvailable()){toast('원본 서버 ONLINE일 때 모션을 적용할 수 있습니다.');return;}
  selectedMotion=motion.id;try{localStorage.setItem('skyhaven.libraryMotion',motion.id);}catch{}
  if(!viewer){pendingMotion={asset:selected?.id,variant:variant?.id,motion};toast('모델이 준비되면 선택한 모션을 적용합니다.');return;}
  document.querySelectorAll('[data-motion]').forEach(el=>el.classList.toggle('active',el.dataset.motion===motion.id));
  const version=revision,handle=viewer;const labels=[...document.querySelectorAll('[data-motion-evidence]')].filter(el=>el.dataset.motionEvidence===motion.id);const evidence=text=>labels.forEach(el=>el.textContent=text);evidence('적용 중…');
  try{const result=await handle.setMotion(motion);if(version!==revision||!result)return;evidence('웹 재생 확인');}
  catch(error){if(version===revision){evidence('적용 불가');toast(error.message);}}
}
async function animationPage(){
  stop();const version=revision;life=new AbortController();const signal=life.signal;
  if(!selected||!variant){
    const id=rememberedCharacter||data.entities.find(e=>e.variants.length&&e.category==='characters').id;
    const connecting=detailCache.has(id)?null:connectingAsset($('main'),signal);
    try{const entity=await asset(id,{signal});if(version!==revision)return;selected=entity;variant=selected.variants.find(v=>v.id===rememberedVariant)||selected.variants[0];}
    finally{connecting?.finish();}
  }
  if(version!==revision)return;
  $('main').innerHTML=`<div class="library-heading"><p class="eyebrow">MOTION LIBRARY</p><h1>애니메이션</h1><p>같은 캐릭터에 모션을 입혀 비교하세요.</p></div><label class="motion-character">미리보기 캐릭터<select id="motion-character">${data.entities.filter(e=>e.variants.length).map(e=>`<option value="${esc(e.id)}" ${selected.id===e.id?'selected':''}>${esc(e.group+' / '+cleanName(e.name))}</option>`).join('')}</select></label><section id="library-detail" class="animation-detail library-detail"></section>`;
  $('motion-character').onchange=e=>choose(e.target.value);tab='motion';await detail();
}
async function showPack(id){
  stop();limit=70;const version=revision;life=new AbortController();const signal=life.signal;
  if(!packCache.has(id)){
    const destination=$('library-detail')||$('main');destination.innerHTML='<div id="pack-progress">'+loadingMarkup+'</div>';
    const loading=startLoading($('pack-progress'),signal);loading.update('팩을 연결하는 중…','씬·프리팹·썸네일 색인을 확인하고 있습니다.');
    try{packCache.set(id,await catalogCache.read(API+'/packs/'+encodeURIComponent(id),{signal}));}
    catch(error){if(signal.aborted)return;throw error;}
    finally{loading.finish();}
  }
  if(version!==revision)return;packData=packCache.get(id);selected=null;
  $('main').innerHTML=`<div class="library-heading"><a href="#${category}">← 팩 목록</a><p class="eyebrow">${esc(packData.pack.group)} / ${esc(packData.pack.root||'설치 대기')}</p><h1>${esc(packData.pack.name)}</h1></div><div class="library-workbench"><section class="library-browse"><div class="pack-cover">${packData.pack.cover?`<img ${mediaSrc(packData.pack.cover.url)} alt="팩 대표 이미지"><small>출처: ${esc(packData.pack.cover.source)}</small>`:''}</div>${packMetrics(packData.pack)}<div id="pack-items"></div></section><section class="library-detail" id="library-detail"><h2>데모 씬·조합</h2><p>전체 배경과 조합을 확인한 뒤 개별 에셋의 경로를 가져가세요.</p>${(packData.pack.gallery||[]).map(image=>`<figure class="pack-scene"><img class="scene-preview" ${mediaSrc(image.url)} alt="${esc(packData.pack.name)} 공식 씬 이미지" loading="lazy"><figcaption><a href="${esc(image.sourceUrl)}" target="_blank" rel="noopener">${esc(image.source)} ↗</a></figcaption></figure>`).join('')}${packData.scenes.map(s=>pathRow(s.name,s.path)+pathRow('GUID',s.guid)).join('')||'<p>이 호스트에 확인된 데모 씬이 없습니다.</p>'}</section></div>`;
  packItems();
}
function packMetrics(pack){
  if(!pack.sourceStats)return '';
  if(pack.availability==='awaiting-install')return `<p class="source-note">설치 대기 · 아직 이 컴퓨터에 연결된 원본이 없습니다.</p><p class="source-note">스토어 패키지 표기: ${esc(pack.storePackageSize)} · 로컬 실측값과 별개</p><a href="${esc(pack.storeUrl)}" target="_blank" rel="noopener">공식 상품 정보 ↗</a>`;
  const s=pack.sourceStats;
  return `<section class="pack-metrics"><h3>원본 용량·복잡도</h3><div class="pack-metric-grid"><div><strong>${formatBytes(s.folderBytes??s.sourceBytes)}</strong><small>팩 폴더 전체 용량</small></div><div><strong>${formatBytes(s.textureBytes)}</strong><small>텍스처 ${s.textures}개</small></div><div><strong>${formatBytes(s.modelBytes)}</strong><small>모델 ${s.models}개</small></div><div><strong>${s.measuredModels} / ${s.models}</strong><small>모델 수치 측정 완료</small></div></div><p>${Object.entries(s.textureResolutions).map(([size,count])=>`${esc(size)} · ${count}개`).join(' / ')}</p><p class="source-note">이미지 원본 해상도·디스크 용량입니다. Unity의 텍스처 최대 크기와 런타임 메모리는 별도입니다.</p><a href="${esc(pack.storeUrl)}" target="_blank" rel="noopener">공식 상품 정보 ↗</a></section>`;
}
function sourceMetrics(item){
  if(!item.assetType)return '';
  const models=Array.isArray(item.modelMetrics)?item.modelMetrics:item.modelMetrics?[{...item.modelMetrics,path:item.path}]:[];
  const textures=Array.isArray(item.textureMetrics)?item.textureMetrics:item.textureMetrics?[{...item.textureMetrics,path:item.path,sourceBytes:item.sourceBytes}]:[];
  return `<section class="source-metrics"><h3>수치·용량</h3>${item.source?.url?`<a ${sourceHref(item.source.url)} download>원본 파일 ↓</a>`:''}<p>${item.assetType==='prefab'?'프리팹 파일 (YAML)':'원본 파일'} · ${formatBytes(item.sourceBytes)}</p>${models.map(m=>`<article><strong>${esc(m.path?.split('/').at(-1)||item.name)}</strong><dl><dt>LOD0 삼각형</dt><dd>${m.trianglesLod0?.toLocaleString()??'측정 대기'}</dd><dt>LOD0 원본 버텍스</dt><dd>${m.verticesLod0?.toLocaleString()??'—'}</dd><dt>가로 × 높이 × 깊이</dt><dd>${m.dimensionsMeters?.map(x=>x.toFixed(2)+' m').join(' × ')||'측정 대기'}</dd>${m.sourceBytes!=null?`<dt>모델 원본 용량</dt><dd>${formatBytes(m.sourceBytes)}</dd>`:''}</dl>${m.materialCoverage?.unresolved?.length?`<p class="source-note">재질 연결 미확인 ${m.materialCoverage.unresolved.length}개 · 회색으로 표시</p>`:''}${m.lods?`<small>${Object.entries(m.lods).map(([lod,value])=>`LOD${esc(lod)}: ${value.triangles.toLocaleString()} tris`).join(' / ')}</small>`:''}</article>`).join('')}${textures.length?`<details><summary>연결 텍스처 ${textures.length}개 · 해상도·용량</summary>${textures.map(t=>`<article><strong>${esc(t.path.split('/').at(-1))}</strong><p>${t.width?`${t.width} × ${t.height}`:'크기 미확인'} · ${formatBytes(t.sourceBytes)}${t.importMaxSize?' · Unity 기본 최대 '+t.importMaxSize:''}</p></article>`).join('')}</details>`:''}<p class="source-note">${models.length?'FBX 원본·LOD0의 오프라인 측정입니다. 크기는 FBX 임포트 축·단위 기준이며 프리팹의 배치·스케일은 포함하지 않습니다. Unity 렌더 버텍스와 실행 성능 검증은 별도입니다.':''}</p>${item.dependencyEvidence?`<p class="source-note">${esc(item.dependencyEvidence)}</p>`:''}</section>`;
}
function prefabImage(item){
  if(item.thumbnailUrl)return `<img ${mediaSrc(item.thumbnailUrl)} alt="${esc(item.name)}" loading="lazy">`;
  const s=item.thumbnailSprite;if(!s)return `<span>${esc(item.status)}</span>`;
  return `<span class="atlas-image" role="img" aria-label="${esc(item.name)}" ${hosted?'data-live-background="'+esc(s.url)+'"':''} style="${hosted?'':"background-image:url('"+esc(s.url)+"');"}background-size:${s.atlasWidth/s.w*100}% ${s.atlasHeight/s.h*100}%;background-position:${s.atlasWidth>s.w?s.x/(s.atlasWidth-s.w)*100:0}% ${s.atlasHeight>s.h?s.y/(s.atlasHeight-s.h)*100:0}%"></span>`;
}
function packItems(){
  const items=filterPackItems(packData.items,{query:state.query});
  const typed=!!packData.pack.browseKinds;
  const assetType=$('pack-asset-type')?.value||(typed?'model':'');
  const scope=$('pack-scope')?.value??(category==='characters'?'character':'environment');
  const typeItems=filterPackItems(items,{scope,assetType});
  const categories=[...new Set(typeItems.map(i=>i.category))];
  const filter=categories.includes($('pack-kind')?.value)?$('pack-kind').value:'';
  const order=$('pack-sort')?.value||'name';
  const assembly=$('pack-assembly')?.value||'',assemblies=(packData.pack.assemblies||[]).map(a=>({...a,count:filterPackItems(packData.items,{scope,assembly:a.id}).length})).filter(a=>a.count);
  const visible=sortPackItems(filterPackItems(items,{category:filter,assembly,scope,assetType}),order);
  const caption=i=>i.assetType==='texture'?`${i.textureMetrics.width||'—'} × ${i.textureMetrics.height||'—'} · ${formatBytes(i.sourceBytes)}`:i.assetType==='model'?`${i.tris?.toLocaleString()??'측정 대기'} tris · LOD0 · ${formatBytes(i.sourceBytes)}`:typed?`${esc(i.category)} · ${i.models.length}개 연결 모델`:`${esc(i.category)} · ${i.tris?.toLocaleString()||'—'} tris`;
  $('pack-items').innerHTML=`<div class="pack-filter-row">${typed?`<label>에셋 종류<select id="pack-asset-type">${[['model','원본 모델'],['prefab','프리팹·조합'],['texture','텍스처']].map(([key,title])=>`<option value="${key}" ${assetType===key?'selected':''}>${title}</option>`).join('')}</select></label>`:''}<label class="pack-kind">표시 범위<select id="pack-scope"><option value="character" ${scope==='character'?'selected':''}>캐릭터</option><option value="environment" ${scope==='environment'?'selected':''}>배경·프랍</option><option value="" ${!scope?'selected':''}>모든 에셋</option></select></label><label class="pack-kind">분류<select id="pack-kind"><option value="">전체 ${typeItems.length}</option>${categories.map(c=>`<option ${filter===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>${typed?`<label>정렬<select id="pack-sort">${[['name','이름'],['triangles','삼각형 많은 순'],['bytes','파일 큰 순'],['resolution','텍스처 해상도 큰 순']].map(([key,title])=>`<option value="${key}" ${order===key?'selected':''}>${title}</option>`).join('')}</select></label>`:''}${assemblies.length?`<label class="pack-kind">조합된 배경<select id="pack-assembly"><option value="">전체 에셋</option>${assemblies.map(a=>`<option value="${esc(a.id)}" ${assembly===a.id?'selected':''}>${esc(a.name)} · ${a.count}개 구성 에셋</option>`).join('')}</select></label>`:''}</div><div class="entity-grid">${visible.slice(0,limit).map(i=>`<button class="entity-card" data-item="${esc(i.id)}"><div class="entity-image">${prefabImage(i)}</div><strong>${esc(i.name.replace(/^SM_/,'').replaceAll('_',' '))}</strong><small>${caption(i)}</small></button>`).join('')||`<p class="source-note">${packData.pack.availability==='awaiting-install'?'설치되면 개별 모델과 프리팹이 연결됩니다.':'이 조건에 맞는 에셋이 없습니다.'}</p>`}</div>${visible.length>limit?'<button id="more-items">에셋 더 보기 ↓</button>':''}`;
  $('pack-kind').onchange=packItems;
  $('pack-scope').onchange=()=>{if($('pack-kind'))$('pack-kind').value='';if($('pack-assembly'))$('pack-assembly').value='';packItems();};
  if($('pack-asset-type'))$('pack-asset-type').onchange=()=>{limit=70;$('pack-kind').value='';packItems();};
  if($('pack-sort'))$('pack-sort').onchange=packItems;
  if($('pack-assembly'))$('pack-assembly').onchange=packItems;
  $('more-items')?.addEventListener('click',()=>{limit+=100;packItems();});
}
function packItem(id){
  const item=packData.items.find(i=>i.id===id);if(!item)return;stop();
  $('library-detail').innerHTML=`<header class="asset-heading"><div><p class="eyebrow">${esc(item.category)}</p><h2>${esc(item.name)}</h2></div></header>${item.thumbnailUrl||item.thumbnailSprite?`<div class="prefab-preview">${prefabImage(item)}</div>`:`<p>썸네일 상태: ${esc(item.status)}${item.flag?' · '+esc(item.flag):''}</p>`}${item.thumbnailEvidence?`<p class="source-note">${esc(item.thumbnailEvidence)}</p>`:''}${sourceMetrics(item)}${pathRow(item.assetType==='model'?'모델 · 프로젝트 상대 경로':item.assetType==='texture'?'텍스처 · 프로젝트 상대 경로':'프리팹 · 프로젝트 상대 경로',item.prefab||item.path)}${pathRow('Unity GUID',item.guid)}${(item.models||[]).map(p=>pathRow('모델',p)).join('')}${(item.textures||[]).map(p=>pathRow('텍스처',p)).join('')}<details><summary>추가 정보·이 컴퓨터 위치</summary>${pathRow('확인된 절대 경로',item.localPath)}${pathRow('소스 해시',item.sourceHash)}<p>${esc(item.status)} · ${esc(item.tris)} tris</p></details>`;
}
async function filesPage(path){
  stop();const version=revision;life=new AbortController();const listSignal=life.signal;
  if(!raw)raw=await catalogCache.read('/comfy/skyhaven/api/resources',{signal:listSignal});
  if(version!==revision)return;
  const files=raw.folders.flatMap(f=>f.files),file=files.find(f=>f.path===path);
  $('main').innerHTML=`<div class="library-heading"><h1>전체 파일·제작 기록</h1><p>기존 파일 링크와 다운로드를 그대로 사용할 수 있습니다.</p></div><div class="raw-file-layout"><section>${fileRows(files.filter(f=>(state.game==='all'||f.game===state.game)&&matches(f.path,state.query)).slice(0,limit))}<button id="more-files">더 보기 ↓</button></section><section id="raw-preview"></section></div>`;
  $('more-files').onclick=()=>{limit+=100;filesPage(path);};
  if(file){$('raw-preview').innerHTML=`<h2>${esc(file.name)}</h2>${pathRow('원본 경로',file.path)}<a ${sourceHref(file.url)} download>원본 다운로드 ↓</a><div id="raw-media"></div>`;
    if(!sourceAvailable()){$('raw-media').innerHTML=offlineNotice;return;}
    if(file.kind==='image')$('raw-media').innerHTML=`<img class="scene-preview" ${mediaSrc(file.url)} alt="${esc(file.name)}">`;
    else if(['fbx','glb','gltf','obj','anim'].includes(file.extension)){life=new AbortController();const signal=life.signal;const {createViewer}=await import('./skyhaven-viewer.mjs?v=20261022-library-v6');const handle=await createViewer({host:$('raw-media'),file,folder:raw.folders[0],folders:raw.folders,signal});if(signal.aborted)handle();else viewer=handle;}
    else if(['json','txt','md','csv'].includes(file.extension)){const text=await fetch(file.url).then(r=>r.text());const pre=document.createElement('pre');pre.textContent=text;$('raw-media').append(pre);}
  }
}
function agentsPage(){stop();const catalogURL=transport.endpoint(API),example=data.entities.find(e=>e.id==='character:Elara')||data.entities[0],assetURL=example?transport.endpoint(API+'/assets/'+encodeURIComponent(example.id)):catalogURL;$('main').innerHTML=`<div class="library-heading"><h1>다른 세션에서 사용</h1></div><p>에셋 ID로 대표 모델·변형·관련 자료를 함께 가져오세요. 상대 경로가 기본 참조입니다.${hosted?' 목록은 웹에서, 실제 파일은 원본 서버 ONLINE일 때 읽습니다.':deployment?' 로컬 파일 URL은 폴더를 연결한 브라우저에서만 읽습니다. MCP는 localRef의 루트와 상대 경로를 사용하세요.':''}</p><a class="button ghost" href="#manual">저장 위치·폴더 관리 매뉴얼 ↗</a>${pathRow('에셋 카탈로그',catalogURL)}${deployment?'':pathRow('같은 호스트 API','http://127.0.0.1:8187'+API)}${pathRow('모션 목록',transport.endpoint(API+'/motions'))}<pre>const library = await fetch('${esc(catalogURL)}').then(r =&gt; r.json());\nconst asset = await fetch('${esc(assetURL)}').then(r =&gt; r.json());\n// asset.variants[].model: path, url, guid, sourceHash, localRef\n// asset.related: 원화, 대사, 구형 모델, 제작 기록</pre>`;}
async function manualPage(){stop();const url=deployment?new URL('manual.md',transport.pageURL()).href:'/comfy/assets/skyhaven-storage-manual.ko.md';const response=await fetch(url);if(!response.ok)throw new Error('매뉴얼을 읽을 수 없습니다.');const text=await response.text();$('main').innerHTML=`<div class="library-heading"><h1>저장 위치·폴더 관리 매뉴얼</h1><a href="${esc(url)}" download>매뉴얼 내려받기 ↓</a></div><pre class="library-manual">${esc(text)}</pre>`;}
async function maintenance(){stop();if(!transport.writable){$('main').innerHTML=`<div class="library-heading"><h1>게시된 색인·연결 상태</h1><p>게시 시각: ${esc(deployment.publishedAt)} · 이미지는 별도 보관하지 않습니다. 원본 서버 ONLINE일 때 원본을 읽습니다.</p></div><p>목록만 자동 게시합니다. 원본 파일이나 이미지는 사이트에 복사하지 않습니다.</p><a href="#manual">MCP · 폴더 연결 매뉴얼</a><pre>${esc(JSON.stringify(data.issues,null,2))}</pre>`;return;}$('main').innerHTML=`<div class="library-heading"><h1>연결 상태·목록 관리</h1><p>이미지 별도 생성·저장 없이 원본을 읽습니다. 검증 기록은 별도로 보존합니다.</p></div><p>직접 제작 ${data.counts.forms}개 형태 · ${data.counts.identities}개 캐릭터 · POLYGON ${data.counts.polygon.toLocaleString()}개 프리팹</p><label class="qa-scope">캐릭터 점검 범위 <select id="qa-scope"><option value="">34개 형태 전체</option>${data.entities.filter(e=>e.origin==='GameSet').flatMap(e=>e.variants.map(v=>`<option value="${esc(v.id)}">${esc(e.group+' / '+v.name)}</option>`)).join('')}</select></label><button id="qa-motions" class="button ghost">대표 캐릭터 모션 점검</button><button id="qa-packs" class="button ghost">모션 팩 대표 클립 점검</button><button id="cancel-maintenance">중단</button><pre id="maintenance-log">${esc(JSON.stringify(data.issues,null,2))}</pre><div id="maintenance-preview"></div>`;
  const qaPack=document.createElement('label');qaPack.className='qa-scope';qaPack.innerHTML='데모 모션 팩<select id="qa-motion-pack"><option>Human Basic Motions</option><option>Basic Motions</option></select>';$('qa-motions').before(qaPack);
  $('qa-motions').onclick=()=>qaMotions();$('qa-packs').onclick=()=>qaPacks();$('cancel-maintenance').onclick=stop;
}
async function qaMotions(){
  stop();life=new AbortController();const signal=life.signal;
  const {createViewer}=await import('./skyhaven-viewer.mjs?v=20261022-library-v6');
  const tests=smokeMotions(motions,$('qa-motion-pack')?.value||'Human Basic Motions');
  const results=[];const host=$('maintenance-preview');
  const scope=$('qa-scope')?.value||'';
  for(const e of data.entities.filter(e=>e.origin==='GameSet'))for(const v of e.variants){
    if(scope&&scope!==v.id)continue;
    if(signal.aborted)return;const folder={id:e.id,name:e.name,files:[v.model,...v.textures,...motions]};
    $('maintenance-log').textContent=`모션 점검: ${e.name} / ${v.name}\n`+$('maintenance-log').textContent;
    try{
      const checks=[];
      let firstCanvas;
      for(const phase of ['initial','reload']){
        if(viewer){firstCanvas=host.querySelector('canvas');viewer();viewer=null;}
        viewer=await createViewer({host,file:v.model,folder,folders:[folder],signal,assignMotions:true});
        if(host.dataset.viewerReady!=='true')throw new Error(host.querySelector('.viewer-status')?.textContent||'대표 모델 로딩 실패');
        if(phase==='reload'&&(firstCanvas===host.querySelector('canvas')||firstCanvas?.isConnected))throw new Error('이전 미리보기가 해제되지 않았습니다.');
        for(const {name,motion} of tests){
          signal.throwIfAborted();if(!motion)throw new Error(name+' 모션을 찾지 못했습니다.');
          const applied=await viewer.setMotion(motion);signal.throwIfAborted();
          if(!applied)throw new Error('모션 적용 중단');
          const sample=viewer.inspectClip();checks.push({name,phase,motion:motion.id,...sample});
        }
      }
      const receipt={asset:e.id,variant:v.id,sourceHash:v.model.sourceHash,checks,reloadVerified:true,status:'web-playback',testedAt:new Date().toISOString(),origin:location.origin,rendererVersion:'library-v6'};
      const response=await fetch(API+'/verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(receipt),signal});
      if(!response.ok)throw new Error('검증 기록 저장 실패 '+response.status);
      results.push({asset:e.id,variant:v.id,status:'web-playback',checks:checks.map(({frames,...check})=>check)});
      $('maintenance-log').textContent=`확인: ${v.name} · Idle / Walk / Run · 닫기·재로드 후 재생\n`+$('maintenance-log').textContent;
    }catch(error){if(signal.aborted)return;results.push({asset:e.id,variant:v.id,status:'error',error:error.message});$('maintenance-log').textContent='실패: '+v.name+' · '+error.message+'\n'+$('maintenance-log').textContent;}
    finally{viewer?.();viewer=null;}
  }
  $('maintenance-log').textContent=`점검 완료: ${results.filter(r=>r.status==='web-playback').length} / ${results.length}개 형태\n`+JSON.stringify(results,null,2);
}
async function qaPacks(){
  stop();life=new AbortController();const signal=life.signal;
  const {createViewer}=await import('./skyhaven-viewer.mjs?v=20261022-library-v6');
  const e=await asset('character:Elara'),v=e.variants[0],folder={id:e.id,name:e.name,files:[v.model,...v.textures,...motions]},host=$('maintenance-preview');
  const candidates=motions.filter(m=>m.rig==='Humanoid'&&m.extension==='fbx'&&m.role!=='character'&&m.path.startsWith('Motion Library/')&&(m.path.includes('/Animations/')||m.clips?.length));
  const packs=[...new Set(candidates.map(m=>m.pack))].sort();const checks=[],failures=[];
  try{
    viewer=await createViewer({host,file:v.model,folder,folders:[folder],signal,assignMotions:true});
    if(host.dataset.viewerReady!=='true')throw new Error(host.querySelector('.viewer-status')?.textContent||'모델 로딩 실패');
    for(const pack of packs){
      signal.throwIfAborted();$('maintenance-log').textContent=`팩 점검: ${pack}\n`+$('maintenance-log').textContent;
      const pool=candidates.filter(m=>m.pack===pack),motion=pool.find(m=>/@Idle01\.fbx$/i.test(m.name))||pool.find(m=>/idle/i.test(m.name)&&!/crouch|wounded|combat|weapon/i.test(m.name))||pool.find(m=>!/pose|avatar|mannequin|reference/i.test(m.name))||pool[0];
      try{
        await viewer.setMotion(motion);signal.throwIfAborted();const check={name:pack,motion:motion.id,...viewer.inspectClip()};
        const receipt={asset:e.id,variant:v.id,sourceHash:v.model.sourceHash,checks:[check],status:'pack-representatives',origin:location.origin,rendererVersion:'library-v6',testedAt:new Date().toISOString()};
        const response=await fetch(API+'/verification',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(receipt),signal});
        if(!response.ok)throw new Error('팩 검증 기록 저장 실패 '+response.status);
        checks.push(check);$('maintenance-log').textContent='확인: '+pack+'\n'+$('maintenance-log').textContent;
      }
      catch(error){if(signal.aborted)throw error;failures.push({pack,motion:motion.id,error:error.message});$('maintenance-log').textContent='실패: '+pack+' · '+error.message+'\n'+$('maintenance-log').textContent;}
    }
    $('maintenance-log').textContent=`모션 팩 점검 완료: ${checks.length} / ${packs.length}\n`+JSON.stringify({failures,checked:checks.map(c=>({name:c.name,motion:c.motion,clip:c.clip,poseDelta:c.poseDelta}))},null,2);
  }catch(error){if(!signal.aborted)$('maintenance-log').textContent=error.message+'\n'+$('maintenance-log').textContent;}
  finally{viewer?.();viewer=null;}
}
async function route(){
  if(!data)return;const parts=location.hash.slice(1).split('/');let next=parts[0];if(next==='home'||!next)next='characters';if(next==='polygon')next='environments';if(next==='concepts')next='files';
  if(parts[0]==='polygon'&&parts[1]){const oldPack=data.packs.find(p=>p.id===decodeURIComponent(parts[1]));if(oldPack){category=oldPack.category;navigation();await showPack(oldPack.id);return;}}
  const changed=next!==category;category=next;if(changed&&state.group&&!data.entities.some(e=>e.category===category&&e.group===state.group)&&!data.packs.some(p=>packInSection(p,category)&&p.group===state.group)){state.group='';saveState();}navigation();
  if(category==='agents'){agentsPage();return;}if(category==='manual'){await manualPage();return;}if(category==='maintenance'){await maintenance();return;}
  if(category==='owned'){stop();packData=null;await owned.render({search:state.query});return;}
  if(category==='files'||category==='file'){await filesPage(category==='file'?decodeURIComponent(parts.slice(1).join('/')):null);return;}
  if(category==='animations'){if(!state.motionQuery&&state.query)state.motionQuery=state.query;await animationPage();return;}
  if(parts[1]==='pack'){await showPack(decodeURIComponent(parts[2]));return;}
  if(changed||!$('asset-cards')){stop();packData=null;shell();}cards();
  const id=parts[1]?decodeURIComponent(parts.slice(1).join('/')):null;
  if(id&&id!==selected?.id){tab='3d';await choose(id);}
  else if(changed&&selected?.category===category)await detail();
}
document.addEventListener('click',event=>{
  const el=event.target.closest('button,a');if(!el)return;
  if(el.dataset.entity){tab='3d';location.hash=category+'/'+encodeURIComponent(el.dataset.entity);if(selected?.id===el.dataset.entity)choose(el.dataset.entity);}
  if(el.dataset.pack)location.hash=category+'/pack/'+encodeURIComponent(el.dataset.pack);
  if(el.dataset.item)packItem(el.dataset.item);
  if(el.dataset.copy)void copy(el.dataset.copy);
  if(el.dataset.tab){tab=el.dataset.tab;void detail();}
    if(el.dataset.motion){const motion=motions.find(m=>m.id===el.dataset.motion);if(motion)void applyMotion(motion);}
    if(el.hasAttribute('data-embedded'))void viewer?.playEmbedded(Number(el.dataset.embedded));
  if(el.hasAttribute('data-motion-query')){state.motionQuery=el.dataset.motionQuery;motionLimit=60;saveState();motionBrowser($('inline-motions'));}
  if(el.hasAttribute('data-group')){state.group=el.dataset.group;saveState();cards();}
  if(el.dataset.game){state.game=el.dataset.game;state.group='';saveState();navigation();if(packData)void route();else if($('asset-cards'))cards();else if(category==='files')void filesPage();}
});
$('search').value=state.query;let searchTimer;
$('search').oninput=e=>{state.query=e.target.value;if(category==='animations')state.motionQuery=state.query;saveState();clearTimeout(searchTimer);searchTimer=setTimeout(()=>{limit=70;if(category==='owned')owned.search(state.query);else if(packData)packItems();else if($('asset-cards'))cards();else if(category==='animations')motionBrowser($('inline-motions'));else if(category==='files')void filesPage();},180);};
$('refresh').onclick=async()=>{
  const button=$('refresh');button.disabled=true;button.textContent='색인 갱신 중…';
  let refreshed=false;
  try{
    if(hosted)Object.assign(deployment,await loadHostedDeployment(deployment));
    if(category==='owned'){await owned.render({search:state.query,refresh:true});return;}
    const snapshot=await catalogCache.refresh();refreshed=true;stop();data=snapshot.data;motions=snapshot.motions;detailCache.clear();packCache.clear();raw=null;selected=null;variant=null;catalogStatus(snapshot);await route();toast('최신 색인을 저장했습니다.');
  }catch(error){toast((refreshed?'색인은 저장했습니다. 화면을 다시 열어주세요. ':'갱신 실패 · 이전 색인을 유지합니다. ')+error.message);}
  finally{button.disabled=false;button.textContent='새로고침 ↻';}
};
$('close-preview').onclick=()=>$('preview-dialog').close();
window.addEventListener('hashchange',()=>void route().catch(error=>{if(error.name!=='AbortError')toast(error.message);}));
window.addEventListener('pagehide',stop);
document.addEventListener('click',async event=>{
  if(event.target.closest('[data-recheck-source]')&&sourceStatus){await sourceStatus.check();if(sourceStatus.online){if(selected&&$('library-detail'))void detail();else void route();}}
});
window.addEventListener('skyhaven-local-roots-changed',()=>{stop();selected=null;variant=null;void route().catch(error=>toast(error.message));});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)){e.preventDefault();$('search').focus();}if(e.key==='Escape')stop();});
let initialLoading;
$('main').innerHTML='<div id="catalog-progress">'+loadingMarkup+'</div>';
initialLoading=startLoading($('catalog-progress'));initialLoading.update('에셋 카탈로그 연결 중…','대표 모델·모션·팩 색인을 확인하고 있습니다.');
try{if(!hosted)installLocalConnections(deployment);const snapshot=await (deployment?withLocalTimeout(()=>catalogCache.load()):catalogCache.load());data=snapshot.data;motions=snapshot.motions;initialLoading.finish();catalogStatus(snapshot);await route();}
catch(error){$('main').innerHTML=`<div class="empty"><h1>라이브러리를 연결할 수 없습니다.</h1><p>${esc(error.message)}</p>${deployment?'<p>폴더 연결에서 색인을 다시 선택하거나 읽기 권한을 확인해 주세요.</p><button id="retry-library" class="button primary">목록 다시 읽기</button>':''}<a href="${esc(transport.endpoint('/comfy/skyhaven/api/resources'))}">파일 색인 열기</a></div>`;if($('retry-library'))$('retry-library').onclick=()=>location.reload();}
finally{initialLoading.finish();}
