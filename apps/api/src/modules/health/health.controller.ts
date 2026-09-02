import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { HealthService } from './health.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check() {
    return this.healthService.checkApplication();
  }

  @Get('live')
  checkLiveness() {
    return this.healthService.checkApplication();
  }

  @Get('ready')
  async checkReadiness() {
    try {
      return await this.healthService.checkReadiness();
    } catch {
      throw new ServiceUnavailableException('Service is not ready.');
    }
  }

  @Get('database')
  checkDatabase() {
    return this.healthService.checkDatabase();
  }
}
