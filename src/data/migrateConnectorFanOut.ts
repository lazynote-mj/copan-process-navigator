import type { Process } from '../types/process'

/**
 * 비-decision 노드 fan-out을 Split connector로 자동 변환하던 마이그레이션.
 * 자동 split/merge 강제는 비활성화됨 — 에디터에서 수동 추가만 지원.
 */
export function migrateFanOutToSplitConnectors(process: Process): Process {
  return process
}
