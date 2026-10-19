export interface SaltRecord {
  saltId: number;
  saltName: string;
  isActive: boolean;
  medicineCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaltSuggestion {
  saltId: number;
  saltName: string;
  similarity: number;
  isActive: boolean;
}

export interface CreateSaltPayload {
  saltName: string;
  confirmSimilar?: boolean;
}

export interface UpdateSaltPayload {
  saltName?: string;
  isActive?: boolean;
}

export interface ListSaltsParams {
  q?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sort?: string;
}
