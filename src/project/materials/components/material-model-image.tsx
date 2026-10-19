import { useEffect, useState } from 'react';
import type { MaterialModelSnapshot } from '@/project/materials/model/material';
import { createSignedStorageUrl } from '@/lib/storage';

export function MaterialModelImageView({
  image,
  alt,
  className,
}: {
  image: MaterialModelSnapshot['images'][number] | null | undefined;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(image?.externalUrl ?? null);
  useEffect(() => {
    let cancelled = false;
    setSrc(image?.externalUrl ?? null);
    if (image?.storagePath) {
      void createSignedStorageUrl(
        'material-model-images',
        image.storagePath,
        3600,
      )
        .then((url) => {
          if (!cancelled) setSrc(url);
        })
        .catch(() => {
          if (!cancelled) setSrc(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [image?.externalUrl, image?.storagePath]);
  if (!src) return null;
  return <img src={src} alt={alt} className={className} loading="lazy" />;
}
