import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SeoController } from './seo.controller';
import { SeoRedirectsService } from './seo-redirects.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SeoController],
  providers: [SeoRedirectsService],
})
export class SeoModule {}
