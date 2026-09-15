import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { attachHumanAuditEvent } from '../audit/audit-event';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import { CreateShippingCarrierDto, UpdateShippingCarrierDto } from './dto/shipping-carrier.dto';

const CARRIER_INCLUDE = { logo: true } satisfies Prisma.ShippingCarrierInclude;
type CarrierReader = Pick<Prisma.TransactionClient, 'shippingCarrier'>;

@Injectable()
export class ShippingCarriersService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly publicMediaUrl?: PublicMediaUrlService,
  ) {}

  async listAll() {
    const carriers = await this.prisma.shippingCarrier.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: CARRIER_INCLUDE,
    });
    return carriers.map((carrier) => this.project(carrier));
  }

  async listActive() {
    const carriers = await this.prisma.shippingCarrier.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: CARRIER_INCLUDE,
    });
    return carriers.map((carrier) => this.project(carrier));
  }

  async create(dto: CreateShippingCarrierDto, actorUserId: string) {
    const input = await this.normalize(dto);
    try {
      const carrier = await this.prisma.shippingCarrier.create({
        data: {
          ...input,
          name: dto.name.trim(),
          isActive: dto.isActive ?? true,
          updatedByUserId: actorUserId,
        },
        include: CARRIER_INCLUDE,
      });
      return attachHumanAuditEvent(this.project(carrier), {
        title: `شرکت ارسال ${carrier.name} اضافه شد.`,
        operationType: 'CREATE',
        entityName: carrier.name,
        changes: [
          { field: 'name', label: 'نام شرکت', before: null, after: carrier.name },
          { field: 'isActive', label: 'وضعیت فعال', before: false, after: carrier.isActive },
        ],
      });
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async update(carrierId: string, dto: UpdateShippingCarrierDto, actorUserId: string) {
    const current = await this.prisma.shippingCarrier.findUnique({
      where: { id: carrierId },
      include: CARRIER_INCLUDE,
    });
    if (!current) throw new NotFoundException('Shipping carrier was not found.');
    const input = await this.normalize(dto);
    try {
      const carrier = await this.prisma.shippingCarrier.update({
        where: { id: carrierId },
        data: {
          ...input,
          ...(dto.isActive === undefined ? {} : { isActive: dto.isActive }),
          updatedByUserId: actorUserId,
        },
        include: CARRIER_INCLUDE,
      });
      return attachHumanAuditEvent(this.project(carrier), {
        title: `شرکت ارسال ${carrier.name} ویرایش شد.`,
        operationType: 'UPDATE',
        entityName: carrier.name,
        changes: [
          ...(current.name === carrier.name
            ? []
            : [{ field: 'name', label: 'نام شرکت', before: current.name, after: carrier.name }]),
          ...(current.isActive === carrier.isActive
            ? []
            : [
                {
                  field: 'isActive',
                  label: 'وضعیت فعال',
                  before: current.isActive,
                  after: carrier.isActive,
                },
              ]),
        ],
      });
    } catch (error) {
      this.rethrowConstraintError(error);
    }
  }

  async snapshotActive(carrierId: string, reader: CarrierReader = this.prisma) {
    const carrier = await reader.shippingCarrier.findFirst({
      where: { id: carrierId, isActive: true },
      select: { name: true, trackingUrl: true, logoMediaId: true },
    });
    if (!carrier) throw new BadRequestException('Selected shipping carrier is not active.');
    return {
      serviceName: carrier.name,
      snapshot: {
        carrierNameSnapshot: carrier.name,
        carrierTrackingUrlSnapshot: carrier.trackingUrl,
        carrierLogoMediaIdSnapshot: carrier.logoMediaId,
        carrierPresentationSnapshottedAt: new Date(),
      },
    };
  }

  private async normalize(dto: UpdateShippingCarrierDto) {
    const name = dto.name?.trim();
    if (name !== undefined && name.length < 2) {
      throw new BadRequestException('Shipping carrier name is invalid.');
    }
    const rawTrackingUrl = dto.trackingUrl?.trim() || null;
    let trackingUrl: string | null | undefined;
    if (dto.trackingUrl !== undefined) {
      trackingUrl = rawTrackingUrl;
      if (rawTrackingUrl) {
        let parsed: URL;
        try {
          parsed = new URL(rawTrackingUrl);
        } catch {
          throw new BadRequestException('Shipping tracking URL must be a valid URL.');
        }
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
          throw new BadRequestException('Shipping tracking URL must be a safe HTTPS URL.');
        }
        trackingUrl = parsed.toString();
      }
    }
    const logoMediaId = dto.logoMediaId === undefined ? undefined : (dto.logoMediaId ?? null);
    if (logoMediaId) {
      const media = await this.prisma.media.findFirst({
        where: { id: logoMediaId, deletedAt: null, mimeType: { startsWith: 'image/' } },
        select: { id: true },
      });
      if (!media) throw new BadRequestException('Shipping carrier logo is not a valid image.');
    }
    return {
      ...(name === undefined ? {} : { name }),
      ...(trackingUrl === undefined ? {} : { trackingUrl }),
      ...(logoMediaId === undefined ? {} : { logoMediaId }),
    };
  }

  private project(carrier: Prisma.ShippingCarrierGetPayload<{ include: typeof CARRIER_INCLUDE }>) {
    return {
      id: carrier.id,
      name: carrier.name,
      trackingUrl: carrier.trackingUrl,
      logoMediaId: carrier.logoMediaId,
      logo: carrier.logo
        ? {
            id: carrier.logo.id,
            url: this.publicMediaUrl?.resolve(carrier.logo.storageKey) ?? null,
            mimeType: carrier.logo.mimeType,
            altText: carrier.logo.altText,
          }
        : null,
      isActive: carrier.isActive,
      createdAt: carrier.createdAt.toISOString(),
      updatedAt: carrier.updatedAt.toISOString(),
    };
  }

  private rethrowConstraintError(error: unknown): never {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new ConflictException('A shipping carrier with this name already exists.');
    }
    throw error;
  }
}
