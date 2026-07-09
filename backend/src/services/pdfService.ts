import { getDetencionesByReporteId } from "./detencionService.js";
import { getReporteById, getReporteResumen } from "./reporteService.js";

type PdfFont = "regular" | "bold";

type TableColumn<T> = {
  label: string;
  width: number;
  value: (row: T) => string | number | null | undefined;
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

class SimplePdf {
  private pages: string[][] = [[]];
  private y = page.height - page.margin;

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

  section(title: string) {
    this.ensureSpace(24);
    this.moveDown(13);
    this.text(title, page.margin, this.y, 9.5, "bold");
    this.moveDown(5);
    this.line(page.margin, this.y, page.margin + contentWidth, this.y);
    this.moveDown(10);
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
    const rowHeight = 24;

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

    const pageObjectIds: number[] = [];
    this.pages.forEach((content) => {
      const stream = content.join("\n");
      const contentObjectId = objects.length + 1;
      objects.push(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
      const pageObjectId = objects.length + 1;
      pageObjectIds.push(pageObjectId);
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectId} 0 R >>`);
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

  const [resumen, detenciones] = await Promise.all([
    getReporteResumen(reporteId),
    getDetencionesByReporteId(reporteId)
  ]);

  const pdf = new SimplePdf();

  pdf.text("Reporte Diario de Produccion y Detenciones", page.margin, page.height - page.margin, 14, "bold");
  pdf.text(`Reporte ID ${reporte.id} | Estado ${reporte.estado}`, page.margin, page.height - page.margin - 15, 8);
  pdf.moveDown(32);

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
  pdf.paragraph(reporte.observacion_general, 4);

  pdf.section("Detenciones del dia");
  pdf.table(
    [
      { label: "Ind.", width: 35, value: (row) => row.indicador },
      { label: "Turno", width: 35, value: (row) => row.turno },
      { label: "Inicio", width: 42, value: (row) => row.inicio },
      { label: "Fin", width: 42, value: (row) => row.fin },
      { label: "Min", width: 30, value: (row) => row.minutos },
      { label: "Descripcion", width: 220, value: (row) => row.descripcion },
      { label: "Plan accion", width: 123, value: (row) => row.plan }
    ],
    detenciones.map((detencion) => ({
      indicador: detencion.indicador_codigo,
      turno: detencion.turno_codigo,
      inicio: detencion.hora_inicio,
      fin: detencion.hora_fin ?? "-",
      minutos: detencion.minutos_finales ?? detencion.minutos_calculados,
      descripcion: detencion.descripcion,
      plan: detencion.plan_accion ?? "-"
    })),
    { rowHeight: 28, fontSize: 6.4, maxLines: 2 }
  );

  pdf.section("Minutos por indicador");
  pdf.table(
    [
      { label: "Codigo", width: 55, value: (row) => row.codigo },
      { label: "Nombre", width: 375, value: (row) => row.nombre },
      { label: "Min", width: 97, value: (row) => row.minutos }
    ],
    resumen.total_por_indicador
      .map((item) => ({ codigo: item.codigo, nombre: item.nombre, minutos: item.minutos }))
      .sort((a, b) => Number(b.minutos) - Number(a.minutos) || String(a.codigo).localeCompare(String(b.codigo))),
    { rowHeight: 20, fontSize: 7, maxLines: 1 }
  );

  pdf.section("Minutos por turno");
  pdf.table(
    [
      { label: "Turno", width: 70, value: (row) => row.codigo },
      { label: "Nombre", width: 360, value: (row) => row.nombre },
      { label: "Min", width: 97, value: (row) => row.minutos }
    ],
    resumen.total_por_turno
      .map((item) => ({ codigo: item.codigo, nombre: item.nombre, minutos: item.minutos }))
      .sort((a, b) => Number(b.minutos) - Number(a.minutos) || String(a.codigo).localeCompare(String(b.codigo))),
    { rowHeight: 20, fontSize: 7, maxLines: 1 }
  );

  return pdf.build();
}
