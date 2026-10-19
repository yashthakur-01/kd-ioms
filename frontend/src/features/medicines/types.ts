export interface LinkedSalt {
  saltId: number;
  saltName: string;
}

export interface MedicineRecord {
  medicineId: number;
  name: string;
  company: string;
  packSize: string;
  gstRate: string;
  saltIds: number[];
  saltsText: string;
  salts: LinkedSalt[];
  isActive: boolean;
  onHand?: number;
  activeBatchCount?: number;
  score?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMedicinePayload {
  name: string;
  company: string;
  packSize?: string;
  gstRate: number;
  saltIds: number[];
}

export interface UpdateMedicinePayload {
  name?: string;
  company?: string;
  packSize?: string;
  gstRate?: number;
  saltIds?: number[];
  isActive?: boolean;
}

export interface ListMedicinesParams {
  q?: string;
  saltId?: number;
  company?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
}
