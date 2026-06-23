import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useProcessDataStore } from '../../data/processDataStore'
import { getActiveProcessData, resolveDetailProcessesForMenu } from '../../data/activeProcessData'
import { getDetailProcessById, getDetailProcessGroupById, getOverviewProcessGroupById, toBeNavigator } from '../../data/toBeNavigatorRegistry'
import { readUiPreferences, writeUiPreferences } from '../../data/uiPreferences'
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
  resolveFocusEdgeIdsForNode,
  resolveRelatedNodeIdsForFocus,
} from '../../lib/editor/processGroupMembership'
import { withEdgeHandleDefaults } from '../../lib/editor/edgeHandles'
import { applyRoutedHandlePatch, type RoutedHandlePatch } from '../../lib/editor/routedEdgeSync'
import { normalizeEdgeForStorage } from '../../lib/editor/edgeUpdate'
import { selectedElementToObject } from '../../lib/editor/selectionManager'
import type { AppMode, SelectedElement } from '../../lib/editor/selectionTypes'
import type { OverviewHighlight, ViewMode } from '../../lib/editor/viewModeTypes'
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
import { ProcessGroupMenu, resolveHighlightMode } from './ProcessGroupMenu'
import { Toolbar } from './Toolbar'
import { ProcessMapCanvas } from '../process-map/ProcessMapCanvas'
import { PropertyPanel } from '../editor/PropertyPanel'
import { ProcessCanvasContainer, PROPERTY_PANEL_WIDTH } from './ProcessCanvasContainer'
import '../layout/node-detail.css'
import './layout.css'

