import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useProcessDataStore } from '../../data/processDataStore'
import { getActiveProcessData, resolveDetailProcessesForMenu } from '../../data/activeProcessData'
import { getDetailProcessById, getDetailProcessGroupById, getOverviewProcessGroupById, toBeNavigator } from '../../data/toBeNavigatorRegistry'
import { readUiPreferences, writeUiPreferences } from '../../data/uiPreferences'
import { getLifecycleGroupForDetailProcess } from '../../data/processLifecycleGroups'
import { APP_CONFIG } from '../../config/appConfig'
import { canDeleteLane } from '../../lib/editor/processEditor'
import { panelEventShieldProps, usePanelNativeEventShield } from '../../lib/ui/panelEventShield'
import {
  buildNewEdgeSelection,
  buildNewDetailProcessGroupSelection,
  buildNewLaneSelection,
  buildNewNodeSelection,
  buildNewProcessGroupSelection,
  buildNewZoneSelection,
  buildSelectedDetailProcessGroup,
  buildSelectedEdge,
  buildSelectedNode,
  buildSelectedProcessGroup,
  buildSelectedZone,
  cloneEdgeData,
  cloneLaneData,
  cloneNodeData,
  cloneProcessGroup,
  cloneDetailProcessGroup,
  cloneZoneData,
  refreshSelectedElement,
} from '../../lib/editor/selectedElement'
import {
  isNodeInProcessGroup,
  resolveFocusEdgeIdsForNode,
  resolveProcessGroupEdgeIds,
  resolveRelatedNodeIdsForFocus,
  setProcessGroupNodeMembership,
} from '../../lib/editor/processGroupMembership'
import { withEdgeHandleDefaults } from '../../lib/editor/edgeHandles'
import { applyRoutedHandlePatch, type RoutedHandlePatch } from '../../lib/editor/routedEdgeSync'
import { normalizeEdgeForStorage } from '../../lib/editor/edgeUpdate'
import {
  validateRouterData,
  type RouterValidationIssue,
  type RouterValidationReport,
} from '../../lib/editor/routerValidation'
import { selectedElementToObject } from '../../lib/editor/selectionManager'
import {
  isEditableShortcutTarget,
  isShortcutEvent,
} from '../../lib/editor/shortcutManager'
import { type ClipboardPayload } from '../../clipboard'
import {
  createCommandDispatcher,
  createCommandRegistry,
  editorCommands,
  type CommandContext,
} from '../../commands'
import {
  createSelectionManager,
  edgeSelectionItems,
  nodeSelectionItems,
  type SelectionChangeOptions,
  type SelectionSnapshot,
} from '../../selection'
import type { AppMode, SelectedElement } from '../../lib/editor/selectionTypes'
import type { OverviewHighlight, OverviewHighlightMode, ViewMode } from '../../lib/editor/viewModeTypes'
import type { Edge, Lane, Node, Process, ProcessZone } from '../../types/process'
import type { ProcessScope } from '../../types/processData'
import { getOverviewProcess, resolveDetailProcessGroups, resolveOverviewProcessGroups } from '../../types/processData'
import type { DetailProcessGroup, OverviewProcessGroup } from '../../types/toBeNavigator'
import {
  buildDisplayProcess,
} from '../../lib/nodeVisibility'
import { resolveNodeDetailProcessIds } from '../../data/overviewDetailProcesses'
import { resolveOverviewNodeType } from '../../lib/overviewNodeDisplay'
import { DataStatusBar } from './DataStatusBar'
import { Drawer } from './Drawer'
import { ProcessGroupMenu } from './ProcessGroupMenu'
import { RouterHealthDashboard } from './RouterHealthDashboard'
import { Toolbar } from './Toolbar'
import { ProcessMapCanvas } from '../process-map/ProcessMapCanvas'
import { PropertyPanel } from '../editor/PropertyPanel'
import { ProcessCanvasContainer, PROPERTY_PANEL_WIDTH } from './ProcessCanvasContainer'
import '../layout/node-detail.css'
import './layout.css'

const editorCommandRegistry = createCommandRegistry(editorCommands)

function pushShortcutDebug(event: string, payload: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  const target = globalThis as typeof globalThis & {
    __PROCESS_NAV_DEBUG__?: Array<Record<string, unknown>>
  }
  const entry = {
    source: 'AppLayout',
    event,
    at: new Date().toISOString(),
    ...payload,
  }
  target.__PROCESS_NAV_DEBUG__ = [...(target.__PROCESS_NAV_DEBUG__ ?? []), entry].slice(-100)
}

function describeShortcutTarget(target: EventTarget | null): Record<string, unknown> {
  const element = target as HTMLElement | null
  return {
    tag: element?.tagName ?? null,
    className: element?.getAttribute('class') ?? null,
    role: element?.getAttribute('role') ?? null,
  }
}

type SaveReportToast = {
  id: number
  kind: 'success' | 'warning' | 'error'
  title: string
  summary: string
  issues: RouterValidationIssue[]
}

const ROUTER_ISSUE_LABELS: Record<string, string> = {
  'manual-handle-auto': '수동 라우팅과 자동 handle 충돌 정리',
  'auto-edge-bend-points': '자동 연결선의 legacy bendPoints 제거',
  'auto-edge-points': '자동 연결선의 legacy points 제거',
  'invalid-routing-point': '유효하지 않은 routing point 정리',
  'detail-offset': '위치 보정값 확인',
  'invalid-handle': '유효하지 않은 연결면 자동 수정',
  'invalid-cell-slot': '유효하지 않은 행/열 위치 보정',
  'broken-edge': '깨진 연결선',
  'orphan-bend': '연결 대상 없는 bend point',
}

function issueTitle(issue: RouterValidationIssue): string {
  return ROUTER_ISSUE_LABELS[issue.code] ?? issue.code
}

function issueDetail(issue: RouterValidationIssue): string {
  const target = issue.edgeId ? `edge ${issue.edgeId}` : issue.nodeId ? `node ${issue.nodeId}` : ''
  return [issue.processName, target, issue.fix ?? issue.message].filter(Boolean).join(' · ')
}

function buildSaveReportToast(report: RouterValidationReport | undefined, ok: boolean, error?: string): SaveReportToast {
  const issues = report?.issues ?? []
  const errors = issues.filter((issue) => issue.severity === 'error')
  const fixed = issues.filter((issue) => issue.severity === 'fixed')
  const warnings = issues.filter((issue) => issue.severity === 'warning')
  if (!ok) {
    return {
      id: Date.now(),
      kind: 'error',
      title: '저장 실패',
      summary: errors.length > 0
        ? `치명 오류 ${errors.length}건이 있어 저장하지 않았습니다.`
        : error ?? '저장하지 않았습니다.',
      issues: errors.length > 0 ? errors : issues,
    }
  }
  return {
    id: Date.now(),
    kind: warnings.length > 0 ? 'warning' : 'success',
    title: '저장 완료',
    summary: `자동 보정 ${fixed.length}건${warnings.length > 0 ? ` · 경고 ${warnings.length}건` : ''}`,
    issues: [...fixed, ...warnings],
  }
}

