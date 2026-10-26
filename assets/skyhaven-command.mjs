// UI symbols and catalog artwork have separate roles. Asset pictures stay at source.
export const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const commandCategories=[['characters','Characters','helmet'],['animations','Animations','run'],['environments','Environments','mountain'],['companions','Creatures','paw']];
const paths={
 castle:'M4 2h4v3h2V2h4v3h2V2h4v7l-2 2 1 10H5l1-10-2-2V2Zm5 12v7h6v-7H9ZM8 8h2v3H8V8Zm6 0h2v3h-2V8Z',
 cube:'m12 2 10 5.5v10L12 23 2 17.5v-10L12 2Zm0 2.5L5 8l7 3.6L19 8l-7-3.5Zm-8 5.3v6.5l7 3.9v-6.5L4 9.8Zm9 3.9v6.5l7-3.9V9.8l-7 3.9Z',
 layers:'m12 2 11 6-11 6L1 8l11-6Zm-9 9 9 5 9-5 2 2-11 6L1 13l2-2Zm0 5 9 5 9-5 2 2-11 6-11-6 2-2Z',
 pyramid:'m12 2 5 8H7l5-8ZM6 12h11l5 9H2l4-9Zm6 1-4 7h8l-4-7Z',
 folder:'M2 6h8l2 2h10v13H2V6Zm0-3h8l2 2h9v2H2V3Z',
 search:'M10 2a8 8 0 1 0 4.9 14.3l6 6 1.4-1.4-6-6A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z',
 star:'m12 1 3.4 7 7.6 1.1-5.5 5.4 1.3 7.5-6.8-3.6L5.2 22l1.3-7.5L1 9.1 8.6 8 12 1Z',
 gear:'m10 1 4 0 .7 3 2 .8 2.7-1.5 2.8 2.8L20.7 9l.8 2 3 .7v4l-3 .7-.8 2 1.5 2.7-2.8 2.8-2.7-1.5-2 .8-.7 3h-4l-.7-3-2-.8-2.7 1.5-2.8-2.8 1.5-2.7-.8-2-3-.7v-4l3-.7.8-2L1.3 6.3l2.8-2.8L6.8 5l2-.8.7-3ZM12 8a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
 user:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM5 21v-4c0-3 3-5 7-5s7 2 7 5v4H5Z',
 copy:'M8 1h13v17h-3V4H8V1ZM2 6h13v17H2V6Zm2 2v13h9V8H4Z',
 sliders:'M1 5h5V2h2v3h15v2H8v3H6V7H1V5Zm0 7h14V9h2v3h6v2h-6v3h-2v-3H1v-2Zm0 7h8v-3h2v3h12v2H11v3H9v-3H1v-2Z',
 reset:'M11 1h2v4a8 8 0 0 1 6 6h4v2h-4a8 8 0 0 1-6 6v4h-2v-4a8 8 0 0 1-6-6H1v-2h4a8 8 0 0 1 6-6V1Zm1 6a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
 image:'M2 3h20v18H2V3Zm2 2v14h16V5H4Zm2 12 4-5 3 3 2-2 3 4H6Zm10-6a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
 link:'m9 4 3-3a6 6 0 0 1 8 8l-4 4-2-2 4-4a3 3 0 1 0-4-4l-3 3-2-2Zm6 16-3 3a6 6 0 0 1-8-8l4-4 2 2-4 4a3 3 0 1 0 4 4l3-3 2 2ZM7 15l8-8 2 2-8 8-2-2Z',
 chevron:'m6 9 6 6 6-6-1.5-1.5L12 12l-4.5-4.5L6 9Z',
};
export function commandIcon(name,className=''){
  if(['helmet','run','mountain','paw'].includes(name))return `<span class="rts-symbol rts-symbol-${name} ${className}" aria-hidden="true"></span>`;
  if(name==='dekogon')return '<span class="rts-dekogon-mark" aria-hidden="true">D</span>';
  return `<svg class="rts-icon ${className}" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="${name==='castle'?'evenodd':'nonzero'}" d="${paths[name]||paths.cube}"/></svg>`;
}
export function categoryEntry(data,id,game='all'){
  const kind=id==='animations'?'characters':id,inGame=e=>game==='all'||e.game===game;
  return data.entities.find(e=>e.category===kind&&inGame(e)&&(e.cover?.url||e.variants?.some(v=>v.thumbnail?.ready)))||data.packs.find(p=>(p.sections||[p.category]).includes(kind)&&inGame(p)&&p.cover?.url);
}
export const categoryImage=entry=>entry?.cover?.url||entry?.variants?.find(v=>v.thumbnail?.ready)?.thumbnail.url;
export function commandImage(entry,{hosted=false,className='',alt='',eager=false}={}){
  const url=categoryImage(entry);
  return url?`<img class="${escapeHTML(className)}" ${hosted?'data-live-src':'src'}="${escapeHTML(url)}" alt="${escapeHTML(alt)}" ${eager?'fetchpriority="high"':'loading="lazy"'}>`:'<span class="command-no-image">No source preview</span>';
}
export function categoryCount(data,id,game='all'){
  if(id==='animations')return data.motionCount;
  return data.entities.filter(e=>e.category===id&&(game==='all'||e.game===game)).length+data.packs.filter(p=>(p.sections||[p.category]).includes(id)&&(game==='all'||p.game===game)).length;
}
export function commandNavigation(data,{active='',game='all',group=''}={}){
  const current=active==='home'?'environments':active;
  const groups=current==='characters'||current==='companions'?[...new Set(data.entities.filter(e=>e.category===current&&(game==='all'||e.game===game)).map(e=>e.group))]:['POLYGON','DETAILED','Dekogon'];
  return `<div class="rts-category-nav">${commandCategories.map(([id,title,icon])=>`<a class="nav-item ${current===id?'active':''}" href="#${id}" ${current===id?'aria-current="page"':''}>${commandIcon(icon)}<span>${title}</span></a>`).join('')}</div><div class="rts-family-heading"><span>${current==='characters'||current==='companions'?'GROUPS':'PACKS'}</span><a href="#owned" class="rts-small-button" aria-label="Browse owned asset packs">+</a></div><div class="rts-family-nav"><button data-group="" class="rts-all-families ${!group?'active':''}">All collections</button>${groups.map((name,i)=>{
    const count=data.packs.filter(p=>p.group===name&&(game==='all'||p.game===game)&&(p.sections||[p.category]).includes(current)).length+data.entities.filter(e=>e.category===current&&e.group===name&&(game==='all'||e.game===game)).length;
    return `<button data-group="${escapeHTML(name)}" class="${group===name?'active':''}" ${!count?'title="No local pack indexed; owned products remain in the library menu"':''}>${commandIcon(name==='Dekogon'?'dekogon':i===1?'pyramid':'cube')}<span>${escapeHTML(name)}</span><small>${count||'—'}</small></button>`;
  }).join('')}</div><a class="rts-owned-downloads ${current==='owned'?'active':''}" href="#owned" data-owned-downloads>${commandIcon('folder')}<span>소유 에셋 · Download</span><small>ALL</small></a>`;
}
