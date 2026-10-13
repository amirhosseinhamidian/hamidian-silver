import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { SeoController } from './seo.controller';

describe('SeoController', () => {
  it('exposes the sitemap source without authentication', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, SeoController.prototype.getPublicSitemap)).toBe(true);
  });
});
