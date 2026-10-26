import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryEntry,categoryImage,categoryCount,commandImage,commandNavigation,commandOverview} from './skyhaven-command.mjs';
const data={motionCount:120,entities:[
  {id:'character:Elara',name:'Elara',category:'characters',game:'skyhaven',group:'Village',variants:[{thumbnail:{ready:true,url:'https://source.test/elara.png'}}]},
  {id:'creature:Cat',name:'Cat',category:'companions',game:'companion',group:'Creatures',cover:{url:'https://source.test/cat.png'}},
],packs:[{id:'Castle',name:'Castle',category:'environments',game:'shared',group:'DETAILED',availability:'local',cover:{url:'https://source.test/castle.png',source:'Original pack cover'}}]};
test('category artwork reuses real cover or ready model thumbnails and respects game',()=>{
  assert.equal(categoryImage(categoryEntry(data,'characters')),'https://source.test/elara.png');
  assert.equal(categoryImage(categoryEntry(data,'animations')),'https://source.test/elara.png');
  assert.equal(categoryImage(categoryEntry(data,'environments')),'https://source.test/castle.png');
  assert.equal(categoryEntry(data,'characters','shared'),undefined);
  assert.equal(categoryCount(data,'characters'),1);
  assert.equal(categoryCount(data,'characters','shared'),0);
  assert.equal(categoryCount(data,'animations'),120);
});
test('hosted art has no src or background request before source health is online',()=>{
  const html=commandImage(data.entities[0],{hosted:true});
  assert.match(html,/data-live-src="https:\/\/source.test\/elara.png"/);
  assert.doesNotMatch(html,/(?<!-)\bsrc=/);
  assert.doesNotMatch(html,/background-image/);
  assert.match(commandImage(data.entities[0]),/ src=/);
});
test('overview uses existing metadata, deep links, category cards and no personal paths',()=>{
  const html=commandOverview(data,{hosted:true});
  for(const route of ['characters','animations','environments','companions','owned'])assert.match(html,new RegExp('href="#'+route));
  assert.match(html,/href="#environments\/pack\/Castle"/);
  assert.match(html,/href="#characters\/character%3AElara"/);
  assert.match(html,/Original pack cover/);
  assert.doesNotMatch(html,/file:|[A-Z]:\\|generated_images|localhost/);
  const filtered=commandOverview(data,{game:'companion'});
  assert.doesNotMatch(filtered,/elara.png|castle.png/);
});
test('navigation exposes active category, escaping and graceful missing art',()=>{
  assert.match(commandNavigation(data,{active:'characters'}),/href="#characters" aria-current="page"/);
  assert.match(commandNavigation(data,{active:'home'}),/href="#home" aria-current="page"/);
  const hostile={entities:[],packs:[{name:'<script>',id:'a" onclick="bad',category:'environments',game:'shared',cover:{url:'https://source.test/a?x="<',source:'<b>bad</b>'}}],motionCount:0};
  const html=commandOverview(hostile);
  assert.doesNotMatch(html,/<script>|<b>bad<\/b>| onclick="bad/);
  assert.match(html,/&lt;script&gt;/);
  assert.match(commandImage(null),/command-no-image/);
});
