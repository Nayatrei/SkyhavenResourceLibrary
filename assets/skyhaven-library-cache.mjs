// Catalog metadata only. Models and textures retain their existing source cache.
export function browserCatalogStorage(indexedDB=globalThis.indexedDB){
  let connection;
  async function database(){
    if(!indexedDB)return null;
    connection??=new Promise((resolve,reject)=>{
      const request=indexedDB.open('skyhaven-library',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('catalog');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(new Error('Catalog storage is blocked'));
    });
    return connection;
  }
  async function operation(mode,work){
    const db=await database();if(!db)return undefined;
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction('catalog',mode),request=work(transaction.objectStore('catalog'));
      transaction.oncomplete=()=>resolve(request?.result);
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error);
    });
  }
  return {
    get:key=>operation('readonly',store=>store.get(key)),
    put:(key,value)=>operation('readwrite',store=>store.put(value,key)),
    replace:snapshot=>operation('readwrite',store=>{store.clear();return store.put(snapshot,'snapshot');}),
    available:!!indexedDB,
  };
}
export function createCatalogCache({api,fetchJSON,storage=browserCatalogStorage(),schema=1}){
  let snapshot,persistent=storage.available!==false;
  const memory=new Map();
  async function stored(action){try{return await action();}catch{persistent=false;return undefined;}}
  const valid=s=>s?.schema===schema&&s.data?.entities&&Array.isArray(s.motions);
  return {
    get persistent(){return persistent;},
    async load(){
      const saved=await stored(()=>storage.get('snapshot'));
      if(valid(saved)){snapshot=saved;return {...saved,local:true};}
      return this.refresh();
    },
    async refresh({signal}={}){
      const data=await fetchJSON(api+'?refresh=1',{signal,cache:'no-store'});
      const {motions}=await fetchJSON(api+'/motions',{signal,cache:'no-store'});
      signal?.throwIfAborted();
      const next={schema,generation:globalThis.crypto.randomUUID(),savedAt:new Date().toISOString(),data,motions};
      // Replace both indexes atomically; a failed fetch never removes the last copy.
      await stored(()=>storage.replace(next));snapshot=next;memory.clear();
      return {...next,local:false};
    },
    async read(url,{signal}={}){
      signal?.throwIfAborted();const generation=snapshot?.generation,key='detail:'+url;
      if(memory.has(key))return memory.get(key);
      const saved=await stored(()=>storage.get(key));signal?.throwIfAborted();
      if(saved?.generation===generation&&generation){memory.set(key,saved.value);return saved.value;}
      const value=await fetchJSON(url,{signal});signal?.throwIfAborted();
      if(snapshot?.generation===generation){memory.set(key,value);await stored(()=>storage.put(key,{generation,value}));}
      signal?.throwIfAborted();
      return value;
    },
  };
}
