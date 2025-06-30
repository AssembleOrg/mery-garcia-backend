import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsEnum, IsNumber, IsBoolean, IsArray, ArrayNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UnidadNegocio } from 'src/enums/UnidadNegocio.enum';
import { RolPersonal } from 'src/enums/RolPersonal.enum';

export class RegisterDto {
  @ApiProperty({
    description: 'Nombre completo del usuario',
    example: 'Juan Pérez',
  })
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @ApiProperty({
    description: 'Email del usuario',
    example: 'juan.perez@ejemplo.com',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Contraseña del usuario',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @ApiProperty({
    description: 'Porcentaje de comisión',
    example: 15.5,
    required: false,
  })
  @IsNumber()
  @IsOptional()
  comisionPorcentaje?: number;

  @ApiProperty({
    description: 'Si el usuario está activo',
    example: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  activo?: boolean;

  @ApiProperty({
    description: 'Rol del usuario',
    enum: RolPersonal,
    example: RolPersonal.USER,
    required: false,
  })
  @IsEnum(RolPersonal)
  @IsOptional()
  rol?: RolPersonal;

  @ApiProperty({
    description: 'Unidades de negocio disponibles',
    enum: UnidadNegocio,
    isArray: true,
    example: [UnidadNegocio.TATTOO, UnidadNegocio.ESTILISMO],
    required: false,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(UnidadNegocio, { each: true })
  @IsOptional()
  unidadesDisponibles?: UnidadNegocio[];

  @ApiProperty({
    description: 'Número de teléfono',
    example: '+54 11 1234-5678',
    required: false,
  })
  @IsString()
  @IsOptional()
  telefono?: string;

  @ApiProperty({
    description: 'Fecha de ingreso',
    example: '2024-01-15T00:00:00.000Z',
  })
  @IsNotEmpty()
  fechaIngreso: Date;
} 