import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  MEDIA_UPLOAD_LIMIT_BYTES,
  resolveMediaStorageRoot,
} from '../../config/media-storage';

export type CatalogUploadFile = Readonly<{
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}>;

type StoredCatalogImage = Readonly<{
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
}>;

type DetectedImageType = Readonly<{
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif';
  extension: 'jpg' | 'png' | 'webp' | 'avif';
}>;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function detectImageType(buffer: Buffer): DetectedImageType | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { mimeType: 'image/png', extension: 'png' };
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 4, 8) === 'ftyp' &&
    ['avif', 'avis'].includes(buffer.toString('ascii', 8, 12))
  ) {
    return { mimeType: 'image/avif', extension: 'avif' };
  }

  return null;
}

@Injectable()
export class LocalMediaStorageService {
  private readonly rootPath: string;

  constructor(config: ConfigService) {
    this.rootPath = resolveMediaStorageRoot(config);
  }

  async storeImage(file: CatalogUploadFile): Promise<StoredCatalogImage> {
    const sizeBytes = file.buffer.byteLength;

    if (sizeBytes === 0) {
      throw new BadRequestException('Uploaded image is empty.');
    }

    if (sizeBytes > MEDIA_UPLOAD_LIMIT_BYTES) {
      throw new BadRequestException('Uploaded image exceeds the 10 MB limit.');
    }

    const detectedType = detectImageType(file.buffer);

    if (!detectedType) {
      throw new BadRequestException('Only JPEG, PNG, WebP, and AVIF images are supported.');
    }

    if (file.mimetype.trim().toLowerCase() !== detectedType.mimeType) {
      throw new BadRequestException('Uploaded image MIME type does not match its contents.');
    }

    const now = new Date();
    const year = String(now.getUTCFullYear());
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const storageKey = `catalog/${year}/${month}/${randomUUID()}.${detectedType.extension}`;
    const targetPath = resolve(this.rootPath, ...storageKey.split('/'));

    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, file.buffer, {
      flag: 'wx',
      mode: 0o640,
    });

    return {
      storageKey,
      mimeType: detectedType.mimeType,
      sizeBytes,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const targetPath = resolve(this.rootPath, storageKey);
    const relativePath = relative(this.rootPath, targetPath);

    if (
      !relativePath ||
      relativePath.startsWith('..') ||
      isAbsolute(relativePath)
    ) {
      return;
    }

    await rm(targetPath, { force: true });
  }
}
