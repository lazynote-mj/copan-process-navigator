# Firebase

|Field|Value|
|---|---|
|Title|Firebase Architecture|
|Purpose|현재 로컬 개발 범위에서 Firebase 및 클라우드 저장소가 제외 범위임을 명확히 정의한다.|
|Status|Deprecated|
|Owner|Project Team|
|Last Updated|2026-06-27|
|Related Docs|`DataModel.md`, `LocalDevelopment.md`, `LocalStorage.md`|

현재 프로젝트 범위는 배포/호스팅이 아니라 로컬 개발환경에서의 구조 분리다.

따라서 다음 항목은 현재 Architecture 범위에서 제외한다.

- Firebase
- AWS
- Hosting
- Auth
- Firestore
- Cloud Storage
- Google Workspace 로그인 연동
- 배포 설정

현재 기준 저장/불러오기는 local server와 local storage adapter 중심으로 설계한다.

향후 외부 호스팅 또는 서비스 서버로 전환할 수 있도록 저장소 의존성은 interface로 분리하되, 이번 단계에서 cloud provider 구현은 하지 않는다.
