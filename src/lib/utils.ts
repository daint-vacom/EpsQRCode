import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Keep custom --text-* tokens in sync so size utilities do not evict text colors.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        '2sm',
        '2xs',
        'page-title',
        'section-title',
        'grid-header',
        'supporting',
        'metric',
      ],
    },
  },
});

/**
 * Merges Tailwind class names, resolving any conflicts.
 *
 * @param inputs - An array of class names to merge.
 * @returns A string of merged and optimized class names.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
