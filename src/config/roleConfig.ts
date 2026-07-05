export const NAVIGATOR_ROLES = [
  'platform-owner',
  'process-builder',
  'viewer',
] as const

export type NavigatorRole = (typeof NAVIGATOR_ROLES)[number]

export const NAVIGATOR_PERMISSIONS = [
  'view',
  'search',
  'zoom',
  'export-pdf',
  'review',
  'create-process',
  'edit-process',
  'delete-process',
  'duplicate-process',
  'edit-group',
  'edit-node-edge',
  'save-process',
  'manage-platform',
  'manage-router',
  'manage-runtime',
  'manage-methodology',
  'manage-users',
  'manage-system',
] as const

export type NavigatorPermission = (typeof NAVIGATOR_PERMISSIONS)[number]

export const ROLE_PERMISSION_MAP = {
  'viewer': [
    'view',
    'search',
    'zoom',
    'export-pdf',
  ],
  'process-builder': [
    'view',
    'search',
    'zoom',
    'export-pdf',
    'review',
    'create-process',
    'edit-process',
    'delete-process',
    'duplicate-process',
    'edit-group',
    'edit-node-edge',
    'save-process',
  ],
  'platform-owner': [
    ...NAVIGATOR_PERMISSIONS,
  ],
} as const satisfies Record<NavigatorRole, readonly NavigatorPermission[]>

export const DEFAULT_NAVIGATOR_ROLE: NavigatorRole = 'viewer'

export function roleHasPermission(role: NavigatorRole, permission: NavigatorPermission): boolean {
  return (ROLE_PERMISSION_MAP[role] as readonly NavigatorPermission[]).includes(permission)
}
