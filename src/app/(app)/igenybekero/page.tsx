import { requireUser } from '@/lib/session';
import { DemandAdminList } from '@/components/demand/DemandAdminList';
import { DemandViewerList } from '@/components/demand/DemandViewerList';

export default async function DemandPage() {
  const user = await requireUser();
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  return isStaff ? <DemandAdminList /> : <DemandViewerList user={user} />;
}
