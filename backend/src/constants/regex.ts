export const REGEX = Object.freeze({
  PHONE_INDIAN: /^[6-9]\d{9}$/,
  PHONE_E164: /^\+[1-9]\d{7,14}$/,
  PINCODE_INDIAN: /^\d{6}$/,
  GSTIN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  DRUG_LICENSE: /^[A-Za-z0-9\-\/ ]{5,50}$/,
  MONEY_STRING: /^\d+(\.\d{1,2})?$/,
  DATE_YYYY_MM_DD: /^\d{4}-\d{2}-\d{2}$/,
  USERNAME: /^[a-z0-9._-]{3,50}$/,
});
