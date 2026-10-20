export interface PoolOrderRetailerDto {
  userId: string;
  shopName: string;
  pharmacyName: string;
  city: string;
  pincode: string;
  phone: string;
}

export interface PoolOrderDto {
  orderId: number;
  orderNumber: string;
  retailer: PoolOrderRetailerDto;
  itemCount: number;
  totalAmount: string;
  approvedAt: string | null;
  createdAt: string;
}

export interface PartnerOrderSummaryDto {
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

export interface DeliveryItemAllocationDto {
  allocationId: number;
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  rate: string;
  mrp: string;
  gstRate: string;
}

export interface DeliveryItemDetailDto {
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
  allocations: DeliveryItemAllocationDto[];
}

export interface DeliveryRetailerDetailDto {
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

export interface DeliveryOrderDetailDto {
  orderId: number;
  orderNumber: string;
  status: string;
  note: string | null;
  claimedAt: string | null;
  deliveredAt: string | null;
  deliveryPhotoPath: string | null;
  rejectionReason: string | null;
  createdAt: string;
  retailer: DeliveryRetailerDetailDto;
  deliveryPartner: {
    id: string;
    username: string;
  } | null;
  itemCount: number;
  totalAmount: string;
  items: DeliveryItemDetailDto[];
}

export interface LineDecisionDto {
  orderItemId: number;
  decision: 'ACCEPTED' | 'REFUSED';
  reason?: string;
}
