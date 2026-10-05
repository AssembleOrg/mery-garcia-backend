import { BadRequestException } from '@nestjs/common';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
} from 'pdf-lib';

export interface ImagenPagina {
  datos: Buffer;
  mimeType: 'image/jpeg' | 'image/png';
}

/** Tope de la API de Claude por imagen. */
const MAX_IMAGEN_BYTES = 5 * 1024 * 1024;

const esJpeg = (b: Uint8Array) =>
  b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
const esPng = (b: Uint8Array) =>
  b.length > 8 &&
  b[0] === 0x89 &&
  b[1] === 0x50 &&
  b[2] === 0x4e &&
  b[3] === 0x47;

/**
 * Saca la imagen de cada página de un PDF escaneado. Adobe Scan guarda cada
 * hoja como un único JPEG: se toma tal cual (sin volver a renderizar, así no
 * se pierde calidad y no hace falta ninguna herramienta en el servidor).
 * Si una página no trae un JPEG (PDF generado de otra forma), se pide subir
 * las fotos como imágenes.
 */
export async function imagenesDePdf(pdf: Buffer): Promise<ImagenPagina[]> {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(pdf, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  } catch {
    throw new BadRequestException('No se pudo abrir el PDF.');
  }
  const SUBTYPE = PDFName.of('Subtype'),
    IMAGE = PDFName.of('Image'),
    FORM = PDFName.of('Form');
  const FILTER = PDFName.of('Filter'),
    DCT = PDFName.of('DCTDecode'),
    XOBJECT = PDFName.of('XObject');
  const RESOURCES = PDFName.of('Resources');

  /** El JPEG más grande dentro de un diccionario de recursos (entra en Form XObjects). */
  const buscar = (
    recursos: PDFDict | undefined,
    profundidad = 0,
  ): { bytes: Uint8Array; area: number } | null => {
    const xobjs = recursos?.lookupMaybe(XOBJECT, PDFDict);
    if (!xobjs || profundidad > 3) return null;
    let mejor: { bytes: Uint8Array; area: number } | null = null;
    for (const [, ref] of xobjs.entries()) {
      const obj = doc.context.lookup(ref);
      if (!(obj instanceof PDFRawStream)) continue;
      const tipo = obj.dict.lookup(SUBTYPE);
      if (tipo === FORM) {
        const r = buscar(
          obj.dict.lookupMaybe(RESOURCES, PDFDict),
          profundidad + 1,
        );
        if (r && (!mejor || r.area > mejor.area)) mejor = r;
        continue;
      }
      if (tipo !== IMAGE) continue;
      const filtro = obj.dict.lookup(FILTER);
      const dct =
        filtro === DCT ||
        (filtro instanceof PDFArray &&
          filtro.size() === 1 &&
          filtro.lookup(0) === DCT);
      if (!dct || !esJpeg(obj.contents)) continue;
      const w =
        obj.dict.lookupMaybe(PDFName.of('Width'), PDFNumber)?.asNumber() ?? 0;
      const h =
        obj.dict.lookupMaybe(PDFName.of('Height'), PDFNumber)?.asNumber() ?? 0;
      if (!mejor || w * h > mejor.area)
        mejor = { bytes: obj.contents, area: w * h };
    }
    return mejor;
  };

  const paginas: ImagenPagina[] = [];
  doc.getPages().forEach((page, i) => {
    const img = buscar(page.node.Resources());
    if (!img) {
      throw new BadRequestException(
        `La página ${i + 1} del PDF no tiene una foto JPEG. Subí las fotos como imágenes (JPG o PNG).`,
      );
    }
    paginas.push({ datos: Buffer.from(img.bytes), mimeType: 'image/jpeg' });
  });
  return paginas;
}

/** Valida una imagen suelta (foto de una comanda). */
export function imagenSuelta(datos: Buffer, nombre: string): ImagenPagina {
  if (esJpeg(datos)) return { datos, mimeType: 'image/jpeg' };
  if (esPng(datos)) return { datos, mimeType: 'image/png' };
  throw new BadRequestException(`"${nombre}": sólo PDF, JPG o PNG.`);
}

export function validarTamano(p: ImagenPagina, etiqueta: string) {
  if (p.datos.length > MAX_IMAGEN_BYTES) {
    throw new BadRequestException(
      `${etiqueta} pesa más de 5 MB: bajale la resolución o escaneala de nuevo.`,
    );
  }
}
