import { describe, expect, it } from 'vitest'
import { resolveSaveGuardDecision } from '../../../vite-plugin-process-data'

/**
 * Phase 2A.2 — Optimistic Save Guard 결정 로직(순수 함수) 단위 검증.
 * concurrency token = 서버 소유 revision. HTTP 부작용 없이 판정만 검증한다.
 */

describe('resolveSaveGuardDecision', () => {
  it('파일이 없으면 bootstrap(첫 저장, revision=1) — 토큰 불필요', () => {
    const d = resolveSaveGuardDecision({ fileExists: false, currentRevision: 0, baseHeader: undefined })
    expect(d.action).toBe('bootstrap')
    expect(d).toMatchObject({ nextRevision: 1 })
  })

  it('토큰이 현재 revision과 일치하면 apply(revision+1)', () => {
    const d = resolveSaveGuardDecision({ fileExists: true, currentRevision: 3, baseHeader: '3' })
    expect(d.action).toBe('apply')
    expect(d).toMatchObject({ nextRevision: 4 })
  })

  it('legacy 로컬 파일(revision 없음 → 0)에 base "0" 저장은 apply(→1)로 매끄럽게 전이', () => {
    const d = resolveSaveGuardDecision({ fileExists: true, currentRevision: 0, baseHeader: '0' })
    expect(d).toMatchObject({ action: 'apply', nextRevision: 1 })
  })

  it('stale 토큰(base ≠ current)이면 409 conflict — 파일을 덮어쓰지 않음', () => {
    const d = resolveSaveGuardDecision({ fileExists: true, currentRevision: 5, baseHeader: '4' })
    expect(d.action).toBe('conflict')
    expect(d).toMatchObject({ status: 409, currentRevision: 5 })
    // 결정에 write/next가 없다 = 덮어쓰기 지시 없음
    expect(d).not.toHaveProperty('nextRevision')
  })

  it('파일 존재 + 토큰 누락이면 400 reject', () => {
    const d = resolveSaveGuardDecision({ fileExists: true, currentRevision: 2, baseHeader: undefined })
    expect(d).toMatchObject({ action: 'reject', status: 400 })
  })

  it('파일 존재 + 토큰 오형식(비정수)이면 400 reject', () => {
    for (const bad of ['abc', '1.5', '-1', '', ' 2 ']) {
      const d = resolveSaveGuardDecision({ fileExists: true, currentRevision: 2, baseHeader: bad })
      expect(d).toMatchObject({ action: 'reject', status: 400 })
    }
  })

  it('파일 존재 + 헤더가 배열(중복)이면 400 reject', () => {
    const d = resolveSaveGuardDecision({ fileExists: true, currentRevision: 2, baseHeader: ['2', '3'] })
    expect(d).toMatchObject({ action: 'reject', status: 400 })
  })
})
