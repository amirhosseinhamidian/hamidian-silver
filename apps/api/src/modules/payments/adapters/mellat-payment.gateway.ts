import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentInitiationUnknownError } from '../payment-initiation-unknown.error';
import type {
  InitiateGatewayPaymentInput,
  InitiateGatewayPaymentResult,
  PaymentGateway,
  VerifyGatewayPaymentInput,
  VerifyGatewayPaymentResult,
} from '../payment-gateway.port';

type MellatCallbackData = {
  attemptId?: string;
  resCode?: string;
  saleOrderId?: string;
  saleReferenceId?: string;
};

type MellatVerifyInput = VerifyGatewayPaymentInput & {
  callbackData?: MellatCallbackData;
};

type MellatMethod = 'bpPayRequest' | 'bpVerifyRequest' | 'bpSettleRequest';

const DEFAULT_SOAP_URL = 'https://bpm.shaparak.ir/pgwchannel/services/pgw';
const DEFAULT_START_PAY_URL = 'https://bpm.shaparak.ir/pgwchannel/startpay.mellat';
const SOAP_NAMESPACE = 'http://interfaces.core.sw.bps.com/';
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const SIGNED_LONG_MASK = 0x7fffffffffffffffn;

@Injectable()
export class MellatPaymentGateway implements PaymentGateway {
  readonly providerCode = 'mellat';

