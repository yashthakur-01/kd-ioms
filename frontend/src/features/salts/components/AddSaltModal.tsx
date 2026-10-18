import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { FormField } from '../../../components/ui/FormField';
import { ErrorBanner } from '../../../components/feedback/ErrorBanner';
import { useSaltSuggestions, useCreateSalt } from '../hooks';
import type { SaltRecord } from '../types';
import { ApiError } from '../../../lib/api/api-error';

interface AddSaltModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (salt: SaltRecord) => void;
}

export function AddSaltModal({ isOpen, onClose, onCreated }: AddSaltModalProps) {
  const [saltName, setSaltName] = useState('');
  const [confirmSimilar, setConfirmSimilar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorRef, setErrorRef] = useState<string | undefined>(undefined);

  const { data: suggestions, isLoading: suggestionsLoading } = useSaltSuggestions(saltName);
  const createMutation = useCreateSalt();

  const handleClose = () => {
    setSaltName('');
    setConfirmSimilar(false);
    setErrorMessage(null);
    setErrorRef(undefined);
    onClose();
  };

  const highSimilarityMatches = (suggestions || []).filter((s) => s.similarity > 0.4);
  const hasSimilar = highSimilarityMatches.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorRef(undefined);

    const trimmed = saltName.trim();
    if (!trimmed) return;

    try {
      const createdSalt = await createMutation.mutateAsync({
        saltName: trimmed,
        confirmSimilar: confirmSimilar || false,
      });

      handleClose();
      if (onCreated) {
        onCreated(createdSalt);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        setErrorRef(err.requestId);
      } else {
        setErrorMessage('Failed to create salt. Please try again.');
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add New Salt">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <ErrorBanner message={errorMessage} requestId={errorRef} />
        )}

        <FormField label="Salt / Molecule Name" required>
          <Input
            value={saltName}
            onChange={(e) => {
              setSaltName(e.target.value);
              setConfirmSimilar(false);
              setErrorMessage(null);
            }}
            placeholder="e.g. Paracetamol, Amoxicillin"
            autoFocus
          />
        </FormField>

        {/* Live Collision / Near-Match Warning Banner */}
        {hasSimilar && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
            <div className="font-semibold flex items-center gap-1.5">
              <span>⚠️</span> Similar salts already exist:
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {highSimilarityMatches.map((match) => (
                <span
                  key={match.saltId}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-medium"
                >
                  {match.saltName} ({Math.round(match.similarity * 100)}% match)
                </span>
              ))}
            </div>
            <p className="mt-2 text-amber-750 text-[11px]">
              Did you mean one of the above? If this is a truly distinct molecule, check below to proceed.
            </p>

            <label className="mt-2.5 flex items-center gap-2 cursor-pointer font-medium text-amber-950">
              <input
                type="checkbox"
                checked={confirmSimilar}
                onChange={(e) => setConfirmSimilar(e.target.checked)}
                className="h-4 w-4 rounded border-amber-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Confirm this is a distinct new salt formula</span>
            </label>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={createMutation.isPending || suggestionsLoading}
            disabled={!saltName.trim() || (hasSimilar && !confirmSimilar)}
          >
            Create Salt
          </Button>
        </div>
      </form>
    </Modal>
  );
}
