import type { Process } from '../../types/process'
import './process-menu.css'

type ProcessMenuProps = {
  processes: Process[]
  selectedId: string
  onSelect: (id: string) => void
}

export function ProcessMenu({ processes, selectedId, onSelect }: ProcessMenuProps) {
  return (
    <nav className="process-menu">
      <p className="process-menu__hint">표시할 상세 프로세스를 선택하세요.</p>
      <ul className="process-menu__list">
        {processes.map((process, index) => (
          <li key={process.id}>
            <button
              type="button"
              className={`process-menu__item ${
                process.id === selectedId ? 'process-menu__item--active' : ''
              }`}
              onClick={() => onSelect(process.id)}
            >
              <span className="process-menu__category">
                {String(index + 1).padStart(2, '0')} · {process.status}
              </span>
              <span className="process-menu__title">{process.name}</span>
              <span className="process-menu__meta">
                {process.version} · {process.owner}
                {process.nodes.length > 0 ? ` · Node ${process.nodes.length}개` : ' · 데이터 입력 예정'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
