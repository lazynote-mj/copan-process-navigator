import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Edge, Lane, Node, Process, ProcessZone } from '../types/process'
import type { DetailProcessGroup, OverviewProcessGroup } from '../types/toBeNavigator'
import {
  cloneProcessData,
  getProcessByScope,
  summarizeProcessData,
  type ProcessData,
  type ProcessScope,
} from '../types/processData'
import { mergeMissingDetailProcesses, syncDetailProcessesFromRegistry } from './activeProcessData'
import { createInitialProcessData } from './processDataMigration'
import {
  connectEdge,
  cloneDetailProcess,
  addNodesAndEdges,
  deleteEdge,
  deleteElements,
  deleteLane,
  deleteNode,
  deleteZone,
  ensureDetailProcess,
  markProcessDataClean,
  saveEdge,
  saveLane,
  saveNode,
  saveZone,
  saveDetailProcessGroup,
  saveProcessGroup,
  updateEdge,
  updateActiveNodes,
  updateNode,
  type CloneDetailProcessResult,
  type DetailProcessFallback,
} from './processDataMutations'
import { localJsonProcessStorage, type ProcessStorageAdapter } from './processStorageAdapter'
import { withEdgeHandleDefaults } from '../lib/editor/edgeHandles'
import { normalizeEdgeForStorage } from '../lib/editor/edgeUpdate'
import {
  formatRouterValidationMessage,
  validateRouterData,
  type RouterValidationReport,
} from '../lib/editor/routerValidation'
import type { SaveStatus } from '../lib/editor/selectionTypes'

export type ProcessDataStoreValue = {
  processData: ProcessData
  summary: ReturnType<typeof summarizeProcessData>
  saveStatus: SaveStatus
  saveError: string | null
  getActiveProcess: (scope: ProcessScope) => ReturnType<typeof getProcessByScope>
  ensureDetailProcess: (processId: string) => void
  updateNode: (scope: ProcessScope, nodeId: string, patch: Partial<Node>) => void
  updateNodes: (scope: ProcessScope, patches: Array<{ nodeId: string; patch: Partial<Node> }>) => void
  saveNode: (scope: ProcessScope, node: Node, isNew: boolean) => Process | undefined
  addNodesAndEdges: (scope: ProcessScope, nodes: Node[], edges: Edge[]) => Process | undefined
  updateEdge: (scope: ProcessScope, edgeId: string, patch: Partial<Edge>) => void
  saveEdge: (scope: ProcessScope, edge: Edge, isNew: boolean) => Process | undefined
  saveLane: (scope: ProcessScope, lane: Lane, isNew: boolean) => Process | undefined
  saveZone: (scope: ProcessScope, zone: ProcessZone, isNew: boolean) => Process | undefined
  saveProcessGroup: (group: OverviewProcessGroup) => void
  saveDetailProcessGroup: (group: DetailProcessGroup) => void
  cloneDetailProcess: (sourceProcessId: string, name: string) => CloneDetailProcessResult | null
  deleteNode: (scope: ProcessScope, nodeId: string) => void
  deleteEdge: (scope: ProcessScope, edgeId: string) => void
  deleteElements: (scope: ProcessScope, selection: { nodeIds?: string[]; edgeIds?: string[] }) => void
  deleteLane: (scope: ProcessScope, laneId: string) => void
  deleteZone: (scope: ProcessScope, zoneId: string) => void
  connectEdge: (scope: ProcessScope, edge: Edge) => void
  undo: () => boolean
  redo: () => boolean
  persistAll: () => Promise<{ ok: boolean; error?: string; data?: ProcessData; routerReport?: RouterValidationReport }>
}

const ProcessDataContext = createContext<ProcessDataStoreValue | null>(null)

function countProcessDataNodes(data: ProcessData | null | undefined): number {
  return data?.processes.reduce((sum, process) => sum + process.nodes.length, 0) ?? 0
}

function hydrateProcessData(
  source: ProcessData,
  registryDetailProcesses: Process[],
): ProcessData {
  const base = cloneProcessData(source)
  const merged = mergeMissingDetailProcesses(base, registryDetailProcesses)
  return syncDetailProcessesFromRegistry(merged, registryDetailProcesses)
}

