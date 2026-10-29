import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createSourceStatus,loadHostedDeployment,sourceExplanation,installSourceStatus} from './skyhaven-source-status.mjs';
import {createRequire} from 'node:module';
import {createLibraryTransport} from './skyhaven-data-source.mjs';

test('fresh browser loads hosted metadata without a local folder or image copy',async()=>{
  const spec={mode:'hosted-catalog',origin:'https://source.example'},routes={'/comfy/skyhaven/api/library':'data/catalog.json'};
  const deployment=await loadHostedDeployment(spec,{base:'https://site.example/',fetcher:async url=>{assert.equal(url.href,'https://site.example/data/current.json');return Response.json({...spec,routes,revision:'1'});}});
  const transport=createLibraryTransport({deployment,base:'https://site.example/'});
  assert.equal(transport.endpoint('/comfy/skyhaven/api/library'),'https://site.example/data/catalog.json');
  assert.equal(transport.endpoint('https://source.example/comfy/skyhaven/files/a.json'),'https://source.example/comfy/skyhaven/files/a.json');
  assert.equal(transport.writable,false);
});
test('ONLINE requires the exact health marker, not browser connectivity or a HTML login',async()=>{
  for(const [response,expected] of [[Response.json({service:'skyhaven'}),'online'],[Response.json({other:true}),'offline'],[new Response('offline',{status:503}),'offline']]){
    const status=createSourceStatus({origin:'https://source.example',fetcher:async()=>response});
    assert.equal(await status.check(),expected);assert.equal(status.online,expected==='online');
  }
  const unknown=createSourceStatus({origin:'https://source.example',fetcher:async()=>{throw new TypeError('CORS/network');}});
  assert.equal(await unknown.check(),'unknown');
});
test('static character-art route and version survive a later source metadata publication',async()=>{
  const spec={mode:'hosted-catalog',origin:'https://source.example',characterArt:{catalog:'artwork/catalog.json',revision:'art-v2'}};
  const deployment=await loadHostedDeployment(spec,{base:'https://site.example/',fetcher:async()=>Response.json({mode:spec.mode,origin:spec.origin,revision:'later-source',routes:{'/comfy/skyhaven/api/library/art-archive':'data/old-art.json'}})});
  const transport=createLibraryTransport({deployment,base:'https://site.example/'});
  assert.equal(transport.endpoint('/comfy/skyhaven/api/library/art-archive'),'https://site.example/artwork/catalog.json');
  assert.equal(deployment.revision,'later-source:art:art-v2');
});
test('duplicate probes share one request and source failures do not request metadata',async()=>{
  const checks=[];let calls=0,finish;const status=createSourceStatus({origin:'https://source.example',onCheck:checking=>checks.push(checking),fetcher:url=>{calls++;assert.match(url,/api\/health$/);return new Promise(resolve=>{finish=resolve;});}});
  const first=status.check(),second=status.check();finish(Response.json({service:'skyhaven'}));
  assert.equal(await first,'online');assert.equal(await second,'online');assert.equal(calls,1);
  assert.deepEqual(checks,[true,false]);
});

test('HTML and broken health JSON are invalid responses, while aborted reads remain timeouts',async()=>{
  for(const response of [new Response('<html>Sign in</html>'),new Response('{broken'),Response.json(null)]){
    const status=createSourceStatus({origin:'https://source.example',fetcher:async()=>response});
    assert.equal(await status.check(),'offline');assert.equal(status.reason,'invalid-response');
  }
  const status=createSourceStatus({origin:'https://source.example',timeoutMs:5,fetcher:async(_url,{signal})=>({ok:true,json:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))})});
  assert.equal(await status.check(),'offline');assert.equal(status.reason,'timeout');
  const interrupted=createSourceStatus({origin:'https://source.example',fetcher:async()=>({ok:true,json:async()=>{throw new TypeError('Connection lost');}})});
  assert.equal(await interrupted.check(),'unknown');assert.equal(interrupted.reason,'network');
});
test('diagnostics distinguish upstream HTTP, network and timeout and recover without claiming success',async()=>{
  let mode='network';
  const status=createSourceStatus({origin:'https://source.example',fetcher:async()=>{
    if(mode==='network')throw new TypeError('Failed to fetch');
    if(mode==='timeout')throw new DOMException('Timed out','AbortError');
    return mode==='online'?Response.json({service:'skyhaven'}):new Response('bad gateway',{status:502});
  }});
  assert.equal(await status.check(),'unknown');assert.equal(status.reason,'network');
  assert.match(sourceExplanation(status.reason),/8187/);assert.equal(status.online,false);
  mode='http';await status.check();assert.equal(status.reason,'http-502');assert.match(sourceExplanation(status.reason),/502/);
  mode='timeout';await status.check();assert.equal(status.reason,'timeout');
  mode='online';await status.check();assert.equal(status.reason,'');assert.equal(status.online,true);
});

