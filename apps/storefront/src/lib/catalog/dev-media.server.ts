import { existsSync } from 'node:fs';
import { join } from 'node:path';

function resolveDevCatalogAsset(relativePath: string): string | null {
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const normalizedPath = relativePath.replace(/^\/+/, '');
  const absolutePath = join(process.cwd(), 'public', 'dev-catalog', normalizedPath);

  return existsSync(absolutePath) ? `/dev-catalog/${normalizedPath}` : null;
}

export function getCatalogDevProductImageSrc(slug: string): string | null {
  return resolveDevCatalogAsset(`products/${slug}.webp`);
}

export function getCatalogDevProductImageSources(
  products: ReadonlyArray<Readonly<{ id: string; slug: string }>>,
): Record<string, string> {
  return Object.fromEntries(
    products.flatMap((product) => {
      const src = getCatalogDevProductImageSrc(product.slug);

      return src ? [[product.id, src]] : [];
    }),
  );
}

export function getCatalogDevHeroImageSrc(): string | null {
  return resolveDevCatalogAsset('hero.webp');
}
