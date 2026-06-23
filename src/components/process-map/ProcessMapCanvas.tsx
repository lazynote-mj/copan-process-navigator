import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
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

import type { Edge as ProcessEdge, Process, ProcessZoneId } from '../../types/process'
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
import { resolveNodePlacementAfterDrag } from '../../lib/editor/resolveDragPlacement'
import type { OverviewHighlight, ViewMode } from '../../lib/editor/viewModeTypes'
import { isEdgeGroupHighlighted } from '../../lib/editor/processGroupMembership'
import { createDefaultEdge } from '../../lib/editor/processEditor'
import { compensatePanelScroll } from '../../lib/layout/panelScrollCompensation'
import { getLayoutedElements, rebuildLayoutEdges, type CanvasBounds, type LaneBand, type ProcessNodeData } from '../../lib/layout/elkLayout'
import { buildProcessFlowNode } from '../../lib/buildProcessFlowNode'
import { getProcessEdgeRoutingKey, getProcessNodeLayoutKey } from '../../lib/layout/processLayoutKey'
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

type ProcessMapCanvasProps = {
  process: Process
  viewMode: ViewMode
  appMode: AppMode
  selectedElement: SelectedElement | null
  overviewHighlight?: OverviewHighlight | null
  /** Overview 홈(전체 보기) 복귀 시 viewport 리셋 트리거 */
  overviewHomeKey?: number
  panelInsetRight?: number
  onSelectElement: (element: SelectedElement | null) => void
  onClearSelection: () => void
  onEdgeRoutingChange: (edgeId: string, routing: ProcessEdge['routing']) => void
  onEdgeLabelPlacementChange: (edgeId: string, labelPlacement: ProcessEdge['labelPlacement']) => void
  onConnectEdge: (edge: ProcessEdge) => void
  onNodePlacementChange: (nodeId: string, patch: Partial<import('../../types/process').Node>) => void
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
    flowData.localOrder === nextData.localOrder &&
    flowData.decisionSubtitle === nextData.decisionSubtitle
  )
}

function flowNodeToPlaced(flowNode: Node<ProcessNodeData>): PlacedNode & { cell3Col?: boolean } {
  return {
    id: flowNode.id,
    laneId: flowNode.data.laneId,
    x: flowNode.position.x,
    y: flowNode.position.y,
    width: flowNode.measured?.width ?? flowNode.width ?? 180,
    height: flowNode.measured?.height ?? flowNode.height ?? 56,
    cell3Col: flowNode.data.cell3Col,
  }
}

