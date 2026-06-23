type NodeStepBadgeProps = {
  step: number
  className?: string
}

/** PDF 스타일 — 노드 좌측 상단 원형 단계 번호 (phaseOrder) */
export function NodeStepBadge({ step, className = '' }: NodeStepBadgeProps) {
  if (!Number.isFinite(step) || step <= 0) return null

  return (
    <span
      className={`process-node__step-badge${className ? ` ${className}` : ''}`}
      aria-label={`단계 ${step}`}
      title={`단계 ${step}`}
    >
      {step}
    </span>
  )
}
