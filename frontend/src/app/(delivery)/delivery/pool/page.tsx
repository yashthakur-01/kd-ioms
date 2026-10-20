import { DeliveryPoolView } from '@/features/delivery/DeliveryPoolView';

export const metadata = {
  title: 'Dispatch Pool | KD-IOMS Delivery',
  description: 'Claim wholesale orders ready for delivery',
};

export default function DeliveryPoolPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <DeliveryPoolView />
    </div>
  );
}
