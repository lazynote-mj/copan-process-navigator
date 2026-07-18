import type { ExecutionDomain, ExecutionDomainId } from '../types/process'
import type { DomainAssignment } from '../types/toBeNavigator'
import type { Organization } from '../types/commonMasters'

/** Execution Domain 도입 스키마 버전 (V2→V3). schemaVersion<3 이면 마이그레이션 적용. */
export const EXECUTION_DOMAIN_SCHEMA_VERSION = 3

/**
 * Execution Domain 마이그레이션 — legacy lane(조직/혼합 스킴) → canonical Execution Domain + 조직 배정.
 *
 * ADR-011/012: Execution Domain·Organization·assignment는 Business Layer canonical이고,
 * runtime node.laneId는 이 도메인 id를 **참조**만 한다. 이 모듈은 매핑을 **config로 소유**하며
 * 렌더러에 하드코딩하지 않는다(WP1 명세 §3). 순수 함수 — 로드/레이아웃/UI를 건드리지 않는다.
 *
 * 설계 원칙:
 * - idempotent: 이미 canonical/synthetic 도메인 id면 identity 반환.
 * - 무손실: 알 수 없는 lane은 synthetic domain으로 보존 + warning.
 * - lane-requester/lane-erp 등 역할·시스템성 lane은 business로 하드코딩하지 않고 ambiguous 처리.
 */

// ── Business Layer canonical 마스터 시드 (WP3 commonMasters 변환에서 사용) ──────────

/** 1차 canonical Execution Domain 5종 (ADR 합의). synthetic 도메인은 마이그레이션 중 append. */
export const CANONICAL_EXECUTION_DOMAINS: ExecutionDomain[] = [
  { id: 'business', name: '사업', order: 1, ownerDepartment: '' },
  { id: 'procurement', name: '구매', order: 2, ownerDepartment: '' },
  { id: 'logistics', name: '물류', order: 3, ownerDepartment: '' },
  { id: 'sales', name: '매장/POS', order: 4, ownerDepartment: '' },
  { id: 'finance', name: '재무', order: 5, ownerDepartment: '' },
]

const CANONICAL_DOMAIN_IDS = new Set(CANONICAL_EXECUTION_DOMAINS.map((d) => d.id))

/** 1차 Organization 마스터 후보 (canonical). */
export const CANONICAL_ORGANIZATIONS: Organization[] = [
  { id: 'business-division', name: '사업부', order: 1 },
  { id: 'partner-cooperation', name: '상생협력팀', order: 2 },
  { id: 'business-innovation', name: '경영혁신팀', order: 3 },
  { id: 'hr-ga', name: '인사·총무', order: 4 },
  { id: 'logistics-center', name: '물류센터', order: 5 },
  { id: 'sales-operation', name: '판매현장', order: 6 },
  { id: 'finance-team', name: '재무팀', order: 7 },
]

// ── 매핑 config (복수 legacy 스킴 커버, WP1 감사 근거) ───────────────────────────

type LaneMapping = {
  executionDomainId: ExecutionDomainId
  organizationId?: string
  confidence: number
  ambiguous?: boolean
}

