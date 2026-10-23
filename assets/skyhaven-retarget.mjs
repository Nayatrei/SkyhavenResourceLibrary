import {AnimationClip, AnimationMixer, LoopOnce, Matrix4, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack} from 'three';

const roles = {
  hips:['hips','hip','pelvis','rootx'], spine:['spine','spine01','spine01x'], chest:['spine1','chest','spine02','spine02x'], upperChest:['spine2','upperchest','spine03','spine03x'], neck:['neck','neck01','neckx'], head:['head','headx'],
};
for (const [side, suffix] of [['left','l'],['right','r']]) {
  for (const [part, aliases] of Object.entries({shoulder:['shoulder','clavicle'], arm:['arm','upperarm','armstretch'], forearm:['forearm','lowerarm','forearmstretch','elbow'], hand:['hand'], thigh:['upleg','upperleg','thigh','thighstretch'], shin:['leg','lowerleg','calf','shin','legstretch'], foot:['foot','ankle'], toe:['toebase','toe','toe0','toes01','toes','ball']})) {
    roles[side+part]=aliases.flatMap(alias=>[side+alias,alias+suffix,suffix+alias]);
  }
}
const aliases = new Map(Object.entries(roles).flatMap(([role,names])=>names.map(name=>[name,role])));
export function boneRole(name) {
  return aliases.get(name.replace(/^mixamorig[:_]?|^cc_base_|^bip\d+[_ ]|^b[-_]/i,'').replace(/[^a-z0-9]/gi,'').toLowerCase());
}
const continuation = {hips:'spine',spine:'chest',chest:'upperChest',upperChest:'neck',neck:'head'};
for (const side of ['left','right']) for (const [part,next] of [['shoulder','arm'],['arm','forearm'],['forearm','hand'],['thigh','shin'],['shin','foot'],['foot','toe']]) continuation[side+part]=side+next;
function joints(root) {
  const result=new Map();
  root.traverse(node=>{const role=boneRole(node.name);if(role&&!result.has(role))result.set(role,node);});
  // Synty's clavicle/shoulder/elbow hierarchy uses "Shoulder" for the upper arm.
  for(const [side,suffix] of [['left','L'],['right','R']]){
    const clavicle=root.getObjectByName('Clavicle_'+suffix),arm=root.getObjectByName('Shoulder_'+suffix),elbow=root.getObjectByName('Elbow_'+suffix);
    if(!result.has(side+'arm')&&clavicle&&arm&&elbow){result.set(side+'shoulder',clavicle);result.set(side+'arm',arm);}
  }
  return result;
}
function snapshot(root) {
  const state=[];root.traverse(node=>state.push([node,node.position.clone(),node.quaternion.clone(),node.scale.clone()]));return state;
}
function restore(state) {
  for(const [node,position,quaternion,scale] of state){node.position.copy(position);node.quaternion.copy(quaternion);node.scale.copy(scale);}
  state[0][0].updateMatrixWorld(true);
}
function playbackClip(source, clip) {
  // FBXLoader can collapse the authored scene group and replace its rotation
  // with an up-axis correction. A constant group track must not undo that
  // correction when the mixer starts. Bone tracks and animated turns remain.
  if(!source.isGroup||!source.userData.transformData)return clip;
  const tracks=clip.tracks.filter(track=>{
    if(track.name!==source.name+'.quaternion')return true;
    for(let i=4;i<track.values.length;i++)if(Math.abs(track.values[i]-track.values[i%4])>1e-6)return true;
    return false;
  });
  return tracks.length===clip.tracks.length?clip:new AnimationClip(clip.name,clip.duration,tracks);
}
function bodyBasis(joints) {
  const up=joints.get('head').getWorldPosition(new Vector3()).sub(joints.get('hips').getWorldPosition(new Vector3())).normalize();
  const right=joints.get('leftarm').getWorldPosition(new Vector3()).sub(joints.get('rightarm').getWorldPosition(new Vector3()));
  right.addScaledVector(up,-right.dot(up)).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,new Vector3().crossVectors(right,up)));
}

