/**
 * Estado de una charla.
 *
 *  - BOT:       responde el bot (clasifica y manda una respuesta de la tabla).
 *  - ESPERANDO: la clienta pidió una persona (o el bot no pudo) y nadie la tomó.
 *  - ATENDIDA:  alguien del equipo la tomó y contesta desde la web.
 *  - CERRADA:   terminada. El próximo mensaje de la clienta abre una charla nueva.
 */
export enum EstadoConversacion {
  BOT = 'BOT',
  ESPERANDO = 'ESPERANDO',
  ATENDIDA = 'ATENDIDA',
  CERRADA = 'CERRADA',
}

/** Por qué la charla salió del bot. */
export enum MotivoEspera {
  PIDIO_PERSONA = 'PIDIO_PERSONA',
  NO_ENTENDIO = 'NO_ENTENDIO',
  AUDIO = 'AUDIO',
  ARCHIVO = 'ARCHIVO',
  RESPUESTA_DERIVA = 'RESPUESTA_DERIVA',
  SEGURIDAD = 'SEGURIDAD',
  BOT_APAGADO = 'BOT_APAGADO',
  SIN_CLASIFICADOR = 'SIN_CLASIFICADOR',
}

export enum MotivoCierre {
  ATENDIDA = 'ATENDIDA',
  INACTIVIDAD = 'INACTIVIDAD',
}

export enum DireccionMensaje {
  ENTRANTE = 'ENTRANTE',
  SALIENTE = 'SALIENTE',
}

export enum AutorMensaje {
  CLIENTA = 'CLIENTA',
  BOT = 'BOT',
  OPERADOR = 'OPERADOR',
}

export enum TipoMensaje {
  TEXTO = 'TEXTO',
  AUDIO = 'AUDIO',
  IMAGEN = 'IMAGEN',
  DOCUMENTO = 'DOCUMENTO',
  /** Algo que no se procesa: video, sticker, ubicación, adjunto enorme. */
  OTRO = 'OTRO',
}

export enum EstadoEnvio {
  ENVIADO = 'ENVIADO',
  FALLIDO = 'FALLIDO',
}

export enum TipoNotificacion {
  /** Una charla nueva quedó esperando una persona. */
  ESPERANDO = 'ESPERANDO',
  /** Llegó un mensaje en una charla que atiende (o espera) una persona. */
  MENSAJE = 'MENSAJE',
}
