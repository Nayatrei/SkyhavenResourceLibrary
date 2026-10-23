# Skyhaven — 웹 화면·로컬 파일·MCP 사용 매뉴얼

이 문서는 사이트의 ‘MCP · 폴더 연결 매뉴얼’ 메뉴에서도 읽습니다.
2026-10-23. 구현, 빌드 검사, 실제 브라우저 권한/시각 검사, 외부 배포는 별도 상태입니다.

## 1. 무엇이 어디에 있는가

기존 Comfy 모드:
- Nourish가 로컬 폴더를 색인하고 `/comfy/skyhaven/api/library`로 JSON을 제공합니다.
- `/comfy/skyhaven/files/...`와 `api/library/source/...`가 원본을 읽습니다.
- 이 모드는 Nourish 호스트가 실행 중이어야 합니다. 기존 API를 정적 GitHub Pages API라고 부르지 않습니다.

새 정적·로컬 연결 모드:
- 웹 호스트에는 재사용할 HTML/JavaScript/CSS, Three.js와 이 공통 매뉴얼만 게시합니다. 개인 에셋 색인·썸네일도 웹 저장소에 올리지 않습니다.
- 개인 색인 폴더에는 library.json, catalog.json, motions.json, resources.json, 상세 JSON과 previews가 있습니다. 첫 방문에 이 폴더를 연결합니다.
- FBX/GLB/텍스처/원본 패키지는 사용자 폴더에 그대로 둡니다. 사이트에서 원본을 업로드하지 않습니다.
- File System Access의 읽기 전용 디렉터리 핸들을 브라우저의 IndexedDB에 저장합니다.
- 사이트 범위의 Service Worker가 `__local/<루트 ID>/<상대 경로>` GET/HEAD를 로컬 파일로 응답합니다. 파일 스트림과 영상용 byte range를 지원하며 쓰기 요청을 거절합니다.
- localhost 서버, Comfy 실행, 공유 드라이브 공개, R2 저장소가 필요하지 않습니다.

주소 문자열을 안다고 디스크 읽기 권한이 생기지는 않습니다. 각 컴퓨터/브라우저에서 사용자가 폴더를 직접 선택해야 합니다. 사이트와 MCP 클라이언트의 권한은 서로 전달되지 않습니다.

## 2. 현재 Skyhaven 루트 연결

연결한 색인의 library.json → roots에 실제 연결 구조가 있습니다. 앱의 이 매뉴얼 위 ‘현재 색인의 연결 구조’에도 같은 내용을 표시합니다. 공통 앱에 다른 사용자의 실제 폴더 경로를 박아 넣지 않습니다.

현재 Skyhaven 분류기의 논리 루트 예:
workspace          FinalResources 폴더
rpg                대표 캐릭터가 있는 Unity 프로젝트
polygon            POLYGON/DETAILED가 있는 Unity 프로젝트
bank               원본 모션 Unity 프로젝트

workspace 아래에는 Skyhaven, Legends, 04. Animations와 생성 캐시 .workspace가 있습니다. rpg는 GameSet 대표 모델과 텍스처, polygon은 POLYGON/DETAILED, bank는 공용 폴더에 아직 없는 모션을 읽습니다. 별도 animation/motions 루트가 실제 설정된 경우 게시물의 폴더 연결 화면에 추가로 표시합니다.

Mac에서는 같은 ID에 Mac의 실제 Dropbox/Unity 폴더를 연결합니다. Windows 드라이브 경로를 만들거나 원본을 이동할 필요가 없습니다. 다른 위치의 프로젝트라면 해당 폴더를 같은 논리 ID에 연결하면 됩니다.

## 3. 처음 사용하는 순서

1. HTTPS 사이트를 데스크톱 Chrome/Edge로 엽니다.
2. 첫 화면에서 library.json이 있는 개인 색인 폴더를 선택합니다. 이후 상단 ‘폴더 연결’에서 필요한 원본 루트도 선택하고 읽기 권한을 허용합니다.
3. 연결됨을 확인한 뒤 캐릭터/팩을 고릅니다. 파일은 그 컴퓨터에서 직접 읽습니다.
4. 캐릭터 애니메이션 탭에서 모션을 선택합니다. 모델과 모션이 각각 다른 루트에 있으면 양쪽 모두 연결해야 합니다.
5. 참조 복사의 프로젝트 상대 경로·GUID를 사용합니다. `__local` 웹 URL은 폴더가 연결된 그 브라우저 전용이며 다른 컴퓨터용 다운로드 URL이 아닙니다.

