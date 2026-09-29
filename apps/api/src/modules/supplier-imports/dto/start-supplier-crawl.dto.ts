import { IsString, IsUrl, IsUUID, Length } from 'class-validator';

export class StartSupplierCrawlDto {
  @IsUUID('4')
  supplierSourceId!: string;

  @IsString()
  @Length(1, 2000)
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: true })
  targetUrl!: string;
}
