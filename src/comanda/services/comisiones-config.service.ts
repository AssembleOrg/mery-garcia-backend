import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Trabajador } from '../../personal/entities/Trabajador.entity';
import { CategoriaServicio } from '../entities/categoriaServicio.entity';
import { ComisionBase } from '../entities/comisionBase.entity';
import { ComisionPorcentajeMes } from '../entities/comisionPorcentajeMes.entity';
import { ActualizarEsquemaComisionDto, ConfirmarPorcentajeMesDto } from '../dto/comisiones-config.dto';
import { EsquemaTrabajadora } from '../comisiones/reglas';

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Configuración de comisiones por base fija: bases por categoría, rango y porcentaje confirmado por mes. */
@Injectable()
export class ComisionesConfigService {
  constructor(
    @InjectRepository(Trabajador) private readonly trabajadores: Repository<Trabajador>,
    @InjectRepository(CategoriaServicio) private readonly categorias: Repository<CategoriaServicio>,
    @InjectRepository(ComisionBase) private readonly bases: Repository<ComisionBase>,
    @InjectRepository(ComisionPorcentajeMes) private readonly meses: Repository<ComisionPorcentajeMes>,
    private readonly dataSource: DataSource,
  ) {}

  async obtener() {
    const [trabajadores, categorias, bases, meses] = await Promise.all([
      this.trabajadores.find({ where: { activo: true }, order: { nombre: 'ASC' } }),
      this.categorias.find({ order: { orden: 'ASC', nombre: 'ASC' } }),
      this.bases.find(),
      this.meses.find({ order: { mes: 'DESC' } }),
    ]);
    const nombreCat = new Map(categorias.map((c) => [c.id, c.nombre]));
    return {
      categorias: categorias.map((c) => ({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, orden: c.orden })),
      trabajadores: trabajadores.map((t) => ({
        id: t.id,
        nombre: t.nombre,
        porcentajeMin: t.comisionPorcentaje,
        porcentajeMax: t.comisionPorcentajeMax,
        productosPorcentaje: t.comisionProductosPorcentaje,
        baseDesde: t.comisionBaseDesde,
        bases: bases
          .filter((b) => b.trabajadorId === t.id)
          .map((b) => ({ categoriaId: b.categoriaId, categoria: nombreCat.get(b.categoriaId) ?? null, montoBase: b.montoBase })),
        meses: meses.filter((m) => m.trabajadorId === t.id).map((m) => ({ mes: m.mes, porcentaje: m.porcentaje, nota: m.nota })),
      })),
    };
  }

  async actualizarEsquema(trabajadorId: string, dto: ActualizarEsquemaComisionDto) {
    const t = await this.trabajadores.findOne({ where: { id: trabajadorId } });
    if (!t) throw new NotFoundException('Trabajador no encontrado');
    const min = dto.porcentajeMin ?? t.comisionPorcentaje;
    const max = dto.porcentajeMax === undefined ? t.comisionPorcentajeMax : dto.porcentajeMax;
    if (max != null && max < min) throw new BadRequestException('El tope del rango no puede ser menor al mínimo');
    if (dto.bases) {
      const ids = [...new Set(dto.bases.map((b) => b.categoriaId))];
      if (ids.length !== dto.bases.length) throw new BadRequestException('Hay categorías repetidas');
      const existen = ids.length ? await this.categorias.count({ where: { id: In(ids) } }) : 0;
      if (existen !== ids.length) throw new BadRequestException('Alguna categoría no existe');
    }
    await this.dataSource.transaction(async (m) => {
      await m.update(Trabajador, trabajadorId, {
        comisionPorcentaje: min,
        comisionPorcentajeMax: max,
        ...(dto.productosPorcentaje !== undefined && { comisionProductosPorcentaje: dto.productosPorcentaje }),
        ...(dto.baseDesde !== undefined && { comisionBaseDesde: dto.baseDesde ? dto.baseDesde.slice(0, 10) : null }),
      });
      if (dto.bases) {
        await m.delete(ComisionBase, { trabajadorId });
        if (dto.bases.length) {
          await m.insert(
            ComisionBase,
            dto.bases.map((b) => ({ trabajadorId, categoriaId: b.categoriaId, montoBase: b.montoBase })),
          );
        }
      }
    });
    return this.obtener();
  }

  async confirmarMes(trabajadorId: string, mes: string, dto: ConfirmarPorcentajeMesDto) {
    if (!MES.test(mes)) throw new BadRequestException('Mes inválido (YYYY-MM)');
    const t = await this.trabajadores.findOne({ where: { id: trabajadorId } });
    if (!t) throw new NotFoundException('Trabajador no encontrado');
    await this.meses.upsert(
      { trabajadorId, mes, porcentaje: dto.porcentaje, nota: dto.nota ?? null },
      ['trabajadorId', 'mes'],
    );
    return this.obtener();
  }

  async quitarMes(trabajadorId: string, mes: string) {
    await this.meses.delete({ trabajadorId, mes });
    return this.obtener();
  }

  /** Esquemas vigentes (trabajadoras con fecha de inicio), para el cálculo de comisiones. */
  async esquemas(): Promise<Map<string, EsquemaTrabajadora>> {
    const ts = await this.trabajadores
      .createQueryBuilder('t')
      .where('t.comisionBaseDesde IS NOT NULL')
      .getMany();
    const out = new Map<string, EsquemaTrabajadora>();
    if (!ts.length) return out;
    const ids = ts.map((t) => t.id);
    const [bases, meses] = await Promise.all([
      this.bases.find({ where: { trabajadorId: In(ids) } }),
      this.meses.find({ where: { trabajadorId: In(ids) } }),
    ]);
    for (const t of ts) {
      out.set(t.id, {
        porcentajeMin: Number(t.comisionPorcentaje ?? 0),
        porcentajeMax: t.comisionPorcentajeMax != null ? Number(t.comisionPorcentajeMax) : null,
        productosPorcentaje: Number(t.comisionProductosPorcentaje ?? 0),
        desde: String(t.comisionBaseDesde).slice(0, 10),
        bases: new Map(bases.filter((b) => b.trabajadorId === t.id).map((b) => [b.categoriaId, Number(b.montoBase)])),
        confirmados: new Map(meses.filter((m) => m.trabajadorId === t.id).map((m) => [m.mes, Number(m.porcentaje)])),
      });
    }
    return out;
  }
}
