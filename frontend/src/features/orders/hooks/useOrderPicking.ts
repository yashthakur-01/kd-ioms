'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  getPickSuggestions,
  approveOrder,
  rejectOrder,
  resolveScan,
  type OrderPickSuggestionsResult,
  type BatchPickSuggestion,
  type OrderLinePickInput,
} from '../../../lib/api/orders.api';
import { useToast } from '../../../providers/ToastProvider';

export interface PickedAllocation {
  batchId: number;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  maxOnHand: number;
  priceInclGst: string;
  withinQuote: boolean;
  captureMethod: 'SCAN_CAMERA' | 'SCAN_GUN' | 'MANUAL';
  scannedPayload?: string;
}

export type PickStateMap = Record<number, PickedAllocation[]>;

/**
 * Audio chime for warehouse picking feedback
 */
export function playChime(type: 'success' | 'error') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // A6
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // Ignore audio playback failure (e.g. autoplay policy)
  }
}

export function useOrderPicking(orderId: number) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showSuccess, showError } = useToast();

  const [customAllocations, setCustomAllocations] = useState<PickStateMap | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);

  // 1. Fetch FEFO pick suggestions
  const {
    data: suggestionsResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['orders', orderId, 'pick-suggestions'],
    queryFn: () => getPickSuggestions(orderId),
    enabled: orderId > 0,
    staleTime: 1000 * 60, // 1 min
  });

  const suggestions: OrderPickSuggestionsResult | undefined = suggestionsResponse?.data;

  // Derive default allocations from FEFO suggestions
  const defaultAllocations = useMemo(() => {
    if (!suggestions?.items) return {};
    const initial: PickStateMap = {};
    for (const item of suggestions.items) {
      const lineAllocs: PickedAllocation[] = [];
      const batches = item.batches || (item as any).suggestions || [];
      for (const batch of batches) {
        if (batch.suggestedQty > 0) {
          lineAllocs.push({
            batchId: batch.batchId,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            quantity: batch.suggestedQty,
            maxOnHand: batch.quantityOnHand,
            priceInclGst: batch.priceInclGst,
            withinQuote: batch.withinQuote,
            captureMethod: 'MANUAL',
          });
        }
      }
      initial[item.orderItemId] = lineAllocs;
    }
    return initial;
  }, [suggestions]);

  const allocations = customAllocations ?? defaultAllocations;

  const applyAllSuggestions = useCallback(() => {
    setCustomAllocations(defaultAllocations);
  }, [defaultAllocations]);

  // Apply single batch suggestion to a line item
  const applyBatchSuggestion = useCallback(
    (orderItemId: number, batch: BatchPickSuggestion, requestedQty: number) => {
      setCustomAllocations((prev) => {
        const base = prev ?? defaultAllocations;
        const currentList = base[orderItemId] || [];
        const existingIdx = currentList.findIndex((a) => a.batchId === batch.batchId);

        // Sum other allocations on this line
        const otherAllocated = currentList
          .filter((a) => a.batchId !== batch.batchId)
          .reduce((sum, a) => sum + a.quantity, 0);

        const remainingRequested = Math.max(0, requestedQty - otherAllocated);
        const qtyToAssign = Math.min(
          batch.suggestedQty > 0 ? batch.suggestedQty : batch.quantityOnHand,
          batch.quantityOnHand,
          remainingRequested
        );

        if (qtyToAssign <= 0) return prev;

        const newAlloc: PickedAllocation = {
          batchId: batch.batchId,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          quantity: qtyToAssign,
          maxOnHand: batch.quantityOnHand,
          priceInclGst: batch.priceInclGst,
          withinQuote: batch.withinQuote,
          captureMethod: 'MANUAL',
        };

        if (existingIdx >= 0) {
          const updated = [...currentList];
          updated[existingIdx] = newAlloc;
          return { ...prev, [orderItemId]: updated };
        } else {
          return { ...prev, [orderItemId]: [...currentList, newAlloc] };
        }
      });
    },
    [defaultAllocations]
  );

  // Update allocation quantity
  const updateAllocationQuantity = useCallback(
    (orderItemId: number, batchId: number, newQty: number, maxOnHand: number, requestedQty: number) => {
      setCustomAllocations((prev) => {
        const base = prev ?? defaultAllocations;
        const currentList = base[orderItemId] || [];
        if (newQty <= 0) {
          return {
            ...base,
            [orderItemId]: currentList.filter((a) => a.batchId !== batchId),
          };
        }

        const otherAllocated = currentList
          .filter((a) => a.batchId !== batchId)
          .reduce((sum, a) => sum + a.quantity, 0);

        const maxAllowed = Math.min(maxOnHand, requestedQty - otherAllocated);
        const clampedQty = Math.min(newQty, maxAllowed);

        return {
          ...base,
          [orderItemId]: currentList.map((a) =>
            a.batchId === batchId ? { ...a, quantity: clampedQty } : a
          ),
        };
      });
    },
    [defaultAllocations]
  );

  // Remove allocation
  const removeAllocation = useCallback((orderItemId: number, batchId: number) => {
    setCustomAllocations((prev) => {
      const base = prev ?? defaultAllocations;
      return {
        ...base,
        [orderItemId]: (base[orderItemId] || []).filter((a) => a.batchId !== batchId),
      };
    });
  }, [defaultAllocations]);

  // Add allocation directly (e.g. from dropdown or manual scan)
  const addAllocation = useCallback(
    (
      orderItemId: number,
      batch: {
        batchId: number;
        batchNumber: string;
        expiryDate: string;
        quantityOnHand: number;
        priceInclGst: string;
        withinQuote?: boolean;
      },
      quantity: number,
      captureMethod: 'SCAN_CAMERA' | 'SCAN_GUN' | 'MANUAL' = 'MANUAL',
      scannedPayload?: string
    ) => {
      const item = suggestions?.items.find((i) => i.orderItemId === orderItemId);
      const requestedQty = item?.requestedQuantity || 9999;

      setCustomAllocations((prev) => {
        const base = prev ?? defaultAllocations;
        const currentList = base[orderItemId] || [];
        const existingIdx = currentList.findIndex((a) => a.batchId === batch.batchId);

        const otherAllocated = currentList
          .filter((a) => a.batchId !== batch.batchId)
          .reduce((sum, a) => sum + a.quantity, 0);

        const remainingRequested = Math.max(0, requestedQty - otherAllocated);
        const clampedQty = Math.min(quantity, batch.quantityOnHand, remainingRequested);

        if (clampedQty <= 0) return base;

        const alloc: PickedAllocation = {
          batchId: batch.batchId,
          batchNumber: batch.batchNumber,
          expiryDate: batch.expiryDate,
          quantity: clampedQty,
          maxOnHand: batch.quantityOnHand,
          priceInclGst: batch.priceInclGst,
          withinQuote: batch.withinQuote ?? true,
          captureMethod,
          scannedPayload,
        };

        if (existingIdx >= 0) {
          const updated = [...currentList];
          updated[existingIdx] = alloc;
          return { ...base, [orderItemId]: updated };
        } else {
          return { ...base, [orderItemId]: [...currentList, alloc] };
        }
      });
    },
    [suggestions, defaultAllocations]
  );

  // Scan match resolution handler
  const handleScanMatch = useCallback(
    async (
      payload: string,
      targetMedicineId?: number,
      captureMethod: 'SCAN_CAMERA' | 'SCAN_GUN' = 'SCAN_GUN',
      quantityToPick?: number
    ): Promise<{
      success: boolean;
      message?: string;
      batch?: any;
      item?: any;
      allocatedQty?: number;
    }> => {
      try {
        const res = await resolveScan(payload, targetMedicineId);
        if (!res.success || !res.data?.resolved || !res.data.batch) {
          playChime('error');
          return {
            success: false,
            message: res.message || res.data?.message || 'Barcode could not be matched to an active warehouse batch',
          };
        }

        const batch = res.data.batch;
        // Find matching item in order
        const matchingItem = suggestions?.items.find(
          (item) => item.medicineId === batch.medicineId
        );

        if (!matchingItem) {
          playChime('error');
          return {
            success: false,
            message: `Scanned medicine '${batch.medicineName}' is not part of Order #${orderId}`,
          };
        }

        // Add or increment allocation for this item
        const orderItemId = matchingItem.orderItemId;
        const currentList = allocations[orderItemId] || [];
        const existing = currentList.find((a) => a.batchId === batch.batchId);
        const otherAllocated = currentList
          .filter((a) => a.batchId !== batch.batchId)
          .reduce((sum, a) => sum + a.quantity, 0);

        const remainingRequested = Math.max(0, matchingItem.requestedQuantity - otherAllocated);
        const currentQty = existing?.quantity || 0;
        const qtyToAdd = typeof quantityToPick === 'number' && quantityToPick > 0
          ? quantityToPick
          : 1;
        const nextQty = Math.min(currentQty + qtyToAdd, batch.quantityOnHand, remainingRequested);

        if (nextQty <= currentQty && remainingRequested <= currentQty) {
          playChime('error');
          return {
            success: false,
            message: `Line for '${matchingItem.medicineName}' is already fully picked`,
          };
        }

        addAllocation(
          orderItemId,
          {
            batchId: batch.batchId,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            quantityOnHand: batch.quantityOnHand,
            priceInclGst: batch.priceInclGst,
          },
          nextQty,
          captureMethod,
          payload
        );

        // Flash target item card green
        setHighlightedItemId(orderItemId);
        setTimeout(() => setHighlightedItemId(null), 1500);

        playChime('success');
        return {
          success: true,
          message: `Picked ${nextQty - currentQty} unit(s) from batch ${batch.batchNumber} for ${matchingItem.medicineName}`,
          batch,
          item: matchingItem,
          allocatedQty: nextQty,
        };
      } catch (err: unknown) {
        playChime('error');
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Error resolving barcode scan',
        };
      }
    },
    [suggestions, allocations, orderId, addAllocation]
  );

  // Aggregated progress stats
  const stats = useMemo(() => {
    if (!suggestions?.items) {
      return { totalLines: 0, fullLines: 0, partialLines: 0, noneLines: 0, totalPicked: 0, totalRequested: 0 };
    }

    let fullLines = 0;
    let partialLines = 0;
    let noneLines = 0;
    let totalPicked = 0;
    let totalRequested = 0;

    for (const item of suggestions.items) {
      totalRequested += item.requestedQuantity;
      const lineAllocs = allocations[item.orderItemId] || [];
      const linePicked = lineAllocs.reduce((sum, a) => sum + a.quantity, 0);
      totalPicked += linePicked;

      if (linePicked === item.requestedQuantity) {
        fullLines++;
      } else if (linePicked > 0) {
        partialLines++;
      } else {
        noneLines++;
      }
    }

    return {
      totalLines: suggestions.items.length,
      fullLines,
      partialLines,
      noneLines,
      totalPicked,
      totalRequested,
    };
  }, [suggestions, allocations]);

  // Mutations
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!suggestions?.items) throw new Error('Suggestions not loaded');

      const picks: OrderLinePickInput[] = suggestions.items.map((item) => ({
        orderItemId: item.orderItemId,
        allocations: (allocations[item.orderItemId] || []).map((a) => ({
          batchId: a.batchId,
          quantity: a.quantity,
          captureMethod: a.captureMethod,
          scannedPayload: a.scannedPayload,
        })),
      }));

      return approveOrder(orderId, { picks });
    },
    onSuccess: (res) => {
      if (res.success) {
        showSuccess(`Order #${orderId} approved successfully with batch allocations.`);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        queryClient.invalidateQueries({ queryKey: ['batches'] });
        router.push(`/orders`);
      } else {
        showError(res.message || 'Failed to approve order');
      }
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to approve order');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      return rejectOrder(orderId, reason);
    },
    onSuccess: (res) => {
      if (res.success) {
        showSuccess(`Order #${orderId} rejected.`);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
        router.push(`/orders`);
      } else {
        showError(res.message || 'Failed to reject order');
      }
    },
    onError: (err: unknown) => {
      showError(err instanceof Error ? err.message : 'Failed to reject order');
    },
  });

  return {
    orderId,
    suggestions,
    allocations,
    isLoading,
    isError,
    error,
    stats,
    highlightedItemId,
    applyAllSuggestions,
    applyBatchSuggestion,
    updateAllocationQuantity,
    removeAllocation,
    addAllocation,
    handleScanMatch,
    approveOrder: approveMutation.mutate,
    isApproving: approveMutation.isPending,
    rejectOrder: rejectMutation.mutate,
    isRejecting: rejectMutation.isPending,
    refetch,
  };
}
