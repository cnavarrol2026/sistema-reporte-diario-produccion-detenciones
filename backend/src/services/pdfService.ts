import PDFDocument from "pdfkit";
import { getDetencionesByReporteId } from "./detencionService.js";
import { getReporteById, getReporteResumen } from "./reporteService.js";

type TableColumn<T> = {
  label: string;
  width: number;
  value: (row: T) => string | number | null | undefined;
};

type TableOptions = {
  fontSize?: number;
  paddingY?: number;
};

const page = {
  margin: 28,
  width: 539,
  bottom: 812
};

function textValue(value: string | number | null | undefined) {
  return value === null || typeof value === "undefined" || value === "" ? "-" : String(value);
}

function percentValue(value: number | null) {
  return value === null ? "N/A" : `${value}%`;
}

function ensureSpace(document: PDFKit.PDFDocument, needed: number) {
  if (document.y + needed > page.bottom) {
    document.addPage();
    document.y = page.margin;
  }
}

function title(document: PDFKit.PDFDocument, text: string) {
  ensureSpace(document, 24);
  document.moveDown(0.45);
  document.font("Helvetica-Bold").fontSize(10).fillColor("#172534").text(text);
  document.moveDown(0.2);
  document.moveTo(page.margin, document.y).lineTo(page.margin + page.width, document.y).strokeColor("#d9e2ec").stroke();
  document.moveDown(0.35);
}

function infoGrid(document: PDFKit.PDFDocument, items: Array<{ label: string; value: string | number | null | undefined }>) {
  const columnWidth = 174;
  const rowHeight = 28;
  let x = page.margin;
  let y = document.y;

  items.forEach((item, index) => {
    if (index > 0 && index % 3 === 0) {
      x = page.margin;
      y += rowHeight + 5;
    }
    ensureSpace(document, rowHeight + 8);
    document.roundedRect(x, y, columnWidth, rowHeight, 4).fillAndStroke("#f8fafc", "#e4ebf2");
    document.font("Helvetica-Bold").fontSize(6.5).fillColor("#526274").text(item.label.toUpperCase(), x + 7, y + 5, {
      width: columnWidth - 14
    });
    document.font("Helvetica").fontSize(8).fillColor("#172534").text(textValue(item.value), x + 7, y + 16, {
      width: columnWidth - 14
    });
    x += columnWidth + 8;
  });

  document.y = y + rowHeight + 2;
}

