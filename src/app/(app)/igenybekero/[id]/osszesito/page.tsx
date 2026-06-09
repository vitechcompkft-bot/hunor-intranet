import { requireStaff } from '@/lib/session';
import { DemandConsolidated } from '@/components/demand/DemandConsolidated';

export default async function DemandConsolidatedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  return <DemandConsolidated formId={id} />;
}