export function AppLayout() {
  const store = useProcessDataStore()
  const { processData, summary, saveStatus, persistAll } = store
  const propertyPanelRef = useRef<HTMLElement>(null)
  usePanelNativeEventShield(propertyPanelRef)

  const [isLeftOpen, setIsLeftOpen] = useState(false)
  const [isRightOpen, setIsRightOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>(() => readUiPreferences().viewMode ?? 'overview')
  const [appMode, setAppMode] = useState<AppMode>(() => readUiPreferences().appMode ?? 'view')
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [relatedOnly, setRelatedOnly] = useState(false)
  const [overviewHomeKey, setOverviewHomeKey] = useState(0)
  const [detailProcessId, setDetailProcessId] = useState<string>(() =>
    readUiPreferences().detailProcessId
      ?? toBeNavigator.detailProcessGroups[0]?.detailProcessId
      ?? toBeNavigator.detailProcesses[0]?.id
      ?? '',
  )

  const activeScope: ProcessScope = viewMode === 'overview' ? 'overview' : detailProcessId

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
    const base: OverviewHighlight = {
      groupId: highlightGroup.id,
      nodeIds: new Set(highlightGroup.overviewNodeIds),
      edgeIds: new Set(highlightGroup.overviewEdgeIds),
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
    const processLabel = [activeProcess.version, activeProcess.status].filter(Boolean).join(' ')
    const groupIndex = detailProcessGroups.findIndex((group) => group.detailProcessId === activeProcess.id)
    return {
      groupNumber: groupIndex >= 0 ? String(groupIndex + 1).padStart(2, '0') : undefined,
      processLabel,
      title: activeProcess.name,
    }
  }, [viewMode, activeProcess, detailProcessGroups])

  useEffect(() => {
    setSelectedElement(null)
  }, [viewMode, detailProcessId])

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
        setIsRightOpen(true)
      }
    },
    [overviewProcessGroups],
  )

  const handleSelectElement = useCallback(
    (next: SelectedElement | null) => {
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
    [viewMode, appMode, activeProcess.nodes, handleOpenDetailProcess],
  )

  const handleClearSelection = useCallback(() => {
    setSelectedElement(null)
  }, [])

  const handleStartNew = useCallback(
    (kind: 'new-node' | 'new-edge' | 'new-lane' | 'new-zone', laneId?: string | null) => {
      setAppMode('edit')
      if (kind === 'new-node') handleSelectElement(buildNewNodeSelection(activeProcess, laneId ?? undefined))
      if (kind === 'new-edge') handleSelectElement(buildNewEdgeSelection(activeProcess))
      if (kind === 'new-lane') handleSelectElement(buildNewLaneSelection(activeProcess))
      if (kind === 'new-zone') handleSelectElement(buildNewZoneSelection())
    },
    [activeProcess, handleSelectElement],
  )

  const handleAppModeChange = (mode: AppMode) => {
    setAppMode(mode)
    if (mode === 'view') {
      setIsRightOpen(false)
      setSelectedElement(null)
    }
  }

  const handleRequestEditMode = useCallback(() => {
    setAppMode('edit')
  }, [])

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
      const currentProcess = store.getActiveProcess(activeScope)
      if (!currentProcess) return
      for (const patch of patches) {
        const current = currentProcess.edges.find((edge) => edge.id === patch.edgeId)
        if (!current) continue
        store.updateEdge(activeScope, patch.edgeId, applyRoutedHandlePatch(current, patch))
      }
    },
    [store, activeScope],
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
    setAppMode('edit')
    setSelectedGroupId(null)
    setSelectedElement(buildNewProcessGroupSelection(overviewProcessGroups))
    setIsRightOpen(true)
  }, [overviewProcessGroups])

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
    setAppMode('edit')
    const currentFirst = [
      ...allDetailProcesses.filter((process) => process.id === detailProcessId),
      ...allDetailProcesses.filter((process) => process.id !== detailProcessId),
    ]
    setSelectedElement(buildNewDetailProcessGroupSelection(detailProcessGroups, currentFirst))
    setIsRightOpen(true)
  }, [detailProcessGroups, allDetailProcesses, detailProcessId])

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

  const linkedDetailProcessIdForPanel = useMemo(() => {
    if (!savedSelectedOverviewGroup) return undefined
    return resolveLinkedDetailProcessId(savedSelectedOverviewGroup)
  }, [savedSelectedOverviewGroup, resolveLinkedDetailProcessId])

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      store.deleteNode(activeScope, nodeId)
      setSelectedElement(null)
    },
    [store, activeScope],
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
    },
    [store, activeScope],
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

  useEffect(() => {
    if (appMode !== 'edit') return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const selected = selectedElementToObject(selectedElement)
      if (!selected.type || !selected.id) return

      event.preventDefault()
      if (selected.type === 'node') {
        if (window.confirm('이 노드를 삭제하면 연결된 연결선도 함께 삭제됩니다. 계속하시겠습니까?')) {
          void handleDeleteNode(selected.id)
        }
      } else if (selected.type === 'edge') {
        void handleDeleteEdge(selected.id)
      } else if (selected.type === 'lane') {
        const c = canDeleteLane(activeProcess, selected.id)
        if (!c.ok) {
          window.alert(c.message)
          return
        }
        if (window.confirm('이 스윔레인을 삭제하시겠습니까?')) {
          void handleDeleteLane(selected.id)
        }
      } else if (selected.type === 'zone') {
        if (window.confirm('이 Process Zone을 삭제하시겠습니까?')) {
          void handleDeleteZone(selected.id)
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [appMode, selectedElement, activeProcess, handleDeleteNode, handleDeleteEdge, handleDeleteLane, handleDeleteZone])

  const handleSaveAll = useCallback(async () => {
    const result = await persistAll()
    if (result.ok) {
      window.alert('전체 저장 완료')
    } else if (result.error) {
      window.alert(result.error)
    }
  }, [persistAll])

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
    <div className="app-shell">
      <Toolbar
        viewMode={viewMode}
        appMode={appMode}
        saveStatus={saveStatus}
        isLeftOpen={isLeftOpen}
        isRightOpen={isRightOpen}
        detailHeader={detailHeader}
        onToggleLeft={() => setIsLeftOpen((prev) => !prev)}
        onToggleRight={() => setIsRightOpen((prev) => !prev)}
        onViewModeChange={handleViewModeChange}
        onAppModeChange={handleAppModeChange}
        onBackToOverview={handleBackToOverview}
        onAddNode={() => handleStartNew('new-node', selectedLaneId)}
        onAddEdge={() => handleStartNew('new-edge')}
        onAddLane={() => handleStartNew('new-lane')}
        onAddZone={() => handleStartNew('new-zone')}
        onSaveAll={() => {
          void handleSaveAll()
        }}
      />

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
            overviewHighlight={overviewHighlight}
            overviewHomeKey={overviewHomeKey}
            panelInsetRight={isRightOpen ? PROPERTY_PANEL_WIDTH : 0}
            onSelectElement={handleSelectElement}
            onClearSelection={handleClearSelection}
            onEdgeRoutingChange={handleEdgeRoutingChange}
            onEdgeLabelPlacementChange={handleEdgeLabelPlacementChange}
            onConnectEdge={handleConnectEdge}
            onNodePlacementChange={handleNodePlacementChange}
            onRoutedHandlesSync={handleRoutedHandlesSync}
          />
        </ProcessCanvasContainer>
      </div>

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
            onAddGroup={handleAddOverviewProcessGroup}
            onEditGroup={handleEditOverviewProcessGroup}
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
            onAddGroup={handleAddDetailProcessGroup}
            onEditGroup={handleEditDetailProcessGroup}
          />
        )}
      </Drawer>
    </div>
  )
}