재방문 시 저장된 핸들의 권한을 확인합니다. 브라우저가 권한을 만료시키거나 데이터를 지운 경우 ‘폴더 연결’을 다시 누릅니다. 폴더를 다른 위치로 바꿨다면 연결 해제 후 새 위치를 선택합니다. 색인 연결 해제는 시작 화면으로 돌아갑니다. 연결 해제는 브라우저의 연결 기록만 지우고 파일을 삭제하지 않습니다. 원본 루트 권한은 라이브러리 ID별로 구분해 다른 사람의 색인과 섞이지 않게 합니다.

Safari/Firefox/내장 WebView에서는 지원 차이가 있습니다. 지원하지 않는 환경에서 개인 색인·로컬 3D 접근을 약속하지 않습니다. 공통 매뉴얼은 읽을 수 있습니다. Dropbox ‘온라인 전용’ 파일은 운영체제가 다운로드해야 읽을 수 있으므로 필요한 폴더를 오프라인 사용 가능 상태로 두는 것이 좋습니다.

파일이 없는 방문자에게 다른 사용자의 로컬 디스크나 개인 목록이 공유되지는 않습니다. 각자 자기 색인과 원본 폴더를 연결합니다. 같은 Dropbox 자료를 공유한 팀은 같은 색인을 사용하고 각 컴퓨터의 원본 루트를 연결할 수 있습니다.

연결 중에는 선택한 폴더 이름과 권한·색인 검사·저장·실제 읽기 단계를 표시합니다. 폴더 선택 창을 기다리는 시간에는 자동 제한을 두지 않으며, 나머지 단계가 15초 동안 응답하지 않으면 재시도를 안내합니다. ‘중단’ 후 이전 응답은 현재 연결을 바꾸지 않습니다. 선택 취소와 브라우저 접근 거절은 같은 AbortError일 수 있어 임의로 사용자 취소라고 단정하지 않습니다. ‘연결 진단’에는 단계·오류 종류·연결 버전만 표시하며 외부로 전송하지 않습니다.

## 4. 현재 분류·대표 모델 규칙

카테고리는 캐릭터/애니메이션/배경·프랍/비인간형이고 게임은 필터입니다. 원화·초상화·대사·구형 모델은 같은 정체성의 상세 자료입니다.

GameSet manifest와 명시된 modelNames가 대표 Humanoid를 정합니다. 수정일·짧은 이름·최신 파일만으로 자동 교체하지 않습니다. 직접 제작 34개 형태는 33개 정체성으로 묶으며 DynamicRobot은 형태를 선택합니다. SD 데모는 Human Basic Motions를 우선합니다.

POLYGON/DETAILED의 팩·프리팹·GUID와 생성 썸네일을 연결합니다. 배경의 실시간 3D 변환은 하지 않습니다. 소스 용량/LOD/텍스처 해상도와 Unity 실행 비용을 구분합니다.

설정의 실제 기준은 `config/skyhaven-library.json`, `config/skyhaven-environment-packs.json`, GameSet manifest입니다. 원본 .meta/GUID/내부 리그·클립 이름·구매 팩 구조를 보존합니다. Humanoid 설정, 호환 후보, 웹 재생 기록, Unity 실행 검증을 서로 대체하지 않습니다.

## 5. MCP/다른 에이전트에서 사용

이 웹 기능 자체는 MCP 서버를 설치하지 않습니다. `get_skyhaven_asset` 같은 전용 MCP 도구가 이미 존재한다고 가정하지 마세요. 기존 MCP 클라이언트의 웹 읽기와 승인된 로컬 파일 도구로 아래 절차를 사용합니다. 일반 도구의 실제 이름과 허용 루트는 클라이언트 설정에서 확인하세요.

