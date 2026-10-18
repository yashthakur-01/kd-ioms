import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function DeliveryPoolPage() {
  return (
    <div>
      <PageHeader
        title="Delivery Dispatch Pool"
        description="Claim approved wholesale orders ready for delivery"
      />
      <EmptyState
        title="No orders ready for pickup"
        description="Approved orders awaiting dispatch will appear here."
      />
    </div>
  );
}
