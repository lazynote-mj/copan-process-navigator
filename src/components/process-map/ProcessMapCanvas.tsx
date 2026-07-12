import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useViewport,
  useNodesState,
  useEdgesState,
  useUpdateNodeInternals,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnConnect,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { Edge as ProcessEdge, NodeReviewStatus, Process, ProcessZoneId } from '../../types/process'
import type { EdgeHandleId } from '../../types/process'
import { NODE_TYPE_COLORS, DEFAULT_NODE_TYPE } from '../../types/process'
import { EDGE_STROKE_WIDTH } from '../../types/edgeTypes'
import type { AppMode, SelectedElement } from '../../lib/editor/selectionTypes'
import {
  buildSelectedEdgeFromFlow,
  buildSelectedLane,
  buildSelectedNode,
  buildSelectedOverviewZone,
  buildSelectedZone,
} from '../../lib/editor/selectedElement'
import { collectRoutedHandleSyncPatches, type RoutedHandlePatch } from '../../lib/editor/routedEdgeSync'
import { EditorContextProvider } from '../../lib/editor/EditorContext'
import {
  resolveDropPlacementPreview,
  resolveNodePlacementPatchesAfterDrag,
  type DropPlacementPreview,
  type NodePlacementPatch,
} from '../../lib/editor/resolveDragPlacement'
import type { OverviewHighlight, ViewMode } from '../../lib/editor/viewModeTypes'
import { isEdgeGroupHighlighted } from '../../lib/editor/processGroupMembership'
import { createDefaultEdge } from '../../lib/editor/processEditor'
import { getShortcut } from '../../lib/editor/shortcutManager'
import { compensatePanelScroll } from '../../lib/layout/panelScrollCompensation'
import { getLayoutedElements, rebuildLayoutEdges, type CanvasBounds, type LaneBand, type ProcessNodeData } from '../../lib/layout/elkLayout'
import { buildProcessFlowNode } from '../../lib/buildProcessFlowNode'
import { buildAutoNodeNumberResult } from '../../lib/nodeNumbering'
import { getProcessEdgeRoutingKey, getProcessNodeLayoutKey } from '../../lib/layout/processLayoutKey'
import { runLegacyShadowEngine } from '../../engine/legacyShadowRun'
import type { SelectionChangeOptions } from '../../selection'
import type { PlacedNode } from '../../lib/layout/laneLayout'
import type { ZoneLayoutBand } from '../../lib/layout/overviewGridLayout'
import {
  gridContentWidth,
  scaledGridContentWidth,
  swimlaneLaneAreaWidth,
  SWIMLANE_LANE_COUNT,
  LEFT_LABEL_WIDTH,
  LANE_WIDTH,
  DETAIL_SWIMLANE_GRID,
  OVERVIEW_SWIMLANE_GRID,
} from '../../lib/layout/swimlaneGridLayout'
import { buildSwimlaneGridFromProcess } from '../../lib/layout/laneLayoutResolver'
import { isDetailSingleLaneProcess, resolveDetailLayoutLanes } from '../../lib/layout/detailVerticalLayout'
import ProcessNodeCard from './nodes/ProcessNodeCard'
import DecisionNodeCard from './nodes/DecisionNodeCard'
import DatabaseNodeCard from './nodes/DatabaseNodeCard'
import InterfaceRuleNodeCard from './nodes/InterfaceRuleNodeCard'
import MergeNodeCard from './nodes/MergeNodeCard'
import ConnectorNodeCard from './nodes/ConnectorNodeCard'
import './nodes/decision-node.css'
import './nodes/interface-rule-node.css'
import './nodes/connector-node.css'
import {
  ConditionEdge,
  CrossLaneEdge,
  NormalEdge,
  ReturnEdge,
  SystemEdge,
} from './edges/ProcessEdgeBase'
import { EdgeEditContext } from './edges/EdgeEditContext'
import { DetailViewport } from './DetailViewport'
import { DetailScrollBridge } from './DetailScrollBridge'
import { LayoutViewportSync } from './LayoutViewportSync'
import { OverviewViewport } from './OverviewViewport'
import { OverviewScrollBridge } from './OverviewScrollBridge'
import { OverviewStickyHeader } from './OverviewStickyHeader'
import { SwimlaneOverlay } from './SwimlaneOverlay'
import { ProcessZoneOverlay } from './ProcessZoneOverlay'
import './process-map.css'

const nodeTypes = {
  processNode: ProcessNodeCard,
  decisionNode: DecisionNodeCard,
  databaseNode: DatabaseNodeCard,
  interfaceRuleNode: InterfaceRuleNodeCard,
  mergeNode: MergeNodeCard,
  connectorNode: ConnectorNodeCard,
}

const edgeTypes = {
  normalEdge: NormalEdge,
  crossLaneEdge: CrossLaneEdge,
  conditionEdge: ConditionEdge,
  systemEdge: SystemEdge,
  returnEdge: ReturnEdge,
}

function OverviewDropPreview({ preview }: { preview: DropPlacementPreview | null }) {
  const viewport = useViewport()
  if (!preview) return null

  return (
    <div
      className="overview-drop-preview nodrag nopan"
      style={{
        width: preview.rect.width,
        height: preview.rect.height,
        transform: `translate(${preview.rect.x * viewport.zoom + viewport.x}px, ${preview.rect.y * viewport.zoom + viewport.y}px) scale(${viewport.zoom})`,
      }}
    >
      <span>{preview.label}</span>
    </div>
  )
}

type ProcessMapCanvasProps = {
  process: Process
  viewMode: ViewMode
  appMode: AppMode
  selectedElement: SelectedElement | null
  reviewMode?: boolean
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  overviewHighlight?: OverviewHighlight | null
  /** Overview 홈(전체 보기) 복귀 시 viewport 리셋 트리거 */
  overviewHomeKey?: number
  renderSyncRevision?: number
  showNodeNumbers?: boolean
  panelInsetRight?: number
  /** WP4 — Detail lane subtitle에 표시할 도메인별 담당 조직명(Business Policy 조회 결과). 레이아웃 무영향. */
  laneOrganizations?: Map<string, string>
  onSelectElement: (element: SelectedElement | null) => void
  onSelectedNodeIdsChange?: (nodeIds: string[], options?: SelectionChangeOptions) => { nodeIds: string[]; primaryNodeId: string | null } | void
  onSelectedEdgeIdsChange?: (edgeIds: string[], options?: SelectionChangeOptions) => { edgeIds: string[]; primaryEdgeId: string | null } | void
  onCopyNodes?: (nodeIds: string[]) => void
  onCopyEdge?: (edgeId: string) => void
  onPasteClipboard?: () => void
  onDuplicateNodes?: (nodeIds: string[]) => void
  onDeleteSelection?: () => void
  onClearSelection: () => void
  onPaneBodyClick?: () => void
  onEdgeRoutingChange: (edgeId: string, routing: ProcessEdge['routing']) => void
  onEdgeLabelPlacementChange: (edgeId: string, labelPlacement: ProcessEdge['labelPlacement']) => void
  onConnectEdge: (edge: ProcessEdge) => void
  onNodePlacementChange: (nodeId: string, patch: Partial<import('../../types/process').Node>) => void
  onNodePlacementChanges?: (patches: NodePlacementPatch[]) => void
  /** layout 후 handleAuto edge의 router handle을 process JSON에 반영 */
  onRoutedHandlesSync?: (patches: RoutedHandlePatch[]) => void
}

