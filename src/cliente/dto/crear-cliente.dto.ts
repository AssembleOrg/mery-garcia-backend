import { IsString, IsOptional, IsEmail, Length, IsUUID, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CrearClienteDto {
    @ApiProperty({
        description: 'Nombre del cliente',
        example: 'Juan Pérez',
        minLength: 1,
        maxLength: 100,
    })
    @IsString()
    @Length(1, 100)
    nombre: string;

    @ApiPropertyOptional({
        description: 'Número de teléfono del cliente',
        example: '+54 11 1234-5678',
        maxLength: 20,
    })
    @IsOptional()
    @IsString()
    @Length(0, 20)
    telefono?: string;

    @ApiPropertyOptional({
        description: 'Dni del cliente',
        example: '12345678',
        maxLength: 20,
    })
    @IsOptional()
    @IsString()
    @Length(0, 20)
    dni?: string;

    @ApiPropertyOptional({
        description: 'Email del cliente',
        example: 'juan.perez@email.com',
    })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({
        description: 'CUIT del cliente',
        example: '20-12345678-9',
        maxLength: 20,
    })
    @IsOptional()
    @IsString()
    @Length(0, 20)
    cuit?: string;
        

    @ApiPropertyOptional({
        description: 'Seña USD del cliente',
        example: 1000,
    })
    @IsOptional()
    @IsNumber()
    señaUsd?: number;

    @ApiPropertyOptional({
        description: 'Seña ARS del cliente',
        example: 1000,
    })
    @IsOptional()
    @IsNumber()
    señaArs?: number;
} 