function buildOpenRouterCheckToast(processName: string, issues: RouterValidationIssue[]): SaveReportToast {
  const errors = issues.filter((issue) => issue.severity === 'error')
  const warnings = issues.filter((issue) => issue.severity !== 'error')
  return {
    id: Date.now(),
    kind: errors.length > 0 ? 'error' : 'warning',
    title: 'Router Check',
    summary: `${processName} · 오류 ${errors.length}건 · 경고 ${warnings.length}건`,
    issues,
  }
}

function resolveHighlightMode(
  selectedGroupId: string | null,
  relatedOnly: boolean,
): OverviewHighlightMode {
  if (!selectedGroupId) return 'all'
  return relatedOnly ? 'filter' : 'dim'
}

export function AppLayout() {
  const store = useProcessDataStore()
  const { processData, summary, saveStatus, persistAll } = store
  const viewerOnly = APP_CONFIG.deployment.viewerOnly
  const propertyPanelRef = useRef<HTMLElement>(null)
  usePanelNativeEventShield(propertyPanelRef)

  const [isLeftOpen, setIsLeftOpen] = useState(false)
  const [isRightOpen, setIsRightOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(() => readUiPreferences().viewMode ?? 'overview')
  const [appMode, setAppMode] = useState<AppMode>('view')
  const [reviewMode, setReviewMode] = useState(false)
  const [showNodeNumbers, setShowNodeNumbers] = useState(true)
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([])
  const [nodeClipboard, setNodeClipboard] = useState<ClipboardPayload | null>(null)
  const [renderSyncRevision, setRenderSyncRevision] = useState(0)
  const [saveReportToast, setSaveReportToast] = useState<SaveReportToast | null>(null)
  const selectionManagerRef = useRef(createSelectionManager())
  const openRouterCheckKeyRef = useRef('')

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [relatedOnly, setRelatedOnly] = useState(false)
  const [detailCloneNotice, setDetailCloneNotice] = useState<string | null>(null)
  const [overviewHomeKey, setOverviewHomeKey] = useState(0)
  const [detailProcessId, setDetailProcessId] = useState<string>(() =>
    readUiPreferences().detailProcessId
      ?? toBeNavigator.detailProcessGroups[0]?.detailProcessId
      ?? toBeNavigator.detailProcesses[0]?.id
      ?? '',
  )

  const activeScope: ProcessScope = viewMode === 'overview' ? 'overview' : detailProcessId

  const applySelectionSnapshot = useCallback((snapshot: SelectionSnapshot) => {
    setSelectedNodeIds(snapshot.items.filter((item) => item.type === 'node').map((item) => item.id))
    setSelectedEdgeIds(snapshot.items.filter((item) => item.type === 'edge').map((item) => item.id))
  }, [])

  const setNodeSelection = useCallback(
    (nodeIds: string[], options?: SelectionChangeOptions) => {
      const items = nodeSelectionItems(nodeIds)
      const snapshot = options?.toggle
        ? selectionManagerRef.current.toggleSelection(items, options)
        : options?.additive || options?.range
          ? selectionManagerRef.current.addSelection(items, options)
          : selectionManagerRef.current.setSelection(items, options)
      applySelectionSnapshot(snapshot)
      return {
        snapshot,
        nodeIds: snapshot.items.filter((item) => item.type === 'node').map((item) => item.id),
        primaryNodeId: snapshot.primary?.type === 'node' ? snapshot.primary.id : null,
      }
    },
    [applySelectionSnapshot],
  )

  const setEdgeSelection = useCallback(
    (edgeIds: string[], options?: SelectionChangeOptions) => {
      const items = edgeSelectionItems(edgeIds)
      const snapshot = options?.toggle
        ? selectionManagerRef.current.toggleSelection(items, options)
        : options?.additive || options?.range
          ? selectionManagerRef.current.addSelection(items, options)
          : selectionManagerRef.current.setSelection(items, options)
      applySelectionSnapshot(snapshot)
      return {
        snapshot,
        edgeIds: snapshot.items.filter((item) => item.type === 'edge').map((item) => item.id),
        primaryEdgeId: snapshot.primary?.type === 'edge' ? snapshot.primary.id : null,
      }
    },
    [applySelectionSnapshot],
  )

  useEffect(() => {
    if (viewMode === 'detail' && detailProcessId) {
      store.ensureDetailProcess(detailProcessId)
    }
  }, [viewMode, detailProcessId, store])

  const activeProcess = useMemo((): Process => {
    const fromStore = getActiveProcessData(processData, viewMode, detailProcessId)
    if (fromStore) return fromStore
    if (viewMode === 'detail') {
      return (
        getDetailProcessById(detailProcessId)
        ?? toBeNavigator.detailProcesses[0]
        ?? getOverviewProcess(processData)
        ?? toBeNavigator.overview
      )
    }
    return getOverviewProcess(processData) ?? toBeNavigator.overview
  }, [viewMode, detailProcessId, processData])

  const displayProcess = useMemo(
    () => buildDisplayProcess(activeProcess, 'system'),
    [activeProcess],
  )

  /** 편집 모드에서는 system-only 노드(interface-rule 등)도 캔버스에 표시 */
  const canvasProcess = useMemo(
    () => (appMode === 'edit' ? activeProcess : displayProcess),
    [appMode, activeProcess, displayProcess],
  )

  const reviewSummary = useMemo(() => {
    const reviewableNodes = canvasProcess.nodes.filter(
      (node) => node.type !== 'phase-connector' && node.type !== 'merge' && node.type !== 'connector',
    )
    const ok = reviewableNodes.filter((node) => node.review?.status === 'ok').length
    const reviewRequired = reviewableNodes.filter((node) => node.review?.status === 'review-required').length
    const notReviewed = reviewableNodes.length - ok - reviewRequired
    return {
      total: reviewableNodes.length,
      ok,
      reviewRequired,
      notReviewed,
      ready: reviewableNodes.length > 0 && reviewRequired === 0 && notReviewed === 0,
    }
  }, [canvasProcess.nodes])

  const allDetailProcesses = useMemo(
    () => resolveDetailProcessesForMenu(processData, toBeNavigator.detailProcesses),
    [processData],
  )

  const overviewProcessGroups = useMemo(
    () => resolveOverviewProcessGroups(processData, toBeNavigator.overviewProcessGroups),
    [processData],
  )

  const detailProcessGroups = useMemo(
    () => resolveDetailProcessGroups(processData, toBeNavigator.detailProcessGroups),
    [processData],
  )

  const resolveLinkedDetailProcessId = useCallback(
    (group: OverviewProcessGroup) => {
      if (!group.linkedDetailGroupId) return undefined
      const linked =
        detailProcessGroups.find((entry) => entry.id === group.linkedDetailGroupId)
        ?? getDetailProcessGroupById(group.linkedDetailGroupId)
      return linked?.detailProcessId
    },
    [detailProcessGroups],
  )

  const savedSelectedOverviewGroup = selectedGroupId
    ? overviewProcessGroups.find((group) => group.id === selectedGroupId)
    : undefined

  const savedSelectedDetailGroup = selectedGroupId
    ? detailProcessGroups.find((group) => group.id === selectedGroupId)
    : undefined

  /** 패널 draft 멤버십을 캔버스 하이라이트에 즉시 반영 */
  const highlightGroup = useMemo((): OverviewProcessGroup | undefined => {
    if (viewMode !== 'overview' || !selectedGroupId) return undefined
    if (
      selectedElement?.type === 'process-group' &&
      selectedElement.id === selectedGroupId
    ) {
      return selectedElement.data
    }
    return savedSelectedOverviewGroup
  }, [viewMode, selectedGroupId, selectedElement, savedSelectedOverviewGroup])

  const focusNodeId = useMemo(() => {
    if (viewMode !== 'overview' || !highlightGroup || selectedElement?.type !== 'node') return null
    if (!highlightGroup.overviewNodeIds.includes(selectedElement.id)) return null
    return selectedElement.id
  }, [viewMode, highlightGroup, selectedElement])

  const overviewHighlight = useMemo((): OverviewHighlight | null => {
    if (viewMode !== 'overview') return null
    const mode = resolveHighlightMode(selectedGroupId, relatedOnly)
    if (mode === 'all') {
      return { groupId: null, nodeIds: new Set(), edgeIds: new Set(), mode: 'all' }
    }
    if (!highlightGroup) {
      return { groupId: null, nodeIds: new Set(), edgeIds: new Set(), mode: 'all' }
    }
    const overview = getOverviewProcess(processData)
    const edgeIds = overview
      ? resolveProcessGroupEdgeIds(highlightGroup, overview.edges)
      : highlightGroup.overviewEdgeIds
    const base: OverviewHighlight = {
      groupId: highlightGroup.id,
      nodeIds: new Set(highlightGroup.overviewNodeIds),
      edgeIds: new Set(edgeIds),
      mode,
    }
    if (!focusNodeId) return base
    const focusEdgeIds = overview
      ? resolveFocusEdgeIdsForNode(highlightGroup, focusNodeId, overview.edges)
      : new Set<string>()
    const focusNodeIds = overview
      ? resolveRelatedNodeIdsForFocus(
          focusNodeId,
          focusEdgeIds,
          overview.edges,
          new Set(highlightGroup.overviewNodeIds),
        )
      : new Set<string>([focusNodeId])
    return { ...base, focusNodeId, focusEdgeIds, focusNodeIds }
  }, [viewMode, selectedGroupId, relatedOnly, highlightGroup, focusNodeId, processData])

  const detailHeader = useMemo(() => {
    if (viewMode === 'overview') return null
    const detailGroup = detailProcessGroups.find((group) => group.detailProcessId === activeProcess.id)
    const lifecycleGroup = getLifecycleGroupForDetailProcess(activeProcess.id)
    return {
      breadcrumbs: [APP_CONFIG.processRootLabel, lifecycleGroup.label],
      processLabel: '',
      title: detailGroup?.name ?? activeProcess.name,
    }
  }, [viewMode, activeProcess, detailProcessGroups])

  useEffect(() => {
    setSelectedElement(null)
    applySelectionSnapshot(selectionManagerRef.current.clearSelection({ source: 'programmatic' }))
  }, [viewMode, detailProcessId, applySelectionSnapshot])

  useEffect(() => {
    setSelectedElement((prev) =>
      refreshSelectedElement(prev, activeProcess, overviewProcessGroups, detailProcessGroups),
    )
  }, [activeProcess, overviewProcessGroups, detailProcessGroups])

  useEffect(() => {
    writeUiPreferences({
      viewMode,
      detailProcessId,
      selectedGroupId,
      isLeftOpen,
      isRightOpen,
      appMode,
    })
  }, [viewMode, detailProcessId, selectedGroupId, isLeftOpen, isRightOpen, appMode])

  useEffect(() => {
    if (appMode !== 'edit') return
    const key = `${viewMode}:${activeProcess.id}`
    if (openRouterCheckKeyRef.current === key) return
    openRouterCheckKeyRef.current = key
    const report = validateRouterData(processData, { autofix: false }).report
    const processIssues = report.issues.filter((issue) => issue.processId === activeProcess.id)
    if (processIssues.length === 0) return
    setSaveReportToast(buildOpenRouterCheckToast(activeProcess.name, processIssues))
  }, [activeProcess.id, activeProcess.name, appMode, processData, viewMode])

  useEffect(() => {
    if (!saveReportToast) return
    if (saveReportToast.kind === 'error') return
    const delay = saveReportToast.kind === 'warning' ? 3000 : 1000
    const timeout = window.setTimeout(() => {
      setSaveReportToast((current) => (current?.id === saveReportToast.id ? null : current))
    }, delay)
    return () => window.clearTimeout(timeout)
  }, [saveReportToast])


  const handleOpenDetailProcess = useCallback((processId: string) => {
    store.ensureDetailProcess(processId)
    setDetailProcessId(processId)
    setViewMode('detail')
    setIsLeftOpen(false)
    setSelectedElement(null)
    setIsRightOpen(false)
    const group =
      detailProcessGroups.find((entry) => entry.detailProcessId === processId)
      ?? toBeNavigator.detailProcessGroups.find((entry) => entry.detailProcessId === processId)
    setSelectedGroupId(group?.id ?? null)
  }, [store, detailProcessGroups])

  const handleOpenDetailFromOverview = useCallback(
    (groupId: string) => {
      const group =
        overviewProcessGroups.find((entry) => entry.id === groupId)
        ?? getOverviewProcessGroupById(groupId)
      if (!group?.linkedDetailGroupId) return
      const linked =
        detailProcessGroups.find((entry) => entry.id === group.linkedDetailGroupId)
        ?? getDetailProcessGroupById(group.linkedDetailGroupId)
      if (!linked) return
      setSelectedGroupId(linked.id)
      handleOpenDetailProcess(linked.detailProcessId)
    },
    [overviewProcessGroups, detailProcessGroups, handleOpenDetailProcess],
  )

  const handleOpenDetailFromDetailMenu = useCallback(
    (groupId: string) => {
      const group =
        detailProcessGroups.find((entry) => entry.id === groupId)
        ?? getDetailProcessGroupById(groupId)
      if (!group) return
      setDetailCloneNotice(null)
      setSelectedGroupId(group.id)
      handleOpenDetailProcess(group.detailProcessId)
    },
    [detailProcessGroups, handleOpenDetailProcess],
  )

  const handleSelectOverviewGroup = useCallback(
    (groupId: string | null) => {
      setSelectedGroupId(groupId)
      if (!groupId) {
        setSelectedElement(null)
        return
      }
      const group = overviewProcessGroups.find((entry) => entry.id === groupId)
      if (group) {
        setSelectedElement(buildSelectedProcessGroup(group))
        setIsRightOpen(appMode === 'edit')
      }
    },
    [appMode, overviewProcessGroups],
  )

  const handleSelectElement = useCallback(
    (next: SelectedElement | null) => {
      if (
        viewMode === 'overview' &&
        appMode === 'edit' &&
        next?.type === 'node' &&
        (selectedElement?.type === 'process-group' || selectedElement?.type === 'new-process-group')
      ) {
        const node = activeProcess.nodes.find((entry) => entry.id === next.id)
        if (!node || node.type === 'phase-connector' || node.type === 'merge') return
        const include = !isNodeInProcessGroup(selectedElement.data, node.id)
        const group = setProcessGroupNodeMembership(
          selectedElement.data,
          node.id,
          include,
          activeProcess.edges,
        )
        setSelectedElement({
          type: selectedElement.type,
          id: selectedElement.id,
          data: cloneProcessGroup(group),
        })
        if (selectedElement.type === 'process-group') setSelectedGroupId(group.id)
        setIsRightOpen(true)
        return
      }

      if (viewMode === 'overview' && appMode === 'view' && next?.type === 'node') {
        const node = activeProcess.nodes.find((entry) => entry.id === next.id)
        if (node && resolveOverviewNodeType(node) === 'linked-process') {
          const detailIds = resolveNodeDetailProcessIds(node)
          if (detailIds.length === 1) {
            handleOpenDetailProcess(detailIds[0])
            return
          }
        }
      }
      setSelectedElement(next)
      if (next) setIsRightOpen(true)
    },
    [viewMode, appMode, selectedElement, activeProcess.nodes, activeProcess.edges, handleOpenDetailProcess],
  )

  const handleClearSelection = useCallback(() => {
    setSelectedElement(null)
    applySelectionSnapshot(selectionManagerRef.current.clearSelection({ source: 'canvas' }))
  }, [applySelectionSnapshot])

  const handleCanvasPaneBodyClick = useCallback(() => {
    if (
      viewMode === 'overview' &&
      (selectedGroupId || selectedElement?.type === 'process-group' || selectedElement?.type === 'new-process-group')
    ) {
      setIsLeftOpen(false)
      setIsRightOpen(false)
    }
  }, [selectedElement, selectedGroupId, viewMode])

  const clearCommandSelection = useCallback(
    (options?: SelectionChangeOptions) => {
      applySelectionSnapshot(selectionManagerRef.current.clearSelection(options))
    },
    [applySelectionSnapshot],
  )

  const commandContext = useMemo<CommandContext>(
    () => ({
      appMode,
      viewMode,
      activeProcess,
      activeScope,
      selectedElement,
      selectedNodeIds,
      selectedEdgeIds,
      selectionManager: selectionManagerRef.current,
      clipboard: {
        get: () => nodeClipboard,
        set: setNodeClipboard,
      },
      store,
      setNodeSelection,
      clearSelection: clearCommandSelection,
      selectNode: (node) => {
        setSelectedElement({ type: 'node', id: node.id, data: cloneNodeData(node) })
      },
      clearSelectedElement: () => setSelectedElement(null),
      openPropertyPanel: () => setIsRightOpen(true),
    }),
    [
      appMode,
      viewMode,
      activeProcess,
      activeScope,
      selectedElement,
      selectedNodeIds,
      selectedEdgeIds,
      nodeClipboard,
      store,
      setNodeSelection,
      clearCommandSelection,
    ],
  )

  const commandDispatcher = useMemo(
    () => createCommandDispatcher(editorCommandRegistry, () => commandContext),
    [commandContext],
  )

  const handleCopyNodes = useCallback(
    (explicitNodeIds?: string[]) => {
      return commandDispatcher.execute(
        'copyNodes',
        explicitNodeIds?.length ? { nodeIds: explicitNodeIds } : undefined,
      )
    },
    [commandDispatcher],
  )

  const handlePasteNodes = useCallback(
    () => commandDispatcher.execute('pasteNodes'),
    [commandDispatcher],
  )

  const handleCanvasNodeSelectionChange = useCallback(
    (nodeIds: string[], options?: SelectionChangeOptions) => {
      setNodeSelection(nodeIds, options)
    },
    [setNodeSelection],
  )

  const handleCanvasEdgeSelectionChange = useCallback(
    (edgeIds: string[], options?: SelectionChangeOptions) => {
      setEdgeSelection(edgeIds, options)
    },
    [setEdgeSelection],
  )

  const handleDuplicateNodes = useCallback(
    (explicitNodeIds?: string[]) => {
      return commandDispatcher.execute(
        'duplicateNodes',
        explicitNodeIds?.length ? { nodeIds: explicitNodeIds } : undefined,
      )
    },
    [commandDispatcher],
  )

  const handleCopySelection = useCallback(() => {
    return handleCopyNodes()
  }, [handleCopyNodes])

  const handlePasteSelection = useCallback(() => {
    return handlePasteNodes()
  }, [handlePasteNodes])

  const handleSelectAllNodes = useCallback(() => {
    if (activeProcess.nodes.length === 0) return false
    const ids = activeProcess.nodes.map((node) => node.id)
    setNodeSelection(ids, { source: 'shortcut' })
    const first = activeProcess.nodes[0]
    setSelectedElement({ type: 'node', id: first.id, data: cloneNodeData(first) })
    setIsRightOpen(true)
    return true
  }, [activeProcess.nodes, setNodeSelection])

  const handleStartNew = useCallback(
    (kind: 'new-node' | 'new-edge' | 'new-lane' | 'new-zone', laneId?: string | null) => {
      if (viewerOnly) return
      setAppMode('edit')
      if (kind === 'new-node') handleSelectElement(buildNewNodeSelection(activeProcess, laneId ?? undefined))
      if (kind === 'new-edge') handleSelectElement(buildNewEdgeSelection(activeProcess))
      if (kind === 'new-lane') handleSelectElement(buildNewLaneSelection(activeProcess))
      if (kind === 'new-zone') handleSelectElement(buildNewZoneSelection())
    },
    [activeProcess, handleSelectElement, viewerOnly],
  )

  const handleAppModeChange = (mode: AppMode) => {
    if (viewerOnly) {
      setAppMode('view')
      setReviewMode(false)
      setIsRightOpen(false)
      setSelectedElement(null)
      return
    }
    setAppMode(mode)
    if (mode === 'view') {
      setIsRightOpen(false)
      setSelectedElement(null)
    }
  }

  const handleRequestEditMode = useCallback(() => {
    if (viewerOnly) return
    setAppMode('edit')
  }, [viewerOnly])

  const handleConnectEdge = useCallback(
    (edge: Edge) => {
      store.connectEdge(activeScope, edge)
      handleSelectElement({ type: 'edge', id: edge.id, data: cloneEdgeData(edge) })
    },
    [store, activeScope, handleSelectElement],
  )

  const handleNodePlacementChange = useCallback(
    (nodeId: string, patch: Partial<Node>) => {
      store.updateNode(activeScope, nodeId, patch)
    },
    [store, activeScope],
  )

  const handleNodePlacementChanges = useCallback(
    (patches: Array<{ nodeId: string; patch: Partial<Node> }>) => {
      if (patches.length === 0) return
      store.updateNodes(activeScope, patches)
    },
    [store, activeScope],
  )

  const handleSaveNode = (node: Node, isNew: boolean) => {
    const savedProcess = store.saveNode(activeScope, node, isNew)
    const savedNode = savedProcess?.nodes.find((entry) => entry.id === node.id)
    setSelectedElement({
      type: 'node',
      id: node.id,
      data: cloneNodeData(savedNode ?? node),
    })
    setIsRightOpen(true)
  }

  const handleEdgeRoutingChange = useCallback(
    (edgeId: string, routing: Edge['routing']) => {
      const patch: Partial<Edge> = { routing: routing ?? { mode: 'auto' } }
      if (routing?.mode === 'manual') {
        patch.manualRoute = true
        if (routing.points?.length) {
          patch.bendPoints = routing.points.map((point) => ({ ...point }))
          patch.points = routing.points.map((point) => ({ ...point }))
        }
      } else if (routing?.mode === 'auto') {
        patch.manualRoute = false
        patch.bendPoints = undefined
        patch.points = undefined
      }
      store.updateEdge(activeScope, edgeId, patch)
    },
    [store, activeScope],
  )

  const handleEdgeLabelPlacementChange = useCallback(
    (edgeId: string, labelPlacement: Edge['labelPlacement']) => {
      store.updateEdge(activeScope, edgeId, { labelPlacement })
    },
    [store, activeScope],
  )

  const handleRoutedHandlesSync = useCallback(
    (patches: RoutedHandlePatch[]) => {
      if (!processData.dirty && saveStatus !== 'modified') return
      const currentProcess = store.getActiveProcess(activeScope)
      if (!currentProcess) return
      for (const patch of patches) {
        const current = currentProcess.edges.find((edge) => edge.id === patch.edgeId)
        if (!current) continue
        store.updateEdge(activeScope, patch.edgeId, applyRoutedHandlePatch(current, patch))
      }
    },
    [store, activeScope, processData.dirty, saveStatus],
  )

  const handleSaveEdge = (edge: Edge, isNew: boolean, options?: { keepNodeId?: string }) => {
    const normalized = normalizeEdgeForStorage(withEdgeHandleDefaults(edge))
    const savedProcess = store.saveEdge(activeScope, normalized, isNew)
    if (options?.keepNodeId) {
      const node = savedProcess?.nodes.find((entry) => entry.id === options.keepNodeId)
      if (node) {
        setSelectedElement({ type: 'node', id: node.id, data: cloneNodeData(node) })
        return
      }
    }
    const savedEdge = savedProcess?.edges.find((entry) => entry.id === normalized.id)
    setSelectedElement({
      type: 'edge',
      id: normalized.id,
      data: cloneEdgeData(savedEdge ?? normalized),
    })
  }

  const handleSaveLane = (lane: Lane, isNew: boolean) => {
    const savedProcess = store.saveLane(activeScope, lane, isNew)
    const savedLane = savedProcess?.lanes.find((entry) => entry.id === lane.id)
    setSelectedElement({
      type: 'lane',
      id: lane.id,
      data: cloneLaneData(savedLane ?? lane),
    })
  }

  const handleSaveZone = (zone: ProcessZone, isNew: boolean) => {
    const savedProcess = store.saveZone(activeScope, zone, isNew)
    const savedZone = savedProcess?.zones?.find((entry) => entry.id === zone.id)
    setSelectedElement({
      type: 'zone',
      id: zone.id,
      data: cloneZoneData(savedZone ?? zone),
    })
  }

  const handleSaveProcessGroup = (group: OverviewProcessGroup) => {
    store.saveProcessGroup(group)
    for (const detailGroup of detailProcessGroups) {
      if (detailGroup.linkedOverviewGroupId === group.id && detailGroup.id !== group.linkedDetailGroupId) {
        const { linkedOverviewGroupId: _removed, ...rest } = detailGroup
        store.saveDetailProcessGroup(rest)
      }
    }
    if (group.linkedDetailGroupId) {
      const detailGroup = detailProcessGroups.find((entry) => entry.id === group.linkedDetailGroupId)
      if (detailGroup && detailGroup.linkedOverviewGroupId !== group.id) {
        store.saveDetailProcessGroup({ ...detailGroup, linkedOverviewGroupId: group.id })
      }
    }
    setSelectedGroupId(group.id)
    setSelectedElement({ type: 'process-group', id: group.id, data: cloneProcessGroup(group) })
    setIsRightOpen(true)
  }

  const handleSaveDetailProcessGroup = (group: DetailProcessGroup) => {
    store.saveDetailProcessGroup(group)
    for (const overviewGroup of overviewProcessGroups) {
      if (overviewGroup.linkedDetailGroupId === group.id && overviewGroup.id !== group.linkedOverviewGroupId) {
        const { linkedDetailGroupId: _removed, ...rest } = overviewGroup
        store.saveProcessGroup(rest)
      }
    }
    if (group.linkedOverviewGroupId) {
      const overviewGroup = overviewProcessGroups.find((entry) => entry.id === group.linkedOverviewGroupId)
      if (overviewGroup && overviewGroup.linkedDetailGroupId !== group.id) {
        store.saveProcessGroup({ ...overviewGroup, linkedDetailGroupId: group.id })
      }
    }
    setSelectedGroupId(group.id)
    setDetailProcessId(group.detailProcessId)
    setSelectedElement({
      type: 'detail-process-group',
      id: group.id,
      data: cloneDetailProcessGroup(group),
    })
    setIsRightOpen(true)
  }

  const handleProcessGroupDraftChange = useCallback((group: OverviewProcessGroup) => {
    setSelectedElement(buildSelectedProcessGroup(group))
  }, [])

  const handleAddOverviewProcessGroup = useCallback(() => {
    if (viewerOnly) return
    setAppMode('edit')
    setSelectedGroupId(null)
    setSelectedElement(buildNewProcessGroupSelection(overviewProcessGroups))
    setIsRightOpen(true)
  }, [overviewProcessGroups, viewerOnly])

  const handleEditOverviewProcessGroup = useCallback(
    (groupId: string) => {
      const group = overviewProcessGroups.find((entry) => entry.id === groupId)
      if (!group) return
      setSelectedGroupId(group.id)
      setSelectedElement(buildSelectedProcessGroup(group))
      setIsRightOpen(true)
    },
    [overviewProcessGroups],
  )

  const handleAddDetailProcessGroup = useCallback(() => {
    if (viewerOnly) return
    setAppMode('edit')
    const currentFirst = [
      ...allDetailProcesses.filter((process) => process.id === detailProcessId),
      ...allDetailProcesses.filter((process) => process.id !== detailProcessId),
    ]
    setSelectedElement(buildNewDetailProcessGroupSelection(detailProcessGroups, currentFirst))
    setIsRightOpen(true)
  }, [detailProcessGroups, allDetailProcesses, detailProcessId, viewerOnly])

  const handleEditDetailProcessGroup = useCallback(
    (groupId: string) => {
      const group = detailProcessGroups.find((entry) => entry.id === groupId)
      if (!group) return
      setSelectedGroupId(group.id)
      setSelectedElement(buildSelectedDetailProcessGroup(group))
      setIsRightOpen(true)
    },
    [detailProcessGroups],
  )

  const handleCloneDetailProcessGroup = useCallback(
    (groupId: string, name: string) => {
      if (viewerOnly) return false
      const group = detailProcessGroups.find((entry) => entry.id === groupId)
      if (!group) return false
      const trimmed = name.trim()
      if (!trimmed) return false

      const result = store.cloneDetailProcess(group.detailProcessId, trimmed)
      if (!result) {
        setDetailCloneNotice('프로세스를 복제하지 못했습니다.')
        return false
      }

      setAppMode('edit')
      setViewMode('detail')
      setDetailProcessId(result.processId)
      setSelectedGroupId(result.groupId)
      setSelectedElement(null)
      applySelectionSnapshot(selectionManagerRef.current.clearSelection({ source: 'programmatic' }))
      setIsLeftOpen(true)
      setIsRightOpen(false)
      setDetailCloneNotice('복제된 프로세스가 열렸습니다. 수정 후 전체 저장을 눌러주세요. Overview 연결은 별도로 설정해야 합니다.')
      return true
    },
    [applySelectionSnapshot, detailProcessGroups, store, viewerOnly],
  )

  const linkedDetailProcessIdForPanel = useMemo(() => {
    if (!savedSelectedOverviewGroup) return undefined
    return resolveLinkedDetailProcessId(savedSelectedOverviewGroup)
  }, [savedSelectedOverviewGroup, resolveLinkedDetailProcessId])

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      store.deleteNode(activeScope, nodeId)
      setSelectedElement(null)
      applySelectionSnapshot(selectionManagerRef.current.clearSelection({ source: 'shortcut' }))
    },
    [store, activeScope, applySelectionSnapshot],
  )

  const handleDeleteEdge = useCallback(
    (edgeId: string, options?: { keepNodeId?: string }) => {
      store.deleteEdge(activeScope, edgeId)
      const latest = store.getActiveProcess(activeScope)
      if (options?.keepNodeId && latest) {
        const nodeSel = buildSelectedNode(latest, options.keepNodeId)
        if (nodeSel) setSelectedElement(nodeSel)
      } else {
        setSelectedElement(null)
      }
      applySelectionSnapshot(selectionManagerRef.current.clearSelection({ source: 'shortcut' }))
    },
    [store, activeScope, applySelectionSnapshot],
  )

  const handleDeleteLane = useCallback(
    (laneId: string) => {
      store.deleteLane(activeScope, laneId)
      setSelectedElement(null)
    },
    [store, activeScope],
  )

  const handleDeleteZone = useCallback(
    (zoneId: string) => {
      store.deleteZone(activeScope, zoneId)
      setSelectedElement(null)
    },
    [store, activeScope],
  )

  const handleDeleteSelection = useCallback(() => {
    if (commandDispatcher.execute('deleteSelection')) return true

    const selected = selectedElementToObject(selectedElement)
    if (!selected.type || !selected.id) return false

    if (selected.type === 'lane') {
      const c = canDeleteLane(activeProcess, selected.id)
      if (!c.ok) {
        window.alert(c.message)
        return false
      }
      if (window.confirm('이 스윔레인을 삭제하시겠습니까?')) {
        void handleDeleteLane(selected.id)
        return true
      }
      return false
    }
    if (selected.type === 'zone') {
      if (window.confirm('이 Process Zone을 삭제하시겠습니까?')) {
        void handleDeleteZone(selected.id)
        return true
      }
    }
    return false
  }, [activeProcess, commandDispatcher, handleDeleteLane, handleDeleteZone, selectedElement])

  useEffect(() => {
    if (appMode !== 'edit') return

    const handledEvents = new WeakSet<KeyboardEvent>()
    const consumeShortcutEvent = (event: KeyboardEvent) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
    const consumeInputEvent = (event: InputEvent) => {
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
    const runUndo = () => {
      const applied = commandDispatcher.execute('undo')
      pushShortcutDebug('store.undo-result', {
        applied,
        activeProcessId: activeProcess.id,
        activeNodeCount: activeProcess.nodes.length,
      })
    }
    const runRedo = () => {
      const applied = commandDispatcher.execute('redo')
      pushShortcutDebug('store.redo-result', {
        applied,
        activeProcessId: activeProcess.id,
        activeNodeCount: activeProcess.nodes.length,
      })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (handledEvents.has(event)) return
      const editableBlocked = isEditableShortcutTarget(event.target)
      const undoShortcut = isShortcutEvent(event, 'undo')
      const redoShortcut = isShortcutEvent(event, 'redo')
      const duplicateShortcut = isShortcutEvent(event, 'duplicate')
      if (undoShortcut || redoShortcut || duplicateShortcut) {
        pushShortcutDebug('keydown-received', {
          key: event.key,
          code: event.code,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          shiftKey: event.shiftKey,
          altKey: event.altKey,
          editableBlocked,
          undoShortcut,
          redoShortcut,
          duplicateShortcut,
          activeProcessId: activeProcess.id,
          activeNodeCount: activeProcess.nodes.length,
          target: describeShortcutTarget(event.target),
        })
      }
      if (editableBlocked) return

      if (undoShortcut) {
        handledEvents.add(event)
        consumeShortcutEvent(event)
        pushShortcutDebug('shortcut-parsed-undo', {
          activeProcessId: activeProcess.id,
          activeNodeCount: activeProcess.nodes.length,
        })
        runUndo()
        return
      }
      if (redoShortcut) {
        handledEvents.add(event)
        consumeShortcutEvent(event)
        pushShortcutDebug('shortcut-parsed-redo', {
          activeProcessId: activeProcess.id,
          activeNodeCount: activeProcess.nodes.length,
        })
        runRedo()
        return
      }
      if (isShortcutEvent(event, 'copy')) {
        if (handleCopySelection()) event.preventDefault()
        return
      }
      if (isShortcutEvent(event, 'paste')) {
        if (handlePasteSelection()) event.preventDefault()
        return
      }
      if (isShortcutEvent(event, 'selectAll')) {
        if (handleSelectAllNodes()) event.preventDefault()
        return
      }
      if (duplicateShortcut) {
        handleDuplicateNodes()
        event.preventDefault()
        return
      }
      if (isShortcutEvent(event, 'addEdge')) {
        handleStartNew('new-edge')
        event.preventDefault()
        return
      }

      if (!isShortcutEvent(event, 'delete')) return

      if (handleDeleteSelection()) event.preventDefault()
    }

    const onBeforeInput = (event: InputEvent) => {
      const editableBlocked = isEditableShortcutTarget(event.target)
      if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
        pushShortcutDebug('beforeinput-received', {
          inputType: event.inputType,
          editableBlocked,
          activeProcessId: activeProcess.id,
          activeNodeCount: activeProcess.nodes.length,
          target: describeShortcutTarget(event.target),
        })
      }
      if (editableBlocked) return
      if (event.inputType === 'historyUndo') {
        consumeInputEvent(event)
        pushShortcutDebug('beforeinput-parsed-undo', {
          activeProcessId: activeProcess.id,
          activeNodeCount: activeProcess.nodes.length,
        })
        runUndo()
        return
      }
      if (event.inputType === 'historyRedo') {
        consumeInputEvent(event)
        pushShortcutDebug('beforeinput-parsed-redo', {
          activeProcessId: activeProcess.id,
          activeNodeCount: activeProcess.nodes.length,
        })
        runRedo()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('beforeinput', onBeforeInput, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('beforeinput', onBeforeInput, true)
    }
  }, [
    appMode,
    selectedElement,
    activeProcess,
    handleCopySelection,
    handleDuplicateNodes,
    handlePasteSelection,
    handleSelectAllNodes,
    handleStartNew,
    handleDeleteSelection,
    commandDispatcher,
  ])

  const handleSaveAll = useCallback(async () => {
    const result = await persistAll()
    if (result.ok) {
      if (result.data) {
        const refreshedProcess = getActiveProcessData(result.data, viewMode, detailProcessId)
        const refreshedOverviewGroups = resolveOverviewProcessGroups(result.data, toBeNavigator.overviewProcessGroups)
        const refreshedDetailGroups = resolveDetailProcessGroups(result.data, toBeNavigator.detailProcessGroups)
        if (refreshedProcess) {
          setSelectedElement((prev) =>
            refreshSelectedElement(prev, refreshedProcess, refreshedOverviewGroups, refreshedDetailGroups),
          )
        }
      }
      setRenderSyncRevision((revision) => revision + 1)
      setSaveReportToast(buildSaveReportToast(result.routerReport, true))
    } else if (result.error) {
      setSaveReportToast(buildSaveReportToast(result.routerReport, false, result.error))
    }
  }, [detailProcessId, persistAll, viewMode])

  const resetToFullOverview = useCallback(() => {
    setViewMode('overview')
    setSelectedGroupId(null)
    setRelatedOnly(false)
    setSelectedElement(null)
    setIsRightOpen(false)
    setOverviewHomeKey((key) => key + 1)
  }, [])

  const handleViewModeChange = (mode: ViewMode) => {
    if (mode === 'overview') {
      resetToFullOverview()
      return
    }
    setViewMode(mode)
    if (selectedGroupId) {
      const detailGroup =
        detailProcessGroups.find((entry) => entry.id === selectedGroupId)
        ?? detailProcessGroups.find((entry) => entry.linkedOverviewGroupId === selectedGroupId)
      if (detailGroup) {
        store.ensureDetailProcess(detailGroup.detailProcessId)
        setDetailProcessId(detailGroup.detailProcessId)
      }
    } else if (detailProcessId) {
      store.ensureDetailProcess(detailProcessId)
    }
  }

  const handleBackToOverview = () => {
    resetToFullOverview()
  }

  const handleSelectEdgeFromPanel = useCallback(
    (edgeId: string) => {
      const el = buildSelectedEdge(activeProcess, edgeId)
      if (el) setSelectedElement(el)
    },
    [activeProcess],
  )

  const handleSelectZoneFromPanel = useCallback(
    (zoneId: string) => {
      const el = buildSelectedZone(activeProcess, zoneId)
      if (el) {
        setSelectedElement(el)
        setIsRightOpen(true)
      }
    },
    [activeProcess],
  )

  const selectedLaneId = selectedElement?.type === 'lane' ? selectedElement.id : null

  return (
    <div className={`app-shell${reviewMode ? ' app-shell--review' : ''}`}>
      <Toolbar
        viewMode={viewMode}
        appMode={appMode}
        reviewMode={reviewMode}
        showNodeNumbers={showNodeNumbers}
        saveStatus={saveStatus}
        isLeftOpen={isLeftOpen}
        isRightOpen={isRightOpen}
        viewerOnly={viewerOnly}
        detailHeader={detailHeader}
        onToggleLeft={() => setIsLeftOpen((prev) => !prev)}
        onToggleRight={() => setIsRightOpen((prev) => !prev)}
        onViewModeChange={handleViewModeChange}
        onAppModeChange={handleAppModeChange}
        onReviewModeChange={setReviewMode}
        onShowNodeNumbersChange={setShowNodeNumbers}
        onBackToOverview={handleBackToOverview}
        onAddNode={() => handleStartNew('new-node', selectedLaneId)}
        onAddEdge={() => handleStartNew('new-edge')}
        onAddLane={() => handleStartNew('new-lane')}
        onAddZone={() => handleStartNew('new-zone')}
        onCopy={() => {
          handleCopySelection()
        }}
        onPaste={() => {
          handlePasteSelection()
        }}
        onDuplicate={() => handleDuplicateNodes()}
        onDelete={() => {
          handleDeleteSelection()
        }}
        canCopy={commandDispatcher.canExecute('copyNodes')}
        canPaste={commandDispatcher.canExecute('pasteNodes')}
        canDuplicate={commandDispatcher.canExecute('duplicateNodes')}
        canDelete={
          appMode === 'edit' &&
          (selectedNodeIds.length > 0 ||
            selectedEdgeIds.length > 0 ||
            selectedElement?.type === 'node' ||
            selectedElement?.type === 'edge' ||
            selectedElement?.type === 'lane' ||
            selectedElement?.type === 'zone')
        }
        onSaveAll={() => {
          void handleSaveAll()
        }}
      />

      {reviewMode ? (
        <div className="review-dashboard" role="status" aria-label="Internal Review Summary">
          <div className="review-dashboard__title">
            <span>Internal Review</span>
            <strong>{activeProcess.name}</strong>
          </div>
          <div className="review-dashboard__metrics">
            <span>Nodes <strong>{reviewSummary.total}</strong></span>
            <span>Reviewed <strong>{reviewSummary.ok}</strong></span>
            <span>Review Required <strong>{reviewSummary.reviewRequired}</strong></span>
            <span>Not Reviewed <strong>{reviewSummary.notReviewed}</strong></span>
            <span className={reviewSummary.ready ? 'review-dashboard__ready' : 'review-dashboard__not-ready'}>
              Ready {reviewSummary.ready ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      ) : null}

      {saveReportToast ? (
        <section
          key={saveReportToast.id}
          className={`save-report save-report--${saveReportToast.kind}`}
          style={{ right: isRightOpen ? PROPERTY_PANEL_WIDTH + 18 : undefined }}
          role="status"
          aria-label="저장 결과"
        >
          <div className="save-report__header">
            <strong>{saveReportToast.title}</strong>
            <button type="button" onClick={() => setSaveReportToast(null)} aria-label="저장 결과 닫기">
              <X size={14} />
            </button>
          </div>
          <p className="save-report__summary">{saveReportToast.summary}</p>
          {saveReportToast.issues.length > 0 ? (
            <ul className="save-report__list">
              {saveReportToast.issues.slice(0, 5).map((issue, index) => (
                <li key={`${issue.processId}:${issue.edgeId ?? issue.nodeId ?? issue.code}:${index}`}>
                  <span>{issueTitle(issue)}</span>
                  <small>{issueDetail(issue)}</small>
                </li>
              ))}
              {saveReportToast.issues.length > 5 ? (
                <li>
                  <span>추가 항목</span>
                  <small>{saveReportToast.issues.length - 5}건 더 있습니다.</small>
                </li>
              ) : null}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className={`app-body${viewMode === 'detail' ? ' app-body--detail' : ''}`}>
        <ProcessCanvasContainer
          isPanelOpen={isRightOpen}
          panelRef={propertyPanelRef}
          panel={
            <>
              <header className="app-property-panel__header">
                <h2 className="app-property-panel__title">Property Panel</h2>
                <button
                  type="button"
                  className="app-property-panel__close"
                  onClick={() => setIsRightOpen(false)}
                  aria-label="패널 닫기"
                >
                  <X size={18} />
                </button>
              </header>
              <div className="app-property-panel__body" {...panelEventShieldProps}>
                <PropertyPanel
                  appMode={appMode}
                  viewMode={viewMode}
                  selectedElement={selectedElement}
                  process={activeProcess}
                  detailProcesses={allDetailProcesses}
                  reviewMode={reviewMode}
                  overviewProcessGroups={overviewProcessGroups}
                  detailProcessGroups={detailProcessGroups}
                  onOpenDetailProcess={handleOpenDetailProcess}
                  onSaveNode={handleSaveNode}
                  onSaveEdge={handleSaveEdge}
                  onSaveLane={handleSaveLane}
                  onSaveZone={handleSaveZone}
                  onSaveProcessGroup={handleSaveProcessGroup}
                  onSaveDetailProcessGroup={handleSaveDetailProcessGroup}
                  onProcessGroupDraftChange={handleProcessGroupDraftChange}
                  savedProcessGroup={savedSelectedOverviewGroup}
                  savedDetailProcessGroup={savedSelectedDetailGroup}
                  linkedDetailProcessId={linkedDetailProcessIdForPanel}
                  onDeleteNode={handleDeleteNode}
                  onDeleteEdge={handleDeleteEdge}
                  onDeleteLane={handleDeleteLane}
                  onDeleteZone={handleDeleteZone}
                  onCancelNew={() => setSelectedElement(null)}
                  onSelectEdge={handleSelectEdgeFromPanel}
                  onSelectZone={handleSelectZoneFromPanel}
                  onRequestEditMode={handleRequestEditMode}
                />
              </div>
            </>
          }
        >
          <ProcessMapCanvas
            process={canvasProcess}
            viewMode={viewMode}
            appMode={appMode}
            selectedElement={selectedElement}
            reviewMode={reviewMode}
            selectedNodeIds={selectedNodeIds}
            selectedEdgeIds={selectedEdgeIds}
            overviewHighlight={overviewHighlight}
            overviewHomeKey={overviewHomeKey}
            renderSyncRevision={renderSyncRevision}
            showNodeNumbers={showNodeNumbers}
            panelInsetRight={isRightOpen ? PROPERTY_PANEL_WIDTH : 0}
            onSelectElement={handleSelectElement}
            onSelectedNodeIdsChange={handleCanvasNodeSelectionChange}
            onSelectedEdgeIdsChange={handleCanvasEdgeSelectionChange}
            onCopyNodes={(nodeIds) => {
              handleCopyNodes(nodeIds)
            }}
            onPasteClipboard={() => {
              handlePasteSelection()
            }}
            onDuplicateNodes={handleDuplicateNodes}
            onDeleteSelection={() => {
              handleDeleteSelection()
            }}
            onClearSelection={handleClearSelection}
            onPaneBodyClick={handleCanvasPaneBodyClick}
            onEdgeRoutingChange={handleEdgeRoutingChange}
            onEdgeLabelPlacementChange={handleEdgeLabelPlacementChange}
                  onConnectEdge={handleConnectEdge}
                  onNodePlacementChange={handleNodePlacementChange}
                  onNodePlacementChanges={handleNodePlacementChanges}
                  onRoutedHandlesSync={handleRoutedHandlesSync}
                />
        </ProcessCanvasContainer>
      </div>

      <RouterHealthDashboard processData={processData} />

      <DataStatusBar processData={processData} nodeCount={summary.nodeCount} edgeCount={summary.edgeCount} />

      <Drawer side="left" isOpen={isLeftOpen} title={viewMode === 'overview' ? 'Overview 프로세스 그룹' : '프로세스 상세'} onClose={() => setIsLeftOpen(false)}>
        {viewMode === 'overview' ? (
          <ProcessGroupMenu
            variant="overview"
            groups={overviewProcessGroups}
            selectedGroupId={selectedGroupId}
            relatedOnly={relatedOnly}
            detailProcesses={allDetailProcesses}
            resolveLinkedDetailProcessId={resolveLinkedDetailProcessId}
            onSelectGroup={handleSelectOverviewGroup}
            onRelatedOnlyChange={setRelatedOnly}
            onOpenDetail={handleOpenDetailFromOverview}
            onAddGroup={appMode === 'edit' ? handleAddOverviewProcessGroup : undefined}
            onEditGroup={appMode === 'edit' ? handleEditOverviewProcessGroup : undefined}
          />
        ) : (
          <ProcessGroupMenu
            variant="detail"
            groups={detailProcessGroups}
            selectedGroupId={
              detailProcessGroups.find((group) => group.detailProcessId === detailProcessId)?.id ?? null
            }
            detailProcesses={allDetailProcesses}
            onSelectGroup={handleOpenDetailFromDetailMenu}
            onAddGroup={appMode === 'edit' ? handleAddDetailProcessGroup : undefined}
            onEditGroup={appMode === 'edit' ? handleEditDetailProcessGroup : undefined}
            onCloneGroup={appMode === 'edit' ? handleCloneDetailProcessGroup : undefined}
            cloneNotice={detailCloneNotice}
          />
        )}
      </Drawer>
    </div>
  )
}