1. 사용자가 지정한 로컬 색인 폴더의 `library.json`과 `catalog.json`을 읽어 그룹/에셋 ID를 찾습니다. GitHub의 공통 앱 주소에는 개인 catalog.json이 없습니다.
2. 같은 색인 폴더 기준 에셋 또는 팩의 `detailUrl` JSON을 읽습니다. 모션은 `motions.json`, 전체 파일은 `resources.json`입니다. 동적 Comfy 모드에서는 기존 library API를 사용합니다.
3. 파일 descriptor의 `localRef.root`와 `localRef.path`를 읽습니다.
4. MCP가 실행되는 컴퓨터의 루트 대응표에서 root를 찾고, 그 루트 내부로만 path를 결합합니다.
5. 존재/크기/해시/GUID와 실제 골격을 검사합니다. 다른 플랫폼의 절대 경로나 브라우저 전용 URL을 파일 경로로 쓰지 않습니다.
6. 먼저 읽기 전용으로 검토합니다. 색인 생성은 출력 폴더에만 기록하며 원본 이동·리깅·변환·삭제를 자동으로 수행하지 않습니다.

브라우저용 descriptor 예:

```json
{
  "path": "Assets/Characters/Elara/Models/Elara.fbx",
  "projectRelativePath": "Assets/Characters/Elara/Models/Elara.fbx",
  "localRef": {"root": "rpg", "path": "Assets/Characters/Elara/Models/Elara.fbx"},
  "url": "__local/LIBRARY_ID_rpg/Assets/Characters/Elara/Models/Elara.fbx",
  "extension": "fbx",
  "sourceHash": null,
  "guid": null
}
```

실제 데이터에는 계산한 SHA-256 또는 미확인 null을 기록하고 검증 완료로 꾸미지 않습니다. 브라우저용 URL의 LIBRARY_ID는 생성된 네임스페이스입니다. MCP는 이 URL을 파싱하지 말고 localRef를 사용합니다.

에이전트에게 전달할 작업 지침:

```text
이 사이트의 공통 MCP 매뉴얼과 내가 지정한 로컬 색인의 library.json/catalog.json을 읽어라.
내가 허용한 폴더만 조사하고 roots.json에 논리 루트와 내 컴퓨터의 실제 경로를 연결하라.
GameSet/manifest/Unity GUID를 우선하며 대표 모델이 불분명하면 질문하고 임의로 고르지 마라.
동일 인물의 버전·원화는 한 에셋의 related로 묶고 변형은 variants로 연결하라.
모션의 rig/클립/검증 기록을 구분하고 브라우저 재생을 Unity 검증이라고 부르지 마라.
원본은 읽기만 하고 portable snapshot과 썸네일을 별도 출력에 생성하라.
기존 스냅샷과 비교한 새 누락·충돌을 보고하고 과거 검토 항목을 매번 새 문제로 반복하지 마라.
```

## 6. 다른 사용자의 폴더로 만드는 방법

웹 연결 계층은 특정 드라이브에 묶여 있지 않습니다. 다른 사용자는 자기 루트와 같은 스키마의 portable snapshot을 준비합니다. 현재 GameSet/Synty 분류기를 모든 임의 폴더에 보편적인 자동 분류기라고 주장하지 않습니다. 자기 폴더가 다르면 MCP가 읽기 조사 후 manifest/색인을 명시적으로 작성합니다.

roots.json 예:
```json
{"game": "D:/MyResources"}
```

snapshot.json 최상위 필드:
```json
{
  "overview": {"schemaVersion": 1, "entities": [], "packs": [], "motionCount": 0, "counts": {"forms": 0, "identities": 0, "polygon": 0}, "issues": [], "taxonomy": {}},
  "assets": {},
  "packs": {},
  "motions": [],
  "resources": {"folders": [{"id": "all", "name": "내 리소스", "files": []}]}
}
```

entities의 id는 assets의 키, 팩 id는 packs의 키와 일치해야 합니다. 파일마다 localRef를 넣습니다. 프로젝트 상대 path, name, extension, size, game을 기록하고 대표 variant에는 model/textures/thumbnail/rig/compatibility를 명시합니다. 기존 catalog.json과 상세 JSON이 완전한 실제 사례입니다. 준비된 썸네일은 previews/ 상대 URL로 연결합니다. 모션/리그를 모르면 unknown으로 두며 빈 목록도 허용합니다.

