import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {characterTabs,filterArt,artCard,linkedArt,artComparison,createCharacterArtArchive,ART_API} from './skyhaven-character-art.mjs';
import {createCatalogCache} from './skyhaven-library-cache.mjs';
const original={path:'artwork/a.png',url:'https://source.example/a.png',sourceHash:'abc'};
const item={id:'Elara',name:'Elara',pack:'Village',package:'Fantasy Village',role:'마을 안내인',version:'corrected',status:'사용자 평가 85',approvalKind:'accepted',reason:'기존 평가 유지',width:832,height:1248,original,preview:original,assetId:'character:Elara'};
const catalog={available:true,date:'2026-10-28',counts:{characters:2,equipment:0},packs:{Village:{name:'Village'},BanditVillage:{name:'Bandit Village'}},items:[item,{...item,id:'scout',name:'Scout',pack:'BanditVillage',role:'정찰병',status:'후보',approvalKind:'curated',assetId:undefined}],comparisons:[{id:'Elara',name:'Elara',caption:'기존 비교',note:'새 평가 아님',before:item,after:item,prompt:{prompt:'Keep <identity>'}}]};
function dom(){const {JSDOM}=createRequire(import.meta.url)(process.env.JSDOM_PATH||'jsdom');const d=new JSDOM('<main id="main"></main>',{url:'https://site.example/#characters/art'});d.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};d.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new d.window.Event('close'));};return d;}
test('group and Korean role search include art-only characters',()=>{
  assert.deepEqual(filterArt(catalog,{query:'정찰병',pack:'BanditVillage'}).map(x=>x.id),['scout']);
  assert.equal(filterArt(catalog,{pack:'Village',query:'Elara 85'}).length,1);
  assert.match(characterTabs('art'),/원화/);assert.match(characterTabs('art'),/href="#characters"/);
});
test('original decisions are shown without promoting curation to approval or copying source media',()=>{
  const card=artCard(item,{hosted:true});assert.match(card,/사용자 평가 85/);assert.match(card,/data-live-src=/);assert.doesNotMatch(card,/\ssrc=/);
  assert.match(artCard(catalog.items[1]),/후보/);assert.match(linkedArt(catalog,'character:Elara'),/Elara/);assert.equal(linkedArt(catalog,'character:Unknown'),'');
  assert.match(artComparison(catalog.comparisons[0]),/Keep &lt;identity&gt;/);
});
test('gallery can browse offline metadata, filter, open direct artwork and preserve 3D link',async()=>{
  const d=dom(),host=d.window.document.querySelector('main');let calls=0;
  const view=createCharacterArtArchive({host,fetchJSON:async path=>{assert.equal(path,ART_API);calls++;return catalog;},isActive:()=>true,hosted:true,sourceOnline:()=>false,getURL:()=>d.window.location.href,replaceURL:url=>d.window.history.replaceState(null,'',url)});
  await view.render({selectedId:'Elara'});
  const roster=host.querySelector('.character-art-grid');
  await view.render({selectedId:'Elara'});assert.equal(host.querySelector('.character-art-grid'),roster);
  assert.equal(host.querySelectorAll('.character-art-card').length,2);assert.equal(host.querySelector('dialog').open,true);
  assert.match(host.querySelector('dialog').textContent,/원본 서버/);assert.match(host.querySelector('dialog').innerHTML,/#characters\/character%3AElara/);
  assert.match(host.querySelector('dialog').textContent,/사용한 프롬프트/);
  host.querySelector('[data-art-close]').click();host.querySelector('[data-art-pack="BanditVillage"]').click();
  assert.equal(host.querySelectorAll('.character-art-card').length,1);assert.match(d.window.location.search,/artPack=BanditVillage/);
  view.search('없는 원화');assert.equal(host.querySelectorAll('.character-art-card').length,0);
  await view.load();assert.equal(calls,1);view.hide();d.window.close();
});
test('late archive response cannot replace another category',async()=>{
  const d=dom(),host=d.window.document.querySelector('main');let active=true,resolve;
  const view=createCharacterArtArchive({host,fetchJSON:()=>new Promise(r=>{resolve=r;}),isActive:()=>active,getURL:()=>d.window.location.href});
  const task=view.render();active=false;view.hide();host.textContent='3D character';resolve(catalog);await task;
  assert.equal(host.textContent,'3D character');d.window.close();
});
test('site-hosted art, comparisons and original downloads work while the source is offline',async()=>{
  const d=dom(),host=d.window.document.querySelector('main');
  const staticFile={...original,url:'/artwork/media/abc.png',storage:'site'};
  const staticItem={...item,original:staticFile,preview:staticFile};
  const staticCatalog={...catalog,mediaStorage:'site',items:[staticItem],comparisons:[{...catalog.comparisons[0],before:staticItem,after:staticItem}]};
  const view=createCharacterArtArchive({host,fetchJSON:async()=>staticCatalog,isActive:()=>true,hosted:true,sourceOnline:()=>false,getURL:()=>d.window.location.href});
  await view.render({selectedId:'Elara'});
  assert.equal(host.querySelectorAll('[data-live-src],[data-live-href],[data-source-message]').length,0);
  assert.equal(host.querySelectorAll('img[src="/artwork/media/abc.png"]').length,4);
  assert.equal(host.querySelector('a[download]').getAttribute('href'),'/artwork/media/abc.png');
  assert.match(host.textContent,/원본 서비스 연결 없이/);
  view.hide();d.window.close();
});
test('art metadata persists across visits until explicit refresh and failed refresh keeps the last copy',async()=>{
  const saved=new Map(),storage={get:async key=>saved.get(key),put:async(key,v)=>saved.set(key,v),replace:async v=>{saved.clear();saved.set('snapshot',v);}};
  let revision=1,fail=false,calls=0;
  const fetchJSON=async url=>{calls++;if(fail)throw Error('offline');return url.endsWith('/motions')?{motions:[]}:url.includes('refresh=1')?{entities:[]}:{revision};};
  const first=createCatalogCache({api:'/library',storage,fetchJSON});await first.load();assert.equal((await first.read(ART_API)).revision,1);
  revision=2;const second=createCatalogCache({api:'/library',storage,fetchJSON});await second.load();assert.equal((await second.read(ART_API)).revision,1);assert.equal(calls,3);
  assert.equal((await second.read(ART_API,{refresh:true})).revision,2);fail=true;await assert.rejects(second.read(ART_API,{refresh:true}));assert.equal((await second.read(ART_API)).revision,2);
});
test('a late pre-refresh response cannot overwrite refreshed art metadata',async()=>{
  const saved=new Map(),storage={get:async key=>saved.get(key),put:async(key,v)=>saved.set(key,v),replace:async v=>saved.set('snapshot',v)};
  let finish,first=true;
  const cache=createCatalogCache({api:'/library',storage,fetchJSON:async url=>url.endsWith('/motions')?{motions:[]}:url.includes('refresh=1')?{entities:[]}:first?(first=false,new Promise(r=>{finish=r;})):{revision:2}});
  await cache.load();const old=cache.read(ART_API);await new Promise(r=>setImmediate(r));await cache.read(ART_API,{refresh:true});finish({revision:1});await old;assert.equal((await cache.read(ART_API)).revision,2);
});
