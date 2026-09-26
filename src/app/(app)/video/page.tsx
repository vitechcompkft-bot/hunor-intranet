import { requireUser } from '@/lib/session';
import { VideoConference } from '@/components/video/VideoConference';

export default async function VideoPage() {
  const user = await requireUser();
  return <VideoConference user={user} />;
}
