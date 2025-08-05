import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AuditoriaService } from 'src/auditoria/auditoria.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { RolPersonal } from 'src/enums/RolPersonal.enum';
import { TipoAccion } from 'src/enums/TipoAccion.enum';
import { ModuloSistema } from 'src/enums/ModuloSistema.enum';
import { Audit } from 'src/decorators/audit.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post('login')
  @Audit({ 
    action: 'LOGIN', 
    entityType: 'Auth',
    description: 'Usuario inició sesión',
    sensitiveFields: ['password', 'token', 'refreshToken']
  })
  @ApiOperation({ summary: 'Iniciar sesión' })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas' })
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);

    return result;
  }

  @Post('register')
  @Audit({ 
    action: 'CREATE', 
    entityType: 'Auth',
    description: 'Usuario registrado en el sistema',
    sensitiveFields: ['password', 'token', 'refreshToken', 'hash', 'salt']
  })
  @ApiOperation({
    summary: 'Registrar nuevo usuario (solo administradores Reba Puto)',
  })
  @ApiResponse({ status: 201, description: 'Usuario registrado exitosamente' })
  @ApiResponse({ status: 403, description: 'Acceso denegado' })
  @ApiResponse({ status: 409, description: 'Email ya registrado' })
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    
    // Registrar auditoría de registro
    
    return user;
  }

  @Get('profile')
  @ApiOperation({ summary: 'Obtener perfil del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Perfil obtenido exitosamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.sub);
  }
}
