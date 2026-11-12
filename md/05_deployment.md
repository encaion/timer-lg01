# 05. 실행 및 배포

## 로컬에서 실행
- 가장 간단: `index.html` 더블클릭 → 브라우저에서 열림
  - 단, 이 경우 데스크톱 알림은 사용 불가 (`file://` 제한)
- 전체 기능 확인: VS Code 확장 **Live Server**로 열기 → `http://127.0.0.1:5500` 형태 주소로 열림

## GitHub Pages 배포

1. GitHub에서 새 저장소 생성 (예: `timer`)
   - 무료 계정은 **Public 저장소**여야 Pages 사용 가능
2. 로컬 폴더를 git 저장소로 만들고 push
   ```
   git init
   git add .
   git commit -m "타이머 초기 버전"
   git branch -M main
   git remote add origin https://github.com/<사용자명>/timer.git
   git push -u origin main
   ```
3. 저장소 → **Settings → Pages**
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)` → Save
4. 1~2분 후 `https://<사용자명>.github.io/timer/` 에서 접속

## 업데이트
- 코드 수정 후 commit + push 하면 자동 재배포 (1~2분)
- 반영이 안 보이면 `Ctrl + F5`로 강력 새로고침 (브라우저 캐시)

## 참고
- 루트의 `.nojekyll` 파일은 GitHub Pages가 `.md` 파일을 HTML로 변환하지 않도록 하는 빈 파일. 지우지 않는다.
- Public 저장소이므로 `md/` 문서를 포함한 모든 파일이 공개된다. 개인 정보는 넣지 않는다.
- 경로는 모두 **상대 경로**로 작성 (`css/style.css` O, `/css/style.css` X)
  - 사이트 주소가 `/timer/` 하위이기 때문에 `/`로 시작하면 파일을 못 찾는다.
- 자주 쓰면 브라우저 북마크 또는 Edge/Chrome의 "앱으로 설치"로 창 하나로 띄워 쓰기 편함