/** laneId(정확 일치) → 도메인/조직. state 스킴(조직명) + registry 스킴(도메인명) 모두 포함. */
const LANE_ID_MAPPING: Record<string, LaneMapping> = {
  // state 스킴 — 조직이 명확 (confidence 1.0)
  business: { executionDomainId: 'business', organizationId: 'business-division', confidence: 1.0 },
  partnership: { executionDomainId: 'procurement', organizationId: 'partner-cooperation', confidence: 1.0 },
  'warehouse-easyadmin': { executionDomainId: 'logistics', organizationId: 'logistics-center', confidence: 1.0 },
  'retail-easychain': { executionDomainId: 'sales', organizationId: 'sales-operation', confidence: 1.0 },
  finance: { executionDomainId: 'finance', organizationId: 'finance-team', confidence: 1.0 },
  // state 데이터에서 관찰된 경영혁신 generated lane id (데이터 특정)
  'lane-mr8i71rk-rr7ki': { executionDomainId: 'procurement', organizationId: 'business-innovation', confidence: 1.0 },

  // registry 스킴 — 도메인은 명확하나 조직은 id에 없음 (org undefined → assignment 미생성)
  'lane-purchasing': { executionDomainId: 'procurement', confidence: 0.9 },
  'lane-logistics': { executionDomainId: 'logistics', confidence: 0.9 },
  'lane-warehouse': { executionDomainId: 'logistics', confidence: 0.9 },
  'lane-sales': { executionDomainId: 'sales', confidence: 0.9 },
  'lane-finance': { executionDomainId: 'finance', confidence: 0.9 },

  // 역할·시스템성 lane — business로 하드코딩하지 않음. best-guess + ambiguous(사람 검토 대상)
  'lane-requester': { executionDomainId: 'business', confidence: 0.5, ambiguous: true },
  'lane-erp': { executionDomainId: 'business', confidence: 0.4, ambiguous: true },
}

/** lane.name 키워드 → 도메인/조직 (generated id를 이름으로 보완). */
const LANE_NAME_KEYWORD_MAPPING: Array<{ keyword: string; mapping: LaneMapping }> = [
  { keyword: '경영혁신', mapping: { executionDomainId: 'procurement', organizationId: 'business-innovation', confidence: 0.9 } },
  { keyword: '인사', mapping: { executionDomainId: 'procurement', organizationId: 'hr-ga', confidence: 0.9 } },
  { keyword: '총무', mapping: { executionDomainId: 'procurement', organizationId: 'hr-ga', confidence: 0.9 } },
  { keyword: '상생협력', mapping: { executionDomainId: 'procurement', organizationId: 'partner-cooperation', confidence: 0.9 } },
]

// ── warning / result 타입 ─────────────────────────────────────────────────────

export type MigrationWarningCode =
  | 'UNKNOWN_LANE_SYNTHETIC'
  | 'LEGACY_MAPPING_AMBIGUOUS'
  | 'MULTI_ORG_DOMAIN'
  | 'MISSING_ORG_FOR_LANE'

export type MigrationWarning = {
  code: MigrationWarningCode
  laneId?: string
  processId?: string
  detailProcessGroupId?: string
  executionDomainId?: ExecutionDomainId
  detail?: string
}

export type DomainMappingResult = {
  executionDomainId: ExecutionDomainId
  organizationId?: string
  /** 도메인 매핑 확신도 (0~1). AI Migration에서도 활용. */
  confidence: number
  /** 확신 낮아 사람 후속 검토 필요 */
  ambiguous: boolean
  /** 알 수 없는 lane을 synthetic 도메인으로 보존 */
  synthetic: boolean
  warning?: MigrationWarning
}

/** synthetic 도메인 id 규약 — 알 수 없는 legacy lane 무손실 보존. */
export function syntheticDomainId(laneId: string): ExecutionDomainId {
  return `legacy-${laneId}`
}
export function syntheticOrganizationId(laneId: string): string {
  return `org-${laneId}`
}

// ── 핵심 resolver (idempotent) ─────────────────────────────────────────────────

/**
 * legacy laneId → Execution Domain 매핑 해석.
 * - 이미 canonical 도메인 id 또는 synthetic id면 identity(idempotent, no org, confidence 1).
 * - 정확 일치 매핑 → 그 결과(ambiguous면 LEGACY_MAPPING_AMBIGUOUS warning).
 * - 이름 키워드 매핑(generated id 보완).
 * - 그 외 → synthetic 도메인 + UNKNOWN_LANE_SYNTHETIC warning.
 */
