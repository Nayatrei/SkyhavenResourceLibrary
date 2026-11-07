import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image
from publish_genesis_chat_art import build_catalog, publish, verify_live


class GenesisChatPublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='test-chat-art-')
        self.addCleanup(self.temp.cleanup)
        self.source=Path(self.temp.name)/'chat'
        self.site=Path(self.temp.name)/'site';self.site.mkdir()
        (self.site/'index.html').write_text('<script type="application/json" id="skyhaven-deployment">{"mode":"hosted-catalog","characterArt":{"revision":"keep"}}</script>')
        self.public=self.source/'public'
        (self.public/'content/json').mkdir(parents=True)
        entries=[]
        for pack in ['pack-a','pack-b']:
            avatar=self.public/f'content/images/avatars/{pack}/shared.webp'
            avatar.parent.mkdir(parents=True)
            Image.new('RGB',(20,30),'red').save(avatar)
            cover=self.public/f'content/images/covers/{pack}.jpg';cover.parent.mkdir(exist_ok=True)
            Image.new('RGB',(32,18),'blue').save(cover)
            data=dict(schemaVersion=2,packId=pack,version='2',metadata=dict(title=pack,displayName='팩 '+pack,coverImageData=f'/content/images/covers/{pack}.jpg'),profiles=[dict(id='shared',name='Shared',avatar=f'/content/images/avatars/{pack}/shared.webp',privateNote='DO NOT COPY'),dict(id='no-art',name='No Artwork',avatar=None)])
            (self.public/f'content/json/{pack}.json').write_text(json.dumps(data),encoding='utf-8')
            entries.append(dict(id=pack,dataFile=pack+'.json'))
        (self.public/'content/content.json').write_text(json.dumps(entries),encoding='utf-8')

    def test_composite_identity_keeps_shared_names_distinct_and_missing_art_explicit(self):
        catalog,_=build_catalog(self.source,'2026-11-06')
        self.assertEqual(catalog['counts'],dict(characters=2,backgrounds=2,packs=2,missingPortraits=2))
        self.assertEqual(len({i['id'] for i in catalog['items']}),4)
        self.assertNotIn('DO NOT COPY',json.dumps(catalog))
        first=catalog['items'][0]
        self.assertEqual(first['image']['width'],20)
        self.assertEqual(first['image']['sourceHash'],hashlib.sha256((self.public/first['image']['path'].removeprefix('public/')).read_bytes()).hexdigest())

    def test_publication_copies_metadata_only_preserves_source_and_existing_archive(self):
        original=(self.public/'content/json/pack-a.json').read_bytes()
        before=self.site/'artwork/catalog.json';before.parent.mkdir();before.write_text('existing archive')
        result=publish(self.source,self.site,'2026-11-06')
        self.assertEqual(result['mediaFilesCopied'],0)
        self.assertEqual(before.read_text(),'existing archive')
        self.assertEqual((self.public/'content/json/pack-a.json').read_bytes(),original)
        self.assertFalse((self.site/'artwork/media').exists())
        self.assertIn('"revision": "keep"',(self.site/'index.html').read_text())
        self.assertEqual(publish(self.source,self.site,'2026-11-06')['revision'],result['revision'])

    def test_live_binding_mismatch_and_outside_images_cannot_publish(self):
        catalog,expected=build_catalog(self.source,'2026-11-06')
        fetch=lambda path:json.loads((self.public/path.lstrip('/')).read_text(encoding='utf-8'))
        verify_live(catalog,expected,fetch)
        data=fetch('/content/json/pack-a.json');data['profiles'][0]['avatar']='/content/images/avatars/changed.webp'
        with self.assertRaisesRegex(ValueError,'bindings differ'):
            verify_live(catalog,expected,lambda path:data if path=='/content/json/pack-a.json' else fetch(path))
        data['profiles'][0]['avatar']='/content/images/../../../secret.png'
        (self.public/'content/json/pack-a.json').write_text(json.dumps(data),encoding='utf-8')
        with self.assertRaisesRegex(ValueError,'Invalid public image'):
            publish(self.source,self.site,'2026-11-06')
        self.assertFalse((self.site/'artwork/genesis-chat.json').exists())


if __name__=='__main__':
    unittest.main()
