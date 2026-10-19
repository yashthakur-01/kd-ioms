import { OrdersListView } from '@/features/orders/OrdersListView';

export const metadata = {
  title: 'Order History | KD-IOMS',
  description: 'Track and manage your pharmacy medicine orders and reservations.',
};

export default function OrdersPage() {
  return <OrdersListView />;
}
