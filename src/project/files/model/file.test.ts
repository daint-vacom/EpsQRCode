import { describe, expect, it } from 'vitest';
import { getFileThumbnailKind } from './file';

describe('getFileThumbnailKind', () => {
  it.each([
    ['image/png', 'photo.png', 'image'],
    ['application/octet-stream', 'photo.jpg', 'image'],
    ['application/pdf', 'contract.pdf', 'pdf'],
    ['text/plain', 'notes.txt', 'text'],
    ['video/mp4', 'demo.mp4', 'video'],
    [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'contract.docx',
      'unsupported',
    ],
    ['application/msword', 'contract.doc', 'unsupported'],
  ])('classifies %s %s as %s', (mimeType, fileName, expected) => {
    expect(getFileThumbnailKind({ mimeType, fileName })).toBe(expected);
  });
});
