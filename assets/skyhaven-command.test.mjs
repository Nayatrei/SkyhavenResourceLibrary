import test from 'node:test';
import assert from 'node:assert/strict';
import {commandImage,commandNavigation,commandIcon} from './skyhaven-command.mjs';
import {assetScope,readState,filterEntities,filterPacks} from './skyhaven-library-state.mjs';

const data={entities:[
  {id:'character:Elara',name:'Elara',category:'characters',game:'skyhaven',group:'Village',variants:[{thumbnail:{ready:true,url:'https://source.test/elara.png'}}]},
  {id:'creature:Cat',name:'Cat',category:'companions',game:'companion',group:'Companion',cover:{url:'https://source.test/cat.png'}},
  {id:'character:Sizz',name:'Sizz',category:'characters',game:'skyhaven',group:'Arcturus SD45'},
  {id:'character:A',name:'A',category:'characters',game:'legends',group:'Legends'},
],packs:[
  {id:'Castle',name:'Castle',category:'environments',game:'shared',group:'DETAILED'},
  {id:'UTU-Yin',name:'Yin',group:'Epic Games',game:'skyhaven',sections:['characters']},
]};
test('hosted source art is not requested until source health is ONLINE',()=>{
  const html=commandImage(data.entities[0],{hosted:true});
  assert.match(html,/data-live-src="https:\/\/source.test\/elara.png"/);
  assert.doesNotMatch(html,/(?<!-)\bsrc=/);
  assert.match(commandImage(data.entities[0]),/ src=/);
  assert.match(commandImage(null),/No source preview/);
});

test('main menus contain two parent sections and keep existing character and gallery links',()=>{
  const html=commandNavigation();
  assert.equal((html.match(/<summary /g)||[]).length,2);
  assert.ok(html.indexOf('href="#animations"')<html.indexOf('catalog-menu-environments'));
  assert.ok(html.indexOf('href="#companions"')<html.indexOf('catalog-menu-environments'));
  for(const view of ['characters','characters/art','characters/genesis-chat/characters','environments','environments/genesis-chat/backgrounds']){
    assert.ok(html.includes('href="#'+view+'"'));
  }
  assert.match(commandIcon('star'),/<svg/);
});

test('Skyhaven includes former Companion and Legends while source packs and Arcturus have separate scopes',()=>{
  assert.deepEqual(filterEntities(data.entities,{scope:'skyhaven'},'characters').map(x=>x.id),['character:Elara','character:A']);
  assert.deepEqual(filterEntities(data.entities,{scope:'skyhaven'},'companions').map(x=>x.id),['creature:Cat']);
  assert.deepEqual(filterEntities(data.entities,{scope:'remake'},'characters').map(x=>x.id),['character:Sizz']);
  assert.deepEqual(filterPacks(data.packs,{scope:'purchased'},'characters').map(x=>x.id),['UTU-Yin']);
  assert.equal(filterPacks(data.packs,{scope:'skyhaven'},'environments').length,0);
  assert.equal(assetScope({resourcePath:'Library/Environments/Arcturus_Dome_Original_3D/Preview.jpg',game:'skyhaven'}),'remake');
  assert.equal(assetScope({pack:'Arcturus',game:'skyhaven'}),'remake');
  assert.equal(assetScope({pack:'Celestial Cycle Dynamic Player',game:'shared'}),'skyhaven');
  assert.equal(assetScope({resourcePath:'Library/Animations/Shared/Previews/Purchased/Walk.fbx',game:'skyhaven'}),'purchased');
});

test('old bookmarks retain scope and current URLs override the legacy query',()=>{
  const read=(query)=>readState('https://source.test/?'+query+'#companions');
  for(const game of ['skyhaven','companion','legends'])assert.equal(read('game='+game).scope,'skyhaven');
  assert.equal(read('game=shared').scope,'purchased');
  assert.equal(read('game=shared&scope=remake').scope,'remake');
  assert.equal(read('game=constructor').scope,'all');
});
