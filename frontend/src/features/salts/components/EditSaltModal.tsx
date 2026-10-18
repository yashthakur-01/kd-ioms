import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { FormField } from '../../../components/ui/FormField';
import { ErrorBanner } from '../../../components/feedback/ErrorBanner';
import { useUpdateSalt } from '../hooks';
import type { SaltRecord } from '../types';
import { ApiError } from '../../../lib/api/api-error';

interface EditSaltFormProps {
  salt: SaltRecord;
  onClose: () => void;
  onUpdated?: (salt: SaltRecord) => void;
}

function EditSaltForm({ salt, onClose, onUpdated }: EditSaltFormProps) {
  const [saltName, setSaltName] = useState(salt.saltName);
  const [isActive, setIsActive] = useState(salt.isActive);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorRef, setErrorRef] = useState<string | undefined>(undefined);

  const updateMutation = useUpdateSalt();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorRef(undefined);

    const trimmed = saltName.trim();
    if (!trimmed) return;

    try {
      const updated = await updateMutation.mutateAsync({
        saltId: salt.saltId,
        payload: {
          saltName: trimmed !== salt.saltName ? trimmed : undefined,
          isActive: isActive !== salt.isActive ? isActive : undefined,
        },
      });

      onClose();
      if (onUpdated) {
        onUpdated(updated);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
        setErrorRef(err.requestId);
      } else {
        setErrorMessage('Failed to update salt. Please try again.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {errorMessage && (
        <ErrorBanner message={errorMessage} requestId={errorRef} />
      )}

      <FormField label="Salt / Molecule Name" required>
        <Input
          value={saltName}
          onChange={(e) => {
            setSaltName(e.target.value);
            setErrorMessage(null);
          }}
        />
      </FormField>

      <div className="pt-2">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => {
              setIsActive(e.target.checked);
              setErrorMessage(null);
            }}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-xs font-medium text-slate-800">
            Active in catalog (allow linking to new medicines)
          </span>
        </label>
        {salt.medicineCount > 0 && !isActive && (
          <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
            ⚠️ This salt is currently linked to {salt.medicineCount} medicine(s). Deactivating it will fail if any of those medicines are active.
          </p>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={updateMutation.isPending}
          disabled={!saltName.trim()}
        >
          Save Changes
        </Button>
      </div>
    </form>
  );
}

interface EditSaltModalProps {
  salt: SaltRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: (salt: SaltRecord) => void;
}

export function EditSaltModal({ salt, isOpen, onClose, onUpdated }: EditSaltModalProps) {
  if (!salt) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Edit Salt: ${salt.saltName}`}>
      <EditSaltForm
        key={salt.saltId}
        salt={salt}
        onClose={onClose}
        onUpdated={onUpdated}
      />
    </Modal>
  );
}
