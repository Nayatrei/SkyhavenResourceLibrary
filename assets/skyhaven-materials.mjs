import {Color, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial} from 'three';

// FBX Phong cannot represent the exported roughness/metallic maps. Use PBR for
// the browser preview; keep already-authored GLTF PBR materials unchanged.
export function previewMaterial(material, {roughnessMap=null,metalnessMap=null}={}) {
  if(!material.isMeshPhongMaterial&&!material.isMeshLambertMaterial)return material;
  const result=new MeshStandardMaterial({
    color:material.map?0xffffff:material.color, map:material.map,
    roughness:roughnessMap?1:.78, metalness:metalnessMap?1:0, roughnessMap, metalnessMap,
    normalMap:material.normalMap, bumpMap:material.bumpMap, bumpScale:material.bumpScale,
    alphaMap:material.alphaMap, transparent:material.transparent, opacity:material.opacity,
    alphaTest:material.alphaTest, side:material.side, vertexColors:material.vertexColors,
    emissive:material.emissiveIntensity>0?material.emissive:new Color(0),
    emissiveMap:material.emissiveMap, emissiveIntensity:material.emissiveIntensity||0,
  });
  if(material.normalScale)result.normalScale.copy(material.normalScale);
  result.name=material.name;return result;
}

export function textureMaterial(material) {
  return new MeshBasicMaterial({color:material.color,map:material.map,alphaMap:material.alphaMap,transparent:material.transparent,opacity:material.opacity,alphaTest:material.alphaTest,side:material.side,vertexColors:material.vertexColors,toneMapped:false});
}

export function lambertMaterial(material) {
  const result=new MeshLambertMaterial({color:material.color,map:material.map,normalMap:material.normalMap,bumpMap:material.bumpMap,bumpScale:material.bumpScale,alphaMap:material.alphaMap,transparent:material.transparent,opacity:material.opacity,alphaTest:material.alphaTest,side:material.side,vertexColors:material.vertexColors,emissive:material.emissive,emissiveMap:material.emissiveMap,emissiveIntensity:material.emissiveIntensity});
  if(material.normalScale)result.normalScale.copy(material.normalScale);
  return result;
}
