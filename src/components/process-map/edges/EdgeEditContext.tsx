import { createContext, useContext } from 'react'
import type { EdgeLabelPlacement, EdgeRoutingConfig } from '../../../types/process'
import type { AppMode } from '../../../lib/editor/selectionTypes'

export type EdgeRoutingUpdate = {
  edgeId: string
  routing: EdgeRoutingConfig
}

type EdgeEditContextValue = {
  appMode: AppMode
  selectedEdgeId: string | null
  onEdgeRoutingChange: (update: EdgeRoutingUpdate) => void
  onEdgeLabelPlacementChange: (edgeId: string, labelPlacement: EdgeLabelPlacement | undefined) => void
}

export const EdgeEditContext = createContext<EdgeEditContextValue>({
  appMode: 'view',
  selectedEdgeId: null,
  onEdgeRoutingChange: () => {},
  onEdgeLabelPlacementChange: () => {},
})

export function useEdgeEditContext(): EdgeEditContextValue {
  return useContext(EdgeEditContext)
}
