import type { Process } from '../types/process'
import { loadDetailProcessFile, loadProcessBundle, type ProcessMeta } from './processLoader'
import type { DetailProcessFile } from './processLoader'

import registryJson from './processRegistry.json'

import businessToProjectMeta from './processes/business-to-project/meta.json'
import businessToProjectNodes from './processes/business-to-project/nodes.json'
import businessToProjectEdges from './processes/business-to-project/edges.json'

import businessToPurchaseRequest from './processes/business-to-purchase-request.json'
import purchaseToApInvoice from './processes/purchase-to-ap-invoice.json'
import b2bDomesticOrderToSales from './processes/b2b-domestic-order-to-sales.json'
import b2bDomesticReturn from './processes/b2b-domestic-return.json'
import b2bExportOrderToSales from './processes/b2b-export-order-to-sales.json'
import b2cOrderToSales from './processes/b2c-order-to-sales.json'
import preorderToSales from './processes/preorder-to-sales.json'
import b2cReturn from './processes/b2c-return.json'
import popupConcertStockSalesSync from './processes/popup-concert-stock-sales-sync.json'
import eventSales from './processes/event-sales.json'
import storeSales from './processes/store-sales.json'
import stockTransfer from './processes/stock-transfer.json'
import otherIssue from './processes/other-issue.json'
import royaltyMgSettlement from './processes/royalty-mg-settlement.json'
import consignmentSettlement from './processes/consignment-settlement.json'
import revenueShareSettlement from './processes/revenue-share-settlement.json'
import serviceBusinessToExpense from './processes/service-business-to-expense.json'
import servicePurchaseToAp from './processes/service-purchase-to-ap.json'
import serviceOrderToSales from './processes/service-order-to-sales.json'
import serviceProjectSettlement from './processes/service-project-settlement.json'
import purchaseReturn from './processes/purchase-return.json'
import otherReceipt from './processes/other-receipt.json'
import stockMovement from './processes/stock-movement.json'
import storageLocationMaster from './processes/storage-location-master.json'

import type { Edge, Node } from '../types/process'

type ProcessRegistryFile = {
  source: string
  version: string
  processes: { id: string; file: string; name: string; overviewNodeId: string }[]
}

const registry = registryJson as ProcessRegistryFile

const scmDetailFiles: DetailProcessFile[] = [
  businessToPurchaseRequest,
  purchaseToApInvoice,
  b2bDomesticOrderToSales,
  b2bDomesticReturn,
  b2bExportOrderToSales,
  b2cOrderToSales,
  preorderToSales,
  b2cReturn,
  popupConcertStockSalesSync,
  eventSales,
  storeSales,
  stockTransfer,
  otherIssue,
  royaltyMgSettlement,
  consignmentSettlement,
  revenueShareSettlement,
  serviceBusinessToExpense,
  servicePurchaseToAp,
  serviceOrderToSales,
  serviceProjectSettlement,
  purchaseReturn,
  otherReceipt,
  stockMovement,
  storageLocationMaster,
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
