import React from 'react';

export function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-xs text-rose-600 font-medium">{error}</p>;
}
