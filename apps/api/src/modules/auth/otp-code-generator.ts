import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';

@Injectable()
export class OtpCodeGenerator {
  generate(): string {
    return randomInt(0, 100_000).toString().padStart(5, '0');
  }
}
