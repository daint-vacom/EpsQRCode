import { describe, expect, it } from 'vitest';
import { getFileIcon } from './file-icon';

describe('file icon asset resolver', () => {
  it('resolves common MIME types to the shared file assets', () => {
    expect(getFileIcon('application/pdf', 'contract.pdf')).toBe('pdf.svg');
    expect(
      getFileIcon(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'report.xlsx',
      ),
    ).toBe('excel.svg');
    expect(getFileIcon('image/png', 'preview.png')).toBe('image.svg');
  });

  it('falls back to the file extension when the MIME type is generic', () => {
    expect(getFileIcon('application/octet-stream', 'archive.zip')).toBe(
      'zip.svg',
    );
    expect(getFileIcon('application/octet-stream', 'script.js')).toBe(
      'javascript.svg',
    );
  });
});
