/**
 * Cantidad de un artículo = lo que llegó (renglones de compras entregadas que
 * afectan stock) − lo que usó el personal (pedidos aprobados) + ajustes.
 * Se calcula siempre; no hay un contador guardado que se pueda desfasar.
 */
export interface MovimientosArticulo {
  entradas: number;
  usado: number;
  ajustes: number;
  /** Tuvo alguna entrada o ajuste: sin eso no se lleva la cuenta. */
  controla: boolean;
}

export interface CantidadArticulo {
  /** Null = todavía no se lleva la cuenta de este artículo. */
  cantidad: number | null;
  /** Queda poco: 1 o 0, o el mínimo que le pusieron. */
  bajo: boolean;
}

export function cantidadArticulo(
  m: MovimientosArticulo,
  stockMinimo: number | null,
): CantidadArticulo {
  if (!m.controla) return { cantidad: null, bajo: false };
  const cantidad = m.entradas - m.usado + m.ajustes;
  const limite = Math.max(1, stockMinimo ?? 0);
  return { cantidad, bajo: cantidad <= limite };
}

/**
 * Ajuste que deja el artículo en lo contado. Se calcula contra la cuenta
 * completa (aunque todavía no se controle): si antes del primer conteo ya se
 * habían usado 3, el ajuste los compensa y queda justo lo contado.
 */
export function ajusteParaContado(
  m: MovimientosArticulo,
  contado: number,
): number {
  return contado - (m.entradas - m.usado + m.ajustes);
}
