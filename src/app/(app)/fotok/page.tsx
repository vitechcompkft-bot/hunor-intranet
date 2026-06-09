import { requireUser } from '@/lib/session';
import { PhotoPage } from '@/components/photos/PhotoPage';

export default async function PhotosPage() {
  const user = await requireUser();
  return <PhotoPage user={user} />;
}