  private readonly terminalId: string;
  private readonly username: string;
  private readonly password: string;
  private readonly soapUrl: string;
  private readonly startPayUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.terminalId = this.config.get<string>('MELLAT_TERMINAL_ID', '');
    this.username = this.config.get<string>('MELLAT_USERNAME', '');
    this.password = this.config.get<string>('MELLAT_PASSWORD', '');
    this.soapUrl = this.config.get<string>('MELLAT_SOAP_URL', DEFAULT_SOAP_URL);
    this.startPayUrl = this.config.get<string>('MELLAT_START_PAY_URL', DEFAULT_START_PAY_URL);
    this.timeoutMs = this.config.get<number>(
      'MELLAT_REQUEST_TIMEOUT_MS',
      DEFAULT_REQUEST_TIMEOUT_MS,
    );
  }

  async initiate(input: InitiateGatewayPaymentInput): Promise<InitiateGatewayPaymentResult> {
    this.assertConfigured();

    const amount = this.parsePositiveIntegerString(input.amountRial, 'Rial amount');
    const bankOrderId = this.orderIdFromAttemptId(input.attemptId);
    const callbackUrl = `${input.callbackUrl}/mellat`;
    const { localDate, localTime } = this.getTehranDateTime();

    const response = await this.callSoap('bpPayRequest', {
      terminalId: this.terminalId,
      userName: this.username,
      userPassword: this.password,
      orderId: bankOrderId,
      amount,
      localDate,
      localTime,
      additionalData: `Hamidian Silver order ${input.orderNumber}`,
      callBackUrl: callbackUrl,
      payerId: '0',
    });
    const [resCode, refId] = response.split(',', 2);

    if (resCode !== '0') {
      throw new BadGatewayException(
        `Mellat rejected the payment request with code ${resCode || 'UNKNOWN'}.`,
      );
    }

    if (!refId) {
      throw new PaymentInitiationUnknownError('Mellat');
    }

    try {
      this.assertRefId(refId);
    } catch {
      throw new PaymentInitiationUnknownError('Mellat');
    }

    return {
      authority: refId,
      paymentUrl: this.buildInternalRedirectUrl(input.callbackUrl, input.attemptId),
    };
  }

  async verify(input: VerifyGatewayPaymentInput): Promise<VerifyGatewayPaymentResult> {
    this.assertConfigured();

    const mellatInput = input as MellatVerifyInput;
    const callback = mellatInput.callbackData;

    if (!callback?.resCode) {
      return {
        success: false,
        code: 'INVALID_CALLBACK',
        message: 'Mellat callback data is missing.',
      };
    }

    if (callback.resCode !== '0') {
      return {
        success: false,
        code: callback.resCode,
        message: `Mellat payment callback returned code ${callback.resCode}.`,
      };
    }

    if (!callback.attemptId || !callback.saleOrderId || !callback.saleReferenceId) {
      return {
        success: false,
        code: 'INVALID_CALLBACK',
        message: 'Mellat callback transaction identifiers are missing.',
      };
    }

    this.assertRefId(input.authority);

    const expectedSaleOrderId = this.orderIdFromAttemptId(callback.attemptId);
    const saleOrderId = this.parsePositiveIntegerString(callback.saleOrderId, 'Mellat saleOrderId');
    const saleReferenceId = this.parsePositiveIntegerString(
      callback.saleReferenceId,
      'Mellat saleReferenceId',
    );

    if (saleOrderId !== expectedSaleOrderId) {
      return {
        success: false,
        code: 'ORDER_ID_MISMATCH',
        message: 'Mellat callback order identifier does not match the payment attempt.',
      };
    }

    const commonParameters = {
      terminalId: this.terminalId,
      userName: this.username,
      userPassword: this.password,
      orderId: saleOrderId,
      saleOrderId,
      saleReferenceId,
    };

    const verifyCode = await this.callSoap('bpVerifyRequest', commonParameters);

    if (verifyCode === '45') {
      return {
        success: true,
        referenceId: saleReferenceId,
      };
    }

    if (verifyCode !== '0' && verifyCode !== '43') {
      return {
        success: false,
        code: verifyCode,
        message: `Mellat verification failed with code ${verifyCode}.`,
      };
    }

    const settleCode = await this.callSoap('bpSettleRequest', commonParameters);

    if (settleCode !== '0' && settleCode !== '45') {
      return {
        success: false,
        code: settleCode,
        message: `Mellat settlement failed with code ${settleCode}.`,
      };
    }

    return {
      success: true,
      referenceId: saleReferenceId,
    };
  }

  buildStartPayForm(refId: string): string {
    this.assertRefId(refId);

    return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="robots" content="noindex,nofollow">
  <title>در حال انتقال به درگاه بانک ملت</title>
</head>
<body>
  <form id="mellat-payment-form" method="post" action="${this.escapeHtmlAttribute(this.startPayUrl)}">
    <input type="hidden" name="RefId" value="${this.escapeHtmlAttribute(refId)}">
    <noscript>
      <button type="submit">ادامه به درگاه بانک ملت</button>
    </noscript>
  </form>
  <script>document.getElementById('mellat-payment-form').submit();</script>
</body>
</html>`;
  }

  private async callSoap(
    method: MellatMethod,
    parameters: Record<string, string>,
  ): Promise<string> {
    const body = this.buildSoapEnvelope(method, parameters);
    const initiationCall = method === 'bpPayRequest';

    try {
      const response = await fetch(this.soapUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          Accept: 'text/xml',
          SOAPAction: `"${SOAP_NAMESPACE}${method}"`,
        },
        body,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const xml = await response.text();

      if (!response.ok) {
        if (initiationCall) {
          throw new PaymentInitiationUnknownError('Mellat');
        }

        throw new BadGatewayException(
          this.extractSoapFault(xml) ?? `Mellat returned HTTP ${response.status}.`,
        );
      }

      const result = this.extractSoapReturn(xml);

      if (result === undefined) {
        if (initiationCall) {
          throw new PaymentInitiationUnknownError('Mellat');
        }

        throw new BadGatewayException(
          this.extractSoapFault(xml) ?? 'Mellat returned an invalid SOAP response.',
        );
      }

      return result.trim();
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof PaymentInitiationUnknownError) {
        throw error;
      }

      if (initiationCall) {
        throw new PaymentInitiationUnknownError('Mellat');
      }

      throw new ServiceUnavailableException('Mellat payment gateway is currently unavailable.');
    }
  }

  private buildSoapEnvelope(method: MellatMethod, parameters: Record<string, string>): string {
    const children = Object.entries(parameters)
      .map(([key, value]) => `<${key}>${this.escapeXml(value)}</${key}>`)
      .join('');

    return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:int="${SOAP_NAMESPACE}">
  <soapenv:Header/>
  <soapenv:Body>
    <int:${method}>${children}</int:${method}>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private extractSoapReturn(xml: string): string | undefined {
    const match = xml.match(
      /<(?:[A-Za-z0-9_-]+:)?return\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?return>/i,
    );

    return match ? this.decodeXml(match[1]) : undefined;
  }

  private extractSoapFault(xml: string): string | undefined {
    const match = xml.match(
      /<(?:[A-Za-z0-9_-]+:)?faultstring\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_-]+:)?faultstring>/i,
    );

    return match ? this.decodeXml(match[1]).trim() : undefined;
  }

  private buildInternalRedirectUrl(callbackUrl: string, attemptId: string): string {
    const parsed = new URL(callbackUrl);
    const suffix = `/callback/${attemptId}`;

    if (!parsed.pathname.endsWith(suffix)) {
      throw new BadGatewayException(
        'Payment callback URL cannot be converted to a Mellat redirect URL.',
      );
    }

    parsed.pathname = parsed.pathname.slice(0, -suffix.length) + `/redirect/${attemptId}/mellat`;
    parsed.search = '';
    parsed.hash = '';

    return parsed.toString();
  }

  private orderIdFromAttemptId(attemptId: string): string {
    const hex = attemptId.replaceAll('-', '');

    if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
      throw new BadGatewayException(
        'Payment attempt identifier cannot be converted to a Mellat order ID.',
      );
    }

    const value = BigInt(`0x${hex.slice(0, 16)}`) & SIGNED_LONG_MASK;

    return (value === 0n ? 1n : value).toString();
  }

  private getTehranDateTime(): {
    localDate: string;
    localTime: string;
  } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
    const values = new Map(parts.map(({ type, value }) => [type, value]));

    return {
      localDate: `${values.get('year')}${values.get('month')}${values.get('day')}`,
      localTime: `${values.get('hour')}${values.get('minute')}${values.get('second')}`,
    };
  }

  private parsePositiveIntegerString(value: string, label: string): string {
    if (!/^\d+$/.test(value)) {
      throw new BadGatewayException(`${label} is invalid.`);
    }

    const normalized = BigInt(value);

    if (normalized <= 0n || normalized > SIGNED_LONG_MASK) {
      throw new BadGatewayException(`${label} is outside the supported range.`);
    }

    return normalized.toString();
  }

  private assertRefId(value: string): void {
    if (!/^[A-Za-z0-9]+$/.test(value)) {
      throw new BadGatewayException('Mellat RefId is invalid.');
    }
  }

  private assertConfigured(): void {
    if (!this.terminalId || !this.username || !this.password) {
      throw new ServiceUnavailableException('Mellat gateway credentials are not configured.');
    }

    this.parsePositiveIntegerString(this.terminalId, 'Mellat terminal ID');
  }

  private escapeXml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&apos;');
  }

  private decodeXml(value: string): string {
    return value
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&apos;', "'")
      .replaceAll('&amp;', '&');
  }

  private escapeHtmlAttribute(value: string): string {
    return this.escapeXml(value);
  }
}
