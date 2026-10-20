import { apiFetch, type ApiResponse } from './client';

export interface PoolOrderRetailer {
  userId: string;
  shopName: string;
  pharmacyName: string;
  city: string;
  pincode: string;
  phone: string;
}

export interface PoolOrderRecord {
  orderId: number;
  orderNumber: string;
  retailer: PoolOrderRetailer;
  itemCount: number;
  totalAmount: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface PartnerOrderRecord {
  orderId: number;
  orderNumber: string;
  status: string;
  retailerShopName: string;
  city: string;
  itemCount: number;
  totalAmount: string;
  claimedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface DeliveryAllocationRecord {
  allocationId: number;
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  rate: string;
  mrp: string;
  gstRate: string;
}

export interface DeliveryItemRecord {
  orderItemId: number;
  medicineId: number;
  medicineName: string;
  company: string;
  packSize: string;
  requestedQuantity: number;
  pickedQuantity: number;
  quotedPriceInclGst: string;
  deliveryStatus: 'PENDING' | 'ACCEPTED' | 'REFUSED';
  refusalReason: string | null;
  allocations: DeliveryAllocationRecord[];
}

export interface DeliveryRetailerDetail {
  userId: string;
  shopName: string;
  pharmacyName: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  whatsappNumber: string;
  phone: string;
}

export interface DeliveryDetailRecord {
  orderId: number;
  orderNumber: string;
  status: string;
  note: string | null;
  claimedAt: string | null;
  deliveredAt: string | null;
  deliveryPhotoPath: string | null;
  rejectionReason: string | null;
  createdAt: string;
  retailer: DeliveryRetailerDetail;
  deliveryPartner: {
    id: string;
    username: string;
  } | null;
  itemCount: number;
  totalAmount: string;
  items: DeliveryItemRecord[];
}

export interface LineDecisionPayload {
  orderItemId: number;
  decision: 'ACCEPTED' | 'REFUSED';
  reason?: string;
}

export interface CompleteDeliveryPayload {
  photo: File | Blob;
  decisions: LineDecisionPayload[];
}

/**
 * Fetch available unassigned approved orders from the dispatch pool.
 */
export async function fetchDeliveryPool(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<PoolOrderRecord[]>> {
  return apiFetch<PoolOrderRecord[]>('/delivery/pool', {
    method: 'GET',
    query: {
      page: params?.page || 1,
      pageSize: params?.pageSize || 20,
    },
  });
}

/**
 * Claim an approved order from the dispatch pool.
 */
export async function claimDeliveryOrder(
  orderId: number
): Promise<ApiResponse<DeliveryDetailRecord>> {
  return apiFetch<DeliveryDetailRecord>(`/delivery/orders/${orderId}/claim`, {
    method: 'POST',
  });
}

/**
 * Release an order currently out for delivery back to the dispatch pool.
 */
export async function releaseDeliveryOrder(
  orderId: number,
  reason?: string
): Promise<ApiResponse<{ orderId: number; status: string; message: string }>> {
  return apiFetch<{ orderId: number; status: string; message: string }>(
    `/delivery/orders/${orderId}/release`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }
  );
}

/**
 * Admin override for an out-for-delivery order (reassign or return to pool).
 */
export async function overrideDeliveryOrder(
  orderId: number,
  payload: { targetPartnerId?: string | null; reason: string }
): Promise<ApiResponse<{ orderId: number; message: string }>> {
  return apiFetch<{ orderId: number; message: string }>(
    `/delivery/orders/${orderId}/override`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Fetch orders claimed by the current delivery partner.
 */
export async function fetchPartnerDeliveries(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ApiResponse<PartnerOrderRecord[]>> {
  return apiFetch<PartnerOrderRecord[]>('/delivery/orders', {
    method: 'GET',
    query: {
      status: params?.status,
      page: params?.page || 1,
      pageSize: params?.pageSize || 20,
    },
  });
}

/**
 * Fetch full details for a delivery stop including contact address and batch allocations.
 */
export async function fetchDeliveryOrderDetail(
  orderId: number
): Promise<ApiResponse<DeliveryDetailRecord>> {
  return apiFetch<DeliveryDetailRecord>(`/delivery/orders/${orderId}`, {
    method: 'GET',
  });
}

/**
 * Complete a delivery with photo proof and whole-line item decisions.
 */
export async function completeDeliveryOrder(
  orderId: number,
  payload: CompleteDeliveryPayload
): Promise<ApiResponse<DeliveryDetailRecord>> {
  const formData = new FormData();
  formData.append('photo', payload.photo);
  formData.append('decisions', JSON.stringify(payload.decisions));

  return apiFetch<DeliveryDetailRecord>(`/delivery/orders/${orderId}/complete`, {
    method: 'POST',
    body: formData,
  });
}
