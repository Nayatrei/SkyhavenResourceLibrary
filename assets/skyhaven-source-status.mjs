// Metadata lives on the site. Media remains exclusively on the source host.
export async function loadHostedDeployment(spec,{base=globalThis.location.href,fetcher=globalThis.fetch}={}){
  if(spec?.mode!=='hosted-catalog')return spec;
  const response=await fetcher(new URL('./data/current.json',base),{cache:'no-store'});
  if(!response.ok)throw new Error('게시된 목록을 읽을 수 없습니다 ('+response.status+').');
  const current=await response.json();
  if(current.mode!=='hosted-catalog'||!current.routes||new URL(current.origin).origin!==spec.origin)throw new Error('게시 목록의 원본 서버가 일치하지 않습니다.');
  return current;
}
export function createSourceStatus({origin,fetcher=globalThis.fetch,onChange=()=>{},timeoutMs=3000}={}){
  let state='checking',pending;
  return {get state(){return state;},get online(){return state==='online';},check(){
    if(pending)return pending;
    pending=(async()=>{
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
      let next;
      try{
        const response=await fetcher(origin+'/comfy/skyhaven/api/health',{cache:'no-store',signal:controller.signal,credentials:'omit'});
        next=response.ok&&(await response.json()).service==='skyhaven'?'online':'offline';
      }catch(error){next=error.name==='AbortError'?'offline':'unknown';}
      finally{clearTimeout(timer);}
      if(next!==state){state=next;onChange(state);}return state;
    })().finally(()=>{pending=null;});return pending;
  }};
}
export function installSourceStatus({deployment,onDisconnect=()=>{},onConnect=()=>{},document=globalThis.document}={}){
  if(deployment?.mode!=='hosted-catalog')return null;
  document.body.dataset.sourceState='checking';
  const badge=document.createElement('button');badge.className='source-status';badge.type='button';badge.setAttribute('aria-live','polite');
  document.getElementById('refresh').before(badge);
  function sync(){
    const online=status.online;
    document.querySelectorAll('[data-live-src]').forEach(el=>{if(online){if(!el.hasAttribute('src'))el.setAttribute('src',el.dataset.liveSrc);}else el.removeAttribute('src');});
    document.querySelectorAll('[data-live-background]').forEach(el=>{const value=online?'url('+JSON.stringify(el.dataset.liveBackground)+')':'';if(el.style.backgroundImage!==value)el.style.backgroundImage=value;});
    document.querySelectorAll('a[data-live-href]').forEach(el=>{if(online)el.href=el.dataset.liveHref;else el.removeAttribute('href');el.setAttribute('aria-disabled',String(!online));});
  }
  const status=createSourceStatus({origin:deployment.origin,onChange:state=>{
    document.body.dataset.sourceState=state;
    badge.textContent='● 원본 서버 '+({online:'ONLINE',offline:'OFFLINE',unknown:'확인 불가'}[state]);
    badge.title='마지막 목록 게시: '+new Date(deployment.publishedAt).toLocaleString()+' · 눌러서 연결 재확인';
    sync();if(state==='online')onConnect();else onDisconnect();
  }});
  badge.textContent='○ 원본 서버 확인 중';badge.onclick=()=>status.check();
  const observer=new MutationObserver(sync);observer.observe(document.getElementById('main'),{childList:true,subtree:true});
  const navigation=document.getElementById('navigation');if(navigation)observer.observe(navigation,{childList:true,subtree:true});
  const timer=setInterval(()=>{if(!document.hidden)void status.check();},60000);
  globalThis.addEventListener('pagehide',()=>{clearInterval(timer);observer.disconnect();},{once:true});
  void status.check();
  return status;
}
