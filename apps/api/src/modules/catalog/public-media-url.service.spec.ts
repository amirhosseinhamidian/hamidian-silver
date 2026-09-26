import type { ConfigService } from '@nestjs/config';
import { PublicMediaUrlService } from './public-media-url.service';

function createService(publicBaseUrl?: string): PublicMediaUrlService {
  const config = {
    get: jest.fn().mockReturnValue(publicBaseUrl),
  };

  return new PublicMediaUrlService(config as unknown as ConfigService);
}

describe('PublicMediaUrlService', () => {
  it('builds a safe public URL from a relative storage key', () => {
    const service = createService('https://media.hamidian.shop');

    expect(service.resolve('products/ring 01.jpg')).toBe(
      'https://media.hamidian.shop/products/ring%2001.jpg',
    );
  });

  it('percent-encodes descriptive Persian media filenames safely', () => {
    const service = createService('https://media.hamidian.shop/media');

    expect(
      service.resolve('catalog/2026/09/انگشتر-نقره-ماری-a1b2c3d4-1234-4abc-8def-a1b2c3d4e5f6.webp'),
    ).toBe(
      'https://media.hamidian.shop/media/catalog/2026/09/%D8%A7%D9%86%DA%AF%D8%B4%D8%AA%D8%B1-%D9%86%D9%82%D8%B1%D9%87-%D9%85%D8%A7%D8%B1%DB%8C-a1b2c3d4-1234-4abc-8def-a1b2c3d4e5f6.webp',
    );
  });

  it('supports a configured path prefix for S3-compatible public media', () => {
    const service = createService('http://localhost:9000/hamidian-media/');

    expect(service.resolve('products/ring.jpg')).toBe(
      'http://localhost:9000/hamidian-media/products/ring.jpg',
    );
  });

  it('returns null while a public media base URL is not configured', () => {
    expect(createService('').resolve('products/ring.jpg')).toBeNull();
  });

  it('rejects traversal-like or backslash storage keys', () => {
    const service = createService('https://media.hamidian.shop');

    expect(service.resolve('../private/ring.jpg')).toBeNull();
    expect(service.resolve('products\\ring.jpg')).toBeNull();
  });

  it('rejects credentials, query strings, or fragments in the configured base URL', () => {
    expect(() => createService('https://user:pass@media.hamidian.shop')).toThrow(TypeError);
    expect(() => createService('https://media.hamidian.shop?token=secret')).toThrow(TypeError);
  });
});
