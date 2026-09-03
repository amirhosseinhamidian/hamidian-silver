import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { CatalogMediaService } from './catalog-media.service';
import type {
  CatalogUploadFile,
  LocalMediaStorageService,
} from './local-media-storage.service';

describe('CatalogMediaService', () => {
  const prisma = {
    media: {
      create: jest.fn(),
    },
  };
  const localMediaStorage = {
    storeImage: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };
  const file: CatalogUploadFile = {
    buffer: Buffer.from('image-bytes'),
    mimetype: 'image/png',
    originalname: ' ring.png ',
    size: 11,
  };

  let service: CatalogMediaService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CatalogMediaService(
      prisma as unknown as PrismaService,
      localMediaStorage as unknown as LocalMediaStorageService,
    );
  });

  it('requires an uploaded file', async () => {
    await expect(service.upload(undefined, {})).rejects.toBeInstanceOf(BadRequestException);

    expect(localMediaStorage.storeImage).not.toHaveBeenCalled();
  });

  it('persists trusted storage metadata after writing the image to disk', async () => {
    localMediaStorage.storeImage.mockResolvedValue({
      storageKey: 'catalog/2026/09/image.png',
      mimeType: 'image/png',
      sizeBytes: 11,
    });
    prisma.media.create.mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001',
    });

    await service.upload(file, { altText: '  انگشتر نقره  ' });

    expect(prisma.media.create).toHaveBeenCalledWith({
      data: {
        storageKey: 'catalog/2026/09/image.png',
        originalName: 'ring.png',
        mimeType: 'image/png',
        sizeBytes: 11,
        altText: 'انگشتر نقره',
      },
    });
    expect(localMediaStorage.delete).not.toHaveBeenCalled();
  });

  it('removes the stored file if database persistence fails', async () => {
    localMediaStorage.storeImage.mockResolvedValue({
      storageKey: 'catalog/2026/09/orphan.png',
      mimeType: 'image/png',
      sizeBytes: 11,
    });
    prisma.media.create.mockRejectedValue(new Error('database unavailable'));

    await expect(service.upload(file, {})).rejects.toThrow('database unavailable');

    expect(localMediaStorage.delete).toHaveBeenCalledWith(
      'catalog/2026/09/orphan.png',
    );
  });
});
