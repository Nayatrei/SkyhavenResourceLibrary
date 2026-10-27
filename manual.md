# 리소스 저장·폴더 관리 매뉴얼

## 가장 먼저 알아둘 것

원본은 FinalResources와 등록된 Unity 프로젝트에만 있습니다. 웹사이트는 목록·분류·상대 경로만 보관하며 이미지·모델·모션을 복사하지 않습니다.

- 원본 서버 ONLINE: 원본 이미지와 3D·모션을 읽습니다.
- OFFLINE 또는 확인 불가: 마지막으로 게시된 목록·검색·경로만 제공합니다.
- 다른 기기에서도 폴더 선택 없이 목록을 볼 수 있습니다. PC를 껐을 때 이미지를 보장하는 서비스가 아닙니다.
- 사진·썸네일 별도 저장, 일괄 생성, R2 업로드는 하지 않습니다. 원래 존재하던 Preview·원화·썸네일은 삭제하거나 복사하지 않고 참조합니다.
- 앱의 금속 패널·버튼, 카테고리 아이콘, LIBRARY MAP은 공개 UI 소재이며 앱과 함께 제공됩니다. 지도는 팩 선택용 장식 지도이고 실제 게임 맵·원본 에셋이 아닙니다. 에셋 미리보기와 로스터 이미지는 기존 원본을 참조합니다.

화면 상단 Library menu(사람 아이콘)에서 Owned assets, 전체 파일, Agent/MCP 참조, Storage manual, 설정과 색인 새로고침을 엽니다. 게임은 상단 필터로, 팩·캐릭터 그룹은 왼쪽 목록으로 고릅니다. 배경 화면은 큰 원본 미리보기, 오른쪽 상세·경로 복사, 하단 가로 목록으로 구성됩니다.

## 어디에 저장하나요?

| 자료 | 위치 | 예시 |
| --- | --- | --- |
| 정체가 아직 정해지지 않은 자료 | Inbox | Inbox/새로받은자료 |
| 캐릭터 묶음 | Library/Characters/<AssetID> | Library/Characters/Elara |
| 공용 모션 원본 | Library/Animations/Shared | 기존 팩 내부 이름·meta·클립 보존 |
| 새 제작 모션 | Library/Animations/<AssetID> | Library/Animations/HeroWalk |
| 배경·소품·재질 | Library/Environments·Props·Materials/<AssetID> | Library/Environments/Map02-Homestead |
| 원화·UI·음성·이펙트 | Library/Art·UI·Audio·VFX/<AssetID> | 해당 자료와 소유 에셋을 명시 |
| 구매·외부 패키지 원본 | Library/Packages/<Package> | 내부 폴더·GUID·이름 유지 |
| 프로젝트 구성 | Projects/<Project> | Projects/Skyhaven/GameSets |
| 제작 중·후보·실험 | Work/<Project>/<Task> | Work/Skyhaven/Hero-v002 |
| 관리 도구 | Tools | 현재 사용하는 도구만 |
| 자동 생성되는 목록·기록 | .workspace | 직접 에셋을 저장하지 않음 |

에셋 폴더 안에서는 Models, Textures, Blender, References, Candidates, Review처럼 역할을 구분하세요. 기존 묶음은 이 구조에 억지로 맞추지 않습니다. FBX와 텍스처의 상대 위치, Blender의 연결 파일, manifest를 같이 보존합니다. 원화가 특정 캐릭터에 속한다면 공용 Art에 또 복사하지 말고 그 캐릭터의 References를 사용합니다.

## 새 자료를 추가하는 가장 짧은 순서

1. 소속이 불분명하면 Inbox, 제작 중이면 Work, 보관할 에셋이면 Library의 해당 종류에 저장합니다.
2. 같은 에셋은 기존 AssetID 폴더를 사용합니다. 다른 캐릭터와 이름이 같아도 임의로 합치지 않습니다.
3. 대표 모델·에셋 ID·분류·상태·공개 범위를 manifest에 한 번 등록합니다. 기존 manifest의 파일 해시와 제작 기록은 유지합니다.
4. 모델·텍스처·원화 등 관련 파일을 에셋 묶음 안에서 관리합니다. 같은 이미지를 사이트용으로 따로 만들지 않습니다.
5. 원본 서비스가 시작되거나 실행 중 15분 간격으로 목록 변경을 확인합니다. 내용이 바뀌었을 때만 목록을 게시합니다. 웹의 새로고침은 마지막 게시 목록을 다시 읽습니다.

