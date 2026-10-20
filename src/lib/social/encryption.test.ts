import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from './encryption';

describe('social encryption adapter', () => {
  it('encrypts and decrypts social tokens correctly', () => {
    const rawToken = 'IGQVJ...long-lived-social-token';
    const encrypted = encryptToken(rawToken);
    expect(encrypted).not.toBe(rawToken);
    expect(encrypted.split(':')).toHaveLength(3);
    const decrypted = decryptToken(encrypted);
    expect(decrypted).toBe(rawToken);
  });
});
