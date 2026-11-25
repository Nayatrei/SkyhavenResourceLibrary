import {stateLabel} from './skyhaven-genesis-chat-packs.mjs?v=20261125-nozoom-inline';

// One key per delivered video keeps independent reviews intact when a new pack arrives.
export function bindClipRejections(host, catalog) {
  const log = host.querySelector('.chat-rejection-log');
  if (!log) return;
  const win = host.ownerDocument.defaultView;
  const edition = catalog.edition || '2026-11-24';
  const entries = [];
  for (const actor of catalog.characters) {
    for (const [state, clip] of Object.entries(actor.clips)) {
      entries.push({actor, state, clip, key: ['skyhaven.clip-rejection.v1',edition,actor.slug,state,clip.sha256].join('/')});
    }
  }
  const copy = log.querySelector('[data-copy-rejections]');
  const list = log.querySelector('textarea');
  const logStatus = log.querySelector('[role=status]');
  const activeActor = host.querySelector('.chat-review-actor')?.dataset.actor;
  function renderLog() {
    const rows = [];
    for (const {key,actor,state,clip} of entries) {
      const reason = win.localStorage.getItem(key);
      if (reason) rows.push(`${actor.name} · ${stateLabel(state)} · ${clip.duration}초\n${reason}\n${clip.url}`);
    }
    log.querySelector('[data-rejection-count]').textContent = rows.length+'편';
    log.querySelector('[data-no-rejections]').hidden = rows.length > 0;
    list.hidden = copy.hidden = rows.length === 0;
    list.value = rows.length ? `GenesisChat · ${edition} · 탈락 ${rows.length}편\n\n`+rows.join('\n\n') : '';
  }
  function readLog() {
    try { renderLog(); logStatus.textContent = ''; return true; }
    catch {
      log.querySelector('[data-rejection-count]').textContent = '확인 불가';
      log.querySelector('[data-no-rejections]').hidden = list.hidden = copy.hidden = true;
      logStatus.textContent = '이 브라우저의 저장 공간을 읽을 수 없습니다.';
      return false;
    }
  }
  readLog();
  log.addEventListener('toggle', () => { if (log.open) readLog(); });
  copy.addEventListener('click', async () => {
    if (!readLog() || !list.value) return;
    try {
      await win.navigator.clipboard.writeText(list.value);
      logStatus.textContent = '탈락 목록을 복사했습니다.';
    } catch {
      list.focus(); list.select();
      logStatus.textContent = '목록을 선택했습니다. 기기의 복사 명령을 사용하세요.';
    }
  });

  for (const {actor,state,key} of entries) {
    if (actor.slug !== activeActor) continue;
    const card = host.querySelector(`figure[data-state="${state}"]`);
    const panel = card?.querySelector('.chat-rejection');
    if (!panel) continue;
    const form = panel.querySelector('form'), text = form.elements.reason;
    const summary = panel.querySelector('summary'), editor = panel.querySelector('details');
    const saved = panel.querySelector('[data-saved-reason]'), undo = panel.querySelector('[data-undo-rejection]');
    const status = panel.querySelector('[role=status]');
    status.id = 'clip-review-message-'+state;
    function display(reason) {
      text.value = saved.textContent = reason;
      saved.hidden = undo.hidden = !reason;
      card.toggleAttribute('data-rejected', Boolean(reason));
      summary.textContent = reason ? '탈락 · 사유 수정' : '탈락 사유 작성';
      form.querySelector('[type=submit]').textContent = reason ? '사유 수정 저장' : '탈락으로 저장';
      const pending = card.querySelector('[data-owner-pending]');
      if (pending) pending.textContent = reason ? '내 판정 · 탈락' : '사용자 리뷰 대기';
    }
    try { display(win.localStorage.getItem(key) || ''); }
    catch { status.textContent = '이 브라우저의 저장 공간을 읽을 수 없습니다.'; }
    function clearError() {
      text.removeAttribute('aria-invalid');
      text.removeAttribute('aria-describedby');
      status.textContent = '';
    }
    function persist(reason) {
      try {
        if (reason) win.localStorage.setItem(key,reason);
        else win.localStorage.removeItem(key);
      } catch {
        status.textContent = '저장하지 못했습니다. 브라우저의 저장 공간 설정을 확인하세요.';
        return;
      }
      clearError(); display(reason); readLog();
      editor.open = false; summary.focus();
      status.textContent = reason ? '이 브라우저에 저장했습니다.' : '탈락을 취소했습니다.';
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      const reason = text.value.trim();
      if (reason) { persist(reason); return; }
      text.setAttribute('aria-invalid','true');
      text.setAttribute('aria-describedby',status.id);
      status.textContent = '탈락 사유를 입력해 주세요.';
      text.focus();
    });
    text.addEventListener('input', clearError);
    undo.addEventListener('click', () => persist(''));
  }
}
