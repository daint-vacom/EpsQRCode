import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  GRADIENT_AVATAR_TONE_CLASSES,
  type GradientAvatarTone,
} from '@/components/common/gradient-avatar';

interface ImageAvatarProps {
  src?: string | null;
  alt: string;
  fallback: string;
  fallbackTone?: GradientAvatarTone;
  className?: string;
}

export function ImageAvatar({
  src,
  alt,
  fallback,
  fallbackTone = 'amber',
  className,
}: ImageAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const imageSource = src?.trim() && !hasError ? src : null;

  useEffect(() => {
    setHasError(false);
  }, [src]);

  return imageSource ? (
    <img
      src={imageSource}
      alt={alt}
      onError={() => setHasError(true)}
      className={cn('shrink-0 object-cover', className)}
    />
  ) : (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center border bg-gradient-to-br font-bold shadow-sm',
        GRADIENT_AVATAR_TONE_CLASSES[fallbackTone],
        className,
      )}
    >
      {fallback}
    </span>
  );
}
