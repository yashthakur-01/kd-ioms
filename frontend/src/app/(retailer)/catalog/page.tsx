import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export default function RetailerCatalogPage() {
  return (
    <div>
      <PageHeader
        title="Medicine Catalog"
        description="Browse available medicines and live warehouse stock"
      />
      <EmptyState
        title="Catalog items will appear here"
        description="Catalog and ordering will unlock after pharmacy KYC verification."
      />
    </div>
  );
}
