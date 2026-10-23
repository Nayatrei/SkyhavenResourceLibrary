# Skyhaven Resource Library

웹 UI와 개인 리소스를 분리하는 로컬 연결형 에셋 라이브러리입니다.

- 공유 사이트에는 앱·Three.js·공통 매뉴얼만 있습니다.
- 각 사용자의 JSON 색인·썸네일·모델·텍스처는 자기 로컬/Dropbox 폴더에서 읽습니다.
- 데스크톱 Chrome/Edge에서 색인 폴더와 원본 루트의 읽기 권한을 연결합니다. localhost 서버나 원본 업로드가 필요하지 않습니다.
- 개인 색인 폴더를 이 저장소나 GitHub Pages에 업로드하지 마세요.

사용법과 MCP 작업 지침: [매뉴얼](manual.md).

## 자기 폴더로 시작

1. `examples/roots.json`을 자기 리소스 루트로 수정합니다.
2. `examples/snapshot.json`의 대표 모델·그룹·관련 자료를 실제 파일에 맞춥니다. MCP 클라이언트의 허용된 로컬 읽기 도구로 작성할 수 있습니다. 알려지지 않은 리그·검증을 임의로 완료 처리하지 않습니다.
3. 이 저장소의 exporter로 공통 앱과 개인 색인을 별도 폴더에 생성합니다.

```powershell
py -3 tools/export_skyhaven_site.py --catalog examples/snapshot.json --roots examples/roots.json --output ../my-library-app --index-output "D:/MyResources/Skyhaven Library"
```

4. 웹앱에서 `MyResources` 폴더를 선택합니다. 내부 목록과 같은 루트의 원본은 자동으로 연결합니다. 다른 프로젝트의 원본이 있다면 안내된 폴더만 추가로 연결합니다. 이미 게시된 같은 웹앱을 사용해도 되므로 개인별 사이트를 만들 필요는 없습니다.

## 배포

GitHub Pages 소스를 GitHub Actions로 설정합니다. 저장소의 workflow는 공통 앱만 배포합니다. CNAME을 바꿀 경우 자기 도메인을 사용하거나 파일을 제거합니다. 개인 색인 생성은 로컬 CLI 작업이며 GitHub Actions가 사용자의 디스크를 읽지는 않습니다.

이 앱은 MCP 서버를 자동 설치하지 않습니다. 브라우저 폴더 권한과 MCP 프로세스의 로컬 파일 권한은 별개입니다. 실제 폴더 권한, 시각적 재생과 배포는 해당 환경에서 확인해야 합니다.