function filterProcessForHighlight(process: Process, highlight: OverviewHighlight): Process {
  const nodes = process.nodes.filter((n) => highlight.nodeIds.has(n.id))
  const edges = process.edges.filter((edge) =>
    isEdgeGroupHighlighted(
      { id: edge.id, source: edge.source, target: edge.target },
      highlight,
    ),
  )
  return { ...process, nodes, edges }
}

function applyNodeHighlightStyle(
  node: Node<ProcessNodeData>,
  highlight: OverviewHighlight | null | undefined,
): Node<ProcessNodeData> {
  if (!highlight || highlight.mode === 'all' || !highlight.groupId) {
    return node
  }

  const isHighlighted = highlight.nodeIds.has(node.id)
  const isInGroup = isHighlighted
  const isFocus = (highlight.focusNodeIds?.has(node.id) ?? false) && isInGroup
  const isDimmed =
    highlight.mode === 'dim' &&
    !isHighlighted &&
    !(highlight.focusNodeId && highlight.focusNodeIds?.has(node.id))

  const nextStyle = { ...(node.style ?? {}) } as Record<string, unknown>
  delete nextStyle.opacity
  delete nextStyle.filter

  return {
    ...node,
    className: [
      node.className,
      isFocus ? 'process-node-flow--focus' : isHighlighted ? 'process-node-flow--highlighted' : '',
      isDimmed ? 'process-node-flow--dimmed' : '',
    ]
      .filter(Boolean)
      .join(' '),
    style: nextStyle,
  }
}

function isEdgeFocusHighlighted(edgeId: string, highlight: OverviewHighlight): boolean {
  if (!highlight.focusEdgeIds?.size) return false
  if (highlight.focusEdgeIds.has(edgeId)) return true
  for (const id of highlight.focusEdgeIds) {
    if (edgeId.startsWith(`${id}::`)) return true
  }
  return false
}

function stripEdgeHighlightClassName(className?: string): string {
  return (className ?? '')
    .split(' ')
    .filter((token) => token && !token.startsWith('process-edge-flow--'))
    .join(' ')
}

function shallowRecordMatches(a?: Record<string, unknown>, b?: Record<string, unknown>): boolean {
  const left = a ?? {}
  const right = b ?? {}
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((key) => left[key] === right[key])
}

function flowNodeViewStateMatches(
  current: Node<ProcessNodeData>,
  next: Node<ProcessNodeData>,
): boolean {
  return (
    current.selected === next.selected &&
    current.draggable === next.draggable &&
    current.selectable === next.selectable &&
    current.connectable === next.connectable &&
    current.zIndex === next.zIndex &&
    current.className === next.className &&
    shallowRecordMatches(current.style as Record<string, unknown> | undefined, next.style as Record<string, unknown> | undefined) &&
    shallowRecordMatches(current.data as Record<string, unknown> | undefined, next.data as Record<string, unknown> | undefined)
  )
}

function flowEdgeViewStateMatches(current: Edge, next: Edge): boolean {
  return (
    current.selected === next.selected &&
    current.selectable === next.selectable &&
    current.focusable === next.focusable &&
    current.zIndex === next.zIndex &&
    current.className === next.className &&
    shallowRecordMatches(current.style as Record<string, unknown> | undefined, next.style as Record<string, unknown> | undefined) &&
    shallowRecordMatches(current.data as Record<string, unknown> | undefined, next.data as Record<string, unknown> | undefined)
  )
}

function applyEdgeHighlightStyle(
  edge: Edge,
  highlight: OverviewHighlight | null | undefined,
): Edge {
  const edgeData = (edge.data ?? {}) as Record<string, unknown>
  const baseStyle = { ...(edge.style ?? {}) } as Record<string, unknown>
  const baseClassName = stripEdgeHighlightClassName(edge.className)

  if (!highlight || highlight.mode === 'all' || !highlight.groupId) {
    delete baseStyle.opacity
    const { groupFocus, groupDimmed, groupHighlighted, ...restData } = edgeData
    return {
      ...edge,
      data: restData,
      className: baseClassName || undefined,
      style: baseStyle,
    }
  }

  const isFocus = isEdgeFocusHighlighted(edge.id, highlight)
  const isHighlighted = isEdgeGroupHighlighted(
    { id: edge.id, source: String(edge.source), target: String(edge.target) },
    highlight,
  )
  const isDimmed = highlight.mode === 'dim' && !isHighlighted
  const baseWidth = typeof baseStyle.strokeWidth === 'number' ? baseStyle.strokeWidth : EDGE_STROKE_WIDTH

  return {
    ...edge,
    data: {
      ...edgeData,
      groupFocus: isFocus || undefined,
      groupDimmed: isDimmed || undefined,
      groupHighlighted: isHighlighted || undefined,
    },
    className: [
      baseClassName,
      isDimmed ? 'process-edge-flow--dimmed' : '',
      isHighlighted ? 'process-edge-flow--highlighted' : '',
      isFocus ? 'process-edge-flow--focus' : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined,
    style: {
      ...baseStyle,
      opacity: isDimmed ? 0.18 : 1,
      strokeWidth: isFocus ? EDGE_STROKE_WIDTH + 0.75 : isHighlighted ? EDGE_STROKE_WIDTH : baseWidth,
    },
  }
}

function parseHandleId(handle: string | null | undefined): EdgeHandleId | undefined {
  if (!handle) return undefined
  const match = handle.match(/(?:source|target)-(?<side>top|right|bottom|left)/)
  return (match?.groups?.side as EdgeHandleId | undefined) ?? undefined
}

function flowNodeDataMatches(flowData: ProcessNodeData, nextData: ProcessNodeData): boolean {
  return (
    flowData.name === nextData.name &&
    flowData.displayName === nextData.displayName &&
    flowData.overviewType === nextData.overviewType &&
    flowData.overviewVisualClass === nextData.overviewVisualClass &&
    flowData.system === nextData.system &&
    flowData.type === nextData.type &&
    flowData.laneId === nextData.laneId &&
    flowData.laneName === nextData.laneName &&
    flowData.phaseId === nextData.phaseId &&
    flowData.phaseLabel === nextData.phaseLabel &&
    flowData.phaseOrder === nextData.phaseOrder &&
    flowData.stepBadge === nextData.stepBadge &&
    flowData.showStepBadge === nextData.showStepBadge &&
    flowData.localOrder === nextData.localOrder &&
    flowData.decisionSubtitle === nextData.decisionSubtitle &&
    flowData.reviewMode === nextData.reviewMode &&
    flowData.reviewStatus === nextData.reviewStatus
  )
}

function applyReviewModeToNodes(
  flowNodes: Node<ProcessNodeData>[],
  process: Process,
  reviewMode: boolean,
): Node<ProcessNodeData>[] {
  const reviewById = new Map<string, NodeReviewStatus>(
    process.nodes.map((node) => [node.id, node.review?.status ?? 'not-reviewed']),
  )
  let changed = false
  const next = flowNodes.map((flowNode) => {
    const nextStatus = reviewById.get(flowNode.id) ?? 'not-reviewed'
    if (flowNode.data.reviewMode === reviewMode && flowNode.data.reviewStatus === nextStatus) {
      return flowNode
    }
    changed = true
    return {
      ...flowNode,
      data: {
        ...flowNode.data,
        reviewMode,
        reviewStatus: nextStatus,
      },
    }
  })
  return changed ? next : flowNodes
}

function flowNodeToPlaced(flowNode: Node<ProcessNodeData>): PlacedNode & { cell3Col?: boolean } {
  const styleWidth = numericStyleSize(flowNode.style?.width)
  const styleHeight = numericStyleSize(flowNode.style?.height)
  return {
    id: flowNode.id,
    laneId: flowNode.data.laneId,
    x: flowNode.position.x,
    y: flowNode.position.y,
    width: flowNode.data.layoutWidth ?? styleWidth ?? flowNode.width ?? 180,
    height: flowNode.data.layoutHeight ?? styleHeight ?? flowNode.height ?? 56,
    cell3Col: flowNode.data.cell3Col,
  }
}

function flowNodesToPlaced(nodes: Node<ProcessNodeData>[]): PlacedNode[] {
  return nodes.map((node) => flowNodeToPlaced(node))
}

function numericStyleSize(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function isFinitePoint(point: { x: number; y: number } | null | undefined): point is { x: number; y: number } {
  return Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y))
}

