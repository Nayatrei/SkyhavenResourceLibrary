import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {filterOwned,ownedFilters,ownedCard,ownedDetails,ownedStyleCounts,ownedTypes,ownedTypeCounts,createOwnedAssetList,OWNED_API} from './skyhaven-owned-assets.mjs';

function makeDOM(...args){
  const {JSDOM}=createRequire(import.meta.url)(process.env.JSDOM_PATH||'jsdom');
  const dom=new JSDOM(...args);
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
  return dom;
}

const item=(id,name,hidden=false)=>({id,name,hidden,publisher:'Artist',category:'3D',styles:['stylized-3d'],
  styleEvidence:{level:'inferred',reason:'시리즈 기준',sources:[]},
  contents:{items:['건축','식기'],level:'inferred',reason:'제품명 기준',sources:[]},storeUrl:'https://assetstore.unity.com/search?q=test'});
const data={available:true,snapshotDate:'2026-10-25',counts:{visible:52,hidden:1,total:53},categories:{'3D':52},
  styles:[{id:'stylized-3d',label:'스타일라이즈드'}],styleEvidenceLabels:{inferred:'추정'},contentsEvidenceLabels:{inferred:'제품명 기준'},
  assets:[...Array.from({length:52},(_,i)=>item(String(i),'Village '+i)),item('hidden','Hidden',true)]};

