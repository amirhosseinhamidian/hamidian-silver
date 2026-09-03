import type { ConfigService } from '@nestjs/config';
import { resolve } from 'node:path';

export const MEDIA_PUBLIC_ROUTE_PREFIX = '/media/';
export const MEDIA_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;

export function resolveMediaStorageRoot(config: ConfigService): string {
  return resolve(config.getOrThrow<string>('MEDIA_STORAGE_ROOT'));
}
