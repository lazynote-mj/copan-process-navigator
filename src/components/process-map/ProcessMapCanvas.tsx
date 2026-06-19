import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
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
import type { AppMode, SelectedElement } from '../../lib/editor/selectionTypes'
import {
  buildSelectedEdgeFromFlow,
  buildSelectedLane,
  buildSelectedNode,
  buildSelectedOverviewZone,
  buildSelectedZone,
} from '../../lib/editor/selectedElement'
import { EditorContextProvider } from '../../lib/editor/EditorContext'
import { resolveNodePlacementAfterDrag } from '../../lib/editor/resolveDragPlacement'
import type { OverviewHighlight, ViewMode } from '../../lib/editor/viewModeTypes'
import { createDefaultEdge } from '../../lib/editor/processEditor'
import { compensatePanelScroll } from '../../lib/layout/panelScrollCompensation'
import { getLayoutedElements, rebuildLayoutEdges, type CanvasBounds, type LaneBand, type ProcessNodeData } from '../../lib/layout/elkLayout'
import { getProcessEdgeRoutingKey, getProcessNodeLayoutKey } from '../../lib/layout/processLayoutKey'
import type { PlacedNode } from '../../lib/layout/laneLayout'
import type { ZoneLayoutBand } from '../../lib/layout/overviewGridLayout'
import {
  getSwimlaneGridConfig,
  gridContentWidth,
  scaledGridContentWidth,
} from '../../lib/layout/swimlaneGridLayout'
import ProcessNodeCard from './nodes/ProcessNodeCard'
import DecisionNodeCard from './nodes/DecisionNodeCard'
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
import { DetailInitialViewport } from './DetailInitialViewport'
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
  panelInsetRight?: number
  onSelectElement: (element: SelectedElement | null) => void
  onClearSelection: () => void
  onEdgeRoutingChange: (edgeId: string, routing: ProcessEdge['routing']) => void
  onConnectEdge: (edge: ProcessEdge) => void
  onNodePlacementChange: (nodeId: string, patch: Partial<import('../../types/process').Node>) => void
}

