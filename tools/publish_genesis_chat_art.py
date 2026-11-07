"""Index GenesisChat's referenced public artwork without copying media or profiles."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import date
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
from urllib.parse import quote
from urllib.request import urlopen

from PIL import Image

ORIGIN = 'https://genesischat.online'


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def bindings(pack):
    return {'packId': pack['packId'], 'cover': pack['metadata'].get('coverImageData'),
            'profiles': {p['id']: p.get('avatar') for p in pack['profiles']}}


def build_catalog(source, checked):
    public = (Path(source) / 'public').resolve()
    index_path = public / 'content/content.json'
    index_bytes = index_path.read_bytes()
    entries = json.loads(index_bytes.decode('utf-8-sig'))
    catalog = dict(schemaVersion=1, available=True, date=checked, source='GenesisChat',
                   origin=ORIGIN, indexHash=hashlib.sha256(index_bytes).hexdigest(), packs={}, items=[], missingPortraits=[])
    expected = {}

    def image(relative):
        parts = PurePosixPath(relative).parts
        if (not relative.startswith('/content/images/') or '\\' in relative or ':' in relative
                or any(p in {'.', '..'} for p in parts) or Path(relative).suffix.lower() not in {'.png', '.jpg', '.jpeg', '.webp'}):
            raise ValueError('Invalid public image path')
        path = (public / relative.lstrip('/')).resolve()
        if not path.is_relative_to(public) or not path.is_file():
            raise ValueError('Missing or unbounded public image: ' + relative)
        stat = path.stat()
        with Image.open(path) as opened:
            width, height = opened.size
            opened.verify()
        sha = digest(path)
        if path.stat().st_mtime_ns != stat.st_mtime_ns or path.stat().st_size != stat.st_size:
            raise ValueError('Source image changed while indexing')
        return dict(path='public' + relative, url=ORIGIN + quote(relative, safe='/'),
                    sourceHash=sha, size=stat.st_size, width=width, height=height)

    for entry in entries:
        filename = entry['dataFile']
        if Path(filename).name != filename or not filename.endswith('.json'):
            raise ValueError('Invalid pack filename')
        path = public / 'content/json' / filename
        pack_bytes = path.read_bytes()
        pack = json.loads(pack_bytes.decode('utf-8-sig'))
        pack_id = pack['packId']
        if pack_id != entry['id'] or pack_id in catalog['packs'] or pack.get('schemaVersion') != 2:
            raise ValueError('Invalid or duplicate pack identity')
        meta = pack['metadata']
        catalog['packs'][pack_id] = dict(name=meta.get('displayName') or meta['title'],
                                        nameEn=meta['title'], path='public/content/json/' + filename,
                                        sourceHash=hashlib.sha256(pack_bytes).hexdigest(), revision=pack.get('contentRevision'),
                                        version=pack['version'])
        expected['/content/json/' + filename] = bindings(pack)
        seen = set()
        for profile in pack['profiles']:
            profile_id = profile['id']
            if profile_id in seen:
                raise ValueError('Duplicate profile identity within pack')
            seen.add(profile_id)
            name = (profile.get('localizedNames') or {}).get('ko-KR') or profile['name']
            if not profile.get('avatar'):
                catalog['missingPortraits'].append(dict(packId=pack_id, profileId=profile_id, name=name))
                continue
            catalog['items'].append(dict(id='character:' + json.dumps([pack_id, profile_id], separators=(',', ':')),
                                         kind='character', packId=pack_id, profileId=profile_id,
                                         name=name, nameEn=profile['name'], image=image(profile['avatar'])))
        if meta.get('coverImageData'):
            catalog['items'].append(dict(id='background:' + pack_id, kind='background', packId=pack_id,
                                         name=meta.get('displayName') or meta['title'], nameEn=meta['title'],
                                         image=image(meta['coverImageData'])))
    catalog['counts'] = dict(characters=sum(i['kind']=='character' for i in catalog['items']),
                             backgrounds=sum(i['kind']=='background' for i in catalog['items']),
                             packs=len(catalog['packs']), missingPortraits=len(catalog['missingPortraits']))
    return catalog, expected


def verify_live(catalog, expected, fetch_json=None):
    def fetch(path):
        if fetch_json:
            return fetch_json(path)
        with urlopen(ORIGIN + path, timeout=30) as response:
            return json.load(response)
    index = fetch('/content/content.json')
    if (len(index) != len(catalog['packs']) or {e['id']:e['dataFile'] for e in index}
            != {key:PurePosixPath(value['path']).name for key,value in catalog['packs'].items()}):
        raise ValueError('Published pack set differs from local source')

    def verify(path):
        if bindings(fetch(path)) != expected[path]:
            raise ValueError('Published artwork bindings differ: ' + path)
    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(verify, expected))


def publish(source, site, checked, verify=False):
    catalog, expected = build_catalog(source, checked)
    if verify:
        verify_live(catalog, expected)
    catalog['publicBindingsVerified'] = verify
    body = json.dumps(catalog, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'
    revision = hashlib.sha256(body.encode()).hexdigest()
    site = Path(site)
    index = site/'index.html'
    html = index.read_text(encoding='utf-8')
    match = re.search(r'(<script type="application/json" id="skyhaven-deployment">)(.*?)(</script>)', html, re.S)
    if not match:
        raise ValueError('Missing site deployment configuration')
    spec = json.loads(match[2])
    spec['genesisChatArt'] = dict(catalog='artwork/genesis-chat.json', revision=revision)
    output = site/'artwork/genesis-chat.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(body, encoding='utf-8')
    index.write_text(html[:match.start(2)] + json.dumps(spec, ensure_ascii=False) + html[match.end(2):], encoding='utf-8')
    return dict(**catalog['counts'], revision=revision, mediaFilesCopied=0, publicBindingsVerified=verify)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--site', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--date', default=date.today().isoformat())
    parser.add_argument('--verify-live', action='store_true')
    args = parser.parse_args()
    print(json.dumps(publish(args.source, args.site, args.date, args.verify_live)))
