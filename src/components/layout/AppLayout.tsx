import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useProcessDataStore } from '../../data/processDataStore'
import { getActiveProcessData, resolveDetailProcessesForMenu } from '../../data/activeProcessData'
import { getDetailProcessById, getProcessGroupById, toBeNavigator } from '../../data/toBeNavigatorRegistry'
import { readUiPreferences, writeUiPreferences } from '../../data/uiPreferences'
import { canDeleteLane } from '../../lib/editor/processEditor'
import { panelEventShieldProps, usePanelNativeEventShield } from '../../lib/ui/panelEventShield'
import {
  buildNewEdgeSelection,
  buildNewLaneSelection,
  buildNewNodeSelection,
  buildNewZoneSelection,
  buildSelectedEdge,
  buildSelectedNode,
  cloneEdgeData,
  cloneLaneData,
  cloneNodeData,
  cloneZoneData,
  refreshSelectedElement,
} from '../../lib/editor/selectedElement'
import { withEdgeHandleDefaults } from '../../lib/editor/edgeHandles'
import { normalizeEdgeForStorage } from '../../lib/editor/edgeUpdate'
import { selectedElementToObject } from '../../lib/editor/selectionManager'
import type { AppMode, SelectedElement } from '../../lib/editor/selectionTypes'
import type { OverviewHighlight, ViewMode } from '../../lib/editor/viewModeTypes'
import type { Edge, Lane, Node, Process, ProcessZone } from '../../types/process'
import type { ProcessScope } from '../../types/processData'
import { getOverviewProcess } from '../../types/processData'
import {
  buildDisplayProcess,
  type MapDisplayMode,
} from '../../lib/nodeVisibility'
import { DataStatusBar } from './DataStatusBar'
import { Drawer } from './Drawer'
import { ProcessGroupMenu, resolveHighlightMode } from './ProcessGroupMenu'
import { ProcessMenu } from './ProcessMenu'
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
  const [mapDisplayMode, setMapDisplayMode] = useState<MapDisplayMode>(
    () => readUiPreferences().mapDisplayMode ?? 'business',
  )
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [relatedOnly, setRelatedOnly] = useState(false)
  const [detailProcessId, setDetailProcessId] = useState<string>(() =>
    readUiPreferences().detailProcessId
      ?? toBeNavigator.processGroups[0]?.detailProcessId
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
    () => buildDisplayProcess(activeProcess, mapDisplayMode),
    [activeProcess, mapDisplayMode],
  )

  const allDetailProcesses = useMemo(
    () => resolveDetailProcessesForMenu(processData, toBeNavigator.detailProcesses),
    [processData],
  )

  const selectedGroup = selectedGroupId ? getProcessGroupById(selectedGroupId) : undefined

  const overviewHighlight = useMemo((): OverviewHighlight | null => {
    if (viewMode !== 'overview') return null
    const mode = resolveHighlightMode(selectedGroupId, relatedOnly)
    if (mode === 'all') {
      return { groupId: null, nodeIds: new Set(), edgeIds: new Set(), mode: 'all' }
    }
    if (!selectedGroup) {
      return { groupId: null, nodeIds: new Set(), edgeIds: new Set(), mode: 'all' }
    }
    return {
      groupId: selectedGroup.id,
      nodeIds: new Set(selectedGroup.overviewNodeIds),
      edgeIds: new Set(selectedGroup.overviewEdgeIds),
      mode,
    }
  }, [viewMode, selectedGroupId, relatedOnly, selectedGroup])

  const detailHeader = useMemo(() => {
    if (viewMode === 'overview') return null
    const processLabel = [activeProcess.version, activeProcess.status].filter(Boolean).join(' ')
    return {
      processLabel,
      title: activeProcess.name,
    }
  }, [viewMode, activeProcess])

  useEffect(() => {
    setSelectedElement(null)
  }, [viewMode, detailProcessId, selectedGroupId])

  useEffect(() => {
    setSelectedElement((prev) => refreshSelectedElement(prev, activeProcess))
  }, [activeProcess])

  useEffect(() => {
    writeUiPreferences({
      viewMode,
      detailProcessId,
      selectedGroupId,
      isLeftOpen,
      isRightOpen,
      appMode,
      mapDisplayMode,
    })
  }, [viewMode, detailProcessId, selectedGroupId, isLeftOpen, isRightOpen, appMode, mapDisplayMode])


  const handleOpenDetailProcess = useCallback((processId: string) => {
    setDetailProcessId(processId)
    setViewMode('detail')
    setIsLeftOpen(false)
    setSelectedElement(null)
    setIsRightOpen(false)
    const group = toBeNavigator.processGroups.find((g) => g.detailProcessId === processId)
    setSelectedGroupId(group?.id ?? null)
  }, [])

  const handleOpenDetail = useCallback(
    (groupId: string) => {
      const group = getProcessGroupById(groupId)
      if (!group) return
      setSelectedGroupId(groupId)
      handleOpenDetailProcess(group.detailProcessId)
    },
    [handleOpenDetailProcess],
  )

  const handleSelectElement = useCallback((next: SelectedElement | null) => {
    setSelectedElement(next)
    if (next) setIsRightOpen(true)
  }, [])

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
    store.saveNode(activeScope, node, isNew)
    setSelectedElement({ type: 'node', id: node.id, data: cloneNodeData(node) })
    setIsRightOpen(true)
  }

  const handleEdgeRoutingChange = useCallback(
    (edgeId: string, routing: Edge['routing']) => {
      store.updateEdge(activeScope, edgeId, { routing: routing ?? { mode: 'auto' } })
    },
    [store, activeScope],
  )

  const handleSaveEdge = (edge: Edge, isNew: boolean, options?: { keepNodeId?: string }) => {
    const normalized = normalizeEdgeForStorage(withEdgeHandleDefaults(edge))
    store.saveEdge(activeScope, normalized, isNew)
    if (options?.keepNodeId) {
      const latest = store.getActiveProcess(activeScope)
      if (latest) {
        const nodeSel = buildSelectedNode(latest, options.keepNodeId)
        if (nodeSel) setSelectedElement(nodeSel)
      }
    } else {
      setSelectedElement({ type: 'edge', id: normalized.id, data: cloneEdgeData(normalized) })
    }
  }

  const handleSaveLane = (lane: Lane, isNew: boolean) => {
    store.saveLane(activeScope, lane, isNew)
    setSelectedElement({ type: 'lane', id: lane.id, data: cloneLaneData(lane) })
  }

  const handleSaveZone = (zone: ProcessZone, isNew: boolean) => {
    store.saveZone(activeScope, zone, isNew)
    setSelectedElement({ type: 'zone', id: zone.id, data: cloneZoneData(zone) })
  }

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

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'detail' && selectedGroupId) {
      const group = getProcessGroupById(selectedGroupId)
      if (group) setDetailProcessId(group.detailProcessId)
    }
  }

  const handleBackToOverview = () => {
    setViewMode('overview')
  }

  const handleSelectEdgeFromPanel = useCallback(
    (edgeId: string) => {
      const el = buildSelectedEdge(activeProcess, edgeId)
      if (el) setSelectedElement(el)
    },
    [activeProcess],
  )

  const selectedLaneId = selectedElement?.type === 'lane' ? selectedElement.id : null

  return (
    <div className="app-shell">
      <Toolbar
        viewMode={viewMode}
        appMode={appMode}
        mapDisplayMode={mapDisplayMode}
        saveStatus={saveStatus}
        isLeftOpen={isLeftOpen}
        isRightOpen={isRightOpen}
        detailHeader={detailHeader}
        onToggleLeft={() => setIsLeftOpen((prev) => !prev)}
        onToggleRight={() => setIsRightOpen((prev) => !prev)}
        onViewModeChange={handleViewModeChange}
        onAppModeChange={handleAppModeChange}
        onMapDisplayModeChange={setMapDisplayMode}
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
                  onOpenDetailProcess={handleOpenDetailProcess}
                  onSaveNode={handleSaveNode}
                  onSaveEdge={handleSaveEdge}
                  onSaveLane={handleSaveLane}
                  onSaveZone={handleSaveZone}
                  onDeleteNode={handleDeleteNode}
                  onDeleteEdge={handleDeleteEdge}
                  onDeleteLane={handleDeleteLane}
                  onDeleteZone={handleDeleteZone}
                  onCancelNew={() => setSelectedElement(null)}
                  onSelectEdge={handleSelectEdgeFromPanel}
                  onRequestEditMode={handleRequestEditMode}
                />
              </div>
            </>
          }
        >
          <ProcessMapCanvas
            process={displayProcess}
            viewMode={viewMode}
            appMode={appMode}
            selectedElement={selectedElement}
            overviewHighlight={overviewHighlight}
            panelInsetRight={isRightOpen ? PROPERTY_PANEL_WIDTH : 0}
            onSelectElement={handleSelectElement}
            onClearSelection={handleClearSelection}
            onEdgeRoutingChange={handleEdgeRoutingChange}
            onConnectEdge={handleConnectEdge}
            onNodePlacementChange={handleNodePlacementChange}
          />
        </ProcessCanvasContainer>
      </div>

      <DataStatusBar processData={processData} nodeCount={summary.nodeCount} edgeCount={summary.edgeCount} />

      <Drawer side="left" isOpen={isLeftOpen} title={viewMode === 'overview' ? '프로세스 그룹' : '프로세스'} onClose={() => setIsLeftOpen(false)}>
        {viewMode === 'overview' ? (
          <ProcessGroupMenu
            groups={toBeNavigator.processGroups}
            selectedGroupId={selectedGroupId}
            relatedOnly={relatedOnly}
            onSelectGroup={setSelectedGroupId}
            onRelatedOnlyChange={setRelatedOnly}
            onOpenDetail={handleOpenDetail}
          />
        ) : (
          <>
            <ProcessMenu
              processes={allDetailProcesses}
              selectedId={detailProcessId}
              onSelect={(processId) => {
                handleOpenDetailProcess(processId)
              }}
            />
            <ProcessGroupMenu
              groups={toBeNavigator.processGroups}
              selectedGroupId={
                toBeNavigator.processGroups.find((g) => g.detailProcessId === detailProcessId)?.id ?? null
              }
              relatedOnly={false}
              showOverviewControls={false}
              onSelectGroup={(groupId) => {
                if (!groupId) return
                handleOpenDetail(groupId)
              }}
              onRelatedOnlyChange={() => {}}
              onOpenDetail={handleOpenDetail}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}
