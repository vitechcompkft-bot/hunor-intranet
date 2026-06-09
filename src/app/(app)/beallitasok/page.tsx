import { requireStaff } from '@/lib/session';
import { SettingsPage } from '@/components/settings/SettingsPage';

export default async function BeallitasokPage() {
  const user = await requireStaff();
  return <SettingsPage user={user} />;
}
