export const humanoidMotion=v=>v?.rig==='Humanoid'||v?.webRig?.humanoid===true;
export const libraryScopes=[['all','All'],['skyhaven','Skyhaven'],['purchased','Purchased'],['remake','Remake']];
const legacyScopes={skyhaven:'skyhaven',companion:'skyhaven',legends:'skyhaven',shared:'purchased'};
const arcturus=/^arcturus(?:[ _-]|$)/i;
const externalOrigins=/POLYGON 색인|AssetOrigin productId|UnrealToUnity prefab catalog|Dekogon ResourceCatalog/i;
const externalGroups=new Set(['POLYGON','DETAILED','Dekogon','Laya Design','Epic Games']);
const skyhavenArtPacks=new Set(['RoyalCourt','RoyalCourtV2','BanditWeapons','BanditVillage']);

export function assetScope(item) {
  if(libraryScopes.some(([id])=>id!=='all'&&item.libraryScope===id))return item.libraryScope;
  const path=String(item.resourcePath||item.path||item.root||'').replaceAll('\\','/');
  const segments=path.split('/');
  const labels=[item.group,item.pack,String(item.id??'').split(':').at(-1),...segments];
  if(labels.some(label=>arcturus.test(label||''))||/^(?:Library\/Characters|Character\/Final)\/Sizz(?:\/|$)/i.test(path))return 'remake';
  if(item.sourcePackage||externalOrigins.test(item.origin||'')||externalGroups.has(item.group)||
    segments.some(part=>/^(?:PolygonLibrary|POLYGON-Nightclubs|Purchased)$/i.test(part)))return 'purchased';
  if(item.game==='skyhaven'||item.game==='companion'||item.game==='legends'||
    item.origin==='3DFactory final'||item.origin==='GameSet'||item.origin==='Registered manifest'||
    item.origin==='WorldConsole folder'||skyhavenArtPacks.has(item.pack)||
    labels.some(label=>/^(?:Celestial[ ]?Cycle|CC-Brand|CC-Product-Screenshots)(?:$| Dynamic Player$)/i.test(label||'')))return 'skyhaven';
  return item.game==='shared'?'purchased':'';
}
export const inLibraryScope=(item,scope='all')=>scope==='all'||assetScope(item)===scope;
export const cleanName=name=>String(name).replace(/^(SK_|SM_|Steampunk_|Bandit_)/,'').replace(/_SD$/,'').replaceAll('_',' ');
export function matches(value,query){return query.toLocaleLowerCase().trim().split(/\s+/).every(word=>JSON.stringify(value).toLocaleLowerCase().includes(word));}
export const packInSection=(pack,section)=>(pack.sections||[pack.category]).includes(section);
export function matchesPack(pack,query,section){
  const members=(pack.searchItems||[]).filter(item=>!section||!item[2]||(section==='characters'?item[2]==='character':item[2]!=='character'));
  return matches([pack.name,pack.id,pack.categories],query)||members.some(item=>matches(item,query));
}
export function filterPackItems(items,{query='',category='',assembly='',scope='',assetType=''}={}){
  return items.filter(item=>(!scope||(scope==='character'?item.kind==='character':item.kind!=='character'))&&(!assetType||(item.assetType||'prefab')===assetType)&&(!category||item.category===category)&&(!assembly||item.usedIn?.some(use=>use.use===assembly))&&matches([item.name,item.category,item.catalogCategory,item.prefab,item.path,item.guid],query));
}
export function formatBytes(value){if(value==null||!Number.isFinite(value))return '—';const unit=value>0?Math.min(3,Math.floor(Math.log(value)/Math.log(1024))):0;return (value/1024**unit).toLocaleString(undefined,{maximumFractionDigits:unit?2:0})+' '+['B','KiB','MiB','GiB'][unit];}
export function sortPackItems(items,order='name'){
  const score=item=>order==='triangles'?item.tris??-1:order==='bytes'?item.sourceBytes??-1:order==='resolution'?Math.max(item.textureMetrics?.width||0,item.textureMetrics?.height||0):-1;
  return [...items].sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name));
}
export function candidateMotions(motions,variant,{query='',pack='',label='',unknown=false}={}){
  const humanoid=humanoidMotion(variant);
  return motions.filter(m=>m.role!=='character'&&!(m.provider==='bank'&&!m.clips?.length)&&(!pack||m.pack===pack)&&(!label||m.motion?.labels?.some(x=>x===label||x.startsWith(label+'/')))&&matches([m.name,m.path,m.motion?.searchTerms,m.clips],query)
    &&(humanoid?(m.rig==='Humanoid'||unknown&&m.rig==='unknown'):variant?m.path.startsWith(variant.model.path.split('/').slice(0,-1).join('/')+'/'):true));
}
export function rankMotions(motions,variant){
  if(!humanoidMotion(variant))return [...motions];
  const profile=variant.motionProfile||{},verified=new Set(variant.webVerification?.motions?.map(c=>c.motion)||[]);
  const score=m=>{
    const preferred=(profile.preferredPacks||[]).indexOf(m.pack);
    return (preferred<0?0:1000-preferred*100)-((profile.deprioritizedPacks||[]).includes(m.pack)?1000:0)+(verified.has(m.id)?30:0)+(/@(Idle|Walk|Run)01(?:_Forward)?\.fbx$/i.test(m.name)?40:0);
  };
  return [...motions].sort((a,b)=>score(b)-score(a)||a.name.localeCompare(b.name)||String(a.id).localeCompare(String(b.id)));
}
export function recommendedMotions(motions,variant){
  if(!humanoidMotion(variant))return [];
  const ranked=rankMotions(motions,variant);
  return ['Idle','Walk','Run'].flatMap(intent=>{
    const exact=new RegExp('@'+intent+'01(?:_Forward)?\\.fbx$','i');
    const neutral=new RegExp('(?:^|[@_\\W])'+intent+'(?:\\d+)?(?:[_.\\W]|$)','i');
    const motion=ranked.find(m=>exact.test(m.name))||ranked.find(m=>neutral.test(m.name)&&!/combat|weapon|wounded|crouch|jump|start|stop|transition/i.test(m.name));
    return motion?[{intent,motion}]:[];
  });
}
export function readState(url){
  const u=new URL(url),p=u.searchParams;
  const requested=p.get('scope'),game=p.get('game');
  const scope=libraryScopes.some(([id])=>id===requested)?requested:(Object.hasOwn(legacyScopes,game)?legacyScopes[game]:'all');
  return {scope,query:p.get('q')||'',group:p.get('group')||'',motionQuery:p.get('motion')||'',motionPack:p.get('pack')||'',motionLabel:p.get('motionCategory')||'',variant:p.get('variant')||''};
}
export function filterEntities(entities,{scope='all',query='',group=''},category){
  return entities.filter(e=>e.category===category&&inLibraryScope(e,scope)&&(!group||e.group===group)&&matches([e.name,e.group,e.aliases],query));
}
export function filterPacks(packs,{scope='all',query='',group=''},category){
  return packs.filter(pack=>packInSection(pack,category)&&inLibraryScope(pack,scope)&&(!group||pack.group===group)&&matchesPack(pack,query,category));
}
export function smokeMotions(motions,pack='Basic Motions'){
  return ['Idle','Walk','Run'].map(name=>({name,motion:motions.find(m=>m.rig==='Humanoid'&&m.pack===pack&&m.name===(pack==='Human Basic Motions'?`HumanF@${name}01${name==='Idle'?'':'_Forward'}.fbx`:`BasicMotions@${name}01.fbx`))}));
}