export function resolveDomainMapping(laneId: string, laneName?: string): DomainMappingResult {
  // idempotency: 이미 도메인 id(canonical/synthetic)면 그대로.
  if (CANONICAL_DOMAIN_IDS.has(laneId) && !(laneId in LANE_ID_MAPPING)) {
    return { executionDomainId: laneId, confidence: 1, ambiguous: false, synthetic: false }
  }
  if (laneId.startsWith('legacy-')) {
    return { executionDomainId: laneId, confidence: 1, ambiguous: false, synthetic: true }
  }

  const byId = LANE_ID_MAPPING[laneId]
  if (byId) {
    return {
      executionDomainId: byId.executionDomainId,
      organizationId: byId.organizationId,
      confidence: byId.confidence,
      ambiguous: byId.ambiguous ?? false,
      synthetic: false,
      warning: byId.ambiguous
        ? { code: 'LEGACY_MAPPING_AMBIGUOUS', laneId, executionDomainId: byId.executionDomainId, detail: `confidence=${byId.confidence}` }
        : undefined,
    }
  }

  if (laneName) {
    const kw = LANE_NAME_KEYWORD_MAPPING.find((entry) => laneName.includes(entry.keyword))
    if (kw) {
      return {
        executionDomainId: kw.mapping.executionDomainId,
        organizationId: kw.mapping.organizationId,
        confidence: kw.mapping.confidence,
        ambiguous: kw.mapping.ambiguous ?? false,
        synthetic: false,
      }
    }
  }

  // unknown → synthetic 도메인으로 무손실 보존 + warning
  return {
    executionDomainId: syntheticDomainId(laneId),
    organizationId: syntheticOrganizationId(laneId),
    confidence: 0,
    ambiguous: false,
    synthetic: true,
    warning: { code: 'UNKNOWN_LANE_SYNTHETIC', laneId, executionDomainId: syntheticDomainId(laneId) },
  }
}

// ── Variant(DetailProcessGroup) 단위 조직 배정 추출 ────────────────────────────

export type NodeLaneRef = { id: string; laneId: string; laneName?: string }

export type AssignmentExtraction = {
  /** Variant 기본 배정 (도메인당 대표 조직) */
  assignments: DomainAssignment[]
  /** 대표 조직과 다른 노드의 예외 override */
  nodeOverrides: Array<{ nodeId: string; organizationId: string }>
  warnings: MigrationWarning[]
}

/**
 * 노드 집합에서 도메인별 조직 배정을 추출한다(WP1 §4·§5).
 * - 도메인별로 등장 순서대로 조직 수집(dedupe 없이 순서 보존).
 * - 대표 = 첫 조직 → DomainAssignment.
 * - 대표와 다른 조직의 노드 → nodeOverride + MULTI_ORG_DOMAIN warning(조용히 덮어쓰지 않음).
 * - 조직이 없는 도메인(예: registry 도메인 스킴, 이미 canonical) → 배정 없음.
 * - idempotent: 이미 canonical 도메인(org 없음) 노드는 아무 배정도 만들지 않는다.
 */
export function extractDomainAssignments(
  nodes: NodeLaneRef[],
  resolve: (laneId: string, laneName?: string) => DomainMappingResult = resolveDomainMapping,
): AssignmentExtraction {
  // domainId → [{nodeId, orgId}] (org 있는 것만)
  const byDomain = new Map<ExecutionDomainId, Array<{ nodeId: string; organizationId: string }>>()
  const warnings: MigrationWarning[] = []

  for (const node of nodes) {
    const r = resolve(node.laneId, node.laneName)
    if (r.warning) warnings.push({ ...r.warning })
    if (!r.organizationId) continue
    const list = byDomain.get(r.executionDomainId) ?? []
    list.push({ nodeId: node.id, organizationId: r.organizationId })
    byDomain.set(r.executionDomainId, list)
  }

  const assignments: DomainAssignment[] = []
  const nodeOverrides: Array<{ nodeId: string; organizationId: string }> = []

  for (const [executionDomainId, entries] of byDomain) {
    const defaultOrg = entries[0].organizationId
    assignments.push({ executionDomainId, organizationId: defaultOrg })
    const otherOrgs = new Set<string>()
    for (const entry of entries) {
      if (entry.organizationId !== defaultOrg) {
        nodeOverrides.push({ nodeId: entry.nodeId, organizationId: entry.organizationId })
        otherOrgs.add(entry.organizationId)
      }
    }
    if (otherOrgs.size > 0) {
      warnings.push({
        code: 'MULTI_ORG_DOMAIN',
        executionDomainId,
        detail: `default=${defaultOrg}, others=${[...otherOrgs].join(',')}`,
      })
    }
  }

  return { assignments, nodeOverrides, warnings }
}

