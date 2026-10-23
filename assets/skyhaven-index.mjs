export const games = [{id:'all',name:'전체'},{id:'skyhaven',name:'Skyhaven'},{id:'companion',name:'Companion'},{id:'legends',name:'Legends'},{id:'shared',name:'공용'}];
export const gameOf = file => file.game || (file.path.startsWith('Legends/')?'legends':file.path.startsWith('Companion/')?'companion':/^(Motion Library|Animation\/CommonHumanoid32)\//.test(file.path)?'shared':'skyhaven');
const categoryPath = file => file.path.replace(/^Legends\//,'');
const characterAnimation = file => /^Character\/Final\/(?:V\d+\/)?[^/]+\/Animations\//i.test(categoryPath(file));
export const categories = [
  {id:'characters', name:'캐릭터', en:'Characters', number:'01', roots:['Character'], symbol:'◉', description:'이름 하나로 모델, 리그와 텍스처를 함께.'},
  {id:'animations', name:'애니메이션', en:'Animations', number:'02', roots:['Animation','Motion','Motion Library'], symbol:'▷', description:'모션을 찾고, 클릭해서 바로 재생하세요.'},
  {id:'environments', name:'배경', en:'Environments', number:'03', roots:['Environment'], symbol:'⌂', description:'장소, 씬과 실제 렌더를 한곳에서.'},
  {id:'companions', name:'동료', en:'Companions', number:'04', roots:['Companion'], symbol:'♧', description:'작은 동료들과 함께 만드는 세계.'},
  {id:'concepts', name:'원화', en:'Concepts', number:'05', roots:['Concepts'], symbol:'◇', description:'세계의 모습과 다음 아이디어.'},
  {id:'files', name:'전체 파일', en:'All files', number:'06', roots:[], symbol:'▤', description:'원본 폴더, 버전과 문서까지 모두 검색.'},
  {id:'polygon', name:'폴리곤', en:'POLYGON Library', number:'07', roots:['PolygonLibrary'], symbol:'▦', description:'Synty POLYGON 팩 전체, 경로와 변환 명령까지.'}
];
const modelFormats = new Set(['glb','gltf','fbx','obj']);
const companionAnimation = file => /^Companion\/Animated\//.test(file.path) && (['glb','gltf','fbx','anim','bvh'].includes(file.extension)||file.kind==='video');
const isAnimation = file => file.category==='animations'||companionAnimation(file);
export const canPreview = file => modelFormats.has(file.extension) || file.extension === 'anim' || ['image','video','audio'].includes(file.kind);
const titleCase = name => name.replace(/(^|[ _-])([a-z])/g, (_, space, letter) => space + letter.toUpperCase());
const parent = path => path.split('/').slice(0,-1).join('/');
export function categoryOf(file) {
  if (/^Character\/Final\/V\d+\/Shared\//i.test(categoryPath(file))) return 'files';
  if (characterAnimation(file)) return 'animations';
  return categories.find(category => category.roots.includes(categoryPath(file).split('/')[0]))?.id || 'files';
}
export function groupName(file) {
  const parts = categoryPath(file).split('/');
  if (categoryOf(file) === 'characters' || characterAnimation(file)) {
    if (parts[1] === 'Final' && /^V\d+$/i.test(parts[2]) && parts[3] && parts[3] !== 'Shared') return `${titleCase(parts[3])} · ${parts[2].toUpperCase()}`;
    const named = parts.indexOf('Characters');
    if (named >= 0) return parts[named+1];
    if (['Final','characters','Repairs','Texture Comparisons'].includes(parts[1])) return parts.length>3 ? titleCase(parts[2]) : 'References';
    if (parts[1] === 'Blender') return titleCase(file.name.replace(/\.[^.]+$/,''));
    return 'References';
  }
  if (categoryOf(file) === 'companions') {
    if (parts[1] === 'Animated') return titleCase(parts[2] || 'Companions');
    if (parts[1] === 'Final') return 'Collection';
    return 'References';
  }
  return parts[1] || 'Resources';
}
function previewScore(file, category) {
  let score = canPreview(file) ? 10 : 0;
  if (modelFormats.has(file.extension)) score += 20;
  if (category === 'characters' && file.path.includes('/Final/') && file.extension === 'fbx') score += 70;
  if (file.extension === 'glb') score += 12;
  if (category === 'characters' && /\/Models\/SK_[^/]+\.glb$/i.test(file.path)) score += 120;
  if (/\/(Meshes|Animations|Accessories)\//i.test(file.path) || /_LOD\d/i.test(file.name)) score -= 120;
  if (category === 'environments' && file.kind === 'image') score += 40;
  if (file.kind === 'image' && /overall|01_ALL|overview/i.test(file.name)) score += 30;
  if (/Textures?\/|\.fbm\/|basecolor|roughness|normal|metallic/i.test(file.path)) score -= 100;
  if (/scratch|vendor|_qa|regression/i.test(file.path)) score -= 10;
  if (/compare|mockup/i.test(file.name)) score -= 30;
  return score;
}
export function thumbnailFor(files) {
  return files.filter(file => file.kind === 'image' && !/Textures?\/|\.fbm\/|basecolor|roughness|normal|metallic/i.test(file.path))
    .sort((a,b) => thumbnailScore(b)-thumbnailScore(a) || b.modified.localeCompare(a.modified))[0] || null;
}
function thumbnailScore(file) {
  let score = /reference\/apose-front/i.test(file.path) ? 90 : 0;
  if (/overall|01_ALL|overview|Characters_Preview/i.test(file.name)) score += 70;
  if (/idle.*f000|idle.*mid/i.test(file.name)) score += 30;
  if (/\/QA\/Preview_Front\.png$/i.test(file.path)) score += 110;
  if (/mockup|compare|raw|regression|scratch/i.test(file.path)) score -= 25;
  return score;
}
export function buildIndex(catalog) {
  const files = catalog.folders.flatMap(folder => folder.files.map(file => ({...file, folderId:folder.id, game:gameOf(file), category:categoryOf(file)})));
  const groups = new Map();
  for (const file of files) {
    const groupCategory = characterAnimation(file) ? 'characters' : file.category;
    if (!['characters','companions','environments','concepts'].includes(groupCategory)) continue;
    const name = groupName(file), id = `${file.game}/${groupCategory}/${name}`;
    if (!groups.has(id)) groups.set(id, {id, game:file.game, category:groupCategory, name, files:[]});
    groups.get(id).files.push(file);
  }
  for (const group of groups.values()) {
    group.preview = [...group.files].filter(canPreview).sort((a,b) => previewScore(b,group.category)-previewScore(a,group.category) || b.modified.localeCompare(a.modified))[0] || group.files[0];
    group.thumbnail = thumbnailFor(group.files);
    group.models = group.files.filter(file => modelFormats.has(file.extension));
  }
  return {files, groups:[...groups.values()].sort((a,b) => a.name.localeCompare(b.name)), byPath:new Map(files.flatMap(file => [file.path,...(file.aliases||[])].map(path=>[path,file])))};
}
export function searchFiles(files, query, {category='all', directory='', format='all',game='all',motionCategory='all',motionSubcategory='all',pack=''}={}) {
  const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return files.filter(file => (game==='all'||gameOf(file)===game) && (category==='all'||(category==='animations'?isAnimation(file):file.category===category)) && (!directory||file.path.startsWith(directory+'/'))
    && (format==='all'||file.extension===format) && (!pack||motionPack(file)===pack)
    && (motionCategory==='all'||(file.motion?.labels||[]).some(label=>label.startsWith(motionCategory+'/')))
    && (motionSubcategory==='all'||(file.motion?.labels||[]).some(label=>(label===motionSubcategory||label.endsWith('/'+motionSubcategory))&&(motionCategory==='all'||label.startsWith(motionCategory+'/'))))
    && words.every(word => `${file.path} ${file.pack||''} ${(file.clips||[]).map(clip=>clip.name).join(' ')} ${file.motion?.searchTerms||''}`.toLocaleLowerCase().includes(word)));
}
export const motionPack = file => file.pack || file.path.split('/').slice(0,2).join('/');
export function motionLabels(file,taxonomy) {
  return (taxonomy?.categories||[]).flatMap(c=>c.children.filter(s=>file.motion?.labels?.includes(c.id+'/'+s.id)).map(s=>c.name+' · '+s.name));
}
export function readMotionFilters(search) {
  const params=new URLSearchParams(search);
  return {query:params.get('q')||'',pack:params.get('pack')||'',directory:params.get('folder')||'',format:params.get('format')||'all',motionCategory:params.get('motionCategory')||'all',motionSubcategory:params.get('motionSubcategory')||'all'};
}
export function writeMotionFilters(url,filters) {
  for(const [key,value] of Object.entries(filters)) {
    const name=key==='query'?'q':key==='directory'?'folder':key;
    if(value&&value!=='all')url.searchParams.set(name,value);else url.searchParams.delete(name);
  }
  return url;
}
export function animationFiles(files) {
  const targets = new Set(files.filter(file => isAnimation(file) && file.previewPath && file.previewPath!==file.path).map(file => file.previewPath));
  const companionPreviews=new Set(files.filter(file=>companionAnimation(file)&&['glb','gltf'].includes(file.extension)).map(file=>file.path.replace(/\.[^.]+$/,'')));
  const characterPreviews=new Set(files.filter(file=>characterAnimation(file)&&['glb','gltf'].includes(file.extension)).map(file=>file.path.replace(/\.[^.]+$/,'')));
  return files.filter(file => isAnimation(file) && (modelFormats.has(file.extension)||file.extension==='anim'||file.kind==='video')
    && !targets.has(file.path) && !(file.extension==='fbx'&&(companionAnimation(file)&&companionPreviews.has(file.path.replace(/\.[^.]+$/,''))||characterPreviews.has(file.path.replace(/\.[^.]+$/,''))))
    && file.role!=='character' && !/\/previews\/|\/vendor\/|\/textures?\/|\/characters?\/|\/models?\//i.test(file.path));
}
export function resourceReference(file, origin) {
  return `Skyhaven resource: ${file.path}\nGame: ${games.find(game=>game.id===gameOf(file))?.name}\nPreview: ${new URL('/comfy/skyhaven/#file/'+encodeURIComponent(file.path),origin)}\nDownload: ${new URL(file.url,origin)}\nCatalog: ${new URL('/comfy/skyhaven/api/resources?game='+gameOf(file),origin)}\nLocal catalog (on this host): http://127.0.0.1:8187/comfy/skyhaven/api/resources?game=${gameOf(file)}\nRelated folder: ${parent(file.path)}`;
}
