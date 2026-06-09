'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { getSignedUrl, formatBytes } from '@/lib/storage';
import type { StorageItem } from '@/lib/storage';

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'];

export function FilePreview({
  item,
  open,
  onClose,
}: {
  item: StorageItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !item) {
      setUrl(null);
      return;
    }
    setLoading(true);
    getSignedUrl(supabase, item.path, 300)
      .then(setUrl)
      .catch(() => setUrl(null))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.path]);

  if (!item) return null;
  const ext = item.name.split('.').pop()?.toLowerCase() ?? '';
  const isImage = IMAGE_EXT.includes(ext);
  const isPdf = ext === 'pdf';

  return (
    <Modal open={open} onClose={onClose} title={item.name} maxWidth="max-w-3xl">
      <div className="min-h-[200px]">
        {loading && (
          <div className="flex h-64 items-center justify-center text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        )}
        {!loading && url && isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={item.name} className="mx-auto max-h-[70vh] rounded-lg object-contain" />
        )}
        {!loading && url && isPdf && (
          <iframe src={url} title={item.name} className="h-[70vh] w-full rounded-lg border" />
        )}
        {!loading && url && !isImage && !isPdf && (
          <div className="flex flex-col items-center gap-3 py-10 text-center text-gray-500">
            <p>Ehhez a fájltípushoz nincs előnézet.</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm text-gray-500">
        <span>{formatBytes(item.size)}</span>
        {url && (
          <a href={url} download={item.name} className="btn-primary" target="_blank" rel="noreferrer">
            <Download size={16} /> Letöltés
          </a>
        )}
      </div>
    </Modal>
  );
}
