import { requireUser } from '@/lib/session';
import { ChatPanel, ChatHeader } from '@/components/chat/ChatPanel';

export default async function ChatPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <ChatHeader />
      <div className="card overflow-hidden">
        <ChatPanel />
      </div>
    </div>
  );
}