function table<T>(document: PDFKit.PDFDocument, columns: TableColumn<T>[], rows: T[], options: TableOptions = {}) {
  const tableWidth = columns.reduce((total, column) => total + column.width, 0);
  const headerHeight = 18;
  const fontSize = options.fontSize ?? 7.5;
  const paddingY = options.paddingY ?? 7;
  const minRowHeight = Math.max(20, fontSize + paddingY * 2);

  const drawHeader = () => {
    ensureSpace(document, headerHeight + minRowHeight);
    let x = page.margin;
    document.rect(page.margin, document.y, tableWidth, headerHeight).fill("#eaf1f8");
    columns.forEach((column) => {
      document.font("Helvetica-Bold").fontSize(6.5).fillColor("#172534").text(column.label, x + 4, document.y + 6, {
        width: column.width - 10
      });
      x += column.width;
    });
    document.y += headerHeight;
  };

  drawHeader();

  if (rows.length === 0) {
    document.font("Helvetica").fontSize(8).fillColor("#526274").text("Sin registros.", page.margin + 5, document.y + 7);
    document.y += minRowHeight + 8;
    return;
  }

  rows.forEach((row, index) => {
    const values = columns.map((column) => textValue(column.value(row)));
    const rowHeight = Math.max(
      minRowHeight,
      ...values.map((value, columnIndex) =>
        document.font("Helvetica").fontSize(fontSize).heightOfString(value, { width: columns[columnIndex].width - 10 }) + paddingY * 2
      )
    );

    if (document.y + rowHeight > page.bottom) {
      document.addPage();
      document.y = page.margin;
      drawHeader();
    }

    let x = page.margin;
    const y = document.y;
    document.rect(page.margin, y, tableWidth, rowHeight).fill(index % 2 === 0 ? "#ffffff" : "#f8fafc");
    columns.forEach((column, columnIndex) => {
      document.font("Helvetica").fontSize(fontSize).fillColor("#172534").text(values[columnIndex], x + 4, y + paddingY, {
        width: column.width - 8
      });
      x += column.width;
    });
    document.y = y + rowHeight;
  });

  document.moveDown(0.4);
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

  const document = new PDFDocument({ margin: page.margin, size: "A4", bufferPages: true });
  const chunks: Buffer[] = [];
  const output = new Promise<Buffer>((resolve, reject) => {
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  document.on("data", (chunk: Buffer) => chunks.push(chunk));

  document.font("Helvetica-Bold").fontSize(14).fillColor("#172534").text("Reporte Diario de Produccion y Detenciones");
  document.font("Helvetica").fontSize(8).fillColor("#526274").text(`Reporte ID ${reporte.id} | Estado: ${reporte.estado}`);

  title(document, "Datos principales");
  infoGrid(document, [
    { label: "Fecha reporte", value: reporte.fecha_reporte },
    { label: "Linea", value: reporte.linea_nombre },
    { label: "Finalizado", value: reporte.finalizado_at },
    { label: "Ultima actualizacion", value: reporte.ultima_actualizacion },
    { label: "OPINONA planificada", value: percentValue(reporte.opinona_planificada) },
    { label: "OPINONA real", value: percentValue(reporte.opinona_real) },
    { label: "Producciones programadas", value: reporte.producciones_programadas },
    { label: "Producciones realizadas", value: reporte.producciones_realizadas },
    { label: "Cumplimiento", value: percentValue(resumen.cumplimiento) },
    { label: "Atraso / Adelanto", value: `${reporte.tipo_atraso_adelanto}: ${reporte.minutos_atraso_adelanto} min` },
    { label: "Total minutos detencion", value: `${resumen.total_minutos} min` },
    { label: "Total detenciones", value: resumen.total_detenciones }
  ]);

  title(document, "Observacion general");
  ensureSpace(document, 32);
  document.font("Helvetica").fontSize(8).fillColor("#172534").text(textValue(reporte.observacion_general), {
    lineGap: 1,
    width: page.width
  });

  title(document, "Detenciones del dia");
  table(
    document,
    [
      { label: "Ind.", width: 38, value: (row) => row.indicador },
      { label: "Turno", width: 38, value: (row) => row.turno },
      { label: "Inicio", width: 40, value: (row) => row.inicio },
      { label: "Fin", width: 40, value: (row) => row.fin },
      { label: "Min", width: 32, value: (row) => row.minutos },
      { label: "Descripcion", width: 211, value: (row) => row.descripcion },
      { label: "Plan de accion", width: 140, value: (row) => row.plan }
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
    { fontSize: 6.7, paddingY: 4 }
  );

  title(document, "Minutos por indicador");
  table(
    document,
    [
      { label: "Codigo", width: 60, value: (row) => row.codigo },
      { label: "Nombre", width: 389, value: (row) => row.nombre },
      { label: "Min", width: 90, value: (row) => row.minutos }
    ],
    resumen.total_por_indicador
      .map((item) => ({ codigo: item.codigo, nombre: item.nombre, minutos: item.minutos }))
      .sort((a, b) => Number(b.minutos) - Number(a.minutos) || String(a.codigo).localeCompare(String(b.codigo))),
    { fontSize: 7, paddingY: 4 }
  );

  title(document, "Minutos por turno");
  table(
    document,
    [
      { label: "Turno", width: 80, value: (row) => row.codigo },
      { label: "Nombre", width: 369, value: (row) => row.nombre },
      { label: "Min", width: 90, value: (row) => row.minutos }
    ],
    resumen.total_por_turno
      .map((item) => ({ codigo: item.codigo, nombre: item.nombre, minutos: item.minutos }))
      .sort((a, b) => Number(b.minutos) - Number(a.minutos) || String(a.codigo).localeCompare(String(b.codigo))),
    { fontSize: 7, paddingY: 4 }
  );

  const pageCount = document.bufferedPageRange().count;
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    document.switchToPage(pageIndex);
    document.font("Helvetica").fontSize(7).fillColor("#526274").text(`Pagina ${pageIndex + 1} de ${pageCount}`, page.margin, 820, {
      align: "right",
      width: page.width
    });
  }

  document.end();
  return output;
}
