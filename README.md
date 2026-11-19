# Skyhaven Resource Library

원본 연결형 라이브러리이며 Character 원화는 사이트에 함께 보관합니다.

- Character Art Archive 이미지는 `artwork/`에 복사해 원본 서비스 없이 표시합니다. 저장 폴더와 게시 방법은 [원화 운영 안내](character-art.md)를 따릅니다.
- 다른 이미지·모델·모션은 기존 원본 연결 방식을 유지합니다.
- data/는 자동 생성된 JSON 목록 전용입니다. 개인 경로와 자격 증명을 넣지 않습니다.
- 원본 서버 OFFLINE에서도 원화는 열립니다. 다른 원본 미디어는 ONLINE일 때 읽습니다.
- 자료 변경은 원본 서비스가 목록만 갱신합니다. 앱 코드를 매번 수정하지 않습니다.
- tools/export_skyhaven_site.py와 examples는 과거 로컬 연결 모드 참고 자료입니다. 현재 운영 경로가 아닙니다.

저장 규칙과 운영 방법: [매뉴얼](manual.md).

`#owned`의 **보유 에셋**은 에셋명·스타일·포함 모델/소품/기능을 표시하는
검색 가능한 이미지 카드 갤러리입니다. 이미지를 선택하면 큰 제품 이미지와 상세 패널에서 구성·공식 Download·로컬 팩 연결을 확인합니다. 검색/스크롤은 유지되며 닫기 또는 Esc로 목록에 돌아갑니다. ownedAsset URL로 선택한 제품을 복원합니다. 원본 서비스의 허용 필드만 `data/owned-assets.json`으로
전달하며, 계정 캡처·취득일·개인 경로·파일 자체는 포함하지 않습니다.
설명 확인, 로컬 색인 확인, 제품명 추정, 미확인 상태를 구분합니다.

목록 UI 검사: Node 20+에서 `node --test assets/skyhaven-owned-assets.test.mjs`.
DOM 검사는 설치된 jsdom 경로를 `JSDOM_PATH`로 지정하면 함께 실행됩니다.

상단 **캐릭터** 메뉴에서 3D 캐릭터, 애니메이션, 크리처, 원화와 GenesisChat 캐릭터 원화를 엽니다. **배경** 메뉴에는 배경·프랍과 GenesisChat 표지·배경이 있습니다. 넓은 화면에서는 선택한 자료를 목록 옆에서 미리 보고, 좁은 화면에서는 목록과 미리보기를 오갑니다. 전체 UI 검사는 Node 22에서 `npm ci` 후 `npm test`로 실행합니다.

- **All**은 전체 등록 자료이며 GenesisChat 참조도 이 범위에서 열립니다.
- **Skyhaven**은 Celestial Cycle 및 기존 Skyhaven·Companion·Legends 자료를 묶습니다.
- **Purchased**는 외부 팩과 외부 모션을 찾는 범위입니다. Unity·Fab 보유 및 설치 기록은 관리 메뉴의 **보유 에셋**에서 확인합니다.
- **Remake**에는 Arcturus 에셋과 연관 원화·배경이 포함됩니다.

범위는 `?scope=skyhaven`, `?scope=purchased`, `?scope=remake`로 공유합니다. 기존 `?game=skyhaven|companion|legends` 링크는 Skyhaven, `?game=shared`는 Purchased에서 열립니다. 원본 링크와 카탈로그의 기존 출처 필드는 유지합니다.

Unity My Assets와 확인된 Fab 제품을 출처별로 합쳐 표시합니다. 같은 이름을 자동 병합하지 않으며 Fab 제품은 UUID 기반 공식 제품 페이지로 연결합니다. Fab 목록은 확인된 계정 소유 스냅샷이며 로컬 파일 확인 상태는 별도로 표시합니다.

보유 에셋 카드는 공식 Unity/Fab CDN의 제품 썸네일을 직접 참조합니다. 이미지 파일을 복사하지 않으며 화면 근처 항목만 지연 로드합니다. 스타일 pill의 개수는 현재 검색·분류·숨김 조건을 반영하고 스타일 선택 자체와는 독립적입니다.

보유 에셋의 분야 선택에서 배경, 캐릭터, VFX, 도구를 필터링합니다. 배경은 프롭, 캐릭터는 모션을 포함하며 복합 팩은 여러 분야에 나타날 수 있습니다. 음향·UI와 판단 근거가 없는 항목은 전체 보기에서 유지됩니다. 분야 변경은 스타일·스토어 분류를 초기화하고 검색어는 보존합니다. ownedType URL 매개변수로 선택을 복원합니다.

RPG_Lab pill은 확인 날짜가 있는 프로젝트 파일 인벤토리로 필터링합니다. 제품 ID, 고유 폴더명, 패키지 manifest, 문서 대조 근거를 항목별로 표시하며 전체 패키지 반입이나 실행 호환성을 의미하지 않습니다. 미확인은 미설치와 다릅니다. 분야·스타일·검색과 조합되며 ownedProject=rpg-lab 링크로 복원합니다. 공개 데이터에는 프로젝트 상대 경로만 포함합니다. 인벤토리는 Nourish의 scripts/scan_owned_asset_installations.py로 다시 스캔한 뒤 기존 목록 게시 경로로 갱신합니다.
