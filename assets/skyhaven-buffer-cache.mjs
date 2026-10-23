// Cache source bytes, never disposed Three.js objects. Each viewer owns its GPU resources.
const buffers=new Map();
let size=0;
const MAX=192*1024*1024;
globalThis.addEventListener?.('skyhaven-local-roots-changed',()=>{buffers.clear();size=0;});
export async function sourceBuffer(asset,{signal,onProgress=()=>{}}={}) {
  signal?.throwIfAborted();
  const key=[asset.sourceHash||'',asset.modified||'',asset.size||'',asset.url].join('|');
  if(buffers.has(key)){
    const value=buffers.get(key);buffers.delete(key);buffers.set(key,value);
    onProgress({loaded:value.byteLength,total:value.byteLength,lengthComputable:true});
    return value;
  }
  let response;
  for(let attempt=0;attempt<3;attempt++){
    try{
      response=await fetch(asset.url,{signal});
      if(response.status<500||attempt===2)break;
      await response.body?.cancel();
    }catch(error){if(signal?.aborted||attempt===2)throw error;}
    onProgress({retry:attempt+1});
    await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,700*(attempt+1));signal?.addEventListener('abort',()=>{clearTimeout(timer);reject(signal.reason);},{once:true});});
  }
  if(!response.ok){const local=response.headers.get('X-Skyhaven-Local-Error');throw new Error(local?(await response.json()).error:`파일 다운로드 실패 (${response.status})`);}
  const total=Number(response.headers.get('content-length'))||asset.size||0;
  const reader=response.body?.getReader();
  let buffer;
  if(reader){
    const chunks=[];let loaded=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);loaded+=value.length;onProgress({loaded,total,lengthComputable:total>0});}
    const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}buffer=bytes.buffer;
  }else buffer=await response.arrayBuffer();
  signal?.throwIfAborted();
  if(buffer.byteLength<=MAX){
    while(size+buffer.byteLength>MAX&&buffers.size){const first=buffers.keys().next().value;size-=buffers.get(first).byteLength;buffers.delete(first);}
    buffers.set(key,buffer);size+=buffer.byteLength;
  }
  return buffer;
}