```powershell
py -3 scripts/export_skyhaven_site.py --catalog snapshot.json --roots roots.json --vendor path/to/three --previews prepared-images --output NEW_SITE_DIRECTORY
```

독립 GitHub 저장소에는 같은 도구가 `tools/export_skyhaven_site.py`에 있고 Three.js도 동봉되어 있습니다. 그 저장소에서는 `py -3 tools/export_skyhaven_site.py --catalog examples/snapshot.json --roots examples/roots.json --output NEW_SITE_DIRECTORY`로 시작할 수 있습니다. examples의 파일 위치를 자기 파일에 맞추세요.

`--previews`는 이미지 전용 폴더입니다. 모델/텍스처 원본 폴더를 지정하지 않습니다. 산출물은 공통 앱 폴더와 별도 개인 색인 폴더로 나뉩니다. 개인 색인 폴더의 build-report.json, sourceFilesCopied=0, 로컬 참조와 썸네일 존재를 검토합니다. 정적 호스트에는 공통 앱 폴더만 게시합니다. 다른 사용자도 이미 게시된 같은 공통 앱을 사용할 수 있으므로 개인별 웹 호스트를 만들 필요는 없습니다.

## 7. 현재 라이브러리 갱신과 배포

```powershell
py -3 scripts/export_skyhaven_site.py --output NEW_SITE_DIRECTORY --index-output NEW_PRIVATE_INDEX_DIRECTORY --domain skyhaven.genesisframeworks.com
```

명령은 새 폴더에만 빌드하며 기존 산출물을 덮어쓰지 않습니다. index-output을 생략하면 공통 앱 옆에 `이름-index` 폴더를 만듭니다. 원본 변경·서버 시작·Git push·DNS 변경·클라우드 업로드를 하지 않습니다. 공통 앱 폴더만 GitHub Pages에 게시하고 개인 색인 폴더를 포함하지 않습니다. `.nojekyll`을 보존해야 __local 경로와 모듈이 처리됩니다. HTTPS 도메인과 실제 Pages 배포를 따로 확인합니다.

새 폴더/파일은 로컬 색인 생성 → 대표 모델·의존성 검토 → 개인 색인 폴더 교체/재연결 순서입니다. 사이트 ‘새로고침’은 연결한 개인 색인을 다시 읽습니다. 공통 앱은 기능 변경 때만 다시 배포합니다. GitHub Actions가 로컬 K:/H:/ 폴더를 자동으로 읽는 것은 아닙니다. 기존 일일 organizer는 원본 검토를 계속하며 이 변경만으로 새로운 업로드 자동화를 만들지 않습니다.

## 8. 검증과 문제 해결

- 연결 필요: 폴더 선택/읽기 권한을 허용합니다. 브라우저 저장 핸들은 로그인 계정 간 자동 공유되지 않습니다.
- 파일 누락: 루트 폴더를 한 단계 위/아래로 잘못 선택했는지, 파일명이 색인과 같은지, Dropbox가 로컬 파일을 제공하는지 확인합니다.
- 텍스처 누락: 모델과 텍스처의 루트 및 상대 경로, materialBindings, GLTF의 외부 .bin 의존성을 확인합니다.
- 색인에 없음: 원본을 다시 스캔하고 게시물을 갱신합니다. 브라우저 폴더 권한만으로 서버 색인이 자동 갱신되는 것은 아닙니다.
- 예전 색인: 새로고침 실패 시 기존 IndexedDB 색인을 보존합니다. 저장 시각과 게시 시각을 확인합니다.
- 썸네일/검증 생성: 정적 사이트에서는 원본 호스트의 POST 기능을 실행하지 않습니다. 로컬 제작 도구에서 생성 후 다시 게시합니다.

자동 검사 통과, 실제 폴더 선택/재권한, 3D·텍스처·모션의 시각 재생, GitHub Pages 배포, DNS/HTTPS 검증은 별도 기록으로 확인합니다. 메뉴얼이 있다는 이유로 미검증 단계를 완료로 간주하지 않습니다.
