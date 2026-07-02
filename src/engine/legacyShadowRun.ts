import type { LayoutOptions } from '../lib/layout/elkLayout'
import { getLayoutedElements } from '../lib/layout/elkLayout'
import type { Process } from '../types/process'
import type { EngineDiagnostic, EngineResult } from './contracts'
import { processToModel } from './adapters/fromLegacyProcess'
import {
  legacyLayoutToNavigatorViewModel,
  type LegacyLayoutResultLike,
} from './adapters/toNavigatorViewModel'
import type { EnginePoint, NavigatorViewModel, ProcessModel } from './types'

export type LegacyShadowRunOptions = {
  layoutOptions?: LayoutOptions
}

export type LegacyShadowRunResult = EngineResult<NavigatorViewModel> & {
  model: ProcessModel
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

function isFinitePoint(point: EnginePoint): boolean {
  return isFiniteNumber(point.x) && isFiniteNumber(point.y)
}

function addDiagnostic(
  diagnostics: EngineDiagnostic[],
  diagnostic: EngineDiagnostic,
): void {
  diagnostics.push(diagnostic)
}

function validateModelReferences(model: ProcessModel): EngineDiagnostic[] {
  const diagnostics: EngineDiagnostic[] = []

  for (const node of model.nodes) {
    if (!model.laneById.has(node.layoutHints.laneId)) {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.node.missing-lane',
        severity: 'error',
        message: `Node "${node.id}" references missing lane "${node.layoutHints.laneId}".`,
        nodeId: node.id,
        laneId: node.layoutHints.laneId,
      })
    }

    if (!model.phaseById.has(node.layoutHints.phaseId)) {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.node.missing-phase',
        severity: 'error',
        message: `Node "${node.id}" references missing phase "${node.layoutHints.phaseId}".`,
        nodeId: node.id,
        phaseId: node.layoutHints.phaseId,
      })
    }
  }

  for (const edge of model.edges) {
    if (!model.nodeById.has(edge.source)) {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.edge.missing-source',
        severity: 'error',
        message: `Edge "${edge.id}" references missing source node "${edge.source}".`,
        edgeId: edge.id,
        nodeId: edge.source,
      })
    }

    if (!model.nodeById.has(edge.target)) {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.edge.missing-target',
        severity: 'error',
        message: `Edge "${edge.id}" references missing target node "${edge.target}".`,
        edgeId: edge.id,
        nodeId: edge.target,
      })
    }
  }

  return diagnostics
}

function validateViewModel(model: ProcessModel, viewModel: NavigatorViewModel): EngineDiagnostic[] {
  const diagnostics: EngineDiagnostic[] = []
  const viewNodeIds = new Set(viewModel.nodes.map((node) => node.nodeId))
  const routedEdgeIds = new Set(viewModel.edges.map((edge) => edge.id))

  for (const node of model.nodes) {
    if (!viewNodeIds.has(node.id)) {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.view.missing-node',
        severity: 'warning',
        message: `Process node "${node.id}" is not present in the Navigator view model.`,
        nodeId: node.id,
      })
    }
  }

  for (const edge of model.edges) {
    if (!routedEdgeIds.has(edge.id)) {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.view.missing-edge',
        severity: 'warning',
        message: `Process edge "${edge.id}" is not present in the Navigator view model.`,
        edgeId: edge.id,
      })
    }
  }

  for (const node of viewModel.nodes) {
    if (!isFiniteNumber(node.rect.x) || !isFiniteNumber(node.rect.y)) {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.view.invalid-node-position',
        severity: 'error',
        message: `View node "${node.nodeId}" has an invalid position.`,
        nodeId: node.nodeId,
      })
    }

    if (!isFiniteNumber(node.rect.width) || !isFiniteNumber(node.rect.height)) {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.view.invalid-node-size',
        severity: 'error',
        message: `View node "${node.nodeId}" has an invalid size.`,
        nodeId: node.nodeId,
      })
    }
  }

  for (const edge of viewModel.edges) {
    for (const point of edge.pathPoints) {
      if (!isFinitePoint(point)) {
        addDiagnostic(diagnostics, {
          code: 'legacy-shadow.view.invalid-edge-point',
          severity: 'error',
          message: `View edge "${edge.id}" has an invalid path point.`,
          edgeId: edge.id,
        })
        break
      }
    }

    if (edge.status === 'error') {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.view.broken-edge',
        severity: 'error',
        message: edge.issue ?? `View edge "${edge.id}" is marked as broken.`,
        edgeId: edge.id,
      })
    }

    const definition = model.edgeById.get(edge.id)
    if (definition?.renderHints.label && !edge.label.text) {
      addDiagnostic(diagnostics, {
        code: 'legacy-shadow.view.missing-edge-label',
        severity: 'warning',
        message: `View edge "${edge.id}" lost its label text.`,
        edgeId: edge.id,
      })
    }
  }

  return diagnostics
}

export function runLegacyShadowEngine(
  process: Process,
  options: LegacyShadowRunOptions = {},
): LegacyShadowRunResult {
  const model = processToModel(process)
  const layoutResult = getLayoutedElements(process, options.layoutOptions)
  const value = legacyLayoutToNavigatorViewModel(
    model,
    layoutResult as unknown as LegacyLayoutResultLike,
  )
  const diagnostics = [
    ...validateModelReferences(model),
    ...validateViewModel(model, value),
  ]

  return {
    value,
    diagnostics,
    model,
  }
}

export function hasLegacyShadowErrors(result: LegacyShadowRunResult): boolean {
  return result.diagnostics.some((diagnostic) => diagnostic.severity === 'error')
}
