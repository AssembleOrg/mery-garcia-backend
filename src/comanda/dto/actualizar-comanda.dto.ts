import { PartialType } from '@nestjs/swagger';
import { CrearComandaDto } from './crear-comanda.dto';

export class ActualizarComandaDto extends PartialType(CrearComandaDto) {} 