새 자료는 아래 도구로 기존 manifest를 덮어쓰지 않고 등록할 수 있습니다. `path`는 경로만 출력하고 파일을 만들지 않습니다. 모델은 출력된 폴더에 직접 저장한 뒤 `register`로 대표 파일을 명시하세요.

```powershell
python scripts/resource_library.py path Characters MyHero
python scripts/resource_library.py register Characters MyHero --model Models/MyHero.glb --game skyhaven --group MyCharacters
```

등록 기본값은 검토 후보이며 공개 3D 미리보기는 꺼져 있습니다. 본인에게 공개 권한이 있는 자료만 등록 시 `--public-preview`를 명시하거나 manifest의 publication.livePreview를 변경하세요. 이 선택은 품질 승인이 아닙니다.

새 경로를 코드에서 얻을 때는 드라이브 문자열을 여러 곳에 하드코딩하지 않습니다.

```python
from services.skyhaven_resources import SkyhavenResources
layout = SkyhavenResources().layout
folder = layout.asset_directory('Characters', 'MyHero')
```

Windows의 실제 루트는 config/skyhaven-resources.json의 workspace 한 곳에서 정합니다. Mac도 자신의 Dropbox 루트 아래 같은 상대 구조를 사용합니다. HTTP 링크와 manifest의 이식 가능한 참조에는 Windows 드라이브 문자나 Mac 홈 경로를 쓰지 않습니다.

## 자동으로 하는 일 / 사람이 결정할 일

자동: 신규·변경 파일 검사, 크기·해시 비교, 의존성 누락 보고, 변경된 목록 게시. 파일 저장 중·원본 접근 불가·게시 오류가 있으면 마지막 정상 게시본을 유지합니다. 브라우저에서 모델을 열어도 썸네일 파일을 새로 저장하지 않습니다.

수동: 소속 에셋, 대표 버전, 공개 가능 여부, 후보에서 채택으로의 변경. Final 또는 Library라는 이름만으로 품질 승인·리깅 검증·Unity 실행 확인을 주장하지 않습니다. 공개 여부를 모르는 구매 모델·모션은 공개 납품물로 올리지 않습니다.

기존 일일 organizer는 이름을 추측해서 이동시키는 대신 문제 목록을 확인하는 용도입니다. 분류가 불분명한 파일은 임의로 이름을 바꾸거나 삭제하지 않습니다.

## 기존 파일과 보호 위치

- 이관 규칙의 기준은 config/resource-library-layout.json입니다. 과거 URL·참조는 이 대응표로 새 실제 경로를 읽습니다. 실제 폴더 바로가기나 호환용 복사본은 만들지 않습니다.
- Reference/Codex, _Claude·_Codex 교신 기록, uploads/brand 등 기존 고정 연동 위치는 유지합니다.
- 외부 Unity 프로젝트, .meta GUID, 구매 패키지 내부, 실행 설정이 연결된 UniMate 폴더는 임의로 이동하지 않습니다.
- 01.USD·02.Character·03. Blender 등의 혼합 자료와 개발 저장소는 소유권·외부 참조 확인 후에만 이관합니다. 보류 목록은 이동 보고서에 남습니다.
- 과거 실행 로그의 경로는 당시 출처입니다. 현재 경로로 무차별 치환하지 않습니다.

## 문제 해결과 복구

- 목록은 보이는데 이미지가 없음: 헤더의 원본 서버 상태를 확인합니다. OFFLINE이면 정상적인 제한입니다. ONLINE이면 원본 파일과 의존성 경로를 확인합니다.
- 새 자료가 안 보임: 원본 서비스 가동, manifest, 파일 저장·Dropbox 동기화 완료, 게시 오류 여부를 확인합니다. 브라우저 새로고침만으로 로컬 폴더가 클라우드에 올라가는 것은 아닙니다.
- 대표 파일이 여러 개임: 최근 수정 파일을 자동 선택하지 않습니다. manifest에서 대표 파일을 정합니다.
- 게시 실패: 이전 정상 목록은 유지됩니다. 원본 파일을 이동하거나 지우면서 해결하지 않습니다.
- 이관 복구: 기록된 이동 보고서에 대해서만 migrate_resource_library.py --rollback을 사용합니다. 현재 바이트 해시가 달라졌거나 원위치에 파일이 있으면 멈춥니다. 덮어쓰기·재귀 삭제를 하지 않습니다.

