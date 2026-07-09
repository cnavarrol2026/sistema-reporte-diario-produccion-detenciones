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
  linea_id?: number;
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
