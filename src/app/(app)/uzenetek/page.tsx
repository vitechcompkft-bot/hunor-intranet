import { requireUser } from '@/lib/session';
import { AdminMessage } from '@/components/messages/AdminMessage';
import { MessageViewer } from '@/components/messages/MessageViewer';

export default async function MessagesPage() {
  const user = await requireUser();
  const isStaff = user.role === 'admin' || user.role === 'kozpont';
  return isStaff ? <AdminMessage user={user} /> : <MessageViewer user={user} />;
}
