export enum TipoAccion {
    // Usuarios
    USUARIO_CREADO = 'usuario_creado',
    USUARIO_MODIFICADO = 'usuario_modificado',
    USUARIO_ELIMINADO = 'usuario_eliminado',
    USUARIO_LOGIN = 'usuario_login',
    USUARIO_LOGOUT = 'usuario_logout',
  
    // Cajas
    CAJA_MOVIMIENTO = 'caja_movimiento',
    CAJA_TRANSFERENCIA = 'caja_transferencia',
    CAJA_BALANCE_CONSULTADO = 'caja_balance_consultado',
  
    // Comandas
    COMANDA_CREADA = 'comanda_creada',
    COMANDA_MODIFICADA = 'comanda_modificada',
    COMANDA_ELIMINADA = 'comanda_eliminada',
    COMANDA_COMPLETADA = 'comanda_completada',
    COMANDA_RESTAURADA = 'comanda_restaurada',
  
    // Clientes
    CLIENTE_CREADO = 'cliente_creado',
    CLIENTE_MODIFICADO = 'cliente_modificado',
    CLIENTE_ELIMINADO = 'cliente_eliminado',
  
    // Prepagos
    PREPAGO_CREADO = 'prepago_creado',
    PREPAGO_MODIFICADO = 'prepago_modificado',
    PREPAGO_ELIMINADO = 'prepago_eliminado',
  
    // Comisiones
    COMISION_CREADA = 'comision_creada',
    COMISION_MODIFICADA = 'comision_modificada',
    COMISION_ELIMINADA = 'comision_eliminada',
  }