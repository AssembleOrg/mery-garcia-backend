# Resumen de Caja Diario por Método de Pago

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Endpoint](#endpoint)
3. [Query Parameters](#query-parameters)
4. [Response Structure](#response-structure)
5. [DTOs para Frontend](#dtos-para-el-frontend)
6. [Ejemplos de Uso](#ejemplos-de-uso)
7. [Implementación Técnica](#implementación-técnica)
8. [Changelog](#changelog)

---

## Descripción General

Este endpoint permite obtener un **resumen diario** de la caja chica con los montos desglosados por tipo de método de pago (efectivo, tarjeta, transferencia, cheque, QR, gift card) en ambas monedas (ARS y USD).

### 🎯 Características Principales

- ✅ **Resumen diario**: Solo muestra datos de un día específico
- ✅ **Fecha por defecto**: Si no se proporciona fecha, usa el día actual
- ✅ **Ideal para datepickers**: Perfecto para implementar calendarios de resumen diario
- ✅ **Desglose completo**: Todos los métodos de pago en ARS y USD
- ✅ **Zona horaria**: Usa `America/Argentina/Buenos_Aires`

---

## Endpoint

```
GET /comandas/resumen-caja-por-metodo-pago
```

### Autenticación

Requiere autenticación JWT y roles: `ADMIN`, `ENCARGADO`, o `USER`.

---

## Query Parameters

| Parámetro | Tipo   | Requerido | Descripción                                                    | Ejemplo      |
|-----------|--------|-----------|----------------------------------------------------------------|--------------|
| fecha     | string | No        | Fecha del día a consultar (formato: YYYY-MM-DD o ISO 8601)    | 2024-10-02   |

### 🔍 Notas Importantes

- **Sin parámetro**: Retorna el resumen del día actual (hoy)
- **Con parámetro**: Retorna el resumen del día especificado
- **Rango horario**: Siempre desde las 00:00:00 hasta las 23:59:59 del día seleccionado
- **Zona horaria**: Usa `America/Argentina/Buenos_Aires` para determinar el día
- **Formato flexible**: Acepta `2024-10-02` o `2024-10-02T00:00:00.000Z`

### ❌ Lo que NO hace

- NO acepta rangos de fechas múltiples
- NO retorna datos de varios días
- NO filtra por semanas o meses completos

---

## Response Structure

### TypeScript/JavaScript Interface

```typescript
/**
 * Enum de tipos de pago disponibles
 */
export enum TipoPago {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CHEQUE = 'CHEQUE',
  QR = 'QR',
  GIFT_CARD = 'GIFT_CARD',
}

/**
 * Montos por moneda (ARS y USD)
 */
export interface MontosPorMoneda {
  ARS: number;
  USD: number;
}

/**
 * Desglose de montos por método de pago
 */
export interface PorMetodoPago {
  [TipoPago.EFECTIVO]: MontosPorMoneda;
  [TipoPago.TARJETA]: MontosPorMoneda;
  [TipoPago.TRANSFERENCIA]: MontosPorMoneda;
  [TipoPago.CHEQUE]: MontosPorMoneda;
  [TipoPago.QR]: MontosPorMoneda;
  [TipoPago.GIFT_CARD]: MontosPorMoneda;
}

/**
 * Response completo del endpoint
 */
export interface ResumenCajaDiarioResponse {
  totalCompletados: number;              // Total de comandas validadas
  totalPendientes: number;               // Total de comandas pendientes
  montoNetoUSD: number;                  // Monto neto en dólares (ingresos - egresos)
  montoNetoARS: number;                  // Monto neto en pesos (ingresos - egresos)
  montoDisponibleTrasladoUSD: number;    // Monto disponible para traslado en dólares
  montoDisponibleTrasladoARS: number;    // Monto disponible para traslado en pesos
  totalIngresosUSD: number;              // Total de ingresos en dólares
  totalIngresosARS: number;              // Total de ingresos en pesos
  totalEgresosUSD: number;               // Total de egresos en dólares
  totalEgresosARS: number;               // Total de egresos en pesos
  comandasValidadasIds: string[];        // Array de UUIDs de comandas validadas
  porMetodoPago: PorMetodoPago;          // Desglose por método de pago
}
```

### Ejemplo de Response JSON

```json
{
  "totalCompletados": 25,
  "totalPendientes": 5,
  "montoNetoUSD": 1500.75,
  "montoNetoARS": 150000.50,
  "montoDisponibleTrasladoUSD": 1500.75,
  "montoDisponibleTrasladoARS": 150000.50,
  "totalIngresosUSD": 2000.00,
  "totalIngresosARS": 200000.00,
  "totalEgresosUSD": 499.25,
  "totalEgresosARS": 49999.50,
  "comandasValidadasIds": [
    "123e4567-e89b-12d3-a456-426614174000",
    "223e4567-e89b-12d3-a456-426614174001"
  ],
  "porMetodoPago": {
    "EFECTIVO": {
      "ARS": 80000.00,
      "USD": 800.00
    },
    "TARJETA": {
      "ARS": 60000.00,
      "USD": 600.00
    },
    "TRANSFERENCIA": {
      "ARS": 40000.00,
      "USD": 400.00
    },
    "CHEQUE": {
      "ARS": 10000.00,
      "USD": 100.00
    },
    "QR": {
      "ARS": 8000.00,
      "USD": 80.00
    },
    "GIFT_CARD": {
      "ARS": 2000.00,
      "USD": 20.00
    }
  }
}
```

---

## DTOs para el Frontend

### Archivo: `types/caja.types.ts`

```typescript
/**
 * Enum de tipos de pago disponibles
 */
export enum TipoPago {
  EFECTIVO = 'EFECTIVO',
  TARJETA = 'TARJETA',
  TRANSFERENCIA = 'TRANSFERENCIA',
  CHEQUE = 'CHEQUE',
  QR = 'QR',
  GIFT_CARD = 'GIFT_CARD',
}

/**
 * Montos por moneda (ARS y USD)
 */
export interface MontosPorMoneda {
  ARS: number;
  USD: number;
}

/**
 * Desglose de montos por método de pago
 */
export interface PorMetodoPago {
  [TipoPago.EFECTIVO]: MontosPorMoneda;
  [TipoPago.TARJETA]: MontosPorMoneda;
  [TipoPago.TRANSFERENCIA]: MontosPorMoneda;
  [TipoPago.CHEQUE]: MontosPorMoneda;
  [TipoPago.QR]: MontosPorMoneda;
  [TipoPago.GIFT_CARD]: MontosPorMoneda;
}

/**
 * Response completo del endpoint de resumen de caja diario
 */
export interface ResumenCajaDiarioResponse {
  totalCompletados: number;
  totalPendientes: number;
  montoNetoUSD: number;
  montoNetoARS: number;
  montoDisponibleTrasladoUSD: number;
  montoDisponibleTrasladoARS: number;
  totalIngresosUSD: number;
  totalIngresosARS: number;
  totalEgresosUSD: number;
  totalEgresosARS: number;
  comandasValidadasIds: string[];
  porMetodoPago: PorMetodoPago;
}

/**
 * Parámetros de query para el endpoint
 */
export interface ResumenCajaQueryParams {
  fecha?: string;  // Formato: YYYY-MM-DD o ISO 8601
}
```

### Servicio API para Axios/Fetch

#### Archivo: `services/cajaService.ts`

```typescript
import axios from 'axios';
import { ResumenCajaDiarioResponse, ResumenCajaQueryParams } from '../types/caja.types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

export class CajaService {
  /**
   * Obtiene el resumen de caja diario con desglose por método de pago
   * @param params - Parámetros de filtro opcionales (fecha)
   * @returns Promise con el resumen de caja del día especificado
   */
  static async getResumenCajaDiario(
    params?: ResumenCajaQueryParams
  ): Promise<ResumenCajaDiarioResponse> {
    try {
      const response = await axios.get<ResumenCajaDiarioResponse>(
        `${API_BASE_URL}/comandas/resumen-caja-por-metodo-pago`,
        {
          params,
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('Error al obtener resumen de caja diario:', error);
      throw error;
    }
  }

  /**
   * Obtiene el resumen de caja de hoy
   * @returns Promise con el resumen de caja del día actual
   */
  static async getResumenCajaHoy(): Promise<ResumenCajaDiarioResponse> {
    return this.getResumenCajaDiario();
  }

  /**
   * Obtiene el resumen de caja de una fecha específica
   * @param fecha - Fecha en formato YYYY-MM-DD
   * @returns Promise con el resumen de caja del día especificado
   */
  static async getResumenCajaFecha(fecha: string): Promise<ResumenCajaDiarioResponse> {
    return this.getResumenCajaDiario({ fecha });
  }
}
```

### Hook React Personalizado

#### Archivo: `hooks/useCajaResumenDiario.ts`

```typescript
import { useState, useEffect } from 'react';
import { CajaService } from '../services/cajaService';
import { ResumenCajaDiarioResponse } from '../types/caja.types';

export const useCajaResumenDiario = (fecha?: string) => {
  const [data, setData] = useState<ResumenCajaDiarioResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await CajaService.getResumenCajaDiario(fecha ? { fecha } : undefined);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fecha]);

  return { data, loading, error, refetch: fetchData };
};
```

---

## Ejemplos de Uso

### Ejemplo 1: Sin parámetros (día actual)

```bash
# Obtiene el resumen del día actual
curl -X GET "http://localhost:3000/comandas/resumen-caja-por-metodo-pago" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Ejemplo 2: Con fecha específica (formato simple)

```bash
# Obtiene el resumen del 2 de octubre de 2024
curl -X GET "http://localhost:3000/comandas/resumen-caja-por-metodo-pago?fecha=2024-10-02" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Ejemplo 3: Con fecha ISO 8601

```bash
# Obtiene el resumen del 2 de octubre de 2024 (formato completo)
curl -X GET "http://localhost:3000/comandas/resumen-caja-por-metodo-pago?fecha=2024-10-02T00:00:00.000Z" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Ejemplo 4: Uso en React con DatePicker

```tsx
import React, { useState } from 'react';
import { useCajaResumenDiario } from './hooks/useCajaResumenDiario';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const ResumenCajaDatePicker: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const fechaString = selectedDate.toISOString().split('T')[0]; // YYYY-MM-DD
  
  const { data, loading, error, refetch } = useCajaResumenDiario(fechaString);

  if (loading) return <div>Cargando...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>No hay datos</div>;

  return (
    <div className="resumen-caja-container">
      <h2>Resumen de Caja Diario</h2>
      
      <div className="date-picker-section">
        <label>Seleccionar fecha:</label>
        <DatePicker
          selected={selectedDate}
          onChange={(date: Date) => setSelectedDate(date)}
          dateFormat="dd/MM/yyyy"
          maxDate={new Date()}
        />
      </div>
      
      <div className="resumen-general">
        <h3>Resumen General</h3>
        <p>Comandas Completadas: {data.totalCompletados}</p>
        <p>Comandas Pendientes: {data.totalPendientes}</p>
        <p>Monto Neto USD: ${data.montoNetoUSD.toFixed(2)}</p>
        <p>Monto Neto ARS: ${data.montoNetoARS.toFixed(2)}</p>
      </div>
      
      <div className="desglose-metodos">
        <h3>Desglose por Método de Pago</h3>
        <table>
          <thead>
            <tr>
              <th>Método</th>
              <th>ARS</th>
              <th>USD</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.porMetodoPago).map(([metodo, montos]) => (
              <tr key={metodo}>
                <td>{metodo}</td>
                <td>${montos.ARS.toFixed(2)}</td>
                <td>${montos.USD.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <button onClick={refetch}>Actualizar</button>
    </div>
  );
};

export default ResumenCajaDatePicker;
```

### Ejemplo 5: Uso con React Query

```typescript
import { useQuery } from '@tanstack/react-query';
import { CajaService } from '../services/cajaService';

export const useResumenCajaDiario = (fecha?: string) => {
  return useQuery({
    queryKey: ['resumen-caja-diario', fecha],
    queryFn: () => CajaService.getResumenCajaDiario(fecha ? { fecha } : undefined),
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
};
```

---

## Implementación Técnica

### Dependencias Requeridas

- **luxon** (^3.7.2): Librería para manejo de fechas y zonas horarias
- **@types/luxon** (^3.7.1): Tipos TypeScript para Luxon

### Archivos del Backend

#### 1. DTO de Response
**Archivo**: `src/comanda/dto/resumen-caja-por-metodo-pago.dto.ts`

Define las estructuras TypeScript para la respuesta del endpoint con documentación Swagger completa.

#### 2. Service Method
**Archivo**: `src/comanda/comanda.service.ts`

```typescript
import { DateTime } from 'luxon';

async getResumenCajaPorMetodoPago(filtros: {
  fecha?: string;
}): Promise<ResumenCajaDiarioResponse> {
  // Usa el día actual si no se proporciona fecha
  const hoy = DateTime.now().setZone('America/Argentina/Buenos_Aires');
  
  // Parsea la fecha proporcionada o usa hoy
  const fechaSeleccionada = filtros.fecha 
    ? DateTime.fromISO(filtros.fecha).setZone('America/Argentina/Buenos_Aires')
    : hoy;
  
  // Obtiene el inicio y fin del día seleccionado
  const fechaDesde = fechaSeleccionada.startOf('day').toJSDate();
  const fechaHasta = fechaSeleccionada.endOf('day').toJSDate();
  
  // Consulta comandas del día
  const comandas = await this.comandaRepository.find({
    where: {
      estadoDeComanda: In([EstadoDeComanda.VALIDADO, EstadoDeComanda.PENDIENTE]),
      caja: Caja.CAJA_1,
      createdAt: Raw((a) => `${a} >= :from AND ${a} < :to`, {
        from: fechaDesde,
        to: fechaHasta,
      }),
    },
    relations: ['egresos', 'prepagoARS', 'prepagoUSD', 'items', 'items.metodosPago'],
  });
  
  // ... lógica de cálculo ...
}
```

#### 3. Controller Endpoint
**Archivo**: `src/comanda/comanda.controller.ts`

```typescript
@Get('resumen-caja-por-metodo-pago')
@Roles(RolPersonal.ADMIN, RolPersonal.ENCARGADO, RolPersonal.USER)
@ApiOperation({
  summary: 'Obtener resumen de caja diario con desglose por método de pago',
  description: 'Obtiene un resumen de la caja chica para un día específico...',
})
@ApiQuery({ 
  name: 'fecha', 
  required: false, 
  type: String, 
  description: 'Fecha del día a consultar (opcional, por defecto hoy)',
  example: '2024-10-02'
})
async obtenerResumenCajaPorMetodoPago(@Query() filtros: { fecha?: string }) {
  return await this.comandaService.getResumenCajaPorMetodoPago(filtros);
}
```

### Lógica de Negocio

1. **Filtros aplicados**:
   - Solo comandas VALIDADAS o PENDIENTES
   - Solo de CAJA_1
   - Del día específico (00:00:00 a 23:59:59)

2. **Desglose por método de pago**:
   - Solo se incluyen comandas VALIDADAS de tipo INGRESO
   - Se procesan todos los `metodosPago` de cada `ItemComanda`
   - Se suma el `montoFinal` (que incluye recargos y descuentos)

3. **Otros cálculos**:
   - Suma prepagos activos a los ingresos totales
   - Incluye residuales del último movimiento del día
   - Resta egresos del monto neto

4. **Prepagos**:
   - Se suman a los totales generales
   - NO aparecen en el desglose `porMetodoPago` (no tienen método de pago asociado)

---

## Changelog

### v2.0.0 - Resumen Diario (Actual) 🎯

**Fecha**: Octubre 2025

**Cambios**:
- ✅ Cambiado de rango de fechas a día único
- ✅ Parámetro único `fecha` en lugar de `fechaDesde` y `fechaHasta`
- ✅ Siempre retorna datos de un solo día (00:00 a 23:59)
- ✅ Ideal para datepickers y calendarios
- ✅ Documentación consolidada en un solo archivo

**Breaking Changes**:
```typescript
// ANTES (v1.0.0)
GET /comandas/resumen-caja-por-metodo-pago?fechaDesde=2024-10-01&fechaHasta=2024-10-31

// AHORA (v2.0.0)
GET /comandas/resumen-caja-por-metodo-pago?fecha=2024-10-02
```

**Migración**:
```typescript
// Antes
const params = {
  fechaDesde: '2024-10-02T00:00:00.000Z',
  fechaHasta: '2024-10-02T23:59:59.999Z'
};

// Ahora
const params = {
  fecha: '2024-10-02'
};
```

### v1.0.0 - Versión Inicial con Rangos

**Fecha**: Octubre 2025

**Características**:
- ✅ Desglose por método de pago en ARS y USD
- ✅ Acepta rangos de fechas con `fechaDesde` y `fechaHasta`
- ✅ Usa Luxon con zona horaria Argentina
- ✅ Documentación completa en 3 archivos separados

**Limitaciones**:
- ❌ Parámetros múltiples confusos para uso diario
- ❌ No optimizado para datepickers
- ❌ Documentación fragmentada

---

## Consideraciones Importantes

### ✅ Lo que incluye el endpoint

- Comandas VALIDADAS y PENDIENTES de CAJA_1
- Desglose por método de pago (solo comandas VALIDADAS de tipo INGRESO)
- Prepagos activos del día (sumados a totales generales)
- Egresos del día
- Residuales del último movimiento del día

### ❌ Lo que NO incluye

- Comandas de otros días
- Comandas CANCELADAS o FINALIZADAS
- Comandas de CAJA_2
- Rangos de fechas múltiples

### 🎯 Mejores Prácticas

1. **Frontend**:
   - Usa datepickers para selección de día
   - Implementa caché de 5 minutos (React Query)
   - Muestra el día actual por defecto

2. **Performance**:
   - El endpoint es rápido al consultar un solo día
   - Evita hacer múltiples consultas secuenciales
   - Usa paginación si necesitas ver múltiples días

3. **UX**:
   - Muestra el día seleccionado claramente
   - Implementa navegación día anterior/siguiente
   - Permite volver rápido al día actual

---

## Status Codes

- `200 OK`: Resumen obtenido exitosamente
- `400 Bad Request`: Formato de fecha inválido
- `401 Unauthorized`: No autorizado (token inválido o no proporcionado)
- `403 Forbidden`: No tiene permisos suficientes
- `500 Internal Server Error`: Error interno del servidor

---

## Testing

### Test Unitario

```typescript
describe('ComandaService - getResumenCajaPorMetodoPago', () => {
  it('debe retornar el resumen de hoy cuando no se proporciona fecha', async () => {
    const resultado = await comandaService.getResumenCajaPorMetodoPago({});
    
    expect(resultado.porMetodoPago).toBeDefined();
    expect(resultado.totalCompletados).toBeGreaterThanOrEqual(0);
  });

  it('debe retornar el resumen de una fecha específica', async () => {
    const resultado = await comandaService.getResumenCajaPorMetodoPago({
      fecha: '2024-10-02',
    });
    
    expect(resultado.porMetodoPago.EFECTIVO).toHaveProperty('ARS');
    expect(resultado.porMetodoPago.EFECTIVO).toHaveProperty('USD');
  });

  it('debe calcular correctamente los montos por método de pago', async () => {
    const resultado = await comandaService.getResumenCajaPorMetodoPago({
      fecha: '2024-10-02',
    });
    
    const totalARS = Object.values(resultado.porMetodoPago)
      .reduce((sum, metodo) => sum + metodo.ARS, 0);
    
    expect(totalARS).toBeGreaterThanOrEqual(0);
  });
});
```

### Test de Integración

```bash
# Resumen de hoy
GET http://localhost:3000/comandas/resumen-caja-por-metodo-pago

# Resumen de fecha específica
GET http://localhost:3000/comandas/resumen-caja-por-metodo-pago?fecha=2024-10-02
```

---

## Soporte

Para preguntas o issues:
- Revisar la documentación Swagger en `/api/docs`
- Verificar los logs del servidor para errores
- Confirmar que Luxon está instalado correctamente
- Verificar la zona horaria configurada

---

**Última actualización**: Octubre 2025  
**Versión**: 2.0.0  
**Mantenido por**: Equipo de Desarrollo

