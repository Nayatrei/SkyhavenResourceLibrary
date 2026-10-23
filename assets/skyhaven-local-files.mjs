// Directory permissions belong to this origin/browser; no paths or bytes are uploaded.
let connection;
export function localRootStorage(indexedDB=globalThis.indexedDB){
  async function database(){
    if(!indexedDB)throw new Error('이 브라우저에서 폴더 연결 저장을 사용할 수 없습니다.');
    connection??=new Promise((resolve,reject)=>{
      const request=indexedDB.open('skyhaven-local-roots',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('roots');
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });return connection;
  }
  async function operation(mode,work){
    const db=await database();return new Promise((resolve,reject)=>{
      const tx=db.transaction('roots',mode),request=work(tx.objectStore('roots'));
      tx.oncomplete=()=>resolve(request?.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  }
  return {get:key=>operation('readonly',s=>s.get(key)),put:(key,value)=>operation('readwrite',s=>s.put(value,key)),remove:key=>operation('readwrite',s=>s.delete(key))};
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
async function localWorker(){
  if(!('serviceWorker' in navigator))throw new Error('이 브라우저에서는 로컬 폴더 연결을 지원하지 않습니다. 데스크톱 Chrome/Edge에서 열어주세요.');
  await navigator.serviceWorker.register(new URL('../skyhaven-local-worker.mjs',import.meta.url),{type:'module',scope:new URL('../',import.meta.url).pathname});
  await navigator.serviceWorker.ready;
  if(!navigator.serviceWorker.controller)await new Promise(resolve=>{navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true});if(navigator.serviceWorker.controller)resolve();});
}
export async function prepareLocalLibrary(spec){
  if(!spec||spec.mode!=='local-catalog')return spec;
  const storage=localRootStorage();
  try{await localWorker();}catch(error){document.getElementById('main').innerHTML='<div class="library-heading"><h1>로컬 폴더 연결</h1><p></p><a href="./manual.md">MCP · 폴더 연결 매뉴얼</a></div>';document.getElementById('main').querySelector('p').textContent=error.message;return new Promise(()=>{});}
  async function load(handle){
    const file=await (await handle.getFileHandle('library.json')).getFile(),config=JSON.parse(await file.text());
    if(!config.libraryId||!Array.isArray(config.roots)||!config.routes)throw new Error('library.json 색인 형식을 확인해 주세요.');
    await storage.put('_catalog',handle);
    return {...config,mode:'local-catalog',roots:[{id:'_catalog',label:'라이브러리 색인 폴더'},...config.roots],routes:Object.fromEntries(Object.entries(config.routes).map(([key,value])=>[key,'__local/_catalog/'+value]))};
  }
  const saved=await storage.get('_catalog');
  if(saved&&await saved.queryPermission({mode:'read'})==='granted'){
    try{return await load(saved);}catch{/* A moved/deleted index can be connected again below. */}
  }
  const host=document.getElementById('main');
  host.innerHTML='<div class="library-heading"><h1>내 리소스 라이브러리 연결</h1><p>앱은 웹에서, 내 색인과 파일은 내 폴더에서 읽습니다. 파일을 업로드하지 않습니다.</p><p>게시 도구가 생성한 library.json이 있는 색인 폴더를 선택하세요.</p><button id="connect-local-catalog" class="button primary">'+(saved?'저장된 색인 권한 허용':'내 라이브러리 폴더 선택')+'</button><button id="choose-local-catalog" class="button ghost">다른 색인 폴더 선택</button><p id="local-catalog-status" role="status"></p><a href="./manual.md" target="_blank" rel="noopener">MCP · 폴더 연결 매뉴얼 ↗</a></div>';
  return new Promise(resolve=>{
    async function choose(reuse){
      try{
        if(!globalThis.showDirectoryPicker)throw new Error('로컬 미리보기는 데스크톱 Chrome/Edge에서 사용해 주세요.');
        const handle=reuse&&saved?saved:await showDirectoryPicker({id:'skyhaven-catalog',mode:'read'});
        if(await handle.requestPermission({mode:'read'})!=='granted')throw new Error('읽기 권한이 필요합니다.');
        resolve(await load(handle));
      }catch(error){if(error.name!=='AbortError')document.getElementById('local-catalog-status').textContent=error.message;}
    }
    document.getElementById('connect-local-catalog').onclick=()=>choose(true);
    document.getElementById('choose-local-catalog').onclick=()=>choose(false);
  });
}
export async function installLocalConnections(config){
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
    async function refresh(){const handle=await storage.get(storageId);const permission=handle?await handle.queryPermission({mode:'read'}):'missing';status.textContent=permission==='granted'?'연결됨 · '+handle.name:handle?'저장됨 · 읽기 권한 재허용 필요':'연결 필요';}
    choose.onclick=async()=>{
      try{
        if(!globalThis.showDirectoryPicker)throw new Error('로컬 폴더 연결은 데스크톱 Chrome/Edge에서 열어주세요.');
        const saved=await storage.get(storageId);
        const handle=saved||await showDirectoryPicker({id:'skyhaven-'+root.id,mode:'read'});
        if(await handle.requestPermission({mode:'read'})!=='granted')throw new Error('읽기 권한이 허용되지 않았습니다.');
        // A root can be replaced after disconnecting; no user files are changed.
        await storage.put(storageId,handle);await refresh();message.textContent=root.label+' 연결 완료. 에셋을 다시 열면 로컬 파일로 재생합니다.';
        window.dispatchEvent(new Event('skyhaven-local-roots-changed'));
      }catch(error){if(error.name!=='AbortError')message.textContent=error.message;}
    };
    disconnect.onclick=async()=>{await storage.remove(storageId);if(root.id==='_catalog'){location.reload();return;}await refresh();window.dispatchEvent(new Event('skyhaven-local-roots-changed'));};
    try{await refresh();}catch(error){status.textContent=error.message;}
  }
  const close=document.createElement('button');close.textContent='닫기';close.onclick=()=>panel.close();panel.append(close);document.body.append(panel);
  const button=document.createElement('button');button.className='button ghost';button.textContent='폴더 연결';button.onclick=()=>panel.showModal();document.getElementById('refresh').before(button);
  if(!('serviceWorker' in navigator)){message.textContent='이 브라우저에서 로컬 파일 연결을 지원하지 않습니다.';return;}
  try{
    await localWorker();
  }catch(error){message.textContent='로컬 파일 연결을 시작하지 못했습니다. HTTPS의 데스크톱 Chrome/Edge에서 열어주세요. '+error.message;}
}