test('DOM: explicit recheck shows progress, deduplicates, recovers media and preserves keyboard access',async()=>{
  const {JSDOM}=createRequire(import.meta.url)(process.env.JSDOM_PATH||'jsdom');
  const dom=new JSDOM('<div id="source-slot"></div><main id="main"><input id="search" value="castle"><img data-live-src="https://source.example/a.png"></main>',{pretendToBeVisual:true});
  const saved={fetch:globalThis.fetch,MutationObserver:globalThis.MutationObserver,addEventListener:globalThis.addEventListener};
  let requests=0,finish,connected=0;
  globalThis.fetch=()=>{requests++;return new Promise(resolve=>{finish=resolve;});};
  globalThis.MutationObserver=dom.window.MutationObserver;globalThis.addEventListener=(...args)=>dom.window.addEventListener(...args);
  try{
    const doc=dom.window.document,status=installSourceStatus({deployment:{mode:'hosted-catalog',origin:'https://source.example',publishedAt:'2026-10-26'},document:doc,onConnect:()=>connected++});
    const badge=doc.querySelector('.source-status'),retry=doc.querySelector('.source-retry'),panel=doc.querySelector('.source-connection-panel');
    assert.equal(retry.disabled,true);assert.equal(badge.getAttribute('aria-busy'),'true');
    finish(new Response('Unavailable',{status:503}));await status.check();
    badge.click();const pending=status.check();
    assert.equal(panel.hidden,false);assert.equal(requests,2);assert.equal(retry.disabled,true);
    assert.match(doc.querySelector('[role="status"]').textContent,/기다리고/);
    retry.click();assert.equal(requests,2);
    finish(Response.json({service:'skyhaven'}));await pending;
    assert.equal(retry.disabled,false);assert.equal(badge.getAttribute('aria-busy'),'false');
    assert.match(doc.querySelector('.source-check-time').textContent,/마지막 연결 확인/);
    assert.equal(doc.querySelector('img').getAttribute('src'),'https://source.example/a.png');assert.equal(connected,1);
    retry.click();finish(Response.json({service:'skyhaven'}));await status.check();assert.equal(connected,1);
    assert.equal(doc.querySelector('#search').value,'castle');
    retry.focus();retry.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    assert.equal(panel.hidden,true);assert.equal(doc.activeElement,badge);assert.equal(badge.getAttribute('aria-expanded'),'false');
    Object.defineProperty(doc,'hidden',{configurable:true,value:true});doc.dispatchEvent(new dom.window.Event('visibilitychange'));assert.equal(requests,3);
    Object.defineProperty(doc,'hidden',{configurable:true,value:false});doc.dispatchEvent(new dom.window.Event('visibilitychange'));assert.equal(requests,4);
    finish(Response.json({service:'skyhaven'}));await status.check();
  }finally{
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();Object.assign(globalThis,saved);
  }
});
test('normal previews cannot persist or batch-generate thumbnails',async()=>{
  const source=await readFile(new URL('./skyhaven-library.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(source,/captureThumbnail|buildThumbnails|build-thumbnails/);
  assert.match(source,/if\(!sourceAvailable\(\)\)/);
});
test('DOM: installed status controls reveal the launcher offline and recover source media online',async()=>{
  const {JSDOM}=createRequire(import.meta.url)(process.env.JSDOM_PATH||'jsdom');
  const dom=new JSDOM('<div id="source-slot"></div><main id="main"><img data-live-src="https://source.example/a.png"><p data-source-message></p></main>');
  const saved={fetch:globalThis.fetch,MutationObserver:globalThis.MutationObserver,addEventListener:globalThis.addEventListener};
  let fail=true,connected=0,disconnected=0;
  globalThis.fetch=async()=>{if(fail)throw new TypeError('Failed to fetch');return Response.json({service:'skyhaven'});};
  globalThis.MutationObserver=dom.window.MutationObserver;
  globalThis.addEventListener=(...args)=>dom.window.addEventListener(...args);
  try{
    const doc=dom.window.document;
    const status=installSourceStatus({deployment:{mode:'hosted-catalog',origin:'https://source.example',publishedAt:'2026-10-26'},document:doc,onConnect:()=>connected++,onDisconnect:()=>disconnected++});
    await status.check();
    assert.equal(doc.body.dataset.sourceState,'unknown');assert.equal(disconnected,1);
    assert.equal(doc.querySelector('img').getAttribute('src'),null);
    doc.querySelector('.source-status').click();await status.check();
    assert.equal(doc.querySelector('.source-connection-panel').hidden,false);
    assert.equal(doc.querySelector('.source-launch').getAttribute('href'),'skyhaven-source://start');
    assert.match(doc.querySelector('[data-source-message]').textContent,/8187/);
    fail=false;await status.check();
    assert.equal(connected,1);assert.equal(doc.body.dataset.sourceState,'online');
    assert.equal(doc.querySelector('img').getAttribute('src'),'https://source.example/a.png');
    assert.equal(doc.querySelector('.source-launch').hidden,true);
  }finally{
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));dom.window.close();Object.assign(globalThis,saved);
  }
});
