import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { TGALoader } from 'three/addons/loaders/TGALoader.js';
import { retargetClips, boneRole } from './skyhaven-retarget.mjs?v=20261022-library-v6';
import { loadingMarkup, startLoading, paintLoading } from './skyhaven-loading.mjs';
import { previewMaterial, textureMaterial, lambertMaterial } from './skyhaven-materials.mjs';
import { sourceBuffer } from './skyhaven-buffer-cache.mjs?v=20261022-library-v6';

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const normalizeBone = name => name.replace(/^mixamorig[:_]?/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

export async function createViewer({ host, file, folder, folders, signal, character, assignMotions=false }) {
  const life = new AbortController();
  signal?.addEventListener('abort', () => life.abort(), {once:true});
  if (signal?.aborted) life.abort();
  if (life.signal.aborted) return () => {};
  const files = folders.flatMap(collection => collection.files.map(asset => ({...asset, folderId:collection.id, folderName:collection.name})));
  const playable = files.filter(asset => ['fbx','glb','gltf','obj'].includes(asset.extension));
  const initial = {...file, folderId:folder.id, folderName:folder.name};
  let requestedUnityClip = null;
  let loadedFile = initial;
  if (file.extension !== 'anim' && file.previewPath && file.previewPath !== file.path) {
    loadedFile = playable.find(asset => asset.folderId === folder.id && asset.path === file.previewPath) || initial;
  }
  if (file.extension === 'anim') {
    const stem = file.name.replace(/\.anim$/i,'').split('__')[0].toLowerCase();
    const source = file.previewPath
      ? playable.find(asset => asset.folderId === folder.id && asset.path === file.previewPath)
      : playable.find(asset => asset.folderId === folder.id && asset.extension === 'fbx' && asset.name.replace(/\.fbx$/i,'').replace(/^@/,'').toLowerCase() === stem);
    if (!source) {
      let duration = '', sampleRate = '';
      try {
        const response = await fetch(file.url, {signal:life.signal});
        const text = await response.text();
        duration = text.match(/m_StopTime:\s*([\d.e+-]+)/)?.[1] || '';
        sampleRate = text.match(/m_SampleRate:\s*([\d.e+-]+)/)?.[1] || '';
      } catch (error) { if (life.signal.aborted) return () => {}; }
      if (life.signal.aborted) return () => {};
      host.innerHTML = `<section class="viewer-unavailable"><h3>This clip needs its Unity rig.</h3><p>This .anim asset stores Unity animation data. A matching source FBX was not found in your collections.</p>${duration?`<p>${escapeHTML(Number(duration).toFixed(2))} seconds${sampleRate?' · '+escapeHTML(sampleRate)+' fps':''}</p>`:''}<p>Preview the original animated FBX here, or play this clip on its Avatar in Unity. Exporting the animated model as FBX makes it available in this viewer.</p><a class="button" href="${escapeHTML(file.url)}" download>Download animation asset</a></section>`;
      return () => life.abort();
    }
    requestedUnityClip = file.name;
    loadedFile = source;
  }

  let motionFile = null;
  if (character || file.previewModelPath) {
    const previewCharacter = character || playable.find(asset=>asset.folderId===folder.id&&asset.path===file.previewModelPath);
    if(previewCharacter){motionFile=loadedFile;loadedFile=previewCharacter;}
  }
  host.innerHTML = `<div class="model-viewer">
    ${motionFile?`<p class="viewer-source-note">Motion: ${escapeHTML(motionFile.name)} · Preview character: ${escapeHTML(loadedFile.name)}</p>`:''}
    ${file.previewType==='converted-fbx-compatibility'&&!requestedUnityClip?'<p class="viewer-source-note">Compatibility FBX preview. The original file is preserved; use Download original for the source asset.</p>':''}
    ${requestedUnityClip?`<p class="viewer-source-note">Source FBX preview for ${escapeHTML(requestedUnityClip)}. Unity-specific import settings are not applied.</p>`:''}
    <div class="viewer-stage" id="viewer-stage"><div class="viewer-loading" role="status" id="viewer-loading">${loadingMarkup}</div><span class="viewer-canvas-help">Drag to orbit · Scroll to zoom · Right-drag to pan</span></div>
    <label class="viewer-look-label">프리뷰 재질<select id="viewer-look" aria-label="프리뷰 재질"><option value="lambert">Lambert · 부드러운 무광</option><option value="studio">PBR · 스튜디오</option><option value="texture">원본 텍스처 · 조명 없음</option><option value="clay">클레이 · 모델 형태</option></select></label>
    <div class="viewer-tools"><button type="button" class="button ghost" id="viewer-reset">Reset view</button><button type="button" class="button ghost" id="viewer-skeleton" aria-pressed="false">Skeleton</button><button type="button" class="button ghost" id="viewer-wireframe" aria-pressed="false">Wireframe</button><button type="button" class="button ghost" id="viewer-clay" aria-pressed="false">Clay view</button><span id="viewer-stats" class="viewer-stats"></span></div>
    <div class="animation-pickers"><label>Animation source<select id="viewer-source" aria-label="Animation source"><option value="embedded">This file’s clips</option>${(assignMotions?[]:playable.filter(asset=>asset.extension!=='obj'&&asset.url!==loadedFile.url)).map(asset=>`<option value="${escapeHTML(asset.url)}">${escapeHTML(asset.folderName+' / '+asset.path)}</option>`).join('')}</select></label><label>Animation clip<select id="viewer-clip" aria-label="Animation clip" disabled><option>No animation loaded</option></select></label></div>
    <div class="animation-controls"><button type="button" class="button primary" id="viewer-play" disabled>Play</button><label class="viewer-timeline-label"><span class="sr-only">Animation timeline</span><input type="range" id="viewer-timeline" aria-label="Animation timeline" min="0" max="1" value="0" step="0.001" disabled></label><output id="viewer-time" aria-live="off">0.00 / 0.00 s</output><label class="viewer-speed-label"><span class="sr-only">Playback speed</span><select id="viewer-speed" aria-label="Playback speed"><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>
    <p class="viewer-status" id="viewer-status" role="status">Loading the model and its animation clips.</p>
  </div>`;
  const $ = id => host.querySelector('#'+id);
  const stage = $('viewer-stage');
  const loading=startLoading($('viewer-loading'),life.signal);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias:true,alpha:false}); }
  catch (error) {
    loading.fail('WebGL을 사용할 수 없습니다. 브라우저의 하드웨어 가속을 확인하세요.');
    $('viewer-status').textContent = 'The 3D preview could not start.';
    return () => life.abort();
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.domElement.setAttribute('aria-label','Interactive 3D model preview');
  renderer.domElement.setAttribute('role','img');
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#242830');
  const studio=new THREE.Scene();studio.background=new THREE.Color('#aaaaaa');
  const panel=new THREE.Mesh(new THREE.PlaneGeometry(5,7),new THREE.MeshBasicMaterial({color:new THREE.Color(3,3,3),side:THREE.DoubleSide}));
  panel.position.set(-4,3,6);panel.lookAt(0,0,0);studio.add(panel);
  const pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(studio,.12);
  scene.environment=environment.texture;scene.environmentIntensity=.7;panel.geometry.dispose();panel.material.dispose();pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 1000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.15;
  controls.maxDistance = 40;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x777b83, .65));
  const key = new THREE.DirectionalLight(0xfff8ef, 2);
  key.position.set(5,8,6); scene.add(key);
  const fill = new THREE.DirectionalLight(0xe5ecff, .75);
  fill.position.set(-5,3,-5); scene.add(fill);
  const grid = new THREE.GridHelper(8, 24, 0x6c536e, 0x302937);
  grid.material.transparent=true; grid.material.opacity=.25;
  scene.add(grid);
  let model=null, wrapper=null, skeleton=null, mixer=null, activeAction=null, clipList=[], embeddedClips=[];
  let playing=false, duration=0, lastFrame=performance.now(), frameRequest=0, lastTimeUpdate=0;
  let boneCount=0,meshCount=0,missingTextures=0,sourceVersion=0;
  let disposed=false;
  let frontDirection=new THREE.Vector3(0,0,1);
  let bindPose=[];
  const originalMaterials = new Map();
  const viewMaterials = new Set();
  const textureCache = new Set();
  const blobURLs = new Set();
  const manager = new THREE.LoadingManager();
  let assetsPending=false,texturesWaiting=false,resolveTextures;
  manager.onStart=()=>{assetsPending=true;};
  manager.onProgress=(_url,done,total)=>{assetsPending=done<total;if(texturesWaiting)loading.update('텍스처 준비 중…',`${done} / ${total}개 파일`,done/total);};
  manager.onLoad=()=>{assetsPending=false;resolveTextures?.();};
  const waitForTextures=async()=>{
    if(!assetsPending)return;
    texturesWaiting=true;loading.update('텍스처 준비 중…','이미지 파일을 불러오는 중…');
    await new Promise(resolve=>{resolveTextures=resolve;life.signal.addEventListener('abort',resolve,{once:true});});
    texturesWaiting=false;
  };
  manager.setURLModifier(raw => {
    if (raw.startsWith('blob:')) {blobURLs.add(raw);return raw;}
    if (raw.startsWith('data:')) return raw;
    let pathname;
    try { pathname=decodeURIComponent(new URL(raw,location.href).pathname); } catch { pathname=raw; }
    const known=files.find(asset=>decodeURIComponent(asset.url)===pathname);
    if (known) return known.url;
    const clean=raw.replace(/\\/g,'/').split(/[?#]/)[0];
    const name=decodeURIComponent(clean.split('/').at(-1)).toLowerCase();
    const directory=loadedFile.path.split('/').slice(0,-1).join('/');
    const candidates=files.filter(asset=>asset.folderId===loadedFile.folderId&&asset.name.toLowerCase()===name);
    candidates.sort((a,b)=>Number(b.path.startsWith(directory+'/'))-Number(a.path.startsWith(directory+'/')));
    if (candidates.length) return candidates[0].url;
    // A GLTF may refer to a sibling .bin/image not separately indexed. The worker
    // still confines that request to an explicitly granted directory root.
    if(new URL(raw,location.href).pathname.includes('/__local/'))return raw;
    if (!textureCache.has(raw)) {missingTextures++;textureCache.add(raw);}
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';
  });
  const load = async (asset, loadSignal=life.signal) => {
    if(asset.previewPath && asset.previewPath!==asset.path) asset=playable.find(candidate=>(!asset.folderId||candidate.folderId===asset.folderId)&&candidate.path===asset.previewPath)||asset;
    const title=asset===motionFile?'모션 다운로드 중…':motionFile?'캐릭터 다운로드 중…':'모델 다운로드 중…';
    const version=sourceVersion;
    loading.update(title,asset.name);await paintLoading();
    if(life.signal.aborted)throw new DOMException('Preview closed','AbortError');
    const progress=event=>{
      if(life.signal.aborted||version!==sourceVersion)return;
      if(event.retry){loading.update('연결 재시도 중…',`${asset.name} · ${event.retry} / 2`);return;}
      const total=event.lengthComputable?event.total:asset.size,loaded=event.loaded||0;
      const size=value=>(value/1024/1024).toFixed(1)+' MB';
      if(total>0&&loaded>=total)loading.update('파일 해석 중…',asset.name+' · 다운로드 완료');
      else loading.update(title,`${asset.name} · ${size(loaded)}${total>0?' / '+size(total)+' · '+Math.min(100,Math.floor(loaded/total*100))+'%':''}`,total>0?loaded/total:null);
    };
    const base = asset.url.slice(0,asset.url.lastIndexOf('/')+1);
    if (asset.extension==='fbx') {
      const loader = new FBXLoader(manager);
      loader.trimAnimationClips=true;
      const buffer=await sourceBuffer(asset,{signal:loadSignal,onProgress:progress});
      loadSignal.throwIfAborted();
      return loader.parse(buffer,base);
    }
    if (asset.extension==='obj') return new OBJLoader(manager).loadAsync(asset.url,progress);
    const buffer=await sourceBuffer(asset,{signal:loadSignal,onProgress:progress});
    loadSignal.throwIfAborted();
    const gltf=await new GLTFLoader(manager).parseAsync(buffer,base);
    const root=gltf.scene; root.animations=gltf.animations;
    return root;
  };
  function disposeObject(root) {
    if (!root) return;
    root.traverse(node=>{
      node.geometry?.dispose();
      const materials=Array.isArray(node.material)?node.material:[node.material];
      for(const material of materials){if(!material)continue;for(const value of Object.values(material))if(value?.isTexture)value.dispose();material.dispose();}
      node.skeleton?.dispose();
    });
  }
  function resetCamera() {
    if(!wrapper)return;
    wrapper.updateMatrixWorld(true);
    model?.traverse(node=>{if(node.isSkinnedMesh)node.computeBoundingBox();});
    const box=new THREE.Box3().setFromObject(wrapper);
    if(box.isEmpty())wrapper.traverse(node=>{if(node.isBone)box.expandByPoint(node.getWorldPosition(new THREE.Vector3()));});
    if(box.isEmpty())box.set(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,2.6,1));
    const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const distance=Math.max(size.x/Math.max(camera.aspect,.25),size.y,size.z,1)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.35;
    camera.position.copy(center).add(frontDirection.clone().applyAxisAngle(new THREE.Vector3(0,1,0),.28).multiplyScalar(distance)).add(new THREE.Vector3(0,distance*.12,0));
    camera.near=Math.max(distance/1000,.001);camera.far=Math.max(distance*100,100);
    camera.updateProjectionMatrix();controls.target.copy(center);controls.update();controls.saveState();
  }
  function setPlaying(value) {
    playing=!!value&&!!activeAction;
    $('viewer-play').textContent=playing?'Pause':'Play';
    $('viewer-play').setAttribute('aria-label',playing?'Pause animation':'Play animation');
    host.dataset.playing=String(playing);
  }
  function updateTime() {
    const time=activeAction?Math.min(activeAction.time,duration):0;
    $('viewer-timeline').value=String(time);
    $('viewer-time').textContent=`${time.toFixed(2)} / ${duration.toFixed(2)} s`;
    host.dataset.animationTime=time.toFixed(3);
  }
  function playClip(index) {
    mixer.stopAllAction();
    const clip=clipList[index];
    duration=clip?.duration||0;
    activeAction=duration>0?mixer.clipAction(clip):null;
    if(activeAction){activeAction.setLoop(THREE.LoopRepeat,Infinity);activeAction.reset().play();mixer.update(0);}
    const enabled=!!activeAction;
    $('viewer-play').disabled=!enabled;
    $('viewer-timeline').disabled=!enabled;
    $('viewer-timeline').max=String(Math.max(duration,.001));
    setPlaying(enabled);updateTime();
  }
  function installClips(clips, message) {
    clipList=clips.filter(clip=>clip.duration>0&&clip.tracks.length);
    $('viewer-clip').innerHTML=clipList.length?clipList.map((clip,index)=>`<option value="${index}">${escapeHTML(clip.name||'Clip '+(index+1))} · ${clip.duration.toFixed(2)} s</option>`).join(''):'<option>No embedded animation</option>';
    $('viewer-clip').disabled=!clipList.length;
    host.dataset.clipCount=String(clipList.length);
    playClip(0);
    $('viewer-status').textContent=message+(missingTextures?` ${missingTextures} texture reference${missingTextures===1?' was':'s were'} not found; missing textures use a neutral fallback.`:'');
  }
  function compatibleClips(source) {
    const nodes=new Map(), sourceNodes=new Map();
    model.traverse(node=>{nodes.set(node.name,node);nodes.set(normalizeBone(node.name),node);});
    source.traverse(node=>sourceNodes.set(node.uuid,node));
    return (source.animations||[]).map(clip=>{
      const copy=clip.clone();copy.tracks=copy.tracks.flatMap(track=>{
        const parsed=THREE.PropertyBinding.parseTrackName(track.name);
        const name=sourceNodes.get(parsed.nodeName)?.name||parsed.objectIndex||parsed.nodeName;
        const target=nodes.get(name)||nodes.get(normalizeBone(name||''));
        if(!target||!['position','quaternion','scale','morphTargetInfluences'].includes(parsed.propertyName))return [];
        const cloned=track.clone();cloned.name=target.uuid+'.'+parsed.propertyName+(parsed.propertyIndex!==undefined?'['+parsed.propertyIndex+']':'');
        return [cloned];
      });return copy;
    }).filter(clip=>clip.tracks.length);
  }
  async function assignedClips(source, assignmentSignal=life.signal) {
    wrapper.remove(model);model.updateMatrixWorld(true);
    try{return await retargetClips(model,source,{signal:assignmentSignal,onProgress:async({clip,clipIndex,clipCount,frame,frames})=>{loading.update('캐릭터에 모션 적용 중…',`${clipIndex+1} / ${clipCount} 클립 · ${clip}`,(clipIndex+frame/(frames-1))/clipCount);await paintLoading();}});}
    finally{wrapper.add(model);wrapper.updateMatrixWorld(true);}
  }
  const resize=()=>{if(life.signal.aborted)return;const width=Math.max(stage.clientWidth,1),height=Math.max(stage.clientHeight,1);camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);};
  const observer=new ResizeObserver(resize);observer.observe(stage);resize();
  const listen=(id,event,fn)=>$(id).addEventListener(event,fn,{signal:life.signal});
  listen('viewer-reset','click',resetCamera);
  listen('viewer-skeleton','click',()=>{if(!skeleton)return;skeleton.visible=!skeleton.visible;$('viewer-skeleton').setAttribute('aria-pressed',String(skeleton.visible));});
  listen('viewer-wireframe','click',()=>{const enabled=$('viewer-wireframe').getAttribute('aria-pressed')!=='true';$('viewer-wireframe').setAttribute('aria-pressed',String(enabled));model?.traverse(node=>{if(!node.isMesh)return;for(const material of Array.isArray(node.material)?node.material:[node.material])material.wireframe=enabled;});});
  function setLook(mode) {
    $('viewer-look').value=mode;
    $('viewer-clay').setAttribute('aria-pressed',String(mode==='clay'));
    model?.traverse(node=>{
      if(!node.isMesh)return;
      if(!originalMaterials.has(node))originalMaterials.set(node,node.material);
      for(const material of Array.isArray(node.material)?node.material:[node.material])if(viewMaterials.has(material)){material.dispose();viewMaterials.delete(material);}
      node.material=originalMaterials.get(node);
      if(mode!=='studio'){
        const make=original=>{const material=mode==='lambert'?lambertMaterial(original):mode==='texture'?textureMaterial(original):new THREE.MeshStandardMaterial({color:'#b9bec7',roughness:.9,metalness:0,side:THREE.DoubleSide});material.wireframe=$('viewer-wireframe').getAttribute('aria-pressed')==='true';viewMaterials.add(material);return material;};
        const original=originalMaterials.get(node);
        node.material=Array.isArray(original)?original.map(make):make(original);
      }else{
        for(const material of Array.isArray(node.material)?node.material:[node.material])material.wireframe=$('viewer-wireframe').getAttribute('aria-pressed')==='true';
      }
    });
  }
  listen('viewer-look','change',()=>setLook($('viewer-look').value));
  listen('viewer-clay','click',()=>setLook($('viewer-clay').getAttribute('aria-pressed')!=='true'?'clay':'lambert'));
  listen('viewer-play','click',()=>setPlaying(!playing));
  listen('viewer-clip','change',()=>playClip(Number($('viewer-clip').value)));
  listen('viewer-timeline','input',()=>{if(!activeAction)return;setPlaying(false);activeAction.time=Math.min(Number($('viewer-timeline').value),Math.max(0,duration-.000001));mixer.update(0);updateTime();});
  let motionLife, motionQueue=Promise.resolve();const motionClipCache=new Map();
  life.signal.addEventListener('abort',()=>motionLife?.abort(),{once:true});
  function setMotion(asset) {
    const version=++sourceVersion;motionLife?.abort();motionLife=new AbortController();
    const motionSignal=motionLife.signal;
    motionQueue=motionQueue.catch(()=>{}).then(async()=>{
      if(life.signal.aborted||motionSignal.aborted||!model)return;
      setPlaying(false);mixer.stopAllAction();mixer.uncacheRoot(model);
      for(const [node,p,q,s] of bindPose){node.position.copy(p);node.quaternion.copy(q);node.scale.copy(s);}model.updateMatrixWorld(true);
      let source;const characterMissingTextures=missingTextures;
      host.dataset.motionReady='loading';
      try{
        if(!asset){installClips(embeddedClips,'이 모델의 내장 클립');host.dataset.motionReady='true';return;}
        const cacheKey=[asset.sourceHash||'',asset.modified||'',asset.url].join('|');
        if(motionClipCache.has(cacheKey)){
          const result=motionClipCache.get(cacheKey);installClips(result.clips,'캐시된 모션 재생 · '+asset.name);
          host.dataset.motionPath=asset.path;host.dataset.motionReady='true';return {clips:result.clips.map(c=>({name:c.name,duration:c.duration})),mappedBones:result.mappedBones};
        }
        source=await load(asset,motionSignal);
        motionSignal.throwIfAborted();
        const result=assignMotions||character?await assignedClips(source,motionSignal):{clips:compatibleClips(source)};
        motionSignal.throwIfAborted();
        if(!result.clips.length)throw new Error('이 골격에 적용할 수 있는 클립이 없습니다.');
        if(motionClipCache.size>=8)motionClipCache.delete(motionClipCache.keys().next().value);
        motionClipCache.set(cacheKey,result);
        host.dataset.mappedBones=String(result.mappedBones||0);
        installClips(result.clips,`웹 재생 확인 · ${asset.name}${result.mappedBones?' · '+result.mappedBones+'개 뼈 연결':''}`);
        host.dataset.motionPath=asset.path;host.dataset.motionReady='true';
        return {clips:result.clips.map(c=>({name:c.name,duration:c.duration})),mappedBones:result.mappedBones};
      }catch(error){
        if(!motionSignal.aborted&&!life.signal.aborted){host.dataset.motionReady='error';$('viewer-status').textContent=error.message;throw error;}
      }finally{disposeObject(source);missingTextures=characterMissingTextures;if(!life.signal.aborted&&version===sourceVersion)loading.finish();}
    });
    return motionQueue;
  }
  listen('viewer-source','change',()=>{void setMotion($('viewer-source').value==='embedded'?null:playable.find(a=>a.url===$('viewer-source').value)).catch(()=>{});});
  const animate=now=>{
    if(life.signal.aborted)return;
    const delta=Math.min((now-lastFrame)/1000,.1);lastFrame=now;
    if(mixer&&playing)mixer.update(delta*Number($('viewer-speed').value));
    controls.update(delta);renderer.render(scene,camera);
    if(now-lastTimeUpdate>80){updateTime();lastTimeUpdate=now;}
    frameRequest=requestAnimationFrame(animate);
  };
  const cleanup=()=>{
    if(disposed)return;disposed=true;
    life.abort();sourceVersion++;cancelAnimationFrame(frameRequest);observer.disconnect();
    mixer?.stopAllAction();if(model)mixer?.uncacheRoot(model);
    for(const [node,material] of originalMaterials)node.material=material;
    for(const material of viewMaterials)material.dispose();
    controls.dispose();disposeObject(model);skeleton?.geometry.dispose();skeleton?.material.dispose();
    grid.geometry.dispose();grid.material.dispose();environment.dispose();renderer.dispose();renderer.forceContextLoss();
    for(const url of blobURLs)URL.revokeObjectURL(url);
  };
  cleanup.setMotion=setMotion;
  cleanup.getEmbeddedClips=()=>embeddedClips.filter(c=>c.duration>0&&c.tracks.length).map((c,index)=>({name:c.name,duration:c.duration,index}));
  cleanup.playEmbedded=async index=>{await setMotion(null);if(!life.signal.aborted)playClip(index);};
  cleanup.captureThumbnail=()=>{
    if(!model||disposed)throw new Error('모델이 아직 준비되지 않았습니다.');
    const position=camera.position.clone(),target=controls.target.clone(),aspect=camera.aspect,pixelRatio=renderer.getPixelRatio();
    wrapper.updateMatrixWorld(true);
    const oldPlaying=playing;playing=false;grid.visible=false;
    const box=new THREE.Box3().setFromObject(wrapper),center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3());
    camera.aspect=384/448;
    const distance=Math.max(extent.y,extent.x/camera.aspect)/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.14;
    camera.position.copy(center).addScaledVector(frontDirection,distance);controls.target.copy(center);camera.lookAt(center);camera.updateProjectionMatrix();
    renderer.setPixelRatio(1);renderer.setSize(384,448,false);renderer.render(scene,camera);
    const data=renderer.domElement.toDataURL('image/png').split(',')[1];
    const blob=new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'image/png'});
    camera.position.copy(position);camera.aspect=aspect;controls.target.copy(target);camera.updateProjectionMatrix();controls.update();
    grid.visible=true;playing=oldPlaying;renderer.setPixelRatio(pixelRatio);resize();
    return blob;
  };
  cleanup.inspectClip=(clipIndex=0)=>{
    if(!clipList[clipIndex])throw new Error('재생 가능한 클립이 없습니다.');
    playClip(clipIndex);setPlaying(false);
    const frames=[],oldAspect=camera.aspect,oldRatio=renderer.getPixelRatio();
    camera.aspect=192/224;camera.updateProjectionMatrix();renderer.setPixelRatio(1);renderer.setSize(192,224,false);
    for(const fraction of [.17,.61]){
      activeAction.time=duration*fraction;mixer.update(0);updateTime();model.updateMatrixWorld(true);
      model.traverse(n=>{if(n.isSkinnedMesh)n.skeleton.update();});
      renderer.render(scene,camera);
      const pose=[];model.traverse(n=>{if(n.isBone)pose.push(...n.getWorldPosition(new THREE.Vector3()).toArray());});
      frames.push({time:activeAction.time,pose, image:renderer.domElement.toDataURL('image/png')});
    }
    const poseDelta=Math.max(...frames[0].pose.map((v,i)=>Math.abs(v-frames[1].pose[i])));
    camera.aspect=oldAspect;camera.updateProjectionMatrix();renderer.setPixelRatio(oldRatio);resize();
    setPlaying(true);
    return {clip:clipList[clipIndex].name,duration,poseDelta,frames:frames.map(({pose,...frame})=>frame),meshes:meshCount,bones:boneCount,missingTextures};
  };
  life.signal.addEventListener('abort',cleanup,{once:true});
  life.signal.addEventListener('abort',()=>cancelAnimationFrame(frameRequest),{once:true});
  frameRequest=requestAnimationFrame(animate);
  try {
    model=await load(loadedFile);
    if(life.signal.aborted){disposeObject(model);cleanup();return cleanup;}
    loading.update('모델 준비 중…',loadedFile.name);await paintLoading();
    if(life.signal.aborted){cleanup();return cleanup;}
    const directory=loadedFile.path.split('/').slice(0,-1).join('/');
    const mapFiles=(loadedFile.path.startsWith('Character/Final/')||loadedFile.provider==='rpg')?files.filter(asset=>asset.path.startsWith(directory+'/')&&(asset.kind==='image'||['png','jpg','jpeg','webp','tga'].includes(asset.extension))):[];
    const textureLoader=new THREE.TextureLoader(manager);
    const dataMap=pattern=>{const asset=mapFiles.find(asset=>pattern.test(asset.name));if(!asset)return null;const texture=textureLoader.load(asset.url);texture.colorSpace=THREE.NoColorSpace;return texture;};
    const pbrMaps={roughnessMap:dataMap(/_roughness\./i),metalnessMap:dataMap(/_metallic\./i)};
    const materials=new Map();
    model.traverse(node=>{if(!node.isMesh)return;const convert=material=>{if(!materials.has(material)){const replacement=previewMaterial(material,pbrMaps);materials.set(material,replacement);if(replacement!==material)material.dispose();}return materials.get(material);};node.material=Array.isArray(node.material)?node.material.map(convert):convert(node.material);});
    if(loadedFile.materialBindings&&Object.keys(loadedFile.materialBindings).length){
      loading.update('Unity 재질 연결 중…','GUID로 원본 텍스처를 연결합니다.');
      let unbound=0;
      const pending=[];
      model.traverse(node=>{if(!node.isMesh)return;for(const material of Array.isArray(node.material)?node.material:[node.material]){
        const binding=loadedFile.materialBindings[material.name];
        if(!binding?.baseColor){unbound++;continue;}
        const read=async(asset,color)=>{const loader=asset.extension==='tga'?new TGALoader(manager):new THREE.TextureLoader(manager);const texture=await loader.loadAsync(asset.url);texture.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;return texture;};
        pending.push((async()=>{material.map=await read(binding.baseColor,true);material.color.set(0xffffff);material.normalMap=binding.normal?await read(binding.normal,false):null;material.bumpMap=null;material.needsUpdate=true;})());
      }});
      await Promise.all(pending);if(!unbound)missingTextures=0;
    }
    if(motionFile&&file.pack==='EverydayMotionPack'){
      const props=[];model.traverse(node=>{if(node.isMesh&&!node.isSkinnedMesh&&node.name.startsWith('Prop_'))props.push(node);});
      for(const prop of props){prop.removeFromParent();disposeObject(prop);}
    }
    model.traverse(node=>{
      if(node.isBone)boneCount++;
      if(node.isMesh){meshCount++;node.frustumCulled=false;for(const material of Array.isArray(node.material)?node.material:[node.material]){material.side=THREE.DoubleSide;if(!material.map&&material.color?.getHex()===0)material.color.set('#b8a6c6');}}
    });
    // Some animation-only FBXs encode joints as Null/Limb groups, not Bone nodes.
    // Mark the hierarchy for SkeletonHelper only; animation tracks stay unchanged.
    if(!meshCount&&!boneCount)model.traverse(node=>{if(node!==model&&node.isGroup){node.isBone=true;boneCount++;}});
    model.updateMatrixWorld(true);
    if(assignMotions||loadedFile.provider==='rpg'){
      const joints=new Map();model.traverse(n=>{const role=boneRole(n.name);if(role&&!joints.has(role))joints.set(role,n);});
      if(['leftarm','rightarm','head','hips'].every(role=>joints.has(role))){
        const across=joints.get('leftarm').getWorldPosition(new THREE.Vector3()).sub(joints.get('rightarm').getWorldPosition(new THREE.Vector3()));
        const up=joints.get('head').getWorldPosition(new THREE.Vector3()).sub(joints.get('hips').getWorldPosition(new THREE.Vector3()));
        frontDirection.crossVectors(across,up);frontDirection.y=0;frontDirection.normalize();
      }
      if(loadedFile.viewYaw)frontDirection.applyAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(loadedFile.viewYaw));
      const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),frontDirection);
      key.position.copy(frontDirection).multiplyScalar(6).addScaledVector(right,5).add(new THREE.Vector3(0,8,0));
      fill.position.copy(frontDirection).multiplyScalar(3).addScaledVector(right,-5).add(new THREE.Vector3(0,3,0));
    }
    const box=new THREE.Box3().setFromObject(model);
    if(box.isEmpty())model.traverse(node=>{if(node.isBone)box.expandByPoint(node.getWorldPosition(new THREE.Vector3()));});
    if(box.isEmpty()||(meshCount===0&&boneCount===0))throw new Error('This file contains no visible mesh or bone hierarchy.');
    const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    const scale=2.6/Math.max(size.x,size.y,size.z,.01);
    wrapper=new THREE.Group();wrapper.scale.setScalar(scale);wrapper.position.set(-center.x*scale,-box.min.y*scale,-center.z*scale);wrapper.add(model);scene.add(wrapper);wrapper.updateMatrixWorld(true);
    if(boneCount){skeleton=new THREE.SkeletonHelper(model);skeleton.material.color.set('#ffc2cf');skeleton.material.vertexColors=false;skeleton.material.depthTest=false;skeleton.material.transparent=true;skeleton.material.opacity=.95;skeleton.visible=meshCount===0;scene.add(skeleton);$('viewer-skeleton').setAttribute('aria-pressed',String(skeleton.visible));}
    $('viewer-skeleton').disabled=!boneCount;
    bindPose=[];model.traverse(node=>bindPose.push([node,node.position.clone(),node.quaternion.clone(),node.scale.clone()]));
    mixer=new THREE.AnimationMixer(model);embeddedClips=model.animations||[];
    if(motionFile){
      let source;
      const characterMissingTextures=missingTextures;
      try{
        source=await load(motionFile);
        if(life.signal.aborted){disposeObject(source);cleanup();return cleanup;}
        // FBXLoader applies source up-axis to the container, outside clip tracks.
        // Use that same basis for a matching-rig character (Dialogue is Z-up).
        if(character){
          // Exclude the viewer's display scale/offset from rig-space conversion.
          const result=await assignedClips(source);embeddedClips=result.clips;host.dataset.mappedBones=String(result.mappedBones);
        }else{
          const sourceRootJoint=model.getObjectByName(source.name);
          if(sourceRootJoint&&sourceRootJoint!==model)model.quaternion.identity();
          else model.quaternion.copy(source.quaternion);
          embeddedClips=compatibleClips(source);
        }
        if(!embeddedClips.length)throw new Error('This motion does not match the selected preview character.');
      }finally{disposeObject(source);if(character)missingTextures=characterMissingTextures;}
    }
    await waitForTextures();
    if(life.signal.aborted){cleanup();return cleanup;}
    loading.update('화면 준비 중…','조명과 재질을 적용하는 중…');await paintLoading();
    if((missingTextures||(motionFile&&!character))&&meshCount)setLook('clay');else setLook('lambert');
    resetCamera();resize();loading.finish();
    $('viewer-stats').textContent=`${meshCount} ${meshCount===1?'mesh':'meshes'} · ${boneCount} bones`;
    host.dataset.meshCount=String(meshCount);host.dataset.boneCount=String(boneCount);host.dataset.loadedFile=loadedFile.path;
    installClips(embeddedClips,embeddedClips.length?(character?`캐릭터에 모션 적용 · ${host.dataset.mappedBones}개 뼈 연결 · 브라우저 리타게팅 미리보기`:motionFile?'Playing selected motion on its preview character.':meshCount?'Playing embedded animation.':'Animation-only file: displaying the animated skeleton.'):'Static model. Choose a compatible animation source to preview motion.');
    if(motionFile||(file.game==='companion'&&embeddedClips.length)){
      wrapper.scale.setScalar(1);wrapper.position.set(0,0,0);wrapper.updateMatrixWorld(true);
      model.traverse(node=>{if(node.isSkinnedMesh)node.computeBoundingBox();});
      const posedBox=new THREE.Box3().setFromObject(model);
      const posedSize=posedBox.getSize(new THREE.Vector3()),posedCenter=posedBox.getCenter(new THREE.Vector3());
      const posedScale=2.6/Math.max(posedSize.x,posedSize.y,posedSize.z,.01);
      wrapper.scale.setScalar(posedScale);wrapper.position.set(-posedCenter.x*posedScale,-posedBox.min.y*posedScale,-posedCenter.z*posedScale);wrapper.updateMatrixWorld(true);resetCamera();
    }
    host.dataset.viewerReady='true';
  }catch(error){if(!life.signal.aborted){loading.fail(error.message||'파일을 읽을 수 없습니다.');$('viewer-status').textContent=error.message||'The model format could not be decoded.';host.dataset.viewerReady='error';}}
  return cleanup;
}
