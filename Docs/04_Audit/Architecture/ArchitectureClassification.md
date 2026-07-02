# Architecture Classification

## Purpose

Platform과 Copan Process를 향후 물리적으로 분리할 수 있도록 현재 파일을 Platform, Copan, Shared 관점으로 분류한다.

이번 문서는 Audit 결과이며, 코드 이동이나 JSON 수정은 수행하지 않는다.

## Status

Draft

## Classification Rule

- **Platform**: 특정 회사나 업무 도메인을 몰라도 동작해야 하는 범용 기능
- **Copan**: Copan SCM Process Asset, Douzone Mapping, Review, Master, Menu, Configuration
- **Shared**: Platform과 Copan Template이 함께 참조할 수 있는 일반 타입, 계약, Adapter 경계

Platform에는 아래 개념이 직접 존재하면 안 된다.

- Copan
- SCM
- Douzone
- BusinessActivity
- Process Mapping
- OmniEsol / EasyAdmin / EasyChain / Cafe24 등 Copan 실행 시스템명

## Classification Table

| File | Current Path | Platform | Copan | Shared | Recommendation |
|---|---|---:|---:|---:|---|
| App entry | `src/main.tsx` | Y | N | N | Platform entry로 유지하되 active template 주입 지점만 남긴다. |
| App shell | `src/App.tsx`, `src/App.css`, `src/index.css` | Y | N | N | Platform app shell로 유지한다. Copan title/config는 외부 주입으로 분리한다. |
| Bootstrap | `src/bootstrap/*` | Y | N | N | Platform bootstrap layer로 유지한다. |
| Runtime | `src/runtime/*` | Y | N | N | WorkspaceRuntime / TemplateRuntime은 Platform runtime으로 유지한다. |
| Template manager | `src/template/*` | Y | N | Shared | Template lifecycle은 Platform, 실제 TemplateDefinition은 Copan으로 분리한다. |
| Clipboard | `src/clipboard/*` | Y | N | N | Platform productivity 기능으로 유지한다. |
| Commands | `src/commands/*` | Y | N | N | Toolbar/Shortcut/Context action 정렬 계층으로 Platform에 유지한다. |
| Selection | `src/selection/*` | Y | N | N | Platform selection source of truth로 유지한다. |
| Editor components | `src/components/editor/*` | Y | N | Shared | Property/Edge/Node editor는 Platform. 단 label/help text 중 Copan 용어는 template label map으로 분리 필요. |
| Layout components | `src/components/layout/AppLayout.tsx` | Y | Partial | N | Builder/Viewer shell은 Platform이나 `SCM Process`, Copan title 등 하드코딩은 Copan config로 이동한다. |
| Toolbar | `src/components/layout/Toolbar.tsx` | Y | Partial | N | Toolbar 자체는 Platform. `Copan ERP Process Navigator` title은 template manifest 값으로 대체한다. |
| Process menu UI | `src/components/layout/ProcessGroupMenu.tsx` | Y | Partial | Shared | Tree UI는 Platform. Lifecycle 그룹 정의는 Copan config에서 주입해야 한다. |
| Router health UI | `src/components/layout/RouterHealthDashboard.tsx` | Y | N | N | Developer diagnostics로 Platform 유지. |
| Drawer/Status/Dialog | `src/components/layout/Drawer.tsx`, `DataStatusBar.tsx`, `DataDialogs.tsx` | Y | N | N | Platform UI shell로 유지. |
| Canvas | `src/components/process-map/ProcessMapCanvas.tsx` | Y | N | N | Rendering/interaction core로 Platform 유지. |
| Node cards | `src/components/process-map/nodes/*` | Y | N | N | Node renderer로 Platform 유지. Type theme는 template override 가능하게 분리 권장. |
| Edge components | `src/components/process-map/edges/*` | Y | N | N | Edge renderer로 Platform 유지. |
| Layout engine | `src/lib/layout/*` | Y | Partial | N | Router/Layout는 Platform. `overview*`, `settlement*` 등 Copan 업무명/특수 layout은 generic naming 또는 template policy로 분리 필요. |
| Editor library | `src/lib/editor/*` | Y | N | N | Generic editor helper로 Platform 유지. |
| Node numbering | `src/lib/nodeNumbering.ts` | Y | N | N | View-only numbering engine으로 Platform 유지. Semantics token은 template config로 분리 가능. |
| Node display | `src/lib/nodeDisplay.ts`, `src/lib/overviewNodeDisplay.ts`, `src/lib/overviewEdgeLabels.ts` | Y | Partial | Shared | 표시 규칙은 Platform이나 Overview/Copan label preset은 template config로 이동 권장. |
| Master layer | `src/lib/master/*` | Y | N | Shared | Default master resolver로 Platform 유지. 실제 master data는 Copan Template로 이동한다. |
| Engine contracts | `src/engine/*`, `src/definition/*` | Y | N | Shared | ProcessDefinition / ViewModel contract는 Shared 또는 Platform contract로 유지한다. |
| Generic process types | `src/types/process.ts`, `edgeTypes.ts`, `nodeTypes.ts`, `processData.ts`, `processInstance.ts`, `templatePackage.ts` | Y | Partial | Shared | 타입은 Shared에 가깝다. 주석의 ERP/SCM/TO-BE 표현은 generic 용어로 정리한다. |
| Overview node types | `src/types/overviewNodeTypes.ts` | Y | Partial | Shared | Overview type 자체는 Platform 가능. PDF/TO-BE 기준 주석은 Copan 문서로 이동한다. |
| Navigator group types | `src/types/toBeNavigator.ts` | N | Partial | Shared | 현재 이름은 Copan/TO-BE 성격. `processAssetNavigation` 같은 generic 타입으로 분리 권장. |
| Common masters type | `src/types/commonMasters.ts` | Y | N | Shared | Master schema type으로 Shared 유지. |
| Storage adapter | `src/data/processStorageAdapter.ts`, `processDataRemote.ts`, `processDataIO.ts` | Y | N | Shared | Storage contract는 Platform. 실제 storage endpoint는 runtime config로 분리한다. |
| Data store | `src/data/processDataStore.tsx`, `processDataMutations.ts` | Y | N | Shared | Generic process data store로 Platform 유지. |
| Data migration | `src/data/processDataMigration.ts`, `processExport.ts` | Y | Partial | Shared | Generic migration은 Platform. Copan-specific compatibility는 template migration으로 분리한다. |
| Process registry | `src/data/processRegistry.ts`, `processRegistry.json` | N | Y | N | Copan Template registry로 이동 대상. |
| Copan manifest | `src/data/copanTemplateManifest.ts` | N | Y | N | Copan Template root로 이동 대상. |
| Lifecycle groups | `src/data/processLifecycleGroups.ts` | N | Y | N | Copan SCM lifecycle IA config로 이동 대상. |
| Lane registry | `src/data/laneRegistry.ts`, `lanes.json` | N | Y | Shared | Lane resolver는 Platform 가능. Lane data는 Copan config로 이동. |
| Overview/detail registry | `src/data/toBeNavigatorRegistry.ts`, `overviewDetailProcesses.ts` | N | Y | N | Copan Process Asset registry로 이동 대상. |
| Overview process data | `src/data/toBeOverview/*` | N | Y | N | Copan Process data/config로 이동 대상. |
| Detail process JSON | `src/data/processes/*.json` | N | Y | N | Copan Process data로 이동 대상. |
| Runtime state | `public/process-data/state.json` | N | Y | N | Copan Template package state로 이동 대상. |
| Public static assets | `public/favicon.svg`, `public/icons.svg` | Y | N | N | Platform static assets로 유지. Branding asset은 template override 가능하게 분리. |
| Vite data plugin | `vite-plugin-process-data.ts` | Y | N | Shared | Local-first storage adapter support로 Platform tooling 유지. |
| Vite config | `vite.config.ts` | Y | N | N | Platform dev/build config. Template path 주입 가능성 검토. |
| Package files | `package.json`, `package-lock.json`, `tsconfig*.json`, `eslint.config.js`, `index.html` | Y | N | N | Platform repository root config로 유지. |
| Root screenshots | `.cursor-*.png` | N | Y | N | 임시 검증 자료. Package boundary 정리 전 archive/delete 판단 필요. |
| Docs architecture | `Docs/00_Project/*`, `Docs/01_Architecture/*` | Partial | Partial | Shared | Platform architecture와 Copan asset docs를 분리해야 한다. |
| Docs master | `Docs/02_Master/*` | N | Y | Shared | Business Capability/Activity/Node Definition은 Copan Methodology로 이동. Generic master schema만 Platform docs에 남긴다. |
| Docs guides | `Docs/03_Guides/*` | Partial | Partial | Shared | Builder/Viewer generic guide와 Copan 운영 guide를 분리한다. |
| Docs audit | `Docs/04_Audit/*` | Partial | Y | N | Copan audit과 Platform diagnostics audit을 폴더로 분리한다. |
| Docs review | `Docs/05_Review/*` | N | Y | N | Copan Review Package로 이동 대상. |
| Docs data/source/mapping | `Docs/06_Data/*` | N | Y | N | Douzone/Copan source, mapping, coverage는 Copan Template repository 대상. |
| Docs archive | `Docs/07_Archive/*` | N | Y | N | Copan project archive로 이동 대상. |
| Root README | `README.md`, `Docs/README.md` | Partial | Partial | Shared | Platform README와 Copan Process Asset README를 분리한다. |