// ── V2 → V3 payload 변환 (WP3) ─────────────────────────────────────────────────

type LaneMasterLike = { id: string; name?: string; order?: number }
type NodeLike = {
  id: string
  laneId: string
  organizationId?: string
  interfaceRuleAnchor?: { fromLaneId: string; toLaneId: string }
}
type ZoneLike = { laneIds?: string[] }
type ProcessLike = { id: string; type?: string; nodes: NodeLike[]; zones?: ZoneLike[] }
type GroupLike = { id: string; detailProcessId: string; domainAssignments?: DomainAssignment[] }
type CommonMastersLike = { lanes: LaneMasterLike[]; organizations?: Organization[] }

export type ExecutionDomainMigrationStats = {
  processes: number
  nodesRemapped: number
  assignmentsCreated: number
  nodeOverrides: number
  syntheticDomains: number
}

/** legacy laneId → domain 매핑 시 등장하는 synthetic 도메인/조직을 마스터에 반영하기 위한 누적기. */
function collectSynthetic(
  laneNameById: Map<string, string>,
  syntheticDomains: Map<string, ExecutionDomain>,
  syntheticOrgs: Map<string, Organization>,
  result: DomainMappingResult,
  laneId: string,
): void {
  if (!result.synthetic) return
  if (!syntheticDomains.has(result.executionDomainId)) {
    syntheticDomains.set(result.executionDomainId, {
      id: result.executionDomainId,
      name: laneNameById.get(laneId) ?? laneId,
      order: 100 + syntheticDomains.size,
      ownerDepartment: '',
    })
  }
  if (result.organizationId && !syntheticOrgs.has(result.organizationId)) {
    syntheticOrgs.set(result.organizationId, {
      id: result.organizationId,
      name: laneNameById.get(laneId) ?? laneId,
      order: 100 + syntheticOrgs.size,
    })
  }
}

function remapAnchor(
  anchor: { fromLaneId: string; toLaneId: string } | undefined,
  laneNameById: Map<string, string>,
): { fromLaneId: string; toLaneId: string } | undefined {
  if (!anchor) return undefined
  return {
    fromLaneId: resolveDomainMapping(anchor.fromLaneId, laneNameById.get(anchor.fromLaneId)).executionDomainId,
    toLaneId: resolveDomainMapping(anchor.toLaneId, laneNameById.get(anchor.toLaneId)).executionDomainId,
  }
}

/** zone.laneIds → 도메인 remap(+dedupe). 값 변화가 없으면 원본 참조를 그대로 반환(idempotent 안정). */
function remapZones<Z extends ZoneLike>(zones: Z[] | undefined, laneNameById: Map<string, string>): Z[] | undefined {
  if (!zones) return undefined
  let changed = false
  const next = zones.map((zone) => {
    if (!zone.laneIds) return zone
    const mapped = [...new Set(zone.laneIds.map((id) => resolveDomainMapping(id, laneNameById.get(id)).executionDomainId))]
    if (mapped.length === zone.laneIds.length && mapped.every((v, i) => v === zone.laneIds![i])) return zone
    changed = true
    return { ...zone, laneIds: mapped }
  })
  return changed ? next : zones
}

/**
 * legacy commonMasters.lanes(조직/혼합 스킴) → Execution Domain 마스터 + Organization 마스터.
 * canonical 5 도메인은 항상 포함(Overview 안정), synthetic은 append.
 */
function buildDomainMasters(
  syntheticDomains: Map<string, ExecutionDomain>,
  syntheticOrgs: Map<string, Organization>,
): { executionDomains: ExecutionDomain[]; organizations: Organization[] } {
  return {
    executionDomains: [...CANONICAL_EXECUTION_DOMAINS.map((d) => ({ ...d })), ...syntheticDomains.values()],
    organizations: [...CANONICAL_ORGANIZATIONS.map((o) => ({ ...o })), ...syntheticOrgs.values()],
  }
}

