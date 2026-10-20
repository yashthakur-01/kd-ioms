import { redirect } from 'next/navigation';

export default function LegacyDeliveriesPage() {
  redirect('/delivery/orders');
}
