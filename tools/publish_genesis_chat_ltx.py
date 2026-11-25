"""Archive the dated ImageGen / LTX review edition from immutable production handoffs."""
import argparse
import hashlib
import io
import json
import subprocess
from pathlib import Path

from PIL import Image

from publish_genesis_chat_packs import COLLECTION, MEDIA, MOODS, archive, read, video_info

EDITION = '2026-11-25'
CAST_SOURCE_SHA = '6819a9fb0348f9e882e06b020d8310877c71722da3dd55706761ff67582f036d'
ART_RECORDS = {
    'zhuge-liang': '4426d9638f595a6ec14e140589acee316b0076d9688a5f9133228f560ca02b54',
    'cao-cao': 'e792a68066f4277377890f431841a66b237962f6f078816ad96f67921075e145',
}
STATES = {f'{activity}-{mood}' for activity in ('listening', 'speaking') for mood in MOODS}
SITE = Path(__file__).resolve().parents[1]


def add_cast_references(actors, path, resource_sha):
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != CAST_SOURCE_SHA:
        raise ValueError('Cast expression source fingerprint differs from handoff')
    cast = json.loads(raw)
    if (cast['edition'] != EDITION or cast['characterResourceSHA256'] != resource_sha
            or cast['actors'].keys() != actors.keys()):
        raise ValueError('Cast expression sources target another edition or roster')
    for slug, actor in actors.items():
        supplied = cast['actors'][slug]['references']
        bindings = sorted((state, sha) for sha, item in supplied.items() for state in item['states'])
        expected = sorted((state, asset['sha256']) for state, asset in actor['expressionsByState'].items()
                          if not state.endswith('-neutral'))
        if bindings != expected:
            raise ValueError(f'Expression source states do not match the published images: {slug}')
        source = actor.setdefault('expressionSource', {
            'recordSHA256': cast['sourceDocuments'][slug]['sha256'], 'references': {}})
        for sha, item in supplied.items():
            caption = {k: item[k] for k in ('chapter', 'url', 'sceneKo', 'noteKo') if k in item}
            if source['references'].setdefault(sha, caption) != caption:
                raise ValueError(f'Previously published caption differs from handoff: {slug} {sha}')


