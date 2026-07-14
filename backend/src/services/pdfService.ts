import { getDetencionesByReporteId } from "./detencionService.js";
import { getReporteById, getReporteResumen } from "./reporteService.js";
import { getCajasByReporteId } from "./cajaService.js";

type PdfFont = "regular" | "bold";

type TableColumn<T> = {
  label: string;
  width: number;
  value: (row: T) => string | number | null | undefined;
};

type PdfImage = {
  name: string;
  width: number;
  height: number;
  data: Uint8Array;
  filter: "DCTDecode" | "FlateDecode";
  decodeParms?: string;
};

const page = {
  width: 595.28,
  height: 841.89,
  margin: 34,
  bottom: 42
};

const contentWidth = page.width - page.margin * 2;

function sanitizeText(value: string | number | null | undefined) {
  if (value === null || typeof value === "undefined" || value === "") return "-";
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, " ");
}

function escapePdfText(value: string) {
  return sanitizeText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function percentValue(value: number | string | null | undefined) {
  return value === null || typeof value === "undefined" ? "N/A" : `${value}%`;
}

function wrapText(value: string | number | null | undefined, maxChars: number, maxLines = 2) {
  const words = sanitizeText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxChars ? `${word.slice(0, Math.max(0, maxChars - 1))}.` : word;
    if (lines.length >= maxLines) break;
  }

  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === 0) lines.push("-");
  return lines.slice(0, maxLines);
}

function parsePngImage(buffer: Buffer): PdfImage | null {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) return null;

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (!width || !height || bitDepth !== 8 || interlace !== 0 || idatParts.length === 0) return null;
  const colors = colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (colors > 0) {
    return {
      name: "",
      width,
      height,
      data: Buffer.concat(idatParts),
      filter: "FlateDecode",
      decodeParms: `/DecodeParms << /Predictor 15 /Colors ${colors} /BitsPerComponent 8 /Columns ${width} >>`
    };
  }

  return null;
}

function parseJpegImage(buffer: Buffer): PdfImage | null {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return { name: "", width, height, data: buffer, filter: "DCTDecode" };
    }
    offset += 2 + length;
  }

  return null;
}

function imageFromDataUri(dataUri: string | null | undefined, mime: string | null | undefined) {
  if (!dataUri) return null;
  const base64 = dataUri.includes(",") ? dataUri.split(",").pop() : dataUri;
  if (!base64) return null;

  const buffer = Buffer.from(base64, "base64");
  const image = mime === "image/jpeg" ? parseJpegImage(buffer) : mime === "image/png" ? parsePngImage(buffer) : null;
  return image;
}

class SimplePdf {
  private pages: string[][] = [[]];
  private y = page.height - page.margin;
  private images: PdfImage[] = [];

  private get content() {
    return this.pages[this.pages.length - 1];
  }

  addPage() {
    this.pages.push([]);
    this.y = page.height - page.margin;
  }

  ensureSpace(height: number) {
    if (this.y - height < page.bottom) this.addPage();
  }

  moveDown(height: number) {
    this.y -= height;
  }

  text(value: string | number | null | undefined, x: number, y: number, size = 8, font: PdfFont = "regular") {
    const fontRef = font === "bold" ? "F2" : "F1";
    this.content.push(`BT /${fontRef} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${escapePdfText(sanitizeText(value))}) Tj ET`);
  }

