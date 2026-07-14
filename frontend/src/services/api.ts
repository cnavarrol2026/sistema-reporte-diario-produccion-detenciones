const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const API_TIMEOUT_MS = 25000;

function operatorMessage(path: string, status?: number, detail?: string | null) {
  if (detail) return detail;
  if (status === 0) return "No se pudo conectar con el backend. Verifique que el servidor este encendido.";
  if (status === 400) return "La solicitud tiene datos incompletos o invalidos. Revise los campos marcados.";
  if (status === 404) return "No se encontro la informacion solicitada.";
  if (status === 409) return "La accion no se puede realizar con el estado actual del reporte.";
  if (status && status >= 500) return "Ocurrio un error en el backend. Revise que MySQL y el servidor esten funcionando.";
  if (path.includes("/pdf")) return "No se pudo generar el PDF. Intente nuevamente.";
  return "No fue posible completar la accion. Intente nuevamente.";
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

async function fetchWithTimeout(path: string, options?: RequestInit) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      },
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error("La conexion con el backend tardo demasiado. Actualice o intente guardar nuevamente.");
    }
    throw new Error(operatorMessage(path, 0));
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export interface HealthResponse {
  status: "ok" | "error";
  message: string;
}

export interface Linea {
  id: number;
  nombre: string;
  activa: boolean;
}

export interface LineaInput {
  nombre: string;
  activa: boolean;
}

export interface Indicador {
  id: number;
  codigo: string;
  nombre: string;
  color: string;
  orden: number;
  activo: boolean;
}

export interface IndicadorInput {
  codigo: string;
  nombre: string;
  color: string;
  orden: number;
  activo: boolean;
}

export interface Turno {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface TurnoInput {
  codigo: string;
  nombre: string;
  activo: boolean;
}

export interface TurnoHorario {
  id: number;
  turno_id: number;
  turno_codigo: string;
  turno_nombre: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  cruza_medianoche: boolean;
  activo: boolean;
}

export interface TurnoHorarioInput {
  turno_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  cruza_medianoche: boolean;
  activo: boolean;
}

export type TipoAtrasoAdelanto = "Atraso" | "Adelanto";
export type ReporteEstado = "abierto" | "finalizado";

export interface Reporte {
  id: number;
  fecha_reporte: string;
  linea_id: number;
  linea_nombre: string;
  opinona_planificada: number | null;
  opinona_real: number | null;
  producciones_programadas: number | null;
  producciones_realizadas: number | null;
  tipo_atraso_adelanto: TipoAtrasoAdelanto;
  minutos_atraso_adelanto: number;
  observacion_general: string | null;
  imagen_reporte_data: string | null;
  imagen_reporte_mime: string | null;
  imagen_reporte_nombre: string | null;
  estado: ReporteEstado;
  finalizado_at: string | null;
  ultima_actualizacion: string;
  created_at: string;
  updated_at: string;
}

export interface ReporteUpdateInput {
  fecha_reporte?: string;
  linea_id?: number;
  opinona_planificada?: number | null;
  opinona_real?: number | null;
  producciones_programadas?: number | null;
  producciones_realizadas?: number | null;
  tipo_atraso_adelanto?: TipoAtrasoAdelanto;
  minutos_atraso_adelanto?: number;
  observacion_general?: string | null;
  imagen_reporte_data?: string | null;
  imagen_reporte_mime?: string | null;
  imagen_reporte_nombre?: string | null;
}

export interface ReporteResumenItem {
  id: number;
  codigo: string;
  nombre: string;
  color?: string;
  minutos: number;
}

export interface ReporteResumen {
  reporte_id: number;
  total_minutos: number;
  total_detenciones: number;
  total_detenciones_abiertas: number;
  cumplimiento: number | null;
  total_por_indicador: ReporteResumenItem[];
  total_por_turno: ReporteResumenItem[];
  opinona_planificada: number | null;
  opinona_real: number | null;
  producciones_programadas: number | null;
  producciones_realizadas: number | null;
}

export interface ReporteFinalizadoResponse {
  reporte: Reporte;
  resumen: ReporteResumen;
  pdf_url: string;
}

export interface ReporteFinalizadoFilters {
  fecha_inicio?: string;
  fecha_fin?: string;
  linea_id?: string;
}

export interface ReporteFinalizadoListItem {
  id: number;
  fecha_reporte: string;
  linea_id: number;
  linea_nombre: string;
  opinona_real: number | null;
  producciones_programadas: number | null;
  producciones_realizadas: number | null;
  cumplimiento: number | null;
  total_minutos: number;
  total_detenciones: number;
  finalizado_at: string | null;
}

export interface ReporteInforme {
  reporte: Reporte;
  resumen: ReporteResumen;
  detenciones: Detencion[];
  cajas: CajaRetenidaRechazada[];
  total_por_indicador: ReporteResumenItem[];
  total_por_turno: ReporteResumenItem[];
  observacion_general: string | null;
}

export interface DashboardFilters {
  fecha_inicio?: string;
  fecha_fin?: string;
  linea_id?: string;
  turno_id?: string;
}

export interface DashboardBreakdownItem {
  id: number;
  codigo: string;
  nombre: string;
  color?: string;
  minutos: number;
}

export interface DashboardRankingItem {
  id: number;
  fecha: string;
  linea: string;
  indicador: string;
  indicador_codigo: string;
  turno: string;
  minutos: number;
  descripcion: string;
}

export interface DashboardResumen {
  total_minutos: number;
  total_detenciones: number;
  cumplimiento_promedio_o_calculado: number | null;
  opinona_planificada_promedio: number | null;
  opinona_real_promedio: number | null;
  producciones_programadas_total: number;
  producciones_realizadas_total: number;
  minutos_por_indicador: DashboardBreakdownItem[];
  minutos_por_turno: DashboardBreakdownItem[];
  ranking_detenciones_largas: DashboardRankingItem[];
}

export interface Detencion {
  id: number;
  reporte_id: number;
  indicador_id: number;
  indicador_codigo: string;
  indicador_nombre: string;
  indicador_color: string;
  turno_id: number;
  turno_codigo: string;
  turno_nombre: string;
  hora_inicio: string;
  hora_fin: string | null;
  descripcion: string;
  plan_accion: string | null;
  minutos_finales: number | null;
  minutos_calculados: number;
  estado_calculado: "abierta" | "cerrada";
  created_at: string;
  updated_at: string;
}

export interface DetencionInput {
  indicador_id: number;
  turno_id: number;
  hora_inicio: string;
  hora_fin?: string | null;
  descripcion: string;
  plan_accion?: string | null;
}

export type CajaTipo = "Retenida" | "Rechazada";

export interface CajaRetenidaRechazada {
  id: number;
  reporte_id: number;
  turno_id: number;
  turno_codigo: string;
  turno_nombre: string;
  tipo: CajaTipo;
  cantidad: number;
  producto_id: string;
  producto_nombre: string;
  created_at: string;
  updated_at: string;
}

export interface CajaRetenidaRechazadaInput {
  turno_id: number;
  tipo: CajaTipo;
  cantidad: number;
  producto_id: string;
  producto_nombre: string;
}

interface ApiMessage<T> {
  message: string;
  data: T;
}

async function requestJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetchWithTimeout(path, options);

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = payload && typeof payload === "object" && "detail" in payload ? String(payload.detail) : null;
    throw new Error(operatorMessage(path, response.status, detail));
  }

  return payload as T;
}

