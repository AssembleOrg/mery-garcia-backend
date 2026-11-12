/**
 * Tanda 6 (noviembre 2026): sale del glosario de recepción, armado con 683
 * charlas reales del WhatsApp de recepción (nov-2024 a nov-2026) y la agenda de
 * Mery Booking. Ver mery-garcia-cliente/whatsapp-glosario/GLOSARIO.md.
 *
 * - RESPUESTAS_V6: claves nuevas (se agregan una sola vez, sin pisar).
 * - TEXTOS_ANTERIORES_V6: el texto que tenían algunas respuestas antes de esta
 *   tanda. La respuesta guardada se actualiza al texto nuevo de la semilla SOLO
 *   si sigue igual a este (si Mery la editó desde el panel, queda la suya).
 *
 * Mismas reglas que las otras tandas: nada de precios ni días escritos a mano;
 * {servicios:…}, {agenda:…} y {dias:…} se completan en vivo desde la web de turnos.
 */
import type { RespuestaSemilla } from './respuestas.seed';

const WEB_ESTILISMO = 'https://merygarciabooking.com/estilismo-de-cejas/';
const WEB_TATTOO = 'https://merygarciabooking.com/tattoo-cosmetico/';

export const VERSION_SEMILLA_V6 = 6;

export const RESPUESTAS_V6: RespuestaSemilla[] = [
  // ─── Turnos del día a día ───────────────────────────────────
  {
    clave: 'CONFIRMACION_RESPUESTA',
    titulo: 'Confirma que va al turno',
    descripcion:
      'Responde que SÍ va a ir a su turno (por ejemplo, al recordatorio del día anterior). Si dice que NO puede ir, va reprogramar o cancelar.',
    ejemplos: [
      'sí, confirmo',
      'confirmado',
      'ahí estaré',
      'sí, voy',
      'perfecto, nos vemos mañana',
      'confirmo mi turno de mañana',
    ],
    respuesta:
      'Genial, te esperamos! 💖 Estamos en Av. Melián 3646, PB 1 (timbre 1), Saavedra. Recordá que no se puede asistir con acompañante.',
  },
  {
    clave: 'LLEGADA_TARDE',
    titulo: 'Va a llegar tarde',
    descripcion:
      'Avisa que va a llegar tarde o pregunta cuánta tolerancia hay para llegar al turno.',
    ejemplos: [
      'voy a llegar tarde',
      'estoy llegando, me demoré',
      '¿cuánta tolerancia tienen?',
      'llego 15 minutos tarde',
      'hay mucho tránsito, llego un poco más tarde',
    ],
    respuesta:
      'Dale! Tenemos *15 minutos de tolerancia* 💖 Si hay otra clienta después puede ser menos, así que avisanos cuánto vas a demorar y recepción te confirma.',
    derivaAPersona: true,
  },
  {
    clave: 'DURACION',
    titulo: 'Cuánto dura el turno o el resultado',
    descripcion:
      'Pregunta cuánto dura el turno o el servicio, a qué hora va a terminar, o cuánto le dura el resultado (refill, tinte, nanoblading).',
    ejemplos: [
      '¿cuánto dura el turno?',
      '¿cuánto tarda el nanoblading?',
      '¿a qué hora termino?',
      '¿cuánto dura el modelado?',
      '¿cuánto dura la consulta?',
      '¿cuánto me dura el refill?',
    ],
    respuesta:
      '⏱️ Cosmetic tattoo: contá con *3 hs* de disponibilidad (1 h de anestesia + el servicio). Si son dos servicios el mismo día, 4 hs.\n' +
      '⏱️ Consulta previa: entre 1 h y 1:30 h.\n' +
      '⏱️ Estilismo: el modelado lleva unos 30 a 45 minutos; con tinte o refill, alrededor de 1 h.\n\n' +
      'Y el resultado: el refill y el tinte duran unos 15 a 20 días; el nanoblading, alrededor de un año (por eso se hace un mantenimiento anual).',
  },

  // ─── Cosmetic tattoo ────────────────────────────────────────
  {
    clave: 'TRABAJO_PREVIO',
    titulo: 'Tiene un trabajo previo en cejas (de otro lugar o viejo)',
    descripcion:
      'Ya tiene microblading, nanoblading, hair stroke u otro tatuaje de cejas hecho en OTRO lugar (o viejo, o borrado con láser) y quiere hacerse algo con Mery, corregirlo o taparlo.',
    ejemplos: [
      'tengo un microblading de otro lugar',
      'me hice las cejas en otro lado y quedaron mal',
      'tengo un tatuaje viejo en las cejas',
      'me hice láser, ¿puedo hacerme nano?',
      'quiero corregir mis cejas tatuadas',
      'tengo hair stroke de hace unos meses',
    ],
    respuesta:
      'Entiendo! Al tener trabajo previo, Mery empieza con una técnica llamada *Brow Camouflage* ✨ Combina despigmentación, corrección de color, textura y estructura para mejorar el aspecto de un trabajo mal hecho o deteriorado. Mery no trabaja sobre servicios hechos en otro lugar sin camuflarlos antes.\n\n' +
      'Lo primero es reservar la *consulta obligatoria CON trabajo previo*:\n{servicios:brow camouflage [consulta obligatoria] con}\n' +
      'Por el momento los días de consulta son {dias:brow camouflage [consulta obligatoria] con}. Se reserva en ' +
      WEB_TATTOO +
      '\n\nSuelen ser 2 o 3 sesiones, cada 30 a 60 días; lo define Mery. Si te hiciste láser, esperá unos 2 meses antes.',
  },
  {
    clave: 'RETOQUE_PLAZO',
    titulo: 'Cuándo se hace el retoque (2ª sesión)',
    descripcion:
      'Pregunta cuándo le toca el retoque o la 2ª sesión, si puede hacerlo antes o después, o qué pasa si se le pasó el plazo. (Para el PRECIO del retoque va la clave de precio del servicio.)',
    ejemplos: [
      '¿cuándo me toca el retoque?',
      '¿puedo hacer el retoque antes de los 30 días?',
      'se me pasó el retoque',
      '¿cuánto tiempo tengo para el retoque?',
      '¿la segunda sesión cuándo es?',
    ],
    respuesta:
      'El retoque es la *2ª sesión* y se hace entre los *30 y los 60 días* después de tu primera sesión (no antes ni después), para evaluar el trabajo ya cicatrizado 100% ✨\n\n' +
      'Pasados los 90 días de tu última sesión ya se considera *mantenimiento*, que es otro valor. Si estás entre los 60 y los 90 días, escribinos y lo vemos.\n\n' +
      'Lo reservás en ' +
      WEB_TATTOO +
      ' eligiendo «2ª Sesión - Retoque».',
  },
  {
    clave: 'MANTENIMIENTO',
    titulo: 'Mantenimiento de un tattoo (cada cuánto, si hace falta consulta)',
    descripcion:
      'Ya se hizo un tatuaje cosmético con Mery hace tiempo y pregunta por el mantenimiento: cada cuánto, si puede reservar directo o si tiene que hacer consulta. (Para el PRECIO va la clave de precio del servicio.)',
    ejemplos: [
      'hace un año me hice las cejas con Mery',
      'quiero hacer el mantenimiento',
      '¿cada cuánto hay que hacer mantenimiento?',
      'me hice micro con Mery hace años',
      '¿tengo que hacer consulta para el mantenimiento?',
    ],
    respuesta:
      'El mantenimiento se hace más o menos *una vez al año* (se considera mantenimiento pasados los 90 días de tu última sesión) y sirve también para actualizar trabajos viejos a la técnica actual, Nanoblading ✨\n\n' +
      'Si después de Mery no te hiciste nada en otro lugar, reservás directo el *Mantenimiento* en ' +
      WEB_TATTOO +
      '\nSi te hiciste algo con otra profesional, primero va la consulta CON trabajo previo.\n\n' +
      'El mantenimiento no incluye el retoque: si hace falta, es otro valor.',
  },
  {
    clave: 'ANTES_DEL_TATTOO',
    titulo: 'Antes del tattoo: botox, medicación, tiempo, herpes',
    descripcion:
      'Pregunta qué tener en cuenta ANTES de un tatuaje cosmético: botox, Roacutan u otro tratamiento dermatológico, cuánto tiempo reservar, si puede venir con la anestesia puesta, herpes antes del lip blush.',
    ejemplos: [
      'me puse botox, ¿puedo hacerme las cejas?',
      'tomo roacutan',
      '¿puedo ir con la crema anestésica puesta?',
      'tengo herpes, ¿puedo hacerme lip blush?',
      '¿qué tengo que hacer antes del turno?',
      '¿cuántos días después del botox?',
    ],
    respuesta:
      'Antes de tu cita de cosmetic tattoo 🩷\n' +
      '• Contá con *3 hs de disponibilidad* (1 h de anestesia + el servicio).\n' +
      '• *Botox*: tienen que haber pasado 15 días desde la última aplicación (si no, no podemos hacer el servicio), y después esperar 15 días para una nueva.\n' +
      '• Si estás en tratamiento dermatológico (por ejemplo Roacutan), consultá con tu dermatólogo si podés hacerlo, antes de la cita.\n' +
      '• No vengas con la anestesia puesta: primero sacamos la foto del antes.\n' +
      '• Lip blush: hidratá muy bien los labios la semana previa; si tuviste herpes, hacé el tratamiento preventivo que te indique tu médico.\n\n' +
      'Si estás con algún tratamiento médico (quimioterapia, anticoagulantes, embarazo), contanos y lo vemos con Mery.',
  },
  {
    clave: 'CUIDADOS_POST',
    titulo: 'Cuidados después del tattoo (cicatrización)',
    descripcion:
      'Pregunta qué cuidados tener DESPUÉS de un tatuaje cosmético (nanoblading, lip blush, lashes line, camuflaje): mojar, costritas, sol, maquillaje, gimnasio, protector solar, o si es normal el color fuerte, lo rojo o la costra.',
    ejemplos: [
      '¿puedo mojarme las cejas?',
      'tengo costritas, ¿es normal?',
      '¿cuándo puedo ir al gimnasio?',
      '¿puedo maquillarme?',
      '¿cuándo puedo usar protector solar?',
      'se me ve muy oscuro, ¿es normal?',
      'tengo los labios rojos, ¿se va?',
    ],
    respuesta:
      'Los primeros 7 a 10 días es *cicatrizado en seco* ✨\n' +
      '• No mojes ni humedezcas la zona, no maquilles ni pongas cremas.\n' +
      '• Nada de sol ni actividad física (la transpiración hace que el pigmento no agarre).\n' +
      '• Las costritas se caen solas: no las saques.\n' +
      '• Cuando se cayeron todas, protector solar factor 50 sin color.\n\n' +
      'En labios: solo hidratar (Aquaphor) y tomar con sorbete los primeros días. Es normal que al principio el color se vea más intenso o rojo: con los días baja.\n\n' +
      'Guías completas:\nCejas: https://merygarcia.com.ar/after-care-nanoblading/\nLabios: https://merygarcia.com.ar/after-care-lip-blush\nPestañas: https://merygarcia.com.ar/after-care-lashes-line\n\n' +
      'Si notás algo que te preocupa, mandanos una foto y se la pasamos a Mery 💕',
  },
  {
    clave: 'LAST_MINUTE',
    titulo: 'Last Minute Booking',
    descripcion:
      'Pregunta por Last Minute Booking (LMB), turnos de último momento o el descuento por un turno que se libera de un día para el otro.',
    ejemplos: [
      '¿qué es last minute booking?',
      'vi lo de last minute',
      '¿hay turnos de último momento?',
      '¿cómo es el 20% de descuento?',
      '¿el retoque entra en last minute?',
    ],
    respuesta:
      '*Last Minute Booking* son disponibilidades que se liberan de un día para el otro, con *20% off* con cualquier medio de pago 🔥\n' +
      'Son para Nanoblading, Lip Blush y Lash Line (mantenimientos o 1ras sesiones con la consulta ya hecha). Los retoques no entran.\n\n' +
      'Las avisamos por Instagram y se reservan directo en la web: ' +
      WEB_TATTOO +
      '\nSi ya tenías un turno y lo pasás a Last Minute, la seña de ese turno se pierde.',
  },
  {
    clave: 'FORMAS_DE_PAGO',
    titulo: 'Formas de pago y descuentos',
    descripcion:
      'Pregunta cómo se paga, si aceptan tarjeta, transferencia, dólares, pesos u otra moneda, o qué descuento hay en efectivo.',
    ejemplos: [
      '¿cómo se paga?',
      '¿aceptan tarjeta?',
      '¿puedo pagar en pesos?',
      '¿tienen descuento en efectivo?',
      '¿aceptan euros?',
      '¿a qué cotización toman el dólar?',
      '¿puedo pagar por transferencia?',
    ],
    respuesta:
      'Los servicios de cosmetic tattoo se pueden abonar:\n' +
      '⚡️ En *dólar billete*, al precio en efectivo (no se aceptan billetes cara chica, manchados, rotos ni escritos).\n' +
      '⚡️ En *pesos*, a la cotización blue (venta) del día.\n' +
      '⚡️ Por *transferencia* en pesos, con 10% de descuento sobre el precio de lista.\n' +
      '⚡️ Con *tarjeta de crédito* en pesos, a precio de lista.\n\n' +
      'El mayor descuento es en efectivo 💸 No aceptamos otras monedas (euros, reales, etc.).\n' +
      'En estilismo (en pesos), pagando en efectivo tenés 5% de descuento.',
  },

  // ─── El estudio ─────────────────────────────────────────────
  {
    clave: 'QUIEN_ATIENDE',
    titulo: 'Quién atiende / qué días está cada estilista',
    descripcion:
      'Pregunta quién hace los servicios, si lo hace Mery, con qué estilista se atiende, o qué días viene una estilista (Ro, Rosario, Luna).',
    ejemplos: [
      '¿Mery hace el laminado?',
      '¿qué días está Luna?',
      '¿Ro viene el sábado?',
      '¿con quién me atiendo?',
      '¿Mery me hace el modelado?',
      '¿quién hace el nanoblading?',
      '¿Luna viene este sábado?',
    ],
    respuesta:
      'El *cosmetic tattoo* (nanoblading, lip blush, lash line, camuflaje) lo realiza únicamente Mery ✨\n' +
      'El *estilismo* (modelado, laminado, tinte, refill) lo hacen nuestras estilistas. Estos son sus próximos días:\n' +
      '{agenda:modelado de cejas}\n\n' +
      'Reservás con la que prefieras en ' +
      WEB_ESTILISMO,
  },
  {
    clave: 'ESTACIONAMIENTO',
    titulo: 'Estacionamiento',
    descripcion:
      'Pregunta si tienen estacionamiento o cochera, o dónde estacionar.',
    ejemplos: [
      '¿tienen estacionamiento?',
      '¿dónde estaciono?',
      '¿hay cochera cerca?',
      'estoy dando vueltas y no encuentro lugar',
    ],
    respuesta:
      'No contamos con estacionamiento 🙏 La zona es difícil para estacionar, así que te recomendamos venir con tiempo. Estamos en Av. Melián 3646, PB 1, Saavedra.',
  },
  {
    clave: 'ACOMPANANTE',
    titulo: 'Ir acompañada',
    descripcion:
      'Pregunta si puede ir con alguien (mamá, hija, amiga, pareja) o si la pueden esperar adentro.',
    ejemplos: [
      '¿puedo ir con mi mamá?',
      '¿puedo ir acompañada?',
      '¿puedo llevar a mi hija?',
      '¿mi amiga me puede esperar adentro?',
    ],
    respuesta:
      'No se puede asistir con acompañante 🙏 Y si necesitás usar el celular durante el turno, que sea con auriculares (sin llamadas ni audios).',
  },
  {
    clave: 'AUDIOS_LLAMADAS',
    titulo: 'Quiere llamar o mandar audios',
    descripcion:
      'Pide que la llamen, pregunta si puede llamar por teléfono o si puede mandar un audio.',
    ejemplos: [
      '¿te puedo llamar?',
      '¿me llamás?',
      'te mando un audio',
      '¿tienen teléfono para llamar?',
    ],
    respuesta:
      'Perdón, te escribimos desde una compu en el estudio y no podemos escuchar audios ni recibir llamadas 🙏 ¿Me lo escribís, porfa? 💖',
  },
  {
    clave: 'PESTANAS',
    titulo: 'Pestañas: tinte, Lash Refill, lifting',
    descripcion:
      'Pregunta por servicios de pestañas: tinte, Lash Refill, lifting, permanente o extensiones. (Para el tatuaje en la línea de pestañas va Lashes Line.)',
    ejemplos: [
      '¿hacen lifting de pestañas?',
      '¿tiñen pestañas?',
      '¿hacen permanente de pestañas?',
      '¿hacen extensiones de pestañas?',
      'quiero tinte de pestañas',
    ],
    respuesta:
      'En pestañas hacemos *tinte de pestañas* y *Lash Refill*, y se pueden sumar a tu turno de cejas ✨\n' +
      '{servicios:tinte de pestanas|lash refill}\n' +
      'Lifting, permanente o extensiones no realizamos.\n\n' +
      'Se reservan en ' +
      WEB_ESTILISMO,
  },
  {
    clave: 'EPITESIS',
    titulo: 'Epítesis CAP (areola-pezón)',
    descripcion:
      'Pregunta por las epítesis de areola y pezón (piezas de silicona), el adhesivo o pegamento, el programa Doná tu molde, o cómo encargarlas.',
    ejemplos: [
      '¿qué son las epítesis?',
      'quiero una epítesis de pezón',
      '¿venden el pegamento de la epítesis?',
      'doná tu molde',
      'tuve una mastectomía, ¿qué ofrecen?',
    ],
    respuesta:
      'Las *Epítesis CAP* son piezas de complejo areola-pezón hechas a mano, con silicona de grado médico certificado, 100% personalizadas en tono, forma y textura, pensadas para personas que atravesaron cirugías como mastectomías 🤍\n\n' +
      'También tenemos *Doná tu molde*: podés venir al estudio para que tomemos un molde para nuestro banco y así ayudar a otras personas.\n\n' +
      'El proceso empieza con una consulta previa obligatoria, que se reserva en https://merygarciabooking.com/epitesis-cap\n' +
      'El adhesivo para las piezas lo vendemos en el estudio.',
  },
  {
    clave: 'PRODUCTOS',
    titulo: 'Productos a la venta',
    descripcion:
      'Pregunta si venden productos (Stain Me, pinzas, gel, protector, adhesivo) o cuál le recomiendan.',
    ejemplos: [
      '¿venden productos?',
      '¿venden el Stain Me?',
      '¿venden pinzas?',
      '¿qué gel me recomiendan para las cejas?',
      '¿tienen protector para cejas?',
    ],
    respuesta:
      'En el estudio vendemos *Stain Me*, pinzas de depilar y el adhesivo para epítesis 💕 Si buscás algo en particular, escribinos y te confirmamos si hay stock.',
  },
  {
    clave: 'GIFT_CARD',
    titulo: 'Gift card / regalar un servicio',
    descripcion:
      'Pregunta por gift cards, vouchers o cómo regalar un servicio.',
    ejemplos: [
      '¿tienen gift card?',
      'quiero regalar un servicio',
      '¿hacen vouchers de regalo?',
      '¿puedo regalarle un nanoblading a mi mamá?',
    ],
    respuesta: 'Por el momento no tenemos gift cards activas 💕',
  },
  {
    clave: 'NO_HACEMOS',
    titulo: 'Servicios que no hacemos',
    descripcion:
      'Pide algo que el estudio NO hace: borrado o remoción de tatuajes, ácido hialurónico o rellenos, botox, maquillaje para eventos, eyeliner u ojeras tatuadas, depilación con hilo, tatuar sobre lunares, zona genital, uñas, pelo, etc. (Microblading, henna y delineado de ojos tienen su propia clave.)',
    ejemplos: [
      '¿hacen borrado de tatuajes?',
      '¿ponen ácido hialurónico?',
      '¿me maquillan para un casamiento?',
      '¿hacen eyeliner?',
      '¿tatúan ojeras?',
      '¿depilan con hilo?',
      '¿hacen uñas?',
    ],
    respuesta:
      'No realizamos ese servicio 🙏 En el estudio hacemos estilismo de cejas (modelado, laminado, tinte, refill), tinte de pestañas y cosmetic tattoo con Mery (nanoblading, lip blush, lash line, camuflaje, pecas y tatuaje paramédico). Si querés te cuento de alguno 💕',
  },
];

