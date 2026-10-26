import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryEntry,categoryImage,categoryCount,commandImage,commandNavigation,commandIcon} from './skyhaven-command.mjs';
const data={motionCount:120,entities:[
  {id:'character:Elara',name:'Elara',category:'characters',game:'skyhaven',group:'Village',variants:[{thumbnail:{ready:true,url:'https://source.test/elara.png'}}]},
  {id:'creature:Cat',name:'Cat',category:'companions',game:'companion',group:'Creatures',cover:{url:'https://source.test/cat.png'}},
],packs:[{id:'Castle',name:'Castle',category:'environments',game:'shared',group:'DETAILED',cover:{url:'https://source.test/castle.png'}}]};
test('category art and counts preserve original source and game filtering',()=>{
  assert.equal(categoryImage(categoryEntry(data,'characters')),'https://source.test/elara.png');
  assert.equal(categoryImage(categoryEntry(data,'animations')),'https://source.test/elara.png');
  assert.equal(categoryEntry(data,'characters','shared'),undefined);
  assert.equal(categoryCount(data,'characters'),1);assert.equal(categoryCount(data,'characters','shared'),0);
  assert.equal(categoryCount(data,'animations'),120);
});
test('hosted source art is not requested until source health is ONLINE',()=>{
  const html=commandImage(data.entities[0],{hosted:true});
  assert.match(html,/data-live-src="https:\/\/source.test\/elara.png"/);
  assert.doesNotMatch(html,/(?<!-)\bsrc=/);
  assert.match(commandImage(data.entities[0]),/ src=/);
  assert.match(commandImage(null),/No source preview/);
});
test('approved rail uses four icon categories followed by pack families; home opens environments',()=>{
  const html=commandNavigation(data,{active:'home'});
  for(const title of ['Characters','Animations','Environments','Creatures'])assert.match(html,new RegExp('>'+title+'<'));
  assert.match(html,/href="#environments" aria-current="page"/);
  for(const family of ['POLYGON','DETAILED','Dekogon'])assert.match(html,new RegExp('data-group="'+family+'"'));
  assert.match(html,/rts-symbol-helmet/);assert.match(html,/rts-symbol-run/);
  assert.doesNotMatch(html,/nav-thumbnail|command-home-link|<img/);
  assert.ok(html.indexOf('PACKS')>html.indexOf('Creatures'));
});
test('character groups are catalog-derived and metadata is escaped',()=>{
  const html=commandNavigation(data,{active:'characters',group:'Village'});
  assert.match(html,/GROUPS/);assert.match(html,/data-group="Village" class="active"/);
  assert.doesNotMatch(html,/data-group="DETAILED"/);
  const hostile=commandNavigation({...data,entities:[{category:'characters',group:'<img src=x>',game:'skyhaven'}]},{active:'characters'});
  assert.match(hostile,/&lt;img src=x&gt;/);assert.doesNotMatch(hostile,/<img src=x>/);
  assert.match(commandIcon('star'),/<svg/);
});
test('owned downloads is a visible sibling after local pack families, including offline catalogs',()=>{
  const html=commandNavigation(data,{active:'owned'});
  assert.ok(html.indexOf('data-owned-downloads')>html.indexOf('data-group="Dekogon"'));
  assert.match(html,/rts-owned-downloads active/);
  assert.match(html,/소유 에셋 · Download/);
  assert.match(html,/href="#owned" data-owned-downloads/);
});
