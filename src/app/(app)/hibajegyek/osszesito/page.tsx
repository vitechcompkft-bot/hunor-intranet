import { requireStaff } from '@/lib/session';
import { BugReportConsolidated } from '@/components/bug/BugReportConsolidated';

export default async function BugConsolidatedPage() {
  await requireStaff();
  return <BugReportConsolidated />;
}
