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
  zona_id: number;
  zona_nombre: string;
  hora_inicio: string;
  hora_inicio_orden: string;
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
  zona_id: number;
  hora_inicio: string;
  hora_fin?: string | null;
  descripcion: string;
  plan_accion?: string | null;
}
