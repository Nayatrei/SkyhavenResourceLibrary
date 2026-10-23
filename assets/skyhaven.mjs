import {games, categories, buildIndex, searchFiles, animationFiles, canPreview, thumbnailFor, resourceReference, motionPack, motionLabels, readMotionFilters, writeMotionFilters} from './skyhaven-index.mjs?v=20261022-polygon-library';
import {loadingMarkup,startLoading} from './skyhaven-loading.mjs';
import {createPolygonLibrary} from './skyhaven-polygon.mjs?v=20261022-polygon-library';

const API = '/comfy/skyhaven/api/resources';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const bytes = value => value < 1024*1024 ? `${Math.round(value/1024)} KB` : `${(value/1024/1024).toFixed(1)} MB`;
let catalog, index, limit=60, category='home';
let {query,pack,directory,format,motionCategory,motionSubcategory}=readMotionFilters(location.search);
function saveFilters(){history.replaceState(null,'',writeMotionFilters(new URL(location.href),{query,pack,directory,format,motionCategory,motionSubcategory,game}));}
function changeFilters(){limit=60;saveFilters();render();}
let game=new URLSearchParams(location.search).get('game')||'all';
if(!games.some(item=>item.id===game))game='all';
let life, cleanup, generation=0, lastRefresh=0, relatedLimit=50;
let characterPath='';
try{characterPath=localStorage.getItem('skyhaven.previewCharacter')||'';}catch{}
const dialog = $('preview-dialog');
const categoryInfo = id => categories.find(item => item.id===id);
const visibleFiles = () => searchFiles(index.files,'',{game});
const groupsFor = (id,gameScope=game) => index.groups.filter(group => (gameScope==='all'||group.game===gameScope) && group.category===id && group.files.some(canPreview) && (id!=='characters'||group.models.length));
const polygon=createPolygonLibrary({host:$('main'),dialog,esc,copy,isActive:()=>category==='polygon',stopPreview,onCount:()=>navigation(),browse:path=>{
  directory=path.replace(/^Skyhaven\//,'');query='';$('search').value='';format='all';game='all';saveFilters();location.hash='files';
}});

function toast(message) {
  $('toast').textContent=message; $('toast').hidden=false;
  clearTimeout(toast.timer); toast.timer=setTimeout(() => $('toast').hidden=true, 3500);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('참조 링크를 복사했습니다.'); }
  catch { toast('복사 권한이 없습니다. 참조 내용을 선택해서 복사하세요.'); }
}
function navigation() {
  $('game-filters').innerHTML='<span>게임</span>'+games.map(item=>`<button type="button" data-game="${item.id}" aria-pressed="${game===item.id}">${item.name}</button>`).join('');
  $('navigation').innerHTML=`<a href="#home" class="nav-item ${category==='home'?'active':''}" ${category==='home'?'aria-current="page"':''}><span>00</span>둘러보기</a>`+categories.map(item => {
    const count=item.id==='polygon'?polygon.count:item.id==='files'?visibleFiles().length:item.id==='animations'?animationFiles(visibleFiles()).length:groupsFor(item.id).length;
    return `<a href="#${item.id}" class="nav-item ${category===item.id?'active':''}" ${category===item.id?'aria-current="page"':''}><span>${item.number}</span>${item.name}<small>${count?.toLocaleString()??'팩'}</small></a>`;
  }).join('');
}
function image(file, className='') {
  return file ? `<img class="${className}" src="${esc(file.url)}" alt="${esc(file.name)}" loading="lazy">` : '';
}
function groupCard(group) {
  const info=categoryInfo(group.category);
  return `<button class="resource-card" data-file="${esc(group.preview.path)}" aria-label="${esc(group.name)} 미리보기"><div class="card-image ${group.category}">${image(group.thumbnail)}<span class="card-monogram">${esc(group.name.slice(0,1))}</span><span class="card-action">미리보기 ↗</span></div><div class="card-content"><p class="eyebrow">${info.en} · ${group.models.length?group.models.length+' MODELS':group.files.length+' FILES'}</p><h3>${esc(group.name)}</h3><p>${group.files.length}개 파일 · 모델, 이미지와 원본</p></div></button>`;
}
function fileCard(file) {
  const poster = file.kind==='image' ? file : file.kind==='video' ? null : thumbnailFor(index.files.filter(asset => asset.path.split('/').slice(0,-1).join('/')===file.path.split('/').slice(0,-1).join('/')));
  return `<button class="resource-card file-card" data-file="${esc(file.path)}"><div class="card-image compact">${image(poster)}<span class="card-monogram">${file.category==='animations'?'▷':esc(file.extension.toUpperCase())}</span><span class="card-action">${canPreview(file)?'미리보기':'파일 보기'} ↗</span></div><div class="card-content"><p class="eyebrow">${esc(file.pack||file.path.split('/')[1]||file.extension)}</p><h3>${esc(file.name.replace(/\.[^.]+$/,''))}</h3><p>${esc(file.extension.toUpperCase())} · ${bytes(file.size)}</p><div class="motion-labels">${motionLabels(file,catalog.motionTaxonomy).slice(0,3).map(label=>`<span>${esc(label)}</span>`).join('')}</div></div></button>`;
}
function sectionHeading(eyebrow, title, description='') {
  return `<div class="page-heading"><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${description?`<p class="subtitle">${description}</p>`:''}</div>`;
}
function home() {
  const environment=groupsFor('environments')[0], hero=environment?.thumbnail;
  const characters=groupsFor('characters').filter(group => group.models.length);
  const title=game==='all'?'YOUR WORLDS':games.find(item=>item.id===game).name;
  $('main').innerHTML=`${sectionHeading('LIBRARY / '+esc(title),'Your world.<br>Within reach.','캐릭터, 움직임, 그리고 세계. 필요한 리소스를 클릭해서 바로 만나보세요.')}<div class="hero">${image(hero,'hero-image')}<div class="hero-shade"></div><div class="hero-caption"><p class="eyebrow">A WORLD TAKING SHAPE</p><h2>${esc(title)}<span>Resource Library</span></h2><p>${hero?'폴더에 있는 실제 렌더 · '+esc(environment.name):'내 폴더에서 시작하는 다음 세계'}</p><div class="hero-actions"><a class="button primary" href="#characters">캐릭터 만나보기 →</a>${hero?`<button class="button translucent" data-file="${esc(hero.path)}">배경 미리보기 ↗</button>`:''}</div></div></div><div class="metrics"><a href="#characters"><strong>${String(characters.length).padStart(2,'0')}</strong><span>characters to discover</span></a><a href="#animations"><strong>${animationFiles(visibleFiles()).length.toLocaleString()}</strong><span>motions to explore</span></a><a href="#environments"><strong>${String(groupsFor('environments').length).padStart(2,'0')}</strong><span>worlds taking shape</span></a></div><div class="section-header"><div><p class="eyebrow">MEET YOUR CAST</p><h2>세계에 생명을 더하는 캐릭터.</h2></div><a href="#characters">모두 보기 →</a></div><div class="card-grid">${characters.slice(0,4).map(groupCard).join('')}</div><div class="browse-links">${categories.slice(1,5).map(item=>`<a href="#${item.id}"><span>${item.symbol}</span><div><h3>${item.name}</h3><p>${item.en}</p></div><b>↗</b></a>`).join('')}</div>`;
}
function fileRow(file) {
  return `<div class="file-row"><button data-file="${esc(file.path)}"><span class="file-symbol">${file.kind==='animation'||file.category==='animations'?'▷':file.kind==='image'?'◇':'▧'}</span><span><strong>${esc(file.name)}</strong><small>${esc(file.path)}</small></span></button><span class="format">${esc(file.extension)}</span><span class="file-size">${bytes(file.size)}</span><a href="${esc(file.url)}" download aria-label="${esc(file.name)} 다운로드">↓</a></div>`;
}
function motionFilters(base,scope) {
  const taxonomy=catalog.motionTaxonomy?.categories||[];
  const active=taxonomy.find(c=>c.id===motionCategory);
  const count=(id,sub='all')=>searchFiles(base,'',{motionCategory:id,motionSubcategory:sub}).length;
  const packs=[...new Set(animationFiles(scope).map(motionPack))].sort((a,b)=>a.localeCompare(b));
  return `<section class="motion-filters" aria-label="동작 분류 필터"><div class="filter-heading"><strong>어떤 동작을 찾으세요?</strong><button class="button ghost" id="reset-motion-filters">필터 초기화</button></div><div class="chips motion-categories" aria-label="동작 대분류"><button data-motion-category="all" aria-pressed="${motionCategory==='all'}">전체 <small>${base.length.toLocaleString()}</small></button>${taxonomy.map(c=>`<button data-motion-category="${c.id}" aria-pressed="${motionCategory===c.id}">${esc(c.name)} <small>${count(c.id).toLocaleString()}</small></button>`).join('')}</div>${active?`<div class="chips motion-subcategories" aria-label="동작 소분류"><button data-motion-subcategory="all" aria-pressed="${motionSubcategory==='all'}">${esc(active.name)} 전체</button>${active.children.map(sub=>`<button data-motion-subcategory="${sub.id}" aria-pressed="${motionSubcategory===sub.id}">${esc(sub.name)} <small>${count(active.id,sub.id).toLocaleString()}</small></button>`).join('')}</div>`:'<p class="filter-hint">대분류를 선택하면 세부 동작을 고를 수 있습니다. 예: 감정 → 공포·위축 / 전투 → 방어·패링</p>'}<label class="motion-pack">모션 팩<select id="motion-pack"><option value="">모든 팩</option>${packs.map(value=>`<option value="${esc(value)}" ${pack===value?'selected':''}>${esc(value)}</option>`).join('')}</select></label><details class="taxonomy-guide"><summary>전체 분류표 · JSON 수정 방법</summary><div class="taxonomy-grid">${taxonomy.map(c=>`<div><strong>${esc(c.name)}</strong><p>${c.children.map(sub=>esc(sub.name)).join(' · ')}</p></div>`).join('')}</div><p>같은 모션은 여러 분류에 나타날 수 있습니다. 파일명·클립명으로 자동 분류했으며 실제 포즈는 미리보기로 확인하세요. 각 모션 폴더의 <code>motion-definitions.json</code>에서 <code>overrides</code>를 수정하면 다음 새로고침에 반영됩니다. 분류표: <code>04. Animations/Catalog/motion-taxonomy.json</code></p></details></section>`;
}
function browserView() {
  const info=categoryInfo(category), searching=!!query.trim(), isMotions=category==='animations';
  const scope=visibleFiles();
  const options={category:isMotions?'animations':searching||category==='files'?'all':category,directory,format,pack:isMotions?pack:''};
  const base=isMotions?searchFiles(animationFiles(scope),query,options):[];
  const all=isMotions?searchFiles(base,'',{motionCategory,motionSubcategory}):searchFiles(scope,query,options);
  const grouped=!searching&&!isMotions&&category!=='files';
  const groups=grouped?groupsFor(category):[];
  const files=all;
  const directoryFiles=isMotions?animationFiles(scope):searching||category==='files'?scope:searchFiles(scope,'',{category});
  const directories=[...new Set(directoryFiles.map(file=>file.path.split('/').slice(0,-1).join('/')).filter(Boolean))].sort();
  $('main').innerHTML=`${sectionHeading(isMotions?'MOTION LIBRARY':searching?'SEARCH / ALL RESOURCES':`LIBRARY / ${info.en.toUpperCase()}`,isMotions?'필요한 움직임을 찾으세요.':searching?'찾고 있던 리소스.':info.name,isMotions?'동작, 감정과 상황으로 좁히고 같은 캐릭터에 입혀 비교하세요.':searching?`“${esc(query)}” · ${files.length.toLocaleString()}개 파일`:info.description)}${isMotions?motionFilters(base,scope):''}${!grouped?`<div class="file-controls"><label>폴더<select id="directory"><option value="">모든 폴더</option>${directories.map(value=>`<option value="${esc(value)}" ${directory===value?'selected':''}>${esc(value)}</option>`).join('')}</select></label><label>형식<select id="format"><option value="all">모든 형식</option>${[...new Set(directoryFiles.map(file=>file.extension))].sort().map(value=>`<option ${format===value?'selected':''}>${esc(value)}</option>`).join('')}</select></label><span id="motion-result-count" role="status">${files.length.toLocaleString()}개 파일${searching?` · “${esc(query)}”`:''}</span></div>`:''}${grouped?`<div class="card-grid">${groups.map(groupCard).join('')}</div>`:isMotions?`<div class="card-grid motion-grid">${files.slice(0,limit).map(fileCard).join('')}</div>`:`<div class="file-list">${files.slice(0,limit).map(fileRow).join('')}</div>`}${!grouped&&files.length>limit?'<button class="button ghost show-more" id="show-more">더 보기 ↓</button>':''}${(grouped?!groups.length:!files.length)?'<div class="empty"><h2>이 조건에 맞는 리소스가 없습니다.</h2><p>검색어나 필터를 바꿔보세요. 미분류 모션은 ‘미분류’에서 확인할 수 있습니다.</p></div>':''}`;
  $('directory')?.addEventListener('change',event=>{directory=event.target.value;changeFilters();});
  $('format')?.addEventListener('change',event=>{format=event.target.value;changeFilters();});
  $('motion-pack')?.addEventListener('change',event=>{pack=event.target.value;changeFilters();});
  $('reset-motion-filters')?.addEventListener('click',()=>{query='';$('search').value='';pack='';directory='';format='all';motionCategory='all';motionSubcategory='all';changeFilters();});
  $('show-more')?.addEventListener('click',()=>{limit+=60;browserView();});
}
function agentView() {
  const url=new URL(API,location.origin).href;
  $('main').innerHTML=`${sectionHeading('CONNECTED / OTHER SESSIONS','찾고, 참조하고, 가져오세요.','같은 사이트의 JSON 목록과 원본 링크를 다른 세션에서도 사용할 수 있습니다.')}<div class="agent-panel"><h2>리소스 목록 API</h2><p>파일 경로, 형식, 크기, 수정일, 원본 URL과 미리보기 링크가 함께 제공됩니다. 웹 주소는 기존 사이트의 로그인 상태를 사용합니다.</p><a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)} ↗</a><button class="button primary" id="copy-api">API 주소 복사</button><h3>같은 호스트의 Codex 세션</h3><p>사이트를 실행하는 이 컴퓨터에서는 로컬 API를 바로 사용할 수 있습니다.</p><pre><code>http://127.0.0.1:8187/comfy/skyhaven/api/resources</code></pre><button class="button ghost" id="copy-local-api">로컬 API 주소 복사</button><h3>JavaScript에서 검색</h3><pre><code>${esc(`// 같은 호스트의 Node.js에서 실행\nconst endpoint = 'http://127.0.0.1:8187/comfy/skyhaven/api/resources';\n// 로그인된 브라우저에서는 위 웹 API 주소를 사용\nconst catalog = await fetch(endpoint + '?q=walk&format=fbx&game=shared').then(r => r.json());\nconst files = catalog.folders.flatMap(folder => folder.files);\n// file.path: 원본 폴더 경로\n// file.url: 다운로드 URL (사이트 기준 상대 경로)\n// file.previewUrl: 바로 열 수 있는 미리보기 링크\nfor (const file of files) {\n  console.log(file.path, new URL(file.url, endpoint).href);\n}`)}</code></pre><p><code>q</code> 이름/경로 검색 · <code>folder=Character/Final</code> 하위 폴더 검색 · <code>format=glb</code> 확장자 필터 · <code>game=skyhaven|companion|legends|shared</code> 게임 필터 · <code>motionCategory=emotion&amp;motionSubcategory=fear</code> 동작 분류 · <code>pack</code> 팩 이름 (정확히 일치)</p><h3>리소스 하나를 전달하려면</h3><p>카드나 파일을 클릭하고 <b>참조 복사</b>를 누르세요. 원본 경로, 미리보기, 다운로드와 API 주소가 함께 복사됩니다.</p><button class="button ghost" id="export-catalog">현재 목록 JSON 내려받기 ↓</button></div>`;
  $('copy-api').addEventListener('click',()=>copy(url));
  $('copy-local-api').addEventListener('click',()=>copy('http://127.0.0.1:8187/comfy/skyhaven/api/resources'));
  $('export-catalog').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(catalog,null,2)],{type:'application/json'}), link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='skyhaven-resources.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
}
function render() {
  if(!index)return;
  $('main').classList.toggle('motion-browser',category==='animations');
  $('game-filters').hidden=category==='polygon';
  navigation(); $('breadcrumb').textContent=(games.find(item=>item.id===game).name)+' / '+(query?'검색':categoryInfo(category)?.name||'라이브러리');
  if(category==='polygon'){void polygon.render(query?{query}:{});return;}
  polygon.deactivate();
  if(category==='home'&&!query)home();else if(category==='agents'&&!query)agentView();else browserView();
}
function relatedFiles(file) {
  const group=index.groups.find(group => group.files.some(asset=>asset.path===file.path));
  return group?.files || index.files.filter(asset=>asset.path.split('/').slice(0,-1).join('/')===file.path.split('/').slice(0,-1).join('/'));
}
function stopPreview() { generation++; life?.abort(); cleanup?.(); cleanup=null; }
async function preview(file) {
  stopPreview(); const version=generation; life=new AbortController(); const signal=life.signal;
  relatedLimit=50;
  $('preview-title').textContent=file.name;
  const assignable=file.category==='animations'&&['fbx','glb','gltf','anim'].includes(file.extension);
  const characters=groupsFor('characters','all').filter(group=>['fbx','glb','gltf'].includes(group.preview.extension));
  const character=assignable?characters.find(group=>group.preview.path===characterPath)?.preview:null;
  $('preview-body').innerHTML=(assignable?`<div class="character-assignment"><label for="preview-character">모션을 입힐 캐릭터</label><select id="preview-character"><option value="">팩 기본 캐릭터</option>${characters.map(group=>`<option value="${esc(group.preview.path)}" ${character?.path===group.preview.path?'selected':''}>${esc(group.name)}</option>`).join('')}</select><small>선택하면 바로 재생됩니다.</small></div>`:'')+`<div id="model-preview-host" class="preview-media"><div class="initial-loading">${loadingMarkup}</div></div>`;
  $('preview-character')?.addEventListener('change',event=>{characterPath=event.target.value;try{localStorage.setItem('skyhaven.previewCharacter',characterPath);}catch{}preview(file);});
  const reference=resourceReference(file,location.origin)+(character?`\nAssigned character: ${character.path}\nCharacter download: ${new URL(character.url,location.origin)}`:'');
  const related=relatedFiles(file);
  $('preview-files').innerHTML=`<p class="eyebrow">SOURCE RESOURCE</p><p class="source-path">${esc(file.path)}</p><p class="file-detail">${esc(file.extension.toUpperCase())} · ${bytes(file.size)}</p>${file.motion?`<div class="motion-labels">${motionLabels(file,catalog.motionTaxonomy).map(label=>`<span>${esc(label)}</span>`).join('')}</div><p class="filter-hint">${file.motion.review==='manual'?'직접 분류':'이름 기반 자동 분류'}${file.motion.description?' · '+esc(file.motion.description):''}</p>`:''}<div class="resource-actions"><a href="${esc(file.url)}" download class="button primary">원본 다운로드 ↓</a><button id="copy-reference" class="button ghost">참조 복사 ↗</button></div><details class="reference-text"><summary>다른 세션에 전달할 참조</summary><pre>${esc(reference)}</pre></details><div class="related-heading"><h3>관련 파일 <small>${related.length}</small></h3><input type="search" id="related-search" placeholder="관련 파일 검색…" aria-label="관련 파일 검색"></div><div id="related-list"></div><button id="related-more" class="button ghost show-more">더 보기 ↓</button>`;
  $('copy-reference').addEventListener('click',()=>copy(reference));
  const renderRelated=()=>{
    const rank=asset=>Number(asset.path===file.path)*100 + Number(asset.path.includes('/Final/'))*50 + Number(['glb','gltf','fbx','obj'].includes(asset.extension))*20 + Number(canPreview(asset))*5 - Number(/\/_qa\/|\/qa\//i.test(asset.path))*10;
    const matches=searchFiles(related,$('related-search').value).sort((a,b)=>rank(b)-rank(a)||a.path.localeCompare(b.path));
    $('related-list').innerHTML=matches.slice(0,relatedLimit).map(asset=>`<div class="related-file ${asset.path===file.path?'selected':''}"><button data-file="${esc(asset.path)}" title="${esc(asset.path)}">${esc(asset.name)}<small>${esc(asset.path.split('/').slice(0,-1).join('/'))}</small></button><a href="${esc(asset.url)}" download aria-label="${esc(asset.name)} 다운로드">↓</a></div>`).join('');
    $('related-more').hidden=matches.length<=relatedLimit;
  };
  $('related-search').addEventListener('input',()=>{relatedLimit=50;renderRelated();});
  $('related-more').addEventListener('click',()=>{relatedLimit+=50;renderRelated();});renderRelated();
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;
  const host=$('model-preview-host');
  const preparing=startLoading(host.querySelector('.initial-loading'),signal);
  preparing.update('미리보기 준비 중…','뷰어에 연결하는 중…');
  try {
    if(['glb','gltf','fbx','obj','anim'].includes(file.extension)) {
      const module=await import('./skyhaven-viewer.mjs');
      if(signal.aborted)return;
      preparing.finish();
      const folder=catalog.folders.find(folder=>folder.id===file.folderId);
      const dispose=await module.createViewer({host,file,folder,folders:catalog.folders,signal,character});
      if(signal.aborted||generation!==version)dispose();else cleanup=dispose;
      // Advanced inspection remains available without occupying the main preview.
      if(!signal.aborted){const tools=host.querySelector('.viewer-tools'), pickers=host.querySelector('.animation-pickers');if(tools||pickers){const details=document.createElement('details');details.className='advanced-viewer';details.innerHTML='<summary>3D 상세 설정</summary>';if(tools)details.append(tools);if(pickers)details.append(pickers);host.append(details);}}
    } else if(file.kind==='image')host.innerHTML=`<img src="${esc(file.url)}" alt="${esc(file.name)}" class="full-preview">`;
    else if(file.kind==='video')host.innerHTML=`<video src="${esc(file.url)}" controls autoplay loop playsinline class="full-preview"></video>`;
    else if(file.kind==='audio')host.innerHTML=`<div class="audio-preview"><span>♫</span><audio src="${esc(file.url)}" controls autoplay></audio></div>`;
    else if(['md','txt','json','jsonl','csv','yaml','yml','cs','py'].includes(file.extension)&&file.size<512000){const response=await fetch(file.url,{signal});if(!response.ok)throw new Error('문서를 읽을 수 없습니다.');const text=await response.text();if(!signal.aborted)host.innerHTML=`<pre class="document-preview">${esc(text)}</pre>`;}
    else host.innerHTML=`<div class="unavailable"><span>▧</span><h3>${esc(file.extension.toUpperCase())} 원본 파일</h3><p>이 형식은 원본 앱에서 열 수 있습니다. 오른쪽에서 파일을 내려받거나 관련 렌더·모델을 선택하세요.</p></div>`;
  } catch(error) {if(!signal.aborted)host.innerHTML=`<div class="unavailable"><h3>미리보기를 열 수 없습니다.</h3><p>${esc(error.message)}</p><p>원본 다운로드와 관련 파일을 사용할 수 있습니다.</p></div>`;}
  finally{preparing.finish();}
}
function route() {
  const hash=location.hash.slice(1)||'home';
  if(hash==='polygon'||hash.startsWith('polygon/')){if(dialog.open)dialog.close();category='polygon';render();return;}
  if(hash.startsWith('file/')) {
    if(!index)return;
    let file;try{file=index.byPath.get(decodeURIComponent(hash.slice(5)));}catch{}
    if(file){if(!categoryInfo(category))category=file.category;render();preview(file);}else {toast('파일이 이동되었거나 현재 폴더에 없습니다.');if(dialog.open)dialog.close();category='files';render();}
    return;
  }
  if(dialog.open)dialog.close();
  category=categories.some(item=>item.id===hash)||hash==='agents'?hash:'home';limit=60;render();
}
async function refresh(announce=false) {
  if($('refresh').disabled)return;
  $('refresh').disabled=true;
  try {
    const response=await fetch(API,{cache:'no-store'});if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const next=await response.json();if(!Array.isArray(next.folders))throw new Error('리소스 목록 형식 오류');
    const hadIndex=!!index;
    catalog=next;index=buildIndex(next);lastRefresh=Date.now();
    const active=next.motionTaxonomy?.categories.find(c=>c.id===motionCategory);
    if(!active){motionCategory='all';motionSubcategory='all';}
    else if(!active.children.some(s=>s.id===motionSubcategory))motionSubcategory='all';
    $('search').value=query;
    $('scan-time').textContent=`${index.files.length.toLocaleString()} files · ${new Date(next.scannedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})} 업데이트`;
    if(!hadIndex)route();else render();
    if(next.issues.length)toast(next.issues.join(' · '));else if(announce)toast('폴더의 최신 리소스를 가져왔습니다.');
  } catch(error) {toast(`폴더를 불러올 수 없습니다. ${error.message}`);if(!index)$('main').innerHTML='<div class="empty"><h2>리소스 폴더에 연결할 수 없습니다.</h2><p>호스트 폴더를 확인하고 새로고침하세요.</p></div>';}
  finally{$('refresh').disabled=false;}
}
document.addEventListener('click',event=>{
  const gameButton=event.target.closest('[data-game]');
  if(gameButton){game=gameButton.dataset.game;pack='';directory='';changeFilters();return;}
  const motionButton=event.target.closest('[data-motion-category]');if(motionButton){motionCategory=motionButton.dataset.motionCategory;motionSubcategory='all';changeFilters();return;}
  const subButton=event.target.closest('[data-motion-subcategory]');if(subButton){motionSubcategory=subButton.dataset.motionSubcategory;changeFilters();return;}
  const fileButton=event.target.closest('[data-file]');
  if(fileButton){const hash='file/'+encodeURIComponent(fileButton.dataset.file);if(location.hash.slice(1)===hash)preview(index.byPath.get(fileButton.dataset.file));else location.hash=hash;return;}
  const navigationLink=event.target.closest('a[href^="#"]');
  if(navigationLink&&['home','agents',...categories.map(item=>item.id)].includes(navigationLink.hash.slice(1))){query='';$('search').value='';if(navigationLink.hash!=='#animations'){motionCategory='all';motionSubcategory='all';pack='';directory='';format='all';}saveFilters();if(location.hash===navigationLink.hash)route();}
});
$('refresh').addEventListener('click',()=>{if(category==='polygon')void polygon.render({refresh:true});else void refresh(true);});
$('search').addEventListener('input',event=>{query=event.target.value;if(category==='polygon'){saveFilters();polygon.search(query);return;}if(!categoryInfo(category))category='files';changeFilters();});
$('close-preview').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{stopPreview();$('preview-body').innerHTML='';if(location.hash.startsWith('#file/'))location.hash=category;});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!dialog.open&&!['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName)){event.preventDefault();$('search').focus();}});
window.addEventListener('hashchange',route);
window.addEventListener('focus',()=>{if(Date.now()-lastRefresh>60000)refresh();});
setInterval(()=>{if(!document.hidden&&!dialog.open&&Date.now()-lastRefresh>60000)refresh();},60000);
refresh();
