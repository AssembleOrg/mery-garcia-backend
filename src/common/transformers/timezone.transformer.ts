import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
const now = new Date();
const argNow = toZonedTime(now, 'America/Argentina/Buenos_Aires');
/**
 * Transformer para manejar fechas con timezone de Argentina
 * Convierte las fechas de JavaScript al timezone de Argentina antes de guardar en la base de datos
 */
export const TimezoneTransformer = {

  to: (value?: Date): Date | undefined => {
    if (!value) return value;
    const horaActualART = formatInTimeZone(
      value, // ✅ FIXED: Usar el value que recibe como parámetro
      'America/Argentina/Buenos_Aires',
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );
    console.log('horaActualART', horaActualART);
    // Convierte el Date (UTC) al huso de Buenos Aires
    return new Date(horaActualART);
  },
  
  from: (value: Date | undefined): Date | undefined => {
    if (!value) return value;
    const horaActualART = formatInTimeZone(
      value,
      'America/Argentina/Buenos_Aires',
      "yyyy-MM-dd'T'HH:mm:ssXXX"
    );
    // Al leer de la base de datos, la fecha ya viene con el timezone correcto
    return new Date(horaActualART);
  }
};