/** Texto de cada respuesta antes de la tanda 6 (para actualizar sólo las que nadie editó). */
export const TEXTOS_ANTERIORES_V6: Record<string, string> = {
  NANOBLADING_QUIERO:
    'Hola! como estas? 💖\nSi nunca te realizaste ningun servicio de cosmetic tattoo en cejas, lo primero que debes hacer es tomar un turno de consulta OBLIGATORIA previa. En esa consulta te van a saber explicar bien de que trata el servicio, cuidados, valores y te van a realizar un maquillaje personalizado hiperrealista de como quedaría el servicio de Nanoblading.\n\nEl valor de la consulta es de $80.000 y los turnos se toman únicamente por nuestra web https://merygarciabooking.com/tattoo-cosmetico/ (Consulta obligatoria SIN trabajo previo). Por el momento los unicos dias de consulta son Martes y Jueves a las 12hs.',
  LIP_BLUSH_QUIERO:
    'Hola! buenas ❤️\nSi nunca te realizaste ningun servicio de cosmetic tattoo en labios, lo primero que debes hacer es tomar un turno de consulta OBLIGATORIA previa. En esa consulta te van a saber explicar bien de que trata el servicio, cuidados, valores y te van a realizar un maquillaje personalizado hiperrealista de como quedaría el servicio de Lip Blush.\n\nEl valor de la consulta es de $50.000 y los turnos se toman únicamente por nuestra web https://merygarciabooking.com/tattoo-cosmetico/ (Consulta obligatoria SIN trabajo previo). Por el momento los unicos dias de consulta son los viernes a las 12hs.',
  TURNO_REPROGRAMAR:
    'Hola! Si necesitás reprogramar tu turno, podés hacerlo vos misma desde nuestra web utilizando el código de reserva que recibiste por mail al momento de agendar.\nSolo ingresá a la opción "Gestionar mi reserva", colocá ese código y vas a poder cambiar la fecha y el horario según la disponibilidad.\nSi no encontrás el correo o necesitás una mano, escribinos y con gusto te ayudamos. 💕',
  SENA: 'Al reservar un turno desde la web se abona una *seña* online, que después se descuenta del valor del servicio. El valor de la seña de cada servicio lo ves al reservar en https://merygarciabooking.com',
  UBICACION:
    'Estamos en *Av. Melián 3646 PB 1, CABA* 📍 Nuestro horario de atención es {horario}. Los turnos se reservan desde https://merygarciabooking.com',
  REFILL_QUE_ES:
    'Hola! como estas?\nEl refill es un tinte superficial, que tiñe la piel de tus cejas creando así un efecto de densidad, hiper pobladas y realistas. La duración es de aproximadamente 20 días.',
  HORARIOS:
    'Nuestro horario de atención es {horario}. Los turnos se reservan desde la web, donde ves todas las disponibilidades: https://merygarciabooking.com',
  FORMACIONES_INFO:
    '¡Sí! ✨ Además del estudio, Mery tiene su *Academia*, con formaciones profesionales para aprender sus técnicas:\n\n{formaciones}\n\nLa mayoría son 100% online y autogestivas, con acceso ilimitado por 1 año. Toda la info y la inscripción: https://merygarcia.com.ar/formaciones\n\nSi me decís cuál te interesa, te cuento cómo es.',
};
