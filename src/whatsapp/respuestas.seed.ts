/**
 * Preguntas y respuestas iniciales, tal cual el documento de Mery
 * ("PREGUNTAS BOT"). Se cargan una sola vez, cuando la tabla está vacía;
 * después se editan desde Configuración > WhatsApp.
 */
export interface RespuestaSemilla {
  clave: string;
  titulo: string;
  descripcion: string;
  ejemplos: string[];
  respuesta: string;
  derivaAPersona?: boolean;
}

const WEB_ESTILISMO = 'https://merygarciabooking.com/estilismo-de-cejas/';
const WEB_TATTOO = 'https://merygarciabooking.com/tattoo-cosmetico/';

export const RESPUESTAS_SEMILLA: RespuestaSemilla[] = [
  {
    clave: 'SALUDO',
    titulo: 'Saludo sin consulta',
    descripcion: 'Sólo saluda (hola, buenas, buen día) sin preguntar nada todavía.',
    ejemplos: ['hola', 'buenas!', 'hola, buen día', 'holaa cómo estás'],
    respuesta: 'Hola! Como estas? 💕 ¿En qué te puedo ayudar?',
  },
  {
    clave: 'GRACIAS',
    titulo: 'Agradecimiento o cierre',
    descripcion: 'Agradece o cierra la charla (gracias, dale, perfecto, ok, listo) sin una consulta nueva.',
    ejemplos: ['gracias!', 'dale, perfecto', 'ok genial', 'listo, muchas gracias'],
    respuesta: '¡De nada! 💕 Cualquier otra consulta, acá estamos.',
  },
  {
    clave: 'NANOBLADING_QUE_ES',
    titulo: '¿Qué es el Nanoblading?',
    descripcion: 'Pregunta qué es el nanoblading o en qué consiste (información, no pide turno).',
    ejemplos: ['Hola. Que es Nanoblading?', 'en qué consiste el nanoblading?', 'qué es el nano?'],
    respuesta:
      'Hola! Como estas? 💕\n' +
      'El Nanoblading es la técnica más avanzada de cosmetic tattoo de cejas. Permite lograr mayor hiper realismo, un acabado imperceptible, mayor durabilidad y vibración del color.',
  },
  {
    clave: 'CAMUFLAJE_QUE_ES',
    titulo: '¿Qué es el camuflaje?',
    descripcion: 'Pregunta qué es el camuflaje o corrección de un tatuaje de cejas viejo o mal hecho.',
    ejemplos: ['Hola, que es el camuflaje?', 'hacen corrección de microblading viejo?', 'tengo las cejas tatuadas mal, se puede arreglar?'],
    respuesta:
      'Hola! Como estas? 💕\n' +
      'Es un servicio que combina despigmentación, corrección de color, textura y estructura para MEJORAR EL ASPECTO de un trabajo mal hecho o deteriorado tanto de Dermopigmentación como de Microblading.',
  },
  {
    clave: 'CEJAS_PRIMERA_VEZ',
    titulo: 'Nunca se hizo las cejas, pide recomendación',
    descripcion: 'Nunca se hizo nada en las cejas y pregunta qué le recomendamos o por dónde empezar.',
    ejemplos: ['Quiero hacerme las cejas, nunca me hice. Que me recomendas?', 'nunca me hice nada en las cejas, por dónde arranco?'],
    respuesta:
      'Hola! como estas? ❤️\n' +
      'Idealmente lo que recomendamos es que tomes desde nuestra web un turno para modelado de cejas, que es la depilacion, darle forma y demas. Y de ese modo, ya teniendo un espacio, nuestras estilistas te pueden recomendar que otro servicio seria ideal realizar en tus cejas. Te dejo el link de nuestra web\n' +
      WEB_ESTILISMO,
  },
  {
    clave: 'TURNO_REPROGRAMAR',
    titulo: 'Reprogramar o cambiar un turno',
    descripcion: 'Ya tiene un turno y quiere cambiarlo, reprogramarlo, moverlo de día u horario, o pide disponibilidades para cambiarlo.',
    ejemplos: ['Como puedo reprogramar un turno?', 'hola, tengo un turno tal dia y quiero cambiarlo. Me pasas disponibilidades?', 'necesito mover mi turno'],
    respuesta:
      'Hola! Si necesitás reprogramar tu turno, podés hacerlo vos misma desde nuestra web utilizando el código de reserva que recibiste por mail al momento de agendar.\n' +
      'Solo ingresá a la opción "Gestionar mi reserva", colocá ese código y vas a poder cambiar la fecha y el horario según la disponibilidad.\n' +
      'Si no encontrás el correo o necesitás una mano, escribinos y con gusto te ayudamos. 💕',
  },
  {
    clave: 'TATTOO_CONSULTA_TURNO',
    titulo: 'Turno para consulta de cosmetic tattoo',
    descripcion: 'Quiere sacar turno para la consulta previa de cosmetic tattoo (sin decir qué servicio, o ya sabiendo que es la consulta).',
    ejemplos: ['Hola, quiero sacar turno para consulta', 'cómo saco turno para la consulta?', 'cosmetic tattoo', 'la de tattoo'],
    respuesta:
      'Hola! como estas? 💖 Los turnos de consulta se reservan unicamente por nuestra web,\n' +
      'Te dejo el link para que puedas entrar y ver nuestras disponibilidades de consultas previas.\n' +
      WEB_TATTOO,
  },
  {
    clave: 'NANOBLADING_QUIERO',
    titulo: 'Quiere hacerse Nanoblading (cómo hacer)',
    descripcion: 'Quiere hacerse nanoblading (o cejas con Mery, cosmetic tattoo de cejas) y pregunta cómo hacer, precio o turno.',
    ejemplos: ['hola, quiero hacerme nanoblading con Mery', 'cuánto sale el nanoblading?', 'quiero turno para nanoblading'],
    respuesta:
      'Hola! como estas? 💖\n' +
      'Si nunca te realizaste ningun servicio de cosmetic tattoo en cejas, lo primero que debes hacer es tomar un turno de consulta OBLIGATORIA previa. En esa consulta te van a saber explicar bien de que trata el servicio, cuidados, valores y te van a realizar un maquillaje personalizado hiperrealista de como quedaría el servicio de Nanoblading.\n\n' +
      'El valor de la consulta es de $80.000 y los turnos se toman únicamente por nuestra web ' +
      WEB_TATTOO +
      ' (Consulta obligatoria SIN trabajo previo). Por el momento los unicos dias de consulta son Martes y Jueves a las 12hs.',
  },
  {
    clave: 'MICROBLADING',
    titulo: 'Pide Microblading',
    descripcion: 'Pregunta por microblading o quiere hacerse microblading.',
    ejemplos: ['buenas, quiero hacerme microblading con mery', 'hacen microblading?'],
    respuesta:
      'Hola! como estas?\n' +
      'La tecnica que realiza Mery actualmente es Nanoblading. No realizamos mas Microblading',
  },
  {
    clave: 'INTERIOR_EXTERIOR',
    titulo: 'Es del interior o del exterior',
    descripcion: 'Vive fuera de Buenos Aires (interior del país o exterior) y quiere atenderse con Mery o venir por un servicio.',
    ejemplos: ['Soy del interior/exterior y quiero atenderme con Mery', 'soy de Córdoba, puedo hacer consulta y servicio el mismo día?', 'vivo en Uruguay y quiero venir'],
    respuesta:
      'Hola! ¿Cómo estás? 💖\n' +
      'Entiendo! Te cuento, primero antes de realizar un servicio de cosmetic tattoo, es necesario concurrir a una consulta previa obligatoria, pero al no ser de Bs As, te podemos ofrecer lo siguiente. Mery cuenta con una agenda Special Pass, pensada especialmente para clientas que vienen del interior o del exterior. Son disponibilidades exclusivas que también contemplan honorarios diferenciales.\n\n' +
      'En estos casos, y de manera excepcional, es posible realizar la consulta y el servicio el mismo día ✨\n\n' +
      'Primero voy a enviarte el consentimiento informado para que puedas leerlo con atención, especialmente la parte de cuidados posteriores (son muy importantes).\n' +
      'Una vez que lo leas, te comparto los valores del servicio y, si estás de acuerdo, coordinamos tu turno 💕',
    derivaAPersona: true,
  },
  {
    clave: 'REFILL_QUE_ES',
    titulo: '¿Qué es el Refill?',
    descripcion: 'Pregunta qué es el refill o brow refill (tinte de cejas).',
    ejemplos: ['hola te hago una consulta. Que es refill?', 'en qué consiste el brow refill?'],
    respuesta:
      'Hola! como estas?\n' +
      'El refill es un tinte superficial, que tiñe la piel de tus cejas creando así un efecto de densidad, hiper pobladas y realistas. La duración es de aproximadamente 20 días.',
  },
  {
    clave: 'HENNA',
    titulo: '¿Hacen henna?',
    descripcion: 'Pregunta si hacen henna en cejas.',
    ejemplos: ['hola, Hacen henna?', 'hacen cejas con henna?'],
    respuesta: 'Hola! como estas? 💖\nNo, no realizamos henna. Unicamente Brow Refill.',
  },
  {
    clave: 'LAMINADO_QUE_ES',
    titulo: '¿Qué es el laminado?',
    descripcion: 'Pregunta qué es o en qué consiste el laminado de cejas.',
    ejemplos: ['hola, quiero hacerme el laminado. En que consiste?', 'qué es el laminado de cejas?'],
    respuesta:
      'Hola! como estas?? 💖\n' +
      'El laminado de cejas es un alisado químico que permite poder disciplinar tus cejas.',
  },
  {
    clave: 'CEJAS_TURNO_PERFILADO',
    titulo: 'Turno para perfilado / modelado de cejas',
    descripcion: 'Quiere turno para perfilado, modelado, diseño o depilación de cejas (estilismo, no tatuaje).',
    ejemplos: ['Hola, quiero turno para perfilado de cejas', 'turno para modelado de cejas', 'estilismo de cejas', 'la primera opción, estilismo'],
    respuesta:
      'Hola! 💖\n' +
      'entiendo! Sería modelado de cejas. Podes reservar tu cita desde nuestra web, ahí mismo vas a poder acceder a todas nuestras disponibilidades. Te dejo el link\n' +
      WEB_ESTILISMO,
  },
  {
    clave: 'LIP_BLUSH_QUIERO',
    titulo: 'Quiere hacerse Lip Blush (cómo hacer)',
    descripcion: 'Quiere hacerse lip blush (labios) y pregunta cómo hacer, precio o turno.',
    ejemplos: ['hola, Quiero hacerme lip blush, como tengo que hacer?', 'cuánto sale el lip blush?', 'quiero turno para labios'],
    respuesta:
      'Hola! buenas ❤️\n' +
      'Si nunca te realizaste ningun servicio de cosmetic tattoo en labios, lo primero que debes hacer es tomar un turno de consulta OBLIGATORIA previa. En esa consulta te van a saber explicar bien de que trata el servicio, cuidados, valores y te van a realizar un maquillaje personalizado hiperrealista de como quedaría el servicio de Lip Blush.\n\n' +
      'El valor de la consulta es de $50.000 y los turnos se toman únicamente por nuestra web ' +
      WEB_TATTOO +
      ' (Consulta obligatoria SIN trabajo previo). Por el momento los unicos dias de consulta son los viernes a las 12hs.',
  },
  {
    clave: 'LABIOS_DELINEADO',
    titulo: '¿Hacen delineado de labios?',
    descripcion: 'Pregunta si hacen delineado de labios o contorno de labios.',
    ejemplos: ['Hola. Hacen delinado de labios?', 'hacen contorno de labios?'],
    respuesta:
      'Hola! como estas? 💖\n' +
      'No, lo que realizamos es un servicio llamado Lip Blush. Consiste en darle un color a los labios, respetando la colorimetría natural de la persona. No buscamos dar un efecto de maquillaje, sino de boca ruborizada. No da brillo. Sin polvo, sin textura, como si el labio tuviese color.',
  },
  {
    clave: 'OJOS_DELINEADO',
    titulo: '¿Hacen delineado semipermanente de ojos?',
    descripcion: 'Pregunta si hacen delineado de ojos semipermanente o tatuado.',
    ejemplos: ['hola, Hacen delineado semi permanente?', 'hacen delineado de ojos tatuado?'],
    respuesta:
      'Hola! como estas? ❤️\n' +
      'No, no realizamos. El servicio que tenemos es Lash Line, no simulamos un ojo delineado, sino un efecto óptico de mayor volumen y densidad.',
  },
  {
    clave: 'CEJAS_TURNO_GENERICO',
    titulo: 'Turno para cejas (sin especificar)',
    descripcion: 'Pide turno para cejas sin decir si es estilismo (perfilado) o cosmetic tattoo. Se le pregunta cuál.',
    ejemplos: ['hola, quiero pedir turno para cejas', 'quiero turno para las cejas', 'me pasás turnos para cejas?'],
    respuesta:
      'Hola! como estas? 💕\n' +
      'entiendo. Sobre que te gustaria consultar, Estilismo de Cejas o Cosmetic Tattoo?',
  },
];
