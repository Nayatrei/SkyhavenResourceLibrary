export const OWNED_API='/comfy/skyhaven/api/library/owned-assets';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function ownedFilters(url){
  const p=new URL(url).searchParams;
  return {style:p.get('ownedStyle')||'',category:p.get('ownedCategory')||'',hidden:p.get('ownedHidden')==='1'};
}
export function filterOwned(data,{query='',style='',category='',hidden=false}={}){
  const labels=new Map(data.styles.map(s=>[s.id,s.label]));
  const words=query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return data.assets.filter(a=>(hidden||!a.hidden)&&(!style||a.styles.includes(style))&&(!category||a.category===category)
    &&words.every(word=>[a.id,a.name,a.publisher,a.source||'Unity My Assets',a.category,...a.styles.map(s=>labels.get(s)||s),...a.contents.items].join(' ').toLocaleLowerCase().includes(word)));
}
export function ownedRow(a,data){
  const labels=new Map(data.styles.map(s=>[s.id,s.label]));
  const details=[...(a.styleEvidence.sources||[]),...(a.contents.sources||[])];
  const links=[...new Map(details.map(s=>[s.url,s])).values()];
  return `<tr><td data-label="에셋"><strong>${esc(a.name)}</strong><small>${esc(a.publisher)} · ${esc(a.source||'Unity My Assets')} · #${esc(a.id)}${a.hidden?' · 숨김':''}</small></td><td data-label="스타일"><span>${a.styles.map(s=>esc(labels.get(s)||s)).join(' · ')}</span><small>${esc(data.styleEvidenceLabels[a.styleEvidence.level]||'미분류')}</small></td><td data-label="포함 내용"><ul>${(a.contents.items.length?a.contents.items:['상세 구성 미확인']).map(item=>`<li>${esc(item)}</li>`).join('')}</ul><small>${esc(data.contentsEvidenceLabels[a.contents.level]||'상세 구성 미확인')}</small><details><summary>근거</summary><p>${esc(a.contents.reason)}</p><p>스타일: ${esc(a.styleEvidence.reason)}</p>${links.map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noreferrer">출처 ↗</a>`).join(' ')}</details></td><td data-label="분류">${esc(a.category)}</td><td data-label="제품"><a href="${esc(a.storeUrl)}" target="_blank" rel="noreferrer">${a.source==='Fab'?'Fab 제품':'스토어 검색'} ↗</a></td></tr>`;
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
    page=Math.max(0,Math.min(page,Math.ceil(rows.length/pageSize)-1));
    const options=(items,value)=>items.map(([id,label])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(label)}</option>`).join('');
    host.innerHTML=`<section class="owned-assets"><div class="library-heading"><h1>보유 에셋</h1><p>스타일과 포함 내용을 에셋별로 확인하세요.</p></div><p class="owned-summary">${esc(data.snapshotDate)} · ${Object.entries(data.sourceCounts||{'Unity My Assets':data.counts.total}).map(([name,count])=>`${esc(name)} ${count.toLocaleString()}개`).join(' · ')} · 일반 ${data.counts.visible.toLocaleString()}개 + 숨김 ${data.counts.hidden}개. 제품명 기준 요약은 세부 파일 검사와 구분합니다.</p><div class="owned-filters"><label>스타일<select id="owned-style">${options([['','모든 스타일'],...data.styles.map(s=>[s.id,s.label])],filters.style)}</select></label><label>분류<select id="owned-category">${options([['','모든 분류'],...Object.keys(data.categories||{}).sort().map(s=>[s,s])],filters.category)}</select></label><label class="owned-checkbox"><input id="owned-hidden" type="checkbox" ${filters.hidden?'checked':''}>숨긴 에셋 포함</label><button id="owned-reset" class="button ghost">필터 초기화</button></div><p class="owned-count" role="status">${rows.length.toLocaleString()}개 결과 <span>보유 ≠ 설치·실행 검증</span></p><div class="owned-table-wrap"><table class="owned-table"><thead><tr><th>에셋 / 제작사</th><th>스타일</th><th>포함 모델·소품·기능</th><th>분류</th><th>제품</th></tr></thead><tbody>${rows.slice(page*pageSize,(page+1)*pageSize).map(a=>ownedRow(a,data)).join('')}</tbody></table></div>${rows.length?`<div class="owned-paging"><button id="owned-prev" class="button ghost" ${page?'':'disabled'}>이전</button><span>${page+1} / ${Math.ceil(rows.length/pageSize)}</span><button id="owned-next" class="button ghost" ${(page+1)*pageSize>=rows.length?'disabled':''}>다음</button></div>`:'<p class="empty">조건에 맞는 에셋이 없습니다.</p>'}</section>`;
    host.querySelector('#owned-style').onchange=e=>setFilter('ownedStyle',e.target.value);
    host.querySelector('#owned-category').onchange=e=>setFilter('ownedCategory',e.target.value);
    host.querySelector('#owned-hidden').onchange=e=>setFilter('ownedHidden',e.target.checked?'1':'');
    host.querySelector('#owned-reset').onclick=()=>{const u=new URL(getURL());for(const k of ['ownedStyle','ownedCategory','ownedHidden'])u.searchParams.delete(k);replaceURL(u);page=0;draw();};
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
