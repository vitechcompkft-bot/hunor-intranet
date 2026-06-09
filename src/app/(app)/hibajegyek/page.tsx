import { requireUser } from '@/lib/session';
import { BugReportList } from '@/components/bug/BugReportList';

export default async function BugReportsPage() {
  const user = await requireUser();
  return <BugReportList user={user} />;
}
