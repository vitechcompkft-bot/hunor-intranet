import { requireUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { resolveAllowedMenus } from '@/lib/permissions';
import { AppShell } from '@/components/AppShell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();
  const allowed = await resolveAllowedMenus(supabase, user);

  return (
    <AppShell user={user} allowed={Array.from(allowed)}>
      {children}
    </AppShell>
  );
}