function edgeSelectionDataMatches(
  current: ProcessMapCanvasProps['selectedElement'],
  next: ReturnType<typeof buildSelectedEdgeFromFlow>,
): boolean {
  if (!current || !next || current.type !== 'edge' || current.id !== next.id) return false
  try {
    return JSON.stringify(current.data) === JSON.stringify(next.data)
  } catch {
    return false
  }
}

type DetailEdgeRefreshProps = {
  trigger: number
  nodeIds: string[]
  onRefresh: () => void
}

function DetailEdgeRefresh({ trigger, nodeIds, onRefresh }: DetailEdgeRefreshProps) {
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    if (trigger <= 0) return
    const frames: number[] = []
    frames.push(
      window.requestAnimationFrame(() => {
        nodeIds.forEach((nodeId) => updateNodeInternals(nodeId))
        frames.push(window.requestAnimationFrame(onRefresh))
      }),
    )
    return () => {
      frames.forEach((frame) => window.cancelAnimationFrame(frame))
    }
  }, [trigger, nodeIds, onRefresh, updateNodeInternals])

  return null
}

export function ProcessMapCanvas({
  process,
  viewMode,
  appMode,
  selectedElement,
  reviewMode = false,
  selectedNodeIds = [],
  selectedEdgeIds = [],
  overviewHighlight,
  overviewHomeKey = 0,
  renderSyncRevision = 0,
  showNodeNumbers = true,
  panelInsetRight = 0,
  laneOrganizations,
  onSelectElement,
  onSelectedNodeIdsChange,
  onSelectedEdgeIdsChange,
  onCopyNodes,
  onCopyEdge,
  onPasteClipboard,
  onDuplicateNodes,
  onDeleteSelection,
  onClearSelection,
  onPaneBodyClick,
  onEdgeRoutingChange,
  onEdgeLabelPlacementChange,
  onConnectEdge,
  onNodePlacementChange,
  onNodePlacementChanges,
  onRoutedHandlesSync,
}: ProcessMapCanvasProps) {
  const isEditMode = appMode === 'edit'
  const selectedNodeId = selectedElement?.type === 'node' ? selectedElement.id : null
  const selectedNodeIdSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds])
  const selectedEdgeId = selectedElement?.type === 'edge' ? selectedElement.id : null
  const selectedEdgeIdSet = useMemo(() => new Set(selectedEdgeIds), [selectedEdgeIds])
  const selectedLaneId = selectedElement?.type === 'lane' ? selectedElement.id : null
  const selectedZoneId =
    selectedElement?.type === 'zone' || selectedElement?.type === 'new-zone'
      ? selectedElement.id
      : null
  const selectedOverviewZoneId =
    selectedElement?.type === 'overview-zone' ? selectedElement.id : null
  const layoutProcess = useMemo(() => {
    if (overviewHighlight?.mode === 'filter' && overviewHighlight.groupId) {
      return filterProcessForHighlight(process, overviewHighlight)
    }
    return process
  }, [process, overviewHighlight])

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ProcessNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [laneBands, setLaneBands] = useState<LaneBand[]>([])
  const [zoneBands, setZoneBands] = useState<ZoneLayoutBand[]>([])
  const [canvasBounds, setCanvasBounds] = useState<CanvasBounds | null>(null)
  const [layoutOrientation, setLayoutOrientation] = useState<'horizontal' | 'vertical'>('horizontal')
  const [fitTrigger, setFitTrigger] = useState('')
  const [overviewScale, setOverviewScale] = useState(1)
  const [detailScale, setDetailScale] = useState(1)
  const [detailEdgeRefreshKey, setDetailEdgeRefreshKey] = useState(0)
  const [dropPreview, setDropPreview] = useState<DropPlacementPreview | null>(null)
  const [nodeContextMenu, setNodeContextMenu] = useState<{
    nodeId: string
    nodeIds: string[]
    x: number
    y: number
  } | null>(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string
    x: number
    y: number
  } | null>(null)

  const laneBandsRef = useRef<LaneBand[]>([])
  const zoneBandsRef = useRef<ZoneLayoutBand[]>([])
  const nodesRef = useRef<Node<ProcessNodeData>[]>([])
  const edgesRef = useRef<Edge[]>([])

  const overviewScrollRef = useRef<HTMLDivElement>(null)
  const detailScrollRef = useRef<HTMLDivElement>(null)

  const isOverview = viewMode === 'overview'
  // WP4 — presentation-only adapter. Detail에서만 lane subtitle에 담당 조직명을 주입한다.
  // ⚠ `LaneBand.ownerDepartment` 슬롯을 subtitle 표시 용도로 **재사용**할 뿐이며, 이 값은:
  //   - layout(컬럼 위치/폭/node 배치)에 사용되지 않음 (레이아웃 키는 laneId=도메인)
  //   - persistence에 저장되지 않음 (렌더 시점 파생값)
  //   - canonical organization assignment가 아님 (canonical은 DetailProcessGroup.domainAssignments)
  // Overview는 도메인만 표시하므로 원본 band(빈 subtitle)를 그대로 쓴다.
  const displayLaneBands = useMemo(() => {
    if (isOverview || !laneOrganizations || laneOrganizations.size === 0) return laneBands
    return laneBands.map((band) => {
      const org = laneOrganizations.get(band.laneId)
      return org ? { ...band, ownerDepartment: org } : band
    })
  }, [isOverview, laneBands, laneOrganizations])
  const useDetailHorizontal = !isOverview
  const isDetailVertical = !isOverview && !useDetailHorizontal
  const isEditingOverviewProcessGroup =
    isOverview &&
    isEditMode &&
    (selectedElement?.type === 'process-group' || selectedElement?.type === 'new-process-group')
  const detailUsedLaneIds = useMemo(
    () => new Set(layoutProcess.nodes.map((node) => node.laneId)),
    [layoutProcess.nodes],
  )

  const nodeTopologyKey = useMemo(() => getProcessNodeLayoutKey(layoutProcess), [layoutProcess])
  const edgeRoutingKey = useMemo(() => getProcessEdgeRoutingKey(layoutProcess), [layoutProcess])
  const autoNodeNumberMap = useMemo(
    () => (!isOverview && showNodeNumbers ? buildAutoNodeNumberResult(layoutProcess).numbers : new Map<string, number | string>()),
    [isOverview, layoutProcess, showNodeNumbers],
  )
  const autoNodeNumberKey = useMemo(
    () => (
      showNodeNumbers
        ? Array.from(autoNodeNumberMap.entries()).map(([nodeId, number]) => `${nodeId}:${number}`).join('|')
        : 'off'
    ),
    [autoNodeNumberMap, showNodeNumbers],
  )
  const flowInstanceKey = `${viewMode}:${layoutProcess.id}:sync:${renderSyncRevision}`

  const highlightKey = `${overviewHighlight?.groupId ?? 'all'}:${overviewHighlight?.mode ?? 'all'}`
  const structureKey = `${nodeTopologyKey}|${viewMode}|${highlightKey}|numbers:${autoNodeNumberKey}|sync:${renderSyncRevision}`

  const prevStructureKeyRef = useRef('')
  const prevEdgeRoutingKeyRef = useRef('')
  const prevShadowRunKeyRef = useRef('')
  const layoutInitializedRef = useRef(false)

  useEffect(() => {
    if (!import.meta.env.DEV || isOverview) return
    const target = globalThis as typeof globalThis & {
      __PROCESS_NAV_NODE_NUMBERS__?: ReturnType<typeof buildAutoNodeNumberResult>['debug']
    }
    target.__PROCESS_NAV_NODE_NUMBERS__ = buildAutoNodeNumberResult(layoutProcess).debug
  }, [isOverview, layoutProcess])

  const emitRoutedHandleSync = useCallback(
    (flowEdges: Edge[]) => {
      if (!onRoutedHandlesSync) return
      const patches = collectRoutedHandleSyncPatches(layoutProcess.edges, flowEdges)
      if (patches.length > 0) onRoutedHandlesSync(patches)
    },
    [layoutProcess.edges, onRoutedHandlesSync],
  )

  const applyAutoNodeNumbers = useCallback(
    (flowNodes: Node<ProcessNodeData>[]): Node<ProcessNodeData>[] => {
      let changed = false
      const next = flowNodes.map((flowNode) => {
        const nextStepBadge = !isOverview && showNodeNumbers ? autoNodeNumberMap.get(flowNode.id) : undefined
        const nextShowStepBadge = Boolean(nextStepBadge)
        if (flowNode.data.stepBadge === nextStepBadge && flowNode.data.showStepBadge === nextShowStepBadge) {
          return flowNode
        }
        changed = true
        return {
          ...flowNode,
          data: {
            ...flowNode.data,
            stepBadge: nextStepBadge,
            showStepBadge: nextShowStepBadge,
          },
        }
      })
      return changed ? next : flowNodes
    },
    [autoNodeNumberMap, isOverview, showNodeNumbers],
  )

  useEffect(() => {
    if (!isOverview) return
    setFitTrigger(`${nodeTopologyKey}-${viewMode}-${highlightKey}-home${overviewHomeKey}-sync${renderSyncRevision}`)
  }, [overviewHomeKey, isOverview, nodeTopologyKey, viewMode, highlightKey, renderSyncRevision])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const shadowRunKey = `${layoutProcess.id}:${viewMode}:${structureKey}:${edgeRoutingKey}`
    if (prevShadowRunKeyRef.current === shadowRunKey) return
    prevShadowRunKeyRef.current = shadowRunKey

    try {
      const result = runLegacyShadowEngine(layoutProcess, {
        layoutOptions: {
          overviewVertical: isOverview,
          detailHorizontal: useDetailHorizontal,
        },
      })
      if (result.diagnostics.length === 0) return

      const errorCount = result.diagnostics.filter((item) => item.severity === 'error').length
      const warningCount = result.diagnostics.filter((item) => item.severity === 'warning').length
      console.groupCollapsed(
        `[Navigator Shadow Engine] ${layoutProcess.id} diagnostics: ${errorCount} error, ${warningCount} warning`,
      )
      console.table(result.diagnostics)
      console.groupEnd()
    } catch (error) {
      console.warn(`[Navigator Shadow Engine] ${layoutProcess.id} failed`, error)
    }
  }, [edgeRoutingKey, isOverview, layoutProcess, structureKey, useDetailHorizontal, viewMode])

  useEffect(() => {
    const structureChanged =
      prevStructureKeyRef.current !== structureKey || !layoutInitializedRef.current
    const edgeRoutingChanged = prevEdgeRoutingKeyRef.current !== edgeRoutingKey

    prevStructureKeyRef.current = structureKey
    prevEdgeRoutingKeyRef.current = edgeRoutingKey

    if (structureChanged) {
      layoutInitializedRef.current = true
      const result = getLayoutedElements(layoutProcess, {
        overviewVertical: isOverview,
        detailHorizontal: useDetailHorizontal,
      })
      const styledNodes = applyAutoNodeNumbers(
        applyReviewModeToNodes(
          result.nodes.map((node) => applyNodeHighlightStyle(node, overviewHighlight)),
          layoutProcess,
          reviewMode,
        ),
      )
      const styledEdges = result.edges.map((edge) => applyEdgeHighlightStyle(edge, overviewHighlight))

      nodesRef.current = styledNodes
      edgesRef.current = styledEdges
      setNodes(styledNodes)
      setEdges(styledEdges)
      setLaneBands(result.laneBands)
      laneBandsRef.current = result.laneBands
      setZoneBands(result.zoneBands ?? [])
      zoneBandsRef.current = result.zoneBands ?? []
      setCanvasBounds(result.canvasBounds)
      setLayoutOrientation(result.layoutOrientation ?? 'horizontal')
      setFitTrigger(`${nodeTopologyKey}-${viewMode}-${highlightKey}-home${overviewHomeKey}-sync${renderSyncRevision}`)
      emitRoutedHandleSync(styledEdges)
      if (!isOverview) setDetailEdgeRefreshKey((key) => key + 1)
      return
    }

    if (edgeRoutingChanged) {
      const placed = flowNodesToPlaced(nodesRef.current)
      if (placed.length === 0) return

      const newEdges = rebuildLayoutEdges(layoutProcess, placed, {
        overviewVertical: isOverview,
        detailHorizontal: useDetailHorizontal,
        laneBands: laneBandsRef.current,
      })
      const styledEdges = newEdges.map((edge) => applyEdgeHighlightStyle(edge, overviewHighlight))
      edgesRef.current = styledEdges
      setEdges(styledEdges)
      emitRoutedHandleSync(styledEdges)
      return
    }

    const placed = flowNodesToPlaced(nodesRef.current)
    if (placed.length === 0) return

    const refreshedEdges = rebuildLayoutEdges(layoutProcess, placed, {
      overviewVertical: isOverview,
      detailHorizontal: useDetailHorizontal,
      laneBands: laneBandsRef.current,
    })
    const styledEdges = refreshedEdges.map((edge) => applyEdgeHighlightStyle(edge, overviewHighlight))
    edgesRef.current = styledEdges
    setEdges(styledEdges)
    emitRoutedHandleSync(styledEdges)
    if (!isOverview) {
      setDetailEdgeRefreshKey((key) => key + 1)
    }
    // reviewMode는 의도적으로 제외 — review 토글은 전체 레이아웃 재계산 없이
    // 아래 view-state sync effect가 노드 스타일만 갱신한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    structureKey,
    edgeRoutingKey,
    nodeTopologyKey,
    highlightKey,
    layoutProcess,
    overviewHighlight,
    overviewHomeKey,
    isOverview,
    useDetailHorizontal,
    viewMode,
    renderSyncRevision,
    setNodes,
    setEdges,
    emitRoutedHandleSync,
    applyAutoNodeNumbers,
  ])

  const detailRefreshNodeIds = useMemo(() => nodes.map((node) => node.id), [nodes])

  const refreshDetailEdgesAfterPaint = useCallback(() => {
    if (isOverview) return
    const placed = flowNodesToPlaced(nodesRef.current)
    if (placed.length === 0) return
    const refreshedEdges = rebuildLayoutEdges(layoutProcess, placed, {
      overviewVertical: false,
      detailHorizontal: useDetailHorizontal,
      laneBands: laneBandsRef.current,
    }).map((edge) => applyEdgeHighlightStyle(edge, overviewHighlight))
    edgesRef.current = refreshedEdges
    setEdges(refreshedEdges)
    emitRoutedHandleSync(refreshedEdges)
  }, [emitRoutedHandleSync, isOverview, layoutProcess, overviewHighlight, setEdges, useDetailHorizontal])

  /** label/condition 등 레이아웃 무관 메타 변경 — 전체 재배치 없이 캔버스 데이터만 동기화 */
  useEffect(() => {
    setEdges((current) => {
      const edgeById = new Map(layoutProcess.edges.map((edge) => [edge.id, edge]))
      let changed = false
      const next = current.map((flowEdge) => {
        const source = edgeById.get(flowEdge.id)
        if (!source) return flowEdge
        const nextLabel = source.label || undefined
        const currentData = flowEdge.data as import('../../lib/layout/elkLayout').ProcessEdgeData | undefined
        const routeLabelPoint = currentData?.routeLabelPoint
        const nextLabelPoint =
          isFinitePoint(source.labelPlacement?.offset) && isFinitePoint(routeLabelPoint)
            ? {
                x: routeLabelPoint.x + source.labelPlacement.offset.x,
                y: routeLabelPoint.y + source.labelPlacement.offset.y,
              }
            : isFinitePoint(source.labelPlacement?.point)
              ? source.labelPlacement.point
              : undefined
        const currentPoint = currentData?.labelPoint
        const sameLabelPoint =
          (!nextLabelPoint && !source.labelPlacement && currentData?.labelPlacement == null) ||
          (nextLabelPoint?.x === currentPoint?.x && nextLabelPoint?.y === currentPoint?.y)
        if (flowEdge.label === nextLabel && sameLabelPoint) return flowEdge
        changed = true
        return {
          ...flowEdge,
          label: nextLabel,
          data: {
            ...currentData,
            ...(source.labelPlacement ? { labelPlacement: source.labelPlacement } : { labelPlacement: undefined }),
            labelPoint: nextLabelPoint,
          },
        }
      })
      return changed ? next : current
    })
  }, [layoutProcess.edges, setEdges])

  useEffect(() => {
    setNodes((current) => {
      const nodeById = new Map(layoutProcess.nodes.map((node) => [node.id, node]))
      let changed = false
      const next = current.map((flowNode) => {
        const source = nodeById.get(flowNode.id)
        if (!source) return flowNode
        const rebuilt = buildProcessFlowNode(
          source,
          layoutProcess,
          flowNodeToPlaced(flowNode),
          flowNode.data.compact,
          isOverview ? 'overview' : 'detail',
          autoNodeNumberMap.get(source.id),
          showNodeNumbers,
        )
        if (
          flowNode.type === rebuilt.type &&
          flowNode.className === rebuilt.className &&
          flowNode.zIndex === rebuilt.zIndex &&
          shallowRecordMatches(
            flowNode.style as Record<string, unknown> | undefined,
            rebuilt.style as Record<string, unknown> | undefined,
          ) &&
          flowNodeDataMatches(flowNode.data, rebuilt.data)
        ) {
          return flowNode
        }
        changed = true
        return {
          ...flowNode,
          type: rebuilt.type,
          className: rebuilt.className,
          style: rebuilt.style,
          zIndex: rebuilt.zIndex,
          data: rebuilt.data,
        }
      })
      return changed ? applyReviewModeToNodes(next, layoutProcess, reviewMode) : applyReviewModeToNodes(current, layoutProcess, reviewMode)
    })
  }, [autoNodeNumberMap, layoutProcess, setNodes, isOverview, reviewMode, showNodeNumbers])

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  /** layout 재계산 후 선택 edge의 router handle을 패널과 동기화 */
  useEffect(() => {
    if (!selectedEdgeId || !isEditMode) return
    const flowEdge = edges.find((edge) => edge.id === selectedEdgeId)
    if (!flowEdge) return
    const next = buildSelectedEdgeFromFlow(process, flowEdge)
    if (next && !edgeSelectionDataMatches(selectedElement, next)) onSelectElement(next)
  }, [edges, selectedEdgeId, selectedElement, isEditMode, process, onSelectElement])

  useEffect(() => {
    if (!panelInsetRight) return

    const scrollEl = isOverview ? overviewScrollRef.current : detailScrollRef.current
    if (!scrollEl) return

    const run = () => {
      if (selectedNodeId) {
        compensatePanelScroll(scrollEl, selectedNodeId, panelInsetRight)
      }
    }

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [panelInsetRight, selectedNodeId, isOverview, fitTrigger, detailScale, overviewScale])

  useEffect(() => {
    setNodes((current) => {
      let changed = false
      const next = current.map((node) => {
        const styled = applyNodeHighlightStyle(node, overviewHighlight)
        const reviewStatus =
          layoutProcess.nodes.find((entry) => entry.id === node.id)?.review?.status ?? 'not-reviewed'
        const updated = {
          ...styled,
          data: {
            ...styled.data,
            reviewMode,
            reviewStatus,
          },
          selected: selectedNodeIdSet.has(node.id),
          draggable: isEditMode && !isEditingOverviewProcessGroup,
          selectable: isEditMode && !isEditingOverviewProcessGroup,
          connectable: isEditMode && !isEditingOverviewProcessGroup,
          zIndex: selectedNodeIdSet.has(node.id) || node.id === selectedNodeId ? 4 : 3,
        }
        if (flowNodeViewStateMatches(node, updated)) return node
        changed = true
        return updated
      })
      return changed ? next : current
    })
  }, [selectedNodeId, selectedNodeIdSet, overviewHighlight, isEditMode, isEditingOverviewProcessGroup, setNodes, reviewMode, layoutProcess.nodes])

  useEffect(() => {
    setEdges((current) => {
      let changed = false
      const next = current.map((edge) => {
        const styled = applyEdgeHighlightStyle(edge, overviewHighlight)
        const updated = {
          ...styled,
          selectable: isEditMode,
          focusable: isEditMode,
          selected: selectedEdgeIdSet.has(edge.id),
          zIndex: selectedEdgeIdSet.has(edge.id) || edge.id === selectedEdgeId ? 4 : 2,
        }
        if (flowEdgeViewStateMatches(edge, updated)) return edge
        changed = true
        return updated
      })
      return changed ? next : current
    })
  }, [selectedEdgeId, selectedEdgeIdSet, overviewHighlight, isEditMode, setEdges])

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (!isEditMode) return
      if (isEditingOverviewProcessGroup) return
      if (selectedNodes.length > 0) {
        // Node selection is owned by SelectionManager. ReactFlow emits a single-node
        // selection after click; using it here would collapse Ctrl/Cmd multi-selection.
        return
      }
      if (selectedEdges.length > 0) {
        if (selectedEdges[0].id === selectedEdgeId) return
        onSelectedEdgeIdsChange?.([selectedEdges[0].id], { source: 'canvas' })
        const flowEdge =
          edgesRef.current.find((edge) => edge.id === selectedEdges[0].id) ?? selectedEdges[0]
        const next = buildSelectedEdgeFromFlow(process, flowEdge)
        if (next) onSelectElement(next)
      }
    },
    [
      isEditMode,
      isEditingOverviewProcessGroup,
      selectedEdgeId,
      process,
      onSelectElement,
      onSelectedEdgeIdsChange,
    ],
  )

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation()
      setNodeContextMenu(null)
      const snapshot = onSelectedNodeIdsChange?.([node.id], {
        source: 'canvas',
        toggle: event.ctrlKey || event.metaKey,
        additive: event.shiftKey,
        range: event.shiftKey,
      })
      const nextSelectedNodeId =
        event.ctrlKey || event.metaKey
          ? (snapshot?.nodeIds.includes(node.id) ? node.id : snapshot?.primaryNodeId)
          : node.id
      if (!nextSelectedNodeId) {
        onSelectElement(null)
        return
      }
      const next = buildSelectedNode(process, nextSelectedNodeId)
      if (!next) return
      onSelectElement(next)
    },
    [process, onSelectElement, onSelectedNodeIdsChange],
  )

  const onNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      if (!isEditMode || isEditingOverviewProcessGroup) return
      event.preventDefault()
      event.stopPropagation()
      const nodeIds = selectedNodeIdSet.has(node.id) && selectedNodeIds.length > 0
        ? selectedNodeIds
        : [node.id]
      if (!selectedNodeIdSet.has(node.id)) onSelectedNodeIdsChange?.([node.id], { source: 'canvas' })
      const next = buildSelectedNode(process, node.id)
      if (next) onSelectElement(next)
      setNodeContextMenu({ nodeId: node.id, nodeIds, x: event.clientX, y: event.clientY })
    },
    [isEditMode, isEditingOverviewProcessGroup, onSelectElement, onSelectedNodeIdsChange, process, selectedNodeIdSet, selectedNodeIds],
  )

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (event, flowEdge) => {
      if (!isEditMode) return
      if (isEditingOverviewProcessGroup) return
      event.stopPropagation()
      setNodeContextMenu(null)
      setEdgeContextMenu(null)
      onSelectedEdgeIdsChange?.([flowEdge.id], {
        source: 'canvas',
        toggle: event.ctrlKey || event.metaKey,
        additive: event.shiftKey,
        range: event.shiftKey,
      })
      const next = buildSelectedEdgeFromFlow(process, flowEdge)
      if (next) onSelectElement(next)
    },
    [isEditMode, isEditingOverviewProcessGroup, process, onSelectElement, onSelectedEdgeIdsChange],
  )

  const onEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, flowEdge) => {
      if (!isEditMode || isEditingOverviewProcessGroup) return
      event.preventDefault()
      event.stopPropagation()
      setNodeContextMenu(null)
      onSelectedEdgeIdsChange?.([flowEdge.id], { source: 'canvas' })
      const next = buildSelectedEdgeFromFlow(process, flowEdge)
      if (next) onSelectElement(next)
      setEdgeContextMenu({ edgeId: flowEdge.id, x: event.clientX, y: event.clientY })
    },
    [isEditMode, isEditingOverviewProcessGroup, onSelectElement, onSelectedEdgeIdsChange, process],
  )

  const handleEdgeLabelSelect = useCallback(
    (edgeId: string) => {
      if (!isEditMode || isEditingOverviewProcessGroup) return
      const flowEdge = edgesRef.current.find((edge) => edge.id === edgeId)
      if (!flowEdge) return
      onSelectedEdgeIdsChange?.([edgeId], { source: 'canvas' })
      const next = buildSelectedEdgeFromFlow(process, flowEdge)
      if (next && !edgeSelectionDataMatches(selectedElement, next)) onSelectElement(next)
    },
    [isEditMode, isEditingOverviewProcessGroup, process, selectedElement, onSelectElement, onSelectedEdgeIdsChange],
  )

  const onPaneClick = useCallback(() => {
    onPaneBodyClick?.()
    if (!isEditMode) return
    if (isEditingOverviewProcessGroup) return
    setNodeContextMenu(null)
    setEdgeContextMenu(null)
    onSelectedNodeIdsChange?.([], { source: 'canvas' })
    onClearSelection()
  }, [isEditMode, isEditingOverviewProcessGroup, onClearSelection, onPaneBodyClick, onSelectedNodeIdsChange])

  const onLaneClick = useCallback(
    (laneId: string) => {
      if (!isEditMode) return
      const next = buildSelectedLane(process, laneId)
      if (next) onSelectElement(next)
    },
    [isEditMode, process, onSelectElement],
  )

  const onOverviewZoneClick = useCallback(
    (zoneId: string) => {
      if (!isEditMode) return
      const next = buildSelectedOverviewZone(zoneId as ProcessZoneId)
      if (next) onSelectElement(next)
    },
    [isEditMode, onSelectElement],
  )

  const onZoneClick = useCallback(
    (zoneId: string) => {
      const next = buildSelectedZone(process, zoneId)
      if (next) onSelectElement(next)
    },
    [process, onSelectElement],
  )

  const onNodeDragStop: OnNodeDrag<Node<ProcessNodeData>> = useCallback(
    (_event, node) => {
      if (!isEditMode) return
      setDropPreview(null)
      const placed = flowNodesToPlaced(nodesRef.current)
      const self = placed.find((p) => p.id === node.id)
      if (!self) return

      const placementPatches = resolveNodePlacementPatchesAfterDrag(
        process,
        node.id,
        {
          x: node.position.x,
          y: node.position.y,
          width: self.width,
          height: self.height,
        },
        {
          laneBands: laneBandsRef.current,
          zoneBands: zoneBandsRef.current,
          placed,
          isOverview,
          detailHorizontal: useDetailHorizontal,
        },
      )
      if (placementPatches.length > 0) {
        if (onNodePlacementChanges) {
          onNodePlacementChanges(placementPatches)
        } else {
          const first = placementPatches[0]
          if (first) onNodePlacementChange(first.nodeId, first.patch)
        }
      }

      const placedForEdges = placed.map((entry) =>
        entry.id === node.id
          ? {
              ...entry,
              x: node.position.x,
              y: node.position.y,
            }
          : entry,
      )
      nodesRef.current = nodesRef.current.map((entry) =>
        entry.id === node.id
          ? {
              ...entry,
              position: {
                x: node.position.x,
                y: node.position.y,
              },
            }
          : entry,
      )
      const refreshedEdges = rebuildLayoutEdges(layoutProcess, placedForEdges, {
        overviewVertical: isOverview,
        detailHorizontal: useDetailHorizontal,
        laneBands: laneBandsRef.current,
      }).map((edge) => applyEdgeHighlightStyle(edge, overviewHighlight))
      edgesRef.current = refreshedEdges
      setEdges(refreshedEdges)
      emitRoutedHandleSync(refreshedEdges)
    },
    [
      emitRoutedHandleSync,
      isEditMode,
      isOverview,
      layoutProcess,
      onNodePlacementChange,
      onNodePlacementChanges,
      overviewHighlight,
      setEdges,
      useDetailHorizontal,
      process,
    ],
  )

  const onNodeDrag: OnNodeDrag<Node<ProcessNodeData>> = useCallback(
    (_event, node) => {
      if (!isEditMode || !isOverview || isEditingOverviewProcessGroup) return
      const placed = flowNodesToPlaced(nodesRef.current)
      const self = placed.find((p) => p.id === node.id)
      if (!self) return
      const preview = resolveDropPlacementPreview(
        {
          x: node.position.x,
          y: node.position.y,
          width: self.width,
          height: self.height,
        },
        {
          laneBands: laneBandsRef.current,
          zoneBands: zoneBandsRef.current,
          isOverview,
        },
      )
      setDropPreview(preview)
    },
    [isEditMode, isOverview, isEditingOverviewProcessGroup],
  )

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!isEditMode || !connection.source || !connection.target) return
      const edge = createDefaultEdge(process)
      edge.source = connection.source
      edge.target = connection.target
      edge.routing = {
        mode: 'auto',
        sourceHandle: parseHandleId(connection.sourceHandle),
        targetHandle: parseHandleId(connection.targetHandle),
      }
      onConnectEdge(edge)
    },
    [isEditMode, process, onConnectEdge],
  )

  const defaultEdgeOptions = useMemo(() => ({ type: 'normalEdge' }), [])

  const edgeEditContextValue = useMemo(
    () => ({
      appMode,
      selectedEdgeId,
      onEdgeSelect: handleEdgeLabelSelect,
      onEdgeRoutingChange: ({ edgeId, routing }: { edgeId: string; routing: ProcessEdge['routing'] }) => {
        onEdgeRoutingChange(edgeId, routing)
      },
      onEdgeLabelPlacementChange,
    }),
    [appMode, selectedEdgeId, handleEdgeLabelSelect, onEdgeRoutingChange, onEdgeLabelPlacementChange],
  )

  const overviewLayout = useMemo(() => {
    if (!canvasBounds || !isOverview) return null
    const scaledHeight = canvasBounds.height * overviewScale
    return { scaledHeight }
  }, [canvasBounds, overviewScale, isOverview])

  const detailLayout = useMemo(() => {
    if (!canvasBounds || isOverview) return null
    const scaledHeight = canvasBounds.height * detailScale
    return { scaledHeight }
  }, [canvasBounds, detailScale, isOverview])

  const isDetailSingleLane = isDetailVertical && isDetailSingleLaneProcess(process.nodes)

  const layoutProcessForGrid = useMemo(
    () =>
      isDetailVertical
        ? { ...process, lanes: resolveDetailLayoutLanes(process, process.nodes) }
        : process,
    [process, isDetailVertical],
  )

  const swimlaneGrid = useMemo(() => {
    if (!isOverview && useDetailHorizontal) {
      return {
        ...DETAIL_SWIMLANE_GRID,
        laneCount: 1,
        laneWidth: Math.max(LANE_WIDTH, canvasBounds?.width ?? LANE_WIDTH),
        leftLabelWidth: 0,
      }
    }
    const baseGrid = isDetailVertical ? DETAIL_SWIMLANE_GRID : OVERVIEW_SWIMLANE_GRID
    const built = buildSwimlaneGridFromProcess(
      layoutProcessForGrid,
      isDetailVertical ? 0 : LEFT_LABEL_WIDTH,
      LANE_WIDTH,
      baseGrid.laneHeaderHeight,
      baseGrid.returnRouteColumnWidth,
    )
    if (!isDetailVertical) return built
    if (isDetailSingleLane) {
      return {
        ...built,
        laneCount: 1,
        laneWidth: built.laneWidth,
        leftLabelWidth: 0,
      }
    }
    return {
      ...built,
      laneCount: SWIMLANE_LANE_COUNT,
      laneWidth: LANE_WIDTH,
      leftLabelWidth: 0,
    }
  }, [layoutProcessForGrid, isDetailVertical, isDetailSingleLane, isOverview, useDetailHorizontal, canvasBounds?.width])

  const scrollContentWidth = useMemo(() => {
    const scale = isOverview ? overviewScale : detailScale
    if (isOverview) {
      const layoutWidth = Math.max(
        gridContentWidth(swimlaneGrid),
        canvasBounds?.width ?? 0,
      )
      return scaledGridContentWidth(swimlaneGrid, scale, layoutWidth)
    }
    if (!isOverview && useDetailHorizontal) {
      return Math.max(320, (canvasBounds?.width ?? 0) * detailScale)
    }
    const scaledLaneArea = swimlaneLaneAreaWidth(swimlaneGrid) * scale
    const scaledCanvas = (canvasBounds?.width ?? 0) * scale
    return Math.max(scaledLaneArea, scaledCanvas)
  }, [swimlaneGrid, canvasBounds?.width, isOverview, useDetailHorizontal, overviewScale, detailScale])

  const flowContent = (
    <ReactFlow
      key={flowInstanceKey}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodeClick={onNodeClick}
      onNodeContextMenu={onNodeContextMenu}
      onEdgeClick={onEdgeClick}
      onEdgeContextMenu={onEdgeContextMenu}
      onSelectionChange={onSelectionChange}
      onPaneClick={onPaneClick}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      defaultEdgeOptions={defaultEdgeOptions}
      minZoom={0.05}
      maxZoom={isOverview ? 1 : 1.45}
      proOptions={{ hideAttribution: true }}
      elevateEdgesOnSelect={false}
      elevateNodesOnSelect
      nodesDraggable={isEditMode && !isEditingOverviewProcessGroup}
      nodesConnectable={isEditMode && !isEditingOverviewProcessGroup}
      elementsSelectable={isEditMode && !isEditingOverviewProcessGroup}
      nodesFocusable
      edgesFocusable={isEditMode && !isEditingOverviewProcessGroup}
      deleteKeyCode={null}
      selectNodesOnDrag={false}
      connectionRadius={24}
      panOnDrag={!isOverview && !isDetailVertical}
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch={!isOverview}
      zoomOnDoubleClick={!isOverview}
      preventScrolling={false}
    >
      {isOverview && overviewLayout && (
        <>
          <LayoutViewportSync
            nodeLayoutKey={nodeTopologyKey}
            edgeRoutingKey={edgeRoutingKey}
            scrollRef={overviewScrollRef}
          />
          <OverviewViewport
            trigger={fitTrigger}
            canvasBounds={canvasBounds ?? { width: 0, height: 0, topPadding: 0, bottomPadding: 0 }}
            onScaleChange={setOverviewScale}
            scrollRef={overviewScrollRef}
          />
          <OverviewScrollBridge
            trigger={fitTrigger}
            scale={overviewScale}
            contentHeight={overviewLayout.scaledHeight}
            scrollRef={overviewScrollRef}
          />
        </>
      )}
      {!isOverview && detailLayout && (
        <>
          <DetailEdgeRefresh
            trigger={detailEdgeRefreshKey}
            nodeIds={detailRefreshNodeIds}
            onRefresh={refreshDetailEdgesAfterPaint}
          />
          <LayoutViewportSync
            nodeLayoutKey={nodeTopologyKey}
            edgeRoutingKey={edgeRoutingKey}
            scrollRef={detailScrollRef}
          />
          <DetailViewport
            trigger={fitTrigger}
            nodes={nodes}
            canvasBounds={canvasBounds ?? { width: 0, height: 0, topPadding: 0, bottomPadding: 0 }}
            gridConfig={swimlaneGrid}
            fitWidth={!useDetailHorizontal}
            onScaleChange={setDetailScale}
            scrollRef={detailScrollRef}
          />
          <DetailScrollBridge
            trigger={fitTrigger}
            scale={detailScale}
            contentHeight={detailLayout.scaledHeight}
            scrollRef={detailScrollRef}
          />
        </>
      )}
      {canvasBounds && (
        <SwimlaneOverlay
          laneBands={displayLaneBands}
          canvasBounds={canvasBounds}
          layoutOrientation={layoutOrientation}
          zoneBands={isOverview ? zoneBands : []}
          hideLaneHeader={layoutOrientation === 'vertical'}
          hideZoneColumn={isDetailVertical}
          editMode={isEditMode}
          selectedLaneId={selectedLaneId}
          selectedOverviewZoneId={selectedOverviewZoneId}
          onLaneSelect={(laneId) => {
            onLaneClick(laneId)
          }}
          onOverviewZoneSelect={onOverviewZoneClick}
        />
      )}
      <ProcessZoneOverlay
        process={process}
        flowNodes={nodes}
        selectedZoneId={selectedZoneId}
        editMode={isEditMode}
        onZoneSelect={onZoneClick}
      />
      <Background gap={24} size={1} color="#e8edf2" />
      {isOverview && <OverviewDropPreview preview={dropPreview} />}
      {nodeContextMenu && (
        <div
          className="process-map-context-menu nodrag nopan"
          style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
        >
          <button
            type="button"
            onClick={() => {
              onCopyNodes?.(nodeContextMenu.nodeIds)
              setNodeContextMenu(null)
            }}
          >
            <span>복사</span>
            <kbd>{getShortcut('copy')}</kbd>
          </button>
          <button
            type="button"
            onClick={() => {
              onPasteClipboard?.()
              setNodeContextMenu(null)
            }}
          >
            <span>붙여넣기</span>
            <kbd>{getShortcut('paste')}</kbd>
          </button>
          <button
            type="button"
            onClick={() => {
              onDuplicateNodes?.(nodeContextMenu.nodeIds)
              setNodeContextMenu(null)
            }}
          >
            <span>복제</span>
            <kbd>{getShortcut('duplicate')}</kbd>
          </button>
          <button
            type="button"
            onClick={() => {
              onDeleteSelection?.()
              setNodeContextMenu(null)
            }}
          >
            <span>삭제</span>
            <kbd>{getShortcut('delete')}</kbd>
          </button>
        </div>
      )}
      {edgeContextMenu && (
        <div
          className="process-map-context-menu nodrag nopan"
          style={{ left: edgeContextMenu.x, top: edgeContextMenu.y }}
        >
          {onCopyEdge && (
            <button
              type="button"
              onClick={() => {
                onCopyEdge(edgeContextMenu.edgeId)
                setEdgeContextMenu(null)
              }}
            >
              <span>복사</span>
              <kbd>{getShortcut('copy')}</kbd>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onDeleteSelection?.()
              setEdgeContextMenu(null)
            }}
          >
            <span>삭제</span>
            <kbd>{getShortcut('delete')}</kbd>
          </button>
          <button
            type="button"
            onClick={() => {
              setEdgeContextMenu(null)
            }}
          >
            <span>Handle 변경</span>
          </button>
        </div>
      )}
      {!isOverview && <Controls showInteractive={false} />}
      {!isOverview && (
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) => {
            const type = node.data?.type as keyof typeof NODE_TYPE_COLORS | undefined
            return NODE_TYPE_COLORS[type ?? DEFAULT_NODE_TYPE]
          }}
          maskColor="rgba(248,250,252,0.85)"
        />
      )}
    </ReactFlow>
  )

  return (
    <div
      className={`process-map-canvas${isOverview ? ' process-map-canvas--overview' : layoutOrientation === 'horizontal' ? ' process-map-canvas--detail-horizontal' : ' process-map-canvas--detail-vertical'}${isEditMode ? ' process-map-canvas--edit' : ''}${panelInsetRight > 0 ? ' process-map-canvas--panel-open' : ''}`}
      style={
        panelInsetRight > 0
          ? { ['--panel-inset-right' as string]: `${panelInsetRight}px` }
          : undefined
      }
    >
      <EditorContextProvider appMode={appMode}>
      <EdgeEditContext.Provider value={edgeEditContextValue}>
      {isOverview ? (
        <div className="process-map-canvas__scroll" ref={overviewScrollRef}>
          <div
            className="process-map-canvas__scroll-content"
            style={{ width: scrollContentWidth }}
          >
            <OverviewStickyHeader
              lanes={process.lanes}
              scale={overviewScale}
              contentWidth={scrollContentWidth}
              gridConfig={swimlaneGrid}
              editMode={isEditMode}
              selectedLaneId={selectedLaneId}
              onLaneSelect={(laneId) => {
                onLaneClick(laneId)
              }}
            />
            <div
              className="process-map-canvas__scroll-track"
              style={
                overviewLayout
                  ? { width: scrollContentWidth, height: overviewLayout.scaledHeight }
                  : { width: scrollContentWidth }
              }
            >
              <div
                className="process-map-canvas__flow-sticky"
                style={{ width: scrollContentWidth }}
              >
                {flowContent}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="process-map-canvas__scroll process-map-canvas__scroll--detail"
          ref={detailScrollRef}
        >
          <div
            className="process-map-canvas__scroll-content"
            style={{ width: scrollContentWidth }}
          >
            {isDetailVertical && (
              <OverviewStickyHeader
                lanes={resolveDetailLayoutLanes(process, process.nodes)}
                scale={detailScale}
                contentWidth={scrollContentWidth}
                gridConfig={swimlaneGrid}
                editMode={isEditMode}
                selectedLaneId={selectedLaneId}
                inactiveLaneIds={detailUsedLaneIds}
                hideZoneColumn
                onLaneSelect={(laneId) => {
                  onLaneClick(laneId)
                }}
              />
            )}
            <div
              className="process-map-canvas__scroll-track"
              style={
                detailLayout
                  ? { width: scrollContentWidth, height: detailLayout.scaledHeight }
                  : { width: scrollContentWidth }
              }
            >
              <div
                className="process-map-canvas__flow-sticky process-map-canvas__flow-sticky--detail"
                style={{ width: scrollContentWidth }}
              >
                {flowContent}
              </div>
            </div>
          </div>
        </div>
      )}
      </EdgeEditContext.Provider>
      </EditorContextProvider>
    </div>
  )
}
