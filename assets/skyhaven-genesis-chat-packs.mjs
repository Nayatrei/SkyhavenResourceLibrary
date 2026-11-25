export const reviewViews = ['expressions', 'layers', 'video-pack', 'clip-library'];
const labels = {characters:'인물 원화', backgrounds:'표지·배경', expressions:'표정', layers:'장면 레이어', 'video-pack':'영상 Pack', 'clip-library':'기존 영상'};
const moods = {neutral:'중립', happy:'기쁨', angry:'분노', sad:'슬픔', surprised:'놀람'};
const names = {far:'원경', mid:'중경', near:'근경'};
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const hash = (view, id='') => (view === 'backgrounds' ? '#environments' : '#characters') + '/genesis-chat/' + view + (id ? '/' + encodeURIComponent(id) : '');
export function chatTabs(view, actor='') {
  return '<nav class="character-view-tabs" aria-label="GenesisChat 자료 유형">' + Object.entries(labels).map(([key,label]) =>
    `<a href="${hash(key, ['expressions','layers','video-pack'].includes(key)?actor:'')}" ${key === view ? 'aria-current="page"' : ''}>${label}</a>`).join('') + '</nav>';
}
function safeMedia(value) {
  if (!value) return '';
  const url = new URL(value, 'https://genesischat.online');
  const trusted = (url.origin === 'https://genesischat.online' && url.pathname.startsWith('/content/images/'))
    || (url.origin === 'https://comfy.genesisframeworks.com' && /^\/comfy\/skyhaven\/files\/Library\/Art\/GenesisChat\/PortraitReview\/[a-f0-9]{64}\.(png|webp|webm)$/.test(url.pathname));
  return trusted && !url.search && !url.hash && !url.username && !url.password ? esc(url.href) : '';
}
function still(asset, title) {
  const url = safeMedia(asset?.url);
  return url ? `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${esc(title)}" loading="lazy"></a>` : '<p>자료 미확인</p>';
}
function player(clip, title) {
  const url = safeMedia(clip.url);
  if (!url) return '<p>영상 경로 미확인</p>';
  return `<video controls playsinline preload="none" poster="${safeMedia(clip.poster)}" src="${url}" aria-label="${esc(title)}"></video><a href="${url}" target="_blank" rel="noopener">원본 영상</a>`;
}
function grid(cards) { return '<div class="chat-review-grid">' + cards.join('') + '</div>'; }
function cards(actor, view) {
  if (view === 'expressions') return grid(Object.entries(moods).map(([key,label]) =>
    `<figure><figcaption>${label}</figcaption>${still(actor.expressions[key], actor.name+' · '+label)}</figure>`));
  if (view === 'layers') return grid(Object.entries(names).map(([key,label]) => {
    const layer = actor.layers[key];
    return `<figure><figcaption>${label}</figcaption>${key === 'mid' && layer ? player(layer, actor.name+' · 중경') : still(layer, actor.name+' · '+label)}</figure>`;
  }));
  return ['listening','speaking'].map(activity => {
    const mode = activity === 'listening' ? '듣기' : '말하기';
    return `<h3>${mode} · ${activity === 'listening' ? '6' : '1'}초</h3>` + grid(Object.entries(moods).map(([key,label]) => {
      const state = activity+'-'+key, clip = actor.clips[state];
      return `<figure data-state="${state}"><figcaption>${label} <small lang="en">${state}</small></figcaption>${clip ? player(clip, actor.name+' · '+mode+' · '+label) + `<small>제작 검수 ${Number(clip.score)}점 · ${Number(clip.batch)}차</small>` : '<p>미인계</p>'}</figure>`;
    }));
  }).join('');
}
function oldLibrary(revisions, needle, scope, pack) {
  const filtered = revisions.filter(r => scope === 'all' && (!pack || r.packId === pack) && (r.name+' '+r.nameEn+' '+r.revision).toLocaleLowerCase().includes(needle));
  return filtered.map(r => `<details class="chat-clip-revision"><summary>${esc(r.name)} · ${esc(r.revision)} (${r.clips.length}편)</summary>${grid(r.clips.map(c =>
    `<figure><figcaption>${esc(c.state)} · ${Number(c.duration)}초</figcaption>${player({...c, poster:r.poster}, r.name+' · '+c.state)}</figure>`))}</details>`).join('') || '<p>이 조건에 맞는 영상이 없습니다.</p>';
}
export function renderReview(data, {view, selectedId='',query='',scope='all',pack=''}) {
  const needle=query.trim().toLocaleLowerCase();
  const actors = data.characters.filter(a => scope === 'all' && (!pack || a.packId === pack) && [a.name,a.nameEn,a.slug].join(' ').toLocaleLowerCase().includes(needle));
  const actor = actors.find(a => a.slug === selectedId) || (needle || !selectedId ? actors[0] : null);
  const intro = '<div class="library-heading"><h1>GenesisChat '+labels[view]+'</h1></div>'+chatTabs(view, view === 'clip-library' ? '' : actor?.slug);
  if (view === 'clip-library') return intro+'<section class="character-art-archive">'+oldLibrary(data.revisions,needle,scope,pack)+'</section>';
  const count = data.characters.reduce((total, entry) => total + Object.keys(entry.clips).length, 0);
  const summary = view === 'video-pack' ? `<p class="character-art-results">제작팀 인계 ${count} / ${data.characters.length * 10}편 · 최종 검토 대기</p>` : '';
  const menu = actors.map(a => `<a href="${hash(view,a.slug)}" ${actor === a ? 'aria-current="page"' : ''}>${esc(a.name)}${view === 'video-pack' ? ' '+Object.keys(a.clips).length+'/10' : ''}</a>`).join('');
  const selected = actor ? `<section class="chat-review-actor" data-actor="${esc(actor.slug)}"><header>${still(actor.portrait,actor.name+' 원화')}<div><h2>${esc(actor.name)}</h2><p>${view === 'layers' && actor.layers.mid ? '제갈량 검수 샘플 · zhuge-ten-state-v1' : '삼국지 · 통화 영상 검수 후보'}</p><nav aria-label="${esc(actor.name)} 자료">${['expressions','layers','video-pack'].map(v => `<a href="${hash(v,actor.slug)}" ${view===v?'aria-current="page"':''}>${labels[v]}</a>`).join(' ')}</nav></div></header>${view === 'video-pack' ? '<details class="chat-clip-revision"><summary>인물 표정과 장면 레이어</summary>'+cards(actor,'expressions')+cards(actor,'layers')+'</details>' : ''}${cards(actor,view)}</section>` : '<p>이 조건에 맞는 캐릭터가 없습니다.</p>';
  return intro+`<div class="character-art-archive">${summary}<nav class="character-view-tabs chat-review-actors" aria-label="캐릭터 선택">${menu}</nav>${selected}</div>`;
}
