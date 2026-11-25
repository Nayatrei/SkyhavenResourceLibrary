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
STATES = {f'{activity}-{mood}' for activity in ('listening', 'speaking') for mood in MOODS}
SITE = Path(__file__).resolve().parents[1]


def build(resources, handoff, packs):
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
    catalog = {'edition': EDITION, 'resourceSHA256': hashlib.sha256(handoff.read_bytes()).hexdigest(),
               'batches': batches, 'characters': list(actors.values())}
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
    parser.add_argument('packs', type=Path, nargs='+')
    args = parser.parse_args()
    build(args.resources, args.characters, args.packs)
