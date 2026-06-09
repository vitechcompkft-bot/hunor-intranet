import { requireUser } from '@/lib/session';
import { FilesTabs } from '@/components/files/FilesTabs';

export default async function HomePage() {
  const user = await requireUser();
  return <FilesTabs user={user} />;
}
