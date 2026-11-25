import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {renderReview} from './skyhaven-genesis-chat-packs.mjs';
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

function choosePack(host,window,value){
  const select=host.querySelector('#chat-pack-choice');
  select.value=value;
  select.dispatchEvent(new window.Event('change',{bubbles:true}));
}

test('the delivered cast keeps its own clips, missing states and scene plates',()=>{
  const data=JSON.parse(readFileSync(new URL('../artwork/genesis-chat-packs.json',import.meta.url)));
  const {JSDOM}=createRequire(import.meta.url)('jsdom');
  const hashes=new Set();
  for(const actor of data.characters){
    const page=JSDOM.fragment(renderReview(data,{view:'video-pack',selectedId:actor.slug}));
    assert.equal(page.querySelector('.chat-review-actor').dataset.actor,actor.slug);
    assert.equal(page.querySelectorAll('figure[data-state]').length,10);
    for(const figure of page.querySelectorAll('figure[data-state]')){
      const clip=actor.clips[figure.dataset.state],video=figure.querySelector('video');
      if(!clip){assert.equal(video,null);assert.match(figure.textContent,/미인계/);continue;}
      if(clip.score === null){
        assert.equal(clip.reviewStatus,'owner-review-pending');
        assert.match(figure.textContent,/사용자 리뷰 대기/);
        assert.doesNotMatch(figure.textContent,/0점/);
        assert.equal(figure.querySelector('a:last-child').href,clip.expression.url);
      }else assert.ok(figure.textContent.includes(`제작 검수 ${clip.score}점`));
      assert.equal(video.getAttribute('src'),clip.url);
      assert.equal(video.getAttribute('poster'),clip.poster);
      assert.ok(!hashes.has(clip.sha256));hashes.add(clip.sha256);
    }
    const layers=JSDOM.fragment(renderReview(data,{view:'layers',selectedId:actor.slug}));
    assert.equal(layers.querySelectorAll('video').length,actor.layers.mid?1:0);
  }
  assert.equal(hashes.size,data.batches.length*10);
});

test('the ImageGen edition keeps distinct expression sources, scene originals and review notes',()=>{
  const data=JSON.parse(readFileSync(new URL('../artwork/genesis-chat-packs-2026-11-25.json',import.meta.url)));
  const {JSDOM}=createRequire(import.meta.url)('jsdom');
  for(const actor of data.characters){
    const page=JSDOM.fragment(renderReview(data,{view:'video-pack',selectedId:actor.slug}));
    const expected=new Set(Object.values(actor.expressionsByState).map(asset=>asset.sha256));
    const images=[...page.querySelectorAll('figure[data-expression-sha]')];
    assert.equal(images.length,expected.size);
    assert.deepEqual(new Set(images.map(f=>f.dataset.expressionSha)),expected);
    const tabs=page.querySelector('nav[aria-label="검토판"]');
    assert.ok(tabs.querySelector('[aria-current]').href.includes('?edition='+data.edition));
    assert.equal(tabs.querySelector('a:not([aria-current])').getAttribute('href'),'/#characters/genesis-chat/video-pack/'+actor.slug);
    const layers=JSDOM.fragment(renderReview(data,{view:'layers',selectedId:actor.slug}));
    for(const [i,key] of ['far','mid','near'].entries()){
      const figure=layers.querySelectorAll('figure')[i];
      assert.equal(figure.querySelector('img').src,actor.layers[key].url);
      assert.equal(figure.querySelector('a:last-child').href,actor.layers[key].original.url);
    }
    for(const [state,clip] of Object.entries(actor.clips)){
      const figure=page.querySelector('[data-state="'+state+'"]');
      const video=figure.querySelector('video');
      assert.equal(video.src,clip.url);
      assert.equal(video.poster,clip.poster);
      assert.equal(figure.querySelector('[data-clip-loop]').checked,false);
      assert.equal(figure.querySelector('a:last-child').href,actor.expressionsByState[state].url);
      if(clip.artNote)assert.ok(figure.textContent.includes(clip.artNote));
      if(Number.isFinite(clip.score))assert.ok(figure.textContent.includes('원화팀 '+clip.score+'점'));
    }
  }
});