## Current Coupling Findings

| Finding | Current Location | Impact | Recommendation |
|---|---|---|---|
| Platform UI title contains Copan name | `src/components/layout/Toolbar.tsx` | Platform branding이 Copan에 고정됨 | `TemplateManifest.displayName` 또는 workspace config에서 주입 |
| Breadcrumb uses SCM wording | `src/components/layout/AppLayout.tsx` | Platform shell이 SCM을 직접 앎 | lifecycle root label을 template IA config로 주입 |
| Lifecycle group config is in `src/data` | `src/data/processLifecycleGroups.ts` | Platform menu가 Copan SCM lifecycle에 결합 | `templates/copan/config/processLifecycleGroups.ts`로 이동 후보 |
| Copan template manifest is in common data folder | `src/data/copanTemplateManifest.ts` | Template definition과 Platform data boundary가 섞임 | `templates/copan/manifest.ts` 후보 |
| Process JSON is mixed with data helpers | `src/data/processes/*`, `src/data/toBeOverview/*` | Package boundary 분리 시 import path 대량 수정 가능 | Template package root를 먼저 만들고 registry import를 adapter화 |
| Docs mix Platform and Copan documents | `Docs/*` | Source of Truth 경계가 흐림 | `Docs/Platform`과 `Docs/Copan` 또는 별도 template docs로 분리 |
| Type comments include SCM/TO-BE wording | `src/types/process.ts`, `overviewNodeTypes.ts` | 타입은 범용인데 설명이 Copan 기준 | 주석/label을 generic 용어로 정리 |
| Layout files include domain-ish naming | `src/lib/layout/settlementGroupLayout.ts`, `overviewProcessZones.ts` | 일부 layout policy가 업무명에 끌림 | Generic policy + template policy config로 분리 |

