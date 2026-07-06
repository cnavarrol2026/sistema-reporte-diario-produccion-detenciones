export interface DashboardFilters {
  fecha_inicio?: string;
  fecha_fin?: string;
  linea_id?: number;
  turno_id?: number;
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
