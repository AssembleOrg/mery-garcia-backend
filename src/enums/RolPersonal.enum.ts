export enum RolPersonal {
  ADMIN = 'admin',
  USER = 'user',
  ENCARGADO = 'encargado',
  /** Sólo ve el presentismo (equipo, horarios, pendientes, reportes). Nada más. */
  PRESENTISMO = 'presentismo',
  /** Personal de la estética: sólo pide productos de stock y ve sus solicitudes. */
  EMPLEADO = 'empleado',
}
