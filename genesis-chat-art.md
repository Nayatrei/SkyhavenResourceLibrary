# GenesisChat 원화 관리

Skyhaven의 `GenesisChat 원화` 탭에서 캐릭터와 표지·배경을 각각 조회합니다.
등록 기준은 GenesisChat의 `public/content/content.json` 및 이 목록이 참조하는
V2 pack JSON입니다. 캐릭터는 `(packId, profileId)` 복합키로 구분합니다.
원화가 연결되지 않은 인물은 누락 수에 포함하고 다른 이미지로 대체하지 않습니다.

원본 소스는 `K:/Javascript/GenesisChat/public/content`에 그대로 둡니다.
`prepare`, 개인 업로드, 후보·QA·메뉴용 파생 이미지는 자동 등록하지 않습니다.
페이지에는 앱에 연결된 이미지의 실제 크기, 상대 경로와 SHA를 표시합니다.
이는 고해상도 제작 원본이나 사용자 최종 채택을 추가로 판정하는 절차가 아닙니다.

게시 명령:

```powershell
python tools/publish_genesis_chat_art.py --source K:/Javascript/GenesisChat --date 2026-11-06 --verify-live
python -m unittest discover -s tools -p test_publish_genesis_chat_art.py
npm test
git diff --check
```

도구는 현재 공개 팩의 이미지 참조와 로컬 소스를 대조하고
`artwork/genesis-chat.json` 및 배포 설정의 버전만 갱신합니다.
공개 URL `https://genesischat.online/content/images/`를 참조하며 이미지 파일은
복사하지 않습니다. 원본 이미지 서비스가 꺼지면 이미지 연결은 영향을 받습니다.
검사 후 일반 PR·main 병합·Pages 배포를 진행합니다.

인물 원화 화면의 **표정**, **장면 레이어**, **영상 Pack**에서 캐릭터를 선택할 수 있습니다. 영상 Pack에는 제작팀에서 인계한 상태별 검수 후보와 제작 점수를 표시합니다. **기존 영상**은 GenesisChat 공개 리비전의 목록입니다.

다음 묶음을 추가할 때는 `tools/publish_genesis_chat_packs.py --records <제작기록> --app <GenesisChat> --resources <FinalResources> <batch-01.json> ... <최신 명세>`를 실행합니다. Python, ffprobe, ffmpeg가 필요합니다. 각 10편의 상태·길이·시각 검수 기록·원본 해시를 대조하고, 원본과 실제 프레임 썸네일은 FinalResources의 `Library/Art/GenesisChat/PortraitReview`에서 SHA별로 한 번 보관합니다. 사이트에는 공개 주소와 색인만 올립니다. 이전 묶음의 해시가 바뀌면 새 리비전을 확인합니다.

제갈량의 원경·중경·근경은 GenesisChat 검수 샘플 `zhuge-ten-state-v1`에 연결된 세 파일입니다. 중경 포스터는 해당 WebM의 0.25초 프레임입니다. 다른 인물의 미확인 레이어와 미인계 영상 슬롯은 비워 둡니다.