test('only the dated Guan Yu detail credits the painting and performance scenes separately',()=>{
  const {JSDOM}=createRequire(import.meta.url)('jsdom');
  const current=JSON.parse(readFileSync(new URL('../artwork/genesis-chat-packs-2026-11-25.json',import.meta.url)));
  const legacy=JSON.parse(readFileSync(new URL('../artwork/genesis-chat-packs.json',import.meta.url)));
  for(const kind of ['expressions','layers','video-pack']){
    const header=JSDOM.fragment(renderReview(current,{view:kind,selectedId:'guan-yu'})).querySelector('.chat-review-actor header');
    const [art,performance,source]=header.querySelectorAll('p');
    assert.match(art.textContent,/화남 원화 동기.*제갈근.*손권 측 혼담/);
    assert.match(performance.textContent,/말하기 연기 참고.*군수품 화재.*부사인과 미방/);
    assert.equal(source.querySelector('cite').textContent,'삼국지연의 제73회');
  }
  const old=JSDOM.fragment(renderReview(legacy,{view:'video-pack',selectedId:'guan-yu'}));
  assert.doesNotMatch(old.querySelector('.chat-review-actor header').textContent,/혼담|군수품 화재/);
});

test('Zhuge Liang expression cards cite the chapter for the matching art and leave neutral uncredited',()=>{
  const {JSDOM}=createRequire(import.meta.url)('jsdom');
  const data=JSON.parse(readFileSync(new URL('../artwork/genesis-chat-packs-2026-11-25.json',import.meta.url)));
  const actor=data.characters.find(a=>a.slug==='zhuge-liang');
  const page=JSDOM.fragment(renderReview(data,{view:'expressions',selectedId:actor.slug}));
  for(const [mood,chapter] of Object.entries({happy:90,angry:96,sad:96,surprised:95,neutral:null})){
    const sha=actor.expressionsByState['listening-'+mood].sha256;
    const caption=page.querySelector('[data-expression-sha="'+sha+'"] figcaption');
    const link=caption.querySelector('a');
    if(chapter===null) assert.equal(link,null);
    else {
      const reference=actor.expressionSource.references[sha];
      assert.ok(caption.textContent.includes(reference.sceneKo));
      assert.equal(link.textContent,'삼국지연의 제'+chapter+'회');
      assert.equal(link.getAttribute('href'),reference.url);
    }
  }
});

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
  choosePack(host,d.window,'b');
  assert.equal(host.querySelectorAll('[data-chat-art-id]').length,1);
  assert.equal(new URL(d.window.location.href).searchParams.get('chatPack'),'b');
  assert.equal(d.window.document.activeElement,host.querySelector('#chat-pack-choice'));
  assert.equal(host.querySelector('#chat-pack-choice').value,'b');
  host.querySelector('[data-chat-art-id]').click();assert.equal(decodeURIComponent(d.window.location.hash.split('/').at(-1)),JSON.stringify(['b','shared']));
  await view.render({search:'shared',selectedId:JSON.stringify(['b','shared'])});
  assert.equal(host.querySelector('dialog img').getAttribute('src'),'https://genesischat.online/content/images/avatars/b/shared.webp');
  assert.match(host.querySelector('dialog').textContent,/SHA/);
  assert.equal(d.window.document.activeElement,host.querySelector('[data-chat-close]'));
  host.querySelector('[data-chat-close]').click();assert.equal(d.window.location.hash,'#characters/genesis-chat/characters');
  assert.equal(d.window.document.activeElement,host.querySelector('[data-chat-art-id]'));
  view.hide();d.window.close();
});

test('pack dropdown retains selection across views and refresh, and all packs clears the URL filter',async()=>{
  const {d,host,view}=setup();await view.render();
  assert.deepEqual(Array.from(host.querySelector('#chat-pack-choice').options,o=>o.value),['','a','b']);
  choosePack(host,d.window,'a');
  assert.match(host.querySelector('[role="status"]').textContent,/50개 원화/);
  d.window.location.hash='#characters/genesis-chat/backgrounds';
  await view.render({view:'backgrounds'});
  assert.equal(host.querySelector('#chat-pack-choice').value,'a');
  assert.equal(host.querySelectorAll('[data-chat-art-id]').length,1);
  await view.render({view:'backgrounds',refresh:true});
  assert.equal(host.querySelector('#chat-pack-choice').value,'a');
  choosePack(host,d.window,'');
  assert.equal(new URL(d.window.location.href).searchParams.has('chatPack'),false);
  assert.equal(d.window.location.hash,'#environments/genesis-chat/backgrounds');
  assert.equal(d.window.document.activeElement,host.querySelector('#chat-pack-choice'));
  assert.equal(host.querySelector('#chat-pack-choice').value,'');
  d.window.location.hash='#characters/genesis-chat/characters';
  await view.render();
  assert.match(host.querySelector('[role="status"]').textContent,/51개 원화/);
  view.hide();d.window.close();
});

test('background view and direct selection preserve source dimensions and safe links',async()=>{
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
