# Role Based Access Control

|Field|Value|
|---|---|
|Title|Role Based Access Control|
|Purpose|Navigator의 권한 모델을 사용자 이름이 아니라 Role 기준으로 정의한다.|
|Status|Draft|
|Owner|Project Team|
|Last Updated|2026-07-02|
|Related Docs|`Architecture.md`, `Layer.md`, `PropertyPanel.md`, `LocalDevelopment.md`|

## Purpose

Navigator의 권한은 특정 사용자 이름이 아니라 Role을 기준으로 적용한다.

향후 Google Workspace 로그인은 사용자를 식별하는 수단이며, 실제 기능 접근 권한은 Email에 매핑된 Role을 통해 결정한다.

```mermaid
flowchart LR
  A["Google Workspace Login"] --> B["Email"]
  B --> C["Role Mapping"]
  C --> D["Permission Set"]
  D --> E["Navigator UI / Actions"]
```

이번 문서는 Role 모델만 정의한다.

Google OAuth, 사용자 등록, 조직 관리, 권한 저장소 구현은 다음 Phase에서 별도 설계한다.

## Core Principle

권한 모델은 다음 원칙을 따른다.

1. User는 식별자이며 권한의 기준이 아니다.
2. Role이 권한의 기준이다.
3. UI 노출, 편집 가능 여부, 저장 가능 여부는 Role Permission으로 결정한다.
4. 사람 이름은 코드, 설정, Template Config에 저장하지 않는다.
5. Role은 Platform 기능과 Process Asset 업무 흐름을 분리해서 관리한다.

## Role Definitions

### Platform Admin

Platform Admin은 Navigator 플랫폼 설정과 기술 운영을 관리한다.

권한 범위:

- Platform 설정
- Runtime 설정
- Router 설정
- Layout 설정
- App Config 관리
- Builder 기능 관리
- Role 관리 화면 접근
- 시스템 설정 접근

Platform Admin은 Process Asset을 직접 수정할 수 있지만, 일반적인 Process 구축 업무는 Process Builder Role을 통해 수행하는 것을 원칙으로 한다.

### Process Builder

Process Builder는 Process Asset을 작성하고 유지관리한다.

권한 범위:

- Process 생성
- Process 수정
- Process 삭제
- Process 복제
- Node 수정
- Edge 수정
- Lane / Zone 수정
- Process Group 수정
- 저장
- Review Package 작성 지원

Process Builder는 Navigator의 Builder Mode를 사용하는 기본 Role이다.

### Process Reviewer

Process Reviewer는 Process 검토와 승인 흐름을 담당한다.

권한 범위:

- Review Mode 접근
- Node Review Status 입력
- Comment 작성
- Internal Review 진행
- Business Review 의견 기록
- Approval 상태 변경

Process Reviewer는 Process 구조를 직접 수정하지 않는 것을 기본 원칙으로 한다.

필요 시 Process Builder Role과 함께 부여할 수 있다.

### Viewer

Viewer는 승인 또는 공유 대상 Process를 조회한다.

권한 범위:

- Process 조회
- Process 검색
- Node 설명 보기
- 확대 / 축소
- PDF 출력

Viewer는 Process, Node, Edge, Review, Config를 수정할 수 없다.

## Permission Matrix

|Action|Platform Admin|Process Builder|Process Reviewer|Viewer|
|---|---:|---:|---:|---:|
|Process 조회|Y|Y|Y|Y|
|Process 검색|Y|Y|Y|Y|
|PDF 출력|Y|Y|Y|Y|
|Process 생성|Y|Y|N|N|
|Process 수정|Y|Y|N|N|
|Process 삭제|Y|Y|N|N|
|Process 복제|Y|Y|N|N|
|Node / Edge 수정|Y|Y|N|N|
|Lane / Zone 수정|Y|Y|N|N|
|전체 저장|Y|Y|N|N|
|Review 입력|Y|Y|Y|N|
|Approval 상태 변경|Y|N|Y|N|
|Router / Layout 설정|Y|N|N|N|
|Runtime 설정|Y|N|N|N|
|Role 관리|Y|N|N|N|
|사용자 관리|Y|N|N|N|
|조직 관리|Y|N|N|N|
|시스템 설정|Y|N|N|N|

## Mode Mapping

Navigator의 화면 Mode는 Role에 따라 다음처럼 제한한다.

|Mode|Allowed Roles|Description|
|---|---|---|
|Viewer Mode|Platform Admin, Process Builder, Process Reviewer, Viewer|Process 조회 중심 화면|
|Builder Mode|Platform Admin, Process Builder|Process 편집 화면|
|Review Mode|Platform Admin, Process Reviewer, Process Builder|Internal Review 및 승인 검토 화면|
|Admin Mode|Platform Admin|관리 메뉴 및 시스템 설정 화면|

## Future Admin Menu

향후 관리 메뉴는 Platform Admin Role에서만 접근한다.

관리 메뉴 후보:

- 사용자 관리
- Role 관리
- 조직 관리
- 시스템 설정

관리 메뉴는 Process Asset 편집 기능과 분리한다.

## Role Assignment Model

초기 권장 구조:

```text
Email
↓
Role Assignment
↓
Permission Set
↓
UI / Command / Save Guard
```

Role Assignment는 한 사용자에게 여러 Role을 부여할 수 있게 설계한다.

예:

- Process Builder + Process Reviewer
- Platform Admin + Process Builder

단, 권한 충돌이 있을 경우 더 높은 권한을 우선 적용한다.

## Enforcement Points

향후 구현 시 권한은 다음 지점에서 적용한다.

1. Toolbar
   - Builder / Review / Admin 진입 버튼 노출 제어

2. Process Tree
   - Process 추가, 복제, 삭제, 그룹 편집 제어

3. Property Panel
   - Node / Edge / Lane / Zone 수정 가능 여부 제어

4. Command Layer
   - copy, paste, duplicate, delete, undo, redo 등 실행 가능 여부 제어

5. ProcessDataStore
   - 저장, 삭제, 복제 같은 데이터 변경 작업 최종 방어

6. Export / PDF
   - Viewer도 허용하되, 민감 정보 포함 여부는 별도 정책으로 관리

## Viewer-only Deployment

혁신팀 또는 경영진 리뷰용 Viewer-only 배포는 Role 모델의 특수 케이스다.

Viewer-only 배포에서는 로그인 여부와 무관하게 모든 사용자를 Viewer Role로 취급한다.

따라서 다음 기능은 노출하지 않는다.

- Builder Mode
- Review Mode
- 저장
- Process 생성 / 수정 / 삭제 / 복제
- Node / Edge 수정
- 관리 메뉴

## Out of Scope

이번 Phase에서 구현하지 않는다.

- Google OAuth
- 사용자 등록 UI
- Role 저장소
- 조직 관리
- 시스템 설정 화면
- Admin Mode UI
- 서버 권한 검증

## Next Phase

다음 Phase에서 검토할 항목:

1. Role 타입 정의
2. Permission 타입 정의
3. App Config의 defaultRole 정책
4. Google Workspace Email to Role Mapping 구조
5. Viewer-only build와 Role Model 통합
6. Command Layer의 canExecute와 Permission 연동
