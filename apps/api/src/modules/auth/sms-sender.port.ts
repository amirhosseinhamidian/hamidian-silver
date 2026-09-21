export const SMS_SENDER = Symbol('SMS_SENDER');

export type SendOtpMessage = {
  phone: string;
  code: string;
};

export type SendSmsMessage = {
  phone: string;
  text: string;
};

export type SendSmsTemplateMessage = {
  phone: string;
  template: string;
  token: string;
  token2?: string;
  token3?: string;
  token10?: string;
  token20?: string;
};

export interface SmsSender {
  sendOtp(message: SendOtpMessage): Promise<void>;
  sendMessage?(message: SendSmsMessage): Promise<void>;
  sendTemplate?(message: SendSmsTemplateMessage): Promise<void>;
}
