export const CAPTURE_METHOD = Object.freeze({
  SCAN_BARCODE: 'SCAN_BARCODE',
  SCAN_OCR: 'SCAN_OCR',
  MANUAL: 'MANUAL',
} as const);

export type CaptureMethod = typeof CAPTURE_METHOD[keyof typeof CAPTURE_METHOD];

export const CAPTURE_METHOD_VALUES = Object.freeze(Object.values(CAPTURE_METHOD)) as readonly [CaptureMethod, ...CaptureMethod[]];
