import type { TemplatePackageManifest } from '../types/templatePackage'
import {
  NAVIGATOR_ROLES,
  roleHasPermission,
  type NavigatorPermission,
  type NavigatorRole,
} from './roleConfig'

export type ProcessLifecycleGroupId =
  | 'business-start'
  | 'master-data'
  | 'purchase-inbound'
  | 'sales'
  | 'returns'
  | 'inventory'
  | 'settlement'

export type ProcessLifecycleGroup = {
  id: ProcessLifecycleGroupId
  label: string
  description: string
}

export const TEMPLATE_ID = 'copan-erp-template'
export const VIEWER_ONLY_BUILD = import.meta.env.VITE_VIEWER_ONLY === 'true'

/**
 * 배포 시점 Role 결정 (RoleBasedAccessControl.md).
 * Google 로그인 도입 전까지는 빌드 환경변수로 Role을 정한다.
 * - VITE_VIEWER_ONLY=true → viewer (Viewer-only 배포)
 * - VITE_NAVIGATOR_ROLE=viewer|process-builder|platform-owner → 해당 Role
 * - 미지정 → platform-owner (로컬 개발 기본값)
 */
function resolveDeploymentRole(): NavigatorRole {
  if (VIEWER_ONLY_BUILD) return 'viewer'
  const configured = import.meta.env.VITE_NAVIGATOR_ROLE as string | undefined
  if (configured && (NAVIGATOR_ROLES as readonly string[]).includes(configured)) {
    return configured as NavigatorRole
  }
  return 'platform-owner'
}

export const NAVIGATOR_DEPLOYMENT_ROLE: NavigatorRole = resolveDeploymentRole()

/** 현재 배포 Role 기준 permission 확인 — UI/Command 게이팅 진입점 */
export function can(permission: NavigatorPermission): boolean {
  return roleHasPermission(NAVIGATOR_DEPLOYMENT_ROLE, permission)
}

export const APP_CONFIG = {
  appName: 'Copan ERP Process Navigator',
  processRootLabel: 'SCM Process',
  templateId: TEMPLATE_ID,
  deployment: {
    role: NAVIGATOR_DEPLOYMENT_ROLE,
    viewerOnly: !roleHasPermission(NAVIGATOR_DEPLOYMENT_ROLE, 'save-process'),
  },
  templateManifest: {
    kind: 'process-template-package',
    templateId: TEMPLATE_ID,
    displayName: 'Copan ERP Template',
    version: '0.1.0',
    scope: 'client-template',
    description: 'Copan TO-BE ERP process template for local development.',
    owner: 'Copan Global',
    source: 'local-json',
    localStatePath: '/process-data/state.json',
  } satisfies TemplatePackageManifest,
  lifecycleGroups: [
    {
      id: 'business-start',
      label: '사업 시작',
      description: '사업기회, 계약, 프로젝트, 구매요청으로 이어지는 시작 흐름',
    },
    {
      id: 'master-data',
      label: '기준정보',
      description: '품목, 거래처, 저장위치, 매장 등 SCM 기준정보',
    },
    {
      id: 'purchase-inbound',
      label: '구매/입고',
      description: '구매요청, 발주, 입고, 매입으로 이어지는 흐름',
    },
    {
      id: 'sales',
      label: '판매',
      description: 'B2B, B2C, 이벤트, 매장, 서비스 매출 흐름',
    },
    {
      id: 'returns',
      label: '반품',
      description: '판매 반품과 반품 입고 흐름',
    },
    {
      id: 'inventory',
      label: '재고',
      description: '재고이동, 기타출고, 입출고정보와 재고 반영 흐름',
    },
    {
      id: 'settlement',
      label: '정산',
      description: '로열티, 위탁, 수익배분, 프로젝트 정산 흐름',
    },
  ] satisfies ProcessLifecycleGroup[],
  detailProcessLifecycleGroupIds: {
    'business-to-purchase-request': 'business-start',
    'purchase-to-ap-invoice': 'purchase-inbound',
    'b2b-domestic-order-to-sales': 'sales',
    'b2b-domestic-return': 'returns',
    'b2b-export-order-to-sales': 'sales',
    'b2c-order-to-sales': 'sales',
    'preorder-to-sales': 'sales',
    'b2c-return': 'returns',
    'popup-concert-stock-sales-sync': 'sales',
    'event-sales': 'sales',
    'store-sales': 'sales',
    'stock-transfer': 'inventory',
    'other-issue': 'inventory',
    'royalty-mg-settlement': 'settlement',
    'consignment-settlement': 'settlement',
    'revenue-share-settlement': 'settlement',
    'service-business-to-expense': 'business-start',
    'service-purchase-to-ap': 'purchase-inbound',
    'service-order-to-sales': 'sales',
    'service-project-settlement': 'settlement',
    'storage-location-master': 'master-data',
    'purchase-return': 'returns',
    'other-receipt': 'inventory',
    'stock-movement': 'inventory',
  } satisfies Record<string, ProcessLifecycleGroupId>,
} as const

export function getConfiguredLifecycleGroupForDetailProcess(detailProcessId: string): ProcessLifecycleGroup {
  const groupId = (APP_CONFIG.detailProcessLifecycleGroupIds as Record<string, ProcessLifecycleGroupId>)[detailProcessId]
  return (
    APP_CONFIG.lifecycleGroups.find((group) => group.id === groupId)
    ?? APP_CONFIG.lifecycleGroups[0]
  )
}
