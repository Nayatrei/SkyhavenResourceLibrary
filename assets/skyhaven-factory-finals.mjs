export const factoryOrigin='https://3d.genesisframeworks.com';
export const factoryCatalog=factoryOrigin+'/comfy/api/skyhaven/final-characters';

// Only the final-only service may publish these records. Never scan the workbench.
export function finalEntities(payload){
  if(payload?.schemaVersion!==1||!Array.isArray(payload.entities))throw Error('최종 FBX 목록 형식을 확인해 주세요.');
  const safeURL=value=>{const url=new URL(value,factoryOrigin);if(url.origin!==factoryOrigin||!url.pathname.startsWith('/comfy/api/skyhaven/'))throw Error('최종 FBX 전용 파일 경로가 아닙니다.');return url.href;};
  return payload.entities.map(entity=>{
    if(!entity.id||entity.category!=='characters'||!Array.isArray(entity.variants))throw Error('최종 캐릭터 연결을 확인해 주세요.');
    const variants=entity.variants.map(v=>{
      if(v.model?.extension!=='fbx'||!v.model.sourceHash)throw Error('최종 FBX와 해시가 필요합니다.');
      const file=f=>({...f,url:safeURL(f.url)});
      const model=file(v.model);
      if(model.materialBindings)model.materialBindings=Object.fromEntries(Object.entries(model.materialBindings).map(([name,b])=>[name,Object.fromEntries(Object.entries(b).map(([key,f])=>[key,f?.url?file(f):f]))]));
      return {...v,factoryFinal:true,model,textures:(v.textures||[]).map(file)};
    });
    return {...entity,id:'factory:'+entity.id,origin:'3DFactory final',factoryFinal:true,variants,related:[],aliases:entity.aliases||[]};
  });
}

export async function loadFactoryFinals({fetcher=globalThis.fetch,timeoutMs=8000}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetcher(factoryCatalog,{signal:controller.signal,cache:'no-store',credentials:'omit'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const payload=await response.json();
    return {entities:finalEntities(payload),issues:payload.issues||[],error:null};
  }catch(error){return {entities:[],issues:[],error:'캐릭터팀 최종 FBX 연결 확인 필요 · '+(error.name==='AbortError'?'응답 시간 초과':error.message)};}
  finally{clearTimeout(timer);}
}
