"""Resize the preserved Skyhaven mascot master into the requested site icons."""
import hashlib
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'branding'
SOURCE = ROOT / 'source/genesis-skyhaven-app-icon.png'
BACKGROUND = '#0e0e10'


def build():
    master = Image.open(SOURCE).convert('RGBA')
    if master.getchannel('A').getextrema() != (255, 255):
        raise ValueError('The approved family master must be opaque')

    def icon(size, maskable=False):
        canvas = Image.new('RGBA', (size, size), BACKGROUND)
        image = master.copy()
        extent = round(size * (.56 if maskable else 1))
        image.thumbnail((extent, extent), Image.Resampling.LANCZOS)
        canvas.alpha_composite(image, ((size-image.width)//2, (size-image.height)//2))
        return canvas

    for size in (16, 32, 64, 192, 512):
        icon(size).save(ROOT / (f'favicon-{size}x{size}.png' if size < 64 else f'icon-{size}.png'))
    icon(180).save(ROOT / 'apple-touch-icon.png')
    for size in (192, 512):
        icon(size, maskable=True).save(ROOT / f'maskable-icon-{size}.png')
    icon(512).save(ROOT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
    icon(512).save(ROOT / 'mascot.webp', lossless=True)
    manifest = dict(name='Skyhaven Resource Library', short_name='Skyhaven',
                    description='캐릭터·애니메이션·배경을 찾고 미리보는 에셋 라이브러리',
                    id='/', start_url='/#home', scope='/', display='standalone',
                    background_color='#0c1418', theme_color=BACKGROUND,
                    icons=[dict(src=f'/branding/{prefix}icon-{size}.png?v=20261031-family1', sizes=f'{size}x{size}',
                                type='image/png', purpose='maskable' if prefix else 'any')
                           for prefix in ('', 'maskable-') for size in (192, 512)])
    (ROOT / 'site.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    records = {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
               for p in ROOT.rglob('*') if p.is_file() and p.name != 'asset-sources.json'}
    provenance = dict(site='https://skyhaven.genesisframeworks.com/', engine='built-in image_gen',
                      source='source/genesis-skyhaven-app-icon.png', derivation='Pillow size-only derivatives of the opaque approved Genesis family master; whole tile inside maskable safe circle',
                      identity='Genesis robot keeper with the Skyhaven gold castle crest and floating castle/cloud prop',
                      prompt=(ROOT / 'source/family-prompt.txt').read_text(encoding='utf-8'), files=records)
    (ROOT / 'asset-sources.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2)+'\n', encoding='utf-8', newline='\n')
    print(json.dumps({'masterSha256': records['source/genesis-skyhaven-app-icon.png'], 'files': len(records)}))


if __name__ == '__main__':
    build()
