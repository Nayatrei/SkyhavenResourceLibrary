"""Index delivered GenesisChat review batches and archive their unique media in Skyhaven."""
import argparse
import hashlib
import json
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import quote

from publish_genesis_chat_art import digest

MOODS = ('neutral', 'happy', 'angry', 'sad', 'surprised')
APP = 'https://genesischat.online'
COLLECTION = 'Library/Art/GenesisChat/PortraitReview'
MEDIA = 'https://comfy.genesisframeworks.com/comfy/skyhaven/files/' + COLLECTION + '/'


def read(path):
    return json.loads(path.read_bytes())


def video_info(path):
    raw = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
                                   '-show_entries', 'stream=codec_name,width,height:format=duration', '-of', 'json', path])
    probe = json.loads(raw)
    return probe['streams'][0], float(probe['format']['duration'])


def archive(data, ext, root, expected=None):
    sha = hashlib.sha256(data).hexdigest()
    if expected and sha != expected:
        raise ValueError(f'Asset fingerprint differs from handoff: {expected}')
    filename = sha + ext
    dest = root / filename
    if dest.exists():
        if digest(dest) != sha:
            raise ValueError(f'Stored bytes differ: {filename}')
    else:
        with tempfile.NamedTemporaryFile(dir=root, delete=False, suffix='.pending') as staging:
            staging.write(data)
        temp = Path(staging.name)
        try:
            # Atomic, exclusive on the Windows resource volume.
            temp.rename(dest)
        finally:
            temp.unlink(missing_ok=True)
    return {'url': MEDIA + filename, 'sha256': sha, 'bytes': len(data)}


def video(path, root, expected, seconds=None):
    stream, duration = video_info(path)
    if stream['codec_name'] not in ('vp8', 'vp9') or (seconds and abs(duration-seconds) > 0.08):
        raise ValueError(f'Video codec or duration mismatch: {path}')
    info = archive(path.read_bytes(), '.webm', root, expected)
    decoder = 'libvpx-vp9' if stream['codec_name'] == 'vp9' else 'libvpx'
    frame = subprocess.check_output(['ffmpeg', '-v', 'error', '-nostdin', '-c:v', decoder, '-i', path,
                                     '-ss', '0.25', '-frames:v', '1', '-vf', 'scale=240:-2',
                                     '-c:v', 'libwebp', '-f', 'image2pipe', 'pipe:1'])
    if frame[:4] != b'RIFF':
        raise ValueError(f'No decoded poster: {path}')
    return {**info, 'duration': duration, 'poster': archive(frame, '.webp', root)['url']}


def build(records, app, resources, batches):
    public = app / 'public'
    cast = read(records / 'source-manifest.json')
    pack = cast['pack']
    root = resources / COLLECTION
    root.mkdir(parents=True, exist_ok=True)
    profiles = {p.get('avatar'): p for p in read(public/'content/json'/f'{pack}.json')['profiles']}
    actors, sources = {}, {}
    for row in cast['cast']:
        slug = row['slug']
        portrait = Path(row['source'])
        ref = '/' + portrait.relative_to(public).as_posix()
        profile = profiles[ref]
        if digest(portrait) != row['sourceSHA256']:
            raise ValueError(f'Portrait changed: {slug}')
        sources[slug] = row
        actor = {'slug': slug, 'packId': pack, 'profileId': profile['id'], 'name': row['name'],
                 'nameEn': profile['name'], 'portrait': {'url': APP + quote(ref), 'sha256': row['sourceSHA256']},
                 'expressions': {}, 'layers': {}, 'clips': {}}
        actors[slug] = actor
        for mood in MOODS:
            path = Path(row['neutral']).parent / (mood + '.png')
            if path.is_file():
                actor['expressions'][mood] = archive(path.read_bytes(), '.png', root,
                                                     row['neutralSHA256'] if mood == 'neutral' else None)
    # These three plates belong to the published Zhuge Liang review-room sample.
    module = (app/'src/xr/portraitReview/zhugeTenStateSample.ts').read_text(encoding='utf-8')
    block = module.split('export const ZHUGE_TEN_STATE_WEBM_ASSETS = ', 1)[1].split(' as const', 1)[0]
    layers = json.loads(block)
    for plane in ('far', 'mid', 'near'):
        asset = layers[plane]
        path = public / asset['url'].lstrip('/')
        actors['zhuge-liang']['layers'][plane] = (video(path, root, asset['sha256']) if plane == 'mid'
                                                   else archive(path.read_bytes(), '.png', root, asset['sha256']))
    used = set()
    receipts = []
    for number, batch_file in enumerate(batches, 1):
        batch = read(batch_file)
        if batch['batch'] != number or batch['through'] != number*10 or len(batch['clips']) != 10:
            raise ValueError(f'Incomplete or out-of-order batch: {batch_file}')
        receipts.append({'batch': number, 'sha256': digest(batch_file)})
        for clip in batch['clips']:
            slug, state = clip['actor'], clip['state']
            source = batch['characters'][slug]
            row = sources[slug]
            if (source['neutralSHA256'] != row['sourceSHA256'] or Path(source['neutralCallArt']) != Path(row['source'])
                    or Path(source['expressionStillsDirectory']) != Path(row['neutral']).parent):
                raise ValueError(f'Conflicting source binding: {slug}')
            activity, mood = state.split('-')
            seconds = {'listening': 6, 'speaking': 1}[activity]
            sha = clip['sha256']
            path = Path(clip['sourceWebm'])
            receipt = read(Path(clip['visualReceipt']))
            if (mood not in MOODS or state in actors[slug]['clips'] or sha in used or clip['duration'] != seconds
                    or path.stat().st_size != clip['bytes'] or receipt['sha256'] != sha or receipt['state'] != state
                    or sum(receipt['scores'].values()) != clip['operatorScore']):
                raise ValueError(f'Conflicting clip receipt: {slug} {state}')
            actors[slug]['clips'][state] = {**video(path, root, sha, seconds), 'batch': number, 'score': clip['operatorScore']}
            used.add(sha)
    revisions = []
    art_catalog = read(Path(__file__).resolve().parents[1]/'artwork/genesis-chat.json')
    identities = {(p['packId'], p.get('profileId')): p for p in art_catalog['items'] if p['kind'] == 'character'}
    for manifest in sorted((public/'content/images/living-portraits').rglob('manifest.json')):
        item = read(manifest)
        identity = item['identity']
        profile = identities[(identity['packId'], identity['profileId'])]
        clips = []
        for entry in item['clips']:
            media = entry['video']
            if digest(public/media['url'].lstrip('/')) != media['sha256']:
                raise ValueError(f'Existing clip differs from its revision: {manifest}')
            clips.append({'state': entry['state']['key'], 'url': APP + quote(media['url']),
                          'duration': media['durationMs']/1000, 'sha256': media['sha256']})
        revisions.append({**identity, 'name': profile['name'], 'nameEn': profile['nameEn'],
                          'poster': APP + quote(item['poster']['url']), 'clips': clips})
    return {'batches': receipts, 'characters': list(actors.values()), 'revisions': revisions}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ('records', 'app', 'resources'):
        parser.add_argument('--'+key, type=Path, required=True)
    parser.add_argument('batches', nargs='+', type=Path)
    args = parser.parse_args()
    catalog = build(args.records, args.app, args.resources, args.batches)
    out = Path(__file__).resolve().parents[1]/'artwork/genesis-chat-packs.json'
    if out.exists():
        old = read(out)
        if catalog['batches'][:len(old['batches'])] != old['batches']:
            raise ValueError('Previously accepted batch receipts changed')
    out.write_text(json.dumps(catalog, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
