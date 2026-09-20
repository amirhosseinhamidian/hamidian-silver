import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { isNonNegativeTomanInt } from '../../common/toman';
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

  async listPublicOptions() {
    const carriers = await this.prisma.shippingCarrier.findMany({
      where: { isActive: true },
      orderBy: [{ serviceArea: 'asc' }, { name: 'asc' }],
      include: CARRIER_INCLUDE,
    });
    return carriers.map((carrier) => {
      const projected = this.project(carrier);
      return {
        id: projected.id,
        name: projected.name,
        logo: projected.logo,
        pricingMode: projected.pricingMode,
        baseCostToman: projected.baseCostToman,
        thresholdToman: projected.thresholdToman,
        discountedCostToman: projected.discountedCostToman,
        serviceArea: projected.serviceArea,
      };
    });
  }

  async create(dto: CreateShippingCarrierDto, actorUserId: string) {
    const input = await this.normalize({
      ...dto,
      pricingMode: dto.pricingMode ?? 'FREE',
      baseCostToman: dto.baseCostToman ?? 0,
      thresholdToman: dto.thresholdToman ?? null,
      discountedCostToman: dto.discountedCostToman ?? null,
      serviceArea: dto.serviceArea ?? 'NATIONWIDE',
    });
    try {
      const carrier = await this.prisma.shippingCarrier.create({
        data: {
          ...input,
          name: input.name,
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
    const input = await this.normalize({
      name: dto.name ?? current.name,
      trackingUrl: dto.trackingUrl === undefined ? current.trackingUrl : dto.trackingUrl,
      logoMediaId: dto.logoMediaId === undefined ? current.logoMediaId : dto.logoMediaId,
      pricingMode: dto.pricingMode ?? (current.pricingMode as 'FREE' | 'FIXED' | 'COLLECT'),
      baseCostToman: dto.baseCostToman ?? current.baseCostToman,
      thresholdToman:
        dto.thresholdToman === undefined ? current.thresholdToman : dto.thresholdToman,
      discountedCostToman:
        dto.discountedCostToman === undefined
          ? current.discountedCostToman
          : dto.discountedCostToman,
      serviceArea: dto.serviceArea ?? (current.serviceArea as 'NATIONWIDE' | 'TEHRAN_ONLY'),
    });
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

  async quoteForCheckout(
    carrierId: string,
    cartSubtotalToman: number,
    destination: Readonly<{ province: string; city: string }>,
    reader: CarrierReader = this.prisma,
  ) {
    if (!isNonNegativeTomanInt(cartSubtotalToman)) {
      throw new BadRequestException('Cart subtotal is outside the supported Toman range.');
    }
    const carrier = await reader.shippingCarrier.findFirst({
      where: { id: carrierId, isActive: true },
      select: {
        id: true,
        name: true,
        trackingUrl: true,
        logoMediaId: true,
        pricingMode: true,
        baseCostToman: true,
        thresholdToman: true,
        discountedCostToman: true,
        serviceArea: true,
      },
    });
    if (!carrier) throw new BadRequestException('Selected shipping carrier is not active.');
    if (
      carrier.serviceArea === 'TEHRAN_ONLY' &&
      (destination.province.trim() !== 'تهران' || destination.city.trim() !== 'تهران')
    ) {
      throw new BadRequestException('Selected shipping carrier is only available in Tehran.');
    }
    const costToman =
      carrier.pricingMode === 'FIXED'
        ? carrier.thresholdToman !== null && cartSubtotalToman >= carrier.thresholdToman
          ? (carrier.discountedCostToman ?? carrier.baseCostToman)
          : carrier.baseCostToman
        : 0;
    return {
      costToman,
      snapshot: {
        shippingCarrierIdSnapshot: carrier.id,
        shippingCarrierNameSnapshot: carrier.name,
        shippingCarrierTrackingUrlSnapshot: carrier.trackingUrl,
        shippingCarrierLogoMediaIdSnapshot: carrier.logoMediaId,
        shippingPricingModeSnapshot: carrier.pricingMode,
        shippingServiceAreaSnapshot: carrier.serviceArea,
      },
    };
  }

  private async normalize(dto: UpdateShippingCarrierDto & { name: string }) {
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
    const pricingMode = dto.pricingMode ?? 'FREE';
    const serviceArea = dto.serviceArea ?? 'NATIONWIDE';
    const baseCostToman = dto.baseCostToman ?? 0;
    const thresholdToman = dto.thresholdToman ?? null;
    const discountedCostToman = dto.discountedCostToman ?? null;
    if (pricingMode === 'COLLECT' && serviceArea !== 'TEHRAN_ONLY') {
      throw new BadRequestException('Collect-on-delivery shipping is only available in Tehran.');
    }
    if (pricingMode !== 'FIXED') {
      if (baseCostToman !== 0 || thresholdToman !== null || discountedCostToman !== null) {
        throw new BadRequestException('Free or collect shipping cannot have a prepaid cost.');
      }
    } else {
      if (!isNonNegativeTomanInt(baseCostToman) || baseCostToman <= 0) {
        throw new BadRequestException('Fixed shipping cost must be greater than zero.');
      }
      if ((thresholdToman === null) !== (discountedCostToman === null)) {
        throw new BadRequestException(
          'Shipping threshold and discounted cost must be set together.',
        );
      }
      if (
        thresholdToman !== null &&
        (!isNonNegativeTomanInt(thresholdToman) ||
          thresholdToman <= 0 ||
          discountedCostToman === null ||
          !isNonNegativeTomanInt(discountedCostToman) ||
          discountedCostToman >= baseCostToman)
      ) {
        throw new BadRequestException('Shipping threshold pricing is invalid.');
      }
    }
    return {
      name: name!,
      trackingUrl: trackingUrl ?? null,
      logoMediaId: logoMediaId ?? null,
      pricingMode,
      baseCostToman,
      thresholdToman,
      discountedCostToman,
      serviceArea,
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
      pricingMode: carrier.pricingMode as 'FREE' | 'FIXED' | 'COLLECT',
      baseCostToman: carrier.baseCostToman,
      thresholdToman: carrier.thresholdToman,
      discountedCostToman: carrier.discountedCostToman,
      serviceArea: carrier.serviceArea as 'NATIONWIDE' | 'TEHRAN_ONLY',
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
