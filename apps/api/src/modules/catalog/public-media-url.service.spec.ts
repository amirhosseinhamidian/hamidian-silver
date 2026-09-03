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
