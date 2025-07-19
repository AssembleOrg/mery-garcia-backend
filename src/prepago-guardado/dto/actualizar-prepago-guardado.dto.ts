import { PartialType } from '@nestjs/swagger';
import { CrearPrepagoGuardadoDto } from './crear-prepago-guardado.dto';

export class ActualizarPrepagoGuardadoDto extends PartialType(CrearPrepagoGuardadoDto) {} 