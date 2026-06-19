export const CONNECTOR_SUB_TYPES = ['split', 'merge'] as const
export type ConnectorSubType = (typeof CONNECTOR_SUB_TYPES)[number]
