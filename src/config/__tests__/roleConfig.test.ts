import { describe, expect, it } from 'vitest'
import {
  NAVIGATOR_PERMISSIONS,
  NAVIGATOR_ROLES,
  ROLE_PERMISSION_MAP,
  roleHasPermission,
} from '../roleConfig'

/**
 * RoleBasedAccessControl.md의 Role Hierarchy / Permission Matrix 회귀 테스트.
 * Platform Owner ⊃ Process Builder ⊃ Viewer 포함 관계를 보장한다.
 */

describe('role hierarchy', () => {
  it('상위 Role은 하위 Role의 권한을 모두 포함한다', () => {
    const viewer = new Set(ROLE_PERMISSION_MAP['viewer'])
    const builder = new Set(ROLE_PERMISSION_MAP['process-builder'])
    const owner = new Set(ROLE_PERMISSION_MAP['platform-owner'])

    for (const permission of viewer) {
      expect(builder.has(permission), `process-builder에 ${permission} 누락`).toBe(true)
    }
    for (const permission of builder) {
      expect(owner.has(permission), `platform-owner에 ${permission} 누락`).toBe(true)
    }
  })

  it('platform-owner는 정의된 모든 permission을 가진다', () => {
    for (const permission of NAVIGATOR_PERMISSIONS) {
      expect(roleHasPermission('platform-owner', permission)).toBe(true)
    }
  })

  it('Role별 permission은 전체 permission 목록에 존재한다', () => {
    const known = new Set<string>(NAVIGATOR_PERMISSIONS)
    for (const role of NAVIGATOR_ROLES) {
      for (const permission of ROLE_PERMISSION_MAP[role]) {
        expect(known.has(permission), `${role}의 ${permission}`).toBe(true)
      }
    }
  })
})

describe('permission matrix', () => {
  it('viewer는 조회 계열만 가능하다', () => {
    expect(roleHasPermission('viewer', 'view')).toBe(true)
    expect(roleHasPermission('viewer', 'search')).toBe(true)
    expect(roleHasPermission('viewer', 'zoom')).toBe(true)
    expect(roleHasPermission('viewer', 'export-pdf')).toBe(true)
    expect(roleHasPermission('viewer', 'review')).toBe(false)
    expect(roleHasPermission('viewer', 'edit-node-edge')).toBe(false)
    expect(roleHasPermission('viewer', 'save-process')).toBe(false)
  })

  it('process-builder는 편집은 가능하지만 관리 기능은 불가하다', () => {
    expect(roleHasPermission('process-builder', 'review')).toBe(true)
    expect(roleHasPermission('process-builder', 'edit-node-edge')).toBe(true)
    expect(roleHasPermission('process-builder', 'save-process')).toBe(true)
    expect(roleHasPermission('process-builder', 'manage-platform')).toBe(false)
    expect(roleHasPermission('process-builder', 'manage-router')).toBe(false)
    expect(roleHasPermission('process-builder', 'manage-users')).toBe(false)
  })
})
