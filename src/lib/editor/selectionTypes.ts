import type { Edge, Lane, Node, ProcessZone } from '../../types/process'
import type { ProcessZoneDef } from '../layout/overviewProcessZones'
import type { DetailProcessGroup, OverviewProcessGroup } from '../../types/toBeNavigator'

export type SelectedElementType =
  | 'node'
  | 'edge'
  | 'lane'
  | 'zone'
  | 'overview-zone'
  | 'process-group'
  | 'detail-process-group'
  | 'new-node'
  | 'new-edge'
  | 'new-lane'
  | 'new-zone'
  | 'new-process-group'
  | 'new-detail-process-group'

export type SelectedElement =
  | { type: 'node'; id: string; data: Node }
  | { type: 'edge'; id: string; data: Edge }
  | { type: 'lane'; id: string; data: Lane }
  | { type: 'zone'; id: string; data: ProcessZone }
  | { type: 'overview-zone'; id: string; data: ProcessZoneDef }
  | { type: 'process-group'; id: string; data: OverviewProcessGroup }
  | { type: 'detail-process-group'; id: string; data: DetailProcessGroup }
  | { type: 'new-node'; id: string; data: Node }
  | { type: 'new-edge'; id: string; data: Edge }
  | { type: 'new-lane'; id: string; data: Lane }
  | { type: 'new-zone'; id: string; data: ProcessZone }
  | { type: 'new-process-group'; id: string; data: OverviewProcessGroup }
  | { type: 'new-detail-process-group'; id: string; data: DetailProcessGroup }

/** @deprecated EditorSelection — SelectedElement 사용 */
export type EditorSelection =
  | { kind: 'none' }
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | { kind: 'lane'; id: string }
  | { kind: 'new-node' }
  | { kind: 'new-edge' }
  | { kind: 'new-lane' }
  | { kind: 'new-zone' }

export type PanelMode = 'view' | 'edit'

export type SaveStatus = 'idle' | 'modified' | 'saved' | 'saving' | 'error'

export type AppMode = 'view' | 'edit'
