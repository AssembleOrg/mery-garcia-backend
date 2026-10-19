import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class ClavesSuscripcionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  auth: string;
}

/** Lo que devuelve `PushSubscription.toJSON()` en el navegador. */
export class SuscribirPushDto {
  @ApiProperty()
  @IsUrl({ protocols: ['https'], require_tld: true })
  @MaxLength(2000)
  endpoint: string;

  @ApiProperty({ type: ClavesSuscripcionDto })
  @ValidateNested()
  @Type(() => ClavesSuscripcionDto)
  keys: ClavesSuscripcionDto;
}

export class DesuscribirPushDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  endpoint: string;
}
