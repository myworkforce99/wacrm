import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildMediaPath,
  MEDIA_MAX_BYTES_BY_KIND,
  compressImageIfNeeded,
} from './upload-media';

const imageCompressionMock = vi.fn();
vi.mock('browser-image-compression', () => ({
  default: (...args: unknown[]) => imageCompressionMock(...args),
}));

const ACCOUNT = '11111111-2222-3333-4444-555555555555';

describe('buildMediaPath', () => {
  it('namespaces under account-<id> so RLS write policies match', () => {
    const path = buildMediaPath(ACCOUNT, 'photo.png', 1700000000000);
    expect(path).toBe(`account-${ACCOUNT}/1700000000000-photo.png`);
    expect(path.split('/')[0]).toBe(`account-${ACCOUNT}`);
  });

  it('lower-cases the extension and sanitizes the basename', () => {
    const path = buildMediaPath(
      ACCOUNT,
      'My Invoice (final).PDF',
      1700000000000
    );
    expect(path).toBe(`account-${ACCOUNT}/1700000000000-My_Invoice_final_.pdf`);
  });

  it('caps the basename at 40 chars', () => {
    const long = 'a'.repeat(100) + '.png';
    const path = buildMediaPath(ACCOUNT, long, 1700000000000);
    const base = path
      .split('/')[1]
      .replace('1700000000000-', '')
      .replace('.png', '');
    expect(base.length).toBe(40);
  });

  it("falls back to 'file' / 'bin' for a nameless input", () => {
    const path = buildMediaPath(ACCOUNT, '', 1700000000000);
    expect(path).toBe(`account-${ACCOUNT}/1700000000000-file.bin`);
  });

  it('defaults the extension to bin when there is none', () => {
    const path = buildMediaPath(ACCOUNT, 'README', 1700000000000);
    expect(path).toBe(`account-${ACCOUNT}/1700000000000-README.bin`);
  });

  it('omits the timestamp when passed null, for callers needing a stable path', () => {
    const path = buildMediaPath(ACCOUNT, 'photo.png', null);
    expect(path).toBe(`account-${ACCOUNT}/photo.png`);
  });

  it('nests a subfolder below account-<id>, leaving the RLS segment first', () => {
    const path = buildMediaPath(ACCOUNT, 'photo.png', null, 'inbound');
    expect(path).toBe(`account-${ACCOUNT}/inbound/photo.png`);
    expect(path.split('/')[0]).toBe(`account-${ACCOUNT}`);
  });
});

describe('MEDIA_MAX_BYTES_BY_KIND', () => {
  it("caps images at Meta's tighter 5 MB limit", () => {
    expect(MEDIA_MAX_BYTES_BY_KIND.image).toBe(5 * 1024 * 1024);
  });

  it('caps video/audio/document at the 16 MB bucket limit', () => {
    expect(MEDIA_MAX_BYTES_BY_KIND.video).toBe(16 * 1024 * 1024);
    expect(MEDIA_MAX_BYTES_BY_KIND.audio).toBe(16 * 1024 * 1024);
    expect(MEDIA_MAX_BYTES_BY_KIND.document).toBe(16 * 1024 * 1024);
  });
});

describe('compressImageIfNeeded', () => {
  beforeEach(() => {
    imageCompressionMock.mockReset();
    // Simulate browser window
    vi.stubGlobal('window', {});
    vi.stubGlobal('Worker', class {});
  });

  it('skips non-image files and returns original file', async () => {
    const pdfFile = new File(['%PDF-1.4'], 'brochure.pdf', {
      type: 'application/pdf',
    });
    const res = await compressImageIfNeeded(pdfFile);
    expect(res).toBe(pdfFile);
    expect(imageCompressionMock).not.toHaveBeenCalled();
  });

  it('skips SVG and GIF images to prevent rasterization or breaking animations', async () => {
    const svgFile = new File(['<svg></svg>'], 'floorplan.svg', {
      type: 'image/svg+xml',
    });
    const gifFile = new File(['GIF89a'], 'animated.gif', {
      type: 'image/gif',
    });

    expect(await compressImageIfNeeded(svgFile)).toBe(svgFile);
    expect(await compressImageIfNeeded(gifFile)).toBe(gifFile);
    expect(imageCompressionMock).not.toHaveBeenCalled();
  });

  it('skips images already under 1.5 MB', async () => {
    const smallJpg = new File(['x'.repeat(1024 * 500)], 'small.jpg', {
      type: 'image/jpeg',
    });
    const res = await compressImageIfNeeded(smallJpg);
    expect(res).toBe(smallJpg);
    expect(imageCompressionMock).not.toHaveBeenCalled();
  });

  it('compresses images exceeding 1.5 MB using browser-image-compression', async () => {
    // 2 MB file
    const largeJpg = new File(
      ['x'.repeat(2 * 1024 * 1024)],
      'camera_photo.jpg',
      {
        type: 'image/jpeg',
      }
    );
    const compressedBlob = new Blob(['compressed_data'], {
      type: 'image/jpeg',
    });
    imageCompressionMock.mockResolvedValue(compressedBlob);

    const res = await compressImageIfNeeded(largeJpg);
    expect(imageCompressionMock).toHaveBeenCalledWith(
      largeJpg,
      expect.objectContaining({
        maxSizeMB: 1.5,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/jpeg',
      })
    );
    expect(res.name).toBe('camera_photo.jpg');
    expect(res.type).toBe('image/jpeg');
  });

  it('falls back to original file if compression throws', async () => {
    const largeJpg = new File(
      ['x'.repeat(2 * 1024 * 1024)],
      'unsupported.jpg',
      {
        type: 'image/jpeg',
      }
    );
    imageCompressionMock.mockRejectedValue(new Error('Canvas out of memory'));

    const res = await compressImageIfNeeded(largeJpg);
    expect(res).toBe(largeJpg);
  });
});
