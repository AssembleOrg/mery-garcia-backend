/**
 * Segunda tanda de respuestas (octubre 2026): formaciones, precios y datos del
 * estudio. Sale de las fuentes oficiales: merygarcia.com.ar (formaciones y
 * "sobre mí"), el catálogo público del portal y la web de turnos.
 *
 * Reglas para que el bot no invente:
 * - El texto es fijo; el clasificador sólo elige la clave.
 * - Ningún precio está escrito acá: {formaciones}, {formacion:slug} y
 *   {servicios:patrón} se completan en vivo desde el portal y la web de turnos
 *   (si no responden, va el link a la web en lugar del número).
 * - {horario} sale de la configuración del bot.
 * - Lo que requiere a una persona (cuentas, cancelaciones, prórrogas, equipos)
 *   deriva.
 *
 * Se agregan una sola vez a la tabla, sin pisar las respuestas que ya existen
 * (ver ConfigWhatsappService); después se editan desde Configuración > WhatsApp.
 */
import type { RespuestaSemilla } from './respuestas.seed';

const WEB_FORMACIONES = 'https://merygarcia.com.ar/formaciones';
const WEB_TURNOS = 'https://merygarciabooking.com';
const WEB_ESTILISMO = 'https://merygarciabooking.com/estilismo-de-cejas/';
const WEB_TATTOO = 'https://merygarciabooking.com/tattoo-cosmetico/';

export const VERSION_SEMILLA_V2 = 2;
/** Tanda 4: respuestas agregadas después (se suman sin pisar, igual que la v2). */
export const VERSION_SEMILLA_V4 = 4;