// Transfer world-space joint motion, accounting for bind axes, body size and A/T poses.
// Meshes and source tracks are never edited; the result is a new browser-only clip.
export async function retargetClips(target, source, {signal,onProgress}={}) {
  target.updateMatrixWorld(true);source.updateMatrixWorld(true);
  const targets=joints(target), sources=joints(source);
  const required=['hips','spine','head','leftarm','leftforearm','rightarm','rightforearm','leftthigh','leftshin','leftfoot','rightthigh','rightshin','rightfoot'];
  if(required.some(role=>!targets.has(role)||!sources.has(role)))throw new Error('이 캐릭터와 모션의 필수 뼈를 연결할 수 없습니다. 팩 기본 캐릭터를 선택하세요.');
  const basis=bodyBasis(targets).multiply(bodyBasis(sources).invert());
  const targetState=snapshot(target),sourceState=snapshot(source), pairs=[];
  const targetRoles=new Map([...targets].map(([role,node])=>[node,role]));
  target.traverse(bone=>{
    const role=targetRoles.get(bone), from=sources.get(role);
    if(!from||targets.get(role)!==bone)return;
    const sourceRotation=basis.clone().multiply(from.getWorldQuaternion(new Quaternion())),targetRotation=bone.getWorldQuaternion(new Quaternion());
    const next=continuation[role],toChild=targets.get(next),fromChild=sources.get(next);
    const alignment=new Quaternion();
    if(toChild&&fromChild){
      const toDirection=toChild.getWorldPosition(new Vector3()).sub(bone.getWorldPosition(new Vector3()));
      const fromDirection=fromChild.getWorldPosition(new Vector3()).sub(from.getWorldPosition(new Vector3())).applyQuaternion(basis);
      if(toDirection.lengthSq()>1e-8&&fromDirection.lengthSq()>1e-8)alignment.setFromUnitVectors(toDirection.normalize(),fromDirection.normalize());
    }
    pairs.push({bone,from,role,offset:sourceRotation.invert().multiply(alignment).multiply(targetRotation)});
  });
  const targetHip=targets.get('hips'),sourceHip=sources.get('hips');
  const targetOrigin=targetHip.getWorldPosition(new Vector3()),sourceOrigin=sourceHip.getWorldPosition(new Vector3());
  const legLength = map => ['leftthigh','leftshin'].reduce((sum,role)=>sum+map.get(role).getWorldPosition(new Vector3()).distanceTo(map.get(continuation[role]).getWorldPosition(new Vector3())),0);
  const scale=legLength(targets)/legLength(sources);
  if(!Number.isFinite(scale)||scale<=0)throw new Error('캐릭터의 다리 길이를 읽을 수 없습니다.');
  const clips=[];
  const sourceClips=(source.animations||[]).filter(clip=>clip.duration>0&&clip.tracks.length);
  let lastYield=performance.now();
  try {
    for(const [clipIndex,clip] of sourceClips.entries()) {
      restore(sourceState);restore(targetState);
      const mixer=new AnimationMixer(source),action=mixer.clipAction(playbackClip(source,clip));
      action.setLoop(LoopOnce,1);action.clampWhenFinished=true;action.play();
      const frames=Math.max(2,Math.ceil(clip.duration*30)+1),times=new Float32Array(frames),positions=new Float32Array(frames*3);
      const rotations=pairs.map(()=>new Float32Array(frames*4));
      try {
        for(let frame=0;frame<frames;frame++) {
          if(signal?.aborted)throw new DOMException('Preview closed','AbortError');
          if(onProgress&&((clipIndex===0&&frame===0)||performance.now()-lastYield>50||(clipIndex===sourceClips.length-1&&frame===frames-1))){await onProgress({clip:clip.name,clipIndex,clipCount:sourceClips.length,frame,frames});lastYield=performance.now();}
          if(signal?.aborted)throw new DOMException('Preview closed','AbortError');
          const time=clip.duration*frame/(frames-1);times[frame]=time;
          mixer.setTime(Math.min(time,clip.duration-0.000001));source.updateMatrixWorld(true);
          restore(targetState);
          for(let i=0;i<pairs.length;i++) {
            const {bone,from,offset,role}=pairs[i];
            const world=basis.clone().multiply(from.getWorldQuaternion(new Quaternion())).multiply(offset);
            bone.quaternion.copy(bone.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));
            if(role==='hips') {
              const position=from.getWorldPosition(new Vector3()).sub(sourceOrigin).applyQuaternion(basis).multiplyScalar(scale).add(targetOrigin);
              bone.position.copy(bone.parent.worldToLocal(position));bone.position.toArray(positions,frame*3);
            }
            bone.updateMatrixWorld(true);bone.quaternion.toArray(rotations[i],frame*4);
          }
        }
        const tracks=pairs.map(({bone},i)=>new QuaternionKeyframeTrack(bone.uuid+'.quaternion',times,rotations[i]));
        tracks.push(new VectorKeyframeTrack(targetHip.uuid+'.position',times,positions));
        clips.push(new AnimationClip(clip.name,clip.duration,tracks));
      } finally {mixer.stopAllAction();mixer.uncacheRoot(source);}
    }
  } finally {restore(sourceState);restore(targetState);}
  if(!clips.length)throw new Error('이 파일에는 재생할 모션 클립이 없습니다.');
  return {clips,mappedBones:pairs.length};
}
