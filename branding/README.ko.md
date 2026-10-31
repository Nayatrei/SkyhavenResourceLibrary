# Skyhaven 전용 브랜딩

기존 금색 성탑 심벌과 금색·슬레이트 UI를 바탕으로 구름 위 성탑 수호자 마스코트를 만들었습니다. 3DFactory 로봇이나 다른 사이트의 마스코트를 사용하지 않습니다. 사용자 2026-10-31 사이트별 마스코트·앱 아이콘·미니 아이콘 적용 지시에 따른 변경입니다.

보존 원본은 `source/mascot-original.png`, 실제 생성 프롬프트는 `source/prompt.txt`입니다. built-in image_gen으로 제작했고, 크기 파생본은 `tools/build_branding.py`가 Pillow로 생성합니다. 기존 마스코트 원본을 수정하지 않습니다. 파일 SHA와 제작 방법은 `asset-sources.json`에 기록합니다.

favicon ICO/16/32, 헤더 64, touch 180, 앱 192/512, maskable 192/512와 manifest를 제공합니다. 헤더는 기존 브랜드 공간·레이아웃을 사용하며 원본 리소스 서비스 연결과 독립적입니다. 신규 서비스워커나 백엔드 변경은 없습니다. 재생성에는 기존 `tools/requirements-character-art.txt`의 Pillow를 사용합니다.
