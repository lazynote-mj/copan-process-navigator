import { Plus, Trash2 } from 'lucide-react'

type ListEditorProps = {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  disabled?: boolean
}

export function ListEditor({ label, items, onChange, disabled }: ListEditorProps) {
  const updateItem = (index: number, value: string) => {
    const next = [...items]
    next[index] = value
    onChange(next)
  }

  const addItem = () => onChange([...items, ''])
  const removeItem = (index: number) => onChange(items.filter((_, i) => i !== index))

  return (
    <div className="property-panel__section">
      <div className="property-panel__section-head">
        <h3 className="property-panel__section-title">{label}</h3>
        {!disabled && (
          <button type="button" className="property-panel__icon-btn" onClick={addItem} aria-label={`${label} 추가`}>
            <Plus size={14} />
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="property-panel__empty-list">항목 없음</p>
      ) : (
        <ul className="property-panel__list-editor">
          {items.map((item, index) => (
            <li key={index} className="property-panel__list-row">
              <input
                className="property-panel__input"
                value={item}
                disabled={disabled}
                onChange={(e) => updateItem(index, e.target.value)}
              />
              {!disabled && (
                <button
                  type="button"
                  className="property-panel__icon-btn property-panel__icon-btn--danger"
                  onClick={() => removeItem(index)}
                  aria-label="삭제"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
