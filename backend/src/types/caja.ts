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
