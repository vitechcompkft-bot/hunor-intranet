'use client';

import { Printer, Lightbulb } from 'lucide-react';
import { DOCUMENTATION, type DocBlock } from '@/lib/documentation';
import { useTouch } from '@/lib/useTouch';

function Block({ block }: { block: DocBlock }) {
  switch (block.type) {
    case 'h3':
      return <h3 className="mt-5 mb-1.5 text-base font-semibold text-gray-800">{block.text}</h3>;
    case 'p':
      return <p className="mb-3 leading-relaxed text-gray-700">{block.text}</p>;
    case 'ul':
      return (
        <ul className="mb-3 list-disc space-y-1 pl-5 text-gray-700">
          {block.items.map((it, i) => (
            <li key={i} className="leading-relaxed">{it}</li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-gray-700">
          {block.items.map((it, i) => (
            <li key={i} className="leading-relaxed">{it}</li>
          ))}
        </ol>
      );
    case 'tip':
      return (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <Lightbulb size={16} className="mt-0.5 shrink-0" />
          <span>{block.text}</span>
        </div>
      );
  }
}

export function DocumentationView() {
  const touch = useTouch();

  return (
    <div className={touch ? 'flex h-full min-h-0 flex-col gap-4' : 'space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Dokumentáció</h1>
        <button onClick={() => window.print()} className="btn-primary no-print">
          <Printer size={16} /> PDF letöltése
        </button>
      </div>

      <div className={`doc-print card overflow-y-auto p-6 ${touch ? 'min-h-0 flex-1' : ''}`}>
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-1 hidden text-2xl font-bold text-gray-900 print:block">
            HUNOR Coop Intranet — Felhasználói kézikönyv
          </h1>
          {DOCUMENTATION.map((section) => (
            <section key={section.id} className="mb-8">
              <h2 className="mb-3 border-b border-brand-100 pb-1 text-xl font-bold text-brand-700">
                {section.title}
              </h2>
              {section.blocks.map((block, i) => (
                <Block key={i} block={block} />
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
