'use client';

import React from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { SettingsForm } from '../../../features/settings/components/SettingsForm';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Global System Settings"
        description="Configure operational alert thresholds, company invoice details, and business identity."
      />
      <SettingsForm />
    </div>
  );
}
