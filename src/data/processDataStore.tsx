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
import {
  cloneProcessData,
  getProcessByScope,
  summarizeProcessData,
  type ProcessData,
  type ProcessScope,
} from '../types/processData'
import { mergeMissingDetailProcesses } from './activeProcessData'
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
  saveNode: (scope: ProcessScope, node: Node, isNew: boolean) => void
  updateEdge: (scope: ProcessScope, edgeId: string, patch: Partial<Edge>) => void
  saveEdge: (scope: ProcessScope, edge: Edge, isNew: boolean) => void
  saveLane: (scope: ProcessScope, lane: Lane, isNew: boolean) => void
  saveZone: (scope: ProcessScope, zone: ProcessZone, isNew: boolean) => void
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
        setProcessData(mergeMissingDetailProcesses(base, registryDetailProcesses))
        setSaveStatus(remote ? 'saved' : 'idle')
      })
      .catch(() => {
        if (cancelled) return
        setProcessData(mergeMissingDetailProcesses(cloneProcessData(fallbackData), registryDetailProcesses))
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
      saveNode: (scope, node, isNew) =>
        mutate((current) => saveNode(current, scope, node, isNew, detailFallback)),
      updateEdge: (scope, edgeId, patch) =>
        mutate((current) => updateEdge(current, scope, edgeId, patch, detailFallback)),
      saveEdge: (scope, edge, isNew) => {
        const normalized = normalizeEdgeForStorage(withEdgeHandleDefaults(edge))
        mutate((current) => saveEdge(current, scope, normalized, isNew, detailFallback))
      },
      saveLane: (scope, lane, isNew) =>
        mutate((current) => saveLane(current, scope, lane, isNew)),
      saveZone: (scope, zone, isNew) =>
        mutate((current) => saveZone(current, scope, zone, isNew, detailFallback)),
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
  }, [detailFallback, mutate, persistAll, processData, saveError, saveStatus, summary])

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