export const RESPUESTAS_V2: RespuestaSemilla[] = [
  // ─── Formaciones (aprender) ─────────────────────────────────
  {
    clave: 'FORMACIONES_INFO',
    titulo: 'Quiere hacer un curso / formarse',
    descripcion:
      'Quiere APRENDER (curso, clase, capacitación, formación, academia, taller, ser brow artist), no hacerse un servicio. Pregunta en general qué cursos hay.',
    ejemplos: [
      'quiero hacer un curso',
      'dan cursos?',
      'tienen clases para aprender?',
      'hacen capacitaciones?',
      'me interesa la academia',
      'quiero formarme como brow artist',
      'info de las formaciones',
    ],
    respuesta:
      '¡Sí! ✨ Además del estudio, Mery tiene su *Academia*, con formaciones profesionales para aprender sus técnicas:\n\n' +
      '{formaciones}\n\n' +
      'La mayoría son 100% online y autogestivas, con acceso ilimitado por 1 año. Toda la info y la inscripción: ' +
      WEB_FORMACIONES +
      '\n\nSi me decís cuál te interesa, te cuento cómo es.',
  },
  {
    clave: 'FORMACION_PRECIO',
    titulo: 'Precio de las formaciones',
    descripcion:
      'Pregunta cuánto salen los cursos o formaciones en general, SIN nombrar un curso en particular (si nombra uno, va la clave de esa formación).',
    ejemplos: [
      'cuánto sale el curso?',
      'precio de las formaciones',
      'cuánto cuestan las clases para aprender?',
      'valores de la academia',
    ],
    respuesta:
      'Estos son los valores actuales de las formaciones:\n\n{formaciones}\n\n' +
      'Pueden tener promociones: el precio final lo ves al inscribirte en ' +
      WEB_FORMACIONES,
  },
  {
    clave: 'FORMACION_ESTILISMO',
    titulo: 'Curso de Estilismo de Cejas (Módulo I)',
    descripcion:
      'Pregunta por el curso de estilismo de cejas, el Módulo I o un curso de cejas para empezar (qué es, cómo es o cuánto sale).',
    ejemplos: [
      'curso de estilismo de cejas',
      'módulo 1',
      'curso de cejas para principiantes',
      'quiero aprender a diseñar cejas',
    ],
    respuesta:
      '{formacion:estilismo-de-cejas}\n\n' +
      'Es el *Módulo I*, la base de todo brow artist: no requiere experiencia previa e incluye la técnica de Refill by Mery García. ' +
      'Es online y autogestivo, con acceso por 1 año. Inscripción: ' +
      WEB_FORMACIONES,
  },
  {
    clave: 'FORMACION_MICROBLADING',
    titulo: 'Curso de Microblading (Módulo II)',
    descripcion:
      'Quiere APRENDER microblading o pregunta por el curso de microblading / Módulo II (cómo es o cuánto sale). Si quiere hacérselo, es MICROBLADING.',
    ejemplos: [
      'curso de microblading',
      'módulo 2',
      'quiero aprender microblading',
      'formación de microblading',
    ],
    respuesta:
      '{formacion:modulo-ii-microblading-mg}\n\n' +
      'Es el *Módulo II*. Requiere experiencia y recomendamos hacer antes el Módulo I – Estilismo de Cejas. Inscripción: ' +
      WEB_FORMACIONES,
  },
  {
    clave: 'FORMACION_NANOBLADING',
    titulo: 'Formación de Nanoblading',
    descripcion:
      'Quiere APRENDER nanoblading o pregunta por el curso de nanoblading (cómo es o cuánto sale). Si quiere hacérselo, es NANOBLADING_QUIERO o PRECIO_NANOBLADING.',
    ejemplos: [
      'curso de nanoblading',
      'cuánto sale el curso de nanoblading?',
      'quiero aprender nanoblading',
      'formación de nanoblading presencial',
    ],
    respuesta:
      '{formacion:nanoblading}\n\nPara la inscripción y las fechas: ' +
      WEB_FORMACIONES,
  },
  {
    clave: 'FORMACION_LIPBLUSH',
    titulo: 'Formación de Lip Blush',
    descripcion:
      'Quiere APRENDER lip blush o pregunta por el curso de lip blush (cómo es o cuánto sale). Si quiere hacérselo, es LIP_BLUSH_QUIERO o PRECIO_LIP_BLUSH.',
    ejemplos: [
      'curso de lip blush',
      'quiero aprender lip blush',
      'formación de labios',
    ],
    respuesta: '{formacion:lipblush}\n\nInscripción: ' + WEB_FORMACIONES,
  },
  {
    clave: 'FORMACION_CAMUFLAJE',
    titulo: 'Formaciones de Camuflaje',
    descripcion:
      'Quiere APRENDER camuflaje o pregunta por los cursos de camuflaje (cómo son o cuánto salen). Si quiere que le hagan un camuflaje, es CAMUFLAJE_QUE_ES o PRECIO_CAMUFLAJE.',
    ejemplos: [
      'curso de camuflaje',
      'quiero aprender a corregir cejas',
      'formación camuflaje senior',
    ],
    respuesta:
      '{formacion:camuflaje-simple}\n\n{formacion:camuflaje-senior}\n\nInscripción: ' +
      WEB_FORMACIONES,
  },
  {
    clave: 'FORMACION_MODALIDAD',
    titulo: 'Cómo es la cursada (online / presencial, duración)',
    descripcion:
      'Pregunta si las formaciones son online o presenciales, cuánto dura el acceso o cómo es la cursada.',
    ejemplos: [
      'el curso es online o presencial?',
      'cuánto dura el curso?',
      'cómo es la cursada?',
      'son clases en vivo?',
      'lo puedo hacer desde otro país?',
    ],
    respuesta:
      'La mayoría de las formaciones son *100% online y autogestivas*: cursás a tu ritmo y podés volver a ver todo cuando quieras. ' +
      'El acceso es *ilimitado durante 1 año* desde la compra.\n\n' +
      'Incluyen videos de teoría, tutoriales paso a paso de cada servicio, una clase grabada en 4K y material descargable en PDF. ' +
      'Las formaciones de *Nanoblading* y *Camuflaje Senior* son *presenciales*, con preparación online.',
  },
  {
    clave: 'FORMACION_REQUISITOS',
    titulo: 'Experiencia previa / por cuál empezar',
    descripcion:
      'Pregunta si necesita experiencia para un curso o en qué orden conviene hacer las formaciones.',
    ejemplos: [
      'necesito experiencia para el curso?',
      'nunca hice nada, puedo hacer el curso?',
      'por cuál curso empiezo?',
      'qué orden recomiendan?',
    ],
    respuesta:
      'Para el *Módulo I – Estilismo de Cejas* no necesitás experiencia previa: es la base para todo brow artist. ' +
      'El *Módulo II – Microblading* y las formaciones de *Camuflaje* requieren experiencia, y recomendamos hacer antes el Módulo I.\n\n' +
      'Aunque tengas experiencia, te sugerimos empezar por el Módulo I: el contenido está pensado para verse en orden.',
  },
  {
    clave: 'FORMACION_CERTIFICADO',
    titulo: 'Certificado / examen de las formaciones',
    descripcion:
      'Pregunta si los cursos dan certificado, si hay examen o práctica presencial con Mery.',
    ejemplos: [
      'dan certificado?',
      'el curso es certificado?',
      'hay examen?',
      'puedo hacer la práctica con Mery?',
    ],
    respuesta:
      'La certificación artística es *solo para quienes cursan de forma presencial*. ' +
      'Al terminar la cursada online podés sumar, con un valor adicional, una clase presencial con Mery (One to One o grupal) con práctica con modelo y examen final. ' +
      'La certificación queda sujeta a la aprobación de Mery, que evalúa la calidad técnica y teórica.\n\n' +
      'La cursada online sola no otorga certificado.',
  },
  {
    clave: 'FORMACION_CONSULTAS_MG',
    titulo: 'Consultas con Mery durante el curso',
    descripcion:
      'Pregunta si durante la formación puede hacerle consultas a Mery o recibir devoluciones.',
    ejemplos: [
      'puedo consultarle a Mery durante el curso?',
      'hay devoluciones?',
      'Mery corrige los trabajos?',
    ],
    respuesta:
      'Sí 💕 Cada formación incluye un espacio de consulta directo con Mery, con *3 instancias de consulta y devolución*. ' +
      'Se habilita cuando terminaste todo el contenido y leíste el material, y se responde dentro de la semana de la consulta.',
  },
  {
    clave: 'FORMACION_INSCRIPCION',
    titulo: 'Cómo inscribirse / comprar una formación',
    descripcion: 'Pregunta cómo se inscribe, compra o paga un curso.',
    ejemplos: [
      'cómo me inscribo?',
      'cómo compro el curso?',
      'cómo pago la formación?',
      'dónde me anoto al curso?',
    ],
    respuesta:
      'Te inscribís directamente desde la web de formaciones: ' +
      WEB_FORMACIONES +
      '\n\nSi tenés alguna duda con el pago, contanos por acá y te ayuda recepción 💕',
  },
  {
    clave: 'FORMACION_PRORROGA',
    titulo: 'Prórroga del acceso a una formación',
    descripcion:
      'Se le venció o se le está por vencer el acceso a un curso y quiere extenderlo.',
    ejemplos: [
      'se me venció el curso',
      'quiero extender el acceso',
      'prórroga del curso',
      'se me terminó el año de acceso',
    ],
    respuesta:
      'Cuando se vence el año de acceso podés pedir una prórroga:\n' +
      '• *6 meses*: el 30% del valor actual del curso.\n' +
      '• *12 meses*: el 40% del valor actual del curso.\n' +
      'El pago es únicamente por transferencia. Te paso con recepción para gestionarla 💕',
    derivaAPersona: true,
  },
  {
    clave: 'FORMACION_ACCESO',
    titulo: 'Problemas para entrar a la plataforma',
    descripcion:
      'No puede entrar a la plataforma de formaciones, no ve un curso que compró o perdió su contraseña.',
    ejemplos: [
      'no puedo entrar al curso',
      'olvidé mi contraseña de la plataforma',
      'no me aparece el curso que compré',
      'no puedo ver las clases',
    ],
    respuesta:
      'Desde acá no puedo ver cuentas ni contraseñas. Te paso con recepción para que te ayude con el acceso 💕',
    derivaAPersona: true,
  },
  {
    clave: 'FORMACION_EQUIPOS',
    titulo: 'Formación para un equipo de trabajo',
    descripcion: 'Quiere capacitar a su equipo, a sus empleadas o a un salón.',
    ejemplos: [
      'quiero capacitar a mis empleadas',
      'hacen cursos para equipos?',
      'formación para mi salón',
    ],
    respuesta:
      'Para formar a tu equipo tenemos *Brow Essentials: Private Sessions*, espacios exclusivos para equipos de trabajo. ' +
      'Te paso con recepción para coordinarlo 💕',
    derivaAPersona: true,
  },
  {
    clave: 'FORMACION_MENTORIAS',
    titulo: 'Mentorías y consultorías con Mery',
    descripcion:
      'Pide una mentoría, consultoría o clase personalizada para actualizarse o perfeccionarse.',
    ejemplos: [
      'hacen mentorías?',
      'quiero una consultoría con Mery',
      'clase personalizada online',
      'quiero perfeccionarme',
    ],
    respuesta:
      'Hay *consultorías y mentorías online* para actualizarte o perfeccionarte: necesitás buena conexión a internet y unas 2 horas, y las podés hacer desde cualquier lugar del mundo. ' +
      'Por ahora se coordinan por acá, enviando 3 disponibilidades posibles de día lunes. Te paso con recepción 💕',
    derivaAPersona: true,
  },
  {
    clave: 'AUTOSTYLING',
    titulo: 'Clase de AutoStyling (hacerse sus propias cejas)',
    descripcion:
      'Quiere aprender a hacerse sus propias cejas, para ella misma (no como profesional).',
    ejemplos: [
      'quiero aprender a hacerme las cejas yo',
      'clase de autostyling',
      'curso para hacerme mis cejas',
    ],
    respuesta:
      'La *Clase de AutoStyling* es para aprender a hacerte tus propias cejas: es una clase presencial con preparación online y no necesitás experiencia previa.\n\n' +
      '{formacion:auto-styling-estilismo-de-cejas}\n\n' +
      'La clase se agenda desde nuestra web: ' +
      WEB_TURNOS,
  },

  // ─── Servicios y precios (hacerse) ──────────────────────────
  {
    clave: 'SERVICIOS_LISTA',
    titulo: 'Qué servicios hacen',
    descripcion: 'Pregunta qué servicios o tratamientos hacen en el estudio.',
    ejemplos: [
      'qué servicios hacen?',
      'qué hacen en el estudio?',
      'qué tratamientos tienen?',
    ],
    respuesta:
      'En el estudio hacemos:\n' +
      '• *Estilismo de cejas y pestañas*: modelado, laminado, tinte y refill.\n' +
      '• *Cosmetic tattoo*: Nanoblading, Lip Blush, Lashes Line, pecas y camuflaje de cejas, labios y pestañas.\n' +
      '• *Tatuaje paramédico*: Scar Camouflage, Areola Harmonization, Nano Scalp y epítesis.\n' +
      '• *AutoStyling*: una clase para aprender a hacerte tus cejas.\n\n' +
      'Todo se reserva desde ' +
      WEB_TURNOS,
  },
  {
    clave: 'ESTILISMO_QUE_ES',
    titulo: '¿Qué es el estilismo de cejas?',
    descripcion:
      'Pregunta qué es el estilismo de cejas, qué incluye o qué es el modelado.',
    ejemplos: [
      'qué es estilismo de cejas?',
      'qué incluye el estilismo?',
      'qué es el modelado de cejas?',
    ],
    respuesta:
      'El *estilismo de cejas* son los servicios para diseñar y realzar tus cejas sin tatuaje: modelado (depilación y forma), laminado, tinte y Brow Refill. ' +
      'Si es tu primera vez, te recomendamos reservar un turno de modelado: ahí nuestras estilistas te recomiendan qué otro servicio te conviene. Reservás acá: ' +
      WEB_ESTILISMO,
  },
  {
    clave: 'PRECIOS_GENERAL',
    titulo: 'Precios (sin decir de qué servicio)',
    descripcion: 'Pide precios o valores de los servicios sin decir cuál.',
    ejemplos: [
      'precios',
      'cuánto salen los servicios?',
      'lista de precios',
      'valores?',
    ],
    respuesta:
      '¿De qué servicio querés saber el valor? 💕\n' +
      '• Estilismo de cejas (modelado, laminado, tinte, refill)\n' +
      '• Nanoblading\n• Lip Blush\n• Lashes Line\n• Camuflaje\n• Pecas\n\n' +
      'También podés ver todos los valores en ' +
      WEB_TURNOS,
  },
  {
    clave: 'PRECIO_ESTILISMO',
    titulo: 'Precio de estilismo (modelado, laminado, tinte, refill)',
    descripcion:
      'Pregunta cuánto sale un servicio de estilismo de cejas o pestañas: modelado, perfilado, laminado, tinte o refill.',
    ejemplos: [
      'cuánto sale el laminado?',
      'precio del modelado de cejas',
      'valor del tinte de pestañas',
      'cuánto sale el brow refill?',
    ],
    respuesta:
      'Estos son los valores de estilismo de cejas y pestañas:\n\n' +
      '{servicios:modelado|laminado|tinte de|refill}\n\n' +
      'Al reservar desde la web se abona la seña. Reservás acá: ' +
      WEB_ESTILISMO,
  },
  {
    clave: 'PRECIO_NANOBLADING',
    titulo: 'Precio del Nanoblading',
    descripcion:
      'Pregunta cuánto sale hacerse Nanoblading (sesión, retoque, mantenimiento o consulta).',
    ejemplos: [
      'cuánto sale el nanoblading?',
      'precio del retoque de nanoblading',
      'valor del mantenimiento de cejas tatuadas',
    ],
    respuesta:
      'Estos son los valores de Nanoblading:\n\n{servicios:nanoblading}\n\n' +
      'Si nunca te hiciste cosmetic tattoo en cejas, primero va la consulta previa obligatoria. Reservás desde ' +
      WEB_TATTOO,
  },
  {
    clave: 'PRECIO_LIP_BLUSH',
    titulo: 'Precio del Lip Blush',
    descripcion:
      'Pregunta cuánto sale hacerse Lip Blush (sesión, retoque, mantenimiento o consulta).',
    ejemplos: [
      'cuánto sale el lip blush?',
      'precio de los labios',
      'valor del retoque de labios',
    ],
    respuesta:
      'Estos son los valores de Lip Blush:\n\n{servicios:lip blush}\n\n' +
      'Si nunca te hiciste cosmetic tattoo en labios, primero va la consulta previa obligatoria. Reservás desde ' +
      WEB_TATTOO,
  },
  {
    clave: 'PRECIO_LASHES_LINE',
    titulo: 'Precio del Lashes Line',
    descripcion:
      'Pregunta cuánto sale el Lashes Line / Lash Line (sesión, retoque, mantenimiento o consulta).',
    ejemplos: [
      'cuánto sale el lash line?',
      'precio del lashes line',
      'valor del delineado de pestañas',
    ],
    respuesta:
      'Estos son los valores de Lashes Line:\n\n{servicios:lashes line}\n\nReservás desde ' +
      WEB_TATTOO,
  },
  {
    clave: 'PRECIO_CAMUFLAJE',
    titulo: 'Precio del camuflaje',
    descripcion:
      'Pregunta cuánto sale un camuflaje de cejas, labios o pestañas (corregir un trabajo anterior).',
    ejemplos: [
      'cuánto sale el camuflaje?',
      'precio para corregir unas cejas tatuadas',
      'valor del lip camouflage',
    ],
    respuesta:
      'Estos son los valores de camuflaje:\n\n{servicios:camouflage|camuflaje}\n\n' +
      'Siempre arranca con una consulta previa obligatoria. Reservás desde ' +
      WEB_TATTOO,
  },
  {
    clave: 'PRECIO_PECAS',
    titulo: 'Pecas y lunares',
    descripcion:
      'Pregunta por pecas, lunares o freckles: si los hacen o cuánto salen.',
    ejemplos: ['hacen pecas?', 'cuánto salen las pecas?', 'tatuaje de lunares'],
    respuesta:
      'Sí, hacemos *pecas y lunares* (Freckles & Beauty Marks) ✨\n\n{servicios:pecas|freckles}\n\nReservás desde ' +
      WEB_TATTOO,
  },
  {
    clave: 'PARAMEDICO',
    titulo: 'Tatuaje paramédico',
    descripcion:
      'Pregunta por cicatrices, areola o pezón, alopecia / cuero cabelludo, epítesis o tatuaje paramédico.',
    ejemplos: [
      'tapan cicatrices?',
      'micropigmentación de areola',
      'hacen nano scalp?',
      'reconstrucción de pezón',
    ],
    respuesta:
      'Hacemos *tatuaje paramédico*: Scar Camouflage, Areola Harmonization, Nano Scalp y epítesis CAP. ' +
      'Siempre arranca con una consulta previa obligatoria, donde se evalúa tu caso:\n\n' +
      '{servicios:scar|areola|nano scalp|epitesis}\n\nReservás desde ' +
      WEB_TATTOO,
  },
  {
    clave: 'SENA',
    titulo: 'Seña al reservar',
    descripcion:
      'Pregunta si hay que pagar seña, cuánto es o cómo se paga el turno.',
    ejemplos: [
      'hay que pagar seña?',
      'cuánto es la seña?',
      'cómo pago el turno?',
      'la seña se descuenta?',
    ],
    respuesta:
      'Al reservar un turno desde la web se abona una *seña* online, que después se descuenta del valor del servicio. ' +
      'El valor de la seña de cada servicio lo ves al reservar en ' +
      WEB_TURNOS,
  },
  {
    clave: 'TURNO_CANCELAR',
    titulo: 'Cancelar un turno',
    descripcion:
      'Quiere cancelar un turno, no va a poder ir o pregunta por la devolución de la seña.',
    ejemplos: [
      'quiero cancelar mi turno',
      'no voy a poder ir',
      'me devuelven la seña?',
    ],
    respuesta:
      'Si lo que necesitás es cambiar la fecha, podés reprogramar vos misma desde la web con tu código de reserva, en "Gestionar mi reserva", hasta 48 h antes del turno. ' +
      'Para cancelar te ayuda recepción: ya te paso 💕',
    derivaAPersona: true,
  },

  // ─── El estudio ─────────────────────────────────────────────
  {
    clave: 'UBICACION',
    titulo: 'Dirección del estudio',
    descripcion: 'Pregunta dónde están, la dirección o cómo llegar.',
    ejemplos: [
      'dónde están?',
      'cuál es la dirección?',
      'en qué barrio están?',
      'cómo llego?',
    ],
    respuesta:
      'Estamos en *Av. Melián 3646 PB 1, CABA* 📍 Nuestro horario de atención es {horario}. Los turnos se reservan desde ' +
      WEB_TURNOS,
  },
  {
    clave: 'HORARIOS',
    titulo: 'Horario de atención',
    descripcion:
      'Pregunta qué horario tienen, qué días abren o hasta qué hora atienden.',
    ejemplos: [
      'qué horario tienen?',
      'abren los sábados?',
      'hasta qué hora atienden?',
    ],
    respuesta:
      'Nuestro horario de atención es {horario}. Los turnos se reservan desde la web, donde ves todas las disponibilidades: ' +
      WEB_TURNOS,
  },
  {
    clave: 'REDES',
    titulo: 'Instagram, web y trabajos',
    descripcion: 'Pide el Instagram, la web o dónde ver fotos de trabajos.',
    ejemplos: [
      'tienen instagram?',
      'dónde veo trabajos?',
      'cuál es la página?',
      'fotos de antes y después',
    ],
    respuesta:
      'Podés conocer más del estudio y de los trabajos de Mery en:\n' +
      '• Instagram: @merygarciaoficial (https://www.instagram.com/merygarciaoficial)\n' +
      '• Web: https://merygarcia.com.ar\n' +
      '• Turnos: ' +
      WEB_TURNOS,
  },
  {
    clave: 'QUIEN_ES_MERY',
    titulo: 'Quién es Mery García',
    descripcion: 'Pregunta quién es Mery, su trayectoria o su experiencia.',
    ejemplos: [
      'quién es Mery?',
      'cuánta experiencia tiene Mery?',
      'contame de Mery',
    ],
    respuesta:
      'Mery García es artista del tatuaje cosmético con más de 20 años de experiencia. Se formó como maquilladora profesional de moda, se especializó en estilismo de cejas y tiene una estética hiperrealista. ' +
      'Hoy se dedica 100% al tatuaje cosmético y lidera un equipo de artistas y estilistas formadas en su metodología. Su lema: "los detalles son todo" ✨',
  },
];

/** Agregadas en la tanda 4 (turnos). */
export const RESPUESTAS_V4: RespuestaSemilla[] = [
  {
    clave: 'TURNO_RESERVAR',
    titulo: 'Quiere sacar un turno / disponibilidad',
    descripcion:
      'Quiere sacar o reservar un turno, pregunta cómo reservar, si hay disponibilidad o turno para un día, o pide turno con Mery. Si ya dijo el servicio (ej. modelado, consulta de tattoo) va la clave de ese turno.',
    ejemplos: [
      'quiero un turno',
      'quiero un turno con Mery',
      'cómo saco turno?',
      'tienen turno para el sábado?',
      'hay disponibilidad esta semana?',
      'quiero reservar',
    ],
    respuesta:
      'Los turnos se reservan desde nuestra web, donde ves todas las disponibilidades en tiempo real y abonás la seña online 💕\n\n' +
      '• Estilismo de cejas y pestañas: ' +
      WEB_ESTILISMO +
      '\n• Cosmetic tattoo: ' +
      WEB_TATTOO +
      '\n\nLos servicios que hace Mery figuran como *By Mery García*. Si es tu primera vez con cosmetic tattoo, primero va la consulta previa obligatoria.',
  },
];
