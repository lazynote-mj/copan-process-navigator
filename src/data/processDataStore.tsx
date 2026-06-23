import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  deleteEdge,
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
  updateNode,
  type DetailProcessFallback,
} from './processDataMutations'
import { loadRemoteProcessData, saveRemoteProcessData } from './processDataRemote'
import { withEdgeHandleDefaults } from '../lib/editor/edgeHandles'
import { normalizeEdgeForStorage } from '../lib/editor/edgeUpdate'
import type { SaveStatus } from '../lib/editor/selectionTypes'

type ProcessDataStoreValue = {
  processData: ProcessData
  summary: ReturnType<typeof summarizeProcessData>
  saveStatus: SaveStatus
  saveError: string | null
  getActiveProcess: (scope: ProcessScope) => ReturnType<typeof getProcessByScope>
  ensureDetailProcess: (processId: string) => void
  updateNode: (scope: ProcessScope, nodeId: string, patch: Partial<Node>) => void
  saveNode: (scope: ProcessScope, node: Node, isNew: boolean) => Process | undefined
  updateEdge: (scope: ProcessScope, edgeId: string, patch: Partial<Edge>) => void
  saveEdge: (scope: ProcessScope, edge: Edge, isNew: boolean) => Process | undefined
  saveLane: (scope: ProcessScope, lane: Lane, isNew: boolean) => Process | undefined
  saveZone: (scope: ProcessScope, zone: ProcessZone, isNew: boolean) => Process | undefined
  saveProcessGroup: (group: OverviewProcessGroup) => void
  saveDetailProcessGroup: (group: DetailProcessGroup) => void
  deleteNode: (scope: ProcessScope, nodeId: string) => void
  deleteEdge: (scope: ProcessScope, edgeId: string) => void
  deleteLane: (scope: ProcessScope, laneId: string) => void
  deleteZone: (scope: ProcessScope, zoneId: string) => void
  connectEdge: (scope: ProcessScope, edge: Edge) => void
  persistAll: () => Promise<{ ok: boolean; error?: string }>
}

const ProcessDataContext = createContext<ProcessDataStoreValue | null>(null)

type ProcessDataProviderProps = {
  fallbackData: ProcessData
  registryDetailProcesses: Process[]
  children: ReactNode
}

export function ProcessDataProvider({
  fallbackData,
  registryDetailProcesses,
  children,
}: ProcessDataProviderProps) {
  const [processData, setProcessData] = useState<ProcessData | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  const detailFallback = useCallback<DetailProcessFallback>(
    (processId) => registryDetailProcesses.find((process) => process.id === processId),
    [registryDetailProcesses],
  )

  useEffect(() => {
    let cancelled = false

    loadRemoteProcessData()
      .then((remote) => {
        if (cancelled) return
        const base = cloneProcessData(remote ?? fallbackData)
        const merged = mergeMissingDetailProcesses(base, registryDetailProcesses)
        setProcessData(syncDetailProcessesFromRegistry(merged, registryDetailProcesses))
        setSaveStatus(remote ? 'saved' : 'idle')
      })
      .catch(() => {
        if (cancelled) return
        setProcessData(
          syncDetailProcessesFromRegistry(
            mergeMissingDetailProcesses(cloneProcessData(fallbackData), registryDetailProcesses),
            registryDetailProcesses,
          ),
        )
        setSaveStatus('idle')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [fallbackData, registryDetailProcesses])

  const summary = useMemo(
    () => (processData ? summarizeProcessData(processData) : summarizeProcessData(fallbackData)),
    [processData, fallbackData],
  )

  const mutate = useCallback((updater: (current: ProcessData) => ProcessData) => {
    setProcessData((current) => {
      if (!current) return current
      return updater(current)
    })
    setSaveStatus('modified')
    setSaveError(null)
  }, [])

  /** setState functional updater는 동기 실행 — 저장 직후 canonical process를 반환 */
  const mutateAndGet = useCallback((updater: (current: ProcessData) => ProcessData): ProcessData | null => {
    let next: ProcessData | null = null
    setProcessData((current) => {
      if (!current) return current
      next = updater(current)
      return next
    })
    if (next) {
      setSaveStatus('modified')
      setSaveError(null)
    }
    return next
  }, [])

  const persistAll = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!processData) return { ok: false, error: '데이터가 없습니다.' }
    setSaveStatus('saving')
    setSaveError(null)
    try {
      const saved = await saveRemoteProcessData(processData)
      setProcessData(markProcessDataClean(saved))
      setSaveStatus('saved')
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : '저장에 실패했습니다.'
      setSaveError(message)
      setSaveStatus('error')
      return { ok: false, error: message }
    }
  }, [processData])

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
      saveNode: (scope, node, isNew) => {
        const next = mutateAndGet((current) => saveNode(current, scope, node, isNew, detailFallback))
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
      deleteNode: (scope, nodeId) =>
        mutate((current) => deleteNode(current, scope, nodeId, detailFallback)),
      deleteEdge: (scope, edgeId) =>
        mutate((current) => deleteEdge(current, scope, edgeId, detailFallback)),
      deleteLane: (scope, laneId) =>
        mutate((current) => deleteLane(current, scope, laneId)),
      deleteZone: (scope, zoneId) =>
        mutate((current) => deleteZone(current, scope, zoneId, detailFallback)),
      connectEdge: (scope, edge) => {
        const normalized = normalizeEdgeForStorage(edge)
        mutate((current) => connectEdge(current, scope, normalized, detailFallback))
      },
      persistAll,
    }
  }, [detailFallback, mutate, mutateAndGet, persistAll, processData, saveError, saveStatus, summary])

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
