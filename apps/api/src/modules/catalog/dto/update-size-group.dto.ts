import { PartialType } from '@nestjs/swagger';
import { CreateSizeGroupDto } from './create-size-group.dto';

export class UpdateSizeGroupDto extends PartialType(CreateSizeGroupDto) {}
