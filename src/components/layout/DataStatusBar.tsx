import { formatTimestamp } from '../../data/workingStateStats'
import type { ProcessData } from '../../types/processData'
import './data-dialog.css'

type DataStatusBarProps = {
  processData: ProcessData
  nodeCount: number
  edgeCount: number
}

export function DataStatusBar({ processData, nodeCount, edgeCount }: DataStatusBarProps) {
  const dataSourceLabel =
    processData.dataSource === 'server-json'
      ? 'Shared Server JSON'
      : processData.dataSource === 'imported-json'
        ? 'Imported JSON'
        : 'Project JSON'

  return (
    <footer className="data-status-bar" aria-label="데이터 상태">
      <span className="data-status-bar__item">Data Source: {dataSourceLabel}</span>
      <span className="data-status-bar__sep" aria-hidden>
        |
      </span>
      <span className="data-status-bar__item">Nodes: {nodeCount}</span>
      <span className="data-status-bar__sep" aria-hidden>
        |
      </span>
      <span className="data-status-bar__item">Edges: {edgeCount}</span>
      <span className="data-status-bar__sep" aria-hidden>
        |
      </span>
      <span className="data-status-bar__item">
        Last Modified: {formatTimestamp(processData.updatedAt)}
      </span>
      <span className="data-status-bar__sep" aria-hidden>
        |
      </span>
      <span className={`data-status-bar__item${processData.dirty ? ' data-status-bar__item--dirty' : ''}`}>
        Dirty: {processData.dirty ? 'Yes' : 'No'}
      </span>
    </footer>
  )
}
