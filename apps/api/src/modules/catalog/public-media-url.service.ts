import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function normalizePublicBaseUrl(value: string | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const url = new URL(normalized);

  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new TypeError(
      'MEDIA_PUBLIC_BASE_URL must be an HTTP(S) URL without credentials, query, or fragment.',
    );
  }

  url.pathname = url.pathname.replace(/\/+$/, '');

  return url.toString().replace(/\/$/, '');
}

function normalizeStorageKey(storageKey: string): string | null {
  const normalized = storageKey.trim().replace(/^\/+/, '');

  if (!normalized || normalized.includes('\\')) {
    return null;
  }

  const segments = normalized.split('/');

  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}

@Injectable()
export class PublicMediaUrlService {
  private readonly publicBaseUrl: string | null;

  constructor(config: ConfigService) {
    this.publicBaseUrl = normalizePublicBaseUrl(config.get<string>('MEDIA_PUBLIC_BASE_URL'));
  }

  resolve(storageKey: string): string | null {
    if (!this.publicBaseUrl) {
      return null;
    }

    const normalizedStorageKey = normalizeStorageKey(storageKey);

    if (!normalizedStorageKey) {
      return null;
    }

    return `${this.publicBaseUrl}/${normalizedStorageKey}`;
  }
}
