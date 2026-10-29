# Character 원화 저장·게시

2026-10-28 사용자 변경: 원화 이미지는 복사해서 사이트에 보관한다. 이 예외는 Character Art Archive에만 적용한다. 운영 원본 서비스는 시작하거나 변경하지 않는다. 3D·모션·기타 구매 에셋은 기존 원본 연결 방식을 유지한다.

## 제작자가 저장할 폴더

Windows: `H:/Dropbox/10_Projects_Active/02.FinalResources/Library/Art/CharacterArtArchive/artwork`

Dropbox 상대 경로: `10_Projects_Active/02.FinalResources/Library/Art/CharacterArtArchive/artwork`

`<그룹>/<캐릭터ID>/<파일명>.png` 구조로 저장한다. 예: `Village/Elara/CA_Elara_Front_v005.png`. JPG·JPEG·WebP도 지원한다. 그룹은 Village, SteampunkTown, BanditCamp, Arcturus, DynamicRobot, BanditVillage, BanditWeapons이며 새 그룹도 폴더 이름으로 추가된다. 비교·후보 원화는 새 버전 파일로 넣고 기존 선정 파일을 덮어쓰지 않는다.

기존 보관함 150개 이미지와 69개 선정 항목·비교 6건을 복사하고 해시를 확인했다. 원본 UI DesignGuide 보관함은 보존했다. `catalog.json`은 기존 평가·선정·3D 연결 기준이며 새 파일을 넣을 때 수정할 필요가 없다. 같은 그룹/캐릭터 폴더의 새 이미지는 다음 게시 시 ‘미검토 원화’로 편입된다. 기존 대표 이미지·사용자 평가·3D 제작 승인을 자동 변경하지 않는다. `preview/`는 기존 작은 이미지 보관용이고 신규 이미지는 `artwork/`에만 넣는다.

## 게시 작업

사이트 저장소의 깨끗한 작업 브랜치에서 실행한다. Python 3.11+와 Pillow가 필요하다. 의존성: `py -3 -m pip install -r tools/requirements-character-art.txt`.

```powershell
py -3 tools/publish_character_art.py --source "H:/Dropbox/10_Projects_Active/02.FinalResources/Library/Art/CharacterArtArchive"
py -3 -m unittest discover -s tools -p test_publish_character_art.py
npm test
git diff --check
```

도구는 `artwork/catalog.json`, 해시로 이름을 정한 `artwork/media/` 복사본, `index.html`의 원화 게시 버전만 갱신한다. 원본 파일은 수정·삭제하지 않는다. 참조된 파일을 모두 검증하고 저장 중인 파일·원본 해시 변경·대상 충돌은 게시를 중단한다. 변경 없는 재실행은 같은 결과다. Git push, 서비스 실행, 이미지 생성, 자동 승인·삭제는 수행하지 않는다.

검사 후 일반 PR·main 병합·Pages 배포를 마쳐야 사이트에 나타난다. 브라우저 Refresh는 마지막 게시본을 읽으며 Dropbox의 새 파일을 업로드하지 않는다. 저장 후 게시 요청을 해야 한다. 원화 정적 경로와 버전은 사이트 배포 설정에 있어 기존 원본 서비스의 목록 게시가 실행되어도 원화 이미지가 원본 서비스 의존으로 돌아가지 않는다. 3D 상세의 원화 연결도 같은 정적 목록을 사용한다.
