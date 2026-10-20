import { apiFetch, type ApiResponse } from './client';
import type { OrderStatus } from '../enums/order-status.enum';

export interface PlaceOrderItemPayload {
  medicineId: number;
  quantity: number;
  quotedPriceInclGst: string;
}

export interface PlaceOrderPayload {
  retailerId?: string;
  note?: string | null;
  items: PlaceOrderItemPayload[];
}

export interface PlacedOrderData {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  retailerId: string;
  note?: string | null;
  itemCount: number;
  totalAmount: string;
  items: Array<{
    orderItemId: number;
    medicineId: number;
    requestedQuantity: number;
    quotedPriceInclGst: string;
    fulfilmentStatus: string;
    deliveryStatus: string;
  }>;
  createdAt: string;
}

export interface OrderListItem {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  note?: string | null;
  itemCount: number;
  totalAmount: string;
  retailer: {
    id: string;
    username: string;
    pharmacyName: string;
  };
  createdAt: string;
}

export interface OrderDetailItem {
  orderItemId: number;
  medicineId: number;
  medicineName: string;
  company: string;
  packSize: string;
  gstRate: string;
  requestedQuantity: number;
  quotedPriceInclGst: string;
  pickedQuantity: number;
  fulfilmentStatus: string;
  deliveryStatus: string;
  refusalReason?: string | null;
}

export interface OrderStatusHistoryItem {
  historyId: number;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorId?: string | null;
  actorName: string;
  actorRole?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface OrderDetailData {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  retailer: {
    id: string;
    username: string;
    pharmacyName: string;
  };
  deliveryPartner?: {
    id: string;
    username: string;
    phone?: string | null;
  } | null;
  deliveryPhotoPath?: string | null;
  note?: string | null;
  rejectionReason?: string | null;
  cancelledAt?: string | null;
  deliveredAt?: string | null;
  createdAt: string;
  totalAmount: string;
  itemCount: number;
  items: OrderDetailItem[];
  history: OrderStatusHistoryItem[];
  allocations?: Array<{
    allocationId: number;
    orderItemId: number;
    batchId: number;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    rate: string;
    mrp: string;
    gstRate: string;
    captureMethod: string;
    createdAt: string;
  }>;
}

export interface CancelOrderResponseData {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  cancelledAt: string;
}

export interface GetOrdersQueryParams {
  status?: OrderStatus;
  from?: string;
  to?: string;
  retailerId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: 'createdAt' | '-createdAt';
}

export async function placeOrder(
  payload: PlaceOrderPayload,
  idempotencyKey: string
): Promise<ApiResponse<PlacedOrderData>> {
  return apiFetch<PlacedOrderData>('/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
    idempotencyKey,
  });
}

export async function getOrders(
  params?: GetOrdersQueryParams
): Promise<ApiResponse<OrderListItem[]>> {
  return apiFetch<OrderListItem[]>('/orders', {
    method: 'GET',
    query: params as Record<string, string | number | boolean | undefined>,
  });
}

export async function getOrderById(
  orderId: number
): Promise<ApiResponse<OrderDetailData>> {
  return apiFetch<OrderDetailData>(`/orders/${orderId}`, {
    method: 'GET',
  });
}

export async function cancelOrder(
  orderId: number,
  reason?: string | null
): Promise<ApiResponse<CancelOrderResponseData>> {
  return apiFetch<CancelOrderResponseData>(`/orders/${orderId}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason || null }),
  });
}

export interface BatchPickSuggestion {
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  quantityOnHand: number;
  sellingPrice: string;
  mrp: string;
  gstRate: string;
  priceInclGst: string;
  withinQuote: boolean;
  suggestedQty: number;
}

export interface ItemPickSuggestion {
  orderItemId: number;
  medicineId: number;
  medicineName: string;
  company: string;
  packSize: string;
  requestedQuantity: number;
  quotedPriceInclGst: string;
  suggestedTotalPicked: number;
  shortfall: number;
  batches: BatchPickSuggestion[];
}

export interface OrderPickSuggestionsResult {
  orderId: number;
  orderNumber: string;
  items: ItemPickSuggestion[];
}

export interface BatchPickAllocationInput {
  batchId: number;
  quantity: number;
  captureMethod: 'SCAN_CAMERA' | 'SCAN_GUN' | 'MANUAL';
  scannedPayload?: string;
}

export interface OrderLinePickInput {
  orderItemId: number;
  allocations: BatchPickAllocationInput[];
}

export interface ApproveOrderPayload {
  picks: OrderLinePickInput[];
}

export interface ApproveOrderResponseData {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  items: Array<{
    orderItemId: number;
    requestedQuantity: number;
    pickedQuantity: number;
    fulfilmentStatus: 'FULL' | 'PARTIAL' | 'NONE';
    allocations: Array<{
      allocationId: number;
      batchId: number;
      quantity: number;
    }>;
  }>;
}

export interface RejectOrderResponseData {
  orderId: number;
  orderNumber: string;
  status: OrderStatus;
  rejectionReason: string;
}

export interface ResolveScanResponseData {
  resolved: boolean;
  batch?: {
    batchId: number;
    batchNumber: string;
    expiryDate: string;
    medicineId: number;
    medicineName: string;
    quantityOnHand: number;
    mrp: string;
    sellingPrice: string;
    gstRate: string;
    priceInclGst: string;
  };
  parsed?: {
    gtin?: string;
    batchNumber?: string;
    expiryDate?: string;
    serial?: string;
  };
  message?: string;
}

export async function getPickSuggestions(
  orderId: number
): Promise<ApiResponse<OrderPickSuggestionsResult>> {
  return apiFetch<OrderPickSuggestionsResult>(`/orders/${orderId}/pick-suggestions`, {
    method: 'GET',
  });
}

export async function approveOrder(
  orderId: number,
  payload: ApproveOrderPayload
): Promise<ApiResponse<ApproveOrderResponseData>> {
  return apiFetch<ApproveOrderResponseData>(`/orders/${orderId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function rejectOrder(
  orderId: number,
  reason: string
): Promise<ApiResponse<RejectOrderResponseData>> {
  return apiFetch<RejectOrderResponseData>(`/orders/${orderId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function resolveScan(
  payload: string,
  medicineId?: number
): Promise<ApiResponse<ResolveScanResponseData>> {
  return apiFetch<ResolveScanResponseData>('/batches/resolve-scan', {
    method: 'POST',
    body: JSON.stringify({ payload, medicineId }),
  });
}

