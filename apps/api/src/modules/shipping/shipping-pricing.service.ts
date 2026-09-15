import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isNonNegativeTomanInt } from '../../common/toman';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PublicMediaUrlService } from '../catalog/public-media-url.service';
import {
  AdminShippingPricingSettingsDto,
  ShippingPricingSettingsDto,
  type ShippingPricingMode,
} from './dto/shipping-pricing-settings.dto';
import { UpdateShippingPricingSettingsDto } from './dto/update-shipping-pricing-settings.dto';

const SHIPPING_SETTINGS_ID = 'shipping';

type ShippingPricingRecord = Readonly<{
  mode: string;
  baseCostToman: number;
  thresholdToman: number | null;
  discountedCostToman: number | null;
  carrierName: string | null;
  carrierTrackingUrl: string | null;
  carrierLogoMediaId: string | null;
  carrierLogo: Readonly<{
    storageKey: string;
    mimeType: string;
    altText: string | null;
  }> | null;
  updatedByUserId: string | null;
  updatedAt: Date;
}>;

type ShippingPricingReader = Pick<Prisma.TransactionClient, 'shippingPricingSettings'>;

@Injectable()
export class ShippingPricingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly publicMediaUrl?: PublicMediaUrlService,
  ) {}

  async getPublicSettings(): Promise<ShippingPricingSettingsDto> {
    return this.resolveSettings(this.prisma);
  }

  async getAdminSettings(): Promise<AdminShippingPricingSettingsDto> {
    const settings = await this.findSettings(this.prisma);
    if (!settings) {
      return {
        ...this.environmentFallback(),
        carrierName: null,
        carrierTrackingUrl: null,
        carrierLogoMediaId: null,
        carrierLogo: null,
        source: 'ENVIRONMENT',
        updatedByUserId: null,
        updatedAt: null,
      };
    }

    return {
      ...this.projectSettings(settings),
      ...this.projectCarrierSettings(settings),
      source: 'DATABASE',
      updatedByUserId: settings.updatedByUserId,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  async updateSettings(
    dto: UpdateShippingPricingSettingsDto,
    actorUserId: string,
  ): Promise<AdminShippingPricingSettingsDto> {
    const policy = this.normalizeAndValidate(dto);
    const settings = await this.prisma.shippingPricingSettings.upsert({
      where: { id: SHIPPING_SETTINGS_ID },
      create: { id: SHIPPING_SETTINGS_ID, ...policy, updatedByUserId: actorUserId },
      update: { ...policy, updatedByUserId: actorUserId },
      include: { carrierLogo: true },
    });

    return {
      ...this.projectSettings(settings),
      ...this.projectCarrierSettings(settings),
      source: 'DATABASE',
      updatedByUserId: settings.updatedByUserId,
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  async getCarrierSnapshot(reader: ShippingPricingReader = this.prisma) {
    const settings = await reader.shippingPricingSettings.findUnique({
      where: { id: SHIPPING_SETTINGS_ID },
      select: { carrierName: true, carrierTrackingUrl: true, carrierLogoMediaId: true },
    });
    return {
      carrierNameSnapshot: settings?.carrierName ?? null,
      carrierTrackingUrlSnapshot: settings?.carrierTrackingUrl ?? null,
      carrierLogoMediaIdSnapshot: settings?.carrierLogoMediaId ?? null,
      carrierPresentationSnapshottedAt: new Date(),
    };
  }

  async getPublicCarrierPresentation() {
    const settings = await this.findSettings(this.prisma);
    if (!settings) return null;
    return {
      name: settings.carrierName,
      trackingUrl: settings.carrierTrackingUrl,
      logoUrl: settings.carrierLogo
        ? (this.publicMediaUrl?.resolve(settings.carrierLogo.storageKey) ?? null)
        : null,
    };
  }

  async calculateCostToman(
    cartSubtotalToman: number,
    reader: ShippingPricingReader = this.prisma,
  ): Promise<number> {
    if (!isNonNegativeTomanInt(cartSubtotalToman)) {
      throw new BadRequestException('Cart subtotal is outside the supported Toman range.');
    }

    const policy = await this.resolveSettings(reader);
    if (policy.mode === 'FREE') return 0;
    if (policy.thresholdToman !== null && cartSubtotalToman >= policy.thresholdToman) {
      return policy.discountedCostToman ?? policy.baseCostToman;
    }
    return policy.baseCostToman;
  }

  private async resolveSettings(
    reader: ShippingPricingReader,
  ): Promise<ShippingPricingSettingsDto> {
    const settings = await this.findSettings(reader);
    return settings ? this.projectSettings(settings) : this.environmentFallback();
  }

  private findSettings(reader: ShippingPricingReader): Promise<ShippingPricingRecord | null> {
    return reader.shippingPricingSettings.findUnique({
      where: { id: SHIPPING_SETTINGS_ID },
      include: { carrierLogo: true },
    });
  }

  private environmentFallback(): ShippingPricingSettingsDto {
    const configured = this.config?.get<number>('MANUAL_SHIPPING_COST_TOMAN', 0) ?? 0;
    const baseCostToman = isNonNegativeTomanInt(configured) ? configured : 0;
    return {
      mode: baseCostToman === 0 ? 'FREE' : 'FIXED',
      baseCostToman,
      thresholdToman: null,
      discountedCostToman: null,
    };
  }

  private projectSettings(settings: ShippingPricingRecord): ShippingPricingSettingsDto {
    const mode: ShippingPricingMode = settings.mode === 'FIXED' ? 'FIXED' : 'FREE';
    return {
      mode,
      baseCostToman: mode === 'FREE' ? 0 : settings.baseCostToman,
      thresholdToman: mode === 'FIXED' ? settings.thresholdToman : null,
      discountedCostToman: mode === 'FIXED' ? settings.discountedCostToman : null,
    };
  }

  private projectCarrierSettings(settings: ShippingPricingRecord) {
    return {
      carrierName: settings.carrierName,
      carrierTrackingUrl: settings.carrierTrackingUrl,
      carrierLogoMediaId: settings.carrierLogoMediaId,
      carrierLogo: settings.carrierLogo
        ? {
            id: settings.carrierLogoMediaId!,
            url: this.publicMediaUrl?.resolve(settings.carrierLogo.storageKey) ?? null,
            mimeType: settings.carrierLogo.mimeType,
            altText: settings.carrierLogo.altText,
          }
        : null,
    };
  }

  private normalizeAndValidate(dto: UpdateShippingPricingSettingsDto) {
    if (dto.mode === 'FREE') {
      if (
        dto.baseCostToman !== 0 ||
        dto.thresholdToman != null ||
        dto.discountedCostToman != null
      ) {
        throw new BadRequestException('Free shipping cannot have a cost or subtotal threshold.');
      }
      return {
        mode: 'FREE',
        baseCostToman: 0,
        thresholdToman: null,
        discountedCostToman: null,
      } as const;
    }

    if (!isNonNegativeTomanInt(dto.baseCostToman) || dto.baseCostToman <= 0) {
      throw new BadRequestException('Fixed shipping cost must be greater than zero.');
    }
    const hasThreshold = dto.thresholdToman != null || dto.discountedCostToman != null;
    if (hasThreshold && (dto.thresholdToman == null || dto.discountedCostToman == null)) {
      throw new BadRequestException('Shipping threshold and discounted cost must be set together.');
    }
    if (
      dto.thresholdToman != null &&
      (!isNonNegativeTomanInt(dto.thresholdToman) || dto.thresholdToman <= 0)
    ) {
      throw new BadRequestException('Shipping threshold must be greater than zero.');
    }
    if (dto.discountedCostToman != null && !isNonNegativeTomanInt(dto.discountedCostToman)) {
      throw new BadRequestException('Discounted shipping cost must be a valid Toman amount.');
    }
    if (dto.discountedCostToman != null && dto.discountedCostToman >= dto.baseCostToman) {
      throw new BadRequestException('Discounted shipping cost must be lower than the base cost.');
    }

    return {
      mode: 'FIXED',
      baseCostToman: dto.baseCostToman,
      thresholdToman: dto.thresholdToman ?? null,
      discountedCostToman: dto.discountedCostToman ?? null,
    } as const;
  }
}
