import { useState } from 'react';
import { getSettings } from '@/api/client';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import { Toast } from '@/components/Toast';
import { useApi } from '@/lib/useApi';
import { SettingsForm } from './SettingsForm';

export function SettingsPage() {
  const settings = useApi(getSettings);
  const [toast, setToast] = useState<string | null>(null);

  if (!settings.data) {
    return settings.error ? <ErrorState message={settings.error.message} onRetry={settings.retry} /> : <Skeleton className="h-96" />;
  }

  return (
    <Card title="Cash Guard settings">
      {/* key: start the form again from the saved values whenever they change */}
      <SettingsForm key={JSON.stringify(settings.data)} settings={settings.data} onSaved={setToast} />
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </Card>
  );
}
