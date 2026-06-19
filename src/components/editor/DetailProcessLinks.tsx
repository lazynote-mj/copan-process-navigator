import type { Process } from '../../types/process'
import { resolveDetailProcessLabels, resolveNodeDetailProcessIds } from '../../data/overviewDetailProcesses'
import './detail-process-links.css'

type DetailProcessLinksProps = {
  node: Pick<Process['nodes'][number], 'id' | 'detailProcessIds'>
  detailProcesses: Process[]
  onOpenDetailProcess: (processId: string) => void
}

export function DetailProcessLinks({
  node,
  detailProcesses,
  onOpenDetailProcess,
}: DetailProcessLinksProps) {
  const processIds = resolveNodeDetailProcessIds(node)
  if (processIds.length === 0) return null

  const links = resolveDetailProcessLabels(processIds, detailProcesses)

  return (
    <section className="detail-process-links">
      <h3 className="detail-process-links__title">상세 프로세스</h3>
      <ul className="detail-process-links__list">
        {links.map(({ id, name }) => (
          <li key={id}>
            <button
              type="button"
              className="detail-process-links__item"
              onClick={() => onOpenDetailProcess(id)}
            >
              {name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
