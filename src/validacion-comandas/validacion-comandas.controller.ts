import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolPersonal } from '../enums/RolPersonal.enum';
import {
  ValidacionComandasService,
  type UsuarioValidacion,
} from './validacion-comandas.service';
import { CrearLoteDto } from './dto/crear-lote.dto';
import { RevisionDto } from './dto/revision.dto';

/**
 * Validación de comandas en papel con IA. Herramienta interna, sólo admin, sin
 * acceso desde el resto del sistema. (RolesGuard lee @Roles del handler, no de
 * la clase: va en cada método.)
 */
@ApiTags('Validación de comandas (IA)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('validacion-comandas')
export class ValidacionComandasController {
  constructor(private readonly servicio: ValidacionComandasService) {}

  @Roles(RolPersonal.ADMIN)
  @Get('lotes')
  listar() {
    return this.servicio.listarLotes();
  }

  /** multipart: `archivos` (PDF de Adobe Scan o fotos JPG/PNG) + `fecha` del lote. No lee nada todavía. */
  @Roles(RolPersonal.ADMIN)
  @Post('lotes')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Subir las comandas en papel de un día (no las lee: la lectura se inicia a mano)',
  })
  @UseInterceptors(
    FilesInterceptor('archivos', 80, {
      limits: { fileSize: 60 * 1024 * 1024, files: 80 },
    }),
  )
  crear(
    @Body() dto: CrearLoteDto,
    @UploadedFiles() archivos: Express.Multer.File[],
    @Req() req: Request,
  ) {
    return this.servicio.crearLote(dto.fecha, archivos, this.usuario(req));
  }

  @Roles(RolPersonal.ADMIN)
  @Get('lotes/:id')
  obtener(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.obtenerLote(id);
  }

  @Roles(RolPersonal.ADMIN)
  @Post('lotes/:id/leer')
  @ApiOperation({
    summary:
      'Leer con IA las hojas pendientes (se cobra por hoja). Responde enseguida.',
  })
  leer(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.leerLote(id);
  }

  @Roles(RolPersonal.ADMIN)
  @Post('lotes/:id/recomparar')
  @ApiOperation({
    summary: 'Volver a comparar contra el sistema sin llamar a la IA',
  })
  recomparar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.recomparar(id);
  }

  @Roles(RolPersonal.ADMIN)
  @Delete('lotes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.eliminarLote(id);
  }

  @Roles(RolPersonal.ADMIN)
  @Post('paginas/:id/releer')
  releer(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.releerPagina(id);
  }

  /** Una persona aprueba la hoja o marca un error real. No modifica la comanda. */
  @Roles(RolPersonal.ADMIN)
  @Post('paginas/:id/revision')
  revisar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevisionDto,
    @Req() req: Request,
  ) {
    return this.servicio.revisar(id, dto.decision, dto.nota, this.usuario(req));
  }

  @Roles(RolPersonal.ADMIN)
  @Delete('paginas/:id/revision')
  deshacerRevision(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicio.deshacerRevision(id);
  }

  /** Gemelo digital: la comanda de ingreso del sistema por número ("01-11089"). Sólo lectura. */
  @Roles(RolPersonal.ADMIN)
  @Get('comandas/:numero')
  gemelo(@Param('numero') numero: string) {
    return this.servicio.gemelo(numero);
  }

  /** Bytes de la hoja escaneada. Respuesta cruda (no pasa por el sobre {status, data}). */
  @Roles(RolPersonal.ADMIN)
  @Get('paginas/:id/imagen')
  async imagen(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const p = await this.servicio.imagen(id);
    res.setHeader('Content-Type', p.mimeType);
    res.setHeader('Content-Length', String(p.imagen.length));
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.end(p.imagen);
  }

  private usuario(req: Request): UsuarioValidacion {
    const u = req.user as { id: string; nombre: string };
    return { id: u.id, nombre: u.nombre };
  }
}