def build(resources, handoff, packs, art_record=None):
    reference = read(handoff)
    root = resources / COLLECTION
    edition_dir = root / EDITION
    edition_dir.mkdir(parents=True, exist_ok=True)

    def media(path, sha):
        path = Path(path)
        suffix = path.suffix.lower()
        if suffix not in {'.png', '.webp', '.webm'}:
            raise ValueError(f'Unsupported media: {path}')
        target = root if (root / (sha + suffix)).is_file() else edition_dir
        base = MEDIA if target == root else MEDIA + EDITION + '/'
        return archive(path.read_bytes(), suffix, target, sha, media_base=base)

    legacy = read(SITE/'artwork/genesis-chat-packs.json')
    roster = {a['slug']: a for a in legacy['characters']}
    frames = {sha: media(row['file'], sha) for sha, row in reference['uniqueFirstFrames'].items()}
    actors = {}
    if reference['revision'] != '20261125-imagegen-native-ltx' or set(reference['actors']) != set(roster):
        raise ValueError('Unexpected character resource edition or roster')
    for slug, row in reference['actors'].items():
        original = roster[slug]
        actor = {key: original[key] for key in ('slug', 'name', 'nameEn', 'packId', 'profileId')}
        portrait = row['regularCallPortrait']
        if original['portrait']['sha256'] != portrait['sha256'] or row['key'] != slug or row['nameKo'] != actor['name']:
            raise ValueError(f'Portrait identity changed: {slug}')
        actor['portrait'] = media(portrait['file'], portrait['sha256'])
        if set(row['expressionFrames']) != STATES or set(row['sceneLayers']) != {'far', 'mid', 'near'}:
            raise ValueError(f'Incomplete art handoff: {slug}')
        actor['expressionsByState'] = {state: frames[item['sourceSHA256']] for state, item in row['expressionFrames'].items()}
        actor['layers'] = {}
        for key, item in row['sceneLayers'].items():
            layer = media(item['file'], item['sha256'])
            layer['original'] = media(item['original'], item['originalSHA256'])
            actor['layers'][key] = layer
        actor['clips'] = {}
        actors[slug] = actor

    used = set()
    batches = []
    for number, pack in enumerate(packs, 1):
        batch = read(pack)
        if (batch['revision'] != 'ImageGen/native-LTX-20261125' or batch['batch'] != number
                or len(batch['clips']) != batch['count'] or batch['count'] != 10 or batch['through'] != number*10):
            raise ValueError(f'Invalid batch: {pack}')
        batches.append({'batch': number, 'sha256': hashlib.sha256(pack.read_bytes()).hexdigest()})
        for row in batch['clips']:
            state = row['state']
            actor = actors[row['actor']]
            expression = actor['expressionsByState'][state]
            if (state in actor['clips'] or row['sha256'] in used or row['sourceArtSHA256'] != expression['sha256']
                    or row['userApproved'] is not False):
                raise ValueError(f'Conflicting review slot: {actor["slug"]} {state}')
            stream, duration = video_info(row['file'])
            seconds = 6 if state.startswith('listening-') else 3
            if (stream['codec_name'] != 'vp9' or abs(duration-seconds) > 0.05
                    or row['technical']['seconds'] != seconds or not row['technical']['alphaDecodedEveryFrame']):
                raise ValueError(f'Unexpected recording format: {row["file"]}')
            first = subprocess.check_output(['ffmpeg','-v','error','-c:v','libvpx-vp9','-i',row['file'],
                                             '-frames:v','1','-c:v','png','-f','image2pipe','pipe:1'])
            with Image.open(io.BytesIO(first)) as decoded, Image.open(row['poster']) as poster:
                if decoded.size != poster.size or decoded.convert('RGBA').tobytes() != poster.convert('RGBA').tobytes():
                    raise ValueError(f'Poster differs from first frame: {row["poster"]}')
            clip = media(row['file'], row['sha256'])
            thumbnail = media(row['poster'], row['posterSHA256'])
            review = row.get('artTeamReview') or {}
            clip.update(poster=thumbnail['url'], posterSHA256=thumbnail['sha256'], duration=duration,
                        expression=expression, batch=number, jobId=row['jobId'], score=review.get('score'),
                        artNote=review.get('note'), nativeReviewReason=row.get('nativeReviewReason'),
                        reviewStatus='owner-review-pending')
            actor['clips'][state] = clip
            used.add(clip['sha256'])
            if row['actor'] == 'guan-yu' and state == 'speaking-angry':
                source = (pack.parent/'guan-yu-angry-source.ko.md').read_bytes()
                archive(source, '.md', edition_dir, 'b283bffad7424ebe96c32d49fd10b8338766994a9c768eda23327e82b3dcd9e3')
                paragraphs = dict(line[2:].split(':** ', 1) for line in source.decode('utf-8-sig').splitlines()
                                  if line.startswith('**') and ':** ' in line)
                actor['sceneNote'] = {'mood': '화남', 'art': paragraphs['원화 동기'],
                                      'performance': paragraphs['말하기 연기 참고'], 'citation': '삼국지연의 제73회'}
    paths = [art_record] if isinstance(art_record, Path) else art_record or []
    for path in paths:
        source = path.read_bytes()
        slug = json.loads(source)['characterId']
        archive(source, '.json', edition_dir, ART_RECORDS[slug])
    for slug, record_sha in ART_RECORDS.items():
        actor = actors[slug]
        if not actor['clips']:
            continue
        source = (edition_dir/(record_sha+'.json')).read_bytes()
        if hashlib.sha256(source).hexdigest() != record_sha:
            raise ValueError(f'Archived art record differs from handoff: {slug}')
        record = json.loads(source)
        if record['characterId'] != slug or record['regularCallAvatar']['sha256'] != actor['portrait']['sha256']:
            raise ValueError('Character art record does not match the portrait')
        references = {}
        for item in record['assets']:
            sha = item['imageGen']['sha256']
            mood = item['emotion']
            if any(actor['expressionsByState'][mode+'-'+mood]['sha256'] != sha for mode in ('listening','speaking')):
                raise ValueError(f'Character art record does not match the {mood} frame')
            reference = item['novelReference'].copy()
            if slug == 'cao-cao' and mood == 'surprised':
                reference['sceneKo'] = '적벽에서 정욱의 경고를 듣고 다가오는 배의 위험을 깨닫는 조조'
            references[sha] = reference
        actor['expressionSource'] = {'recordSHA256': record_sha, 'references': references}
    catalog = {'edition': EDITION, 'resourceSHA256': hashlib.sha256(handoff.read_bytes()).hexdigest(),
               'batches': batches, 'characters': list(actors.values())}
    if len(packs) >= 7:
        add_cast_references(actors, packs[6].with_name('cast-expression-sources.json'), catalog['resourceSHA256'])
        catalog['castExpressionSourceSHA256'] = CAST_SOURCE_SHA
    body = (json.dumps(catalog, ensure_ascii=False, indent=2)+'\n').encode()
    site_catalog = SITE/'artwork'/f'genesis-chat-packs-{EDITION}.json'
    if site_catalog.exists():
        previous = read(site_catalog)
        old_batches = previous['batches']
        if previous['resourceSHA256'] != catalog['resourceSHA256'] or batches[:len(old_batches)] != old_batches:
            raise ValueError('Previously published resources and batches must be preserved')
    snapshot = edition_dir / ('catalog-through-%03d.json' % len(used))
    if snapshot.exists() and snapshot.read_bytes() != body:
        raise ValueError('This archived handoff already exists with different contents')
    if not snapshot.exists():
        with snapshot.open('xb') as file:
            file.write(body)
    site_catalog.write_bytes(body)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--resources', type=Path, required=True)
    parser.add_argument('--characters', type=Path, required=True)
    parser.add_argument('--art-record', type=Path, action='append', help='Original character art record for first-time archival (repeatable)')
    parser.add_argument('packs', type=Path, nargs='+')
    args = parser.parse_args()
    build(args.resources, args.characters, args.packs, args.art_record)
