import { IsString, MaxLength, MinLength } from 'class-validator';

export class AddOperationalIncidentNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  note!: string;
}
