import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { DemandFill } from '@/components/demand/DemandFill';

export default async function DemandFillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  // Staff a konszolidált nézetet látja, a bolt a kitöltőt
  if (isStaff) redirect(`/igenybekero/${id}/osszesito`);
  return <DemandFill user={user} formId={id} />;
}
