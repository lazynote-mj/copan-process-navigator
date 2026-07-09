import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { filePayloadToProcessData, validateImportPayload } from '../processDataIO'
import {
  INITIAL_CONTENT_VERSION,
  isV2Payload,
  processDataToFilePayload,
  resolveContentVersion,
  resolveSchemaVersion,
  type ProcessDataFilePayload,
} from '../processDataMigration'

/**
 * WP1 — Runtime Persistence Baseline (ADR-005 §D3).
 * 정책: schemaVersion=2 / content version=1(초기), dirty는 persistence 제외.
 * 검증 대상: legacy 호환(T8), roundtrip 무결(T6), content 버전 보존, dirty 미직렬화.
 */

// 실제 체크인된 legacy 파일: top-level version:2, schemaVersion 없음, content version 없음.
const LEGACY_PATH = resolve('public/process-data/state.json')
const legacyPayload = JSON.parse(readFileSync(LEGACY_PATH, 'utf8')) as ProcessDataFilePayload

describe('WP1 persistence baseline — schemaVersion / content version 해석', () => {
  it('legacy 파일은 top-level version을 schemaVersion으로 해석한다 (back-compat)', () => {
    expect((legacyPayload as { schemaVersion?: number }).schemaVersion).toBeUndefined()
    expect(resolveSchemaVersion(legacyPayload)).toBe(2)
    expect(isV2Payload(legacyPayload)).toBe(true)
  })

  it('legacy 파일에는 content version이 없으므로 초기값(1)으로 해석한다', () => {
    expect(resolveContentVersion(legacyPayload)).toBe(INITIAL_CONTENT_VERSION)
    expect(INITIAL_CONTENT_VERSION).toBe(1)
  })

  it('schemaVersion이 있는 파일에서만 top-level version이 content version이다', () => {
    const withSchema = { ...legacyPayload, schemaVersion: 2, version: 7 } as ProcessDataFilePayload
    expect(resolveSchemaVersion(withSchema)).toBe(2)
    expect(resolveContentVersion(withSchema)).toBe(7)
  })
})

describe('WP1 persistence baseline — T8 legacy hydrate', () => {
  it('legacy 파일을 정상 hydrate하고 content version을 1로 초기화한다', () => {
    const payload = validateImportPayload(legacyPayload)
    const data = filePayloadToProcessData(payload, 'server-json')

    expect(data.version).toBe(INITIAL_CONTENT_VERSION)
    expect(data.dirty).toBe(false)
    expect(data.processes.length).toBeGreaterThan(0)
  })
})

describe('WP1 persistence baseline — dirty persistence 제외', () => {
  it('processDataToFilePayload는 dirty를 직렬화하지 않는다 (dirty:true 입력이어도)', () => {
    const data = filePayloadToProcessData(validateImportPayload(legacyPayload), 'server-json')
    const payload = processDataToFilePayload({ ...data, dirty: true })

    expect('dirty' in payload).toBe(false)
  })

  it('저장 payload는 schemaVersion:2를 명시하고 exportedAt을 포함한다', () => {
    const data = filePayloadToProcessData(validateImportPayload(legacyPayload), 'server-json')
    const payload = processDataToFilePayload(data)

    expect(payload.schemaVersion).toBe(2)
    expect(typeof payload.exportedAt).toBe('string')
    expect(payload.exportedAt.length).toBeGreaterThan(0)
  })
})

describe('WP1 persistence baseline — T6 roundtrip 무결', () => {
  it('load → save → load 후 엔티티 수와 content version이 보존된다', () => {
    const data = filePayloadToProcessData(validateImportPayload(legacyPayload), 'server-json')

    const saved = processDataToFilePayload(data)
    const reloaded = filePayloadToProcessData(validateImportPayload(saved), 'server-json')

    expect(reloaded.processes.length).toBe(data.processes.length)
    expect(reloaded.commonMasters.lanes.length).toBe(data.commonMasters.lanes.length)
    expect(reloaded.commonMasters.phases.length).toBe(data.commonMasters.phases.length)
    // WP1은 content version을 보존만 한다(증가는 WP5 applyChangeSet의 몫).
    expect(reloaded.version).toBe(data.version)
  })

  it('schemaVersion 파일의 bumped content version은 재로드 시 그대로 유지된다', () => {
    const data = filePayloadToProcessData(validateImportPayload(legacyPayload), 'server-json')
    const saved = processDataToFilePayload(data)

    // content version이 이미 증가된 상태의 파일을 모사(WP5 이후 시나리오 선검증).
    const bumped = { ...saved, version: 7 } as ProcessDataFilePayload
    const reloaded = filePayloadToProcessData(validateImportPayload(bumped), 'server-json')

    expect(reloaded.version).toBe(7)
  })
})