function flowNodesToPlaced(nodes: Node<ProcessNodeData>[]): PlacedNode[] {
  return nodes.map((node) => flowNodeToPlaced(node))
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
  overviewHighlight,
  overviewHomeKey = 0,
  panelInsetRight = 0,
  onSelectElement,
  onClearSelection,
  onEdgeRoutingChange,
  onEdgeLabelPlacementChange,
  onConnectEdge,
  onNodePlacementChange,
  onRoutedHandlesSync,
}: ProcessMapCanvasProps) {
  const isEditMode = appMode === 'edit'
  const selectedNodeId = selectedElement?.type === 'node' ? selectedElement.id : null
  const selectedEdgeId = selectedElement?.type === 'edge' ? selectedElement.id : null
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

  const laneBandsRef = useRef<LaneBand[]>([])
  const zoneBandsRef = useRef<ZoneLayoutBand[]>([])
  const nodesRef = useRef<Node<ProcessNodeData>[]>([])
  const edgesRef = useRef<Edge[]>([])

  const overviewScrollRef = useRef<HTMLDivElement>(null)
  const detailScrollRef = useRef<HTMLDivElement>(null)

  const isOverview = viewMode === 'overview'
  const useDetailHorizontal = !isOverview
  const isDetailVertical = !isOverview && !useDetailHorizontal
  const detailUsedLaneIds = useMemo(
    () => new Set(layoutProcess.nodes.map((node) => node.laneId)),
    [layoutProcess.nodes],
  )

  const nodeLayoutKey = useMemo(() => getProcessNodeLayoutKey(layoutProcess), [layoutProcess])
  const edgeRoutingKey = useMemo(() => getProcessEdgeRoutingKey(layoutProcess), [layoutProcess])
  const flowInstanceKey = `${viewMode}:${layoutProcess.id}`

  const highlightKey = `${overviewHighlight?.groupId ?? 'all'}:${overviewHighlight?.mode ?? 'all'}`
  const structureKey = `${nodeLayoutKey}|${viewMode}|${highlightKey}`

  const prevStructureKeyRef = useRef('')
  const prevEdgeRoutingKeyRef = useRef('')
  const layoutInitializedRef = useRef(false)

  const emitRoutedHandleSync = useCallback(
    (flowEdges: Edge[]) => {
      if (!onRoutedHandlesSync) return
      const patches = collectRoutedHandleSyncPatches(layoutProcess.edges, flowEdges)
      if (patches.length > 0) onRoutedHandlesSync(patches)
    },
    [layoutProcess.edges, onRoutedHandlesSync],
  )

  useEffect(() => {
    if (!isOverview) return
    setFitTrigger(`${nodeLayoutKey}-${viewMode}-${highlightKey}-home${overviewHomeKey}`)
  }, [overviewHomeKey, isOverview, nodeLayoutKey, viewMode, highlightKey])

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
      const styledNodes = result.nodes.map((node) => applyNodeHighlightStyle(node, overviewHighlight))
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
      setFitTrigger(`${nodeLayoutKey}-${viewMode}-${highlightKey}-home${overviewHomeKey}`)
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
    }
  }, [
    structureKey,
    edgeRoutingKey,
    nodeLayoutKey,
    highlightKey,
    layoutProcess,
    overviewHighlight,
    overviewHomeKey,
    isOverview,
    useDetailHorizontal,
    viewMode,
    setNodes,
    setEdges,
    emitRoutedHandleSync,
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
          source.labelPlacement?.offset && routeLabelPoint
            ? {
                x: routeLabelPoint.x + source.labelPlacement.offset.x,
                y: routeLabelPoint.y + source.labelPlacement.offset.y,
              }
            : source.labelPlacement?.point
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
        )
        if (flowNodeDataMatches(flowNode.data, rebuilt.data)) return flowNode
        changed = true
        return { ...flowNode, data: rebuilt.data }
      })
      return changed ? next : current
    })
  }, [layoutProcess, setNodes, isOverview])

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
    if (next) onSelectElement(next)
  }, [edges, selectedEdgeId, isEditMode, process, onSelectElement])

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
    setNodes((current) =>
      current.map((node) => ({
        ...applyNodeHighlightStyle(node, overviewHighlight),
        selected: node.id === selectedNodeId,
        draggable: isEditMode,
        selectable: isEditMode,
        connectable: isEditMode,
        zIndex: node.id === selectedNodeId ? 4 : 3,
      })),
    )
  }, [selectedNodeId, overviewHighlight, isEditMode, setNodes])

  useEffect(() => {
    setEdges((current) =>
      current.map((edge) => ({
        ...applyEdgeHighlightStyle(edge, overviewHighlight),
        selected: edge.id === selectedEdgeId,
        selectable: isEditMode,
        focusable: isEditMode,
        zIndex: edge.id === selectedEdgeId ? 4 : 2,
      })),
    )
  }, [selectedEdgeId, overviewHighlight, isEditMode, setEdges])

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }) => {
      if (!isEditMode) return
      if (selectedNodes.length > 0) {
        const next = buildSelectedNode(process, selectedNodes[0].id)
        if (next) onSelectElement(next)
        return
      }
      if (selectedEdges.length > 0) {
        const flowEdge =
          edgesRef.current.find((edge) => edge.id === selectedEdges[0].id) ?? selectedEdges[0]
        const next = buildSelectedEdgeFromFlow(process, flowEdge)
        if (next) onSelectElement(next)
      }
    },
    [isEditMode, process, onSelectElement],
  )

  const onNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      event.stopPropagation()
      const next = buildSelectedNode(process, node.id)
      if (!next) return
      onSelectElement(next)
    },
    [process, onSelectElement],
  )

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (event, flowEdge) => {
      if (!isEditMode) return
      event.stopPropagation()
      const next = buildSelectedEdgeFromFlow(process, flowEdge)
      if (next) onSelectElement(next)
    },
    [isEditMode, process, onSelectElement],
  )

  const onPaneClick = useCallback(() => {
    if (!isEditMode) return
    onClearSelection()
  }, [isEditMode, onClearSelection])

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
      const placed = flowNodesToPlaced(nodesRef.current)
      const self = placed.find((p) => p.id === node.id)
      if (!self) return

      const patch = resolveNodePlacementAfterDrag(
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
      if (Object.keys(patch).length > 0) {
        onNodePlacementChange(node.id, patch)
      }
    },
    [isEditMode, process, isOverview, onNodePlacementChange, useDetailHorizontal],
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
      onEdgeRoutingChange: ({ edgeId, routing }: { edgeId: string; routing: ProcessEdge['routing'] }) => {
        onEdgeRoutingChange(edgeId, routing)
      },
      onEdgeLabelPlacementChange,
    }),
    [appMode, selectedEdgeId, onEdgeRoutingChange, onEdgeLabelPlacementChange],
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
      onEdgeClick={onEdgeClick}
      onSelectionChange={onSelectionChange}
      onPaneClick={onPaneClick}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      defaultEdgeOptions={defaultEdgeOptions}
      minZoom={0.05}
      maxZoom={isOverview ? 1 : 1.45}
      proOptions={{ hideAttribution: true }}
      elevateEdgesOnSelect={false}
      elevateNodesOnSelect
      nodesDraggable={isEditMode}
      nodesConnectable={isEditMode}
      elementsSelectable={isEditMode}
      nodesFocusable
      edgesFocusable={isEditMode}
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
            nodeLayoutKey={nodeLayoutKey}
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
            nodeLayoutKey={nodeLayoutKey}
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
          laneBands={laneBands}
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
