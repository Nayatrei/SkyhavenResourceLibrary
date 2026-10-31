import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({resolve(specifier,context,next){return specifier==='three'?{url:new URL('../vendor/three/build/three.module.js',import.meta.url).href,shortCircuit:true}:next(specifier,context);}});
const THREE=await import('three');
const {inspectMotionRig}=await import('./skyhaven-retarget.mjs');
const {candidateMotions}=await import('./skyhaven-library-state.mjs');
test('names alone cannot animate an unskinned final FBX',()=>{
 const root=new THREE.Group();const hips=new THREE.Bone();hips.name='Hips';root.add(hips);
 assert.equal(inspectMotionRig(root).humanoid,false);
});
test('a weighted humanoid can try shared motions without claiming Unity importer validation',()=>{
 const root=new THREE.Group(),names=['Hips','Spine','Head','LeftArm','LeftForeArm','RightArm','RightForeArm','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot'];
 const bones=names.map(name=>{const b=new THREE.Bone();b.name=name;root.add(b);return b;});
 const geo=new THREE.BufferGeometry();geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute([1,0,0,0],4));
 const mesh=new THREE.SkinnedMesh(geo,new THREE.MeshBasicMaterial());mesh.skeleton=new THREE.Skeleton(bones);root.add(mesh);
 const webRig=inspectMotionRig(root);assert.equal(webRig.humanoid,true);
 const variant={rig:'unknown',webRig,model:{path:'final.fbx'}};
 const motion={rig:'Humanoid',name:'Walk',path:'shared/walk.fbx'};
 assert.deepEqual(candidateMotions([motion],variant),[motion]);assert.equal(variant.rig,'unknown');
});
