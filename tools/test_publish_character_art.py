import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from PIL import Image
from publish_character_art import publish


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source, self.site = self.root / 'source', self.root / 'site'
        self.source.mkdir(); self.site.mkdir()
        (self.site / 'index.html').write_text('<script type="application/json" id="skyhaven-deployment">{"mode":"hosted-catalog"}</script>')
        image = self.source / 'artwork/Village/Elara/front.png'
        image.parent.mkdir(parents=True)
        Image.new('RGB', (20, 30), 'red').save(image)
        self.image = image
        self.file = dict(path='artwork/Village/Elara/front.png', sourceHash=hashlib.sha256(image.read_bytes()).hexdigest())
        self.catalog = dict(schemaVersion=1, available=True, packs={'Village': {'name': 'Village'}},
                            items=[dict(id='Elara', name='Elara', pack='Village', assetId='character:Elara',
                                        status='사용자 평가 85', approvalKind='accepted', original=self.file, preview=self.file)],
                            comparisons=[])
        self.save()

    def save(self):
        (self.source / 'catalog.json').write_text(json.dumps(self.catalog), encoding='utf-8')

    def output(self):
        return json.loads((self.site / 'artwork/catalog.json').read_text(encoding='utf-8'))

    def test_copy_verifies_hash_keeps_decisions_and_republishes_without_changes(self):
        before = self.image.read_bytes()
        first = publish(self.source, self.site, 0)
        item = self.output()['items'][0]
        self.assertEqual(item['status'], '사용자 평가 85')
        self.assertEqual(item['original']['storage'], 'site')
        self.assertEqual((self.site / item['original']['url'].lstrip('/')).read_bytes(), before)
        self.assertEqual(publish(self.source, self.site, 0), first)
        self.assertEqual(self.image.read_bytes(), before)

    def test_new_files_join_group_and_identity_without_becoming_approved(self):
        Image.new('RGB', (40, 50), 'blue').save(self.image.with_name('front_v002.png'))
        publish(self.source, self.site, 0)
        item = self.output()['items'][1]
        self.assertEqual(item['assetId'], 'character:Elara')
        self.assertEqual(item['status'], '미검토 원화')
        self.assertEqual(item['width'], 40)
        self.assertEqual(self.output()['items'][0]['approvalKind'], 'accepted')

    def test_modified_curated_original_or_recent_save_retains_previous_publication(self):
        publish(self.source, self.site, 0)
        previous = (self.site / 'artwork/catalog.json').read_bytes()
        with self.assertRaisesRegex(ValueError, 'still being saved'):
            publish(self.source, self.site, 999)
        Image.new('RGB', (20, 30), 'blue').save(self.image)
        with self.assertRaisesRegex(ValueError, 'hash changed'):
            publish(self.source, self.site, 0)
        self.assertEqual((self.site / 'artwork/catalog.json').read_bytes(), previous)

    def test_paths_outside_the_archive_are_rejected(self):
        self.catalog['items'][0]['original'] = {'path': 'artwork/../../../secret.png'}
        self.save()
        with self.assertRaisesRegex(ValueError, 'Invalid artwork path'):
            publish(self.source, self.site, 0)
        self.assertFalse((self.site / 'artwork').exists())

    def test_destination_collisions_are_preserved(self):
        publish(self.source, self.site, 0)
        target = self.site / self.output()['items'][0]['original']['url'].lstrip('/')
        target.write_bytes(b'other work')
        with self.assertRaisesRegex(ValueError, 'collision'):
            publish(self.source, self.site, 0)
        self.assertEqual(target.read_bytes(), b'other work')


if __name__ == '__main__':
    unittest.main()
