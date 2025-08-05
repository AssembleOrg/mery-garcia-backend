# Interceptor de Logging Automático

Este interceptor proporciona logging automático de acciones en tu sistema de comandas, integrado con el módulo de auditoría existente.

## Características

- ✅ **Logging automático** basado en métodos HTTP (POST, PUT, DELETE)
- ✅ **Detección automática** de entidades basada en URLs
- ✅ **Decoradores personalizados** para casos específicos
- ✅ **Integración con auditoría** existente
- ✅ **No interrumpe el flujo** principal si hay errores de logging

## Cómo Funciona

### 1. Detección Automática

El interceptor detecta automáticamente las acciones basándose en:

- **Método HTTP**: POST = CREATE, PUT/PATCH = UPDATE, DELETE = DELETE
- **URL**: Detecta el tipo de entidad basado en la ruta
- **Usuario**: Extrae el ID del usuario del token JWT

### 2. Mapeo Automático

Mapea automáticamente:
- **Acciones** → `TipoAccion`
- **Entidades** → `ModuloSistema`
- **Descripciones** → Generadas automáticamente

## URLs Soportadas

| URL | Entidad Detectada |
|-----|------------------|
| `/comandas` | Comanda |
| `/clientes` | Cliente |
| `/trabajadores` | Trabajador |
| `/prepagos-guardados` | PrepagoGuardado |
| `/items-comanda` | ItemComanda |
| `/auth/login` | Auth (LOGIN) |
| `/auth/register` | Auth (CREATE) |
| `/dolar` | Dolar |
| `/database` | Database |

## Uso Básico

### Sin Decorador (Automático)

```typescript
@Post()
async crear(@Body() dto: CrearComandaDto): Promise<Comanda> {
  return this.comandaService.crear(dto);
}
```

El interceptor detectará automáticamente:
- **Acción**: CREATE (POST)
- **Entidad**: Comanda (/comandas)
- **Descripción**: "Comanda creada: COM-2024-001"

### Con Decorador (Personalizado)

```typescript
@Post('egreso')
@LogAction({ 
  action: 'CREATE', 
  entityType: 'Comanda', 
  description: 'Egreso creado' 
})
async crearEgreso(@Body() dto: CrearEgresoDto): Promise<Comanda> {
  return this.comandaService.crearEgreso(dto);
}
```

## Decoradores Disponibles

### @LogAction

```typescript
@LogAction({
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT',
  entityType: string,
  description?: string // Opcional
})
```

### Ejemplos de Uso

```typescript
// Crear comanda
@Post()
@LogAction({ action: 'CREATE', entityType: 'Comanda' })
async crear(@Body() dto: CrearComandaDto) { ... }

// Actualizar cliente
@Put(':id')
@LogAction({ action: 'UPDATE', entityType: 'Cliente' })
async actualizar(@Param('id') id: string, @Body() dto: ActualizarClienteDto) { ... }

// Eliminar trabajador
@Delete(':id')
@LogAction({ action: 'DELETE', entityType: 'Trabajador' })
async eliminar(@Param('id') id: string) { ... }

// Login personalizado
@Post('login')
@LogAction({ action: 'LOGIN', entityType: 'Auth' })
async login(@Body() dto: LoginDto) { ... }

// Con descripción personalizada
@Post('egreso')
@LogAction({ 
  action: 'CREATE', 
  entityType: 'Comanda', 
  description: 'Egreso creado manualmente' 
})
async crearEgreso(@Body() dto: CrearEgresoDto) { ... }
```

## Mapeo de Acciones

### CREATE
- Comanda → `TipoAccion.COMANDA_CREADA`
- Cliente → `TipoAccion.CLIENTE_CREADO`
- Trabajador → `TipoAccion.TRABAJADOR_CREADO`
- PrepagoGuardado → `TipoAccion.PREPAGO_GUARDADO_CREADO`
- ItemComanda → `TipoAccion.ITEM_COMANDA_CREADO`
- Auth → `TipoAccion.USUARIO_CREADO`

### UPDATE
- Comanda → `TipoAccion.COMANDA_MODIFICADA`
- Cliente → `TipoAccion.CLIENTE_MODIFICADO`
- Trabajador → `TipoAccion.TRABAJADOR_MODIFICADO`
- PrepagoGuardado → `TipoAccion.PREPAGO_GUARDADO_MODIFICADO`
- ItemComanda → `TipoAccion.ITEM_COMANDA_MODIFICADO`
- Dolar → `TipoAccion.DOLAR_ACTUALIZADO`

### DELETE
- Comanda → `TipoAccion.COMANDA_ELIMINADA`
- Cliente → `TipoAccion.CLIENTE_ELIMINADO`
- Trabajador → `TipoAccion.TRABAJADOR_ELIMINADO`
- PrepagoGuardado → `TipoAccion.PREPAGO_GUARDADO_ELIMINADO`
- ItemComanda → `TipoAccion.ITEM_COMANDA_ELIMINADO`

### LOGIN
- Auth → `TipoAccion.USUARIO_LOGIN`

## Mapeo de Módulos

- Comanda → `ModuloSistema.COMANDA`
- Cliente → `ModuloSistema.CLIENTE`
- Trabajador → `ModuloSistema.TRABAJADOR`
- PrepagoGuardado → `ModuloSistema.PREPAGO_GUARDADO`
- ItemComanda → `ModuloSistema.ITEM_COMANDA`
- Auth → `ModuloSistema.AUTH`
- Dolar → `ModuloSistema.DOLAR`
- Database → `ModuloSistema.DATABASE_CLEANUP`

## Descripciones Automáticas

### CREATE
- Comanda: "Comanda creada: {numero}"
- Cliente: "Cliente creado: {nombre}"
- Trabajador: "Trabajador creado: {nombre}"
- Auth: "Usuario registrado: {email}"

### UPDATE
- Comanda: "Comanda actualizada: {numero}"
- Cliente: "Cliente actualizado: {nombre}"
- Trabajador: "Trabajador actualizado: {nombre}"
- Dolar: "Cotización del dólar actualizada: Compra {compra}, Venta {venta}"

### DELETE
- Genérico: "{EntityType} eliminado"

### LOGIN
- Auth: "Usuario inició sesión: {email}"

## Configuración

El interceptor está registrado globalmente en `app.module.ts`:

```typescript
providers: [
  AppService,
  {
    provide: APP_INTERCEPTOR,
    useClass: LoggingInterceptor,
  },
],
```

## Ventajas

1. **Automático**: No necesitas agregar código de auditoría en cada método
2. **Consistente**: Todas las acciones se registran de la misma manera
3. **Flexible**: Puedes personalizar con decoradores cuando sea necesario
4. **Robusto**: No interrumpe el flujo principal si hay errores
5. **Integrado**: Usa el sistema de auditoría existente

## Migración

Para migrar de auditoría manual a automática:

### Antes (Manual)
```typescript
@Post()
async crear(@Body() dto: CrearComandaDto): Promise<Comanda> {
  const comanda = await this.comandaService.crear(dto);
  
  // Auditoría manual
  await this.auditoriaService.registrar({
    tipoAccion: TipoAccion.COMANDA_CREADA,
    modulo: ModuloSistema.COMANDA,
    entidadId: comanda.id,
    descripcion: `Comanda creada: ${comanda.numero}`,
  });
  
  return comanda;
}
```

### Después (Automático)
```typescript
@Post()
@LogAction({ action: 'CREATE', entityType: 'Comanda' })
async crear(@Body() dto: CrearComandaDto): Promise<Comanda> {
  return this.comandaService.crear(dto);
}
```

¡El interceptor se encarga de todo automáticamente! 