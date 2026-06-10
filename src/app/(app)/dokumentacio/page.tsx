import { requireUser } from '@/lib/session';
import { DocumentationView } from '@/components/docs/DocumentationView';

export default async function DocumentationPage() {
  await requireUser();
  return <DocumentationView />;
}
