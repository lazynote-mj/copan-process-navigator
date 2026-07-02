import { useMemo } from 'react'
import { validateRouterData } from '../../lib/editor/routerValidation'
import type { ProcessData } from '../../types/processData'
import './router-health-dashboard.css'

type RouterHealthDashboardProps = {
  processData: ProcessData
}

function isRouterHealthEnabled(): boolean {
  if (!import.meta.env.DEV) return false
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('routerHealth') === '1' || window.localStorage.getItem('routerHealth') === '1'
}

export function RouterHealthDashboard({ processData }: RouterHealthDashboardProps) {
  const enabled = isRouterHealthEnabled()
  const report = useMemo(
    () => (enabled ? validateRouterData(processData, { autofix: false }).report : null),
    [enabled, processData],
  )

  if (!enabled || !report) return null

  const grouped = report.issues.reduce<Record<string, number>>((acc, issue) => {
    acc[issue.code] = (acc[issue.code] ?? 0) + 1
    return acc
  }, {})

  return (
    <aside className="router-health" aria-label="Router Health Dashboard">
      <div className="router-health__header">
        <strong>Router Health</strong>
        <span className={report.ok ? 'router-health__ok' : 'router-health__error'}>
          {report.ok ? 'OK' : 'ERROR'}
        </span>
      </div>
      <div className="router-health__metrics">
        <span>Errors {report.errors}</span>
        <span>Warnings {report.warnings}</span>
        <span>Processes {report.checkedProcesses}</span>
        <span>Edges {report.checkedEdges}</span>
      </div>
      {report.issues.length > 0 ? (
        <div className="router-health__issues">
          {Object.entries(grouped).map(([code, count]) => (
            <span key={code}>{code}: {count}</span>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
