# Skyhaven Resource Library

목록만 호스팅하는 원본 연결형 라이브러리입니다.

- 이미지·모델·모션은 이 저장소에 복사하지 않습니다.
- data/는 자동 생성된 JSON 목록 전용입니다. 개인 경로와 자격 증명을 넣지 않습니다.
- 원본 서버 ONLINE이면 미디어를 읽고, OFFLINE이면 목록만 표시합니다.
- 자료 변경은 원본 서비스가 목록만 갱신합니다. 앱 코드를 매번 수정하지 않습니다.
- tools/export_skyhaven_site.py와 examples는 과거 로컬 연결 모드 참고 자료입니다. 현재 운영 경로가 아닙니다.

저장 규칙과 운영 방법: [매뉴얼](manual.md).

`#owned`의 **보유 에셋**은 에셋명·스타일·포함 모델/소품/기능을 표시하는
검색 가능한 표입니다. 원본 서비스의 허용 필드만 `data/owned-assets.json`으로
전달하며, 계정 캡처·취득일·개인 경로·파일 자체는 포함하지 않습니다.
설명 확인, 로컬 색인 확인, 제품명 추정, 미확인 상태를 구분합니다.

목록 UI 검사: Node 20+에서 `node --test assets/skyhaven-owned-assets.test.mjs`.
DOM 검사는 설치된 jsdom 경로를 `JSDOM_PATH`로 지정하면 함께 실행됩니다.