  line(x1: number, y1: number, x2: number, y2: number) {
    this.content.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  rect(x: number, y: number, width: number, height: number) {
    this.content.push(`${x.toFixed(2)} ${y.toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re S`);
  }

  section(title: string) {
    this.ensureSpace(22);
    this.moveDown(10);
    this.text(title, page.margin, this.y, 9.5, "bold");
    this.moveDown(5);
    this.line(page.margin, this.y, page.margin + contentWidth, this.y);
    this.moveDown(8);
  }

  paragraph(value: string | number | null | undefined, maxLines = 4) {
    const lines = wrapText(value, 126, maxLines);
    this.ensureSpace(lines.length * 11 + 4);
    for (const line of lines) {
      this.text(line, page.margin, this.y, 8);
      this.moveDown(11);
    }
    this.moveDown(3);
  }

  infoGrid(items: Array<{ label: string; value: string | number | null | undefined }>) {
    const columnWidth = (contentWidth - 14) / 3;
    const rowHeight = 22;

    for (let index = 0; index < items.length; index += 3) {
      this.ensureSpace(rowHeight + 5);
      const rowItems = items.slice(index, index + 3);
      rowItems.forEach((item, columnIndex) => {
        const x = page.margin + columnIndex * (columnWidth + 7);
        this.text(item.label.toUpperCase(), x, this.y, 6.5, "bold");
        this.text(sanitizeText(item.value).slice(0, 34), x, this.y - 11, 8);
      });
      this.moveDown(rowHeight);
    }
    this.moveDown(3);
  }

  table<T>(columns: TableColumn<T>[], rows: T[], options: { rowHeight?: number; fontSize?: number; maxLines?: number } = {}) {
    const rowHeight = options.rowHeight ?? 27;
    const fontSize = options.fontSize ?? 6.7;
    const maxLines = options.maxLines ?? 2;

    const drawHeader = () => {
      this.ensureSpace(18 + rowHeight);
      let x = page.margin;
      columns.forEach((column) => {
        this.text(column.label, x, this.y, 6.5, "bold");
        x += column.width;
      });
      this.moveDown(12);
      this.line(page.margin, this.y, page.margin + contentWidth, this.y);
      this.moveDown(6);
    };

    drawHeader();

    if (rows.length === 0) {
      this.ensureSpace(18);
      this.text("Sin registros.", page.margin, this.y, 8);
      this.moveDown(18);
      return;
    }

    rows.forEach((row) => {
      if (this.y - rowHeight < page.bottom) {
        this.addPage();
        drawHeader();
      }

      let x = page.margin;
      const top = this.y;
      columns.forEach((column) => {
        const raw = column.value(row);
        const estimatedChars = Math.max(5, Math.floor(column.width / (fontSize * 0.55)));
        const lines = wrapText(raw, estimatedChars, maxLines);
        lines.forEach((line, lineIndex) => {
          this.text(line, x, top - lineIndex * (fontSize + 2), fontSize);
        });
        x += column.width;
      });
      this.moveDown(rowHeight);
      this.line(page.margin, this.y + 7, page.margin + contentWidth, this.y + 7);
    });

    this.moveDown(6);
  }

  groupedBreakdown(
    rows: Array<{
      codigo?: string;
      nombre: string;
      minutos: number;
      detalle_indicadores?: Array<{ codigo: string; nombre: string; minutos: number }>;
    }>,
    options: { showEmptyGroups?: boolean } = {}
  ) {
    const visibleRows = options.showEmptyGroups ? rows : rows.filter((row) => Number(row.minutos) > 0);
    if (visibleRows.length === 0) {
      this.ensureSpace(16);
      this.text("Sin minutos registrados.", page.margin, this.y, 8);
      this.moveDown(16);
      return;
    }

    visibleRows.forEach((row) => {
      const detalles = (row.detalle_indicadores ?? []).filter((detalle) => Number(detalle.minutos) > 0);
      const height = 17 + Math.max(0, detalles.length) * 10 + 5;
      this.ensureSpace(height);
      this.text(row.codigo ? `${row.codigo} - ${row.nombre}` : row.nombre, page.margin, this.y, 8, "bold");
      this.text(`${row.minutos} min`, page.margin + contentWidth - 52, this.y, 8, "bold");
      this.moveDown(12);
      if (detalles.length === 0) {
        this.text("Sin detenciones registradas.", page.margin + 12, this.y, 6.8);
        this.moveDown(9);
      } else {
        detalles.forEach((detalle) => {
          this.text(`${detalle.codigo} - ${detalle.nombre}`, page.margin + 12, this.y, 6.8);
          this.text(`${detalle.minutos} min`, page.margin + contentWidth - 52, this.y, 6.8);
          this.moveDown(10);
        });
      }
      this.line(page.margin, this.y + 3, page.margin + contentWidth, this.y + 3);
      this.moveDown(5);
    });
  }

  image(image: PdfImage, title: string) {
    const imageName = `Im${this.images.length + 1}`;
    const maxWidth = contentWidth;
    const maxHeight = 430;
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const titleHeight = 24;
    const blockHeight = titleHeight + drawHeight + 12;

    if (blockHeight > this.y - page.bottom) this.addPage();
    image.name = imageName;
    this.images.push(image);
    this.text(title, page.margin, this.y, 9.5, "bold");
    this.moveDown(14);
    const x = page.margin + (contentWidth - drawWidth) / 2;
    const y = this.y - drawHeight;
    this.content.push(`q ${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${imageName} Do Q`);
    this.rect(x, y, drawWidth, drawHeight);
    this.y = y - 12;
  }

  build() {
    const pageCount = this.pages.length;
    this.pages.forEach((content, index) => {
      content.push(`BT /F1 7 Tf ${page.margin.toFixed(2)} 22 Td (Pagina ${index + 1} de ${pageCount}) Tj ET`);
    });

    const objects: string[] = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
    ];

    const imageObjectIds = new Map<string, number>();
    this.images.forEach((image) => {
      const objectId = objects.length + 1;
      imageObjectIds.set(image.name, objectId);
      objects.push(
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${image.filter} ${image.decodeParms ?? ""} /Length ${image.data.length} >>\nstream\n${Buffer.from(image.data).toString("latin1")}\nendstream`
      );
    });

    const pageObjectIds: number[] = [];
    this.pages.forEach((content) => {
      const stream = content.join("\n");
      const contentObjectId = objects.length + 1;
      objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
      const pageObjectId = objects.length + 1;
      pageObjectIds.push(pageObjectId);
      const xObjectResources = Array.from(imageObjectIds.entries())
        .map(([name, id]) => `/${name} ${id} 0 R`)
        .join(" ");
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xObjectResources ? ` /XObject << ${xObjectResources} >>` : ""} >> /Contents ${contentObjectId} 0 R >>`);
    });

    objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageCount} >>`;

    const parts: string[] = ["%PDF-1.4\n"];
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(parts.join(""), "latin1"));
      parts.push(`${index + 1} 0 obj\n${object}\nendobj\n`);
    });
    const xrefOffset = Buffer.byteLength(parts.join(""), "latin1");
    parts.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    offsets.slice(1).forEach((offset) => {
      parts.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
    });
    parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

    return Buffer.from(parts.join(""), "latin1");
  }
}

export async function generateReportePdfBuffer(reporteId: number) {
  const reporte = await getReporteById(reporteId);
  if (!reporte) {
    throw Object.assign(new Error("Reporte no encontrado"), { statusCode: 404 });
  }

  const [resumen, detenciones, cajas] = await Promise.all([
    getReporteResumen(reporteId),
    getDetencionesByReporteId(reporteId),
    getCajasByReporteId(reporteId)
  ]);

  const pdf = new SimplePdf();

  pdf.text("Reporte Diario de Produccion y Detenciones", page.margin, page.height - page.margin, 14, "bold");
  pdf.text(`Reporte ID ${reporte.id} | Estado ${reporte.estado}`, page.margin, page.height - page.margin - 15, 8);
  pdf.moveDown(28);

  pdf.section("Resumen general");
  pdf.infoGrid([
    { label: "Fecha reporte", value: reporte.fecha_reporte },
    { label: "Linea", value: reporte.linea_nombre },
    { label: "Finalizado", value: reporte.finalizado_at },
    { label: "OPINONA planificada", value: percentValue(reporte.opinona_planificada) },
    { label: "OPINONA real", value: percentValue(reporte.opinona_real) },
    { label: "Cumplimiento", value: percentValue(resumen.cumplimiento) },
    { label: "Producciones programadas", value: reporte.producciones_programadas },
    { label: "Producciones realizadas", value: reporte.producciones_realizadas },
    { label: "Atraso / Adelanto", value: `${reporte.tipo_atraso_adelanto}: ${reporte.minutos_atraso_adelanto} min` },
    { label: "Total minutos", value: `${resumen.total_minutos} min` },
    { label: "Total detenciones", value: resumen.total_detenciones },
    { label: "Actualizacion", value: reporte.ultima_actualizacion }
  ]);

  pdf.section("Observacion general");
  pdf.paragraph(reporte.observacion_general, 3);

  pdf.section("Detenciones del dia");
  pdf.table(
    [
      { label: "Ind.", width: 35, value: (row) => row.indicador },
      { label: "Turno", width: 35, value: (row) => row.turno },
      { label: "Zona", width: 58, value: (row) => row.zona },
      { label: "Inicio", width: 42, value: (row) => row.inicio },
      { label: "Fin", width: 42, value: (row) => row.fin },
      { label: "Min", width: 30, value: (row) => row.minutos },
      { label: "Descripcion", width: 190, value: (row) => row.descripcion },
      { label: "Plan accion", width: 95, value: (row) => row.plan }
    ],
    detenciones.map((detencion) => ({
      indicador: detencion.indicador_codigo,
      turno: detencion.turno_codigo,
      zona: detencion.zona_nombre,
      inicio: detencion.hora_inicio,
      fin: detencion.hora_fin ?? "-",
      minutos: detencion.minutos_finales ?? detencion.minutos_calculados,
      descripcion: detencion.descripcion,
      plan: detencion.plan_accion ?? "-"
    })),
    { rowHeight: 26, fontSize: 6.2, maxLines: 2 }
  );

  let reporteImage: PdfImage | null = null;
  try {
    reporteImage = imageFromDataUri(reporte.imagen_reporte_data, reporte.imagen_reporte_mime);
  } catch {
    reporteImage = null;
  }

  if (reporteImage) {
    pdf.section("Captura OPINONA");
    pdf.image(reporteImage, `Captura OPINONA ${reporte.fecha_reporte}`);
  } else if (reporte.imagen_reporte_nombre) {
    pdf.section("Captura OPINONA");
    pdf.paragraph(`Captura registrada: ${reporte.imagen_reporte_nombre}. No fue posible incrustarla en este PDF.`, 2);
  }

  pdf.section("Cajas retenidas/rechazadas");
  pdf.table(
    [
      { label: "Tipo", width: 70, value: (row) => row.tipo },
      { label: "Turno", width: 60, value: (row) => row.turno },
      { label: "Cantidad", width: 55, value: (row) => row.cantidad },
      { label: "ID producto", width: 105, value: (row) => row.productoId },
      { label: "Producto", width: 237, value: (row) => row.producto }
    ],
    cajas.map((caja) => ({
      tipo: caja.tipo,
      turno: caja.turno_codigo,
      cantidad: caja.cantidad,
      productoId: caja.producto_id,
      producto: caja.producto_nombre
    })),
    { rowHeight: 20, fontSize: 6.8, maxLines: 1 }
  );

  pdf.section("Minutos por indicador");
  pdf.table(
    [
      { label: "Codigo", width: 55, value: (row) => row.codigo },
      { label: "Nombre", width: 375, value: (row) => row.nombre },
      { label: "Min", width: 97, value: (row) => row.minutos }
    ],
    resumen.total_por_indicador
      .filter((item) => Number(item.minutos) > 0)
      .map((item) => ({ codigo: item.codigo, nombre: item.nombre, minutos: item.minutos }))
      .sort((a, b) => Number(b.minutos) - Number(a.minutos) || String(a.codigo).localeCompare(String(b.codigo))),
    { rowHeight: 20, fontSize: 7, maxLines: 1 }
  );

  pdf.section("Minutos por turno");
  pdf.groupedBreakdown(
    resumen.total_por_turno
      .map((item) => ({
        codigo: item.codigo,
        nombre: item.nombre,
        minutos: Number(item.minutos),
        detalle_indicadores: item.detalle_indicadores ?? []
      }))
      .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))),
    { showEmptyGroups: true }
  );

  pdf.section("Minutos por zona");
  pdf.groupedBreakdown(
    resumen.total_por_zona
      .filter((item) => Number(item.minutos) > 0)
      .map((item) => ({
        nombre: item.nombre,
        minutos: Number(item.minutos),
        detalle_indicadores: item.detalle_indicadores ?? []
      }))
      .sort((a, b) => Number(b.minutos) - Number(a.minutos) || String(a.nombre).localeCompare(String(b.nombre)))
  );

  return pdf.build();
}
