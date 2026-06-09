import { requireStaff } from '@/lib/session';
import { DemandBuilder } from '@/components/demand/DemandBuilder';

export default async function NewDemandPage() {
  const user = await requireStaff();
  return <DemandBuilder user={user} />;
}
