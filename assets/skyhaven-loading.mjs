export const loadingMarkup = '<div class="loading-card"><strong data-loading-label>미리보기 준비 중…</strong><div class="loading-track indeterminate" role="progressbar" aria-label="미리보기 로딩" aria-valuemin="0" aria-valuemax="100"><span></span></div><span data-loading-detail>연결하는 중…</span><small data-loading-time>경과 0초</small></div>';

export function startLoading(element, signal) {
  const label=element.querySelector('[data-loading-label]'),detail=element.querySelector('[data-loading-detail]'),bar=element.querySelector('[role="progressbar"]'),time=element.querySelector('[data-loading-time]');
  let started,timer,active=false;
  const stop=()=>{active=false;clearInterval(timer);};
  signal?.addEventListener('abort',stop,{once:true});
  const update=(title,description='',fraction=null)=>{
    if(signal?.aborted)return;
    if(!active){active=true;started=performance.now();time.textContent='경과 0초';timer=setInterval(()=>{time.textContent=`경과 ${Math.floor((performance.now()-started)/1000)}초`;},1000);}
    element.hidden=false;label.textContent=title;detail.textContent=description;
    bar.hidden=false;
    bar.classList.toggle('indeterminate',fraction===null);
    if(fraction===null){bar.removeAttribute('aria-valuenow');bar.querySelector('span').style.width='';}
    else{const percent=Math.floor(Math.max(0,Math.min(1,fraction))*100);bar.setAttribute('aria-valuenow',String(percent));bar.querySelector('span').style.width=percent+'%';}
  };
  update('미리보기 준비 중…','연결하는 중…');
  return {update,finish(){stop();element.hidden=true;},fail(message){update('미리보기를 불러올 수 없습니다.',message);bar.hidden=true;stop();}};
}

export const paintLoading = () => new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