목록 게시와 실제 렌더 확인, 웹 모션 재생과 Unity 검증은 서로 다른 상태입니다.

## 소유 에셋 · Download와 원본 서비스 시작

왼쪽 PACKS 아래 소유 에셋 · Download는 모든 보유 Unity/Fab 제품을 큰 이미지 카드로 보여줍니다. 카드를 누르면 큰 제품 이미지와 상세 패널에서 구성·근거·다운로드·연결된 로컬 팩을 확인합니다. 닫기 또는 Esc는 검색·필터·스크롤과 키보드 포커스를 유지한 목록으로 돌아갑니다. 스타일·분류·프로젝트 필터는 상세 필터에서 열며, ownedAsset URL로 선택한 제품을 다시 열 수 있습니다. 제품 이미지는 공식 CDN 주소를 직접 읽으며 별도로 생성·복사하지 않습니다. 파일 상태에서 로컬 파일 확인과 다운로드·설치 미확인을 나눕니다. 표시가 없는 항목은 미설치 확정이 아닙니다. Download는 본인의 공식 제품 페이지를 열며 구매나 자동 다운로드를 실행하지 않습니다. Dekogon은 ResourceCatalog/organized.json의 제품 ID와 실제 파일로 팩에 연결합니다. Pack과 Prop, 공급자 원본과 URP 변형을 구분합니다.

SOURCE UNREACHABLE은 웹에서 원본 서비스 응답을 읽지 못했다는 뜻입니다. PC 전원과 서비스 실행은 별개입니다. 원본 서비스 정지, 외부 연결 실패나 브라우저 차단을 확인합니다. 헤더의 SOURCE를 누르면 오류 이유·재확인과 원본 서비스 켜기가 있습니다.

SOURCE 메뉴의 연결 다시 확인을 누르면 확인 중 표시와 마지막 연결 확인 시각을 볼 수 있습니다. 이 시각은 목록 게시 시각과 별개입니다. 다른 탭에서 돌아오면 연결을 다시 확인하며, 실제 응답이 ONLINE일 때 원본 미리보기가 복구됩니다. Escape로 메뉴를 닫을 수 있습니다.

Windows에서 한 번 아래 명령으로 이 사용자 전용 런처를 등록하세요. 실행 위치는 본인의 Nourish 저장소입니다.

```powershell
.\scripts\Install-SkyhavenSourceLauncher.ps1
```

그 뒤 웹의 원본 서비스 켜기 · 이 PC를 누르고 Windows 런처 열기를 허용합니다. skyhaven-source://start만 받는 고정 런처이며 경로나 명령을 전달하지 않습니다. 기존 CPU control plane 8187만 127.0.0.1에서 시작하고 GPU workers·watchdog·CC 프로젝트 작업은 시작하지 않습니다. 이미 실행 중이면 재사용하고 다른 프로세스의 포트를 빼앗지 않습니다. 웹은 실제 health 응답을 확인한 뒤에만 ONLINE으로 바뀝니다. 다른 컴퓨터에는 그 컴퓨터의 Nourish 경로로 별도 등록해야 하며 웹페이지가 원격 PC를 켜는 기능은 아닙니다.

제품 이미지 주소 갱신: `py -3 scripts/refresh_owned_asset_images.py`. 기존 결과는 `.workspace/asset-library/store-product-images.json`에서 재사용하며 `--refresh`를 명시할 때 다시 확인합니다. 공식 제품 페이지의 큰 표지 주소를 우선하며 작은 아이콘은 보조로 유지합니다. HTML·이미지 파일은 저장하지 않습니다. 새 주소는 기존 JSON 목록 게시 경로로 전달되므로 웹 방문마다 제품 페이지를 다시 읽지 않습니다.
