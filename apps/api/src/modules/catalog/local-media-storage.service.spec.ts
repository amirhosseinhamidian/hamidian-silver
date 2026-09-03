import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalMediaStorageService } from './local-media-storage.service';

const PNG_BYTES = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('local-media-test'),
]);

describe('LocalMediaStorageService', () => {
  let rootPath: string;
  let service: LocalMediaStorageService;

  beforeEach(async () => {
    rootPath = await mkdtemp(join(tmpdir(), 'hamidian-media-'));
    const config = {
      getOrThrow: jest.fn().mockReturnValue(rootPath),
    };

    service = new LocalMediaStorageService(config as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(rootPath, { recursive: true, force: true });
  });

  it('stores an image under a generated catalog path on local disk', async () => {
    const stored = await service.storeImage({
      buffer: PNG_BYTES,
      mimetype: 'image/png',
      originalname: 'ring.png',
      size: PNG_BYTES.byteLength,
    });

    expect(stored.storageKey).toMatch(/^catalog\/\d{4}\/\d{2}\/[\da-f-]+\.png$/);
    expect(stored.mimeType).toBe('image/png');
    expect(stored.sizeBytes).toBe(PNG_BYTES.byteLength);

    await expect(readFile(join(rootPath, stored.storageKey))).resolves.toEqual(PNG_BYTES);
  });

  it('rejects a claimed image whose bytes do not match the MIME type', async () => {
    await expect(
      service.storeImage({
        buffer: Buffer.from('<svg></svg>'),
        mimetype: 'image/png',
        originalname: 'spoofed.png',
        size: 11,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes a stored image without allowing traversal outside the media root', async () => {
    const stored = await service.storeImage({
      buffer: PNG_BYTES,
      mimetype: 'image/png',
      originalname: 'ring.png',
      size: PNG_BYTES.byteLength,
    });

    await service.delete(stored.storageKey);

    await expect(readFile(join(rootPath, stored.storageKey))).rejects.toMatchObject({
      code: 'ENOENT',
    });

    await expect(service.delete('../outside.txt')).resolves.toBeUndefined();
  });
});
