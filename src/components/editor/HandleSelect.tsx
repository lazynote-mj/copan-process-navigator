import type { EdgeHandleId } from '../../types/process'
import { EDGE_HANDLE_OPTIONS } from '../../lib/editor/edgeHandles'
import './handle-select.css'

type HandleSelectProps = {
  label: string
  value: EdgeHandleId
  disabled?: boolean
  onChange: (value: EdgeHandleId) => void
}

export function HandleSelect({ label, value, disabled, onChange }: HandleSelectProps) {
  return (
    <div className="handle-select">
      <span className="handle-select__label">{label}</span>
      <div className="handle-select__group" role="group" aria-label={label}>
        {EDGE_HANDLE_OPTIONS.map(({ value: handle, label: handleLabel }) => (
          <button
            key={handle}
            type="button"
            className={`handle-select__btn ${value === handle ? 'handle-select__btn--active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(handle)}
          >
            {handleLabel}
          </button>
        ))}
      </div>
    </div>
  )
}