/**
 * V2 → V3 순수 변환 (WP3). idempotent 안전: 이미 canonical 도메인이면 remap은 no-op이고,
 * group.domainAssignments가 이미 있으면 재추출로 덮어쓰지 않는다.
 * - node.laneId(legacy) → canonical Execution Domain id
 * - DetailProcessGroup.domainAssignments 생성(없을 때만) + conflict node.organizationId override
 * - unknown lane → synthetic domain, anchor/zone lane 참조 변환
 * - commonMasters.lanes → Execution Domain 마스터, organizations 신설
 */
export function migrateExecutionDomains<
  P extends ProcessLike,
  G extends GroupLike,
  C extends CommonMastersLike,
>(input: { commonMasters: C; processes: P[]; detailProcessGroups?: G[] }): {
  commonMasters: C & { lanes: ExecutionDomain[]; organizations: Organization[] }
  processes: P[]
  detailProcessGroups: G[]
  warnings: MigrationWarning[]
  stats: ExecutionDomainMigrationStats
} {
  const laneNameById = new Map(input.commonMasters.lanes.map((l) => [l.id, l.name ?? l.id]))
  const groups = (input.detailProcessGroups ?? []).map((g) => ({ ...g }))
  const groupByProcessId = new Map(groups.map((g) => [g.detailProcessId, g]))
  const warnings: MigrationWarning[] = []
  const syntheticDomains = new Map<string, ExecutionDomain>()
  const syntheticOrgs = new Map<string, Organization>()
  const stats: ExecutionDomainMigrationStats = {
    processes: 0,
    nodesRemapped: 0,
    assignmentsCreated: 0,
    nodeOverrides: 0,
    syntheticDomains: 0,
  }

  const processes = input.processes.map((process) => {
    stats.processes += 1
    // (a) 배정 추출은 legacy laneId 기준 — remap 이전에 수행
    const extraction = extractDomainAssignments(
      process.nodes.map((n) => ({ id: n.id, laneId: n.laneId, laneName: laneNameById.get(n.laneId) })),
    )
    const overrideByNode = new Map(extraction.nodeOverrides.map((o) => [o.nodeId, o.organizationId]))
    for (const w of extraction.warnings) warnings.push({ ...w, processId: process.id })

    // (b) node.laneId remap + synthetic 수집 + anchor + override
    const nodes = process.nodes.map((node) => {
      const r = resolveDomainMapping(node.laneId, laneNameById.get(node.laneId))
      collectSynthetic(laneNameById, syntheticDomains, syntheticOrgs, r, node.laneId)
      if (node.laneId !== r.executionDomainId) stats.nodesRemapped += 1
      const override = overrideByNode.get(node.id)
      return {
        ...node,
        laneId: r.executionDomainId,
        ...(override ? { organizationId: override } : {}),
        ...(node.interfaceRuleAnchor ? { interfaceRuleAnchor: remapAnchor(node.interfaceRuleAnchor, laneNameById) } : {}),
      }
    })
    stats.nodeOverrides += extraction.nodeOverrides.length

    // (c) 배정을 group에 부착 — 없을 때만(idempotent). group 없으면 warning(Process fallback은 후속)
    if (extraction.assignments.length > 0) {
      const group = groupByProcessId.get(process.id)
      if (group) {
        if (!group.domainAssignments || group.domainAssignments.length === 0) {
          group.domainAssignments = extraction.assignments
          stats.assignmentsCreated += extraction.assignments.length
        }
      } else if (process.type !== 'overview') {
        warnings.push({
          code: 'MISSING_ORG_FOR_LANE',
          processId: process.id,
          detail: 'group 없는 detail process — Process-level fallback assignment 필요(후속 WP)',
        })
      }
    }

    return { ...process, nodes, zones: remapZones(process.zones, laneNameById) }
  })

  stats.syntheticDomains = syntheticDomains.size
  const { executionDomains, organizations } = buildDomainMasters(syntheticDomains, syntheticOrgs)
  const commonMasters = { ...input.commonMasters, lanes: executionDomains, organizations }

  return { commonMasters, processes, detailProcessGroups: groups, warnings, stats }
}

