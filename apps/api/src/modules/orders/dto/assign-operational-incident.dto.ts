import { IsUUID } from 'class-validator';

export class AssignOperationalIncidentDto {
  @IsUUID('4')
  userId!: string;
}
