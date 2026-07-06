export interface Linea {
  id: number;
  nombre: string;
  activa: boolean;
}

export interface LineaInput {
  nombre: string;
  activa?: boolean;
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
  activo?: boolean;
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
  activo?: boolean;
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
  cruza_medianoche?: boolean;
  activo?: boolean;
}