function hydrateSavedProcessData(
  source: ProcessData,
  registryDetailProcesses: Process[],
): ProcessData {
  return mergeMissingDetailProcesses(cloneProcessData(source), registryDetailProcesses)
}

function pushProcessDataDebug(event: string, payload: Record<string, unknown>): void {
  if (!import.meta.env.DEV) return
  const target = globalThis as typeof globalThis & {
    __PROCESS_NAV_DEBUG__?: Array<Record<string, unknown>>
  }
  const entry = {
    source: 'processDataStore',
    event,
    at: new Date().toISOString(),
    ...payload,
  }
  target.__PROCESS_NAV_DEBUG__ = [...(target.__PROCESS_NAV_DEBUG__ ?? []), entry].slice(-100)
}

type ProcessDataProviderProps = {
  fallbackData: ProcessData
  registryDetailProcesses: Process[]
  storageAdapter?: ProcessStorageAdapter
  children: ReactNode
}

export function ProcessDataProvider({
  fallbackData,
  registryDetailProcesses,
  storageAdapter = localJsonProcessStorage,
  children,
}: ProcessDataProviderProps) {
  const [processData, setProcessData] = useState<ProcessData | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const processDataRef = useRef<ProcessData | null>(null)
  const undoStackRef = useRef<ProcessData[]>([])
  const redoStackRef = useRef<ProcessData[]>([])

  const detailFallback = useCallback<DetailProcessFallback>(
    (processId) => registryDetailProcesses.find((process) => process.id === processId),
    [registryDetailProcesses],
  )

  useEffect(() => {
    let cancelled = false

    storageAdapter
      .load()
      .then(({ data: remote }) => {
        if (cancelled) return
        const next = hydrateProcessData(remote ?? fallbackData, registryDetailProcesses)
        processDataRef.current = next
        setProcessData(next)
        setSaveStatus(remote ? 'saved' : 'idle')
      })
      .catch(() => {
        if (cancelled) return
        const next = hydrateProcessData(fallbackData, registryDetailProcesses)
        processDataRef.current = next
        setProcessData(next)
        setSaveStatus('idle')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [fallbackData, registryDetailProcesses, storageAdapter])

  const summary = useMemo(
    () => (processData ? summarizeProcessData(processData) : summarizeProcessData(fallbackData)),
    [processData, fallbackData],
  )

  const mutate = useCallback((updater: (current: ProcessData) => ProcessData) => {
    const current = processDataRef.current
    if (!current) return
    const next = updater(current)
    if (next === current) return
    undoStackRef.current = [...undoStackRef.current.slice(-49), cloneProcessData(current)]
    redoStackRef.current = []
    processDataRef.current = next
    setProcessData(next)
    setSaveStatus('modified')
    setSaveError(null)
  }, [])

  /** setState functional updater는 동기 실행 — 저장 직후 canonical process를 반환 */
  const mutateAndGet = useCallback((updater: (current: ProcessData) => ProcessData): ProcessData | null => {
    const current = processDataRef.current
    if (!current) return null
    const next = updater(current)
    if (next === current) return null
    const undoBefore = undoStackRef.current.length
    undoStackRef.current = [...undoStackRef.current.slice(-49), cloneProcessData(current)]
    redoStackRef.current = []
    processDataRef.current = next
    setProcessData(next)
    setSaveStatus('modified')
    setSaveError(null)
    pushProcessDataDebug('mutateAndGet', {
      undoBefore,
      undoAfter: undoStackRef.current.length,
      redoAfter: redoStackRef.current.length,
      nodesBefore: countProcessDataNodes(current),
      nodesAfter: countProcessDataNodes(next),
    })
    return next
  }, [])

  const undo = useCallback((): boolean => {
    const current = processDataRef.current
    pushProcessDataDebug('undo-called', {
      undoBefore: undoStackRef.current.length,
      redoBefore: redoStackRef.current.length,
      nodesBefore: countProcessDataNodes(current),
    })

    if (!current || undoStackRef.current.length === 0) {
      pushProcessDataDebug('undo-return', {
        applied: false,
        undoAfterReturn: undoStackRef.current.length,
        redoAfterReturn: redoStackRef.current.length,
        nodesAfterReturn: countProcessDataNodes(current),
      })
      return false
    }

    const previous = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [...redoStackRef.current.slice(-49), cloneProcessData(current)]
    const next = cloneProcessData(previous)
    processDataRef.current = next
    setProcessData(next)
    setSaveStatus('modified')
    setSaveError(null)
    pushProcessDataDebug('undo-applied', {
      undoAfter: undoStackRef.current.length,
      redoAfter: redoStackRef.current.length,
      nodesBefore: countProcessDataNodes(current),
      nodesAfter: countProcessDataNodes(next),
    })
    pushProcessDataDebug('undo-return', {
      applied: true,
      undoAfterReturn: undoStackRef.current.length,
      redoAfterReturn: redoStackRef.current.length,
      nodesAfterReturn: countProcessDataNodes(processDataRef.current),
    })
    return true
  }, [])

  const redo = useCallback((): boolean => {
    const current = processDataRef.current
    pushProcessDataDebug('redo-called', {
      undoBefore: undoStackRef.current.length,
      redoBefore: redoStackRef.current.length,
      nodesBefore: countProcessDataNodes(current),
    })

    if (!current || redoStackRef.current.length === 0) {
      pushProcessDataDebug('redo-return', {
        applied: false,
        undoAfterReturn: undoStackRef.current.length,
        redoAfterReturn: redoStackRef.current.length,
        nodesAfterReturn: countProcessDataNodes(current),
      })
      return false
    }

    const nextSnapshot = redoStackRef.current[redoStackRef.current.length - 1]
    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [...undoStackRef.current.slice(-49), cloneProcessData(current)]
    const next = cloneProcessData(nextSnapshot)
    processDataRef.current = next
    setProcessData(next)
    setSaveStatus('modified')
    setSaveError(null)
    pushProcessDataDebug('redo-applied', {
      undoAfter: undoStackRef.current.length,
      redoAfter: redoStackRef.current.length,
      nodesBefore: countProcessDataNodes(current),
      nodesAfter: countProcessDataNodes(next),
    })
    pushProcessDataDebug('redo-return', {
      applied: true,
      undoAfterReturn: undoStackRef.current.length,
      redoAfterReturn: redoStackRef.current.length,
      nodesAfterReturn: countProcessDataNodes(processDataRef.current),
    })
    return true
  }, [])

  const persistAll = useCallback(async (): Promise<{
    ok: boolean
    error?: string
    data?: ProcessData
    routerReport?: RouterValidationReport
  }> => {
    const current = processDataRef.current ?? processData
    if (!current) return { ok: false, error: '데이터가 없습니다.' }
    setSaveStatus('saving')
    setSaveError(null)
    try {
      const routerValidation = validateRouterData(current, { autofix: true })
      if (!routerValidation.report.ok) {
        const message = formatRouterValidationMessage(routerValidation.report)
        setSaveError(message)
        setSaveStatus('error')
        return { ok: false, error: message, routerReport: routerValidation.report }
      }
      const dataToSave = routerValidation.data
      if (routerValidation.report.changed) {
        processDataRef.current = dataToSave
        setProcessData(dataToSave)
      }
      const saved = await storageAdapter.save(dataToSave)
      const reloaded = await storageAdapter.load().catch(() => ({ data: saved, source: saved.dataSource }))
      const clean = markProcessDataClean(hydrateSavedProcessData(reloaded.data ?? saved, registryDetailProcesses))
      processDataRef.current = clean
      setProcessData(clean)
      setSaveStatus('saved')
      return { ok: true, data: clean, routerReport: routerValidation.report }
    } catch (error) {
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.'
      setSaveError(message)
      setSaveStatus('error')
      return { ok: false, error: message }
    }
  }, [processData, registryDetailProcesses, storageAdapter])

  const value = useMemo<ProcessDataStoreValue | null>(() => {
    if (!processData) return null
    return {
      processData,
      summary,
      saveStatus,
      saveError,
      getActiveProcess: (scope) => getProcessByScope(processData, scope),
      ensureDetailProcess: (processId) =>
        mutate((current) => ensureDetailProcess(current, processId, detailFallback(processId))),
      updateNode: (scope, nodeId, patch) =>
        mutate((current) => updateNode(current, scope, nodeId, patch, detailFallback)),
      updateNodes: (scope, patches) =>
        mutate((current) =>
          updateActiveNodes(
            current,
            scope,
            (nodes) =>
              nodes.map((node) => {
                const entry = patches.find((candidate) => candidate.nodeId === node.id)
                return entry ? { ...node, ...entry.patch } : node
              }),
            detailFallback,
          ),
        ),
      saveNode: (scope, node, isNew) => {
        const next = mutateAndGet((current) => saveNode(current, scope, node, isNew, detailFallback))
        return next ? getProcessByScope(next, scope) : undefined
      },
      addNodesAndEdges: (scope, nodes, edges) => {
        const normalizedEdges = edges.map((edge) => normalizeEdgeForStorage(withEdgeHandleDefaults(edge)))
        const next = mutateAndGet((current) => addNodesAndEdges(current, scope, nodes, normalizedEdges, detailFallback))
        return next ? getProcessByScope(next, scope) : undefined
      },
      updateEdge: (scope, edgeId, patch) =>
        mutate((current) => updateEdge(current, scope, edgeId, patch, detailFallback)),
      saveEdge: (scope, edge, isNew) => {
        const normalized = normalizeEdgeForStorage(withEdgeHandleDefaults(edge))
        const next = mutateAndGet((current) => saveEdge(current, scope, normalized, isNew, detailFallback))
        return next ? getProcessByScope(next, scope) : undefined
      },
      saveLane: (scope, lane, isNew) => {
        const next = mutateAndGet((current) => saveLane(current, scope, lane, isNew))
        return next ? getProcessByScope(next, scope) : undefined
      },
      saveZone: (scope, zone, isNew) => {
        const next = mutateAndGet((current) => saveZone(current, scope, zone, isNew, detailFallback))
        return next ? getProcessByScope(next, scope) : undefined
      },
      saveProcessGroup: (group) => mutate((current) => saveProcessGroup(current, group)),
      saveDetailProcessGroup: (group) => mutate((current) => saveDetailProcessGroup(current, group)),
      cloneDetailProcess: (sourceProcessId, name) => {
        let result: CloneDetailProcessResult | null = null
        const next = mutateAndGet((current) => {
          result = cloneDetailProcess(current, sourceProcessId, name, detailFallback)
          return result.data
        })
        return next ? result : null
      },
      deleteNode: (scope, nodeId) =>
        mutate((current) => deleteNode(current, scope, nodeId, detailFallback)),
      deleteEdge: (scope, edgeId) =>
        mutate((current) => deleteEdge(current, scope, edgeId, detailFallback)),
      deleteElements: (scope, selection) =>
        mutate((current) => deleteElements(current, scope, selection, detailFallback)),
      deleteLane: (scope, laneId) =>
        mutate((current) => deleteLane(current, scope, laneId)),
      deleteZone: (scope, zoneId) =>
        mutate((current) => deleteZone(current, scope, zoneId, detailFallback)),
      connectEdge: (scope, edge) => {
        const normalized = normalizeEdgeForStorage(edge)
        mutate((current) => connectEdge(current, scope, normalized, detailFallback))
      },
      undo,
      redo,
      persistAll,
    }
  }, [detailFallback, mutate, mutateAndGet, persistAll, processData, redo, saveError, saveStatus, summary, undo])

  if (!ready || !value) {
    return <div className="app-loading">프로세스 데이터 불러오는 중…</div>
  }

  return <ProcessDataContext.Provider value={value}>{children}</ProcessDataContext.Provider>
}

export function useProcessDataStore(): ProcessDataStoreValue {
  const context = useContext(ProcessDataContext)
  if (!context) {
    throw new Error('useProcessDataStore must be used within ProcessDataProvider')
  }
  return context
}

export { createInitialProcessData }
