import { PageHeader } from '@/components/layout/PageHeader';

export default function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="Admin Operations Dashboard"
        description="Real-time warehouse operational summary and order queue"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs uppercase font-semibold text-slate-500">Placed Orders</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">0</div>
        </div>
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs uppercase font-semibold text-slate-500">Pending Retailers</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">0</div>
        </div>
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs uppercase font-semibold text-slate-500">Near Expiry Batches</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">0</div>
        </div>
        <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs uppercase font-semibold text-slate-500">Out of Stock</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">0</div>
        </div>
      </div>
    </div>
  );
}
