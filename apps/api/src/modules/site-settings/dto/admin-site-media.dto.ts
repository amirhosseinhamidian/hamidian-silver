import { ApiProperty } from '@nestjs/swagger';

export class AdminSiteMediaDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, format: 'uri' })
  url!: string | null;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty({ nullable: true })
  altText!: string | null;
}
