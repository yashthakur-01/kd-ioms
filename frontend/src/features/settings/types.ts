export interface BusinessProfile {
  name: string;
  address: string;
  gstin: string;
  drugLicenseNumber: string;
  phone: string;
  email: string;
  logoPath?: string | null;
}

export interface AppSettings {
  expiryAlertDays: number;
  businessProfile: BusinessProfile;
}

export interface PatchSettingsInput {
  expiryAlertDays?: number;
  businessProfile?: Partial<BusinessProfile>;
}
