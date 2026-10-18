export const GST_SLAB = Object.freeze([0, 5, 12, 18, 28] as const);

export type GstSlab = typeof GST_SLAB[number];
