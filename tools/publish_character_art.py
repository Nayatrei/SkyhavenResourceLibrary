"""Copy the designated character-art folder into the static site. Never push Git."""
import argparse
from copy import deepcopy
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import time

from PIL import Image

API = '/comfy/skyhaven/api/library/art-archive'
IMAGES = {'.png', '.jpg', '.jpeg', '.webp'}
FIELDS = ('id', 'name', 'pack', 'package', 'role', 'version', 'width', 'height',
          'status', 'approvalKind', 'reason', 'assetId', 'game')


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def source_image(root, relative):
    parts = PurePosixPath(relative).parts
    if (not parts or parts[0] not in {'artwork', 'preview'} or relative.startswith('/')
            or ':' in relative or '\\' in relative or any(p.startswith('.') for p in parts)
            or Path(relative).suffix.lower() not in IMAGES):
        raise ValueError('Invalid artwork path')
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise ValueError('Missing or unbounded artwork image')
    return path


def publish(source, site, settle_seconds=10):
    source, site = Path(source).resolve(), Path(site).resolve()
    index = site / 'index.html'
    html = index.read_text(encoding='utf-8')
    pattern = r'(<script type="application/json" id="skyhaven-deployment">)(.*?)(</script>)'
    match = re.search(pattern, html, re.S)
    if not match:
        raise ValueError('Missing static-site deployment configuration')
    spec = json.loads(match[2])
    catalog = json.loads((source / 'catalog.json').read_text(encoding='utf-8-sig'))
    result = {key: deepcopy(catalog[key]) for key in
              ('schemaVersion', 'available', 'title', 'date', 'counts', 'packs') if key in catalog}
    result.update(available=True, mediaStorage='site', items=[], comparisons=[])
    files, known, identities = {}, set(), {}

    def descriptor(record):
        path = source_image(source, record['path'])
        stat = path.stat()
        if time.time() - stat.st_mtime < settle_seconds:
            raise ValueError('Artwork is still being saved; retain the last publication')
        sha = digest(path)
        if record.get('sourceHash', sha) != sha:
            raise ValueError('Curated artwork hash changed; review its catalog entry first')
        with Image.open(path) as image:
            image.verify()
        if path.stat().st_size != stat.st_size or path.stat().st_mtime_ns != stat.st_mtime_ns:
            raise ValueError('Artwork changed during publication')
        target = 'artwork/media/' + sha + path.suffix.lower()
        files[target] = (path, sha)
        known.add(record['path'])
        return dict(path=record['path'], url='/' + target, storage='site', sourceHash=sha, size=stat.st_size)

    def artwork(item):
        out = {key: item[key] for key in FIELDS if key in item}
        out.update(original=descriptor(item['original']), preview=descriptor(item['preview']))
        return out

    for item in catalog.get('items', []):
        result['items'].append(artwork(item))
        parts = PurePosixPath(item['original']['path']).parts
        if item.get('assetId'):
            identities.setdefault((item['pack'], parts[2]), set()).add(item['assetId'])
    for case in catalog.get('comparisons', []):
        out = {key: case[key] for key in ('id', 'name', 'pack', 'package', 'caption', 'note') if key in case}
        out.update(before=artwork(case['before']), after=artwork(case['after']))
        if case.get('prompt'):
            out['prompt'] = {key: case['prompt'][key] for key in ('prompt', 'promptSha256', 'model') if key in case['prompt']}
        result['comparisons'].append(out)

    for path in sorted((source / 'artwork').glob('*/*/*')):
        relative = path.relative_to(source).as_posix()
        if path.suffix.lower() not in IMAGES or relative in known or not path.is_file():
            continue
        group, identity = path.parent.parent.name, path.parent.name
        result['packs'].setdefault(group, {'name': group, 'package': group})
        image = descriptor({'path': relative})
        with Image.open(path) as opened:
            width, height = opened.size
        item = dict(id='upload:' + '/'.join((group, identity, path.name)), name=identity,
                    pack=group, package=result['packs'][group].get('package', group), role='추가 원화',
                    version=path.stem, status='미검토 원화', approvalKind='unreviewed',
                    reason='저장 폴더로 분류한 추가 자료입니다. 기존 선정 원화를 교체하지 않습니다.',
                    width=width, height=height, original=image, preview=image)
        candidates = identities.get((group, identity), set())
        if len(candidates) == 1:
            item['assetId'] = next(iter(candidates))
        result['items'].append(item)

    ids = [item['id'] for item in result['items']]
    if len(ids) != len(set(ids)):
        raise ValueError('Duplicate artwork ID')
    result['counts'] = dict(items=len(ids), characters=sum(i['pack'] != 'BanditWeapons' for i in result['items']),
                            equipment=sum(i['pack'] == 'BanditWeapons' for i in result['items']))
    result['date'] = datetime.fromtimestamp(max(p.stat().st_mtime for p, _ in files.values()), timezone.utc).date().isoformat()
    body = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n'
    revision = hashlib.sha256(body.encode()).hexdigest()

    # Validate everything before publishing any new files. Hash names never overwrite other bytes.
    for relative, (_, sha) in files.items():
        target = site / relative
        if target.exists() and digest(target) != sha:
            raise ValueError('Static artwork collision; preserve existing file')
    for relative, (path, _) in files.items():
        target = site / relative
        if not target.exists():
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)
        if digest(target) != files[relative][1]:
            raise ValueError('Artwork copy verification failed')
    output = site / 'artwork/catalog.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp')
    temporary.write_text(body, encoding='utf-8')
    temporary.replace(output)
    spec['characterArt'] = {'catalog': 'artwork/catalog.json', 'revision': revision}
    html = html[:match.start(2)] + json.dumps(spec, ensure_ascii=False) + html[match.end(2):]
    index.write_text(html, encoding='utf-8')
    return dict(items=len(ids), images=len(files), bytes=sum(p.stat().st_size for p, _ in files.values()), revision=revision)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--site', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    print(json.dumps(publish(args.source, args.site), ensure_ascii=False))
