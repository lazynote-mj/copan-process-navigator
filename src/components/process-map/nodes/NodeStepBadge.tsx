type NodeStepBadgeProps = {
  step: number | string
  className?: string
}

/** 노드 좌측 상단 원형 실행 순서 번호 */
export function NodeStepBadge({ step, className = '' }: NodeStepBadgeProps) {
  const label = String(step).trim()
  if (!label) return null

  return (
    <span
      className={`process-node__step-badge${className ? ` ${className}` : ''}`}
      aria-label={`단계 ${label}`}
      title={`단계 ${label}`}
    >
      {label}
    </span>
  )
}
