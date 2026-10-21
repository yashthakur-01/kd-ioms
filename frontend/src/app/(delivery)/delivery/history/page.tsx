import { PartnerOrdersView } from '@/features/delivery/PartnerOrdersView';

export const metadata = {
  title: 'Delivery History | KD-IOMS Delivery',
  description: 'View completed and past doorstep order fulfillments',
};

export default function DeliveryHistoryPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PartnerOrdersView initialTab="past" />
    </div>
  );
}
