import type { WorkingStateSummary, ExportValidationResult } from '../../data/workingStateStats'
import './data-dialog.css'

type SaveJsonDialogProps = {
  open: boolean
  summary: WorkingStateSummary
  onConfirm: () => void
  onCancel: () => void
}

export function SaveJsonDialog({ open, summary, onConfirm, onCancel }: SaveJsonDialogProps) {
  if (!open) return null

  return (
    <div className="data-dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="data-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-json-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="save-json-dialog-title" className="data-dialog__title">
          JSON 저장
        </h2>
        <p className="data-dialog__lead">저장 대상 데이터</p>
        <dl className="data-dialog__stats">
          <div className="data-dialog__stats-row">
            <dt>Nodes</dt>
            <dd>{summary.nodeCount}</dd>
          </div>
          <div className="data-dialog__stats-row">
            <dt>Edges</dt>
            <dd>{summary.edgeCount}</dd>
          </div>
          <div className="data-dialog__stats-row">
            <dt>Processes</dt>
            <dd>{summary.processCount}</dd>
          </div>
          <div className="data-dialog__stats-row">
            <dt>Last Modified</dt>
            <dd>{summary.lastModifiedLabel}</dd>
          </div>
        </dl>
        <p className="data-dialog__hint">
          현재 화면에 표시된 nodes/edges 상태를 JSON으로 내보냅니다.
        </p>
        <div className="data-dialog__actions">
          <button type="button" className="data-dialog__btn" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="data-dialog__btn data-dialog__btn--primary" onClick={onConfirm}>
            JSON 저장
          </button>
        </div>
      </div>
    </div>
  )
}

type LoadConflictDialogProps = {
  open: boolean
  localSavedAtLabel: string
  fileBaselineLabel: string
  onUseLocal: () => void
  onUseFile: () => void
  onDownloadLocal: () => void
}

export function LoadConflictDialog({
  open,
  localSavedAtLabel,
  fileBaselineLabel,
  onUseLocal,
  onUseFile,
  onDownloadLocal,
}: LoadConflictDialogProps) {
  if (!open) return null

  return (
    <div className="data-dialog-backdrop" role="presentation">
      <div
        className="data-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="load-conflict-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="load-conflict-dialog-title" className="data-dialog__title">
          데이터 불일치
        </h2>
        <p className="data-dialog__lead">
          브라우저 로컬 수정본이 파일 JSON보다 최신입니다.
        </p>
        <dl className="data-dialog__stats">
          <div className="data-dialog__stats-row">
            <dt>로컬 수정본</dt>
            <dd>{localSavedAtLabel}</dd>
          </div>
          <div className="data-dialog__stats-row">
            <dt>파일 JSON 기준</dt>
            <dd>{fileBaselineLabel}</dd>
          </div>
        </dl>
        <div className="data-dialog__actions data-dialog__actions--stack">
          <button type="button" className="data-dialog__btn data-dialog__btn--primary" onClick={onUseLocal}>
            로컬 수정본 사용
          </button>
          <button type="button" className="data-dialog__btn" onClick={onUseFile}>
            파일 JSON 사용
          </button>
          <button type="button" className="data-dialog__btn" onClick={onDownloadLocal}>
            로컬 수정본을 JSON으로 다운로드
          </button>
        </div>
      </div>
    </div>
  )
}

type ExportResultDialogProps = {
  open: boolean
  validation: ExportValidationResult | null
  onClose: () => void
}

export function ExportResultDialog({ open, validation, onClose }: ExportResultDialogProps) {
  if (!open || !validation) return null

  return (
    <div className="data-dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="data-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-result-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="export-result-dialog-title" className="data-dialog__title">
          {validation.ok ? 'JSON 저장 완료' : 'JSON 저장 — 검증 경고'}
        </h2>
        <dl className="data-dialog__stats">
          <div className="data-dialog__stats-row">
            <dt>Nodes</dt>
            <dd>{validation.nodeCount}</dd>
          </div>
          <div className="data-dialog__stats-row">
            <dt>Edges</dt>
            <dd>{validation.edgeCount}</dd>
          </div>
          <div className="data-dialog__stats-row">
            <dt>Handles 포함</dt>
            <dd>{validation.edgesWithHandles}</dd>
          </div>
        </dl>
        <p className={`data-dialog__hint${validation.ok ? '' : ' data-dialog__hint--warn'}`}>
          {validation.message}
        </p>
        {validation.edgesMissingHandles.length > 0 && (
          <p className="data-dialog__hint data-dialog__hint--warn">
            handle 누락 edge: {validation.edgesMissingHandles.slice(0, 5).join(', ')}
            {validation.edgesMissingHandles.length > 5 ? ' …' : ''}
          </p>
        )}
        <div className="data-dialog__actions">
          <button type="button" className="data-dialog__btn data-dialog__btn--primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

type LocalDraftWarningBannerProps = {
  visible: boolean
}

export function LocalDraftWarningBanner({ visible }: LocalDraftWarningBannerProps) {
  if (!visible) return null

  return (
    <div className="local-draft-warning" role="status">
      브라우저 로컬 수정분이 있습니다. JSON으로 내보내지 않으면 손실될 수 있습니다.
    </div>
  )
}
