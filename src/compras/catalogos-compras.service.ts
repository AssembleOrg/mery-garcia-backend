import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProveedorCompra } from './entities/ProveedorCompra.entity';
import { CategoriaCompra } from './entities/CategoriaCompra.entity';
import { ConfiguracionSistema } from '../config/entities/ConfiguracionSistema.entity';
import { CategoriaCompraDto, ProveedorCompraDto } from './dto/compras.dto';
import { claveNombre, limpiarNombre } from './reglas';

/** Las que propuso Charly para arrancar (después se editan libremente). */
export const CATEGORIAS_INICIALES = [
  'Estilismo',
  'Tatuaje cosmético',
  'Epítesis',
  'Descartables',
  'Mantenimiento',
];
const CLAVE_SEMBRADAS = 'compras.categoriasIniciales';

/** Proveedores y categorías de compras (alta, edición y baja). */
@Injectable()
export class CatalogosComprasService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogosComprasService.name);

  constructor(
    @InjectRepository(ProveedorCompra)
    private readonly proveedores: Repository<ProveedorCompra>,
    @InjectRepository(CategoriaCompra)
    private readonly categorias: Repository<CategoriaCompra>,
    @InjectRepository(ConfiguracionSistema)
    private readonly config: Repository<ConfiguracionSistema>,
  ) {}

  /** Carga las categorías iniciales una sola vez (si las borran, no vuelven). */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.sembrarCategorias();
    } catch (err) {
      this.logger.error(
        `No pude cargar las categorías iniciales: ${String(err)}`,
      );
    }
  }

  async sembrarCategorias(): Promise<void> {
    const hecho = await this.config.findOne({
      where: { clave: CLAVE_SEMBRADAS },
    });
    if (hecho) return;
    if ((await this.categorias.count()) === 0) {
      await this.categorias.save(
        CATEGORIAS_INICIALES.map((nombre, i) =>
          this.categorias.create({ nombre, orden: (i + 1) * 10 }),
        ),
      );
    }
    await this.config.save(
      this.config.create({
        clave: CLAVE_SEMBRADAS,
        valor: new Date().toISOString(),
        descripcion: 'Categorías de compras iniciales ya cargadas',
      }),
    );
  }

  // ─── Proveedores ─────────────────────────────────────────────

  listarProveedores(buscar?: string): Promise<ProveedorCompra[]> {
    const q = this.proveedores
      .createQueryBuilder('p')
      .orderBy('lower(p.nombre)', 'ASC');
    if (buscar?.trim())
      q.where('(p.nombre ILIKE :b OR p.documento ILIKE :b)', {
        b: `%${buscar.trim()}%`,
      });
    return q.getMany();
  }

  async crearProveedor(dto: ProveedorCompraDto): Promise<ProveedorCompra> {
    const nombre = limpiarNombre(dto.nombre);
    await this.proveedorNoRepetido(nombre);
    return this.proveedores.save(
      this.proveedores.create({ ...this.datosProveedor(dto), nombre }),
    );
  }

  async actualizarProveedor(
    id: string,
    dto: ProveedorCompraDto,
  ): Promise<ProveedorCompra> {
    const p = await this.proveedores.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Proveedor no encontrado');
    const nombre = limpiarNombre(dto.nombre);
    await this.proveedorNoRepetido(nombre, id);
    Object.assign(p, this.datosProveedor(dto), { nombre });
    return this.proveedores.save(p);
  }

  /** Lo esconde: los pedidos que ya lo tenían lo siguen mostrando. */
  async eliminarProveedor(id: string): Promise<void> {
    const r = await this.proveedores.softDelete(id);
    if (!r.affected) throw new NotFoundException('Proveedor no encontrado');
  }

  private datosProveedor(dto: ProveedorCompraDto) {
    return {
      documento: dto.documento?.trim() || null,
      telefono: dto.telefono?.trim() || null,
      email: dto.email?.trim() || null,
      notas: dto.notas?.trim() || null,
    };
  }

  private async proveedorNoRepetido(nombre: string, salvoId?: string) {
    const todos = await this.proveedores.find({
      select: { id: true, nombre: true },
    });
    const clave = claveNombre(nombre);
    if (todos.some((p) => p.id !== salvoId && claveNombre(p.nombre) === clave))
      throw new ConflictException(`Ya hay un proveedor "${nombre}".`);
  }

  // ─── Categorías ──────────────────────────────────────────────

  listarCategorias(): Promise<CategoriaCompra[]> {
    return this.categorias
      .createQueryBuilder('c')
      .orderBy('c.orden', 'ASC')
      .addOrderBy('lower(c.nombre)', 'ASC')
      .getMany();
  }

  async crearCategoria(dto: CategoriaCompraDto): Promise<CategoriaCompra> {
    const nombre = limpiarNombre(dto.nombre);
    await this.categoriaNoRepetida(nombre);
    const orden =
      dto.orden ??
      ((
        await this.categorias
          .createQueryBuilder('c')
          .select('coalesce(max(c.orden), 0)', 'max')
          .getRawOne<{ max: number }>()
      )?.max ?? 0) + 10;
    return this.categorias.save(this.categorias.create({ nombre, orden }));
  }

  async actualizarCategoria(
    id: string,
    dto: CategoriaCompraDto,
  ): Promise<CategoriaCompra> {
    const c = await this.categorias.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Categoría no encontrada');
    const nombre = limpiarNombre(dto.nombre);
    await this.categoriaNoRepetida(nombre, id);
    c.nombre = nombre;
    if (dto.orden !== undefined) c.orden = dto.orden;
    return this.categorias.save(c);
  }

  /** La saca también de los renglones que la tenían. */
  async eliminarCategoria(id: string): Promise<void> {
    const r = await this.categorias.delete(id);
    if (!r.affected) throw new NotFoundException('Categoría no encontrada');
  }

  private async categoriaNoRepetida(nombre: string, salvoId?: string) {
    const todas = await this.categorias.find({
      select: { id: true, nombre: true },
    });
    const clave = claveNombre(nombre);
    if (todas.some((c) => c.id !== salvoId && claveNombre(c.nombre) === clave))
      throw new ConflictException(`Ya hay una categoría "${nombre}".`);
  }
}
