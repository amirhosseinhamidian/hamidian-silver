import { IS_PUBLIC_KEY } from '../auth/public.decorator';
import { CatalogController } from './catalog.controller';

describe('CatalogController', () => {
  it('marks only storefront catalog handlers as public', () => {
    const prototype = CatalogController.prototype;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.listPublicCategories)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.listPublicBrands)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.listPublicProducts)).toBe(true);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.getPublicProduct)).toBe(true);

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.listProducts)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.createProduct)).toBeUndefined();
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, prototype.uploadMedia)).toBeUndefined();
  });
});
