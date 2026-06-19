import { useRef } from 'react'
import { X } from 'lucide-react'
import { panelEventShieldProps, usePanelNativeEventShield } from '../../lib/ui/panelEventShield'
import './layout.css'

type DrawerProps = {
  side: 'left' | 'right'
  isOpen: boolean
  title: string
  className?: string
  showOverlay?: boolean
  onClose: () => void
  children: React.ReactNode
}

export function Drawer({ side, isOpen, title, className, showOverlay = true, onClose, children }: DrawerProps) {
  const drawerRef = useRef<HTMLElement>(null)
  usePanelNativeEventShield(drawerRef)

  return (
    <>
      {isOpen && showOverlay && (
        <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        ref={drawerRef}
        className={`drawer drawer--${side} ${isOpen ? 'drawer--open' : ''} ${className ?? ''}`.trim()}
        aria-hidden={!isOpen}
        {...panelEventShieldProps}
      >
        <header className="drawer__header">
          <h2 className="drawer__title">{title}</h2>
          <button
            type="button"
            className="drawer__close"
            onClick={onClose}
            aria-label="패널 닫기"
          >
            <X size={18} />
          </button>
        </header>
        <div className="drawer__body" {...panelEventShieldProps}>{children}</div>
      </aside>
    </>
  )
}
