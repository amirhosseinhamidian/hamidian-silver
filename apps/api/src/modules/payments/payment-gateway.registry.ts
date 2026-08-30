import {
  BadRequestException,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ZarinpalPaymentGateway } from './adapters/zarinpal-payment.gateway';
import { MellatPaymentGateway } from './adapters/mellat-payment.gateway';
import { ZibalPaymentGateway } from './adapters/zibal-payment.gateway';
import {
  PAYMENT_GATEWAY_CODES,
  PAYMENT_GATEWAY_DEFINITIONS,
  isPaymentGatewayCode,
  type PaymentGatewayCode,
} from './payment-gateway.constants';
import type {
  InitiateGatewayPaymentInput,
  InitiateGatewayPaymentResult,
  PaymentGateway,
  VerifyGatewayPaymentInput,
  VerifyGatewayPaymentResult,
} from './payment-gateway.port';

export const PAYMENT_GATEWAY_REGISTRY = Symbol('PAYMENT_GATEWAY_REGISTRY');

@Injectable()
export class PaymentGatewayRegistry implements PaymentGateway {
  readonly providerCode = 'registry';

  private readonly gateways: ReadonlyMap<PaymentGatewayCode, PaymentGateway>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    zarinpalGateway: ZarinpalPaymentGateway,
    @Optional() zibalGateway?: ZibalPaymentGateway,
    @Optional() mellatGateway?: MellatPaymentGateway,
  ) {
    const gateways: Array<[PaymentGatewayCode, PaymentGateway]> = [
      [PAYMENT_GATEWAY_CODES.ZARINPAL, zarinpalGateway],
    ];

    if (zibalGateway) {
      gateways.push([PAYMENT_GATEWAY_CODES.ZIBAL, zibalGateway]);
    }

    if (mellatGateway) {
      gateways.push([PAYMENT_GATEWAY_CODES.MELLAT, mellatGateway]);
    }

    this.gateways = new Map<PaymentGatewayCode, PaymentGateway>(gateways);
  }

  async initiate(input: InitiateGatewayPaymentInput): Promise<InitiateGatewayPaymentResult> {
    const provider = this.requireProvider(input.provider);
    const setting = await this.prisma.paymentGatewaySetting.findUnique({
      where: {
        provider,
      },
      select: {
        isEnabled: true,
      },
    });

    if (!setting?.isEnabled) {
      throw new BadRequestException('Selected payment gateway is not enabled.');
    }

    const gateway = this.resolveConfiguredGateway(provider);

    return gateway.initiate(input);
  }

  verify(input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult> {
    const provider = this.requireProvider(input.provider);
    const gateway = this.resolveConfiguredGateway(provider);

    // Verification intentionally ignores the current enabled flag so an
    // in-flight payment can still complete after a Manager disables a gateway.
    return gateway.verify(input);
  }

  async listAvailableGateways() {
    const settings = await this.listGatewaySettings();

    return settings
      .filter((setting) => setting.isAvailable)
      .map(({ provider, displayName, sortOrder }) => ({
        provider,
        displayName,
        sortOrder,
      }));
  }

  async listGatewaySettings() {
    const rows = await this.prisma.paymentGatewaySetting.findMany({
      where: {
        provider: {
          in: PAYMENT_GATEWAY_DEFINITIONS.map(({ code }) => code),
        },
      },
      select: {
        provider: true,
        isEnabled: true,
        updatedAt: true,
      },
    });
    const byProvider = new Map(rows.map((row) => [row.provider, row]));

    return PAYMENT_GATEWAY_DEFINITIONS.map((definition) => {
      const row = byProvider.get(definition.code);
      const isImplemented = this.gateways.has(definition.code);
      const isConfigured = this.isConfigured(definition.code);
      const isEnabled = row?.isEnabled ?? false;

      return {
        provider: definition.code,
        displayName: definition.displayName,
        sortOrder: definition.sortOrder,
        isEnabled,
        isImplemented,
        isConfigured,
        isAvailable: isEnabled && isImplemented && isConfigured,
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  async updateGatewaySetting(provider: string, isEnabled: boolean, actorUserId: string) {
    const definition = PAYMENT_GATEWAY_DEFINITIONS.find(({ code }) => code === provider);

    if (!definition || !isPaymentGatewayCode(provider)) {
      throw new BadRequestException('Unknown payment gateway.');
    }

    const row = await this.prisma.paymentGatewaySetting.upsert({
      where: {
        provider,
      },
      update: {
        isEnabled,
        updatedByUserId: actorUserId,
      },
      create: {
        provider,
        isEnabled,
        updatedByUserId: actorUserId,
      },
      select: {
        provider: true,
        isEnabled: true,
        updatedAt: true,
      },
    });
    const isImplemented = this.gateways.has(provider);
    const isConfigured = this.isConfigured(provider);

    return {
      provider,
      displayName: definition.displayName,
      sortOrder: definition.sortOrder,
      isEnabled: row.isEnabled,
      isImplemented,
      isConfigured,
      isAvailable: row.isEnabled && isImplemented && isConfigured,
      updatedAt: row.updatedAt,
    };
  }

  private requireProvider(provider: string | undefined): PaymentGatewayCode {
    const resolved = provider ?? PAYMENT_GATEWAY_CODES.ZARINPAL;

    if (!isPaymentGatewayCode(resolved)) {
      throw new BadRequestException('Unknown payment gateway.');
    }

    return resolved;
  }

  private resolveConfiguredGateway(provider: PaymentGatewayCode): PaymentGateway {
    const gateway = this.gateways.get(provider);

    if (!gateway) {
      throw new ServiceUnavailableException(
        'Selected payment gateway adapter is not implemented yet.',
      );
    }

    if (!this.isConfigured(provider)) {
      throw new ServiceUnavailableException(
        'Selected payment gateway credentials are not configured.',
      );
    }

    return gateway;
  }

  private isConfigured(provider: PaymentGatewayCode): boolean {
    switch (provider) {
      case PAYMENT_GATEWAY_CODES.ZARINPAL:
        return Boolean(this.config.get<string>('ZARINPAL_MERCHANT_ID', ''));
      case PAYMENT_GATEWAY_CODES.ZIBAL:
        return Boolean(this.config.get<string>('ZIBAL_MERCHANT_ID', ''));
      case PAYMENT_GATEWAY_CODES.MELLAT:
        return Boolean(
          this.config.get<string>('MELLAT_TERMINAL_ID', '') &&
          this.config.get<string>('MELLAT_USERNAME', '') &&
          this.config.get<string>('MELLAT_PASSWORD', ''),
        );
    }
  }
}
