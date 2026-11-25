import noZoomReview from './skyhaven-genesis-chat-nozoom-r1.mjs';

export const ltxEdition = '2026-11-25';
export const reviewViews = ['expressions', 'layers', 'video-pack', 'clip-library'];
const labels = {characters:'인물 원화', backgrounds:'표지·배경', expressions:'표정', layers:'장면 레이어', 'video-pack':'영상 Pack', 'clip-library':'기존 영상'};
const moods = {neutral:'중립', happy:'기쁨', angry:'분노', sad:'슬픔', surprised:'놀람'};
export function stateLabel(state) {
  const [activity,mood] = state.split('-');
  return (activity === 'listening' ? '듣기' : '말하기')+' · '+moods[mood];
}
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
    || (url.origin === 'https://comfy.genesisframeworks.com' && /^\/comfy\/skyhaven\/files\/Library\/Art\/GenesisChat\/PortraitReview\/(?:2026-11-25\/)?[a-f0-9]{64}\.(png|webp|webm|mp4)$/.test(url.pathname));
  return trusted && !url.search && !url.hash && !url.username && !url.password ? esc(url.href) : '';
}
function still(asset, title) {
  const url = safeMedia(asset?.url);
  return url ? `<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${esc(title)}" loading="lazy"></a>` : '<p>자료 미확인</p>';
}
function player(clip, title, linkLabel='원본 영상') {
  const url = safeMedia(clip.url);
  if (!url) return '<p>영상 경로 미확인</p>';
  return `<video controls playsinline preload="none" poster="${safeMedia(clip.poster)}" src="${url}" aria-label="${esc(title)}"></video><a href="${url}" target="_blank" rel="noopener">${esc(linkLabel)}</a>`;
}
function comparisonPlayer(source, label) {
  const url = safeMedia(source);
  if (!url) return '';
  return `<details class="chat-comparison"><summary>${esc(label)}</summary><video controls playsinline preload="none" width="1036" height="816" src="${url}" aria-label="${esc(label)}"></video><a href="${url}" target="_blank" rel="noopener">비교 파일 받기</a></details>`;
}
function grid(cards) { return '<div class="chat-review-grid">' + cards.join('') + '</div>'; }
function novelCaption(reference) {
  if (!reference) return '';
  if (reference.chapter === null && reference.url === null) return '<p>특정 회차 미지정</p>';
  const chapter = Number(reference.chapter);
  const url = 'https://zh.wikisource.org/wiki/三國演義/第'+String(chapter).padStart(3,'0')+'回';
  if (!Number.isInteger(chapter) || chapter < 1 || reference.url !== url) return '';
  const note = reference.noteKo ? `<p>${esc(reference.noteKo)}</p>` : '';
  return `<p>${esc(reference.sceneKo)} · <a href="${url}"><cite>삼국지연의</cite> 제${chapter}회</a></p>`+note;
}
function expressionCards(actor) {
  return grid(Object.entries(moods).map(([key,label]) => {
    if (!actor.expressionsByState) return `<figure><figcaption>${label}</figcaption>${still(actor.expressions[key], actor.name+' · '+label)}</figure>`;
    const listening = actor.expressionsByState['listening-'+key];
    const speaking = actor.expressionsByState['speaking-'+key];
    const variants = listening.sha256 === speaking.sha256 ? [['듣기·말하기', listening]] : [['듣기', listening], ['말하기', speaking]];
    return variants.map(([mode,asset]) => `<figure data-expression-sha="${esc(asset.sha256)}"><figcaption>${label} · ${mode}${novelCaption(actor.expressionSource?.references[asset.sha256])}</figcaption>${still(asset, actor.name+' · '+mode+' · '+label)}</figure>`).join('');
  }));
}
function cards(actor, view, revisions={}) {
  const current = Boolean(actor.expressionsByState);
  if (view === 'expressions') return expressionCards(actor);
  if (view === 'layers') return grid(Object.entries(names).map(([key,label]) => {
    const layer = actor.layers[key];
    return `<figure><figcaption>${label}</figcaption>${key === 'mid' && layer?.poster ? player(layer, actor.name+' · 중경') : still(layer, actor.name+' · '+label)}${layer?.original ? `<a href="${safeMedia(layer.original.url)}" target="_blank" rel="noopener">제작 원본</a>` : ''}</figure>`;
  }));
  return ['listening','speaking'].map(activity => {
    const mode = activity === 'listening' ? '듣기' : '말하기';
    return `<h3>${mode} · ${activity === 'listening' ? 6 : current ? 3 : 1}초</h3>` + grid(Object.entries(moods).map(([key,label]) => {
      const state = activity+'-'+key, clip = actor.clips[state];
      const revision = revisions[clip?.sha256];
      const review = Number.isFinite(clip?.score) ? `${current ? '원화팀' : '제작 검수'} ${clip.score}점` : revision ? '사용자 판정 · 탈락' : '<span data-owner-pending>사용자 리뷰 대기</span>';
      const expression = safeMedia(clip?.expression?.url);
      const loop = current ? '<label><input type="checkbox" data-clip-loop> 반복 재생</label>' : '';
      const warning = clip?.nativeReviewReason === 'qa-mouth-review' ? '<small>자동 경고 · 입 움직임 검토</small>' : '';
      const note = clip?.artNote ? `<p>${esc(clip.artNote)}</p>` : '';
      const editor = clip ? `<div class="chat-rejection"><p data-saved-reason hidden></p><details><summary>탈락 사유 작성</summary><form aria-label="${esc(actor.name)} · ${mode} · ${label} 검토" novalidate><label>탈락 사유<textarea name="reason" rows="3" required></textarea></label><button type="submit">탈락으로 저장</button> <button type="button" data-undo-rejection hidden>탈락 취소</button></form></details><small role="status"></small></div>` : '';
      const title = actor.name+' · '+mode+' · '+label;
      const originalLabel = revision ? '<strong>탈락 원본</strong><p>'+esc(noZoomReview.reason)+'</p>' : '';
      const candidate = revision ? `<section data-review-candidate aria-label="${esc(title)} 수정 후보"><strong>수정 후보 · 사용자 리뷰 대기</strong>${player(revision,title+' · 수정 후보','수정 영상 열기')}${comparisonPlayer(revision.comparison, title+' · 원본과 수정본 나란히 재생 (6초)')}</section>` : '';
      return `<figure data-state="${state}"><figcaption>${label} <small lang="en">${state}</small></figcaption>${clip ? originalLabel + player(clip, revision ? title+' · 탈락 원본' : title) + loop + warning + note + `<small>${review} · ${Number(clip.batch)}차</small>${editor}${expression ? `<p><a href="${expression}" target="_blank" rel="noopener">표정 원화</a></p>` : ''}${candidate}` : '<p>미인계</p>'}</figure>`;
    }));
  }).join('');
}
function oldLibrary(revisions, needle, scope, pack) {
  const filtered = revisions.filter(r => scope === 'all' && (!pack || r.packId === pack) && (r.name+' '+r.nameEn+' '+r.revision).toLocaleLowerCase().includes(needle));
  return filtered.map(r => `<details class="chat-clip-revision"><summary>${esc(r.name)} · ${esc(r.revision)} (${r.clips.length}편)</summary>${grid(r.clips.map(c =>
    `<figure><figcaption>${esc(c.state)} · ${Number(c.duration)}초</figcaption>${player({...c, poster:r.poster}, r.name+' · '+c.state)}</figure>`))}</details>`).join('') || '<p>이 조건에 맞는 영상이 없습니다.</p>';
}
function actorDescription(actor, view) {
  const note = actor.sceneNote;
  if (note) return `<p><strong>${esc(note.mood)} 원화 동기</strong> · ${esc(note.art)}</p><p><strong>말하기 연기 참고</strong> · ${esc(note.performance)}</p><p><cite>${esc(note.citation)}</cite></p>`;
  return view === 'layers' && actor.layers.mid?.poster
    ? '<p>제갈량 검수 샘플 · zhuge-ten-state-v1</p>'
    : '<p>삼국지 · 통화 영상 검수 후보</p>';
}
function editionLinks(view, actor, edition, pageURL) {
  return '<nav class="character-view-tabs" aria-label="검토판">'+[
    [ltxEdition,'11월 25일 · ImageGen / LTX'], ['', '11월 24일 · 기존 40편']
  ].map(([id,label])=>{
    const url=new URL(pageURL);
    if(id)url.searchParams.set('edition',id);else url.searchParams.delete('edition');
    return `<a href="${esc(url.pathname+url.search+hash(view,actor))}" ${id===edition?'aria-current="page"':''}>${label}</a>`;
  }).join('')+'</nav>';
}
export function renderReview(data, {view, selectedId='',query='',scope='all',pack='',pageURL='https://skyhaven.genesisframeworks.com/'}) {
  const needle=query.trim().toLocaleLowerCase();
  const actors = data.characters.filter(a => scope === 'all' && (!pack || a.packId === pack) && [a.name,a.nameEn,a.slug].join(' ').toLocaleLowerCase().includes(needle));
  const actor = actors.find(a => a.slug === selectedId) || (needle || !selectedId ? actors[0] : null);
  const intro = '<div class="library-heading"><h1>GenesisChat '+labels[view]+'</h1></div>'+chatTabs(view, view === 'clip-library' ? '' : actor?.slug);
  if (view === 'clip-library') return intro+'<section class="character-art-archive">'+oldLibrary(data.revisions,needle,scope,pack)+'</section>';
  const editions = editionLinks(view,actor?.slug || '',data.edition || '',pageURL);
  const count = data.characters.reduce((total, entry) => total + Object.keys(entry.clips).length, 0);
  const datedReview = data.edition === ltxEdition;
  const reel = datedReview ? comparisonPlayer(noZoomReview.reel, '줌 수정 6편 · 원본과 나란히 재생 (36초)') : '';
  const summary = view === 'video-pack' ? `<p class="character-art-results">제작팀 인계 ${count} / ${data.characters.length * 10}편</p>${reel}<details class="chat-clip-revision chat-rejection-log"><summary>내 탈락 목록 <span data-rejection-count></span> · 이 브라우저에 저장</summary><p data-no-rejections>저장한 탈락 사유가 없습니다.</p><textarea aria-label="복사용 탈락 목록" rows="5" readonly hidden></textarea><button type="button" data-copy-rejections hidden>탈락 목록 복사</button><small role="status"></small></details>` : '';
  const menu = actors.map(a => `<a href="${hash(view,a.slug)}" ${actor === a ? 'aria-current="page"' : ''}>${esc(a.name)}${view === 'video-pack' ? ' '+Object.keys(a.clips).length+'/10' : ''}</a>`).join('');
  const selected = actor ? `<section class="chat-review-actor" data-actor="${esc(actor.slug)}"><header>${still(actor.portrait,actor.name+' 원화')}<div><h2>${esc(actor.name)}</h2>${actorDescription(actor,view)}<nav aria-label="${esc(actor.name)} 자료">${['expressions','layers','video-pack'].map(v => `<a href="${hash(v,actor.slug)}" ${view===v?'aria-current="page"':''}>${labels[v]}</a>`).join(' ')}</nav></div></header>${view === 'video-pack' ? '<details class="chat-clip-revision"><summary>인물 표정과 장면 레이어</summary>'+cards(actor,'expressions')+cards(actor,'layers')+'</details>' : ''}${cards(actor,view,datedReview ? noZoomReview.pairs : {})}</section>` : '<p>이 조건에 맞는 캐릭터가 없습니다.</p>';
  return intro+editions+`<div class="character-art-archive">${summary}<nav class="character-view-tabs chat-review-actors" aria-label="캐릭터 선택">${menu}</nav>${selected}</div>`;
}
