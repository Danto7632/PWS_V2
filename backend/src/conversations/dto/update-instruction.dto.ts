import { IsOptional, IsString } from 'class-validator';

export class UpdateInstructionDto {
  @IsOptional()
  @IsString()
  instructionText?: string;
}
