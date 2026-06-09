import { requireUser } from '@/lib/session';
import { VideoConference } from '@/components/video/VideoConference';

export default async function VideoPage() {
  await requireUser();
  return <VideoConference />;
}
