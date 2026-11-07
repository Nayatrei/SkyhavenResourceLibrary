import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {CHAT_ART_API,createGenesisChatArt,filterChatArt} from './skyhaven-genesis-chat-art.mjs';

const item=(pack,id)=>({id:JSON.stringify([pack,id]),kind:'character',packId:pack,profileId:id,name:'인물 '+id,nameEn:id,image:{path:`public/content/images/avatars/${pack}/${id}.webp`,url:`https://genesischat.online/content/images/avatars/${pack}/${id}.webp`,sourceHash:'abc',width:1024,height:1536}});
const catalog={date:'2026-11-06',packs:{a:{name:'가 팩',nameEn:'Pack A'},b:{name:'나 팩',nameEn:'Pack B'}},counts:{packs:2,characters:51,backgrounds:1,missingPortraits:1},items:[...Array.from({length:49},(_,i)=>item('a',String(i))),item('a','shared'),item('b','shared'),{...item('a','cover'),kind:'background'}]};
function setup(fetchJSON=async()=>catalog){
  const {JSDOM}=createRequire(import.meta.url)('jsdom');
  const d=new JSDOM('<main></main>',{url:'https://site.example/#characters/genesis-chat/characters'});
  d.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  d.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new d.window.Event('close'));};
  const host=d.window.document.querySelector('main');
  const view=createGenesisChatArt({host,fetchJSON,isActive:()=>true,getURL:()=>d.window.location.href,replaceURL:url=>d.window.history.replaceState(null,'',url),navigate:hash=>{d.window.location.hash=hash;}});
  return {d,host,view};
}

test('pack plus profile identity, Korean search and art kinds stay independent',()=>{
  assert.equal(filterChatArt(catalog,{query:'shared'}).length,2);
  assert.equal(filterChatArt(catalog,{query:'shared',pack:'b'}).length,1);
  assert.equal(filterChatArt(catalog,{query:'나 팩'}).length,1);
  assert.equal(filterChatArt(catalog,{kind:'backgrounds'}).length,1);
});

test('gallery paginates, filters packs and opens the exact composite profile without a live source service',async()=>{
  const {d,host,view}=setup(async path=>{assert.equal(path,CHAT_ART_API);return catalog;});
  await view.render();assert.equal(host.querySelectorAll('[data-chat-art-id]').length,48);
  assert.equal(host.querySelectorAll('img[data-live-src]').length,0);
  host.querySelector('[data-chat-page="next"]').click();assert.equal(host.querySelectorAll('[data-chat-art-id]').length,3);
  assert.equal(d.window.document.activeElement.dataset.chatPage,'previous');
  view.search('shared');assert.equal(host.querySelectorAll('[data-chat-art-id]').length,2);
  host.querySelector('[data-chat-pack="b"]').click();
  assert.equal(host.querySelectorAll('[data-chat-art-id]').length,1);
  assert.equal(new URL(d.window.location.href).searchParams.get('chatPack'),'b');
  assert.equal(d.window.document.activeElement,host.querySelector('[data-chat-pack="b"]'));
  assert.equal(host.querySelector('[data-chat-pack="b"]').getAttribute('aria-pressed'),'true');
  host.querySelector('[data-chat-art-id]').click();assert.equal(decodeURIComponent(d.window.location.hash.split('/').at(-1)),JSON.stringify(['b','shared']));
  await view.render({search:'shared',selectedId:JSON.stringify(['b','shared'])});
  assert.equal(host.querySelector('dialog img').getAttribute('src'),'https://genesischat.online/content/images/avatars/b/shared.webp');
  assert.match(host.querySelector('dialog').textContent,/SHA/);
  assert.equal(d.window.document.activeElement,host.querySelector('[data-chat-close]'));
  host.querySelector('[data-chat-close]').click();assert.equal(d.window.location.hash,'#characters/genesis-chat/characters');
  assert.equal(d.window.document.activeElement,host.querySelector('[data-chat-art-id]'));
  view.hide();d.window.close();
});

test('folder pills retain selection across views and refresh, and all packs clears the URL filter',async()=>{
  const {d,host,view}=setup();await view.render();
  const pills=()=>Array.from(host.querySelectorAll('[data-chat-pack]'));
  assert.equal(host.querySelector('select'),null);
  assert.deepEqual(pills().map(button=>button.dataset.chatPack),['','a','b']);
  host.querySelector('[data-chat-pack="a"]').click();
  assert.match(host.querySelector('[role="status"]').textContent,/50개 원화 · 1 \/ 2/);
  d.window.location.hash='#characters/genesis-chat/backgrounds';
  await view.render({view:'backgrounds'});
  assert.equal(host.querySelector('[data-chat-pack="a"]').getAttribute('aria-pressed'),'true');
  assert.equal(host.querySelectorAll('[data-chat-art-id]').length,1);
  await view.render({view:'backgrounds',refresh:true});
  assert.equal(host.querySelector('[data-chat-pack="a"]').getAttribute('aria-pressed'),'true');
  host.querySelector('[data-chat-pack=""]').click();
  assert.equal(new URL(d.window.location.href).searchParams.has('chatPack'),false);
  assert.equal(d.window.location.hash,'#characters/genesis-chat/backgrounds');
  assert.equal(d.window.document.activeElement,host.querySelector('[data-chat-pack=""]'));
  assert.equal(pills().filter(button=>button.getAttribute('aria-pressed')==='true').length,1);
  d.window.location.hash='#characters/genesis-chat/characters';
  await view.render();
  assert.match(host.querySelector('[role="status"]').textContent,/51개 원화/);
  view.hide();d.window.close();
});

test('background tab and direct selection preserve source dimensions and safe links',async()=>{
  const {d,host,view}=setup();await view.render({view:'backgrounds',selectedId:JSON.stringify(['a','cover'])});
  assert.equal(host.querySelectorAll('[data-chat-art-id]').length,1);
  assert.match(host.querySelector('dialog').textContent,/1024 × 1536/);
  assert.equal(host.querySelector('.genesis-chat-art').dataset.kind,'backgrounds');
  view.hide();d.window.close();
});

test('failed loads can retry and a departed view cannot be overwritten by a late request',async()=>{
  let calls=0;const {d,host,view}=setup(async()=>{if(++calls===1)throw new Error('offline');return catalog;});
  await view.render();assert.ok(host.querySelector('[data-chat-retry]'));
  host.querySelector('[data-chat-retry]').click();await new Promise(r=>setImmediate(r));
  assert.ok(host.querySelector('.genesis-chat-art'));
  view.hide();d.window.close();
  let finish;const later=setup(()=>new Promise(r=>{finish=r;}));const loading=later.view.render();later.view.hide();later.host.textContent='Other page';finish(catalog);await loading;
  assert.equal(later.host.textContent,'Other page');later.d.window.close();
});

test('untrusted labels are escaped and media must stay on the public GenesisChat image origin',async()=>{
  const unsafe={...item('a','unsafe'),name:'<script>bad()</script>',image:{...item('a','unsafe').image,url:'javascript:alert(1)'}};
  const {d,host,view}=setup(async()=>({...catalog,items:[unsafe]}));await view.render();
  assert.equal(host.querySelector('script'),null);assert.equal(host.querySelector('img'),null);
  assert.match(host.textContent,/<script>bad\(\)<\/script>/);view.hide();d.window.close();
});
