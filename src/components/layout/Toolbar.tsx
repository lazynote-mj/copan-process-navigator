import { PanelLeft, PanelRight, Plus, Save, GitBranch, Layers, ArrowLeft, BoxSelect, Copy } from 'lucide-react'
import type { AppMode, SaveStatus } from '../../lib/editor/selectionTypes'
import type { ViewMode } from '../../lib/editor/viewModeTypes'
import { getShortcut } from '../../lib/editor/shortcutManager'
import { APP_CONFIG } from '../../config/appConfig'
import './layout.css'

export type DetailHeaderInfo = {
  processLabel: string
  title: string
  breadcrumbs?: string[]
}

type ToolbarProps = {
  viewMode: ViewMode
  appMode: AppMode
  reviewMode: boolean
  showNodeNumbers: boolean
  saveStatus: SaveStatus
  isLeftOpen: boolean
  isRightOpen: boolean
  viewerOnly?: boolean
  detailHeader?: DetailHeaderInfo | null
  onToggleLeft: () => void
  onToggleRight: () => void
  onViewModeChange: (mode: ViewMode) => void
  onAppModeChange: (mode: AppMode) => void
  onReviewModeChange: (enabled: boolean) => void
  onShowNodeNumbersChange: (enabled: boolean) => void
  onBackToOverview: () => void
  onAddNode: () => void
  onAddEdge: () => void
  onAddLane: () => void
  onAddZone: () => void
  onCopy: () => void
  onPaste: () => void
  onDuplicate: () => void
  onDelete: () => void
  canCopy: boolean
  canPaste: boolean
  canDuplicate: boolean
  canDelete: boolean
  onSaveAll: () => void
}

export function Toolbar({
  viewMode,
  appMode,
  reviewMode,
  showNodeNumbers,
  saveStatus,
  isLeftOpen,
  isRightOpen,
  viewerOnly = false,
  detailHeader,
  onToggleLeft,
  onToggleRight,
  onViewModeChange,
  onAppModeChange,
  onReviewModeChange,
  onShowNodeNumbersChange,
  onBackToOverview,
  onAddNode,
  onAddEdge,
  onAddLane,
  onAddZone,
  onCopy,
  onPaste,
  onDuplicate,
  onDelete,
  canCopy,
  canPaste,
  canDuplicate,
  canDelete,
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
            {detailHeader.breadcrumbs?.length ? (
              <span className="toolbar__breadcrumb">
                {detailHeader.breadcrumbs.join(' > ')}
              </span>
            ) : null}
            <h1 className="toolbar__page-title">{detailHeader.title}</h1>
            {detailHeader.processLabel ? (
              <>
                <span className="toolbar__page-divider" aria-hidden>
                  |
                </span>
                <span className="toolbar__page-label">{detailHeader.processLabel}</span>
              </>
            ) : null}
          </div>
        ) : (
          <h1 className="toolbar__title">{APP_CONFIG.appName}</h1>
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
            className={`toolbar__mode-btn toolbar__mode-btn--small ${appMode === 'view' ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => onAppModeChange('view')}
          >
            Viewer
          </button>
          {!viewerOnly ? (
            <button
              type="button"
              className={`toolbar__mode-btn toolbar__mode-btn--small ${appMode === 'edit' ? 'toolbar__mode-btn--active' : ''}`}
              onClick={() => onAppModeChange('edit')}
            >
              Builder
            </button>
          ) : null}
        </div>
        {!viewerOnly ? (
          <button
            type="button"
            className={`toolbar__mode-btn toolbar__mode-btn--small toolbar__review-toggle ${reviewMode ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => onReviewModeChange(!reviewMode)}
            aria-pressed={reviewMode}
          >
            Review Mode {reviewMode ? 'ON' : 'OFF'}
          </button>
        ) : null}
        {appMode === 'edit' && viewMode === 'detail' ? (
          <button
            type="button"
            className={`toolbar__mode-btn toolbar__mode-btn--small ${showNodeNumbers ? 'toolbar__mode-btn--active' : ''}`}
            onClick={() => onShowNodeNumbersChange(!showNodeNumbers)}
            aria-pressed={showNodeNumbers}
          >
            번호 {showNodeNumbers ? 'ON' : 'OFF'}
          </button>
        ) : null}
        {saveStatus === 'saving' && <span className="toolbar__status toolbar__status--saving">저장 중…</span>}
        {saveStatus === 'modified' && <span className="toolbar__status toolbar__status--modified">변경사항 있음</span>}
        {saveStatus === 'saved' && <span className="toolbar__status toolbar__status--saved">저장 완료</span>}
        {saveStatus === 'error' && <span className="toolbar__status toolbar__status--error">저장 실패</span>}
      </div>

      <div className="toolbar__right">
        {appMode === 'edit' && (
          <>
            <details className="toolbar__menu">
              <summary className="toolbar__btn">Edit</summary>
              <div className="toolbar__menu-popover">
                <button type="button" onClick={onCopy} disabled={!canCopy}>
                  <span>Copy</span>
                  <kbd>{getShortcut('copy')}</kbd>
                </button>
                <button type="button" onClick={onPaste} disabled={!canPaste}>
                  <span>Paste</span>
                  <kbd>{getShortcut('paste')}</kbd>
                </button>
                <button type="button" onClick={onDuplicate} disabled={!canDuplicate}>
                  <span>Duplicate</span>
                  <kbd>{getShortcut('duplicate')}</kbd>
                </button>
                <button type="button" onClick={onDelete} disabled={!canDelete}>
                  <span>Delete</span>
                  <kbd>{getShortcut('delete')}</kbd>
                </button>
              </div>
            </details>
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
              <span>구역</span>
            </button>
            <button type="button" className="toolbar__btn" onClick={onDuplicate} disabled={!canDuplicate}>
              <Copy size={16} />
              <span>Duplicate</span>
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
