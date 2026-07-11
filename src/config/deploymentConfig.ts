import {
  NAVIGATOR_ROLES,
  roleHasPermission,
  type NavigatorPermission,
  type NavigatorRole,
} from './roleConfig'

/**
 * Deployment 계층 — "이 빌드가 **어떤 Role/모드로** 실행되는가"를 빌드 환경변수로 결정한다.
 *
 * 책임 분리:
 * - Permission 계층([roleConfig.ts]) = "각 Role이 **무엇을 할 수 있는가**"(정책, 환경 무지).
 * - Deployment 계층(이 파일)          = "지금 이 배포가 **어떤 Role/모드인가**"(환경 해석).
 * - capability(`can`/`canEdit`/`canSave`) = 위 둘의 **합성**. 컴포넌트/스토어는 흩어진
 *   hostname·env 검사 대신 이 합성 결과만 사용한다.
 *
 * Google 로그인 도입 전까지 Role은 빌드 시점에 고정된다(RoleBasedAccessControl.md).
 */

/** Preview(호스팅) 감지 — 명시적 빌드 env(`VITE_APP_MODE=preview`). hostname 감지 아님. */
export const IS_PREVIEW_MODE = import.meta.env.VITE_APP_MODE === 'preview'
export const isPreviewMode = IS_PREVIEW_MODE

/** Viewer-only 배포 플래그(`VITE_VIEWER_ONLY=true`). */
export const VIEWER_ONLY_BUILD = import.meta.env.VITE_VIEWER_ONLY === 'true'

/** Preview 안내 문구 (수정 및 저장 불가 고지). */
export const PREVIEW_NOTICE = 'Preview 환경입니다. 수정 및 저장 기능은 사용할 수 없습니다.'

/**
 * 배포 시점 Role 결정.
 * - VITE_APP_MODE=preview → viewer (읽기 전용 Preview 배포, 최우선)
 * - VITE_VIEWER_ONLY=true → viewer (Viewer-only 배포)
 * - VITE_NAVIGATOR_ROLE=viewer|process-builder|platform-owner → 해당 Role
 * - 미지정 → platform-owner (로컬 개발 기본값)
 */
function resolveDeploymentRole(): NavigatorRole {
  if (IS_PREVIEW_MODE) return 'viewer'
  if (VIEWER_ONLY_BUILD) return 'viewer'
  const configured = import.meta.env.VITE_NAVIGATOR_ROLE as string | undefined
  if (configured && (NAVIGATOR_ROLES as readonly string[]).includes(configured)) {
    return configured as NavigatorRole
  }
  return 'platform-owner'
}

/** 이 빌드가 실행되는 Role. */
export const NAVIGATOR_DEPLOYMENT_ROLE: NavigatorRole = resolveDeploymentRole()

// ── capability = Permission(정책) ∘ Deployment(현재 Role/모드) ─────────────────
// UI/Command/Store 게이팅의 단일 진입점.

/** 현재 배포 Role이 해당 permission을 갖는지. */
export function can(permission: NavigatorPermission): boolean {
  return roleHasPermission(NAVIGATOR_DEPLOYMENT_ROLE, permission)
}

/**
 * 편집 가능 여부 — Preview에서는 Role 매핑과 무관하게 명시적으로 false(이중 안전).
 * Store의 mutation 초크포인트가 이 값으로 모든 편집 경로를 차단한다.
 */
export const canEdit = !IS_PREVIEW_MODE && roleHasPermission(NAVIGATOR_DEPLOYMENT_ROLE, 'edit-node-edge')

/** 저장 가능 여부 — Preview에서는 명시적으로 false. persistAll이 이 값으로 차단한다. */
export const canSave = !IS_PREVIEW_MODE && roleHasPermission(NAVIGATOR_DEPLOYMENT_ROLE, 'save-process')

/** 저장 권한이 없는 배포(=읽기 전용 UI). Toolbar의 Builder/저장 노출 게이팅에 쓴다. */
export const isViewerOnlyDeployment = !roleHasPermission(NAVIGATOR_DEPLOYMENT_ROLE, 'save-process')
