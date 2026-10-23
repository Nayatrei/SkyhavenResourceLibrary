import {readLocalFile} from './skyhaven-local-files.mjs?v=20261023-connect-v3';
const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',glb:'model/gltf-binary',gltf:'model/gltf+json',json:'application/json',txt:'text/plain',md:'text/plain',mp4:'video/mp4',webm:'video/webm',mp3:'audio/mpeg',wav:'audio/wav'};
export async function localResponse(request,scope,{read=readLocalFile}={}){
  const prefix=new URL('__local/',scope).pathname,url=new URL(request.url);
  if(url.origin!==new URL(scope).origin||!url.pathname.startsWith(prefix))return null;
  if(!['GET','HEAD'].includes(request.method))return new Response('Read only',{status:405,headers:{Allow:'GET, HEAD'}});
  try{
    const relative=decodeURIComponent(url.pathname.slice(prefix.length)),split=relative.indexOf('/');
    if(split<1)throw new Error('Invalid local path');
    const file=await read(relative.slice(0,split),relative.slice(split+1));
    const headers=new Headers({'Content-Type':file.type||MIME[file.name.split('.').at(-1).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Content-Disposition':"inline; filename*=UTF-8''"+encodeURIComponent(file.name)});
    let body=file,status=200;
    const range=request.headers.get('range');
    if(range){
      const match=/^bytes=(\d*)-(\d*)$/.exec(range);
      const start=match?(match[1]?Number(match[1]):Math.max(0,file.size-Number(match[2]))):-1;
      const end=match?(match[1]&&match[2]?Math.min(Number(match[2]),file.size-1):file.size-1):-1;
      if(!match||(!match[1]&&!match[2])||start<0||start>=file.size||end<start)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+file.size}});
      body=file.slice(start,end+1);status=206;headers.set('Content-Range',`bytes ${start}-${end}/${file.size}`);
    }
    headers.set('Content-Length',String(body.size));
    return new Response(request.method==='HEAD'?null:body.stream(),{status,headers});
  }catch(error){
    const permission=error.name==='NotAllowedError';
    return Response.json({error:permission?'폴더 연결에서 로컬 폴더의 읽기 권한을 허용해 주세요.':error.name==='NotFoundError'?'연결한 폴더에서 파일을 찾지 못했습니다. Dropbox 동기화와 루트 위치를 확인해 주세요.':error.message},{status:permission?403:404,headers:{'X-Skyhaven-Local-Error':'1','Cache-Control':'no-store'}});
  }
}
