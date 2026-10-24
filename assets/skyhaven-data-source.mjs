const LIBRARY='/comfy/skyhaven/api/library';
export function createLibraryTransport({deployment=null,base=globalThis.location?.href,fetcher=globalThis.fetch}={}){
  function endpoint(path){
    if(!deployment)return new URL(path,base).href;
    const url=new URL(path,base),key=url.pathname,value=deployment.routes[key];
    if(!value&&deployment.mode==='hosted-catalog'&&url.origin===deployment.origin&&key.startsWith('/comfy/skyhaven/'))return url.href;
    if(!value)throw new Error('게시된 색인에 없는 요청입니다: '+key);
    return new URL(value,base).href;
  }
  return {
    api:LIBRARY,writable:!deployment,deployment,
    pageURL:()=>deployment?new URL('./',base).href:new URL('/comfy/skyhaven/',base).href,
    endpoint,
    async json(path,options){const response=await fetcher(endpoint(path),options);if(!response.ok)throw new Error(`목록을 읽을 수 없습니다 (${response.status}).`);return response.json();},
  };
}
