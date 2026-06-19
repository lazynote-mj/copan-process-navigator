import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'

type LayoutViewportSyncProps = {
  nodeLayoutKey: string
  edgeRoutingKey: string
  scrollRef: React.RefObject<HTMLDivElement | null>
}

/**
 * 연결선만 변경될 때 scroll·pan·zoom을 복원한다.
 * 노드 레이아웃 변경(신규 노드 등) 시에는 viewport 초기화를 허용한다.
 */
export function LayoutViewportSync({
  nodeLayoutKey,
  edgeRoutingKey,
  scrollRef,
}: LayoutViewportSyncProps) {
  const { getViewport, setViewport } = useReactFlow()
  const prevNodeLayoutKeyRef = useRef('')
  const prevEdgeRoutingKeyRef = useRef('')

  useEffect(() => {
    const nodeLayoutChanged = prevNodeLayoutKeyRef.current !== nodeLayoutKey
    const edgeRoutingChanged = prevEdgeRoutingKeyRef.current !== edgeRoutingKey

    prevNodeLayoutKeyRef.current = nodeLayoutKey
    prevEdgeRoutingKeyRef.current = edgeRoutingKey

    if (nodeLayoutChanged || !edgeRoutingChanged) return

    const container = scrollRef.current
    if (!container) return

    const viewport = getViewport()
    const scrollLeft = container.scrollLeft
    const scrollTop = container.scrollTop

    window.requestAnimationFrame(() => {
      setViewport(viewport, { duration: 0 })
      container.scrollLeft = scrollLeft
      container.scrollTop = scrollTop
    })
  }, [nodeLayoutKey, edgeRoutingKey, scrollRef, getViewport, setViewport])

  return null
}
