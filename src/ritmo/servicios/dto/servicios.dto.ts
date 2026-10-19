import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

const DIA = /^\d{4}-\d{2}-\d{2}$/;

/** Lo que manda Ritmo cuando la persona confirma (o discute) su día. */
export class ConfirmarResumenDto {
  @IsUUID()
  userId: string;

  @Matches(DIA, { message: 'day tiene que ser AAAA-MM-DD' })
  day: string;

  @IsBoolean()
  agreed: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;

  @IsOptional()
  @IsUUID()
  punchId?: string | null;
}

/** Vincular una trabajadora con su persona en Ritmo, y si debe confirmar. */
export class VincularRitmoDto {
  @IsOptional()
  @IsUUID()
  ritmoUserId?: string | null;

  @IsOptional()
  @IsBoolean()
  ritmoConfirmaServicios?: boolean;
}