function filterProcessForHighlight(process: Process, highlight: OverviewHighlight): Process {
  const nodes = process.nodes.filter((n) => highlight.nodeIds.has(n.id))
  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = process.edges.filter(
    (e) =>
      highlight.edgeIds.has(e.id) ||
      (nodeIds.has(e.source) && nodeIds.has(e.target)),
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
  const isDimmed = highlight.mode === 'dim' && !isHighlighted

  return {
    ...node,
    className: [
      node.className,
      isHighlighted ? 'process-node-flow--highlighted' : '',
      isDimmed ? 'process-node-flow--dimmed' : '',
    ]
      .filter(Boolean)
      .join(' '),
    style: {
      ...node.style,
      opacity: isDimmed ? 0.15 : 1,
      filter: isDimmed ? 'grayscale(40%)' : undefined,
    },
  }
}

function isEdgeHighlighted(edgeId: string, highlight: OverviewHighlight): boolean {
  if (highlight.edgeIds.has(edgeId)) return true
  for (const id of highlight.edgeIds) {
    if (edgeId.startsWith(`${id}::`)) return true
  }
  return false
}

function applyEdgeHighlightStyle(
  edge: Edge,
  highlight: OverviewHighlight | null | undefined,
): Edge {
  if (!highlight || highlight.mode === 'all' || !highlight.groupId) {
    return edge
  }

  const isHighlighted = isEdgeHighlighted(edge.id, highlight)
  const isDimmed = highlight.mode === 'dim' && !isHighlighted
  const baseStyle = (edge.style ?? {}) as Record<string, unknown>
  const baseWidth = typeof baseStyle.strokeWidth === 'number' ? baseStyle.strokeWidth : 1.5

  return {
    ...edge,
    style: {
      ...baseStyle,
      opacity: isDimmed ? 0.15 : 1,
      strokeWidth: isHighlighted ? Math.max(baseWidth, 2.5) : baseWidth,
    },
  }
}

function parseHandleId(handle: string | null | undefined): EdgeHandleId | undefined {
  if (!handle) return undefined
  const match = handle.match(/(?:source|target)-(?<side>top|right|bottom|left)/)
  return (match?.groups?.side as EdgeHandleId | undefined) ?? undefined
}

function flowNodesToPlaced(nodes: Node<ProcessNodeData>[]): PlacedNode[] {
  return nodes.map((node) => ({
    id: node.id,
    laneId: node.data.laneId,
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? node.width ?? 180,
    height: node.measured?.height ?? node.height ?? 56,
  }))
}

export function ProcessMapCanvas({
  process,
  viewMode,
  appMode,
  selectedElement,
  overviewHighlight,
  panelInsetRight = 0,
  onSelectElement,
  onClearSelection,
  onEdgeRoutingChange,
  onConnectEdge,
  onNodePlacementChange,
}: ProcessMapCanvasProps) {
  const isEditMode = appMode === 'edit'
  const selectedNodeId = selectedElement?.type === 'node' ? selectedElement.id : null
  const selectedEdgeId = selectedElement?.type === 'edge' ? selectedElement.id : null
  const selectedLaneId = selectedElement?.type === 'lane' ? selectedElement.id : null
  const selectedZoneId = selectedElement?.type === 'zone' ? selectedElement.id : null
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

  const laneBandsRef = useRef<LaneBand[]>([])
  const zoneBandsRef = useRef<ZoneLayoutBand[]>([])
  const nodesRef = useRef<Node<ProcessNodeData>[]>([])
  const edgesRef = useRef<Edge[]>([])

  const overviewScrollRef = useRef<HTMLDivElement>(null)
  const detailScrollRef = useRef<HTMLDivElement>(null)

  const isOverview = viewMode === 'overview'
  const isDetailVertical = !isOverview
  const detailUsedLaneIds = useMemo(
    () => new Set(layoutProcess.nodes.map((node) => node.laneId)),
    [layoutProcess.nodes],
  )

  const nodeLayoutKey = useMemo(() => getProcessNodeLayoutKey(layoutProcess), [layoutProcess])
  const edgeRoutingKey = useMemo(() => getProcessEdgeRoutingKey(layoutProcess), [layoutProcess])

  const highlightKey = `${overviewHighlight?.groupId ?? 'all'}:${overviewHighlight?.mode ?? 'all'}`
  const structureKey = `${nodeLayoutKey}|${viewMode}|${highlightKey}`

  const prevStructureKeyRef = useRef('')
  const prevEdgeRoutingKeyRef = useRef('')
  const layoutInitializedRef = useRef(false)

  useEffect(() => {
    const structureChanged =
      prevStructureKeyRef.current !== structureKey || !layoutInitializedRef.current
    const edgeRoutingChanged = prevEdgeRoutingKeyRef.current !== edgeRoutingKey

    prevStructureKeyRef.current = structureKey
    prevEdgeRoutingKeyRef.current = edgeRoutingKey

    if (structureChanged) {
      layoutInitializedRef.current = true
      const result = getLayoutedElements(layoutProcess, { overviewVertical: isOverview })
      const styledNodes = result.nodes.map((node) => applyNodeHighlightStyle(node, overviewHighlight))
      const styledEdges = result.edges.map((edge) => applyEdgeHighlightStyle(edge, overviewHighlight))

      setNodes(styledNodes)
      setEdges(styledEdges)
      setLaneBands(result.laneBands)
      laneBandsRef.current = result.laneBands
      setZoneBands(result.zoneBands ?? [])
      zoneBandsRef.current = result.zoneBands ?? []
      setCanvasBounds(result.canvasBounds)
      setLayoutOrientation(result.layoutOrientation ?? 'horizontal')
      setFitTrigger(`${nodeLayoutKey}-${viewMode}-${highlightKey}`)
      return
    }

    if (edgeRoutingChanged) {
      const placed = flowNodesToPlaced(nodesRef.current)
      if (placed.length === 0) return

      const newEdges = rebuildLayoutEdges(layoutProcess, placed, {
        overviewVertical: isOverview,
        laneBands: laneBandsRef.current,
      })
      const styledEdges = newEdges.map((edge) => applyEdgeHighlightStyle(edge, overviewHighlight))
      setEdges(styledEdges)
    }
  }, [
    structureKey,
    edgeRoutingKey,
    nodeLayoutKey,
    highlightKey,
    layoutProcess,
    overviewHighlight,
    isOverview,
    viewMode,
    setNodes,
    setEdges,
  ])

  /** label/condition 등 레이아웃 무관 메타 변경 — 전체 재배치 없이 캔버스 데이터만 동기화 */
  useEffect(() => {
    setEdges((current) => {
      const edgeById = new Map(layoutProcess.edges.map((edge) => [edge.id, edge]))
      let changed = false
      const next = current.map((flowEdge) => {
        const source = edgeById.get(flowEdge.id)
        if (!source) return flowEdge
        const nextLabel = source.label || undefined
        if (flowEdge.label === nextLabel) return flowEdge
        changed = true
        return { ...flowEdge, label: nextLabel }
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
        if (!source || flowNode.data.name === source.name) return flowNode
        changed = true
        return { ...flowNode, data: { ...flowNode.data, name: source.name } }
      })
      return changed ? next : current
    })
  }, [layoutProcess.nodes, setNodes])

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
    if (!panelInsetRight || !selectedNodeId) return

    const scrollEl = isOverview ? overviewScrollRef.current : detailScrollRef.current
    if (!scrollEl) return

    const run = () => {
      compensatePanelScroll(scrollEl, selectedNodeId, panelInsetRight)
    }

    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(run)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [panelInsetRight, selectedNodeId, isOverview, fitTrigger])

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
      if (!isEditMode) return
      const next = buildSelectedZone(process, zoneId)
      if (next) onSelectElement(next)
    },
    [isEditMode, process, onSelectElement],
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
        { laneBands: laneBandsRef.current, zoneBands: zoneBandsRef.current, placed, isOverview },
      )
      if (Object.keys(patch).length > 0) {
        onNodePlacementChange(node.id, patch)
      }
    },
    [isEditMode, process, isOverview, onNodePlacementChange],
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
    }),
    [appMode, selectedEdgeId, onEdgeRoutingChange],
  )

  const overviewLayout = useMemo(() => {
    if (!canvasBounds || !isOverview) return null
    const scaledHeight = canvasBounds.height * overviewScale
    return { scaledHeight }
  }, [canvasBounds, overviewScale, isOverview])

  const swimlaneGrid = useMemo(
    () => getSwimlaneGridConfig(isDetailVertical),
    [isDetailVertical],
  )

  const scrollContentWidth = useMemo(() => {
    const layoutWidth = Math.max(
      gridContentWidth(swimlaneGrid),
      canvasBounds?.width ?? 0,
    )
    return isOverview ? scaledGridContentWidth(swimlaneGrid, overviewScale, layoutWidth) : layoutWidth
  }, [swimlaneGrid, canvasBounds?.width, isOverview, overviewScale])

  const flowContent = (
    <ReactFlow
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
      minZoom={isOverview ? 0.05 : 1}
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
      {!isOverview && canvasBounds && (
        <>
          <LayoutViewportSync
            nodeLayoutKey={nodeLayoutKey}
            edgeRoutingKey={edgeRoutingKey}
            scrollRef={detailScrollRef}
          />
          <DetailInitialViewport
            trigger={fitTrigger}
            nodes={nodes}
            canvasBounds={canvasBounds}
            scrollRef={detailScrollRef}
          />
          <DetailScrollBridge
            trigger={fitTrigger}
            canvasBounds={canvasBounds}
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
      className={`process-map-canvas${isOverview ? ' process-map-canvas--overview' : ' process-map-canvas--detail-vertical'}${isEditMode ? ' process-map-canvas--edit' : ''}${panelInsetRight > 0 ? ' process-map-canvas--panel-open' : ''}`}
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
            <OverviewStickyHeader
              lanes={process.lanes}
              scale={1}
              contentWidth={scrollContentWidth}
              editMode={isEditMode}
              selectedLaneId={selectedLaneId}
              inactiveLaneIds={detailUsedLaneIds}
              hideZoneColumn
              onLaneSelect={(laneId) => {
                onLaneClick(laneId)
              }}
            />
            <div
              className="process-map-canvas__scroll-track"
              style={
                canvasBounds
                  ? { width: scrollContentWidth, height: canvasBounds.height }
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
