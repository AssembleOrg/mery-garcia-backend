import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class CleanTablesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tables: string[];
} 