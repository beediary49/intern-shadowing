# Intern Shadowing v36 — Google 로그인 자동 동기화

## 1. 먼저 Firebase 프로젝트 설정 (필수)
1. https://console.firebase.google.com/ 접속 후 프로젝트 만들기 (예: `intern-shadowing-sync`).
2. 프로젝트 설정 → 앱 추가 → **웹(</>)** 앱 등록.
3. 웹앱 설정값 `firebaseConfig`에서 **apiKey, authDomain, projectId, appId**를 복사.
4. `firebase-config.js`에 네 값을 입력하고 파일을 저장.
5. Firebase Console → **Authentication → Sign-in method → Google → Enable**, 지원 이메일 설정 후 저장.
6. Authentication → Settings → **Authorized domains**에 `beediary49.github.io` 추가. `https://`와 경로는 넣지 마세요.
7. **Firestore Database → Create database** 선택 후 만들고 **Rules**에서 `firestore.rules` 내용을 복사해 붙여 넣은 다음 Publish. 기본 `test mode`의 공개 규칙을 유지하면 안 됩니다.
8. 이 패키지에서 **index.html, cloud-sync.js, firebase-config.js, sw.js, 7개 data 폴더, icons 폴더, manifest.webmanifest 등**을 기존 GitHub Pages 저장소 `beediary49/intern-shadowing` 루트에 업로드한 후 Commit.
9. https://beediary49.github.io/intern-shadowing/ 를 Chrome 또는 Edge에서 열어 **☁ Google 로그인**을 선택하세요.
10. 노트북과 갤럭시에서 **같은 Google 계정**을 사용하면 동기화됩니다. 구 버전 기록은 첫 로그인할 때 보유 중인 데이터를 클라우드와 병합합니다.

## 동기화 대상
- 즐겨찾기, 학습 완료, 개인 메모: 로그인 시 불러오고 변경 시 자동 동기화
- 마지막 Part / 재생 위치: 대략 15초 간격으로 동기화. 다른 기기에서 최신 위치를 수정했으면 앱 실행 시 복원하거나 ‘클라우드 학습 위치로 이동’ 표시
- MP4 영상: 업로드하지 않음, 기기 내 영상 보관함에 별도 보관

## 주의사항
- 카카오톡 인앱 브라우저가 아닌 Chrome / Edge / 설치된 PWA에서 로그인하는 것이 좋습니다.
- Firebase 설정 전에는 Google 로그인 기능이 비활성화되지만 기존 오프라인 학습, 기록 백업/복원이 가능합니다.
- Firebase 프로젝트 생성 및 보안 규칙 설정은 사용자가 자기 Google 계정으로 해야 합니다. `apiKey`는 웹앱 식별정보이지만 API 사용 제한·보안 규칙을 정확히 적용해야 합니다.
- 동시 수정은 최신 저장 시각을 기준으로 병합합니다. 네트워크가 오래 끊긴 상태에서는 충돌 가능성이 있으므로 중요한 기록은 백업 JSON도 저장하는 것이 좋습니다.
- 서비스 요금제/무료 할당량은 Firebase Console에서 현재 조건을 확인하세요.


## 중요: 실제 앱 데이터 경로의 Firestore Rules
이 앱은 `/users/{uid}/records/{favorites|completed|notes|resume}` 경로를 사용합니다.
이전에 안내된 `/users/{uid}` 단일 문서 허용 규칙으로는 하위 records 문서에 접근할 수 없습니다.
이 패키지의 `firestore.rules`를 Firebase Console → Firestore → Rules에서 전체 교체하고 Publish하세요.

기존 기록은 각 기기의 브라우저에 남아 있을 수 있으므로 초기 로그인 전에 기록 백업을 권장합니다.
MP4는 동기화하지 않습니다. 실제 계정 로그인/동기화는 두 기기에서 테스트해야 합니다.
