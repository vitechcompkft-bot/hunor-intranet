import { requireUser } from '@/lib/session';
import { BookOpen, ExternalLink } from 'lucide-react';

export default async function DocumentationPage() {
  await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Dokumentáció</h1>
      <div className="card flex flex-col items-center gap-4 p-10 text-center">
        <div className="rounded-full bg-brand-50 p-4 text-brand-600">
          <BookOpen size={32} />
        </div>
        <p className="text-gray-600">A felhasználói kézikönyv új lapon nyílik meg.</p>
        <a href="/viewer-kezikonyv.html" target="_blank" rel="noreferrer" className="btn-primary">
          <ExternalLink size={16} /> Kézikönyv megnyitása
        </a>
      </div>
    </div>
  );
}
