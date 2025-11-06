export enum TipoAccion {
    // Usuarios
    USUARIO_CREADO = 'usuario_creado',
    USUARIO_MODIFICADO = 'usuario_modificado',
    USUARIO_ELIMINADO = 'usuario_eliminado',
    USUARIO_LOGIN = 'usuario_login',
    USUARIO_LOGOUT = 'usuario_logout',
    USUARIO_RESTAURADO = 'usuario_restaurado',
  
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
    COMANDA_ESTADO_CAMBIADO = 'comanda_estado_cambiado',
  
    // Clientes
    CLIENTE_CREADO = 'cliente_creado',
    CLIENTE_MODIFICADO = 'cliente_modificado',
    CLIENTE_ELIMINADO = 'cliente_eliminado',
    CLIENTE_RESTAURADO = 'cliente_restaurado',
  
    // Prepagos
    PREPAGO_CREADO = 'prepago_creado',
    PREPAGO_MODIFICADO = 'prepago_modificado',
    PREPAGO_ELIMINADO = 'prepago_eliminado',
    PREPAGO_RESTAURADO = 'prepago_restaurado',
    PREPAGO_GUARDADO_CREADO = 'prepago_guardado_creado',
    PREPAGO_GUARDADO_MODIFICADO = 'prepago_guardado_modificado',
    PREPAGO_GUARDADO_ELIMINADO = 'prepago_guardado_eliminado',
    PREPAGO_GUARDADO_RESTAURADO = 'prepago_guardado_restaurado',
  
    // Comisiones
    COMISION_CREADA = 'comision_creada',
    COMISION_MODIFICADA = 'comision_modificada',
    COMISION_ELIMINADA = 'comision_eliminada',
    COMISION_RESTAURADA = 'comision_restaurada',
  
    // Personal/Trabajadores
    PERSONAL_CREADO = 'personal_creado',
    PERSONAL_MODIFICADO = 'personal_modificado',
    PERSONAL_ELIMINADO = 'personal_eliminado',
    PERSONAL_RESTAURADO = 'personal_restaurado',
    TRABAJADOR_CREADO = 'trabajador_creado',
    TRABAJADOR_MODIFICADO = 'trabajador_modificado',
    TRABAJADOR_ELIMINADO = 'trabajador_eliminado',
    TRABAJADOR_RESTAURADO = 'trabajador_restaurado',
  
    // Items de Comanda
    ITEM_COMANDA_CREADO = 'item_comanda_creado',
    ITEM_COMANDA_MODIFICADO = 'item_comanda_modificado',
    ITEM_COMANDA_ELIMINADO = 'item_comanda_eliminado',
    ITEM_COMANDA_RESTAURADO = 'item_comanda_restaurado',
  
    // Movimientos
    MOVIMIENTO_CREADO = 'movimiento_creado',
    MOVIMIENTO_MODIFICADO = 'movimiento_modificado',
    MOVIMIENTO_ELIMINADO = 'movimiento_eliminado',
    MOVIMIENTO_RESTAURADO = 'movimiento_restaurado',
  
    // Productos/Servicios
    PRODUCTO_SERVICIO_CREADO = 'producto_servicio_creado',
    PRODUCTO_SERVICIO_MODIFICADO = 'producto_servicio_modificado',
    PRODUCTO_SERVICIO_ELIMINADO = 'producto_servicio_eliminado',
    PRODUCTO_SERVICIO_RESTAURADO = 'producto_servicio_restaurado',
  
    // Tipos de Item
    TIPO_ITEM_CREADO = 'tipo_item_creado',
    TIPO_ITEM_MODIFICADO = 'tipo_item_modificado',
    TIPO_ITEM_ELIMINADO = 'tipo_item_eliminado',
    TIPO_ITEM_RESTAURADO = 'tipo_item_restaurado',
  
    // Unidades de Negocio
    UNIDAD_NEGOCIO_CREADA = 'unidad_negocio_creada',
    UNIDAD_NEGOCIO_MODIFICADA = 'unidad_negocio_modificada',
    UNIDAD_NEGOCIO_ELIMINADA = 'unidad_negocio_eliminada',
    UNIDAD_NEGOCIO_RESTAURADA = 'unidad_negocio_restaurada',
  
    // Egresos
    EGRESO_CREADO = 'egreso_creado',
    EGRESO_MODIFICADO = 'egreso_modificado',
    EGRESO_ELIMINADO = 'egreso_eliminado',
    EGRESO_RESTAURADO = 'egreso_restaurado',

    // Métodos de Pago
    METODO_PAGO_CREADO = 'metodo_pago_creado',
    METODO_PAGO_MODIFICADO = 'metodo_pago_modificado',
    METODO_PAGO_ELIMINADO = 'metodo_pago_eliminado',
    METODO_PAGO_RESTAURADO = 'metodo_pago_restaurado',

    // Descuentos
    DESCUENTO_CREADO = 'descuento_creado',
    DESCUENTO_MODIFICADO = 'descuento_modificado',
    DESCUENTO_ELIMINADO = 'descuento_eliminado',
    DESCUENTO_RESTAURADO = 'descuento_restaurado',

    // Configuración
    CONFIG_MODIFICADA = 'config_modificada',
    CONFIG_CREADA = 'config_creada',
    CONFIG_ELIMINADA = 'config_eliminada',
    DOLAR_ACTUALIZADO = 'dolar_actualizado',
  
    // Sistema
    DATABASE_CLEANUP = 'database_cleanup',
    SISTEMA_BACKUP = 'sistema_backup',
    SISTEMA_RESTORE = 'sistema_restore',
  }