## Recommended Future Folder Boundary

아직 이동하지 않는다. 다음 구조는 Template Package boundary 정리 전 중간 목표다.

```text
src/
  platform/
    bootstrap/
    runtime/
    components/
    lib/
    clipboard/
    commands/
    selection/
    types/
  shared/
    process/
    template/
    storage/
  templates/
    copan/
      manifest.ts
      config/
      data/
      docs/
```

현재 코드 이동 전에는 alias 또는 adapter 경계를 먼저 만들어야 한다.

## Separation Priority

1. **Branding/config 분리**
   - Toolbar title
   - Lifecycle root label
   - Template manifest

2. **Copan data package 경계 생성**
   - `src/data/processes/*`
   - `src/data/toBeOverview/*`
   - `public/process-data/state.json`
   - `processRegistry.json`

3. **Menu/IA config 분리**
   - `processLifecycleGroups.ts`
   - Detail/Overview group registry

4. **Docs 경계 분리**
   - Platform docs
   - Copan Process Asset docs

5. **Platform type/comment cleanup**
   - SCM/TO-BE 주석 제거
   - Generic naming으로 정리

6. **Template runtime connection**
   - App → WorkspaceRuntime → TemplateManager → Active Copan Template → ProcessDataProvider

## Repository Split Readiness

| Area | Readiness | Note |
|---|---|---|
| Platform runtime | Medium | Runtime/TemplateManager 골격은 있으나 App이 아직 Copan data를 직접 참조한다. |
| Platform UI | Medium | UI 자체는 범용이나 title/menu/config에 Copan coupling이 남아 있다. |
| Platform data store | High | StorageAdapter 주입 구조가 있어 분리 가능성이 높다. |
| Copan process data | Medium | JSON은 분리 가능하지만 registry/import 경로 정리가 필요하다. |
| Docs | Low | Platform과 Copan 문서가 같은 Docs tree에 섞여 있다. |
| Hosting package | Medium | Viewer-only dist 가능. Builder 저장은 local/server adapter 의존. |

## Decision

현재 Repository를 바로 분리하기보다는, 먼저 **Template Package Boundary**를 코드상에 명확히 만든 뒤 분리하는 것이 안전하다.

가장 먼저 분리해야 할 것은 Platform 기능 코드가 아니라 **Copan data/config/docs**다.

## Next Recommended Phase

1. Copan Template Package folder 설계
2. App hardcoded Copan title/lifecycle label 제거
3. Process registry를 TemplateManager에서 가져오도록 adapter 준비
4. Docs를 Platform Docs와 Copan Process Asset Docs로 분리
5. 그 후 물리 배포 단위 분리 여부 판단
