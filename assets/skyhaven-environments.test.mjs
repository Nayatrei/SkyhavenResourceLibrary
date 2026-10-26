import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {environmentPacks,defaultEnvironmentPack,packSummaryRows,createEnvironmentView,environmentSnapshot} from './skyhaven-environments.mjs';
const p={id:'DETAILED-MedievalCastle',name:'DETAILED · Medieval Castle',category:'environments',group:'DETAILED',game:'shared',root:'Assets/Polygon/DETAILED/MCastle',availability:'local',cover:{url:'https://source.test/castle.png'},sourceStats:{models:373,folderBytes:1024,maxTextureEdge:8192},count:541};
const items=[{id:'a',assetType:'model',name:'Wall',path:'Assets/Wall.fbx',category:'Walls',kind:'static',sourceBytes:100,models:['Assets/Wall.fbx'],thumbnailUrl:'https://source.test/wall.png'}, {id:'t',assetType:'texture',name:'Stone',path:'Assets/Stone.png',category:'Stone',kind:'static',textureMetrics:{width:2048},sourceBytes:200}, {id:'b',assetType:'prefab',name:'Castle Block',path:'Assets/Castle.prefab',category:'Buildings',kind:'static',models:['Assets/Wall.fbx'],sourceBytes:150}];
const data={entities:[],packs:[{id:'farm',name:'Farm',category:'environments',group:'POLYGON',game:'shared'},p],motionCount:0};
test('environment family, game and query filters share catalog rules and default to a real local pack',()=>{
  assert.deepEqual(environmentPacks(data,{game:'all',group:'DETAILED',query:''}).map(p=>p.id),[p.id]);
  assert.equal(environmentPacks(data,{game:'skyhaven',group:'',query:''}).length,0);
  assert.equal(defaultEnvironmentPack(environmentPacks(data,{game:'all',group:'',query:''})).id,p.id);
  assert.equal(defaultEnvironmentPack([]),undefined);
});
test('inspector reports measured values and never fabricates the target author or license',()=>{
  const values=Object.fromEntries(packSummaryRows(p,items).map(([,k,v])=>[k,v]));
  assert.equal(values.Author,'Not indexed');assert.equal(values.License,'See source terms');
  assert.equal(values.Models,'373');assert.equal(values['Total Size'],'1 KiB');assert.match(values.Formats,/FBX/);
  assert.equal(Object.fromEntries(packSummaryRows({...p,publisher:'Verified Artist',license:'Recorded terms'},items).map(([,k,v])=>[k,v])).Author,'Verified Artist');
});
test('own environments and original file links remain alongside store packs',()=>{
  const entity={id:'environment:Homestead',name:'Homestead',category:'environments',group:'My environments',game:'skyhaven',resourcePath:'Library/Environments/Homestead',related:[{name:'House.glb',path:'Library/Environments/Homestead/House.glb',extension:'glb',size:50}],sceneEntries:[]};
  const entries=environmentPacks({...data,entities:[entity]},{game:'skyhaven',group:'',query:''});
  assert.equal(entries.length,1);assert.equal(entries[0].id,entity.id);assert.equal(entries[0].isEntity,true);
  const result=environmentSnapshot(entity);assert.equal(result.pack.root,entity.resourcePath);
  assert.equal(result.items[0].path,entity.related[0].path);assert.equal(result.items[0].assetType,'model');
});
test('command environment has a scene, inspector, horizontal dock and functional type tabs',()=>{
  const {JSDOM}=createRequire(import.meta.url)(process.env.JSDOM_PATH||'jsdom');
  const dom=new JSDOM('<main id="main"></main><aside id="navigator"></aside>',{url:'https://site.test'}),doc=dom.window.document;
  const previous=globalThis.localStorage;globalThis.localStorage=dom.window.localStorage;
  try{
    let chosen,query,owned;const state={game:'all',group:'',query:''};
    const view=createEnvironmentView({host:doc.querySelector('main'),navigatorHost:doc.querySelector('aside'),getCatalog:()=>data,getState:()=>state,hosted:true,onPack:id=>chosen=id,onQuery:value=>{query=value;state.query=value;},onOwned:value=>owned=value,itemImage:i=>`<img data-live-src="${i.thumbnailUrl||'https://source.test/fallback.png'}" alt="">`});
    view.render({pack:p,items,scenes:[]});
    assert.equal(doc.querySelectorAll('.rts-toolbar').length,1);assert.equal(doc.querySelectorAll('.rts-scene-stage').length,1);
    assert.equal(doc.querySelectorAll('.rts-inspector').length,1);assert.equal(doc.querySelectorAll('.rts-dock-card').length,2);
    assert.equal(doc.querySelector('.rts-scene-art img').getAttribute('src'),null);
    doc.querySelector('[data-rts-pack="farm"]').click();assert.equal(chosen,'farm');
    doc.querySelector('[data-rts-tab="models"]').click();assert.equal(view.mode,'models');
    assert.equal(doc.querySelectorAll('.rts-dock-card').length,1);
    doc.querySelector('[data-rts-item="a"]').click();
    assert.equal(doc.querySelector('.rts-copy-path').dataset.copy,'Assets/Wall.fbx');
    const favorite=doc.querySelector('[data-rts-favorite]');favorite.click();
    assert.deepEqual(JSON.parse(localStorage.getItem('skyhaven.libraryFavorites')),['a']);
    doc.querySelector('#rts-search').value='Wall';doc.querySelector('#rts-search').dispatchEvent(new dom.window.Event('input'));assert.equal(query,'Wall');
    doc.querySelector('#rts-search').focus();doc.querySelector('#rts-search').setSelectionRange(3,3);view.refresh();
    assert.equal(doc.activeElement.id,'rts-search');assert.equal(doc.activeElement.selectionStart,3);
    view.showCollections();view.refresh();assert.equal(view.mode,'packs');
    doc.querySelector('[data-rts-scenes]').click();assert.equal(doc.querySelector('[data-rts-tab="scene"]').getAttribute('aria-pressed'),'true');
    doc.querySelector('[data-rts-scenes]').click();
    doc.querySelector('[data-rts-zoom="in"]').click();assert.match(doc.querySelector('.rts-scene-art').style.transform,/1.25/);
    doc.querySelector('[data-rts-zoom="reset"]').click();assert.match(doc.querySelector('.rts-scene-art').style.transform,/scale\(1\)/);
    doc.querySelector('#navigator [data-rts-owned]').click();assert.equal(owned,'Dekogon');
    view.render(null);assert.match(doc.querySelector('.rts-inspector').textContent,/No collection/);
  }finally{globalThis.localStorage=previous;dom.window.close();}
});
