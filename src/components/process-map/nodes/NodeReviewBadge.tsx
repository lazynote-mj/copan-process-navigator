import type { NodeReviewStatus } from '../../../types/process'

const REVIEW_BADGE_LABELS: Record<NodeReviewStatus, string> = {
  'not-reviewed': '미검토',
  ok: 'OK',
  'review-required': '검토',
}

type NodeReviewBadgeProps = {
  reviewMode?: boolean
  status?: NodeReviewStatus
}

export function NodeReviewBadge({ reviewMode, status = 'not-reviewed' }: NodeReviewBadgeProps) {
  if (!reviewMode) return null

  return (
    <span className={`node-review-badge node-review-badge--${status}`}>
      {REVIEW_BADGE_LABELS[status]}
    </span>
  )
}
