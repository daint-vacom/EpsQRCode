export function getRichTextPlainText(value: string | undefined): string {
  if (!value) return '';
  if (!value.includes('<')) return value.trim();

  if (typeof DOMParser === 'undefined') {
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}
