import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { publishInstagramPost, publishFacebookPost } from './meta-api';

describe('meta-api', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('publishInstagramPost', () => {
    it('successfully creates container and publishes media', async () => {
      const mockFetch = vi
        .fn()
        // Container creation
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'container_123' }),
        })
        // Media publish
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'media_post_456' }),
        });
      global.fetch = mockFetch;

      const res = await publishInstagramPost({
        igUserId: 'ig_user_1',
        accessToken: 'valid_token',
        imageUrl: 'https://example.com/photo.jpg',
        caption: 'Luxury Villa in Goa',
      });

      expect(res.success).toBe(true);
      expect(res.platform_post_id).toBe('media_post_456');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('returns error when container creation fails', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Invalid aspect ratio' },
        }),
      });

      const res = await publishInstagramPost({
        igUserId: 'ig_user_1',
        accessToken: 'valid_token',
        imageUrl: 'https://example.com/photo.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Invalid aspect ratio');
    });

    it('returns error when media publish fails', async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'container_123' }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({
            error: { message: 'Media not ready for publishing' },
          }),
        });

      const res = await publishInstagramPost({
        igUserId: 'ig_user_1',
        accessToken: 'valid_token',
        imageUrl: 'https://example.com/photo.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Media not ready for publishing');
    });

    it('handles network exceptions gracefully', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('Connection timed out'));

      const res = await publishInstagramPost({
        igUserId: 'ig_user_1',
        accessToken: 'valid_token',
        imageUrl: 'https://example.com/photo.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Connection timed out');
    });
  });

  describe('publishFacebookPost', () => {
    it('successfully publishes photo post', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ post_id: 'fb_post_789' }),
      });

      const res = await publishFacebookPost({
        pageId: 'page_123',
        accessToken: 'valid_page_token',
        imageUrl: 'https://example.com/property.jpg',
        caption: 'New launch announcement',
      });

      expect(res.success).toBe(true);
      expect(res.platform_post_id).toBe('fb_post_789');
    });

    it('handles failure from Facebook Graph API', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Permissions error' },
        }),
      });

      const res = await publishFacebookPost({
        pageId: 'page_123',
        accessToken: 'invalid_token',
        imageUrl: 'https://example.com/property.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('Permissions error');
    });

    it('handles network exceptions gracefully', async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('DNS resolution failed'));

      const res = await publishFacebookPost({
        pageId: 'page_123',
        accessToken: 'valid_token',
        imageUrl: 'https://example.com/property.jpg',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('DNS resolution failed');
    });
  });
});
