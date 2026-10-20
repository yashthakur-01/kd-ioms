import { PartnerOrdersView } from '@/features/delivery/PartnerOrdersView';

export const metadata = {
  title: 'My Deliveries | KD-IOMS Delivery',
  description: 'Manage active doorstep orders and track fulfillment history',
};

export default function PartnerOrdersPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <PartnerOrdersView />
    </div>
  );
}
