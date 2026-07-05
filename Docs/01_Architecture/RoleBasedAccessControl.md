# Role Based Access Control

|Field|Value|
|---|---|
|Title|Navigator Role Model|
|Purpose|Navigator 권한을 사람 이름이 아니라 Role 기준으로 관리하기 위한 기준을 정의한다.|
|Status|Draft|
|Owner|Project Team|
|Last Updated|2026-07-02|
|Related Docs|`Architecture.md`, `Layer.md`, `PropertyPanel.md`, `LocalDevelopment.md`|

## Purpose

Navigator의 권한은 사용자 이름이 아니라 Role 기준으로 관리한다.

향후 Google Workspace 로그인은 사용자를 식별하는 수단이며, 실제 권한은 Email에 매핑된 Role을 통해 결정한다.

```mermaid
flowchart LR
  A["Google Workspace Login"] --> B["Email"]
  B --> C["Role Mapping"]
  C --> D["Permission Set"]
  D --> E["Navigator UI / Actions"]
```

이번 문서는 Role 모델과 권한 기준만 정의한다.

Google OAuth, 사용자 등록, Role 관리 UI, 서버 권한 검증은 후속 Phase에서 설계한다.

## Role Hierarchy

Role은 3단계 포함 관계를 따른다.

```text
Platform Owner
  ⊃ Process Builder
      ⊃ Viewer
```

상위 Role은 하위 Role의 권한을 모두 포함한다.

## Core Principles

1. 권한은 사람 이름이 아니라 Role 기준으로 관리한다.
2. Google Workspace 로그인 후 Email을 기준으로 사용자 Role을 조회한다.
3. 사람 이름은 코드나 설정에 하드코딩하지 않는다.
4. 향후 사용자 관리 메뉴에서 User to Role 매핑을 관리한다.
5. 현재는 Role Model과 권한 기준만 반영한다.
6. 실제 Google OAuth 구현은 후속 Phase에서 진행한다.

## Roles

### Platform Owner

Platform Owner는 모든 기능을 사용할 수 있다.

권한:

- 조회
- 검색
- 확대 / 축소
- PDF 출력
- Review
- Process 생성
- Process 수정
- Process 삭제
- Process 복제
- Group 편집
- Node / Edge 수정
- 저장
- Platform 설정
- Layout / Router
- Runtime
- Methodology
- 권한 관리
- 시스템 설정

### Process Builder

Process Builder는 Process Asset 구축과 수정을 담당한다.

권한:

- 조회
- 검색
- 확대 / 축소
- PDF 출력
- Review
- Process 생성
- Process 수정
- Process 삭제
- Process 복제
- Group 편집
- Node / Edge 수정
- 저장

불가:

- Platform 설정
- Layout / Router 수정
- Runtime 수정
- Methodology 수정
- 권한 관리
- 시스템 설정

### Viewer

Viewer는 조회 전용 Role이다.

권한:

- 조회
- 검색
- 확대 / 축소
- PDF 출력

불가:

- Review
- Process 생성 / 수정 / 삭제 / 복제
- Group 편집
- Node / Edge 수정
- 저장
- Platform 설정
- 권한 관리

## Role IDs

설정과 코드에서 사용할 Role ID는 다음과 같다.

|Role|Role ID|
|---|---|
|Platform Owner|`platform-owner`|
|Process Builder|`process-builder`|
|Viewer|`viewer`|

## Permissions

권장 Permission ID는 다음과 같다.

```text
view
search
zoom
export-pdf
review
create-process
edit-process
delete-process
duplicate-process
edit-group
edit-node-edge
save-process
manage-platform
manage-router
manage-runtime
manage-methodology
manage-users
manage-system
```

## Permission Matrix

|Permission|Platform Owner|Process Builder|Viewer|
|---|---:|---:|---:|
|view|Y|Y|Y|
|search|Y|Y|Y|
|zoom|Y|Y|Y|
|export-pdf|Y|Y|Y|
|review|Y|Y|N|
|create-process|Y|Y|N|
|edit-process|Y|Y|N|
|delete-process|Y|Y|N|
|duplicate-process|Y|Y|N|
|edit-group|Y|Y|N|
|edit-node-edge|Y|Y|N|
|save-process|Y|Y|N|
|manage-platform|Y|N|N|
|manage-router|Y|N|N|
|manage-runtime|Y|N|N|
|manage-methodology|Y|N|N|
|manage-users|Y|N|N|
|manage-system|Y|N|N|

## Mode Mapping

|Mode|Allowed Roles|Description|
|---|---|---|
|Viewer Mode|Platform Owner, Process Builder, Viewer|Process 조회 중심 화면|
|Builder Mode|Platform Owner, Process Builder|Process 편집 화면|
|Review Mode|Platform Owner, Process Builder|Process Review 화면|
|Admin Mode|Platform Owner|관리 메뉴 및 시스템 설정 화면|

## Future Admin Menu

향후 관리 메뉴는 Platform Owner만 접근한다.

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

Role Assignment는 사용자별 대표 Role 1개를 기본으로 한다.

필요 시 후속 Phase에서 다중 Role을 허용할 수 있지만, 기본 정책은 포함 관계를 가진 단일 Role이다.

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

Viewer-only 배포는 Role 모델의 특수 케이스다.

Viewer-only 배포에서는 로그인 여부와 무관하게 모든 사용자를 Viewer Role로 취급한다.

따라서 다음 기능은 노출하지 않는다.

- Builder Mode
- Review Mode
- 저장
- Process 생성 / 수정 / 삭제 / 복제
- Group 편집
- Node / Edge 수정
- 관리 메뉴

## Configuration Draft

Role 설정 초안은 다음 구조를 따른다.

```ts
roles = [
  "platform-owner",
  "process-builder",
  "viewer",
]

permissions = [
  "view",
  "search",
  "export-pdf",
  "review",
  "edit-process",
  "create-process",
  "delete-process",
  "duplicate-process",
  "edit-group",
  "save-process",
  "manage-platform",
  "manage-router",
  "manage-runtime",
  "manage-methodology",
  "manage-users",
  "manage-system",
]
```

## Out of Scope

이번 Phase에서 구현하지 않는다.

- Google OAuth
- 실제 로그인 기능
- 사용자 등록 UI
- Role 저장소
- 조직 관리
- 시스템 설정 화면
- Admin Mode UI
- 서버 권한 검증

## Next Phase

후속 Phase에서 필요한 작업:

1. Google Workspace OAuth 설계
2. Email to Role Mapping 저장 구조
3. Role 관리 UI
4. Command Layer `canExecute`와 Permission 연동
5. ProcessDataStore 저장/삭제 최종 권한 검증
6. Viewer-only build와 Role Model 통합
