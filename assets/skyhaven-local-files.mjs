// Directory permissions belong to this origin/browser; no paths or bytes are uploaded.
const databases=new WeakMap();
export const LOCAL_CONNECTION_VERSION='20261023-connect-v2';
const LOCAL_TIMEOUT=15000;
export function withLocalTimeout(work,{signal,timeoutMs=LOCAL_TIMEOUT}={}){
  return new Promise((resolve,reject)=>{
    let timer,settled=false;
    const finish=(callback,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);callback(value);};
    const abort=()=>finish(reject,signal.reason||new DOMException('연결을 중단했습니다.','AbortError'));
    if(signal?.aborted){abort();return;}
    signal?.addEventListener('abort',abort,{once:true});
    if(timeoutMs!==null)timer=setTimeout(()=>finish(reject,new DOMException('15초 동안 응답이 없습니다. 폴더 권한과 Dropbox 상태를 확인한 뒤 다시 시도해 주세요.','TimeoutError')),timeoutMs);
    try{Promise.resolve(work()).then(value=>finish(resolve,value),error=>finish(reject,error));}catch(error){finish(reject,error);}
  });
}
export function localRootStorage(indexedDB=globalThis.indexedDB){
  async function database(){
    if(!indexedDB)throw new Error('이 브라우저에서 폴더 연결 저장을 사용할 수 없습니다.');
    if(databases.has(indexedDB))return databases.get(indexedDB);
    const connection=new Promise((resolve,reject)=>{
      let finished=false;
      const fail=error=>{if(finished)return;finished=true;clearTimeout(timer);databases.delete(indexedDB);reject(error);};
      const timer=setTimeout(()=>fail(new DOMException('폴더 연결 저장소가 응답하지 않습니다. 다른 탭을 닫고 다시 시도해 주세요.','TimeoutError')),LOCAL_TIMEOUT);
      let request;try{request=indexedDB.open('skyhaven-local-roots',1);}catch(error){fail(error);return;}
      request.onupgradeneeded=()=>request.result.createObjectStore('roots');
      request.onsuccess=()=>{if(finished){request.result.close();return;}finished=true;clearTimeout(timer);request.result.onversionchange=()=>{request.result.close();databases.delete(indexedDB);};resolve(request.result);};
      request.onerror=()=>fail(request.error);request.onblocked=()=>fail(new Error('다른 탭이 폴더 연결 저장소를 막고 있습니다. 다른 탭을 닫고 다시 시도해 주세요.'));
    }).catch(error=>{databases.delete(indexedDB);throw error;});databases.set(indexedDB,connection);return connection;
  }
  async function operation(mode,work,{signal}={}){
    signal?.throwIfAborted();const db=await database();signal?.throwIfAborted();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('roots',mode);let request,done=false;
      const finish=(callback,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);callback(value);};
      const abort=()=>{try{tx.abort();}catch{}finish(reject,signal?.reason||new DOMException('연결을 중단했습니다.','AbortError'));};
      const timer=setTimeout(()=>{try{tx.abort();}catch{}finish(reject,new DOMException('폴더 연결 저장소가 15초 동안 응답하지 않습니다.','TimeoutError'));},LOCAL_TIMEOUT);
      tx.oncomplete=()=>finish(resolve,request?.result);tx.onerror=()=>finish(reject,tx.error);tx.onabort=()=>finish(reject,tx.error||new DOMException('저장이 중단됐습니다.','AbortError'));
      signal?.addEventListener('abort',abort,{once:true});
      if(signal?.aborted){abort();return;}
      try{request=work(tx.objectStore('roots'));}catch(error){try{tx.abort();}catch{}finish(reject,error);}
    });
  }
  return {get:(key,options)=>operation('readonly',s=>s.get(key),options),put:(key,value,options)=>operation('readwrite',s=>s.put(value,key),options),remove:(key,options)=>operation('readwrite',s=>s.delete(key),options)};
}
export function localPathParts(path){
  const parts=path.split('/');
  if(parts.some(p=>!p||p==='.'||p==='..'||/[\\:\u0000]/.test(p)))throw new Error('허용되지 않은 로컬 상대 경로입니다.');
  return parts;
}
export async function readLocalFile(root,path,{storage=localRootStorage()}={}){
  if(!/^[a-zA-Z0-9_-]+$/.test(root))throw new Error('허용되지 않은 루트입니다.');
  const parts=localPathParts(path),handle=await storage.get(root);
  if(!handle||await handle.queryPermission({mode:'read'})!=='granted')throw new DOMException('폴더 연결 메뉴에서 읽기 권한을 연결해 주세요.','NotAllowedError');
  let directory=handle;
  for(const part of parts.slice(0,-1))directory=await directory.getDirectoryHandle(part);
  return (await directory.getFileHandle(parts.at(-1))).getFile();
}
let workerReady;
async function localWorker(){
  if(!('serviceWorker' in navigator))throw new Error('이 브라우저에서는 로컬 폴더 연결을 지원하지 않습니다. 데스크톱 Chrome/Edge에서 열어주세요.');
  workerReady??=withLocalTimeout(async()=>{
    await navigator.serviceWorker.register(new URL('../skyhaven-local-worker.mjs?v='+LOCAL_CONNECTION_VERSION,import.meta.url),{type:'module',scope:new URL('../',import.meta.url).pathname,updateViaCache:'none'});
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
      const finish=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);};
      const changed=()=>{if(navigator.serviceWorker.controller){finish();resolve();}};
      const timer=setTimeout(()=>{finish();reject(new DOMException('로컬 파일 Worker가 페이지에 연결되지 않았습니다. 다시 시도해 주세요.','TimeoutError'));},LOCAL_TIMEOUT);
      navigator.serviceWorker.addEventListener('controllerchange',changed);changed();
    });
  }).catch(error=>{workerReady=null;throw error;});
  return workerReady;
}
function libraryConfig(config){
  if(!config||!/^[a-zA-Z0-9_-]+$/.test(config.libraryId)||!Array.isArray(config.roots)||!config.routes||typeof config.routes!=='object'||Array.isArray(config.routes))throw new Error('library.json 색인 형식을 확인해 주세요.');
  if(!config.routes['/comfy/skyhaven/api/library']||!config.routes['/comfy/skyhaven/api/library/motions'])throw new Error('library.json에 카탈로그 또는 모션 색인 경로가 없습니다.');
  for(const root of config.roots)if(!/^[a-zA-Z0-9_-]+$/.test(root.id)||root.id==='_catalog')throw new Error('library.json의 원본 루트 ID를 확인해 주세요.');
  for(const path of Object.values(config.routes))localPathParts(path);
  return config;
}
function connectionError(error,phase){
  if(error.name==='TimeoutError')return error.message;
  if(error.name==='AbortError')return phase==='select'?'폴더 선택이 완료되지 않았습니다. 취소했거나 브라우저가 접근을 허용하지 않았을 수 있습니다. 다시 선택해 주세요.':'연결 처리가 중단됐습니다. 읽기 권한을 확인한 뒤 다시 시도해 주세요.';
  if(error.name==='NotAllowedError'||error.name==='SecurityError')return '폴더 읽기 권한이 허용되지 않았습니다. 권한을 다시 허용하거나 데스크톱 Chrome/Edge에서 이 주소를 열어주세요.';
  if(error.name==='NotFoundError')return '선택한 폴더에 library.json이 없습니다. 게시 도구가 만든 색인 폴더를 선택해 주세요.';
  if(error.name==='SyntaxError')return 'library.json을 읽었지만 JSON 형식이 올바르지 않습니다. 색인을 다시 생성해 주세요.';
  if(error.name==='DataCloneError')return '이 브라우저가 폴더 연결을 저장하지 못했습니다. 데스크톱 Chrome/Edge에서 이 주소를 열어주세요.';
  return error.message||'연결을 완료하지 못했습니다. 다시 시도해 주세요.';
}
// All permission/picker calls start synchronously inside the user's click.
export function createFolderConnector({storage=localRootStorage(),worker=localWorker,fetcher=globalThis.fetch,picker=options=>globalThis.showDirectoryPicker(options),base=new URL('../',import.meta.url),onState=()=>{},onSelected=()=>{},timeoutMs=LOCAL_TIMEOUT}={}){
  let current;
  function cancel(){if(!current)return;const attempt=current;current=null;attempt.controller.abort();onState({phase:'cancelled',busy:false,message:'연결을 중단했습니다. 폴더 선택 창이 열려 있다면 창도 닫아주세요.'});}
  function connect({handle,restore=false}={}){
    if(current)return current.promise;
    const attempt={controller:new AbortController(),phase:handle?'permission':'select',folder:handle?.name||''};current=attempt;
    const signal=attempt.controller.signal;
    const state=(phase,message)=>{signal.throwIfAborted();attempt.phase=phase;onState({phase,message,folder:attempt.folder,busy:true});};
    const step=async(phase,message,work)=>{state(phase,message);try{return await withLocalTimeout(work,{signal,timeoutMs});}catch(error){attempt.controller.abort(error);throw error;}};
    let selection;
    try{
      state(attempt.phase,handle?'저장된 폴더의 읽기 권한을 확인합니다.':'폴더 선택 창에서 library.json이 있는 색인 폴더를 선택해 주세요.');
      selection=handle?(restore?undefined:handle.requestPermission({mode:'read'})):picker({id:'skyhaven-catalog',mode:'read'});
    }catch(error){selection=Promise.reject(error);}
    attempt.promise=(async()=>{
      try{
        if(handle){if(!restore&&await step('permission','읽기 권한을 확인합니다.',()=>selection)!=='granted')throw new DOMException('Permission denied','NotAllowedError');}
        else{handle=await withLocalTimeout(()=>selection,{signal,timeoutMs:null});}
        signal.throwIfAborted();attempt.folder=handle.name;onSelected(handle);
        const permission=await step('permission','선택한 폴더의 읽기 권한을 확인합니다.',()=>handle.queryPermission({mode:'read'}));
        if(permission!=='granted')throw new DOMException('Permission denied','NotAllowedError');
        const config=await step('manifest','library.json을 읽고 색인 형식을 확인합니다.',async()=>libraryConfig(JSON.parse(await (await (await handle.getFileHandle('library.json')).getFile()).text())));
        await step('store','브라우저에 읽기 전용 폴더 연결을 저장합니다.',()=>storage.put('_catalog',handle,{signal}));
        await step('worker','로컬 파일 Worker 연결을 확인합니다.',worker);
        await step('verify','저장한 폴더를 Worker에서 실제로 다시 읽습니다.',async()=>{
          const response=await fetcher(new URL('__local/_catalog/library.json',base),{cache:'no-store',signal});
          if(!response.ok){let message;try{message=(await response.json()).error;}catch{}throw new Error(message||'로컬 색인을 다시 읽지 못했습니다 ('+response.status+').');}
          const actual=libraryConfig(await response.json());if(actual.libraryId!==config.libraryId)throw new Error('선택한 색인과 Worker가 읽은 색인이 다릅니다. 연결을 다시 시도해 주세요.');
        });
        signal.throwIfAborted();onState({phase:'connected',busy:false,folder:attempt.folder,message:'로컬 파일 읽기를 확인했습니다. 카탈로그를 엽니다.'});
        return {...config,mode:'local-catalog',roots:[{id:'_catalog',label:'라이브러리 색인 폴더'},...config.roots],routes:Object.fromEntries(Object.entries(config.routes).map(([key,value])=>[key,'__local/_catalog/'+value]))};
      }catch(error){
        if(current===attempt)onState({phase:'error',failedPhase:attempt.phase,errorName:error.name||'Error',folder:attempt.folder,busy:false,message:connectionError(error,attempt.phase)});
        return null;
      }finally{if(current===attempt)current=null;}
    })();return attempt.promise;
  }
  return {connect,cancel,get busy(){return !!current;}};
}
export async function prepareLocalLibrary(spec){
  if(!spec||spec.mode!=='local-catalog')return spec;
  const host=document.getElementById('main');
  host.innerHTML='<div class="library-heading local-onboarding"><h1>내 리소스 라이브러리 연결</h1><p>앱은 웹에서, 내 색인과 파일은 내 폴더에서 읽습니다. 파일을 업로드하지 않습니다.</p><p>게시 도구가 생성한 library.json이 있는 색인 폴더를 선택하세요.</p><div class="connection-actions"><button id="connect-local-catalog" class="button primary" disabled>연결 준비 중…</button><button id="choose-local-catalog" class="button ghost" disabled>다른 색인 폴더 선택</button><button id="cancel-local-catalog" class="button ghost" hidden>중단</button></div><p id="local-catalog-status" role="status" aria-live="polite">브라우저의 로컬 연결을 준비합니다.</p><p id="local-catalog-folder"></p><ol id="local-catalog-steps"><li data-step="select">폴더 선택</li><li data-step="permission">읽기 권한</li><li data-step="manifest">색인 검사</li><li data-step="store">연결 저장</li><li data-step="verify">실제 읽기 확인</li><li data-step="connected">카탈로그 열기</li></ol><details><summary>연결 진단</summary><pre id="local-catalog-diagnostic"></pre></details><p>내장 브라우저에서 연결되지 않으면 데스크톱 Chrome/Edge에서 같은 주소를 열어주세요.</p><p><code id="local-catalog-address"></code> <button id="copy-local-address" class="button ghost">주소 복사</button></p><a href="./manual.md" target="_blank" rel="noopener">MCP · 폴더 연결 매뉴얼 ↗</a></div>';
  const get=id=>document.getElementById(id),primary=get('connect-local-catalog'),choose=get('choose-local-catalog'),cancel=get('cancel-local-catalog');
  get('local-catalog-address').textContent=new URL('./',location.href).href;
  get('copy-local-address').onclick=()=>navigator.clipboard.writeText(new URL('./',location.href).href).catch(()=>{get('local-catalog-status').textContent='위 주소를 복사해 Chrome/Edge에서 열어주세요.';});
  return new Promise(resolve=>{
    let saved,prepared=false;
    function render(value){
      get('local-catalog-status').textContent=value.message;get('local-catalog-folder').textContent=value.folder?'선택한 폴더: '+value.folder:'';
      primary.disabled=choose.disabled=value.busy;cancel.hidden=!value.busy;cancel.disabled=!prepared;
      primary.textContent=prepared?(saved?'선택한 폴더로 재시도 · 권한 허용':'내 라이브러리 폴더 선택'):'연결 준비 다시 시도';
      host.querySelectorAll('[data-step]').forEach(el=>el.toggleAttribute('aria-current',el.dataset.step===(value.failedPhase||value.phase)));
      get('local-catalog-diagnostic').textContent='연결 버전: '+LOCAL_CONNECTION_VERSION+'\n단계: '+(value.failedPhase||value.phase)+(value.errorName?'\n오류: '+value.errorName:'');
    }
    const connector=createFolderConnector({onState:render,onSelected:handle=>{saved=handle;}});
    function connect(reuse){const pending=connector.connect({handle:reuse?saved:undefined});pending.then(config=>{if(config)resolve(config);});}
    async function initialize(){
      render({phase:'preparing',busy:true,message:'브라우저의 저장소와 로컬 파일 Worker를 준비합니다.'});
      try{
        if(!globalThis.isSecureContext||!globalThis.showDirectoryPicker||!globalThis.indexedDB||!navigator.serviceWorker)throw new Error('이 브라우저의 로컬 폴더 기능을 사용할 수 없습니다. HTTPS 주소를 데스크톱 Chrome/Edge에서 열어주세요.');
        [saved]=await Promise.all([withLocalTimeout(()=>localRootStorage().get('_catalog')),localWorker()]);prepared=true;
        if(saved&&await withLocalTimeout(()=>saved.queryPermission({mode:'read'}))==='granted'){
          const config=await connector.connect({handle:saved,restore:true});if(config)resolve(config);return;
        }
        render({phase:'select',busy:false,folder:saved?.name,message:saved?'저장된 색인이 있습니다. 버튼을 눌러 읽기 권한을 다시 허용해 주세요.':'연결 준비 완료. 내 라이브러리 폴더를 선택해 주세요.'});
      }catch(error){render({phase:'error',failedPhase:'preparing',busy:false,errorName:error.name,message:connectionError(error,'preparing')});}
    }
    primary.onclick=()=>prepared?connect(true):void initialize();choose.onclick=()=>prepared?connect(false):void initialize();cancel.onclick=()=>connector.cancel();
    void initialize();
  });
}
export function installLocalConnections(config){
  if(!config)return;
  const panel=document.createElement('dialog');panel.className='local-connections';
  const heading=document.createElement('h2');heading.textContent='내 리소스 폴더 연결';panel.append(heading);
  const note=document.createElement('p');note.textContent='읽기 전용 연결입니다. 파일은 이 컴퓨터에서 읽으며 업로드하지 않습니다. 폴더 권한은 브라우저에 저장합니다.';panel.append(note);
  const message=document.createElement('p');message.setAttribute('role','status');panel.append(message);
  const storage=localRootStorage();
  for(const root of config.roots){
    const storageId=root.id==='_catalog'?'_catalog':(config.libraryId?config.libraryId+'_':'')+root.id;
    const row=document.createElement('section'),label=document.createElement('strong'),status=document.createElement('span'),choose=document.createElement('button'),disconnect=document.createElement('button');
    label.textContent=root.label;choose.textContent='폴더 연결';disconnect.textContent='연결 해제';row.append(label,status,choose,disconnect);panel.append(row);
    let saved;
    choose.disabled=true;status.textContent='연결 상태 확인 중…';
    async function refresh(){saved=await storage.get(storageId);const permission=saved?await withLocalTimeout(()=>saved.queryPermission({mode:'read'})):'missing';status.textContent=permission==='granted'?'연결됨 · '+saved.name:saved?'저장됨 · 읽기 권한 재허용 필요':'연결 필요';}
    if(root.id==='_catalog')choose.textContent='색인 다시 선택';
    choose.onclick=()=>{
      if(root.id==='_catalog'){
        choose.disabled=true;
        const connector=createFolderConnector({onState:value=>{message.textContent=value.message;}});
        void connector.connect().then(next=>{if(next)location.reload();}).finally(()=>{choose.disabled=false;});return;
      }
      let selection;
      try{
        if(!globalThis.showDirectoryPicker)throw new Error('로컬 폴더 연결은 데스크톱 Chrome/Edge에서 열어주세요.');
        // Saved handles were loaded before this click, preserving user activation.
        selection=saved?saved.requestPermission({mode:'read'}):showDirectoryPicker({id:'skyhaven-'+root.id,mode:'read'});
      }catch(error){message.textContent=connectionError(error,'permission');return;}
      choose.disabled=true;disconnect.disabled=true;message.textContent=root.label+' · 폴더 선택 또는 읽기 권한을 확인해 주세요.';
      void (async()=>{
        try{
          const handle=saved?(await withLocalTimeout(()=>selection)==='granted'?saved:null):await selection;
          if(!handle||await withLocalTimeout(()=>handle.queryPermission({mode:'read'}))!=='granted')throw new DOMException('Permission denied','NotAllowedError');
          await storage.put(storageId,handle);await refresh();message.textContent=root.label+' 연결 완료. 에셋을 다시 열면 로컬 파일로 재생합니다.';
          window.dispatchEvent(new Event('skyhaven-local-roots-changed'));
        }catch(error){message.textContent=connectionError(error,saved?'permission':'select');}
        finally{choose.disabled=false;disconnect.disabled=false;}
      })();
    };
    disconnect.onclick=async()=>{try{await storage.remove(storageId);if(root.id==='_catalog'){location.reload();return;}await refresh();window.dispatchEvent(new Event('skyhaven-local-roots-changed'));}catch(error){message.textContent=connectionError(error,'store');}};
    void refresh().catch(error=>{status.textContent=connectionError(error,'store');}).finally(()=>{choose.disabled=false;});
  }
  const close=document.createElement('button');close.textContent='닫기';close.onclick=()=>panel.close();panel.append(close);document.body.append(panel);
  const button=document.createElement('button');button.className='button ghost';button.textContent='폴더 연결';button.onclick=()=>panel.showModal();document.getElementById('refresh').before(button);
}
