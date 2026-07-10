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
  canReview?: boolean
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
  canReview = !viewerOnly,
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
  // ① 사용자에게 의미 없는 내부 루트 분류(SCM Process)는 breadcrumb에서 감춘다. (표시 전용)
  const visibleBreadcrumbs = (detailHeader?.breadcrumbs ?? []).filter(
    (crumb) => Boolean(crumb) && crumb !== APP_CONFIG.processRootLabel,
  )

  // 표시 전용 파싱 — 원본 데이터(detailHeader.title)는 절대 바꾸지 않는다.
  // title은 "<workflow> : <variant>" 형태이고 workflow는 "A ~ B" 흐름 표기를 쓴다.
  // variant는 "공백 : 공백"으로 둘러싸인 콜론만 분리한다. 콜론 앞뒤 공백이 없는 제목
  // (예: "해외 사업: 일본 시장 진출")은 variant로 오인하지 않고 원문 그대로 표시한다(안전 fallback).
  const rawTitle = detailHeader?.title ?? ''
  const variantMatch = rawTitle.match(/^(.*\S)\s+[:：]\s+(\S.*)$/)
  // ② Workflow 이름을 가장 강조. 흐름 구분자 ~ 는 → 로 다듬는다.
  const workflowTitle = (variantMatch ? variantMatch[1] : rawTitle)
    .trim()
    .replace(/\s*~\s*/g, ' → ')
  // ③ Variant(보조 정보)는 title에 내장된 값 또는 processLabel에서 뽑아 가운뎃점으로 정리한다.
  const variantSource = detailHeader?.processLabel || (variantMatch ? variantMatch[2] : '')
  const variantLabel = variantSource
    ? variantSource
        .split(/[,·]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' · ')
    : ''

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
            <span>전체 Overview</span>
          </button>
        )}
      </div>

      <div className="toolbar__center">
        {detailHeader ? (
          <div className="toolbar__page-heading">
            {visibleBreadcrumbs.length ? (
              <>
                <span className="toolbar__breadcrumb">{visibleBreadcrumbs.join(' › ')}</span>
                <span className="toolbar__page-sep" aria-hidden>
                  ›
                </span>
              </>
            ) : null}
            {/* ② 현재 Workflow 이름을 가장 강조한다 */}
            <h1 className="toolbar__page-title" title={detailHeader.title}>
              {workflowTitle}
            </h1>
            {/* ③ Variant는 보조 정보(badge) */}
            {variantLabel ? (
              <span className="toolbar__page-label" title={variantLabel}>
                {variantLabel}
              </span>
            ) : null}
          </div>
        ) : (
          <h1 className="toolbar__title">{APP_CONFIG.appName}</h1>
        )}
        {/* ⑤ 현재 화면(view) 선택 — 활성 상태를 aria-pressed로도 전달 */}
        <div className="toolbar__mode-group" role="group" aria-label="화면 보기">
          <button
            type="button"
            className={`toolbar__mode-btn ${viewMode === 'overview' ? 'toolbar__mode-btn--active' : ''}`}
            aria-pressed={viewMode === 'overview'}
            onClick={() => onViewModeChange('overview')}
          >
            전체 Overview
          </button>
          <button
            type="button"
            className={`toolbar__mode-btn ${viewMode === 'detail' ? 'toolbar__mode-btn--active' : ''}`}
            aria-pressed={viewMode === 'detail'}
            onClick={() => onViewModeChange('detail')}
          >
            프로세스 상세
          </button>
        </div>
        {/* ⑥ Viewer/Builder는 권한(Role) 선택임을 명시 */}
        <div
          className="toolbar__mode-group toolbar__mode-group--secondary"
          role="group"
          aria-label="권한(Role)"
        >
          <button
            type="button"
            className={`toolbar__mode-btn toolbar__mode-btn--small ${appMode === 'view' ? 'toolbar__mode-btn--active' : ''}`}
            aria-pressed={appMode === 'view'}
            onClick={() => onAppModeChange('view')}
          >
            Viewer
          </button>
          {!viewerOnly ? (
            <button
              type="button"
              className={`toolbar__mode-btn toolbar__mode-btn--small ${appMode === 'edit' ? 'toolbar__mode-btn--active' : ''}`}
              aria-pressed={appMode === 'edit'}
              onClick={() => onAppModeChange('edit')}
            >
              Builder
            </button>
          ) : null}
        </div>
        {canReview ? (
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
