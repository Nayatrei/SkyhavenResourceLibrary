// Character art is hosted on the site; other asset media uses the source host.
export async function loadHostedDeployment(spec,{base=globalThis.location.href,fetcher=globalThis.fetch}={}){
  if(spec?.mode!=='hosted-catalog')return spec;
  const response=await fetcher(new URL('./data/current.json',base),{cache:'no-store'});
  if(!response.ok)throw new Error('게시된 목록을 읽을 수 없습니다 ('+response.status+').');
  const current=await response.json();
  if(current.mode!=='hosted-catalog'||!current.routes||new URL(current.origin).origin!==spec.origin)throw new Error('게시 목록의 원본 서버가 일치하지 않습니다.');
  if(spec.characterArt){
    current.routes['/comfy/skyhaven/api/library/art-archive']=spec.characterArt.catalog;
    current.revision+=':art:'+spec.characterArt.revision;
  }
  return current;
}
export function createSourceStatus({origin,fetcher=globalThis.fetch,onChange=()=>{},onCheck=()=>{},timeoutMs=3000}={}){
  let state='checking',reason='',pending;
  return {get state(){return state;},get reason(){return reason;},get online(){return state==='online';},check(){
    if(pending)return pending;
    onCheck(true);
    pending=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
      let next;const previousState=state,previousReason=reason;
      try{
        const response=await fetcher(origin+'/comfy/skyhaven/api/health',{cache:'no-store',signal:controller.signal,credentials:'omit'});
        if(!response.ok){next='offline';reason='http-'+response.status;}
        else {
          let body;try{body=await response.json();}catch(error){if(error.name!=='SyntaxError')throw error;}
          next=body?.service==='skyhaven'?'online':'offline';reason=next==='online'?'':'invalid-response';
        }
      }catch(error){next=error.name==='AbortError'?'offline':'unknown';reason=error.name==='AbortError'?'timeout':'network';}
      finally{clearTimeout(timer);}
      state=next;if(next!==previousState||reason!==previousReason)onChange(state,reason);return state;
    })().finally(()=>{pending=null;onCheck(false);});return pending;
  }};
}
export function sourceExplanation(reason){
  if(reason==='timeout')return '원본 서비스 응답 시간이 초과됐습니다. 이 PC의 Nourish 원본 서비스(8187)와 인터넷 연결을 확인하세요.';
  if(reason?.startsWith('http-'))return '원본 서비스 응답 오류 ('+reason.slice(5)+'). 서비스가 실행 중인지, 외부 연결 경로가 정상인지 확인하세요.';
  if(reason==='invalid-response')return '원본 서비스 확인 응답이 아닙니다. 로그인 페이지 또는 연결 설정을 확인하세요.';
  return '원본 서비스에 연결하지 못했습니다. PC가 켜져 있어도 Nourish 원본 서비스(8187)가 실행 중이어야 합니다. 외부 연결 또는 브라우저 접근 차단도 확인하세요.';
}
export function installSourceStatus({deployment,onDisconnect=()=>{},onConnect=()=>{},document=globalThis.document}={}){
  if(deployment?.mode!=='hosted-catalog')return null;
  document.body.dataset.sourceState='checking';
  const badge=document.createElement('button');badge.className='source-status';badge.type='button';badge.setAttribute('aria-live','polite');
  const slot=document.getElementById('source-slot');if(slot)slot.append(badge);else document.getElementById('refresh').before(badge);
  const panel=document.createElement('div');panel.className='source-connection-panel';panel.hidden=true;panel.id='source-connection-panel';
  badge.setAttribute('aria-controls',panel.id);badge.setAttribute('aria-expanded','false');
  const title=document.createElement('strong'),message=document.createElement('p'),checked=document.createElement('small'),retry=document.createElement('button'),launch=document.createElement('a'),manual=document.createElement('a');
  title.id='source-connection-title';panel.setAttribute('aria-labelledby',title.id);
  message.setAttribute('role','status');checked.className='source-check-time';
  retry.type='button';retry.className='source-retry';
  launch.href='skyhaven-source://start';launch.className='button source-launch';launch.textContent='원본 서비스 켜기 · 이 PC';
  manual.href='#manual';manual.textContent='첫 설정·연결 안내 ↗';
  panel.append(title,message,checked,retry,launch,manual);(slot||badge.parentElement).append(panel);
  let launchTimer,launchAttempts=0;
  function renderCheck(checking){
    retry.disabled=checking;retry.textContent=checking?'연결 확인 중…':'연결 다시 확인';
    badge.setAttribute('aria-busy',String(checking));
    badge.textContent=checking?'○ CHECKING SOURCE':'● SOURCE '+({online:'ONLINE',offline:'OFFLINE',unknown:'UNREACHABLE'}[status.state])+'  ⌄';
    title.textContent=status.online?'원본 서비스 연결됨':'원본 서비스 연결 확인';
    message.textContent=checking?'원본 서비스 응답을 기다리고 있습니다…':status.online?'원본 이미지·3D·모션을 읽을 수 있습니다.':sourceExplanation(status.reason);
    if(!checking)checked.textContent='마지막 연결 확인 · '+new Date().toLocaleTimeString();
  }
  function sync(){
    const online=status.online;
    document.querySelectorAll('[data-source-message]').forEach(el=>{if(!online){const text=sourceExplanation(status.reason);if(el.textContent!==text)el.textContent=text;}});
    document.querySelectorAll('[data-live-src]').forEach(el=>{if(online){if(!el.hasAttribute('src'))el.setAttribute('src',el.dataset.liveSrc);}else el.removeAttribute('src');});
    document.querySelectorAll('[data-live-background]').forEach(el=>{const value=online?'url('+JSON.stringify(el.dataset.liveBackground)+')':'';if(el.style.backgroundImage!==value)el.style.backgroundImage=value;});
    document.querySelectorAll('a[data-live-href]').forEach(el=>{if(online)el.href=el.dataset.liveHref;else el.removeAttribute('href');el.setAttribute('aria-disabled',String(!online));});
  }
  const status=createSourceStatus({origin:deployment.origin,onCheck:renderCheck,onChange:(state,reason)=>{
    const online=state==='online';
    document.body.dataset.sourceState=state;
    launch.hidden=online;
    badge.title=(online?'원본 서비스 ONLINE':sourceExplanation(reason))+' · 마지막 목록 게시: '+new Date(deployment.publishedAt).toLocaleString();
    document.querySelectorAll('[data-source-message]').forEach(el=>{el.textContent=online?'':sourceExplanation(reason);});
    if(online)clearInterval(launchTimer);
    sync();if(state==='online')onConnect();else onDisconnect();
  }});
  retry.onclick=()=>{void status.check();};
  badge.textContent='○ CHECKING SOURCE';badge.onclick=()=>{panel.hidden=!panel.hidden;badge.setAttribute('aria-expanded',String(!panel.hidden));void status.check();};
  launch.onclick=()=>{clearInterval(launchTimer);launchAttempts=0;message.textContent='Windows에서 런처 열기를 허용해 주세요. 서비스 시작을 확인하고 있습니다. 첫 사용이라면 연결 안내의 런처 등록이 필요합니다.';launchTimer=setInterval(()=>{if(++launchAttempts>60){clearInterval(launchTimer);return;}void status.check();},2000);};
  document.addEventListener('click',event=>{if(!panel.contains(event.target)&&event.target!==badge){panel.hidden=true;badge.setAttribute('aria-expanded','false');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;badge.setAttribute('aria-expanded','false');badge.focus();}});
  const observer=new MutationObserver(sync);observer.observe(document.getElementById('main'),{childList:true,subtree:true});
  const navigation=document.getElementById('navigation');if(navigation)observer.observe(navigation,{childList:true,subtree:true});
  const navigator=document.getElementById('preview-navigator');if(navigator)observer.observe(navigator,{childList:true,subtree:true});
  const timer=setInterval(()=>{if(!document.hidden)void status.check();},60000);
  const onVisible=()=>{if(!document.hidden)void status.check();};document.addEventListener('visibilitychange',onVisible);
  globalThis.addEventListener('pagehide',()=>{clearInterval(timer);clearInterval(launchTimer);observer.disconnect();document.removeEventListener('visibilitychange',onVisible);},{once:true});
  void status.check();
  return status;
}
