// The command interface decorates catalog metadata; it never invents asset art.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const commandCategories=[
  ['characters','캐릭터','CHARACTERS','그룹별 캐릭터와 모든 형태'],
  ['animations','애니메이션','MOTIONS','내 캐릭터에 모션을 입혀 비교'],
  ['environments','배경·프랍','ENVIRONMENTS','팩에서 씬과 개별 소품까지'],
  ['companions','비인간형','CREATURES','동물·크리처와 연결된 자료'],
];
const inGame=(entry,game)=>game==='all'||entry.game===game;
export function categoryEntry(data,id,game='all'){
  const kind=id==='animations'?'characters':id;
  return data.entities.find(e=>e.category===kind&&inGame(e,game)&&(e.cover?.url||e.variants?.some(v=>v.thumbnail?.ready)))
    ||data.packs.find(p=>(p.sections||[p.category]).includes(kind)&&inGame(p,game)&&p.cover?.url);
}
export function categoryImage(entry){
  return entry?.cover?.url||entry?.variants?.find(v=>v.thumbnail?.ready)?.thumbnail.url;
}
export function commandImage(entry,{hosted=false,className='',alt='',eager=false}={}){
  const url=categoryImage(entry);
  return url?`<img class="${esc(className)}" ${hosted?'data-live-src':'src'}="${esc(url)}" alt="${esc(alt)}" ${eager?'fetchpriority="high"':'loading="lazy"'}>`:'<span class="command-no-image" aria-hidden="true">◇</span>';
}
export function categoryCount(data,id,game='all'){
  if(id==='animations')return data.motionCount;
  return data.entities.filter(e=>e.category===id&&inGame(e,game)).length+data.packs.filter(p=>(p.sections||[p.category]).includes(id)&&inGame(p,game)).length;
}
export function commandNavigation(data,{active='',game='all',hosted=false}={}){
  return `<a class="command-home-link ${active==='home'?'active':''}" href="#home" ${active==='home'?'aria-current="page"':''}><span aria-hidden="true">⌖</span> 라이브러리 본부</a>`+commandCategories.map(([id,title,,note])=>`<a class="nav-item command-category ${active===id?'active':''}" href="#${id}" ${active===id?'aria-current="page"':''} title="${esc(note)}"><span class="nav-thumbnail">${commandImage(categoryEntry(data,id,game),{hosted})}</span><span class="nav-category-title">${title}<small>${categoryCount(data,id,game).toLocaleString()} ${id==='animations'?'모션':'컬렉션'}</small></span><b aria-hidden="true">›</b></a>`).join('');
}
export function commandOverview(data,{game='all',hosted=false}={}){
  const packs=data.packs.filter(p=>(p.sections||[p.category]).includes('environments')&&inGame(p,game)&&p.cover?.url);
  const scene=packs.find(p=>p.group==='DETAILED'&&p.availability==='local')||packs[0];
  const featured=data.entities.filter(e=>e.category==='characters'&&inGame(e,game)).slice(0,5);
  return `<section class="command-overview"><header class="command-page-title"><div><p class="eyebrow">RESOURCE COMMAND</p><h1>당신의 월드, 한곳에서.</h1></div><p>컬렉션을 고르고 · 미리보고 · 경로를 가져가세요.</p></header><div class="command-hero command-frame">${scene?commandImage(scene,{hosted,className:'command-hero-image',alt:scene.name+' 팩 대표 이미지',eager:true}):''}<div class="command-hero-shade"></div><div class="command-hero-copy"><span class="command-kicker">YOUR WORLD, CONNECTED</span><h2>다음 장면을<br>만들 준비.</h2><p>캐릭터부터 배경까지,<br>쌓아둔 리소스를 바로 꺼내 쓰세요.</p><a class="button primary" href="#environments${scene?'/pack/'+encodeURIComponent(scene.id):''}">${scene?'배경 팩 살펴보기':'배경·프랍 열기'} <span aria-hidden="true">↗</span></a></div>${scene?`<div class="command-scene-label"><span>PACK PREVIEW</span><strong>${esc(scene.name)}</strong><small>${esc(scene.cover.source||'기존 팩 대표 이미지')}</small></div>`:''}<p class="command-offline-caption">원본 서버가 연결되면 팩 대표 이미지가 표시됩니다.</p></div><div class="command-section-title"><h2>컬렉션 선택</h2><span>CHOOSE YOUR COLLECTION</span></div><div class="command-category-grid">${commandCategories.map(([id,title,en,note])=>`<a class="command-category-tile command-frame" href="#${id}"><div class="command-category-art ${id}">${commandImage(categoryEntry(data,id,game),{hosted,alt:title+' 컬렉션'})}<span class="command-tile-count">${categoryCount(data,id,game).toLocaleString()}</span></div><div class="command-tile-label"><p>${en}</p><h3>${title} <span aria-hidden="true">↗</span></h3><small>${note}</small></div></a>`).join('')}</div>${featured.length?`<section class="command-featured"><div class="command-section-title"><h2>캐릭터 로스터</h2><a href="#characters">전체 캐릭터 보기 ↗</a></div><div class="command-featured-grid">${featured.map(e=>`<a href="#characters/${encodeURIComponent(e.id)}" class="command-featured-card">${commandImage(e,{hosted,alt:e.name})}<span><strong>${esc(e.name)}</strong><small>${esc(e.group)}</small></span></a>`).join('')}</div></section>`:''}<a class="command-owned-link" href="#owned"><span><strong>보유 에셋 보관소</strong><small>Unity · Fab에서 보유한 에셋을 분야·스타일·설치 프로젝트로 검색</small></span><b aria-hidden="true">↗</b></a></section>`;
}
