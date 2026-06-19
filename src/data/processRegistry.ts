import type { Process } from '../types/process'
import { loadDetailProcessFile, loadProcessBundle, type ProcessMeta } from './processLoader'
import type { DetailProcessFile } from './processLoader'

import registryJson from './processRegistry.json'

import businessToProjectMeta from './processes/business-to-project/meta.json'
import businessToProjectNodes from './processes/business-to-project/nodes.json'
import businessToProjectEdges from './processes/business-to-project/edges.json'

import consignmentPurchaseReceipt from './processes/consignment-purchase-receipt.json'
import b2bDomesticOrderToSales from './processes/b2b-domestic-order-to-sales.json'
import b2bDomesticReturn from './processes/b2b-domestic-return.json'
import b2bExportOrderToSales from './processes/b2b-export-order-to-sales.json'
import b2cOrderToSales from './processes/b2c-order-to-sales.json'
import preorderToSales from './processes/preorder-to-sales.json'
import stockTransfer from './processes/stock-transfer.json'
import otherIssue from './processes/other-issue.json'
import consignmentSettlement from './processes/consignment-settlement.json'
import royaltyMgSettlement from './processes/royalty-mg-settlement.json'
import popupConcertStockSalesSync from './processes/popup-concert-stock-sales-sync.json'

import type { Edge, Node } from '../types/process'

type ProcessRegistryFile = {
  source: string
  version: string
  processes: { id: string; file: string; name: string; overviewNodeId: string }[]
}

const registry = registryJson as ProcessRegistryFile

const scmDetailFiles: DetailProcessFile[] = [
  consignmentPurchaseReceipt,
  b2bDomesticOrderToSales,
  b2bDomesticReturn,
  b2bExportOrderToSales,
  b2cOrderToSales,
  preorderToSales,
  stockTransfer,
  otherIssue,
  consignmentSettlement,
  royaltyMgSettlement,
  popupConcertStockSalesSync,
] as DetailProcessFile[]

const scmDetailProcesses = scmDetailFiles.map(loadDetailProcessFile)

/** SCM TO-BE Detail Process + E2E 레거시 샘플 */
export const processRegistry: Process[] = [
  loadProcessBundle(
    businessToProjectMeta as ProcessMeta,
    businessToProjectNodes as Node[],
    businessToProjectEdges as Edge[],
  ),
  ...scmDetailProcesses,
]

export const scmProcessRegistry = registry

/** ID로 프로세스 조회 */
export function getProcessById(id: string): Process | undefined {
  return processRegistry.find((p) => p.id === id)
}

/** 기본 프로세스 (첫 번째) */
export const defaultProcess = processRegistry[0]
