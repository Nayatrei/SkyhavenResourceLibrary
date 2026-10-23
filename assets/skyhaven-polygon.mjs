export const LIB_BASE = '/comfy/skyhaven/files/PolygonLibrary/';
export const libraryUrl = path => LIB_BASE + String(path).split('/').map(encodeURIComponent).join('/');
export const libraryHash = (pack='',category='') => '#polygon'+(pack?'/'+encodeURIComponent(pack)+(category?'/'+encodeURIComponent(category):''):'');
export function libraryRoute(hash) {
  try { const [,pack='',category=''] = hash.replace(/^#/,'').split('/'); return {pack:decodeURIComponent(pack),category:decodeURIComponent(category)}; }
  catch { return {pack:'',category:''}; }
}
export const defaultFilters = () => ({q:'',pack:'',cat:'',min:'',max:'',used:false,flagged:false,listed:false});
export function filterLibrary(data,filters,scope={}) {
  const words=filters.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return data.items.filter(item => (!(scope.pack||filters.pack)||item.p===(scope.pack||filters.pack))
    && (!(scope.category||filters.cat)||item.c===(scope.category||filters.cat))
    && (item.st!=='flagged'||filters.flagged)
    && (!['fx','other','empty'].includes(item.st)||filters.listed||scope.category)
    && (!filters.used||item.u?.length)
    && (filters.min===''||(item.t!=null&&item.t>=Number(filters.min)))
    && (filters.max===''||(item.t!=null&&item.t<=Number(filters.max)))
    && words.every(word=>(item.n+' '+item.c+' '+item.p+' '+(data.packs.find(pack=>pack.pack===item.p)?.title||'')).toLowerCase().includes(word)));
}
export function atlasCell(data,item) {
  if(!Array.isArray(item.h))return null;
  const atlas=data.atlases[item.h[0]],cell=data.cell||360;
  if(!atlas)return null;
  return {url:libraryUrl(atlas.path),style:`background-size:${atlas.w/cell*100}% ${atlas.h/cell*100}%;background-position:${atlas.w>cell?item.h[1]/(atlas.w-cell)*100:0}% ${atlas.h>cell?item.h[2]/(atlas.h-cell)*100:0}%`};
}

export function createPolygonLibrary({host,dialog,esc,copy,isActive,browse,stopPreview,onCount,fetchImpl=globalThis.fetch}) {
  let data,loading,observer,limit=120,routeKey='',detailVersion=0,timer;
  let filters=defaultFilters();
  const packs=new Map(),packLoads=new Map();
  const $=id=>document.getElementById(id);
  const packFor=id=>data.packs.find(pack=>pack.pack===id);
  const active=()=>Object.values(filters).some(Boolean);
  const status={fx:'FX · 목록 전용',other:'메시 없음 · 목록 전용',empty:'빈 프리팹',flagged:'확인 필요',pending:'렌더 대기',failed:'렌더 실패'};
  const size=value=>value?.length?value.map(n=>Number(n).toFixed(2)).join(' × ')+' m':'—';
  async function json(path) {
    const response=await fetchImpl(libraryUrl(path),{cache:'no-store'});
    if(!response.ok)throw new Error(`라이브러리를 읽지 못했습니다 (HTTP ${response.status}).`);
    return response.json();
  }
  async function load() {
    if(data)return data;
    if(!loading)loading=json('index.json').then(value=>{
      if(!Array.isArray(value.items)||!Array.isArray(value.packs))throw new Error('POLYGON 목록 형식 오류');
      data=value;onCount(data.items.length);return data;
    }).catch(error=>{loading=null;throw error;});
    return loading;
  }
  function cell(item,eager=false) {
    const tile=atlasCell(data,item);
    return tile?`<span class="lib-cell" role="img" aria-label="${esc(item.n)}" style="${tile.style}${eager?`;background-image:url('${esc(tile.url)}')`:''}" ${eager?'':`data-bg="${esc(tile.url)}"`}></span>`:`<span class="lib-none">${esc(status[item.st]||'미리보기 없음')}</span>`;
  }
  function observe() {
    observer?.disconnect();
    const reveal=el=>{el.style.backgroundImage=`url('${el.dataset.bg}')`;el.removeAttribute('data-bg');};
    const cells=host.querySelectorAll('.lib-cell[data-bg]');
    if(!globalThis.IntersectionObserver){cells.forEach(reveal);return;}
    observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){reveal(entry.target);observer.unobserve(entry.target);}},{rootMargin:'400px 0px'});
    cells.forEach(el=>observer.observe(el));
  }
  const copyButton=text=>`<button class="lib-mini" data-lib="copy" data-text="${esc(text)}">복사</button>`;
  const pathRow=(label,path)=>`<div class="lib-path"><dt><span>${esc(label)}</span>${copyButton(path)}</dt><dd class="folder-path">${esc(path)}</dd></div>`;
  const command=text=>text?`<div class="lib-cmd"><code>${esc(text)}</code>${copyButton(text)}</div>`:'';
  function pathLink(path,label=path,workspace='') {
    return `<div class="lib-row"><span class="folder-path">${esc(label)}</span>${copyButton(path)}${workspace?`<button class="lib-mini" data-lib="browse" data-path="${esc(workspace)}">파일 보기</button>`:''}</div>`;
  }
  function controls(scope) {
    const categories=(scope.pack||filters.pack)?packFor(scope.pack||filters.pack)?.categories.map(c=>c.name)||[]:[...new Set(data.packs.flatMap(p=>p.categories.map(c=>c.name)))].sort();
    return `<div class="lib-filters"><label class="lib-search">프리팹 검색<input id="lib-search" type="search" placeholder="barn, chair, fence…" value="${esc(filters.q)}"></label>${scope.pack?'':`<label>팩<select id="lib-pack"><option value="">모든 팩</option>${data.packs.map(p=>`<option value="${esc(p.pack)}" ${filters.pack===p.pack?'selected':''}>${esc(p.title)} (${p.count})</option>`).join('')}</select></label>`}${scope.category?'':`<label>카테고리<select id="lib-cat"><option value="">모든 카테고리</option>${categories.map(c=>`<option ${filters.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label>`}<label>최소 tris<input id="lib-min" type="number" min="0" value="${esc(filters.min)}"></label><label>최대 tris<input id="lib-max" type="number" min="0" value="${esc(filters.max)}"></label>${[['used','Skyhaven 사용 중'],['listed','FX / 메시 없는 항목'],['flagged','확인 필요 항목']].map(([key,label])=>`<label class="lib-check"><input id="lib-${key}" type="checkbox" ${filters[key]?'checked':''}>${label}</label>`).join('')}<button class="button ghost" data-lib="clear">필터 초기화</button></div>`;
  }
  function tile(item) {
    return `<button class="lib-tile" data-lib="item" data-key="${esc(item.k)}" title="${esc(item.k)}"><span class="lib-thumb">${cell(item)}</span><strong class="lib-name">${esc(item.n.replace(/^SM_/,''))}</strong><span class="lib-meta">${item.t!=null?`${item.t.toLocaleString()} tris · ${esc(size(item.s))}`:esc(status[item.st]||'')}</span><span class="lib-meta">${esc(packFor(item.p)?.title||item.p)} · ${esc(item.c)}</span><span class="lib-tags">${item.u?.length?'<span class="lib-tag">Skyhaven</span>':''}${item.st==='flagged'?'<span class="lib-tag flag">확인 필요</span>':''}</span></button>`;
  }
  function results(scope) {
    const items=filterLibrary(data,filters,scope);
    let grid;
    if(scope.pack&&!active()){
      let shown=0;
      grid=packFor(scope.pack).categories.filter(c=>!scope.category||c.name===scope.category).map(cat=>{
        const matches=items.filter(item=>item.c===cat.name),slice=matches.slice(0,Math.max(0,limit-shown));shown+=slice.length;
        return slice.length?`<div class="lib-section"><h2>${esc(cat.name)}</h2><span>${matches.length} prefabs</span><a class="lib-mini" href="${libraryHash(scope.pack,cat.name)}">카테고리 열기</a><span class="folder-path">Resources/${esc(cat.folder)} ${copyButton(data.resources+'/'+cat.folder)}</span></div><div class="lib-grid">${slice.map(tile).join('')}</div>`:'';
      }).join('');
    }else grid=`<div class="lib-grid">${items.slice(0,limit).map(tile).join('')}</div>`;
    return `<p class="lib-count" role="status">${items.length.toLocaleString()}개 프리팹 · ${Math.min(limit,items.length)}개 표시</p>${items.length?grid:'<div class="empty"><h2>조건에 맞는 프리팹이 없습니다.</h2><p>검색어나 필터를 바꿔보세요.</p></div>'}${items.length>limit?'<button class="button ghost show-more" data-lib="more">120개 더 보기 ↓</button>':''}`;
  }
  function overview() {
    const used=(data.skyhaven||[]).map(scene=>`<section class="lib-panel"><h3>${esc(scene.title)}</h3><p>${esc(scene.status)}</p><button class="lib-mini" data-lib="used">${data.items.filter(item=>item.u?.includes(scene.id)).length}개 사용 프리팹 보기</button>${scene.links.map(link=>`<div class="lib-link"><span>${esc(link.label)}</span>${pathLink(link.path,link.path,link.workspace||'')}</div>`).join('')}</section>`).join('');
    const cards=data.packs.map(pack=>{const cover=pack.categories.filter(cat=>cat.sheets.length).sort((a,b)=>b.count-a.count)[0]?.sheets[0];return `<a class="lib-pack" href="${libraryHash(pack.pack)}">${cover?`<img class="lib-cover" src="${esc(libraryUrl(cover))}" alt="${esc(pack.title)} 컨택트 시트" loading="lazy">`:''}<span class="lib-pack-body"><span class="eyebrow">${esc(pack.group)}</span><h3>${esc(pack.title)}</h3><span>${pack.count.toLocaleString()} prefabs · ${pack.categories.length} categories</span><span class="folder-path">Resources/${esc(pack.prefabs)}</span></span></a>`;}).join('');
    return `<div class="page-heading"><p class="eyebrow">SYNTY POLYGON / RESOURCE LIBRARY</p><h1>POLYGON Library</h1><p class="subtitle">${data.totals.items.toLocaleString()}개 프리팹 · ${data.packs.length}개 팩 · ${data.totals.thumbs.toLocaleString()}개 썸네일</p></div><dl class="lib-paths">${pathRow('Resources Unity 프로젝트',data.resources)}${pathRow('Converter',data.converter)}${pathRow('라이브러리 재빌드 명령',data.rebuild)}</dl><h2>Skyhaven 사용처</h2><div class="lib-used">${used}</div>${controls({})}<div id="lib-results">${active()?results({}):`<div class="lib-packs">${cards}</div>`}</div><p class="lib-note">${esc(data.licence)}</p>`;
  }
  function packPage(scope) {
    const pack=packFor(scope.pack),category=pack?.categories.find(cat=>cat.name===scope.category);
    if(!pack||scope.category&&!category)return '<div class="empty"><h2>팩 또는 카테고리를 찾을 수 없습니다.</h2><a href="#polygon">전체 팩으로</a></div>';
    const sheets=pack.categories.filter(cat=>!scope.category||cat.name===scope.category).flatMap(cat=>cat.sheets.map(path=>({path,category:cat.name})));
    return `<div class="page-heading"><p class="eyebrow"><a href="#polygon">POLYGON Library</a> / <a href="${libraryHash(pack.pack)}">${esc(pack.title)}</a></p><h1>${esc(category?.name||pack.title)}</h1><p class="subtitle">${(category?.count??pack.count).toLocaleString()} prefabs · ${pack.thumbs.toLocaleString()} thumbnails</p></div><dl class="lib-paths">${pathRow('팩 루트',data.resources+'/'+pack.root)}${pathRow('Resources/'+(category?.folder||pack.prefabs),data.resources+'/'+(category?.folder||pack.prefabs))}</dl><p class="lib-note">${esc(pack.licence.shipping)}<br>${esc(pack.licence.redistribution)}</p><div class="lib-chips"><a class="lib-chip ${scope.category?'':'active'}" href="${libraryHash(pack.pack)}">전체 · ${pack.count}</a>${pack.categories.map(cat=>`<a class="lib-chip ${scope.category===cat.name?'active':''}" href="${libraryHash(pack.pack,cat.name)}">${esc(cat.name)} · ${cat.count}</a>`).join('')}</div><h2>컨택트 시트</h2><div class="lib-sheets">${sheets.map(sheet=>`<button class="lib-sheet" data-lib="sheet" data-sheet="${esc(sheet.path)}" data-label="${esc(pack.title+' · '+sheet.category)}"><img src="${esc(libraryUrl(sheet.path))}" alt="${esc(sheet.category)}" loading="lazy"><span>${esc(sheet.category)}</span></button>`).join('')}</div>${controls(scope)}<div id="lib-results">${results(scope)}</div>`;
  }
  function draw(resultsOnly=false) {
    if(!isActive()||!data)return;
    const scope=libraryRoute(location.hash),focused=document.activeElement?.id;
    if(resultsOnly&&$('lib-results')&&(scope.pack||active()))$('lib-results').innerHTML=results(scope);
    else {host.innerHTML=scope.pack?packPage(scope):overview();bindFilters();if(focused?.startsWith('lib-'))$(focused)?.focus();}
    observe();
  }
  function bindFilters() {
    for(const [id,key] of [['search','q'],['pack','pack'],['cat','cat'],['min','min'],['max','max'],['used','used'],['listed','listed'],['flagged','flagged']]){
      const input=$('lib-'+id);if(!input)continue;
      input.addEventListener(input.type==='search'||input.type==='number'?'input':'change',()=>{
        filters[key]=input.type==='checkbox'?input.checked:input.value;if(id==='pack')filters.cat='';limit=120;clearTimeout(timer);
        if(input.type==='search'||input.type==='number')timer=setTimeout(()=>draw(true),110);else draw();
      });
    }
  }
  async function render({refresh=false,query}={}) {
    const key=location.hash;
    if(routeKey!==key){routeKey=key;limit=120;filters=defaultFilters();}
    if(query!==undefined)filters.q=query;
    if(refresh){data=null;loading=null;packs.clear();packLoads.clear();}
    observer?.disconnect();
    if(data){draw();return;}
    host.innerHTML='<div class="loading" role="status">POLYGON 라이브러리를 불러오는 중…</div>';
    try{await load();draw();}catch(error){
      if(!isActive())return;
      host.innerHTML=`<div class="empty"><h2>라이브러리 연결 오류</h2><p>${esc(error.message)}</p><button class="button" data-lib="retry">다시 시도</button></div>`;
    }
  }
  function openDialog(title) {
    stopPreview();dialog.classList.add('library-modal');$('preview-files').hidden=true;$('preview-files').innerHTML='';$('preview-title').textContent=title;
    if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
  }
  async function openItem(key) {
    const item=data.items.find(entry=>entry.k===key);if(!item)return;
    const version=++detailVersion;openDialog(item.n);$('preview-body').innerHTML='<p class="viewer-status">팩 상세 정보를 읽는 중…</p>';
    try{
      if(!packLoads.has(item.p))packLoads.set(item.p,json('packs/'+item.p+'.json').then(value=>{packs.set(item.p,value);return value;}).catch(error=>{packLoads.delete(item.p);throw error;}));
      const record=(packs.get(item.p)||await packLoads.get(item.p)).items[key];
      if(version!==detailVersion||!dialog.open)return;
      if(!record)throw new Error('프리팹 상세 정보를 찾을 수 없습니다.');
      const paths=(values)=>values.map(path=>pathLink(record.resourcesProject+'/'+path,path)).join('')||'—';
      const used=record.usedIn.map(use=>`<section class="lib-panel"><h3>${esc(use.project)} · ${esc(use.scene)}</h3><p>${esc(use.note||'')} · ${use.count}회 사용</p>${(use.keys||[]).map(key=>`<p class="folder-path">${esc(key)}</p>`).join('')}${pathLink(use.file)}${use.app?pathLink(use.app):''}${use.handoff?pathLink(use.handoff):''}</section>`).join('');
      const c=record.commands;
      $('preview-body').innerHTML=`<div class="lib-detail"><div><div class="lib-detail-img">${cell(item,true)}</div><p class="lib-note">${esc(record.pose||'원본 포즈')} · ${esc(record.flag||'')}${record.warnings.map(w=>'<br>'+esc(w)).join('')}</p></div><div><h3>Item</h3><dl class="lib-kv"><dt>ctu id</dt><dd>${pathLink(record.id)}</dd><dt>Pack</dt><dd><a href="${libraryHash(record.pack)}">${esc(record.packTitle)}</a></dd><dt>Category</dt><dd><a href="${libraryHash(record.pack,record.category)}">${esc(record.category)}</a></dd><dt>Kind / status</dt><dd>${esc(record.kind)} · ${esc(record.status)}</dd><dt>Triangles</dt><dd>${record.tris?.toLocaleString()??'—'}</dd><dt>Size (W × D × H)</dt><dd>${esc(size(record.size))}</dd><dt>GUID</dt><dd class="folder-path">${esc(record.guid)}</dd></dl><h3>Locations</h3>${pathRow('Resources project',record.resourcesProject)}${pathRow('Prefab',record.prefab)}${pathRow('Prefab folder',record.prefabFolder)}${record.characterFbx?pathRow('Character FBX',record.characterFbx):''}<h4>Models</h4>${paths(record.models)}<h4>Textures</h4>${paths(record.textures)}<h4>Materials</h4>${paths(record.materials.map(m=>m.path||m.name))}<h3>Used in</h3>${used||'<p class="lib-note">현재 조사된 Skyhaven 씬에서 사용 기록이 없습니다.</p>'}<h3>Converter commands</h3>${command('cd "'+c.cwd+'"')}${command(c.search)}${command(c.convert)}${command(c.install)}${command(c.unityThumbnail)}<p class="lib-note">명령은 복사해서 해당 Mac 프로젝트에서 실행하세요. 이 페이지는 명령을 실행하지 않습니다.</p><h3>Licence</h3><p class="lib-note">${esc(record.licence.vendor)} · ${esc(record.licence.product)}<br>${esc(record.licence.shipping)}<br>${esc(record.licence.redistribution)}</p></div></div>`;
    }catch(error){if(version===detailVersion&&dialog.open)$('preview-body').innerHTML=`<p class="lib-note">${esc(error.message)}</p>`;}
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-lib]');if(!button)return;
    switch(button.dataset.lib){
      case 'item':void openItem(button.dataset.key);break;
      case 'sheet':openDialog(button.dataset.label);$('preview-body').innerHTML=`<div class="lib-sheet-view"><img src="${esc(libraryUrl(button.dataset.sheet))}" alt="${esc(button.dataset.label)}"></div>`;break;
      case 'copy':void copy(button.dataset.text);break;
      case 'browse':if(dialog.open)dialog.close();browse(button.dataset.path);break;
      case 'more':limit+=120;draw(true);break;
      case 'clear':filters=defaultFilters();limit=120;draw();break;
      case 'used':filters.used=true;limit=120;draw();break;
      case 'retry':void render();break;
    }
  });
  dialog.addEventListener('close',()=>{detailVersion++;dialog.classList.remove('library-modal');$('preview-files').hidden=false;});
  return {render,search:q=>{filters.q=q;limit=120;draw();},deactivate:()=>{observer?.disconnect();clearTimeout(timer);},get count(){return data?.items.length;}};
}
