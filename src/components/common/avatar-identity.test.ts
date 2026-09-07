import { describe, expect, it } from 'vitest';
import { getAvatarInitials } from './avatar-identity';

describe('getAvatarInitials', () => {
  it('uses the first two name parts', () => {
    expect(getAvatarInitials('Đặng Nam')).toBe('ĐN');
    expect(getAvatarInitials('Công ty Ánh Dương')).toBe('CT');
  });

  it('ignores extra whitespace', () => {
    expect(getAvatarInitials('  Nguyễn   Văn A ')).toBe('NV');
  });
});