/**
 * hydrate(registry sync) 직후 idempotent 정규화 — registry가 legacy laneId를 재주입해도
 * node.laneId를 canonical 도메인으로 다시 수렴시킨다(WP3 §8). 배정은 group 소유라 건드리지 않는다.
 */
export function normalizeExecutionDomains<P extends ProcessLike>(
  processes: P[],
  laneNameById: Map<string, string> = new Map(),
): { processes: P[]; changed: boolean } {
  let changed = false
  const next = processes.map((process) => {
    let procChanged = false
    const nodes = process.nodes.map((node) => {
      const domainId = resolveDomainMapping(node.laneId, laneNameById.get(node.laneId)).executionDomainId
      // anchor는 값 기준으로만 변경 판단(참조 새로 생겨도 값 같으면 no-op)
      let anchor = node.interfaceRuleAnchor
      let anchorChanged = false
      if (anchor) {
        const remapped = remapAnchor(anchor, laneNameById)!
        if (remapped.fromLaneId !== anchor.fromLaneId || remapped.toLaneId !== anchor.toLaneId) {
          anchor = remapped
          anchorChanged = true
        }
      }
      if (domainId === node.laneId && !anchorChanged) return node
      procChanged = true
      return { ...node, laneId: domainId, ...(anchorChanged ? { interfaceRuleAnchor: anchor } : {}) }
    })
    const zones = remapZones(process.zones, laneNameById)
    if (!procChanged && zones === process.zones) return process
    changed = true
    return { ...process, nodes, zones }
  })
  return { processes: next, changed }
}

// ── 참조 무결성 검증 (WP3 §11) ──────────────────────────────────────────────────

export type IntegrityResult = {
  ok: boolean
  danglingDomainRefs: string[]
  danglingOrgRefs: string[]
}

export function validateExecutionDomainIntegrity(input: {
  commonMasters: CommonMastersLike
  processes: ProcessLike[]
  detailProcessGroups?: GroupLike[]
}): IntegrityResult {
  const domainIds = new Set(input.commonMasters.lanes.map((l) => l.id))
  const orgIds = new Set((input.commonMasters.organizations ?? []).map((o) => o.id))
  const danglingDomainRefs: string[] = []
  const danglingOrgRefs: string[] = []

  for (const process of input.processes) {
    for (const node of process.nodes) {
      if (!domainIds.has(node.laneId)) danglingDomainRefs.push(`${process.id}:${node.id}:${node.laneId}`)
      if (node.organizationId && !orgIds.has(node.organizationId)) {
        danglingOrgRefs.push(`${process.id}:${node.id}:${node.organizationId}`)
      }
      if (node.interfaceRuleAnchor) {
        for (const ref of [node.interfaceRuleAnchor.fromLaneId, node.interfaceRuleAnchor.toLaneId]) {
          if (!domainIds.has(ref)) danglingDomainRefs.push(`${process.id}:${node.id}:anchor:${ref}`)
        }
      }
    }
    for (const zone of process.zones ?? []) {
      for (const ref of zone.laneIds ?? []) {
        if (!domainIds.has(ref)) danglingDomainRefs.push(`${process.id}:zone:${ref}`)
      }
    }
  }
  for (const group of input.detailProcessGroups ?? []) {
    for (const a of group.domainAssignments ?? []) {
      if (!domainIds.has(a.executionDomainId)) danglingDomainRefs.push(`${group.id}:assign:${a.executionDomainId}`)
      if (!orgIds.has(a.organizationId)) danglingOrgRefs.push(`${group.id}:assign:${a.organizationId}`)
    }
  }

  return {
    ok: danglingDomainRefs.length === 0 && danglingOrgRefs.length === 0,
    danglingDomainRefs,
    danglingOrgRefs,
  }
}