async function requestBlob(path: string, options?: RequestInit): Promise<Blob> {
  const response = await fetchWithTimeout(path, options);

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload && typeof payload === "object" && "detail" in payload ? String(payload.detail) : null;
    throw new Error(operatorMessage(path, response.status, detail));
  }

  return response.blob();
}

function withInactive(path: string, incluirInactivas: boolean) {
  return incluirInactivas ? `${path}?incluirInactivas=true` : path;
}

export function fetchHealth() {
  return requestJson<HealthResponse>("/health");
}

export function fetchReporteActual() {
  return requestJson<Reporte | null>("/reportes/actual");
}

export function iniciarReporte(fecha_reporte?: string) {
  return requestJson<Reporte>("/reportes/iniciar", {
    method: "POST",
    body: JSON.stringify({ fecha_reporte })
  });
}

export function updateReporte(id: number, input: ReporteUpdateInput) {
  return requestJson<Reporte>(`/reportes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function fetchReporteResumen(reporteId: number) {
  return requestJson<ReporteResumen>(`/reportes/${reporteId}/resumen`);
}

export function fetchReportesFinalizados(filters: ReporteFinalizadoFilters = {}) {
  const params = new URLSearchParams();
  if (filters.fecha_inicio) params.set("fecha_inicio", filters.fecha_inicio);
  if (filters.fecha_fin) params.set("fecha_fin", filters.fecha_fin);
  if (filters.linea_id) params.set("linea_id", filters.linea_id);
  const query = params.toString();
  return requestJson<ReporteFinalizadoListItem[]>(`/reportes/finalizados${query ? `?${query}` : ""}`);
}

export function fetchReporteInforme(reporteId: number) {
  return requestJson<ReporteInforme>(`/reportes/${reporteId}/informe`);
}

export function fetchDashboard(filters: DashboardFilters = {}) {
  const params = new URLSearchParams();
  if (filters.fecha_inicio) params.set("fecha_inicio", filters.fecha_inicio);
  if (filters.fecha_fin) params.set("fecha_fin", filters.fecha_fin);
  if (filters.linea_id) params.set("linea_id", filters.linea_id);
  if (filters.turno_id) params.set("turno_id", filters.turno_id);
  const query = params.toString();
  return requestJson<DashboardResumen>(`/dashboard${query ? `?${query}` : ""}`);
}

export function finalizarReporte(reporteId: number) {
  return requestJson<ReporteFinalizadoResponse>(`/reportes/${reporteId}/finalizar`, { method: "POST" });
}

export function downloadReportePdf(reporteId: number) {
  return requestBlob(`/reportes/${reporteId}/pdf`);
}

export function downloadDatabaseBackup() {
  return requestBlob("/database/backup");
}

export function fetchDetenciones(reporteId: number) {
  return requestJson<Detencion[]>(`/reportes/${reporteId}/detenciones`);
}

export function fetchCajas(reporteId: number) {
  return requestJson<CajaRetenidaRechazada[]>(`/reportes/${reporteId}/cajas`);
}

export function createDetencion(reporteId: number, input: DetencionInput) {
  return requestJson<Detencion>(`/reportes/${reporteId}/detenciones`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateDetencion(id: number, input: DetencionInput) {
  return requestJson<Detencion>(`/detenciones/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteDetencion(id: number) {
  return requestJson<ApiMessage<Detencion>>(`/detenciones/${id}`, { method: "DELETE" });
}

export function createCaja(reporteId: number, input: CajaRetenidaRechazadaInput) {
  return requestJson<CajaRetenidaRechazada>(`/reportes/${reporteId}/cajas`, {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateCaja(id: number, input: CajaRetenidaRechazadaInput) {
  return requestJson<CajaRetenidaRechazada>(`/cajas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deleteCaja(id: number) {
  return requestJson<ApiMessage<CajaRetenidaRechazada>>(`/cajas/${id}`, { method: "DELETE" });
}

export async function fetchInitialConfiguration(incluirInactivas = false) {
  const [lineas, indicadores, turnos, horarios] = await Promise.all([
    fetchLineas(incluirInactivas),
    fetchIndicadores(incluirInactivas),
    fetchTurnos(incluirInactivas),
    fetchTurnoHorarios(incluirInactivas)
  ]);

  return { lineas, indicadores, turnos, horarios };
}

export function fetchLineas(incluirInactivas = false) {
  return requestJson<Linea[]>(withInactive("/lineas", incluirInactivas));
}

export function createLinea(input: LineaInput) {
  return requestJson<Linea>("/lineas", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateLinea(id: number, input: LineaInput) {
  return requestJson<Linea>(`/lineas/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deactivateLinea(id: number) {
  return requestJson<ApiMessage<Linea>>(`/lineas/${id}`, { method: "DELETE" });
}

export function fetchIndicadores(incluirInactivas = false) {
  return requestJson<Indicador[]>(withInactive("/indicadores", incluirInactivas));
}

export function createIndicador(input: IndicadorInput) {
  return requestJson<Indicador>("/indicadores", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateIndicador(id: number, input: IndicadorInput) {
  return requestJson<Indicador>(`/indicadores/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deactivateIndicador(id: number) {
  return requestJson<ApiMessage<Indicador>>(`/indicadores/${id}`, { method: "DELETE" });
}

export function fetchTurnos(incluirInactivas = false) {
  return requestJson<Turno[]>(withInactive("/turnos", incluirInactivas));
}

export function createTurno(input: TurnoInput) {
  return requestJson<Turno>("/turnos", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateTurno(id: number, input: TurnoInput) {
  return requestJson<Turno>(`/turnos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deactivateTurno(id: number) {
  return requestJson<ApiMessage<Turno>>(`/turnos/${id}`, { method: "DELETE" });
}

export function fetchTurnoHorarios(incluirInactivas = false) {
  return requestJson<TurnoHorario[]>(withInactive("/turno-horarios", incluirInactivas));
}

export function createTurnoHorario(input: TurnoHorarioInput) {
  return requestJson<TurnoHorario>("/turno-horarios", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

export function updateTurnoHorario(id: number, input: TurnoHorarioInput) {
  return requestJson<TurnoHorario>(`/turno-horarios/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input)
  });
}

export function deactivateTurnoHorario(id: number) {
  return requestJson<ApiMessage<TurnoHorario>>(`/turno-horarios/${id}`, { method: "DELETE" });
}
