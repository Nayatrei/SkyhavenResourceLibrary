"""Build GitHub Pages files; original models/textures remain in local folders.

Default: export the existing Nourish library. --catalog accepts the portable
snapshot schema documented in web/skyhaven-manual.ko.md for another user's data.
Never uploads, starts a server, moves sources, or writes Git/DNS settings.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlsplit, quote

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
WEB = REPO / 'web' if (REPO / 'web/skyhaven.html').is_file() else REPO / 'assets'
BASE = '/comfy/skyhaven'
API = BASE + '/api/library'
IMAGES = {'.png', '.jpg', '.jpeg', '.webp'}


def file_hash(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def local_url(root, relative):
    parts = relative.replace('\\', '/').split('/')
    if not root or any(not p or p in {'.', '..'} or ':' in p for p in parts):
        raise ValueError('Invalid local resource path')
    return '__local/' + quote(root, safe='') + '/' + quote('/'.join(parts), safe='/')


def route_name(route):
    known = {API: 'catalog.json', API + '/motions': 'motions.json', BASE + '/api/resources': 'resources.json'}
    if route in known:
        return known[route]
    return 'data/' + hashlib.sha256(route.encode()).hexdigest() + '.json'


class SiteExporter:
    def __init__(self, output, roots, library=None):
        self.output, self.roots, self.library = output, roots, library
        self.library_id = hashlib.sha256(json.dumps({key: str(path) for key, path in sorted(roots.items())}).encode()).hexdigest()[:16]
        self.previews, self.local_files, self.missing_previews = {}, {}, set()

    def local_reference(self, source):
        source = source.resolve()
        matches = [(key, root.resolve()) for key, root in self.roots.items() if source.is_relative_to(root.resolve())]
        if not matches:
            raise ValueError('File has no registered local root: ' + str(source))
        key, root = max(matches, key=lambda pair: len(str(pair[1])))
        relative = source.relative_to(root).as_posix()
        self.local_files[(key, relative)] = source
        return dict(root=key, path=relative)

    def source_for(self, url):
        if not self.library:
            return None
        path = unquote(urlsplit(url).path)
        lib = self.library
        if path.startswith(BASE + '/files/'):
            return lib.resources.file(path[len(BASE + '/files/'):])
        if path.startswith(API + '/source/'):
            provider, relative = path[len(API + '/source/'):].split('/', 1)
            return lib.source(provider, relative)
        for name in ['thumbnails', 'covers', 'bundles']:
            prefix = API + '/' + name + '/'
            if path.startswith(prefix):
                from services.skyhaven_library import safe_child
                return safe_child(lib.cache / name, path[len(prefix):])
        return None

    def preview(self, source):
        if source.suffix.lower() not in IMAGES:
            raise ValueError('Only preview images may be published: ' + str(source))
        key = file_hash(source) + source.suffix.lower()
        relative = 'previews/' + key
        if key not in self.previews:
            destination = self.output / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
            self.previews[key] = source.stat().st_size
        return '__local/_catalog/' + relative

    def transform(self, value, context=''):
        if isinstance(value, list):
            return [self.transform(item, context) for item in value]
        if isinstance(value, dict):
            result = {key: self.transform(item, key if key in {'cover', 'thumbnail', 'gallery', 'thumbnailSprite', 'thumbnailUrl'} else context)
                      for key, item in value.items() if key != 'localPath'}
            ref = value.get('localRef')
            if ref:
                if ref['root'] not in self.roots:
                    raise ValueError('Unknown local root: ' + ref['root'])
                result['url'] = local_url(self.library_id + '_' + ref['root'], ref['path'])
            elif isinstance(value.get('url'), str) and value['url'].startswith(BASE + '/'):
                try:
                    source = self.source_for(value['url'])
                    if source and source.suffix.lower() in IMAGES and context in {'cover', 'thumbnail', 'gallery', 'thumbnailSprite'}:
                        result['url'] = self.preview(source)
                    elif source:
                        ref = self.local_reference(source)
                        result.update(localRef=ref, url=local_url(self.library_id + '_' + ref['root'], ref['path']))
                except (ValueError, OSError):
                    self.missing_previews.add(value['url'])
            return result
        if isinstance(value, str) and value.startswith(BASE + '/'):
            if value.startswith(BASE + '/#'):
                return './' + value[len(BASE + '/'):]
            if value == API or value == BASE + '/api/resources' or value.startswith(API + '/assets/') or value.startswith(API + '/packs/'):
                return '__local/_catalog/' + route_name(value)
            try:
                source = self.source_for(value)
                if source:
                    if source.suffix.lower() in IMAGES and (context in {'thumbnail', 'thumbnailSprite', 'thumbnailUrl', 'cover', 'gallery'}):
                        return self.preview(source)
                    ref = self.local_reference(source)
                    return local_url(self.library_id + '_' + ref['root'], ref['path'])
            except (ValueError, OSError):
                self.missing_previews.add(value)
        if isinstance(value, str) and value.startswith('previews/'):
            return '__local/_catalog/' + value
        return value

    def write_route(self, route, data):
        target = self.output / route_name(route)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(json.dumps(self.transform(data), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


def live_snapshot():
    from services.skyhaven_library import library
    lib = library()
    snapshot = dict(overview=lib.overview(), motions=lib.motions,
                    assets={e['id']: e for e in lib.entities},
                    packs={p['id']: lib.pack(p['id']) for p in lib.packs()},
                    resources=lib.resources.catalog())
    roots = dict(workspace=lib.resources.workspace, **lib.providers)
    if not lib.resources.animation.is_relative_to(lib.resources.workspace):
        roots['animation'] = lib.resources.animation
    if lib.resources.motion_library and not lib.resources.motion_library.is_relative_to(lib.resources.workspace):
        roots['motions'] = lib.resources.motion_library
    return snapshot, roots, lib, lib.resources.workspace / '.workspace/vendor/three'


def build(output, snapshot, roots, vendor, library=None, preview_dir=None, domain=None, index_output=None):
    index_output = index_output or output.with_name(output.name + '-index')
    if output.resolve().is_relative_to(index_output.resolve()) or index_output.resolve().is_relative_to(output.resolve()):
        raise ValueError('Public app and private index folders must be separate, not nested')
    if any(not re.fullmatch(r'[a-zA-Z0-9_-]+', key) or key == '_catalog' for key in roots):
        raise ValueError('Root IDs must be simple identifiers; _catalog is reserved')
    if output.exists() or index_output.exists():
        raise ValueError('Use a new output directory; existing builds are not overwritten')
    if not (vendor / 'build/three.module.js').is_file():
        raise ValueError('Three.js vendor is missing: ' + str(vendor))
    output.mkdir(parents=True)
    index_output.mkdir(parents=True)
    exporter = SiteExporter(index_output, roots, library)
    if preview_dir:
        # Other users may supply prepared preview images; never copy a folder of source models.
        for source in preview_dir.rglob('*'):
            if source.is_file():
                if source.is_symlink() or source.suffix.lower() not in IMAGES:
                    raise ValueError('Preview folder must contain image files only')
                target = index_output / 'previews' / source.relative_to(preview_dir)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
    overview = dict(snapshot['overview'],
                    entities=[dict(e, detailUrl=route_name(API + '/assets/' + quote(e['id'], safe=''))) for e in snapshot['overview']['entities']],
                    packs=[dict(p, detailUrl=route_name(API + '/packs/' + quote(p['id'], safe=''))) for p in snapshot['overview']['packs']])
    routes = {API: overview, API + '/motions': {'motions': snapshot['motions']}, BASE + '/api/resources': snapshot['resources']}
    routes.update({API + '/assets/' + quote(key, safe=''): value for key, value in snapshot['assets'].items()})
    routes.update({API + '/packs/' + quote(key, safe=''): value for key, value in snapshot['packs'].items()})
    for route, data in routes.items():
        exporter.write_route(route, data)
    deployment = dict(schemaVersion=1, libraryId=exporter.library_id, publishedAt=datetime.now(timezone.utc).isoformat(),
                      roots=[dict(id=key, label=path.name, originalPath=str(path)) for key, path in roots.items()],
                      routes={route: route_name(route) for route in routes})
    (index_output / 'routes.json').write_text(json.dumps(deployment['routes'], ensure_ascii=False), encoding='utf-8')
    (index_output / 'library.json').write_text(json.dumps(deployment, ensure_ascii=False), encoding='utf-8')
    # Preserve the same source app instead of maintaining a second website implementation.
    assets = output / 'assets'
    assets.mkdir()
    for source in WEB.glob('skyhaven*'):
        if source.suffix in {'.mjs', '.css'} and '.test.' not in source.name and source.name != 'skyhaven-local-worker.mjs':
            shutil.copy2(source, assets / source.name)
    worker = WEB / 'skyhaven-local-worker.mjs' if WEB.name == 'web' else REPO / 'skyhaven-local-worker.mjs'
    shutil.copy2(worker, output / 'skyhaven-local-worker.mjs')
    for folder in ['build', 'examples/jsm']:
        shutil.copytree(vendor / folder, output / 'vendor/three' / folder)
    if (vendor / 'LICENSE').is_file():
        shutil.copy2(vendor / 'LICENSE', output / 'vendor/three/LICENSE')
    template = WEB / 'skyhaven.html' if WEB.name == 'web' else REPO / 'index.html'
    document = template.read_text(encoding='utf-8')
    document = re.sub(r'<script type="application/json" id="skyhaven-deployment">.*?</script>\s*', '', document, flags=re.S)
    document = document.replace('/comfy/assets/', './assets/').replace(BASE + '/.workspace/vendor/three/', './vendor/three/')
    settings = json.dumps({'schemaVersion': 1, 'mode': 'local-catalog'})
    document = document.replace('</head>', '<script type="application/json" id="skyhaven-deployment">' + settings + '</script>\n</head>')
    document = document.replace('폴더에서 바로 연결', '내 폴더에서 읽는 라이브러리').replace('파일을 정리하면<br>라이브러리도 함께 바뀝니다.', '색인은 웹에서,<br>원본은 내 폴더에서 읽습니다.')
    (output / 'index.html').write_text(document, encoding='utf-8')
    manual = WEB / 'skyhaven-manual.ko.md' if WEB.name == 'web' else REPO / 'manual.md'
    shutil.copy2(manual, output / 'manual.md')
    tools = output / 'tools'
    tools.mkdir()
    shutil.copy2(Path(__file__), tools / 'export_skyhaven_site.py')
    for source_name, target_name in [('skyhaven-snapshot.example.json', 'examples/snapshot.json'), ('skyhaven-roots.example.json', 'examples/roots.json'), ('skyhaven-site-readme.md', 'README.md')]:
        source = REPO / 'scripts/templates' / source_name
        if not source.is_file():
            source = REPO / target_name
        destination = output / target_name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    (output / '.nojekyll').touch()
    workflow = output / '.github/workflows/pages.yml'
    workflow.parent.mkdir(parents=True)
    workflow_source = REPO / 'scripts/templates/skyhaven-pages.yml'
    if not workflow_source.is_file():
        workflow_source = REPO / '.github/workflows/pages.yml'
    shutil.copy2(workflow_source, workflow)
    if domain:
        if '/' in domain or ':' in domain:
            raise ValueError('CNAME must be a bare hostname')
        (output / 'CNAME').write_text(domain.lower() + '\n', encoding='utf-8')
    files = [p for p in output.rglob('*') if p.is_file()]
    total = sum(p.stat().st_size for p in files)
    if total > 1_000_000_000:
        raise ValueError('Static output exceeds GitHub Pages 1GB limit; do not publish this build')
    report = dict(publishedAt=deployment['publishedAt'], files=len(files), bytes=total,
                  indexFiles=sum(p.is_file() for p in index_output.rglob('*')),
                  indexBytes=sum(p.stat().st_size for p in index_output.rglob('*') if p.is_file()),
                  entities=len(snapshot['overview']['entities']), packs=len(snapshot['packs']), motions=len(snapshot['motions']),
                  localResources=len(exporter.local_files), sourceFilesCopied=0,
                  missingOptionalFiles=sorted(exporter.missing_previews))
    # The report contains private library counts/paths, so keep it with the local index.
    (index_output / 'build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--index-output', type=Path, help='Private local index folder, separate from public app output')
    parser.add_argument('--catalog', type=Path, help='Portable snapshot JSON instead of the current library')
    parser.add_argument('--roots', type=Path, help='JSON object mapping root IDs to local directory paths')
    parser.add_argument('--vendor', type=Path, default=REPO / 'vendor/three', help='Local Three.js package directory (bundled in the standalone repository)')
    parser.add_argument('--previews', type=Path, help='Prepared image-only folder for a portable snapshot')
    parser.add_argument('--domain')
    args = parser.parse_args()
    if args.catalog:
        if not args.roots:
            parser.error('--catalog requires --roots')
        snapshot = json.loads(args.catalog.read_text(encoding='utf-8-sig'))
        roots = {key: Path(value) for key, value in json.loads(args.roots.read_text(encoding='utf-8-sig')).items()}
        lib, vendor = None, args.vendor
    else:
        snapshot, roots, lib, vendor = live_snapshot()
    print(json.dumps(build(args.output.resolve(), snapshot, roots, vendor, library=lib, preview_dir=args.previews, domain=args.domain, index_output=args.index_output.resolve() if args.index_output else None), ensure_ascii=False))


if __name__ == '__main__':
    main()