test('search includes contents and styles; category and hidden are independent',()=>{
  assert.equal(filterOwned(data,{query:'식기 스타일라이즈드'}).length,52);
  assert.equal(filterOwned(data,{query:'Village 15'}).length,1);
  assert.equal(filterOwned(data,{style:'realistic'}).length,0);
  assert.equal(filterOwned(data,{hidden:true}).length,53);
  assert.equal(filterOwned(data,{category:'도구'}).length,0);
  assert.deepEqual(ownedFilters('https://catalog.test/?ownedStyle=stylized-3d&ownedHidden=1#owned'),{availability:'',type:'',project:'',style:'stylized-3d',category:'',hidden:true});
});
test('inspector exposes content and escapes metadata',()=>{
  const row=ownedDetails(item('1','<img src=x>'),data);
  assert.ok(row.includes('식기'));
  assert.ok(row.includes('제품명 기준'));
  assert.ok(row.includes('&lt;img'));
  assert.ok(!row.includes('<img'));
});
test('all owned products remain listed and local evidence is separate from download actions',()=>{
  const local={...item('fab:one','Local Pack'),downloadUrl:'https://www.fab.com/listings/one',localLibrary:{packId:'Dekogon-one'}};
  const missing=item('two','Not checked');
  const values={...data,assets:[local,missing]};
  assert.equal(filterOwned(values).length,2);
  assert.deepEqual(filterOwned(values,{availability:'local'}).map(a=>a.id),['fab:one']);
  assert.deepEqual(filterOwned(values,{availability:'download'}).map(a=>a.id),['two']);
  assert.match(ownedDetails(local,data),/#environments\/pack\/Dekogon-one/);
  assert.match(ownedDetails(local,data),/Download · 받기/);
  assert.match(ownedDetails(missing,data),/다운로드·설치 미확인/);
});
test('Fab products are searchable and retain their own product links',()=>{
  const fab={...item('fab:451487b4-7336-4eb8-b63d-05c533dec13c','Test Pack'),source:'Fab',
    publisher:'Dekogon Studios',storeUrl:'https://www.fab.com/listings/451487b4-7336-4eb8-b63d-05c533dec13c'};
  assert.equal(filterOwned({...data,assets:[fab]},{query:'Fab Dekogon'}).length,1);
  const row=ownedDetails(fab,data);
  assert.ok(row.includes('Fab 제품 ↗'));
  assert.ok(row.includes(fab.storeUrl));
});
test('DOM: paging, filters, refresh recovery, route change, and lazy request reuse',async()=>{
  const dom=makeDOM('<main></main>',{url:'https://catalog.test/#owned'});
  const w=dom.window,host=w.document.querySelector('main');let active=true,calls=0,fail=false;
  const ui=createOwnedAssetList({host,isActive:()=>active,getURL:()=>w.location.href,replaceURL:u=>w.history.replaceState(null,'',u),
    fetchJSON:async url=>{assert.equal(url,OWNED_API);calls++;if(fail)throw new Error('offline');return data;}});
  await ui.render();assert.equal(host.querySelectorAll('.owned-card').length,50);
  host.querySelector('#owned-next').click();assert.equal(host.querySelectorAll('.owned-card').length,2);
  ui.search('Village 15');assert.equal(host.querySelectorAll('.owned-card').length,1);
  ui.search('');const hidden=host.querySelector('#owned-hidden');hidden.checked=true;hidden.dispatchEvent(new w.Event('change'));
  assert.ok(w.location.search.includes('ownedHidden=1'));assert.ok(host.textContent.includes('53개 결과'));
  host.querySelector('[data-owned-style="stylized-3d"]').click();
  assert.equal(ownedFilters(w.location.href).style,'stylized-3d');
  assert.equal(host.querySelector('[data-owned-style="stylized-3d"]').getAttribute('aria-pressed'),'true');
  assert.ok(host.querySelector('[data-owned-style="stylized-3d"]').textContent.includes('53'));
  await ui.render();assert.equal(calls,1,'cached visits do not re-fetch');
  fail=true;await ui.render({refresh:true});assert.ok(host.textContent.includes('이전 목록'));assert.equal(ui.count,52);
  active=false;host.innerHTML='<p>Character view</p>';await ui.render({refresh:true});assert.equal(host.textContent,'Character view');
  active=true;fail=false;await ui.render({refresh:true});host.querySelector('#owned-reset').click();assert.equal(w.location.search,'');
  assert.equal(host.querySelectorAll('.owned-card').length,50);dom.window.close();
});

test('style counts follow search/category/hidden without being narrowed by the selected style',()=>{
  const mixed={...data,styles:[...data.styles,{id:'realistic',label:'실사'}],assets:[
    {...item('1','Castle'),styles:['stylized-3d','realistic']},
    {...item('2','Castle Real'),styles:['realistic'],category:'Environment'},item('3','Hidden Castle',true)]};
  assert.deepEqual(ownedStyleCounts(mixed,{style:'realistic'}).map(s=>s.count),[2,1,2]);
  assert.deepEqual(ownedStyleCounts(mixed,{query:'Real'}).map(s=>s.count),[1,0,1]);
  assert.deepEqual(ownedStyleCounts(mixed,{category:'3D',hidden:true}).map(s=>s.count),[2,2,1]);
});
test('thumbnail renders lazily and a failed image has an accessible preview fallback',async()=>{
  const dom=makeDOM('<main></main>',{url:'https://catalog.test/#owned'});
  const host=dom.window.document.querySelector('main');
  const asset={...item('1','Castle'),thumbnailUrl:'https://media.fab.com/image_previews/example.jpg'};
  const ui=createOwnedAssetList({host,isActive:()=>true,getURL:()=>dom.window.location.href,fetchJSON:async()=>({...data,assets:[asset]})});
  await ui.render();
  const img=host.querySelector('.owned-cover img');
  assert.equal(img.getAttribute('loading'),'lazy');assert.equal(img.getAttribute('referrerpolicy'),'no-referrer');
  assert.equal(img.closest('button').getAttribute('aria-label'),'Castle 미리보기');
  img.dispatchEvent(new dom.window.Event('error'));
  assert.equal(img.hidden,true);assert.equal(img.nextElementSibling.hidden,false);
  assert.ok(!host.querySelector('#owned-style'),'dropdown is replaced, not duplicated');
  dom.window.close();
});

test('asset fields separate content from tools and leave unrelated or unknown assets in All',()=>{
  assert.deepEqual(ownedTypes({...item('fab:one','Ambiguous title'),productCategory:'Environments'}),['environment']);
  assert.deepEqual(ownedTypes({...item('fab:two','Tool-shaped prop'),productCategory:'Tools, Objects & Decor'}),['environment']);
  const asset=(name,category,items)=>({...item('1',name),category,contents:{items}});
  assert.deepEqual(ownedTypes(asset('Nature Pack','3D',['식생·자연 환경'])),['environment']);
  assert.deepEqual(ownedTypes(asset('Suntail','3D',['건축 모듈','식기·도구·병·음식'])),['environment']);
  assert.deepEqual(ownedTypes(asset('Amplify Animation Pack','3D',['이동·검방패·총기·피격 모션'])),['character']);
  assert.deepEqual(ownedTypes(asset('Monster','3D',['몬스터·크리처'])),['character']);
  assert.deepEqual(ownedTypes(asset('Terrain Editor','도구',['지형 제작·편집 기능'])),['tool']);
  assert.deepEqual(ownedTypes(asset('Character Controller','템플릿',['캐릭터 이동 제어'])),['tool']);
  assert.deepEqual(ownedTypes(asset('Ice Magic','시각 효과',[])),['vfx']);
  assert.deepEqual(ownedTypes(asset('Simple Water Shader','2D',[])),['vfx','environment']);
  assert.deepEqual(ownedTypes(asset('Castle People','3D',['캐릭터 모델','건물·마을 구성'])),['character','environment']);
  assert.deepEqual(ownedTypes(asset('Music','음향',['음향·효과음 자료'])),[]);
  assert.deepEqual(ownedTypes(asset('Mystery Pack','3D',[])),[]);
  assert.equal(ownedFilters('https://catalog.test/?ownedType=invalid').type,'');
});

test('type counts predict tab results while style counts are scoped to the selected type',()=>{
  const assets=[item('env','Village'),{...item('char','Hero'),contents:{items:['캐릭터 모델']}},
    {...item('tool','Editor'),category:'도구'},item('hidden','Hidden Village',true)];
  const mixed={...data,assets};
  assert.deepEqual(ownedTypeCounts(mixed,{type:'tool',project:'',style:'realistic',category:'2D'}).map(t=>t.count),[1,1,0,1]);
  assert.deepEqual(ownedTypeCounts(mixed,{query:'Village',hidden:true}).map(t=>t.count),[2,0,0,0]);
  assert.equal(filterOwned(mixed,{type:'character'}).length,1);
  assert.deepEqual(ownedStyleCounts(mixed,{type:'character'}).map(s=>s.count),[1,1]);
});

test('DOM: four type tabs reset subordinate filters, retain search and restore on revisit',async()=>{
  const dom=makeDOM('<main></main>',{url:'https://catalog.test/?q=Test&ownedStyle=toon&ownedCategory=3D#owned'});
  const w=dom.window,host=w.document.querySelector('main');
  const mixed={...data,assets:[item('env','Test Village'),{...item('tool','Test Editor'),category:'도구'}]};
  const ui=createOwnedAssetList({host,isActive:()=>true,getURL:()=>w.location.href,replaceURL:u=>w.history.replaceState(null,'',u),fetchJSON:async()=>mixed});
  await ui.render({search:'Test'});
  assert.equal(host.querySelectorAll('[data-owned-type]').length,4);
  host.querySelector('[data-owned-type="tool"]').click();
  assert.deepEqual(ownedFilters(w.location.href),{availability:'',type:'tool',project:'',style:'',category:'',hidden:false});
  assert.equal(new URL(w.location.href).searchParams.get('q'),'Test');
  assert.equal(host.querySelectorAll('.owned-card').length,1);
  assert.ok(host.querySelector('.owned-grid').textContent.includes('Test Editor'));
  await ui.render();assert.equal(host.querySelector('[data-owned-type="tool"]').getAttribute('aria-pressed'),'true');
  host.querySelector('[data-owned-type="tool"]').click();assert.equal(ownedFilters(w.location.href).type,'');
  host.querySelector('[data-owned-type="environment"]').click();
  host.querySelector('#owned-type-all').click();assert.equal(host.querySelectorAll('.owned-card').length,2);
  host.querySelector('[data-owned-type="tool"]').click();host.querySelector('#owned-reset').click();
  assert.equal(w.location.search,'?q=Test');dom.window.close();
});

test('RPG_Lab filter intersects type/style/search and never treats unknown as installed',()=>{
  const installed={method:'asset-origin',fileCount:7,paths:['Assets/Pack/a.fbx']};
  const mixed={...data,assets:[{...item('yes','Village Installed'),rpgLab:installed},item('no','Village Unknown')]};
  assert.equal(filterOwned(mixed,{project:'rpg-lab'}).length,1);
  assert.equal(filterOwned(mixed,{project:'rpg-lab',type:'character'}).length,0);
  assert.equal(filterOwned(mixed,{project:'rpg-lab',query:'Unknown'}).length,0);
  assert.deepEqual(ownedStyleCounts(mixed,{project:'rpg-lab'}).map(s=>s.count),[1,1]);
  assert.equal(ownedFilters('https://catalog.test/?ownedProject=rpg-lab').project,'rpg-lab');
  assert.equal(ownedFilters('https://catalog.test/?ownedProject=unknown').project,'');
});

test('gallery selection preserves cards and scroll; close and revisit restore the exact product',async()=>{
  const dom=makeDOM('<main></main>',{url:'https://catalog.test/?q=Village&ownedType=environment#owned'});
  const w=dom.window,host=w.document.querySelector('main');let calls=0;
  const options={host,isActive:()=>true,getURL:()=>w.location.href,replaceURL:u=>w.history.replaceState(null,'',u),fetchJSON:async()=>{calls++;return data;}};
  const ui=createOwnedAssetList(options);await ui.render({search:'Village'});
  const grid=host.querySelector('.owned-grid'),card=host.querySelector('[data-owned-id="15"]');host.scrollTop=350;
  card.click();
  assert.equal(host.querySelector('.owned-grid'),grid,'selection does not replace the gallery');
  assert.equal(host.scrollTop,350);assert.equal(host.querySelector('#owned-preview').open,true);
  assert.equal(host.querySelector('#owned-preview-title').textContent,'Village 15');
  assert.equal(new URL(w.location.href).searchParams.get('ownedAsset'),'15');
  assert.equal(new URL(w.location.href).searchParams.get('q'),'Village');
  await createOwnedAssetList(options).render({search:'Village'});
  assert.equal(host.querySelector('#owned-preview').open,true);
  assert.equal(host.querySelector('#owned-preview-title').textContent,'Village 15');
  host.querySelector('#owned-preview-close').click();
  assert.equal(host.querySelector('#owned-preview').open,false);
  assert.equal(new URL(w.location.href).searchParams.has('ownedAsset'),false);
  assert.equal(ownedFilters(w.location.href).type,'environment');
  assert.equal(calls,2);await ui.render();assert.equal(calls,2,'selection did not invalidate the data cache');
  dom.window.close();
});

test('selection restores the containing page; filtered or missing products cannot reopen a stale preview',async()=>{
  const dom=makeDOM('<main></main>',{url:'https://catalog.test/?ownedAsset=51#owned'});
  const w=dom.window,host=w.document.querySelector('main');
  const ui=createOwnedAssetList({host,isActive:()=>true,getURL:()=>w.location.href,replaceURL:u=>w.history.replaceState(null,'',u),fetchJSON:async()=>data});
  await ui.render();assert.equal(host.querySelectorAll('.owned-card').length,2);
  assert.equal(host.querySelector('#owned-preview-title').textContent,'Village 51');
  host.querySelector('#owned-preview-close').click();ui.search('Village 15');
  assert.equal(host.querySelectorAll('.owned-card').length,1);assert.equal(host.querySelector('#owned-preview').open,false);
  w.history.replaceState(null,'','?ownedAsset=missing#owned');await ui.render();
  assert.equal(new URL(w.location.href).searchParams.has('ownedAsset'),false);
  assert.equal(host.querySelector('#owned-preview').open,false);dom.window.close();
});

test('card keeps direct download separate from preview and covers missing imagery',()=>{
  const html=ownedCard({...item('fab:one','<Castle>'),source:'Fab',downloadUrl:'https://www.fab.com/library/assets/one'});
  const dom=makeDOM(html),card=dom.window.document;
  assert.equal(card.querySelector('button').getAttribute('aria-haspopup'),'dialog');
  assert.equal(card.querySelector('button').textContent.includes('<Castle>'),true);
  assert.equal(card.querySelector('img'),null);
  assert.equal(card.querySelector('.owned-image-missing').hidden,false);
  assert.equal(card.querySelector('a').href,'https://www.fab.com/library/assets/one');
  assert.equal(card.querySelector('a').getAttribute('target'),'_blank');dom.window.close();
});

test('DOM: installed pill counts, evidence, URL restoration, type change and reset',async()=>{
  const dom=makeDOM('<main></main>',{url:'https://catalog.test/#owned'});
  const w=dom.window,host=w.document.querySelector('main');
  const installed={method:'asset-origin',fileCount:7,paths:['Assets/Pack/a.fbx']};
  const mixed={...data,installation:{id:'rpg-lab',label:'RPG_Lab',checkedAt:'2026-10-25T20:00:00+00:00'},assets:[
    {...item('yes','Village Installed'),rpgLab:installed},item('no','Village Unknown')]};
  const options={host,isActive:()=>true,getURL:()=>w.location.href,replaceURL:u=>w.history.replaceState(null,'',u),fetchJSON:async()=>mixed};
  const ui=createOwnedAssetList(options);await ui.render();
  assert.equal(host.querySelector('#owned-project').textContent,'RPG_Lab 1');
  host.querySelector('#owned-project').click();assert.equal(host.querySelectorAll('.owned-card').length,1);
  assert.equal(ownedFilters(w.location.href).project,'rpg-lab');
  host.querySelector('[data-owned-id]').click();
  assert.ok(host.textContent.includes('Asset Store 제품 ID'));
  assert.ok(host.textContent.includes('Assets/Pack/a.fbx'));
  await createOwnedAssetList(options).render();
  assert.equal(host.querySelector('#owned-project').getAttribute('aria-pressed'),'true');
  host.querySelector('[data-owned-type="environment"]').click();
  assert.equal(ownedFilters(w.location.href).project,'rpg-lab');
  host.querySelector('#owned-reset').click();assert.equal(w.location.search,'');
  assert.equal(host.querySelectorAll('.owned-card').length,2);
  dom.window.close();
});
