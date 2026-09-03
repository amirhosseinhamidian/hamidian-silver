import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { UploadMediaDto } from './dto/upload-media.dto';
import {
  type CatalogUploadFile,
  LocalMediaStorageService,
} from './local-media-storage.service';

function normalizeOptionalText(value: string | undefined, maxLength: number): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized.slice(0, maxLength) : undefined;
}

@Injectable()
export class CatalogMediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localMediaStorage: LocalMediaStorageService,
  ) {}

  async upload(file: CatalogUploadFile | undefined, dto: UploadMediaDto) {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    const stored = await this.localMediaStorage.storeImage(file);

    try {
      return await this.prisma.media.create({
        data: {
          storageKey: stored.storageKey,
          originalName: normalizeOptionalText(file.originalname, 255),
          mimeType: stored.mimeType,
          sizeBytes: stored.sizeBytes,
          altText: normalizeOptionalText(dto.altText, 255),
        },
      });
    } catch (error) {
      await this.localMediaStorage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }
  }
}
