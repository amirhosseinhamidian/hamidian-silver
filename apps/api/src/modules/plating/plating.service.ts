import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PlatingType } from '../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SetPlatingEligibilityDto } from './dto/set-plating-eligibility.dto';
import { SetPlatingOptionDto } from './dto/set-plating-option.dto';
import { SetPlatingRateDto } from './dto/set-plating-rate.dto';

@Injectable()
export class PlatingService {
  constructor(private readonly prisma: PrismaService) {}

  listRates() {
    return this.prisma.platingRate.findMany({
      orderBy: {
        type: 'asc',
      },
    });
  }

  async setRate(type: PlatingType, dto: SetPlatingRateDto, actorUserId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.platingRate.findUnique({
        where: {
          type,
        },
      });

      const isActive = dto.isActive ?? current?.isActive ?? true;

      if (
        current &&
        current.pricePerGramToman === dto.pricePerGramToman &&
        current.leadTimeDays === dto.leadTimeDays &&
        current.isActive === isActive
      ) {
        return current;
      }

      const rate = current
        ? await transaction.platingRate.update({
            where: {
              id: current.id,
            },
            data: {
              pricePerGramToman: dto.pricePerGramToman,
              leadTimeDays: dto.leadTimeDays,
              isActive,
            },
          })
        : await transaction.platingRate.create({
            data: {
              type,
              pricePerGramToman: dto.pricePerGramToman,
              leadTimeDays: dto.leadTimeDays,
              isActive,
            },
          });

      await transaction.platingRateHistory.create({
        data: {
          platingRateId: rate.id,
          changedByUserId: actorUserId,
          previousPricePerGramToman: current?.pricePerGramToman,
          newPricePerGramToman: dto.pricePerGramToman,
          previousLeadTimeDays: current?.leadTimeDays,
          newLeadTimeDays: dto.leadTimeDays,
          reason: dto.reason,
        },
      });

      return rate;
    });
  }

  async listRateHistory(type: PlatingType) {
    const rate = await this.prisma.platingRate.findUnique({
      where: {
        type,
      },
      select: {
        id: true,
      },
    });

    if (!rate) {
      throw new NotFoundException('Plating rate was not found.');
    }

    return this.prisma.platingRateHistory.findMany({
      where: {
        platingRateId: rate.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        changedBy: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async setVariantEligibility(variantId: string, dto: SetPlatingEligibilityDto) {
    return this.prisma.$transaction(async (transaction) => {
      const variant = await transaction.productVariant.findFirst({
        where: {
          id: variantId,
          isActive: true,
          deletedAt: null,
          product: {
            deletedAt: null,
          },
        },
        select: {
          id: true,
        },
      });

      if (!variant) {
        throw new NotFoundException('Product variant was not found.');
      }

      if (!dto.platingEligible) {
        await transaction.productPlatingOption.updateMany({
          where: {
            variantId,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });
      }

      return transaction.productVariant.update({
        where: {
          id: variantId,
        },
        data: {
          platingEligible: dto.platingEligible,
        },
        select: {
          id: true,
          sku: true,
          weightGrams: true,
          platingEligible: true,
        },
      });
    });
  }

  async setVariantOption(variantId: string, type: PlatingType, dto: SetPlatingOptionDto) {
    return this.prisma.$transaction(async (transaction) => {
      const variant = await transaction.productVariant.findFirst({
        where: {
          id: variantId,
          isActive: true,
          deletedAt: null,
          product: {
            deletedAt: null,
          },
        },
        select: {
          id: true,
          platingEligible: true,
        },
      });

      if (!variant) {
        throw new NotFoundException('Product variant was not found.');
      }

      const isActive = dto.isActive ?? true;

      if (isActive && !variant.platingEligible) {
        throw new BadRequestException('Plating must be enabled for this variant first.');
      }

      const rate = await transaction.platingRate.findUnique({
        where: {
          type,
        },
      });

      if (!rate) {
        throw new NotFoundException('Plating rate was not found.');
      }

      if (isActive && !rate.isActive) {
        throw new BadRequestException('The selected plating rate is inactive.');
      }

      return transaction.productPlatingOption.upsert({
        where: {
          variantId_platingRateId: {
            variantId,
            platingRateId: rate.id,
          },
        },
        update: {
          isActive,
        },
        create: {
          variantId,
          platingRateId: rate.id,
          isActive,
        },
        include: {
          platingRate: true,
        },
      });
    });
  }

  async getVariantPlating(variantId: string) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        deletedAt: null,
        product: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        sku: true,
        weightGrams: true,
        platingEligible: true,
        platingOptions: {
          where: {
            isActive: true,
            platingRate: {
              isActive: true,
            },
          },
          include: {
            platingRate: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Product variant was not found.');
    }

    return variant;
  }

  async quoteVariant(variantId: string, type: PlatingType) {
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        id: variantId,
        isActive: true,
        deletedAt: null,
        platingEligible: true,
        product: {
          deletedAt: null,
        },
      },
      select: {
        id: true,
        sku: true,
        weightGrams: true,
        platingOptions: {
          where: {
            isActive: true,
            platingRate: {
              type,
              isActive: true,
            },
          },
          take: 1,
          include: {
            platingRate: true,
          },
        },
      },
    });

    if (!variant) {
      throw new NotFoundException('Plating-enabled product variant was not found.');
    }

    if (!variant.weightGrams) {
      throw new BadRequestException('Variant weight is required to calculate plating price.');
    }

    const option = variant.platingOptions[0];

    if (!option) {
      throw new BadRequestException('The selected plating type is not available for this variant.');
    }

    const weightGrams = variant.weightGrams.toString();
    const platingPriceToman = this.calculatePlatingPrice(
      weightGrams,
      option.platingRate.pricePerGramToman,
    );

    return {
      variantId: variant.id,
      sku: variant.sku,
      platingType: option.platingRate.type,
      weightGrams,
      pricePerGramToman: option.platingRate.pricePerGramToman,
      platingPriceToman,
      leadTimeDays: option.platingRate.leadTimeDays,
    };
  }

  private calculatePlatingPrice(weightGrams: string, pricePerGramToman: number): number {
    const [wholePart, fractionPart = ''] = weightGrams.split('.');
    const normalizedFraction = fractionPart.padEnd(3, '0').slice(0, 3);
    const milliGrams = BigInt(wholePart) * 1000n + BigInt(normalizedFraction || '0');
    const totalMilliToman = milliGrams * BigInt(pricePerGramToman);
    const roundedToman = (totalMilliToman + 500n) / 1000n;

    if (roundedToman > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new BadRequestException('Calculated plating price exceeds the supported range.');
    }

    return Number(roundedToman);
  }
}
