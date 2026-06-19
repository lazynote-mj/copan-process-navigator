import { createContext, useContext } from 'react'
import type { EdgeRoutingConfig } from '../../../types/process'
import type { AppMode } from '../../../lib/editor/selectionTypes'

export type EdgeRoutingUpdate = {
  edgeId: string
  routing: EdgeRoutingConfig
}

type EdgeEditContextValue = {
  appMode: AppMode
  selectedEdgeId: string | null
  onEdgeRoutingChange: (update: EdgeRoutingUpdate) => void
}

export const EdgeEditContext = createContext<EdgeEditContextValue>({
  appMode: 'view',
  selectedEdgeId: null,
  onEdgeRoutingChange: () => {},
})

export function useEdgeEditContext(): EdgeEditContextValue {
  return useContext(EdgeEditContext)
}
