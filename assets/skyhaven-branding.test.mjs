import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root));

test('favicon, touch icon and mascot links resolve to the matching image dimensions',async()=>{
  const html=await (await read('index.html')).toString();
  for(const [file,size] of [['favicon-16x16.png',16],['favicon-32x32.png',32],['apple-touch-icon.png',180],['icon-64.png',64]]){
    assert.ok(html.includes(`branding/${file}`),file);
    const png=await read('branding/'+file);
    assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
  assert.equal((html.match(/rel="manifest"/g)||[]).length,1);
  assert.equal((html.match(/rel="apple-touch-icon"/g)||[]).length,1);
  assert.ok(html.includes('Skyhaven library'));
  assert.ok(html.includes('branding/site.webmanifest'));
  const ico=await read('branding/favicon.ico');assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
});

test('manifest uses this site scope, real any and maskable icons, and preserved source hashes',async()=>{
  const manifest=JSON.parse(await read('branding/site.webmanifest'));
  assert.equal(manifest.name,'Skyhaven Resource Library');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/#home');
  assert.equal(manifest.icons.length,4);
  for(const icon of manifest.icons){
    const [w,h]=icon.sizes.split('x').map(Number),png=await read(icon.src.slice(1));
    assert.equal(png.readUInt32BE(16),w);assert.equal(png.readUInt32BE(20),h);
    assert.equal(icon.type,'image/png');assert.ok(['any','maskable'].includes(icon.purpose));
  }
  const sources=JSON.parse(await read('branding/asset-sources.json'));
  for(const [file,digest] of Object.entries(sources.files))assert.equal(createHash('sha256').update(await read('branding/'+file)).digest('hex'),digest,file);
});
