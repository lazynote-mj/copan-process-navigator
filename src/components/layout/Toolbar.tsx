import { PanelLeft, PanelRight, Plus, Save, GitBranch, Layers, ArrowLeft, BoxSelect } from 'lucide-react'
import type { AppMode, SaveStatus } from '../../lib/editor/selectionTypes'
import type { ViewMode } from '../../lib/editor/viewModeTypes'
import './layout.css'

export type DetailHeaderInfo = {
  processLabel: string
  title: string
}

type ToolbarProps = {
  viewMode: ViewMode
  appMode: AppMode
  mapDisplayMode: 'business' | 'system'
  saveStatus: SaveStatus
  isLeftOpen: boolean
  isRightOpen: boolean
  detailHeader?: DetailHeaderInfo | null
  onToggleLeft: () => void
  onToggleRight: () => void
  onViewModeChange: (mode: ViewMode) => void
  onAppModeChange: (mode: AppMode) => void
  onMapDisplayModeChange: (mode: 'business' | 'system') => void
  onBackToOverview: () => void
  onAddNode: () => void
  onAddEdge: () => void
  onAddLane: () => void
  onAddZone: () => void
  onSaveAll: () => void
}

export function Toolbar({
  viewMode,
  appMode,
  mapDisplayMode,
  saveStatus,
  isLeftOpen,
  isRightOpen,
  detailHeader,
  onToggleLeft,
  onToggleRight,
  onViewModeChange,
  onAppModeChange,
  onMapDisplayModeChange,
  onBackToOverview,
  onAddNode,
  onAddEdge,
  onAddLane,
  onAddZone,
  onSaveAll,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar__left">
        <button
          type="button"
          className={`toolbar__btn ${isLeftOpen ? 'toolbar__btn--active' : ''}`}
          onClick={onToggleLeft}
          aria-label="프로세스 메뉴 열기"
        >
          <PanelLeft size={18} />
          <span>메뉴</span>
        </button>
        {viewMode === 'detail' && (
          <button type="button" className="toolbar__btn" onClick={onBackToOverview}>
            <ArrowLeft size={16} />
            <span>Overview</span>
          </button>
        )}
      </div>

      <div className="toolbar__center">
        {detailHeader ? (
          <div className="toolbar__page-heading">
            <h1 className="toolbar__page-title">{detailHeader.title}</h1>
            <span className="toolbar__page-divider" aria-hidden>
              |
            </span>
            <span className="toolbar__page-label">{detailHeader.processLabel}</span>
          </div>
        ) : (
          <h1 className="toolbar__title">Copan ERP Process Navigator</h1>
        )}
        <div className="toolbar__mode-group">
          <button
            type="button"
            className={`toolbar__mode-btn ${viewMode === 'overview' ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => onViewModeChange('overview')}
          >
            전체 Overview
          </button>
          <button
            type="button"
            className={`toolbar__mode-btn ${viewMode === 'detail' ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => onViewModeChange('detail')}
          >
            프로세스 상세
          </button>
        </div>
        <div className="toolbar__mode-group toolbar__mode-group--secondary">
          <button
            type="button"
            className={`toolbar__mode-btn toolbar__mode-btn--small ${mapDisplayMode === 'business' ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => onMapDisplayModeChange('business')}
          >
            업무
          </button>
          <button
            type="button"
            className={`toolbar__mode-btn toolbar__mode-btn--small ${mapDisplayMode === 'system' ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => onMapDisplayModeChange('system')}
          >
            시스템
          </button>
        </div>
        <div className="toolbar__mode-group toolbar__mode-group--secondary">
          <button
            type="button"
            className={`toolbar__mode-btn toolbar__mode-btn--small ${appMode === 'view' ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => onAppModeChange('view')}
          >
            보기
          </button>
          <button
            type="button"
            className={`toolbar__mode-btn toolbar__mode-btn--small ${appMode === 'edit' ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => onAppModeChange('edit')}
          >
            편집
          </button>
        </div>
        {saveStatus === 'saving' && <span className="toolbar__status toolbar__status--saving">저장 중…</span>}
        {saveStatus === 'modified' && <span className="toolbar__status toolbar__status--modified">저장 필요</span>}
        {saveStatus === 'saved' && <span className="toolbar__status toolbar__status--saved">저장 완료</span>}
        {saveStatus === 'error' && <span className="toolbar__status toolbar__status--error">저장 실패</span>}
      </div>

      <div className="toolbar__right">
        {appMode === 'edit' && (
          <>
            <button type="button" className="toolbar__btn" onClick={onAddNode}>
              <Plus size={16} />
              <span>노드</span>
            </button>
            <button type="button" className="toolbar__btn" onClick={onAddEdge}>
              <GitBranch size={16} />
              <span>연결선</span>
            </button>
            <button type="button" className="toolbar__btn" onClick={onAddLane}>
              <Layers size={16} />
              <span>스윔레인</span>
            </button>
            <button type="button" className="toolbar__btn" onClick={onAddZone}>
              <BoxSelect size={16} />
              <span>Zone</span>
            </button>
            <button
              type="button"
              className="toolbar__btn toolbar__btn--save"
              onClick={onSaveAll}
              disabled={saveStatus === 'saving'}
            >
              <Save size={16} />
              <span>전체 저장</span>
            </button>
          </>
        )}
        <button
          type="button"
          className={`toolbar__btn ${isRightOpen ? 'toolbar__btn--active' : ''}`}
          onClick={onToggleRight}
        >
          <span>패널</span>
          <PanelRight size={18} />
        </button>
      </div>
    </header>
  )
}
