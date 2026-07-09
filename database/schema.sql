CREATE DATABASE IF NOT EXISTS reporte_detenciones
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE reporte_detenciones;

CREATE TABLE IF NOT EXISTS lineas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL UNIQUE,
  activa TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS indicadores (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL UNIQUE,
  nombre VARCHAR(160) NOT NULL,
  color VARCHAR(20) NOT NULL,
  orden INT UNSIGNED NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS turnos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS turno_horarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  turno_id INT UNSIGNED NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fin TIME NOT NULL,
  cruza_medianoche TINYINT(1) NOT NULL DEFAULT 0,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_turno_horarios_turno
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT chk_turno_horarios_dia
    CHECK (dia_semana BETWEEN 1 AND 7),
  UNIQUE KEY uq_turno_horarios_turno_dia (turno_id, dia_semana),
  INDEX idx_turno_horarios_activo (activo),
  INDEX idx_turno_horarios_dia (dia_semana)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reportes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha_reporte DATE NOT NULL,
  linea_id INT UNSIGNED NOT NULL,
  opinona_planificada DECIMAL(5,2) UNSIGNED NOT NULL DEFAULT 0,
  opinona_real DECIMAL(5,2) UNSIGNED NOT NULL DEFAULT 0,
  producciones_programadas INT UNSIGNED NOT NULL DEFAULT 0,
  producciones_realizadas INT UNSIGNED NOT NULL DEFAULT 0,
  tipo_atraso_adelanto ENUM('atraso', 'adelanto', 'sin_variacion') NOT NULL DEFAULT 'atraso',
  minutos_atraso_adelanto INT NOT NULL DEFAULT 0,
  observacion_general TEXT NULL,
  imagen_reporte_data LONGTEXT NULL,
  imagen_reporte_mime VARCHAR(50) NULL,
  imagen_reporte_nombre VARCHAR(255) NULL,
  estado ENUM('abierto', 'finalizado') NOT NULL DEFAULT 'abierto',
  finalizado_at DATETIME NULL,
  ultima_actualizacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reportes_linea
    FOREIGN KEY (linea_id) REFERENCES lineas(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_reportes_estado (estado),
  INDEX idx_reportes_fecha (fecha_reporte)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS detenciones (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reporte_id BIGINT UNSIGNED NOT NULL,
  indicador_id INT UNSIGNED NOT NULL,
  turno_id INT UNSIGNED NOT NULL,
  hora_inicio DATETIME NOT NULL,
  hora_fin DATETIME NULL,
  descripcion TEXT NOT NULL,
  plan_accion TEXT NULL,
  minutos_finales INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_detenciones_reporte
    FOREIGN KEY (reporte_id) REFERENCES reportes(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_detenciones_indicador
    FOREIGN KEY (indicador_id) REFERENCES indicadores(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_detenciones_turno
    FOREIGN KEY (turno_id) REFERENCES turnos(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  INDEX idx_detenciones_reporte (reporte_id),
  INDEX idx_detenciones_indicador (indicador_id),
  INDEX idx_detenciones_turno (turno_id)
) ENGINE=InnoDB;
