import test from 'node:test';
import assert from 'node:assert/strict';
import {finalEntities,loadFactoryFinals} from './skyhaven-factory-finals.mjs';
const payload=()=>({schemaVersion:1,entities:[{id:'asset',name:'Ai',category:'characters',variants:[{id:'SQ',rig:'unknown',model:{extension:'fbx',sourceHash:'abc',url:'/comfy/api/skyhaven/files/token/model.fbx'},textures:[]}]}]});
test('only final FBX records; retain actual rig state and source hash',()=>{
 const [e]=finalEntities(payload());assert.equal(e.id,'factory:asset');assert.equal(e.variants[0].rig,'unknown');assert.equal(e.variants[0].model.sourceHash,'abc');assert.equal(e.factoryFinal,true);
});
test('reject workbench URLs and foreign origins, including texture bindings',()=>{
 for(const url of ['https://elsewhere.test/comfy/api/skyhaven/files/x','/comfy/api/output/private.fbx']){const p=payload();p.entities[0].variants[0].model.url=url;assert.throws(()=>finalEntities(p));}
 const p=payload();p.entities[0].variants[0].model.materialBindings={Body:{baseColor:{url:'/comfy/api/output/private.png'}}};assert.throws(()=>finalEntities(p));
});
test('reject intermediate formats and surface service failures without fallback candidates',async()=>{
 const p=payload();p.entities[0].variants[0].model.extension='glb';assert.throws(()=>finalEntities(p));
 const result=await loadFactoryFinals({fetcher:async()=>({ok:false,status:503})});assert.deepEqual(result.entities,[]);assert.match(result.error,/503/);
});
test('screenshots must match this model hash; never use concept art as the thumbnail',()=>{
 const p=payload(),v=p.entities[0].variants[0];
 v.thumbnail={ready:true,url:'https://elsewhere.test/art.png'};
 v.images=[{view:'front',modelHash:'old model',url:'/comfy/api/skyhaven/files/old/front.png'},
  {view:'back',modelHash:'abc',url:'/comfy/api/skyhaven/files/current/back.png'},
  {view:'front',modelHash:'abc',url:'/comfy/api/skyhaven/files/current/front.png'}];
 const result=finalEntities(p)[0].variants[0];
 assert.equal(result.images.length,2);assert.match(result.thumbnail.url,/current\/front.png$/);
 assert.equal(result.rig,'unknown');
 v.images=[{view:'front',modelHash:'abc',url:'https://elsewhere.test/fake.png'}];
 assert.throws(()=>finalEntities(p));
});
