# Skyhaven 전용 브랜딩

기존 금색 성탑 심벌과 금색·슬레이트 UI를 유지하며, 승인된 Genesis 로봇 계열의 Skyhaven 전용 수호자를 사용합니다. 성탑 문장과 구름 위 성을 든 로봇이며 다른 제품의 아이콘을 복제하지 않습니다. 사용자 2026-10-31 사이트별 적용·동일 계열 유지·중앙 원본 보관 지시에 따른 변경입니다.

현재 원본은 `source/genesis-skyhaven-app-icon.png`, 프롬프트는 `source/family-prompt.txt`입니다. 중앙 원본은 `H:/Dropbox/10_Projects_Active/BrandIdentity/assets/app-icons/original/genesis-skyhaven-app-icon.png`에 보관합니다. built-in image_gen으로 제작했고, 크기 파생본은 `tools/build_branding.py`가 Pillow로 생성합니다. 앞선 성탑 단독 시안 `source/mascot-original.png`와 `source/prompt.txt`는 과거 후보로 보존합니다. 파일 SHA와 제작 방법은 `asset-sources.json`에 기록합니다.

현재 아이콘은 어두운 불투명 캔버스입니다. maskable 파생본은 전체 원본을 중앙 56% 정사각형 안에 넣어 원·라운드 마스크에서도 캐릭터와 소품이 잘리지 않도록 합니다.

favicon ICO/16/32, 헤더 64, touch 180, 앱 192/512, maskable 192/512와 manifest를 제공합니다. 헤더는 기존 브랜드 공간·레이아웃을 사용하며 원본 리소스 서비스 연결과 독립적입니다. 신규 서비스워커나 백엔드 변경은 없습니다. 재생성에는 기존 `tools/requirements-character-art.txt`의 Pillow를 사용합니다.
