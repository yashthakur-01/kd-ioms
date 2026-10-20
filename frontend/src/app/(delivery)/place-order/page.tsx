import { redirect } from 'next/navigation';

export default function LegacyPlaceOrderPage() {
  redirect('/delivery/orders/new');
}
